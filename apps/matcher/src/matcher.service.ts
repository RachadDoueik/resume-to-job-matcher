import { Injectable, Logger, Inject } from '@nestjs/common';
import { RpcException, ClientProxy } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { MatchRequestDto, MatchResultDto, GapAnalysisReadyEventDto } from '@app/dto';
import { PrismaService } from './prisma/prisma.service';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Redis from 'ioredis';
import * as crypto from 'crypto';
const pdf = require('pdf-parse');

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

  private async getResumeTextFromS3(resumeId: string): Promise<string> {
    try {
      this.logger.log('Fetching PDF from MinIO bucket...');
      const command = new GetObjectCommand({ Bucket: this.s3Bucket, Key: resumeId });
      const response = await this.s3Client.send(command);
      if (!response.Body) throw new Error('S3 response body is empty');
      
      const chunks: Buffer[] = [];
      for await (const chunk of response.Body as any) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);

      const pdfData = await pdf(buffer);
      return pdfData.text;
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
        model: 'gemini-3.1-pro-preview',
        generationConfig: { responseMimeType: 'application/json' }
      });

      const prompt = `Compare the provided Resume against the Job Description. Return strictly valid JSON with no markdown wrapping. Format:
      {
        "score": 0,
        "matchedSkills": ["Array", "of", "found", "skills"],
        "missingSkills": ["Array", "of", "missing", "skills"],
        "summary": "Short 2 sentence specific summary of the gap analysis."
      }
      Job Description: ${JSON.stringify(dto.jobDescription)}
      Resume: ${resumeText.substring(0, 15000)}`;

      const result = await model.generateContent(prompt);
      const cleanText = result.response.text().replace(/^\s*```json\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      const parsedMatch = JSON.parse(cleanText);

      const matchResult: MatchResultDto = {
        score: parsedMatch.score || 0,
        matchedSkills: parsedMatch.matchedSkills || [],
        missingSkills: parsedMatch.missingSkills || [],
        summary: parsedMatch.summary || 'Gap analysis completed.',
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
        this.optimizerClient.emit('gap_analysis_ready', gapEvent);
      }

      await this.redis.set(cacheKey, JSON.stringify(matchResult), 'EX', 3600); // cache for 1 hour
      
      return matchResult;

    } catch (error: any) {
      this.logger.error('Matching Error: ' + error.message);
      throw new RpcException('Failed match payload: ' + error.message);
    }
  }
}
