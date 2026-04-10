import { IsString, IsArray, IsNumber, IsIn } from 'class-validator';

export class JobDescriptionDto {
  @IsString()
  title!: string;

  @IsString()
  company!: string;

  @IsArray()
  @IsString({ each: true })
  skills!: string[];

  @IsArray()
  @IsString({ each: true })
  stack!: string[];

  @IsNumber()
  experienceYears!: number;

  @IsIn(['junior', 'mid', 'senior', 'lead'])
  seniority!: 'junior' | 'mid' | 'senior' | 'lead';

  @IsString()
  rawText!: string;
}
