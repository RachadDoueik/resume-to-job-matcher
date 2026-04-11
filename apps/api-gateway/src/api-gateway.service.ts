import { Inject, Injectable, OnModuleInit, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ScrapeAndMatchDto, ScrapeJobDto } from '@app/dto';
import { AuthUser } from './auth/interfaces/auth-user.interface';
import { MSG } from '@app/contracts';
import { firstValueFrom, catchError, throwError } from 'rxjs';

@Injectable()
export class ApiGatewayService implements OnModuleInit {
  private readonly logger = new Logger(ApiGatewayService.name);

  constructor(
    @Inject('JOB_SCRAPER_SERVICE') private readonly scraperClient: ClientProxy,
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
}

