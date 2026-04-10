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
  ) {}

  async onModuleInit() {
    this.logger.log('Connecting to JOB_SCRAPER_SERVICE via TCP...');
    await this.scraperClient.connect();
    this.logger.log('Connected to JOB_SCRAPER_SERVICE');
  }

  getHello(): string {
    return 'Hello World!';
  }

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
}

