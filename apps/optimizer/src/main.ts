import { NestFactory } from '@nestjs/core';
import { OptimizerModule } from './optimizer.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(OptimizerModule);
  const configService = app.get(ConfigService);
  await app.listen(configService.get('PORT_OPTIMIZER_SERVICE') ?? 3003);
}
bootstrap();
