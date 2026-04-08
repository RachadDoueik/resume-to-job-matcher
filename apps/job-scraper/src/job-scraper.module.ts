import { Module } from '@nestjs/common';
import { JobScraperController } from './job-scraper.controller';
import { JobScraperService } from './job-scraper.service';
import { ConfigModule , ConfigService} from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot({
    isGlobal: true,
  })],
  controllers: [JobScraperController],
  providers: [JobScraperService, ConfigService],
})
export class JobScraperModule {}
