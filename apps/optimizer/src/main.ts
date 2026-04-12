import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { OptimizerModule } from './optimizer.module';
import { existsSync } from 'fs';

function normalizeRabbitMqUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const isRunningInDocker = existsSync('/.dockerenv');

    if (parsed.port === '15672') {
      parsed.port = '5672';
    }

    if (!isRunningInDocker && parsed.hostname === 'rabbitmq') {
      parsed.hostname = 'localhost';
    }

    if (!parsed.port) {
      parsed.port = '5672';
    }

    return parsed.toString();
  } catch {
    // Fall back to a known local default if URL parsing fails.
    return 'amqp://guest:guest@localhost:5672';
  }
}

async function bootstrap() {
  const port = Number(process.env.PORT_OPTIMIZER_SERVICE || process.env.OPTIMIZER_PORT || 3000);
  const rawRabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
  const rabbitmqUrl = normalizeRabbitMqUrl(rawRabbitmqUrl);

  const app = await NestFactory.create(OptimizerModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl],
      queue: 'optimizer_queue',
      queueOptions: { durable: true },
    },
  });

  await app.startAllMicroservices();
  await app.listen(port);
  Logger.log(`Optimizer HTTP service listening on 0.0.0.0:${port}`, 'Bootstrap');
  Logger.log(`Optimizer RabbitMQ URL: ${rabbitmqUrl}`, 'Bootstrap');
  Logger.log('Optimizer RMQ microservice listening on queue: optimizer_queue', 'Bootstrap');
}
bootstrap();
