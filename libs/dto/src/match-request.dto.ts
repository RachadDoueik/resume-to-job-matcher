import { IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { JobDescriptionDto } from './job-description.dto';

export class MatchRequestDto {
  @IsString()
  resumeId!: string;

  @ValidateNested()
  @Type(() => JobDescriptionDto)
  jobDescription!: JobDescriptionDto;
}
