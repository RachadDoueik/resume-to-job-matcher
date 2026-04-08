import { Test, TestingModule } from '@nestjs/testing';
import { JobScraperController } from './job-scraper.controller';
import { JobScraperService } from './job-scraper.service';

describe('JobScraperController', () => {
  let jobScraperController: JobScraperController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [JobScraperController],
      providers: [JobScraperService],
    }).compile();

    jobScraperController = app.get<JobScraperController>(JobScraperController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(jobScraperController.getHello()).toBe('Hello World!');
    });
  });
});
