import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ProjectIdeaDto {
  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsArray()
  @IsString({ each: true })
  techStack!: string[];
}

export class CertificationDto {
  @IsString()
  name!: string;

  @IsString()
  provider!: string;

  @IsString()
  url!: string;
}

export class OptimizationResultDto {
  @IsString()
  userId!: string;

  @IsString()
  resumeId!: string;

  @IsString()
  targetRole!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  score!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectIdeaDto)
  projectIdeas!: ProjectIdeaDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CertificationDto)
  certifications!: CertificationDto[];
}