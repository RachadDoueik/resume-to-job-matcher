import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { MatcherService } from './matcher.service';
import { MSG } from '@app/contracts';
import { MatchRequestDto, MatchResultDto } from '@app/dto';

@Controller()
export class MatcherController {
  private readonly logger = new Logger(MatcherController.name);

  constructor(private readonly matcherService: MatcherService) {}

  @MessagePattern(MSG.MATCH_RESUME)
  async matchResume(@Payload() dto: MatchRequestDto): Promise<MatchResultDto> {
    this.logger.log(`Received match request for resumeId: ${dto.resumeId}`);
    return this.matcherService.matchResume(dto);
  }
}
