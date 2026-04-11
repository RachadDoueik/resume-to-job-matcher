import { IsArray, IsNumber, IsString, Min, Max } from 'class-validator';

export class GapAnalysisReadyEventDto {
  @IsString()
  userId!: string;

  @IsString()
  resumeId!: string;

  @IsArray()
  @IsString({ each: true })
  missingSkills!: string[];

  @IsString()
  targetRole!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  score!: number;
}
