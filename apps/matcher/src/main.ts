import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { MatcherModule } from './matcher.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const port = Number(process.env.PORT_MATCHER_SERVICE || process.env.MATCHER_PORT || 3002);
  const host = process.env.MATCHER_HOST || '0.0.0.0';

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    MatcherModule,
    {
      transport: Transport.TCP,
      options: { host, port },
    },
  );

  await app.listen();
  Logger.log(`Matcher TCP microservice listening on ${host}:${port}`, 'Bootstrap');
}
bootstrap();
