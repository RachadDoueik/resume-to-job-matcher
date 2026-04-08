import { Module } from '@nestjs/common';
import { MatcherController } from './matcher.controller';
import { MatcherService } from './matcher.service';
import { ConfigModule , ConfigService } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot({
    isGlobal: true,
  })],
  controllers: [MatcherController],
  providers: [MatcherService , ConfigService],
})
export class MatcherModule {}
