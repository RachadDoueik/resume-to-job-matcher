import { IsUrl, IsOptional, IsString } from 'class-validator';

// The "Contract" for the data payload
export class ScrapeJobDto {
  @IsOptional()
  @IsUrl()
  url?: string;

  @IsOptional()
  @IsString()
  rawText?: string;
}