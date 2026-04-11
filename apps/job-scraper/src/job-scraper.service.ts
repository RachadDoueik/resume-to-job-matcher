import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { RpcException, ClientProxy } from '@nestjs/microservices';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, catchError, throwError } from 'rxjs';
import * as cheerio from 'cheerio';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { JobDescriptionDto, ScrapeJobDto, MatchRequestDto, MatchResultDto } from '@app/dto';
import { MSG } from '@app/contracts';

@Injectable()
export class JobScraperService implements OnModuleInit {
  private readonly logger = new Logger(JobScraperService.name);
  private genAI: GoogleGenerativeAI;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject('MATCHER_SERVICE') private readonly matcherClient: ClientProxy,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY is not defined in the environment variables.');
    }
    this.genAI = new GoogleGenerativeAI(apiKey || '');
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
      
      const result = await model.generateContent(prompt);
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




  async forwardToMatcher(jobDescription: JobDescriptionDto, resumeId: string): Promise<MatchResultDto> {
    const matchRequest: MatchRequestDto = { resumeId, jobDescription };
    this.logger.log('Forwarding manually to Matcher service...');
    return firstValueFrom(
      this.matcherClient.send(MSG.MATCH_RESUME, matchRequest).pipe(
        catchError((error) => {
          this.logger.error(`Error from Matcher service: ${error.message || error}`);
          return throwError(() => new RpcException(`Matcher service failed: ${error.message || error}`));
        }),
      )
    );
  }
}
