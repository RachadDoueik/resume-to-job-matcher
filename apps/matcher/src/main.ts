import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { MatcherModule } from './matcher.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const initApp = await NestFactory.create(MatcherModule);
  const configService = initApp.get(ConfigService);
  const port = configService.get<number>('MATCHER_PORT') || 3002;

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    MatcherModule,
    {
      transport: Transport.TCP,
      options: { host: '0.0.0.0', port },
    },
  );
  await app.listen();
}
bootstrap();
