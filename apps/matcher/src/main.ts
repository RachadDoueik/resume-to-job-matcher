import { NestFactory } from '@nestjs/core';
import { MatcherModule } from './matcher.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(MatcherModule);
  const configService = app.get(ConfigService);
  await app.listen(configService.get('PORT_MATCHER_SERVICE') ?? 3002);
}
bootstrap();
