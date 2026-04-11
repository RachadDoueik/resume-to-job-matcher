import { IsNumber, IsString, IsArray, Min, Max } from 'class-validator';

export class MatchResultDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  score!: number;

  @IsArray()
  @IsString({ each: true })
  matchedSkills!: string[];

  @IsArray()
  @IsString({ each: true })
  missingSkills!: string[];

  @IsString()
  summary!: string;

  @IsString()
  resumeId!: string;

  @IsString()
  jobTitle!: string;
}
