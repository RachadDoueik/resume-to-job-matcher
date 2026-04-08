import { Test, TestingModule } from '@nestjs/testing';
import { OptimizerController } from './optimizer.controller';
import { OptimizerService } from './optimizer.service';

describe('OptimizerController', () => {
  let optimizerController: OptimizerController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [OptimizerController],
      providers: [OptimizerService],
    }).compile();

    optimizerController = app.get<OptimizerController>(OptimizerController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(optimizerController.getHello()).toBe('Hello World!');
    });
  });
});
