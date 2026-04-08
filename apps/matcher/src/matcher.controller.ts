import { Controller, Get } from '@nestjs/common';
import { MatcherService } from './matcher.service';

@Controller()
export class MatcherController {
  constructor(private readonly matcherService: MatcherService) {}

  @Get()
  getHello(): string {
    return this.matcherService.getHello();
  }
}
