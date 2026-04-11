import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ScrapeJobDto } from '@app/dto';
import { ApiGatewayService } from './api-gateway.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { AuthUser } from './auth/interfaces/auth-user.interface';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@Controller()
export class ApiGatewayController {
  constructor(private readonly apiGatewayService: ApiGatewayService) {}

  @Get()
  getHello(): string {
    return this.apiGatewayService.getHello();
  }

  @Post('analysis/scrape')
  @UseGuards(JwtAuthGuard)
  scrapeJob(@Body() dto: ScrapeJobDto, @Req() req: RequestWithUser) {
    return this.apiGatewayService.scrapeJob(dto, req.user);
  }

  @Post('analysis/match/:resumeId')
  @UseGuards(JwtAuthGuard)
  matchResume(
    @Param('resumeId') resumeId: string,
    @Body() dto: ScrapeJobDto,
    @Req() req: RequestWithUser,
  ) {
    return this.apiGatewayService.matchResume(dto, req.user, resumeId);
  }

}
