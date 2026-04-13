import {
  Inject,
  Injectable,
  OnModuleInit,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  CertificationDto,
  OptimizationResultDto,
  ProjectIdeaDto,
  ScrapeAndMatchDto,
  ScrapeJobDto,
} from '@app/dto';
import { AuthUser } from './auth/interfaces/auth-user.interface';
import { MSG } from '@app/contracts';
import { firstValueFrom, catchError, throwError } from 'rxjs';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class ApiGatewayService implements OnModuleInit {
  private readonly logger = new Logger(ApiGatewayService.name);

  constructor(
    @Inject('JOB_SCRAPER_SERVICE') private readonly scraperClient: ClientProxy,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    this.logger.log('Connecting to JOB_SCRAPER_SERVICE via TCP...');
    await this.scraperClient.connect();
    this.logger.log('Connected to JOB_SCRAPER_SERVICE');
  }

  getHello(): string {
    return 'Hello World!';
  }

  // This method is called by the controller when the /analysis/scrape endpoint is hit. It forwards the request to the job-scraper microservice and returns the result.
  async scrapeJob(dto: ScrapeJobDto, user: AuthUser) {
    this.logger.log(`Scrape job requested by user ${user.email}`);
    
    return firstValueFrom(
      this.scraperClient.send(MSG.SCRAPE_JOB, dto).pipe(
        catchError((error) => {
          this.logger.error(`Error scraping job: ${error.message || error}`);
          // Ensure HTTP status is a valid integer. Nest Microservices often set status to the string "error"
          const statusCode = typeof error.status === 'number' ? error.status : HttpStatus.BAD_REQUEST;
          return throwError(() => new HttpException(
            error.message || 'Error occurred while contacting Job Scraper service',
            statusCode,
          ));
        }),
      )
    );
  }


  // This is the main method that orchestrates the entire match pipeline
  async matchResume(dto: ScrapeJobDto, user: AuthUser, resumeId: string) {
    this.logger.log(`Full match pipeline requested by user ${user.email}`);

    const resume = await this.prisma.resume.findFirst({
      where: {
        id: resumeId,
        userId: user.id,
      },
      select: {
        id: true,
      },
    });

    if (!resume) {
      throw new NotFoundException('Resume not found for this user.');
    }

    // Scraper handles scraping then forwards the payload to Matcher over TCP.
    const scrapeAndMatchRequest: ScrapeAndMatchDto = {
      ...dto,
      resumeId,
    };

    return firstValueFrom(
      this.scraperClient.send(MSG.SCRAPE_AND_MATCH, scrapeAndMatchRequest).pipe(
        catchError((error) => {
          this.logger.error(`Error in scrape and match pipeline: ${error.message || error}`);
          const statusCode = typeof error.status === 'number' ? error.status : HttpStatus.BAD_REQUEST;
          return throwError(() => new HttpException(
            error.message || 'Error occurred while running the match pipeline',
            statusCode,
          ));
        }),
      )
    );
  }

  private asString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private parseProjectIdeas(value: unknown): ProjectIdeaDto[] {
    if (!Array.isArray(value)) return [];

    const parsed = value
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const record = item as Record<string, unknown>;
        return {
          title: this.asString(record.title),
          description: this.asString(record.description),
          techStack: Array.isArray(record.techStack)
            ? record.techStack
                .map((entry) => this.asString(entry))
                .filter(Boolean)
            : [],
        };
      })
      .filter((item) => item.title && item.description);

    return parsed;
  }

  private parseCertifications(value: unknown): CertificationDto[] {
    if (!Array.isArray(value)) return [];

    const parsed = value
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const record = item as Record<string, unknown>;
        return {
          name: this.asString(record.name),
          provider: this.asString(record.provider),
          url: this.asString(record.url),
        };
      })
      .filter((item) => item.name && item.provider && item.url);

    return parsed;
  }

  async getOptimizationResult(user: AuthUser, resumeId: string): Promise<OptimizationResultDto> {
    this.logger.log(`Optimization result requested by user ${user.email} for resumeId ${resumeId}`);

    const optimization = await this.prisma.optimizationResult.findFirst({
      where: {
        userId: user.id,
        resumeId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!optimization) {
      throw new NotFoundException('Optimization result not found yet for this resume.');
    }

    const latestMatch = await this.prisma.matchResult.findFirst({
      where: {
        userId: user.id,
        resumeId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      userId: optimization.userId,
      resumeId: optimization.resumeId,
      targetRole: latestMatch?.jobTitle || 'Unknown role',
      score: latestMatch?.score ?? 0,
      projectIdeas: this.parseProjectIdeas(optimization.projectIdeas),
      certifications: this.parseCertifications(optimization.certifications),
    };
  }
}

