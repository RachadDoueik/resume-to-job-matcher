import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MatcherController } from './matcher.controller';
import { MatcherService } from './matcher.service';
import { PrismaModule } from './prisma/prisma.module';
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
    return 'amqp://guest:guest@localhost:5672';
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ClientsModule.registerAsync([
      {
        name: 'OPTIMIZER_QUEUE',
        useFactory: (config: ConfigService) => {
          const rawRabbitMqUrl = config.get<string>('RABBITMQ_URL') || 'amqp://localhost:5672';

          return {
          transport: Transport.RMQ,
          options: {
            urls: [normalizeRabbitMqUrl(rawRabbitMqUrl)],
            queue: 'optimizer_queue',
            queueOptions: { durable: true },
          },
        };
      },
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [MatcherController],
  providers: [MatcherService],
})
export class MatcherModule {}
