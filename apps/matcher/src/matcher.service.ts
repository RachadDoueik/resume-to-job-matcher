import { Injectable } from '@nestjs/common';

@Injectable()
export class MatcherService {
  getHello(): string {
    return 'Hello World!';
  }
}
