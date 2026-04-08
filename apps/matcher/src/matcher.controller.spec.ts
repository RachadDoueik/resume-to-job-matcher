import { Test, TestingModule } from '@nestjs/testing';
import { MatcherController } from './matcher.controller';
import { MatcherService } from './matcher.service';

describe('MatcherController', () => {
  let matcherController: MatcherController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [MatcherController],
      providers: [MatcherService],
    }).compile();

    matcherController = app.get<MatcherController>(MatcherController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(matcherController.getHello()).toBe('Hello World!');
    });
  });
});
