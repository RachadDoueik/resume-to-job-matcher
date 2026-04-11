import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { JobScraperModule } from './job-scraper.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const port = Number(process.env.PORT_JOB_SCRAPER_SERVICE || process.env.PORT_JOB_SCRAPER || 3001);
  const host = process.env.JOB_SCRAPER_HOST || '0.0.0.0';

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    JobScraperModule,
    {
      transport: Transport.TCP,
      options: { host, port },
    },
  );

  await app.listen();
  Logger.log(`Job scraper TCP microservice listening on ${host}:${port}`, 'Bootstrap');
}
bootstrap();
