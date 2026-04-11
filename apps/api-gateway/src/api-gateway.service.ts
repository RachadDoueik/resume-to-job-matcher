import { Inject, Injectable, OnModuleInit, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ScrapeJobDto } from '@app/dto';
import { AuthUser } from './auth/interfaces/auth-user.interface';
import { MSG } from '@app/contracts';
import { firstValueFrom, catchError, throwError } from 'rxjs';

@Injectable()
export class ApiGatewayService implements OnModuleInit {
  private readonly logger = new Logger(ApiGatewayService.name);

  constructor(
    @Inject('JOB_SCRAPER_SERVICE') private readonly scraperClient: ClientProxy,
    @Inject('MATCHER_SERVICE') private readonly matcherClient: ClientProxy,
  ) {}

  async onModuleInit() {
    this.logger.log('Connecting to JOB_SCRAPER_SERVICE via TCP...');
    await this.scraperClient.connect();
    this.logger.log('Connected to JOB_SCRAPER_SERVICE');

    this.logger.log('Connecting to MATCHER_SERVICE via TCP...');
    await this.matcherClient.connect();
    this.logger.log('Connected to MATCHER_SERVICE');
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
  async matchResume(dto: ScrapeJobDto, user: AuthUser) {
    this.logger.log(`Full match pipeline requested by user ${user.email}`);

    // Fetch primary resume for user (mocked for now)
    const mockResumeId = '1234-abcd-5678-efgh';

    // 1. Scrape Job first by calling job-scraper manually
    const jobDescription = await this.scrapeJob(dto, user);

    // 2. Then send the MatchRequestDto exactly as expected to MATCHER via TCP
    const matchRequest = { resumeId: mockResumeId, jobDescription };

    return firstValueFrom(
      this.matcherClient.send(MSG.MATCH_RESUME, matchRequest).pipe(
        catchError((error) => {
          this.logger.error(`Error in matcher service: ${error.message || error}`);
          const statusCode = typeof error.status === 'number' ? error.status : HttpStatus.BAD_REQUEST;
          return throwError(() => new HttpException(
            error.message || 'Error occurred while running the match pipeline',
            statusCode,
          ));
        }),
      )
    );
  }
}

