import { Controller, Get } from '@nestjs/common';
import { JobScraperService } from './job-scraper.service';

@Controller()
export class JobScraperController {
  constructor(private readonly jobScraperService: JobScraperService) {}

  @Get()
  getHello(): string {
    return this.jobScraperService.getHello();
  }
}
