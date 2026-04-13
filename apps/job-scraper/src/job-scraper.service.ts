import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { RpcException, ClientProxy } from '@nestjs/microservices';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, catchError, throwError } from 'rxjs';
import * as cheerio from 'cheerio';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  JobDescriptionDto,
  ScrapeJobDto,
  ScrapeAndMatchDto,
  MatchRequestDto,
  MatchResultDto,
} from '@app/dto';
import { MSG } from '@app/contracts';


@Injectable()
export class JobScraperService implements OnModuleInit {
  private readonly logger = new Logger(JobScraperService.name);
  private genAI: GoogleGenerativeAI;
  private readonly geminiTimeoutMs: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject('MATCHER_SERVICE') private readonly matcherClient: ClientProxy,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY is not defined in the environment variables.');
    }

    const configuredGeminiTimeoutMs = Number(this.configService.get<string>('GEMINI_TIMEOUT_MS') ?? '30000');
    this.geminiTimeoutMs = Number.isFinite(configuredGeminiTimeoutMs) && configuredGeminiTimeoutMs > 0
      ? configuredGeminiTimeoutMs
      : 30000;

    this.genAI = new GoogleGenerativeAI(apiKey || '');
  }

  private async generateContentWithTimeout(
    model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
    prompt: string,
    operation: string,
  ) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), this.geminiTimeoutMs);

    try {
      return await model.generateContent(prompt, { signal: controller.signal });
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error(
          `Gemini request timed out after ${this.geminiTimeoutMs}ms during ${operation}.`,
        );
      }

      throw error;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  async onModuleInit() {
    this.logger.log('Connecting to MATCHER_SERVICE via TCP...');
    await this.matcherClient.connect();
    this.logger.log('Connected to MATCHER_SERVICE');
  }

  async scrapeJob(dto: ScrapeJobDto): Promise<JobDescriptionDto> {
    try {
      let rawText = dto.rawText;

      if (dto.url) {
        this.logger.log(`Fetching URL: ${dto.url}`);
        const response = await firstValueFrom(this.httpService.get(dto.url));
        const $ = cheerio.load(response.data);
        
        // Remove unnecessary clutter
        $('script, style, nav, footer, header, noscript, svg').remove();
        
        // Extract plain text and compress whitespace
        rawText = $('body').text().replace(/\s+/g, ' ').trim();
      }

      if (!rawText) {
        throw new RpcException('Either url or rawText must be provided with valid content.');
      }

      this.logger.log('Sending text to Gemini for extraction...');
      
      const model = this.genAI.getGenerativeModel({ 
        model: 'gemini-3.1-flash-lite-preview',
        generationConfig: {
          responseMimeType: 'application/json',
        }
      });

      const prompt = `Extract job requirements from the following text.
      Return ONLY valid JSON matching this exact schema:
      {
        "title": "Job Title (string)",
        "company": "Company Name (string)",
        "skills": ["Array", "of", "required", "skills"],
        "stack": ["Array", "of", "technologies", "and", "tools"],
        "experienceYears": 0,
        "seniority": "junior" | "mid" | "senior" | "lead",
        "rawText": "A 1-2 sentence short summary of the role"
      }
      
      Job Content:
      ${rawText.substring(0, 15000)}
      `;
      
      const result = await this.generateContentWithTimeout(model, prompt, 'job extraction');
      const outputText = result.response.text();
      
      const cleanedText = outputText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      
      const parsed: JobDescriptionDto = JSON.parse(cleanedText);
      
      // Ensure we always store the raw text
      if (!parsed.rawText) {
        parsed.rawText = rawText.substring(0, 5000);
      }

      return parsed;

    } catch (error: any) {
      this.logger.error(`Error in scrapeJob: ${error.message}`, error.stack);
      throw new RpcException(`Failed to extract job description: ${error.message}`);
    }
  }

  async scrapeAndMatch(dto: ScrapeAndMatchDto): Promise<MatchResultDto> {
    try {
      const jobDescription = await this.scrapeJob(dto);
      const matchRequest: MatchRequestDto = {
        resumeId: dto.resumeId,
        jobDescription,
      };

      this.logger.log(`Forwarding scraped job to MATCHER_SERVICE for resumeId: ${dto.resumeId}`);

      return await firstValueFrom(
        this.matcherClient.send(MSG.MATCH_RESUME, matchRequest).pipe(
          catchError((error) => {
            const message = error?.message || 'Matcher service failed';
            this.logger.error(`Matcher forwarding error: ${message}`);
            return throwError(() => new RpcException(message));
          }),
        ),
      );
    } catch (error: any) {
      this.logger.error(`Error in scrapeAndMatch: ${error.message}`, error.stack);
      throw new RpcException(`Failed to scrape and match: ${error.message}`);
    }
  }
}

