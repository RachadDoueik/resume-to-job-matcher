import { Module } from '@nestjs/common';
import { JobScraperController } from './job-scraper.controller';
import { JobScraperService } from './job-scraper.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    HttpModule,
    ClientsModule.registerAsync([
      {
        name: 'MATCHER_SERVICE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: 'localhost',
            port: configService.get<number>('PORT_MATCHER_SERVICE') || 3002,
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [JobScraperController],
  providers: [JobScraperService, ConfigService],
})
export class JobScraperModule {}
