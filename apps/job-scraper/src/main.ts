import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { JobScraperModule } from './job-scraper.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const initApp = await NestFactory.create(JobScraperModule);
  const configService = initApp.get(ConfigService);
  const port = configService.get<number>('PORT_JOB_SCRAPER') || 3001;

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    JobScraperModule,
    {
      transport: Transport.TCP,
      options: { port },
    },
  );
  await app.listen();
}
bootstrap();
