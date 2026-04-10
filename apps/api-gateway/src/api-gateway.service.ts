import { Injectable } from '@nestjs/common';
import { ScrapeJobDto } from '@app/dto';
import { AuthUser } from './auth/interfaces/auth-user.interface';

@Injectable()
export class ApiGatewayService {
  getHello(): string {
    return 'Hello World!';
  }

  scrapeJob(dto: ScrapeJobDto, user: AuthUser) {
    return {
      message: 'Protected scrape endpoint reached.',
      user,
      payload: dto,
    };
  }

  matchResume(dto: ScrapeJobDto, user: AuthUser) {
    return {
      message: 'Protected match endpoint reached.',
      user,
      payload: dto,
    };
  }
}
