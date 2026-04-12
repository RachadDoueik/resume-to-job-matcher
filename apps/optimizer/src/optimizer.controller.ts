import { Controller, Get, Logger } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { MSG } from '@app/contracts';
import { GapAnalysisReadyEventDto, OptimizationResultDto } from '@app/dto';
import { OptimizerService } from './optimizer.service';

const GAP_ANALYSIS_READY_EVENT = 'gap_analysis_ready';

@Controller()
export class OptimizerController {
  private readonly logger = new Logger(OptimizerController.name);

  constructor(private readonly optimizerService: OptimizerService) {}

  @Get()
  getHello(): string {
    return this.optimizerService.getHello();
  }

  @MessagePattern(MSG.OPTIMIZE_RESUME)
  async optimizeResume(@Payload() dto: GapAnalysisReadyEventDto): Promise<OptimizationResultDto> {
    this.logger.log(`Received optimize request for resumeId: ${dto.resumeId}`);
    return this.optimizerService.optimizeResume(dto);
  }

  @EventPattern(GAP_ANALYSIS_READY_EVENT)
  async handleGapAnalysisReady(@Payload() dto: GapAnalysisReadyEventDto): Promise<void> {
    this.logger.log(`Received gap analysis event for resumeId: ${dto.resumeId}`);
    await this.optimizerService.optimizeResume(dto);
  }
}
