import { IsString } from 'class-validator';
import { ScrapeJobDto } from './scrape-job.dto';

export class ScrapeAndMatchDto extends ScrapeJobDto {
  @IsString()
  resumeId!: string;
}
