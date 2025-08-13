/**
 * Claude API Integration Service for RpgAInfinity
 *
 * This service provides:
 * - Claude API integration with proper error handling
 * - Request/response processing and validation
 * - Streaming response support
 * - Intelligent caching and rate limiting
 * - Performance monitoring and analytics
 * - Fallback mechanisms and retry logic
 */

// Anthropic SDK will be installed separately
// For now, we'll create a mock class
class Anthropic {
  messages = {
    create: async (params: any): Promise<any> => {
      throw new Error(
        'Anthropic SDK not installed. Please install "anthropic" package.'
      );
    },
  };

  constructor(config?: any) {
    // Mock constructor
  }
}
import { z } from 'zod';
import {
  AIRequest,
  AIResponse,
  AIServiceConfig,
  AIContext,
  StructuredAIResponse,
  SafetyAnalysis,
  TokenUsage,
  AIResponseMetadata,
  CacheEntry,
  AIModel,
} from '../../types/ai';
import { UUID, GameError } from '../../types/core';
import { kvService } from '../database/kv-service';
import { generatePrompt, type PromptContext } from './prompts';

// ============================================================================
// CLAUDE SERVICE CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: AIServiceConfig = {
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  model: 'claude-3-5-sonnet-20241022',
  maxTokens: 4000,
  temperature: 0.7,
  rateLimits: {
    requestsPerMinute: 50,
    tokensPerMinute: 40000,
    concurrent: 5,
    backoffStrategy: 'exponential',
  },
  caching: {
    enabled: true,
    ttlMinutes: 240, // 4 hours for hot cache
    maxEntries: 1000,
    strategy: 'lru',
  },
  retryPolicy: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    retryableErrors: ['rate_limit_error', 'server_error', 'timeout'],
  },
};

// ============================================================================
// REQUEST/RESPONSE PROCESSING
// ============================================================================

export interface ClaudeRequestOptions {
  readonly streaming?: boolean;
  readonly useCache?: boolean;
  readonly priority?: 'low' | 'normal' | 'high' | 'critical';
  readonly timeout?: number;
  readonly customSystemPrompt?: string;
  readonly structuredOutput?: boolean;
}

export interface StreamingResponse {
  readonly id: string;
  readonly content: AsyncIterableIterator<string>;
  readonly metadata: Promise<AIResponseMetadata>;
  readonly cancel: () => void;
}

export interface ProcessingResult {
  readonly success: boolean;
  readonly response?: AIResponse;
  readonly error?: GameError;
  readonly cached: boolean;
  readonly retryCount: number;
  readonly processingTime: number;
}

// ============================================================================
// CLAUDE SERVICE IMPLEMENTATION
// ============================================================================

class ClaudeService {
  private client: Anthropic;
  private config: AIServiceConfig;
  private activeRequests = new Map<string, AbortController>();
  private rateLimitTracker = new Map<string, RateLimitBucket>();
  private performanceMetrics = new Map<string, PerformanceMetric>();

  constructor(config: Partial<AIServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (!this.config.apiKey) {
      throw new Error('Anthropic API key is required');
    }

    this.client = new Anthropic({
      apiKey: this.config.apiKey,
      maxRetries: 0, // We handle retries manually
    });

    this.initializeRateLimiting();
  }

  /**
   * Generate AI response using prompt template
   */
  async generateFromPrompt(
    templateId: string,
    context: PromptContext,
    options: ClaudeRequestOptions = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    let retryCount = 0;

    try {
      // Generate prompt from template
      const promptResult = await generatePrompt(templateId, context, {
        optimizeForTokens: true,
        safetyLevel: 'moderate',
      });

      if (!promptResult.safety.passed) {
        return {
          success: false,
          error: {
            code: 'SAFETY_VIOLATION',
            message: `Prompt failed safety validation: ${promptResult.safety.flags.join(', ')}`,
            details: { safetyFlags: promptResult.safety.flags },
            timestamp: new Date(),
          },
          cached: false,
          retryCount: 0,
          processingTime: Date.now() - startTime,
        };
      }

      // Create AI request
      const aiRequest: AIRequest = {
        id: crypto.randomUUID(),
        promptId: templateId,
        gameId: context.gameState?.id || 'unknown',
        playerId: context.currentPlayer?.id,
        parameters: context.variables,
        context: this.buildAIContext(context),
        timestamp: new Date(),
        priority: options.priority || 'normal',
        options: {
          streaming: options.streaming || false,
          cacheKey: this.generateCacheKey(templateId, context),
          timeout: options.timeout || 30000,
          maxRetries: this.config.retryPolicy.maxAttempts,
          fallbackPrompt: options.customSystemPrompt,
        },
      };

      // Check cache first
      if (options.useCache !== false && this.config.caching.enabled) {
        const cached = await this.getCachedResponse(
          aiRequest.options.cacheKey!
        );
        if (cached) {
          return {
            success: true,
            response: cached.content,
            cached: true,
            retryCount: 0,
            processingTime: Date.now() - startTime,
          };
        }
      }

      // Check rate limits
      await this.checkRateLimits(aiRequest);

      // Process request with retry logic
      while (retryCount <= this.config.retryPolicy.maxAttempts) {
        try {
          const result = await this.processRequest(
            aiRequest,
            promptResult.content,
            options
          );

          // Cache successful response
          if (
            result.success &&
            result.response &&
            this.config.caching.enabled
          ) {
            await this.cacheResponse(
              aiRequest.options.cacheKey!,
              result.response
            );
          }

          return {
            ...result,
            retryCount,
            processingTime: Date.now() - startTime,
          };
        } catch (error) {
          retryCount++;

          if (!this.shouldRetry(error, retryCount)) {
            throw error;
          }

          const delay = this.calculateRetryDelay(retryCount);
          await this.sleep(delay);
        }
      }

      throw new Error('Maximum retry attempts exceeded');
    } catch (error) {
      return {
        success: false,
        error: this.processError(error),
        cached: false,
        retryCount,
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Generate streaming response
   */
  async generateStreaming(
    templateId: string,
    context: PromptContext,
    options: ClaudeRequestOptions = {}
  ): Promise<StreamingResponse> {
    const promptResult = await generatePrompt(templateId, context);
    const requestId = crypto.randomUUID();
    const abortController = new AbortController();

    this.activeRequests.set(requestId, abortController);

    try {
      const stream = await this.client.messages.create(
        {
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          messages: [
            {
              role: 'user',
              content: promptResult.content,
            },
          ],
          stream: true,
        },
        {
          signal: abortController.signal,
        }
      );

      const contentIterator = this.createContentIterator(stream);
      const metadataPromise = this.createMetadataPromise(stream);

      return {
        id: requestId,
        content: contentIterator,
        metadata: metadataPromise,
        cancel: () => {
          abortController.abort();
          this.activeRequests.delete(requestId);
        },
      };
    } catch (error) {
      this.activeRequests.delete(requestId);
      throw this.processError(error);
    }
  }

  /**
   * Process structured AI response with validation
   */
  async generateStructured<T = any>(
    templateId: string,
    context: PromptContext,
    schema: z.ZodSchema<T>,
    options: ClaudeRequestOptions = {}
  ): Promise<ProcessingResult & { structured?: T }> {
    const result = await this.generateFromPrompt(templateId, context, {
      ...options,
      structuredOutput: true,
    });

    if (!result.success || !result.response) {
      return result;
    }

    try {
      // Attempt to parse structured content
      const structured = this.extractStructuredContent(
        result.response.content,
        schema
      );

      return {
        ...result,
        structured,
      };
    } catch (error) {
      return {
        ...result,
        error: {
          code: 'PARSING_ERROR',
          message: 'Failed to parse structured response',
          details: { originalError: error },
          timestamp: new Date(),
        },
      };
    }
  }

  /**
   * Batch process multiple requests efficiently
   */
  async generateBatch(
    requests: Array<{
      templateId: string;
      context: PromptContext;
      options?: ClaudeRequestOptions;
    }>
  ): Promise<ProcessingResult[]> {
    // Process requests with concurrency limits
    const semaphore = new Semaphore(this.config.rateLimits.concurrent);

    const promises = requests.map(async req => {
      await semaphore.acquire();
      try {
        return await this.generateFromPrompt(
          req.templateId,
          req.context,
          req.options
        );
      } finally {
        semaphore.release();
      }
    });

    return Promise.all(promises);
  }

  // ========================================================================
  // PRIVATE HELPER METHODS
  // ========================================================================

  private async processRequest(
    request: AIRequest,
    promptContent: string,
    options: ClaudeRequestOptions
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      // Prepare messages
      const messages: Anthropic.MessageParam[] = [
        {
          role: 'user',
          content: promptContent,
        },
      ];

      // Add system prompt if provided
      const systemPrompt =
        options.customSystemPrompt || this.buildSystemPrompt(request.context);

      // Create Claude request
      const claudeResponse = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: systemPrompt,
        messages,
      });

      // Process response
      const aiResponse = this.processClaudeResponse(
        request,
        claudeResponse,
        Date.now() - startTime
      );

      // Validate safety
      const safetyAnalysis = await this.analyzeSafety(aiResponse.content);
      aiResponse.metadata.safety = safetyAnalysis;

      if (!safetyAnalysis.flagged || safetyAnalysis.action === 'allow') {
        // Track successful request
        await this.trackSuccess(request, aiResponse);

        return {
          success: true,
          response: aiResponse,
          cached: false,
          retryCount: 0,
          processingTime: Date.now() - startTime,
        };
      } else {
        return {
          success: false,
          error: {
            code: 'CONTENT_BLOCKED',
            message: 'Content blocked by safety analysis',
            details: { safetyAnalysis },
            timestamp: new Date(),
          },
          cached: false,
          retryCount: 0,
          processingTime: Date.now() - startTime,
        };
      }
    } catch (error) {
      await this.trackError(request, error);
      throw error;
    }
  }

  private processClaudeResponse(
    request: AIRequest,
    claudeResponse: Anthropic.Message,
    processingTime: number
  ): AIResponse {
    const content = claudeResponse.content
      .filter(block => block.type === 'text')
      .map(block => (block as any).text)
      .join('\n');

    const tokenUsage: TokenUsage = {
      prompt: claudeResponse.usage.input_tokens,
      completion: claudeResponse.usage.output_tokens,
      total:
        claudeResponse.usage.input_tokens + claudeResponse.usage.output_tokens,
    };

    const metadata: AIResponseMetadata = {
      model: claudeResponse.model as AIModel,
      temperature: this.config.temperature,
      promptTokens: claudeResponse.usage.input_tokens,
      completionTokens: claudeResponse.usage.output_tokens,
      stopReason: claudeResponse.stop_reason as any,
      finishReasonDetails: claudeResponse.stop_sequence || undefined,
      safety: {
        flagged: false,
        categories: [],
        severity: 'none',
        action: 'allow',
      },
    };

    // Attempt to extract structured response
    let structured: StructuredAIResponse | undefined;
    try {
      structured = this.extractStructuredResponse(
        content,
        request.context.gameType
      );
    } catch {
      // Structured extraction is optional
    }

    return {
      id: crypto.randomUUID(),
      requestId: request.id,
      content,
      structured,
      metadata,
      timestamp: new Date(),
      processingTime,
      tokenUsage,
    };
  }

  private buildAIContext(context: PromptContext): AIContext {
    return {
      gameType: context.gameType,
      gameState: context.gameState || {},
      playerHistory: context.currentPlayer
        ? [
            {
              playerId: context.currentPlayer.id,
              actions: [],
              preferences: context.currentPlayer.metadata || {},
              personality: undefined,
              playStyle: undefined,
            },
          ]
        : [],
      recentEvents: [],
      systemFlags: context.systemFlags || {},
      culturalPreferences: context.culturalContext
        ? {
            language: context.culturalContext.language,
            region: context.culturalContext.region,
            contentRating: context.culturalContext.contentRating,
            themes: [],
            avoidances: [],
          }
        : undefined,
    };
  }

  private buildSystemPrompt(context: AIContext): string {
    let systemPrompt = `You are an AI assistant specialized in creating content for ${context.gameType} games. `;

    switch (context.gameType) {
      case 'rpg':
        systemPrompt +=
          'Focus on creating immersive, engaging fantasy content that encourages roleplay and adventure. ';
        break;
      case 'deduction':
        systemPrompt +=
          'Create balanced, fair content for social deduction games that encourages discussion and logical thinking. ';
        break;
      case 'village':
        systemPrompt +=
          'Generate realistic village simulation content that balances challenge with progression. ';
        break;
    }

    if (context.culturalPreferences) {
      systemPrompt += `Content should be appropriate for ${context.culturalPreferences.contentRating} audiences `;
      systemPrompt += `and consider ${context.culturalPreferences.language} language preferences. `;
    }

    systemPrompt +=
      'Always prioritize user safety, inclusivity, and positive gaming experiences.';

    return systemPrompt;
  }

  private generateCacheKey(templateId: string, context: PromptContext): string {
    // Create hash of key context elements for caching
    const cacheData = {
      templateId,
      gameType: context.gameType,
      variables: context.variables,
      contentRating: context.culturalContext?.contentRating,
    };

    return `ai_cache:${btoa(JSON.stringify(cacheData)).substring(0, 32)}`;
  }

  private async getCachedResponse(
    cacheKey: string
  ): Promise<CacheEntry | null> {
    try {
      const cached = await kvService.get<CacheEntry>(cacheKey);
      if (cached && new Date(cached.expiresAt) > new Date()) {
        // Update access time
        cached.lastAccessed = new Date();
        cached.hitCount++;
        await kvService.set(
          cacheKey,
          cached,
          this.config.caching.ttlMinutes * 60
        );
        return cached;
      }
      return null;
    } catch (error) {
      // Cache errors should not break the request
      console.warn('Cache retrieval failed:', error);
      return null;
    }
  }

  private async cacheResponse(
    cacheKey: string,
    response: AIResponse
  ): Promise<void> {
    try {
      const cacheEntry: CacheEntry = {
        key: cacheKey,
        content: response,
        createdAt: new Date(),
        expiresAt: new Date(
          Date.now() + this.config.caching.ttlMinutes * 60 * 1000
        ),
        hitCount: 0,
        lastAccessed: new Date(),
        size: JSON.stringify(response).length,
        tags: [response.structured?.type || 'general'],
      };

      await kvService.set(
        cacheKey,
        cacheEntry,
        this.config.caching.ttlMinutes * 60
      );
    } catch (error) {
      console.warn('Cache storage failed:', error);
    }
  }

  private async checkRateLimits(request: AIRequest): Promise<void> {
    const bucket =
      this.rateLimitTracker.get('global') || this.createRateLimitBucket();

    if (!bucket.canProcess()) {
      const waitTime = bucket.getWaitTime();
      if (request.priority === 'critical') {
        // Allow critical requests to proceed with warning
        console.warn(
          `Rate limit exceeded for critical request ${request.id}, proceeding anyway`
        );
      } else {
        throw new Error(
          `Rate limit exceeded. Wait ${waitTime}ms before next request.`
        );
      }
    }

    bucket.consume();
    this.rateLimitTracker.set('global', bucket);
  }

  private createRateLimitBucket(): RateLimitBucket {
    return {
      requests: [],
      tokens: [],
      maxRequests: this.config.rateLimits.requestsPerMinute,
      maxTokens: this.config.rateLimits.tokensPerMinute,
      windowMs: 60000, // 1 minute
      canProcess: function () {
        const now = Date.now();
        this.requests = this.requests.filter(
          time => now - time < this.windowMs
        );
        return this.requests.length < this.maxRequests;
      },
      consume: function () {
        this.requests.push(Date.now());
      },
      getWaitTime: function () {
        if (this.requests.length === 0) return 0;
        const oldest = Math.min(...this.requests);
        return Math.max(0, this.windowMs - (Date.now() - oldest));
      },
    };
  }

  private shouldRetry(error: any, retryCount: number): boolean {
    if (retryCount >= this.config.retryPolicy.maxAttempts) {
      return false;
    }

    const errorType = this.getErrorType(error);
    return this.config.retryPolicy.retryableErrors.includes(errorType);
  }

  private calculateRetryDelay(retryCount: number): number {
    if (this.config.rateLimits.backoffStrategy === 'exponential') {
      return Math.min(
        this.config.retryPolicy.baseDelayMs * Math.pow(2, retryCount - 1),
        this.config.retryPolicy.maxDelayMs
      );
    } else {
      return this.config.retryPolicy.baseDelayMs * retryCount;
    }
  }

  private getErrorType(error: any): string {
    if (error?.status === 429) return 'rate_limit_error';
    if (error?.status >= 500) return 'server_error';
    if (error?.code === 'TIMEOUT') return 'timeout';
    return 'unknown_error';
  }

  private processError(error: any): GameError {
    return {
      code: this.getErrorType(error).toUpperCase(),
      message: error?.message || 'Unknown error occurred',
      details: { originalError: error },
      timestamp: new Date(),
    };
  }

  private async analyzeSafety(content: string): Promise<SafetyAnalysis> {
    // Basic safety analysis - in production, integrate with proper content moderation
    const flags: string[] = [];
    const categories = [];

    // Simple keyword-based safety check
    const unsafePatterns = [
      { pattern: /explicit|sexual|adult content/i, category: 'adult_content' },
      { pattern: /violence|kill|murder/i, category: 'violence' },
      { pattern: /hate|racist|discriminat/i, category: 'hate_speech' },
      { pattern: /personal.*info|private.*data/i, category: 'privacy' },
    ];

    let maxSeverity: 'none' | 'low' | 'medium' | 'high' = 'none';

    for (const check of unsafePatterns) {
      if (check.pattern.test(content)) {
        flags.push(check.category);
        categories.push({
          name: check.category,
          score: 0.7, // Placeholder score
          threshold: 0.5,
          triggered: true,
        });
        maxSeverity = 'medium';
      }
    }

    return {
      flagged: flags.length > 0,
      categories,
      severity: maxSeverity,
      action: flags.length > 0 ? 'warn' : 'allow',
    };
  }

  private extractStructuredResponse(
    content: string,
    gameType: string
  ): StructuredAIResponse | undefined {
    // Attempt to extract JSON or structured content from response
    // This is a simplified implementation - in production, use more sophisticated parsing

    try {
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[1]);
        return {
          type: this.inferContentType(data, gameType),
          data,
          confidence: 0.8,
        };
      }
    } catch {
      // Ignore parsing errors for optional structured content
    }

    return undefined;
  }

  private inferContentType(
    data: any,
    gameType: string
  ): StructuredAIResponse['type'] {
    // Infer content type based on data structure and game type
    if (gameType === 'rpg') {
      if (data.locations || data.world) return 'world';
      if (data.name || data.race || data.class) return 'character';
      if (data.story || data.narrative) return 'narrative';
    } else if (gameType === 'deduction') {
      if (data.roles) return 'role';
      if (data.clues) return 'clue';
    } else if (gameType === 'village') {
      if (data.event || data.events) return 'event';
      if (data.npc || data.character) return 'npc';
    }

    return 'narrative'; // Default fallback
  }

  private extractStructuredContent<T>(
    content: string,
    schema: z.ZodSchema<T>
  ): T {
    // Try to extract and validate structured content
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      return schema.parse(parsed);
    }

    throw new Error('No structured content found');
  }

  private async createContentIterator(
    stream: AsyncIterable<Anthropic.MessageStreamEvent>
  ): Promise<AsyncIterableIterator<string>> {
    return {
      async *[Symbol.asyncIterator]() {
        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            yield chunk.delta.text;
          }
        }
      },
    };
  }

  private async createMetadataPromise(
    stream: AsyncIterable<Anthropic.MessageStreamEvent>
  ): Promise<AIResponseMetadata> {
    // Collect metadata from stream events
    return new Promise(resolve => {
      const metadata: AIResponseMetadata = {
        model: this.config.model,
        temperature: this.config.temperature,
        promptTokens: 0,
        completionTokens: 0,
        stopReason: 'end_turn',
        safety: {
          flagged: false,
          categories: [],
          severity: 'none',
          action: 'allow',
        },
      };

      // TODO: Extract actual metadata from stream events
      resolve(metadata);
    });
  }

  private async trackSuccess(
    request: AIRequest,
    response: AIResponse
  ): Promise<void> {
    // TODO: Implement success tracking for analytics
    const metric =
      this.performanceMetrics.get(request.promptId) || this.createEmptyMetric();
    metric.successCount++;
    metric.totalResponseTime += response.processingTime;
    metric.totalTokens += response.tokenUsage.total;
    this.performanceMetrics.set(request.promptId, metric);
  }

  private async trackError(request: AIRequest, error: any): Promise<void> {
    // TODO: Implement error tracking for analytics
    const metric =
      this.performanceMetrics.get(request.promptId) || this.createEmptyMetric();
    metric.errorCount++;
    this.performanceMetrics.set(request.promptId, metric);
  }

  private createEmptyMetric(): PerformanceMetric {
    return {
      successCount: 0,
      errorCount: 0,
      totalResponseTime: 0,
      totalTokens: 0,
      lastUsed: new Date(),
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private initializeRateLimiting(): void {
    // Initialize global rate limiting bucket
    this.rateLimitTracker.set('global', this.createRateLimitBucket());
  }
}

// ============================================================================
// SUPPORTING INTERFACES AND UTILITIES
// ============================================================================

interface RateLimitBucket {
  requests: number[];
  tokens: number[];
  maxRequests: number;
  maxTokens: number;
  windowMs: number;
  canProcess(): boolean;
  consume(): void;
  getWaitTime(): number;
}

interface PerformanceMetric {
  successCount: number;
  errorCount: number;
  totalResponseTime: number;
  totalTokens: number;
  lastUsed: Date;
}

class Semaphore {
  private permits: number;
  private waiting: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return Promise.resolve();
    }

    return new Promise<void>(resolve => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    if (this.waiting.length > 0) {
      const next = this.waiting.shift()!;
      this.permits--;
      next();
    }
  }
}

// Create singleton instance
export const claudeService = new ClaudeService();

// Utility functions
export async function generateGameContent(
  templateId: string,
  gameType: 'rpg' | 'deduction' | 'village',
  variables: Record<string, any>,
  options?: ClaudeRequestOptions
): Promise<ProcessingResult> {
  const context: PromptContext = {
    gameType,
    variables,
    culturalContext: {
      language: 'en',
      region: 'US',
      contentRating: 'general',
    },
  };

  return claudeService.generateFromPrompt(templateId, context, options);
}

export async function generateStreamingContent(
  templateId: string,
  gameType: 'rpg' | 'deduction' | 'village',
  variables: Record<string, any>,
  options?: ClaudeRequestOptions
): Promise<StreamingResponse> {
  const context: PromptContext = {
    gameType,
    variables,
  };

  return claudeService.generateStreaming(templateId, context, options);
}

// TODO: Implement Claude function calling integration
// TODO: Add vision support for image-based prompts
// TODO: Implement conversation context management
// TODO: Add prompt template caching optimization
// TODO: Implement usage analytics dashboard
// TODO: Add A/B testing integration for live optimization
// TODO: Create prompt performance benchmarking
// TODO: Add multi-model support (Claude, GPT, etc.)
