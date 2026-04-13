import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';
import { Prisma } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import { GapAnalysisReadyEventDto, OptimizationResultDto } from '@app/dto';
import { PrismaService } from './prisma/prisma.service';

type ProjectIdea = OptimizationResultDto['projectIdeas'][number];
type Certification = OptimizationResultDto['certifications'][number];

@Injectable()
export class OptimizerService implements OnModuleDestroy {
  private readonly logger = new Logger(OptimizerService.name);
  private readonly redis: Redis;
  private readonly genAI: GoogleGenerativeAI | null;
  private readonly geminiTimeoutMs: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl);

    const configuredGeminiTimeoutMs = Number(this.configService.get<string>('GEMINI_TIMEOUT_MS') ?? '30000');
    this.geminiTimeoutMs = Number.isFinite(configuredGeminiTimeoutMs) && configuredGeminiTimeoutMs > 0
      ? configuredGeminiTimeoutMs
      : 30000;

    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.error('GEMINI_API_KEY is not defined. Optimizer recommendations require Gemini.');
      this.genAI = null;
      return;
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  getHello(): string {
    return 'Hello World!';
  }

  private generateHash(data: object): string {
    return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
  }

  private buildCacheKey(dto: GapAnalysisReadyEventDto): string {
    const normalizedSkills = this.normalizeStringArray(dto.missingSkills).sort();
    const hash = this.generateHash({
      targetRole: dto.targetRole,
      score: dto.score,
      missingSkills: normalizedSkills,
    });

    return `optimize:${dto.userId}:${dto.resumeId}:${hash}`;
  }

  private normalizeString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];

    const cleaned = value
      .map((item) => this.normalizeString(item))
      .filter(Boolean);

    return Array.from(new Set(cleaned));
  }

  private cleanJsonResponse(text: string): string {
    return text
      .replace(/^\s*```json\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();
  }

  private normalizeProjectIdeas(rawIdeas: unknown, dto: GapAnalysisReadyEventDto): ProjectIdea[] {
    if (!Array.isArray(rawIdeas)) return [];

    const role = this.normalizeString(dto.targetRole) || 'your target role';
    const normalized: ProjectIdea[] = [];

    for (const item of rawIdeas) {
      if (!item || typeof item !== 'object') continue;
      const record = item as Record<string, unknown>;

      const title = this.normalizeString(record.title);
      const description = this.normalizeString(record.description);
      const techStack = this.normalizeStringArray(record.techStack).slice(0, 8);

      if (!title || !description) continue;

      normalized.push({
        title,
        description,
        techStack: techStack.length > 0 ? techStack : [role],
      });
    }

    return normalized.slice(0, 5);
  }

  private normalizeCertifications(rawCertifications: unknown): Certification[] {
    if (!Array.isArray(rawCertifications)) return [];

    const normalized: Certification[] = [];

    for (const item of rawCertifications) {
      if (!item || typeof item !== 'object') continue;
      const record = item as Record<string, unknown>;

      const name = this.normalizeString(record.name);
      const provider = this.normalizeString(record.provider);
      const url = this.normalizeString(record.url);

      if (!name || !provider || !url) continue;

      normalized.push({
        name,
        provider,
        url,
      });
    }

    return normalized.slice(0, 5);
  }

  private toProjectIdeasJson(projectIdeas: ProjectIdea[]): Prisma.InputJsonArray {
    const output: Prisma.InputJsonArray = projectIdeas.map((idea) => ({
      title: idea.title,
      description: idea.description,
      techStack: idea.techStack,
    }));

    return output;
  }

  private toCertificationsJson(certifications: Certification[]): Prisma.InputJsonArray {
    const output: Prisma.InputJsonArray = certifications.map((certification) => ({
      name: certification.name,
      provider: certification.provider,
      url: certification.url,
    }));

    return output;
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

  private async generateRecommendations(dto: GapAnalysisReadyEventDto): Promise<Pick<OptimizationResultDto, 'projectIdeas' | 'certifications'>> {
    if (!this.genAI) {
      throw new Error('Missing GEMINI_API_KEY: optimizer cannot generate personalized recommendations.');
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-3-flash-preview',
        generationConfig: { responseMimeType: 'application/json' },
      });

      const prompt = `You are an expert career coach and technical mentor.
      Generate deeply personalized recommendations for this specific candidate based on their gap analysis.
      Return strictly valid JSON (no markdown) in this shape:
      {
        "projectIdeas": [
          { "title": "", "description": "", "techStack": ["", ""] }
        ],
        "certifications": [
          { "name": "", "provider": "", "url": "" }
        ]
      }
      Rules:
      - Return 3 to 5 projectIdeas.
      - Return 3 to 5 certifications.
      - Every project idea must explicitly address at least one missing skill.
      - Project ideas must be portfolio-ready, practical, and specific to the target role.
      - Every certification must be relevant to at least one missing skill.
      - Use real certification names and providers.
      - Use direct URLs when possible.
      - Keep text concise and actionable.

      Gap Analysis Input:
      ${JSON.stringify({
        targetRole: dto.targetRole,
        score: dto.score,
        missingSkills: this.normalizeStringArray(dto.missingSkills),
      })}`;

      const result = await this.generateContentWithTimeout(
        model,
        prompt,
        'optimization recommendations',
      );
      const cleanText = this.cleanJsonResponse(result.response.text());
      const parsed = JSON.parse(cleanText) as Record<string, unknown>;

      const projectIdeas = this.normalizeProjectIdeas(parsed.projectIdeas, dto);
      const certifications = this.normalizeCertifications(parsed.certifications);

      if (projectIdeas.length === 0 || certifications.length === 0) {
        throw new Error('Gemini response did not include valid personalized recommendations.');
      }

      return {
        projectIdeas,
        certifications,
      };
    } catch (error: any) {
      throw new Error(`Gemini recommendation generation failed: ${error?.message || 'unknown error'}`);
    }
  }

  async optimizeResume(dto: GapAnalysisReadyEventDto): Promise<OptimizationResultDto> {
    try {
      const normalizedPayload: GapAnalysisReadyEventDto = {
        ...dto,
        userId: this.normalizeString(dto.userId),
        resumeId: this.normalizeString(dto.resumeId),
        targetRole: this.normalizeString(dto.targetRole),
        missingSkills: this.normalizeStringArray(dto.missingSkills),
      };

      if (!normalizedPayload.userId || !normalizedPayload.resumeId) {
        throw new Error('Both userId and resumeId are required for optimization.');
      }

      const cacheKey = this.buildCacheKey(normalizedPayload);
      const cachedData = await this.redis.get(cacheKey);
      if (cachedData) {
        try {
          return JSON.parse(cachedData) as OptimizationResultDto;
        } catch {
          await this.redis.del(cacheKey);
        }
      }

      const recommendations = await this.generateRecommendations(normalizedPayload);
      const projectIdeasJson = this.toProjectIdeasJson(recommendations.projectIdeas);
      const certificationsJson = this.toCertificationsJson(recommendations.certifications);

      await this.prisma.$transaction(async (tx) => {
        await tx.optimizationResult.deleteMany({
          where: {
            userId: normalizedPayload.userId,
            resumeId: normalizedPayload.resumeId,
          },
        });

        await tx.optimizationResult.create({
          data: {
            userId: normalizedPayload.userId,
            resumeId: normalizedPayload.resumeId,
            projectIdeas: projectIdeasJson,
            certifications: certificationsJson,
          },
        });
      });

      const output: OptimizationResultDto = {
        userId: normalizedPayload.userId,
        resumeId: normalizedPayload.resumeId,
        targetRole: normalizedPayload.targetRole || 'Unknown role',
        score: normalizedPayload.score,
        projectIdeas: recommendations.projectIdeas,
        certifications: recommendations.certifications,
      };

      await this.redis.set(cacheKey, JSON.stringify(output), 'EX', 3600);
      return output;
    } catch (error: any) {
      this.logger.error(`Optimization error: ${error.message}`);
      throw new RpcException(`Failed to optimize resume: ${error.message}`);
    }
  }
}
