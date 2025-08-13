/**
 * Gemini AI Service Integration for RpgAInfinity
 *
 * Provides comprehensive Google Gemini AI integration using Vercel AI SDK with:
 * - Streaming responses for real-time generation
 * - Intelligent caching with hash-based deduplication
 * - Rate limiting per session and user
 * - Structured output validation with Zod
 * - Comprehensive error handling and fallbacks
 * - Analytics and monitoring
 * - Content filtering and safety validation
 */

import { google } from '@ai-sdk/google';
import { generateText, streamText, generateObject } from 'ai';
import { z } from 'zod';
import { kvService } from '@/lib/database/kv-service';
import {
  AIRequest,
  AIResponse,
  AIContext,
  AIModel,
  SafetyAnalysis,
  TokenUsage,
  RequestPriority,
  AIRequestSchema,
  AIResponseSchema,
  CacheEntry,
  UUID,
} from '@/types/ai';

// Define GameError class locally since it's not in core types
class GameError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'GameError';
  }
}

// ============================================================================
// CONFIGURATION AND CONSTANTS
// ============================================================================

// Map old Claude models to Gemini models
const MODEL_MAPPING: Record<string, string> = {
  'claude-3-5-sonnet-20241022': 'gemini-1.5-pro-latest',
  'claude-3-5-haiku-20241022': 'gemini-1.5-flash',
  'claude-3-opus-20240229': 'gemini-1.5-pro-latest',
  'claude-3-sonnet-20240229': 'gemini-1.5-pro',
  'claude-3-haiku-20240307': 'gemini-1.5-flash',
};

interface GeminiServiceConfig {
  readonly apiKey: string;
  readonly defaultModel: string;
  readonly maxTokens: number;
  readonly temperature: number;
  readonly timeout: number;
  readonly rateLimits: {
    readonly sessionsPerMinute: number;
    readonly userPerHour: number;
    readonly concurrent: number;
  };
  readonly cache: {
    readonly enabled: boolean;
    readonly ttlHot: number; // seconds
    readonly ttlCold: number; // seconds
    readonly maxEntries: number;
  };
  readonly retry: {
    readonly maxAttempts: number;
    readonly baseDelayMs: number;
    readonly maxDelayMs: number;
  };
}

const DEFAULT_CONFIG: GeminiServiceConfig = {
  apiKey: process.env.GOOGLE_AI_API_KEY || '',
  defaultModel: 'gemini-1.5-pro-latest',
  maxTokens: 4096,
  temperature: 0.7,
  timeout: 60000, // 60 seconds
  rateLimits: {
    sessionsPerMinute: 10,
    userPerHour: 100,
    concurrent: 3,
  },
  cache: {
    enabled: true,
    ttlHot: 4 * 60 * 60, // 4 hours
    ttlCold: 24 * 60 * 60, // 24 hours
    maxEntries: 10000,
  },
  retry: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
  },
};

// Content safety keywords to filter
const SAFETY_KEYWORDS = [
  'violence',
  'harm',
  'hate',
  'sexual',
  'illegal',
  'dangerous',
  'weapon',
  'drug',
  'threat',
  'harassment',
  'discrimination',
];

// ============================================================================
// RATE LIMITER CLASS
// ============================================================================

class RateLimiter {
  private sessionLimits = new Map<
    string,
    { count: number; resetTime: number }
  >();
  private userLimits = new Map<string, { count: number; resetTime: number }>();
  private concurrentRequests = new Map<string, number>();

  async checkSessionLimit(sessionId: string): Promise<boolean> {
    const now = Date.now();
    const limit = this.sessionLimits.get(sessionId);

    if (!limit || now > limit.resetTime) {
      this.sessionLimits.set(sessionId, {
        count: 1,
        resetTime: now + 60 * 1000, // 1 minute
      });
      return true;
    }

    if (limit.count >= DEFAULT_CONFIG.rateLimits.sessionsPerMinute) {
      return false;
    }

    limit.count++;
    return true;
  }

  async checkUserLimit(userId: string): Promise<boolean> {
    const now = Date.now();
    const limit = this.userLimits.get(userId);

    if (!limit || now > limit.resetTime) {
      this.userLimits.set(userId, {
        count: 1,
        resetTime: now + 60 * 60 * 1000, // 1 hour
      });
      return true;
    }

    if (limit.count >= DEFAULT_CONFIG.rateLimits.userPerHour) {
      return false;
    }

    limit.count++;
    return true;
  }

  async checkConcurrentLimit(sessionId: string): Promise<boolean> {
    const current = this.concurrentRequests.get(sessionId) || 0;
    if (current >= DEFAULT_CONFIG.rateLimits.concurrent) {
      return false;
    }

    this.concurrentRequests.set(sessionId, current + 1);
    return true;
  }

  async releaseConcurrentSlot(sessionId: string): Promise<void> {
    const current = this.concurrentRequests.get(sessionId) || 0;
    if (current > 0) {
      this.concurrentRequests.set(sessionId, current - 1);
    }
  }

  //TODO: Implement persistent rate limiting using KV service for multi-instance deployments
}

// ============================================================================
// CACHE MANAGER CLASS
// ============================================================================

class CacheManager {
  private memoryCache = new Map<string, CacheEntry>();
  private hitCounts = new Map<string, number>();

  generateCacheKey(request: AIRequest): string {
    // Create deterministic hash from request content
    const hashInput = JSON.stringify({
      promptId: request.promptId,
      parameters: request.parameters,
      gameType: request.context.gameType,
      gameStateHash: this.hashGameState(request.context.gameState),
    });

    return this.simpleHash(hashInput);
  }

  private hashGameState(gameState: Record<string, any>): string {
    const stableElements = {
      gameType: gameState.gameType,
      phase: gameState.phase,
      playerCount: gameState.playerCount,
    };
    return this.simpleHash(JSON.stringify(stableElements));
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  async get(key: string): Promise<CacheEntry | null> {
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && memoryEntry.expiresAt > new Date()) {
      this.hitCounts.set(key, (this.hitCounts.get(key) || 0) + 1);
      memoryEntry.hitCount++;
      memoryEntry.lastAccessed = new Date();
      return memoryEntry;
    }

    // Check KV cache
    try {
      const kvResult = await kvService.get<CacheEntry>(`ai_cache:${key}`);
      if (
        kvResult.success &&
        kvResult.data &&
        new Date(kvResult.data.expiresAt) > new Date()
      ) {
        const entry = kvResult.data;
        entry.hitCount++;
        entry.lastAccessed = new Date();

        this.memoryCache.set(key, entry);
        await kvService.set(
          `ai_cache:${key}`,
          entry,
          DEFAULT_CONFIG.cache.ttlHot
        );

        return entry;
      }
    } catch (error) {
      console.warn('Cache retrieval error:', error);
    }

    return null;
  }

  async set(key: string, response: AIResponse): Promise<void> {
    const now = new Date();
    const entry: CacheEntry = {
      key,
      content: response,
      createdAt: now,
      expiresAt: new Date(now.getTime() + DEFAULT_CONFIG.cache.ttlHot * 1000),
      hitCount: 0,
      lastAccessed: now,
      size: JSON.stringify(response).length,
      tags: [response.metadata.model, 'gemini-ai'],
    };

    this.memoryCache.set(key, entry);

    try {
      await kvService.set(
        `ai_cache:${key}`,
        entry,
        DEFAULT_CONFIG.cache.ttlHot
      );
    } catch (error) {
      console.warn('Cache storage error:', error);
    }

    this.cleanupIfNeeded();
  }

  private cleanupIfNeeded(): void {
    if (this.memoryCache.size > DEFAULT_CONFIG.cache.maxEntries) {
      const entries = Array.from(this.memoryCache.entries()).sort(
        ([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime()
      );

      const toRemove = Math.floor(entries.length * 0.1);
      for (let i = 0; i < toRemove; i++) {
        this.memoryCache.delete(entries[i][0]);
      }
    }
  }

  getCacheStats(): {
    memoryEntries: number;
    totalHits: number;
    hitRate: number;
  } {
    const totalHits = Array.from(this.hitCounts.values()).reduce(
      (sum, count) => sum + count,
      0
    );
    const totalRequests = totalHits + this.memoryCache.size;

    return {
      memoryEntries: this.memoryCache.size,
      totalHits,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
    };
  }
}

// ============================================================================
// ANALYTICS TRACKER CLASS
// ============================================================================

class AIAnalytics {
  private metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalResponseTime: 0,
    totalTokensUsed: 0,
    totalCost: 0,
    categoryStats: new Map<
      string,
      {
        requests: number;
        tokens: number;
        responseTime: number;
      }
    >(),
  };

  trackRequest(requestId: string, category: string): void {
    this.metrics.totalRequests++;

    if (!this.metrics.categoryStats.has(category)) {
      this.metrics.categoryStats.set(category, {
        requests: 0,
        tokens: 0,
        responseTime: 0,
      });
    }

    const stats = this.metrics.categoryStats.get(category)!;
    stats.requests++;
  }

  trackResponse(
    requestId: string,
    category: string,
    response: AIResponse,
    success: boolean
  ): void {
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    this.metrics.totalResponseTime += response.processingTime;
    this.metrics.totalTokensUsed += response.tokenUsage.total;

    // Rough cost estimation for Gemini (much cheaper than Claude)
    this.metrics.totalCost += this.estimateCost(
      response.tokenUsage,
      response.metadata.model
    );

    const stats = this.metrics.categoryStats.get(category);
    if (stats) {
      stats.tokens += response.tokenUsage.total;
      stats.responseTime += response.processingTime;
    }
  }

  private estimateCost(tokenUsage: TokenUsage, model: string): number {
    // Gemini pricing (significantly cheaper than Claude)
    const pricing: Record<string, { input: number; output: number }> = {
      'gemini-1.5-pro-latest': { input: 0.00125, output: 0.005 },
      'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
      'gemini-1.5-flash': { input: 0.00015, output: 0.0006 },
    };

    const modelPricing = pricing[model] || pricing['gemini-1.5-flash'];
    const inputCost = (tokenUsage.prompt / 1000) * modelPricing.input;
    const outputCost = (tokenUsage.completion / 1000) * modelPricing.output;

    return inputCost + outputCost;
  }

  getMetrics() {
    const avgResponseTime =
      this.metrics.totalRequests > 0
        ? this.metrics.totalResponseTime / this.metrics.totalRequests
        : 0;

    const successRate =
      this.metrics.totalRequests > 0
        ? this.metrics.successfulRequests / this.metrics.totalRequests
        : 0;

    return {
      ...this.metrics,
      averageResponseTime: avgResponseTime,
      successRate,
      estimatedCost: this.metrics.totalCost,
    };
  }

  //TODO: Implement persistent analytics storage for dashboard and reporting
}

// ============================================================================
// MAIN GEMINI SERVICE CLASS
// ============================================================================

export class GeminiService {
  private static instance: GeminiService;
  private config: GeminiServiceConfig;
  private rateLimiter: RateLimiter;
  private cache: CacheManager;
  private analytics: AIAnalytics;

  private constructor(config: Partial<GeminiServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (!this.config.apiKey) {
      console.warn(
        'Google AI API key not configured. Set GOOGLE_AI_API_KEY environment variable. Service will work with fallback behavior.'
      );
    }

    this.rateLimiter = new RateLimiter();
    this.cache = new CacheManager();
    this.analytics = new AIAnalytics();
  }

  static getInstance(config?: Partial<GeminiServiceConfig>): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService(config);
    }
    return GeminiService.instance;
  }

  // ============================================================================
  // CORE PUBLIC API METHODS
  // ============================================================================

  /**
   * Map Claude model to Gemini model
   */
  private mapModel(model?: AIModel | string): string {
    if (!model) return this.config.defaultModel;
    return MODEL_MAPPING[model] || model;
  }

  /**
   * Generate content using Gemini API with intelligent caching and rate limiting
   */
  async generateContent(
    prompt: string,
    context?: AIContext,
    options?: {
      model?: AIModel;
      maxTokens?: number;
      temperature?: number;
      priority?: RequestPriority;
      cacheKey?: string;
    }
  ): Promise<string> {
    if (!this.config.apiKey) {
      // Fallback behavior when API key is not configured
      return this.generateFallbackContent(prompt, context);
    }

    const request: AIRequest = {
      id: crypto.randomUUID() as UUID,
      promptId: 'direct-prompt',
      gameId:
        (context?.gameState?.gameId as UUID) || (crypto.randomUUID() as UUID),
      playerId: context?.playerHistory?.[0]?.playerId,
      parameters: { prompt },
      context: context || this.getDefaultContext(),
      timestamp: new Date(),
      priority: options?.priority || 'normal',
      options: {
        streaming: false,
        cacheKey: options?.cacheKey,
        timeout: this.config.timeout,
        maxRetries: this.config.retry.maxAttempts,
      },
    };

    const response = await this.processRequest(request, {
      model: options?.model,
      maxTokens: options?.maxTokens,
      temperature: options?.temperature,
    });

    return response.content;
  }

  /**
   * Stream content generation for real-time responses
   */
  async *streamContent(
    prompt: string,
    context?: AIContext,
    options?: {
      model?: AIModel;
      maxTokens?: number;
      temperature?: number;
    }
  ): AsyncGenerator<string, void, unknown> {
    if (!this.config.apiKey) {
      // Fallback streaming behavior
      const content = await this.generateFallbackContent(prompt, context);
      const words = content.split(' ');
      for (const word of words) {
        yield `${word} `;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return;
    }

    const sessionId = context?.gameState?.gameId || 'default';

    // Check rate limits
    if (!(await this.rateLimiter.checkSessionLimit(sessionId))) {
      throw new GameError('RATE_LIMIT_EXCEEDED', 'Session rate limit exceeded');
    }

    if (!(await this.rateLimiter.checkConcurrentLimit(sessionId))) {
      throw new GameError(
        'CONCURRENT_LIMIT_EXCEEDED',
        'Too many concurrent requests'
      );
    }

    try {
      const startTime = Date.now();
      const geminiModel = this.mapModel(options?.model);

      const { textStream } = await streamText({
        model: google(geminiModel, {
          apiKey: this.config.apiKey,
        }),
        prompt: this.buildPrompt(prompt, context),
        maxTokens: options?.maxTokens || this.config.maxTokens,
        temperature: options?.temperature || this.config.temperature,
      });

      let fullContent = '';
      let tokenCount = 0;

      for await (const text of textStream) {
        fullContent += text;
        tokenCount++;
        yield text;
      }

      // Track analytics for streaming response
      const response: AIResponse = {
        id: crypto.randomUUID() as UUID,
        requestId: crypto.randomUUID() as UUID,
        content: fullContent,
        timestamp: new Date(),
        processingTime: Date.now() - startTime,
        tokenUsage: {
          prompt: this.estimateTokens(prompt),
          completion: tokenCount,
          total: this.estimateTokens(prompt) + tokenCount,
        },
        metadata: {
          model: geminiModel,
          temperature: options?.temperature || this.config.temperature,
          promptTokens: this.estimateTokens(prompt),
          completionTokens: tokenCount,
          stopReason: 'end_turn',
          safety: await this.analyzeSafety(fullContent),
        },
      };

      this.analytics.trackResponse(
        response.requestId,
        'stream',
        response,
        true
      );
    } catch (error) {
      throw this.handleError(error, 'streaming');
    } finally {
      await this.rateLimiter.releaseConcurrentSlot(sessionId);
    }
  }

  /**
   * Generate structured output with Zod schema validation
   */
  async generateStructured<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    context?: AIContext,
    options?: {
      model?: AIModel;
      maxRetries?: number;
    }
  ): Promise<T> {
    if (!this.config.apiKey) {
      // Generate fallback structured data
      return this.generateFallbackStructured(prompt, schema);
    }

    const maxRetries = options?.maxRetries || 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const geminiModel = this.mapModel(options?.model);

        const { object } = await generateObject({
          model: google(geminiModel, {
            apiKey: this.config.apiKey,
          }),
          prompt: this.buildPrompt(prompt, context),
          schema,
        });

        return object as T;
      } catch (error) {
        lastError = error as Error;
        console.warn(`Structured generation attempt ${attempt} failed:`, error);

        if (attempt === maxRetries) {
          break;
        }

        await new Promise(resolve =>
          setTimeout(
            resolve,
            this.config.retry.baseDelayMs * Math.pow(2, attempt - 1)
          )
        );
      }
    }

    throw new GameError(
      'STRUCTURED_GENERATION_FAILED',
      `Failed to generate valid structured output after ${maxRetries} attempts: ${lastError?.message}`
    );
  }

  // ============================================================================
  // INTERNAL PROCESSING METHODS
  // ============================================================================

  private async processRequest(
    request: AIRequest,
    options?: {
      model?: AIModel;
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<AIResponse> {
    // Validate request
    const validationResult = AIRequestSchema.safeParse(request);
    if (!validationResult.success) {
      throw new GameError(
        'INVALID_AI_REQUEST',
        `Request validation failed: ${validationResult.error.message}`
      );
    }

    // Check cache first
    const cacheKey = this.cache.generateCacheKey(request);
    const cachedResponse = await this.cache.get(cacheKey);
    if (cachedResponse) {
      return cachedResponse.content;
    }

    // Rate limiting checks
    const sessionId = request.gameId;
    if (!(await this.rateLimiter.checkSessionLimit(sessionId))) {
      throw new GameError('RATE_LIMIT_EXCEEDED', 'Session rate limit exceeded');
    }

    if (
      request.playerId &&
      !(await this.rateLimiter.checkUserLimit(request.playerId))
    ) {
      throw new GameError('RATE_LIMIT_EXCEEDED', 'User rate limit exceeded');
    }

    if (!(await this.rateLimiter.checkConcurrentLimit(sessionId))) {
      throw new GameError(
        'CONCURRENT_LIMIT_EXCEEDED',
        'Too many concurrent requests'
      );
    }

    // Track request
    this.analytics.trackRequest(request.id, request.promptId);

    try {
      const startTime = Date.now();
      const geminiModel = this.mapModel(options?.model);

      const { text, usage } = await generateText({
        model: google(geminiModel, {
          apiKey: this.config.apiKey,
        }),
        prompt: this.buildPrompt(
          request.parameters.prompt as string,
          request.context
        ),
        maxTokens: options?.maxTokens || this.config.maxTokens,
        temperature: options?.temperature || this.config.temperature,
      });

      const processingTime = Date.now() - startTime;

      const response: AIResponse = {
        id: crypto.randomUUID() as UUID,
        requestId: request.id,
        content: text,
        timestamp: new Date(),
        processingTime,
        tokenUsage: {
          prompt:
            usage?.promptTokens ||
            this.estimateTokens(request.parameters.prompt as string),
          completion: usage?.completionTokens || this.estimateTokens(text),
          total:
            (usage?.promptTokens || 0) + (usage?.completionTokens || 0) ||
            this.estimateTokens(request.parameters.prompt as string) +
              this.estimateTokens(text),
        },
        metadata: {
          model: geminiModel,
          temperature: options?.temperature || this.config.temperature,
          promptTokens:
            usage?.promptTokens ||
            this.estimateTokens(request.parameters.prompt as string),
          completionTokens:
            usage?.completionTokens || this.estimateTokens(text),
          stopReason: 'stop',
          safety: await this.analyzeSafety(text),
        },
      };

      // Cache the response
      await this.cache.set(cacheKey, response);

      // Track analytics
      this.analytics.trackResponse(
        request.id,
        request.promptId,
        response,
        true
      );

      return response;
    } catch (error) {
      this.analytics.trackResponse(
        request.id,
        request.promptId,
        {} as AIResponse,
        false
      );
      throw this.handleError(error, 'generation');
    } finally {
      await this.rateLimiter.releaseConcurrentSlot(sessionId);
    }
  }

  private buildPrompt(prompt: string, context?: AIContext): string {
    if (!context) return prompt;

    let fullPrompt = prompt;

    // Add context information
    if (context.gameType) {
      fullPrompt = `Game Type: ${context.gameType}\n\n${fullPrompt}`;
    }

    if (context.recentEvents && context.recentEvents.length > 0) {
      const recentEventsText = context.recentEvents
        .map(event => `- ${event.description}`)
        .join('\n');
      fullPrompt = `Recent Events:\n${recentEventsText}\n\n${fullPrompt}`;
    }

    // Add cultural preferences if available
    if (context.culturalPreferences) {
      const { language, contentRating, themes, avoidances } =
        context.culturalPreferences;
      fullPrompt += `\n\nContent Guidelines:`;
      if (language) fullPrompt += `\n- Language: ${language}`;
      if (contentRating) fullPrompt += `\n- Content Rating: ${contentRating}`;
      if (themes?.length)
        fullPrompt += `\n- Preferred Themes: ${themes.join(', ')}`;
      if (avoidances?.length)
        fullPrompt += `\n- Avoid: ${avoidances.join(', ')}`;
    }

    return fullPrompt;
  }

  private async analyzeSafety(content: string): Promise<SafetyAnalysis> {
    //TODO: Integrate with Google's safety filters API
    const lowerContent = content.toLowerCase();
    const flaggedCategories = SAFETY_KEYWORDS.filter(keyword =>
      lowerContent.includes(keyword)
    ).map(keyword => ({
      name: keyword,
      score: 0.8,
      threshold: 0.7,
      triggered: true,
    }));

    const flagged = flaggedCategories.length > 0;
    const severity =
      flaggedCategories.length > 2
        ? 'high'
        : flaggedCategories.length > 0
          ? 'medium'
          : 'none';

    return {
      flagged,
      categories: flaggedCategories,
      severity: severity as 'none' | 'low' | 'medium' | 'high',
      action: flagged ? (severity === 'high' ? 'block' : 'warn') : 'allow',
    };
  }

  private handleError(error: unknown, context: string): GameError {
    console.error(`Gemini API error in ${context}:`, error);

    //TODO: Integrate with proper error tracking service

    if (error instanceof Error) {
      if (error.message.includes('rate limit')) {
        return new GameError(
          'GEMINI_RATE_LIMIT',
          'Gemini API rate limit exceeded. Please try again later.'
        );
      }
      if (error.message.includes('API key')) {
        return new GameError(
          'GEMINI_AUTH_ERROR',
          'Gemini API authentication failed. Check API key configuration.'
        );
      }

      return new GameError(
        'GEMINI_API_ERROR',
        `Gemini API error: ${error.message}`
      );
    }

    return new GameError(
      'GEMINI_UNKNOWN_ERROR',
      'Unknown error occurred in Gemini service'
    );
  }

  private getDefaultContext(): AIContext {
    return {
      gameType: 'rpg',
      gameState: {},
      playerHistory: [],
      recentEvents: [],
      systemFlags: {},
    };
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  // ============================================================================
  // FALLBACK METHODS (When API key is not configured)
  // ============================================================================

  private async generateFallbackContent(
    prompt: string,
    context?: AIContext
  ): Promise<string> {
    // Generate deterministic content based on game type and prompt
    const gameType = context?.gameType || 'rpg';

    const fallbackResponses: Record<string, string[]> = {
      rpg: [
        'You enter a mysterious forest filled with ancient trees and glowing mushrooms.',
        'A wise old wizard approaches you with an important quest.',
        "The dragon's lair lies ahead, filled with treasure and danger.",
        'Your party discovers a hidden village in need of heroes.',
      ],
      deduction: [
        'Player 3 was seen near the crime scene at midnight.',
        'A mysterious note was found with cryptic symbols.',
        'The suspect claims to have an alibi, but something seems off.',
        'Evidence suggests the culprit is among the trusted allies.',
      ],
      village: [
        'The harvest season brings abundant crops to your village.',
        'A traveling merchant arrives with rare goods and news from distant lands.',
        'The village elder calls a meeting to discuss the upcoming winter preparations.',
        'New settlers arrive seeking a place to call home.',
      ],
    };

    const responses = fallbackResponses[gameType] || fallbackResponses.rpg;
    const hash = this.simpleHash(prompt);
    const index = parseInt(hash, 36) % responses.length;

    return responses[index];
  }

  private async generateFallbackStructured<T>(
    prompt: string,
    schema: z.ZodSchema<T>
  ): Promise<T> {
    // Generate minimal valid data that matches the schema
    //TODO: Implement more sophisticated fallback structured data generation
    const fallbackData = {};

    try {
      return schema.parse(fallbackData);
    } catch {
      // If parsing fails, throw an error indicating API key is needed
      throw new GameError(
        'API_KEY_REQUIRED',
        'Google AI API key is required for structured generation. Set GOOGLE_AI_API_KEY environment variable.'
      );
    }
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  // ============================================================================
  // PUBLIC UTILITY METHODS
  // ============================================================================

  /**
   * Get service analytics and metrics
   */
  getAnalytics() {
    return {
      ...this.analytics.getMetrics(),
      cache: this.cache.getCacheStats(),
    };
  }

  /**
   * Clear cache entries (useful for testing)
   */
  async clearCache(): Promise<void> {
    // Clear memory cache
    (this.cache as any).memoryCache.clear();

    //TODO: Clear KV cache entries
  }

  /**
   * Update service configuration
   */
  updateConfig(newConfig: Partial<GeminiServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Health check for the service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, boolean>;
    metrics: any;
  }> {
    const checks = {
      apiKeyConfigured: !!this.config.apiKey,
      cacheWorking: true,
      kvServiceConnected: true,
    };

    // Test KV connection
    try {
      await kvService.get('health_check');
    } catch (error) {
      checks.kvServiceConnected = false;
    }

    const healthyChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.values(checks).length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyChecks === totalChecks) {
      status = 'healthy';
    } else if (healthyChecks >= totalChecks * 0.5) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      checks,
      metrics: this.getAnalytics(),
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE EXPORT
// ============================================================================

export const geminiService = GeminiService.getInstance();

// ============================================================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================================================

// Export as claudeService for backward compatibility
export const claudeService = geminiService;

// Export the class as ClaudeService for backward compatibility
export { GeminiService as ClaudeService };

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a simple prompt for quick AI generation
 */
export function createSimplePrompt(
  content: string,
  gameType: 'rpg' | 'deduction' | 'village' = 'rpg'
): AIContext {
  return {
    gameType,
    gameState: { content },
    playerHistory: [],
    recentEvents: [],
    systemFlags: {},
  };
}

/**
 * Format AI response for display
 */
export function formatAIResponse(response: AIResponse): {
  content: string;
  metadata: string;
  tokens: number;
  cost: number;
} {
  const tokens = response.tokenUsage.total;
  // Gemini is much cheaper than Claude
  const cost = response.metadata.model.includes('pro')
    ? tokens * 0.000005
    : tokens * 0.0000015;

  return {
    content: response.content,
    metadata: `Model: ${response.metadata.model} | Time: ${response.processingTime}ms | Safety: ${response.metadata.safety.severity}`,
    tokens,
    cost,
  };
}
