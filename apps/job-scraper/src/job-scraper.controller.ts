import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { JobScraperService } from './job-scraper.service';
import { MSG } from '@app/contracts';
import { JobDescriptionDto, ScrapeJobDto } from '@app/dto';

@Controller()
export class JobScraperController {
  constructor(private readonly jobScraperService: JobScraperService) {}

  @MessagePattern(MSG.SCRAPE_JOB)
  async scrapeJob(@Payload() dto: ScrapeJobDto): Promise<JobDescriptionDto> {
    return this.jobScraperService.scrapeJob(dto);
  }
}
