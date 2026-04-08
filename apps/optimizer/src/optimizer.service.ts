import { Injectable } from '@nestjs/common';

@Injectable()
export class OptimizerService {
  getHello(): string {
    return 'Hello World!';
  }
}
