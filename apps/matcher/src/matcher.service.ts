import { Injectable, Logger, Inject } from '@nestjs/common';
import { RpcException, ClientProxy } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { MatchRequestDto, MatchResultDto, GapAnalysisReadyEventDto } from '@app/dto';
import { PrismaService } from './prisma/prisma.service';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import { PDFParse } from 'pdf-parse';

@Injectable()
export class MatcherService {
  private readonly logger = new Logger(MatcherService.name);
  private redis: Redis;
  private s3Client: S3Client;
  private genAI: GoogleGenerativeAI;
  private s3Bucket: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Inject('OPTIMIZER_QUEUE') private readonly optimizerClient: ClientProxy,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl);

    this.s3Bucket = this.configService.get<string>('S3_BUCKET_NAME') || 'resumes';
    this.s3Client = new S3Client({
      region: this.configService.get<string>('AWS_REGION') || 'us-east-1',
      endpoint: this.configService.get<string>('S3_ENDPOINT') || 'http://localhost:9000',
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || 'minioadmin',
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || 'minioadmin',
      },
      forcePathStyle: true,
    });

    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) this.logger.warn('GEMINI_API_KEY is not defined.');
    this.genAI = new GoogleGenerativeAI(apiKey || 'unconfigured');
  }

  private generateHash(data: object): string {
    return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
  }

  private isNoSuchKeyError(error: any): boolean {
    return (
      error?.name === 'NoSuchKey' ||
      error?.Code === 'NoSuchKey' ||
      error?.$metadata?.httpStatusCode === 404
    );
  }

  private async getResumeTextFromS3(resumeId: string): Promise<string> {
    try {
      const normalizedId = decodeURIComponent(resumeId).trim();
      const candidateKeys = new Set<string>([normalizedId]);

      if (normalizedId.toLowerCase().endsWith('.pdf')) {
        candidateKeys.add(normalizedId.slice(0, -4));
      } else {
        candidateKeys.add(`${normalizedId}.pdf`);
      }

      for (const key of candidateKeys) {
        try {
          this.logger.log(`Fetching PDF from MinIO bucket using key: ${key}`);
          const command = new GetObjectCommand({ Bucket: this.s3Bucket, Key: key });
          const response = await this.s3Client.send(command);
          if (!response.Body) throw new Error(`S3 response body is empty for key: ${key}`);

          const chunks: Buffer[] = [];
          for await (const chunk of response.Body as any) chunks.push(chunk);
          const buffer = Buffer.concat(chunks);

          const parser = new PDFParse({ data: buffer });
          try {
            const pdfData = await parser.getText();
            return pdfData.text;
          } finally {
            await parser.destroy();
          }
        } catch (error: any) {
          if (this.isNoSuchKeyError(error)) {
            this.logger.warn(`Resume key not found in MinIO: ${key}`);
            continue;
          }

          throw error;
        }
      }

      const resumeMeta = await this.prisma.resume.findUnique({ where: { id: normalizedId } });
      if (resumeMeta?.content?.trim()) {
        this.logger.warn(`MinIO object missing for ${normalizedId}. Falling back to resume content stored in DB.`);
        return resumeMeta.content;
      }

      throw new Error(`No matching object found in MinIO for resumeId: ${normalizedId}`);
    } catch (error: any) {
      this.logger.error('S3 Fetch Error: ' + error.message);
      throw new RpcException('Resume missing or corrupted: ' + error.message);
    }
  }

  async matchResume(dto: MatchRequestDto): Promise<MatchResultDto> {
    try {
      const jobHash = this.generateHash(dto.jobDescription);
      const cacheKey = `match:${dto.resumeId}:${jobHash}`;
      
      const cachedData = await this.redis.get(cacheKey);
      if (cachedData) return JSON.parse(cachedData);

      const resumeText = await this.getResumeTextFromS3(dto.resumeId);

      // Using Gemini Pro 3.1 (matching your preference) for matching analysis
      const model = this.genAI.getGenerativeModel({ 
        model: 'gemini-3-flash-preview',
        generationConfig: { responseMimeType: 'application/json' }
      });

      const prompt = `You are an expert career coach. Compare the provided Resume against the Job Description.
      Return strictly valid JSON with no markdown wrapping. The summary must be user-facing, speak directly to the candidate in second person, and begin with "You are". Format:
      {
        "score": 0,
        "matchedSkills": ["Array", "of", "found", "skills"],
        "missingSkills": ["Array", "of", "missing", "skills"],
        "summary": "Short 2 sentence summary that starts with 'You are' and talks directly to the user."
      }
      Job Description: ${JSON.stringify(dto.jobDescription)}
      Resume: ${resumeText.substring(0, 15000)}`;

      const result = await model.generateContent(prompt);
      const cleanText = result.response.text().replace(/^\s*```json\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      const parsedMatch = JSON.parse(cleanText);
      const rawSummary = typeof parsedMatch.summary === 'string' ? parsedMatch.summary.trim() : '';
      const normalizedSummary = rawSummary
        ? (rawSummary.toLowerCase().startsWith('you are') ? rawSummary : `You are ${rawSummary}`)
        : 'You are now viewing your gap analysis for this role.';

      const matchResult: MatchResultDto = {
        score: parsedMatch.score || 0,
        matchedSkills: parsedMatch.matchedSkills || [],
        missingSkills: parsedMatch.missingSkills || [],
        summary: normalizedSummary,
        resumeId: dto.resumeId,
        jobTitle: dto.jobDescription.title || 'Unknown Title',
      };

      // Ensure the resume exists in DB before attempting to link a MatchResult
      const resumeMeta = await this.prisma.resume.findUnique({ where: { id: dto.resumeId } });
      
      if (resumeMeta) {
        // Save to postgres if resume exists
         await this.prisma.matchResult.create({ 
           data: {
             score: matchResult.score,
             matchedSkills: matchResult.matchedSkills,
             missingSkills: matchResult.missingSkills,
             summary: matchResult.summary,
             resumeId: matchResult.resumeId,
             jobTitle: matchResult.jobTitle
           } 
         });

         const gapEvent: GapAnalysisReadyEventDto = {
          userId: resumeMeta.userId,
          resumeId: dto.resumeId,
          missingSkills: matchResult.missingSkills,
          targetRole: matchResult.jobTitle,
          score: matchResult.score,
        };
        this.optimizerClient.emit('gap_analysis_ready', gapEvent).subscribe({
          error: (emitError: any) => {
            this.logger.error(
              `Failed to publish gap_analysis_ready for resumeId ${dto.resumeId}: ${emitError?.message || emitError}`,
            );
          },
        });
      } else {
        this.logger.warn(
          `Skipping optimization publish because resume metadata was not found for resumeId: ${dto.resumeId}`,
        );
      }

      await this.redis.set(cacheKey, JSON.stringify(matchResult), 'EX', 3600); // cache for 1 hour
      
      return matchResult;

    } catch (error: any) {
      this.logger.error('Matching Error: ' + error.message);
      throw new RpcException('Failed match payload: ' + error.message);
    }
  }
}
