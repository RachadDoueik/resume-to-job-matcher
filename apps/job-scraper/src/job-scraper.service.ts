import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as cheerio from 'cheerio';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { JobDescriptionDto, ScrapeJobDto } from '@app/dto';

@Injectable()
export class JobScraperService {
  private readonly logger = new Logger(JobScraperService.name);
  private genAI: GoogleGenerativeAI;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY is not defined in the environment variables.');
    }
    this.genAI = new GoogleGenerativeAI(apiKey || '');
  }

  async scrapeJob(dto: ScrapeJobDto): Promise<JobDescriptionDto> {
    try {
      let rawText = dto.rawText;

      if (dto.url) {
        this.logger.log(`Fetching URL: ${dto.url}`);
        const response = await firstValueFrom(this.httpService.get(dto.url));
        const $ = cheerio.load(response.data);
        // Basic extraction of readable text from body
        $('script, style, noscript').remove();
        rawText = $('body').text().replace(/\s+/g, ' ').trim();
      }

      if (!rawText) {
        throw new RpcException('Either url or rawText must be provided with valid content.');
      }

      this.logger.log('Sending text to Gemini for extraction...');
      
      // Use gemini-3.5-flash-preview for fast and cost-effective text tasks
      const model = this.genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite-preview' });

      const prompt = `Extract job requirements from the text below. 
Return ONLY valid JSON matching this exact structure:
{ 
  "title": "string", 
  "company": "string", 
  "skills": ["string", "string"], 
  "stack": ["string", "string"], 
  "experienceYears": number (use 0 if not found), 
  "seniority": "junior"|"mid"|"senior"|"lead" (infer from context), 
  "rawText": "string"
}
No markdown formatting, no explanation, no backticks, only raw JSON block.

Text to analyze:
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
}

