import { NestFactory } from '@nestjs/core';
import { JobScraperModule } from './job-scraper.module';
import { ConfigService } from '@nestjs/config';
import { config } from 'process';

async function bootstrap() {
  const app = await NestFactory.create(JobScraperModule);
  const configService = app.get(ConfigService);
  await app.listen(process.env.port ?? configService.get('JOB_SCRAPER_SERVICE') ?? 3001);
}
bootstrap();
