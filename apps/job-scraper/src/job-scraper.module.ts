import { Module } from '@nestjs/common';
import { JobScraperController } from './job-scraper.controller';
import { JobScraperService } from './job-scraper.service';
import { ConfigModule , ConfigService} from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [ConfigModule.forRoot({
    isGlobal: true,
  }), HttpModule],
  controllers: [JobScraperController],
  providers: [JobScraperService, ConfigService],
})
export class JobScraperModule {}
