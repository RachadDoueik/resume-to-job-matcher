import { Controller, Get } from '@nestjs/common';
import { OptimizerService } from './optimizer.service';

@Controller()
export class OptimizerController {
  constructor(private readonly optimizerService: OptimizerService) {}

  @Get()
  getHello(): string {
    return this.optimizerService.getHello();
  }
}
