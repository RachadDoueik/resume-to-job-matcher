import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { MatchRequestDto, MatchResultDto } from '@app/dto';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class MatcherService {
  private readonly logger = new Logger(MatcherService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async matchResume(dto: MatchRequestDto): Promise<MatchResultDto> {
    try {
      this.logger.log(`Starting matching process for Resume ID: ${dto.resumeId}`);

      // 1. TODO: Check Redis cache

      // 2. TODO: Fetch resume PDF from MinIO / S3

      // 3. TODO: Parse text from PDF buffer using pdf-parse

      // 4. TODO: Call Gemini (Google Gen AI) with jobDescription JSON + Resume Text

      // 5. MOCK DATA for now until Gemini logic is fully typed
      const mockResult = {
        score: 85,
        matchedSkills: ['Node.js', 'PostgreSQL'],
        missingSkills: ['Redis'],
        summary: 'Strong candidate but missing Redis caching experience.',
        resumeId: dto.resumeId,
        jobTitle: dto.jobDescription.title,
      };

      // 6. Save MatchResult to PostgreSQL via Prisma
      const savedResult = await this.prisma.matchResult.create({
        data: {
          score: mockResult.score,
          matchedSkills: mockResult.matchedSkills,
          missingSkills: mockResult.missingSkills,
          summary: mockResult.summary,
          resumeId: mockResult.resumeId,
          jobTitle: mockResult.jobTitle,
        }
      });

      this.logger.log(`Saved MatchResult to Postgres with ID: ${savedResult.id}`);

      // 7. TODO: Store result in Redis cache (TTL: 3600 seconds)

      return mockResult;
    } catch (error: any) {
      this.logger.error(`Error matching resume: ${error.message}`, error.stack);
      throw new RpcException(`Failed to process resume match: ${error.message}`);
    }
  }
}
