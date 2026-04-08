import { Injectable } from '@nestjs/common';

@Injectable()
export class JobScraperService {
  getHello(): string {
    return 'Hello World!';
  }
}
