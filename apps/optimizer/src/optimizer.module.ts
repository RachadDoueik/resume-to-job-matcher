import { Module } from '@nestjs/common';
import { OptimizerController } from './optimizer.controller';
import { OptimizerService } from './optimizer.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
  ],
  controllers: [OptimizerController],
  providers: [OptimizerService],
})
export class OptimizerModule {}
