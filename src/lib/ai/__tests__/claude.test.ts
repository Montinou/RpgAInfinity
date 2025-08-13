/**
 * Comprehensive test suite for Claude AI Service
 *
 * Tests all major functionality including:
 * - Service initialization and configuration
 * - Rate limiting and concurrent request management
 * - Caching with hash-based deduplication
 * - Streaming responses and error handling
 * - Structured output generation with Zod validation
 * - Analytics and monitoring
 * - Content safety analysis
 */

import { ClaudeService, createSimplePrompt, formatAIResponse } from '../claude';
import { kvService } from '@/lib/database/kv-service';
import { AIRequest, AIContext } from '@/types/ai';
import { z } from 'zod';

// Define GameError for testing since it's not exported from claude.ts
class GameError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'GameError';
  }
}

// Mock Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockImplementation(async params => {
        if (params.stream) {
          // Mock streaming response
          return {
            async *[Symbol.asyncIterator]() {
              yield {
                type: 'content_block_delta',
                delta: { type: 'text', text: 'Hello' },
              };
              yield {
                type: 'content_block_delta',
                delta: { type: 'text', text: ' world!' },
              };
            },
          };
        }

        // Mock standard response
        return {
          content: [{ type: 'text', text: 'Test response from Claude' }],
          usage: {
            input_tokens: 10,
            output_tokens: 5,
          },
          stop_reason: 'end_turn',
        };
      }),
    },
  }));
});

// Mock KV Service
jest.mock('@/lib/database/kv-service', () => ({
  kvService: {
    get: jest
      .fn()
      .mockResolvedValue({ success: false, data: null, timestamp: new Date() }),
    set: jest
      .fn()
      .mockResolvedValue({ success: true, data: true, timestamp: new Date() }),
    delete: jest
      .fn()
      .mockResolvedValue({ success: true, data: true, timestamp: new Date() }),
  },
}));

// Mock crypto.randomUUID with valid UUID format
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => '12345678-1234-4000-8000-123456789abc'),
  },
  writable: true,
});

// Mock environment variables
process.env.ANTHROPIC_API_KEY = 'test-api-key';

describe('ClaudeService', () => {
  let claudeService: ClaudeService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Get a fresh instance for each test
    (ClaudeService as any).instance = null;
    claudeService = ClaudeService.getInstance();
  });

  describe('Service Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(claudeService).toBeInstanceOf(ClaudeService);
    });

    it('should throw error when API key is missing', () => {
      delete process.env.ANTHROPIC_API_KEY;
      (ClaudeService as any).instance = null;

      expect(() => ClaudeService.getInstance()).toThrow(GameError);
      expect(() => ClaudeService.getInstance()).toThrow(
        'Anthropic API key is required'
      );

      // Restore API key for other tests
      process.env.ANTHROPIC_API_KEY = 'test-api-key';
    });

    it('should use singleton pattern', () => {
      const instance1 = ClaudeService.getInstance();
      const instance2 = ClaudeService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should allow configuration updates', () => {
      claudeService.updateConfig({
        defaultModel: 'claude-3-haiku-20240307',
        temperature: 0.5,
      });

      // Configuration is private, but we can test that it doesn't throw
      expect(() =>
        claudeService.updateConfig({ temperature: 0.8 })
      ).not.toThrow();
    });
  });

  describe('Content Generation', () => {
    it('should generate content successfully', async () => {
      const context = createSimplePrompt('Generate a fantasy world', 'rpg');

      const result = await claudeService.generateContent(
        'Create a magical forest description',
        context
      );

      expect(result).toBe('Test response from Claude');
    });

    it('should handle content generation with options', async () => {
      const context = createSimplePrompt('Test prompt', 'rpg');

      const result = await claudeService.generateContent(
        'Test prompt',
        context,
        {
          model: 'claude-3-haiku-20240307',
          maxTokens: 100,
          temperature: 0.5,
          priority: 'high',
        }
      );

      expect(result).toBe('Test response from Claude');
    });

    it('should handle missing context gracefully', async () => {
      const result = await claudeService.generateContent('Simple prompt');
      expect(result).toBe('Test response from Claude');
    });
  });

  describe('Streaming Content Generation', () => {
    it('should stream content successfully', async () => {
      const context = createSimplePrompt('Stream test', 'rpg');
      const chunks: string[] = [];

      for await (const chunk of claudeService.streamContent(
        'Test streaming',
        context
      )) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Hello', ' world!']);
    });

    it('should handle streaming with options', async () => {
      const context = createSimplePrompt('Stream test', 'rpg');
      const chunks: string[] = [];

      for await (const chunk of claudeService.streamContent(
        'Test streaming',
        context,
        { model: 'claude-3-haiku-20240307', temperature: 0.1 }
      )) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Hello', ' world!']);
    });
  });

  describe('Structured Output Generation', () => {
    const TestSchema = z.object({
      name: z.string(),
      type: z.string(),
      description: z.string(),
    });

    beforeEach(() => {
      // Mock response to return valid JSON
      const mockCreate = jest.fn().mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"name": "Magic Forest", "type": "wilderness", "description": "A mystical forest filled with ancient trees"}',
          },
        ],
        usage: { input_tokens: 10, output_tokens: 15 },
        stop_reason: 'end_turn',
      });

      jest.doMock('@anthropic-ai/sdk', () => {
        return jest.fn().mockImplementation(() => ({
          messages: { create: mockCreate },
        }));
      });
    });

    it('should generate and validate structured output', async () => {
      const context = createSimplePrompt('Generate location', 'rpg');

      const result = await claudeService.generateStructured(
        'Generate a fantasy location',
        TestSchema,
        context
      );

      expect(result).toEqual({
        name: 'Magic Forest',
        type: 'wilderness',
        description: 'A mystical forest filled with ancient trees',
      });
    });

    it('should handle JSON in markdown code blocks', async () => {
      // Mock response with markdown formatting
      const mockCreate = jest.fn().mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '```json\n{"name": "Dark Cave", "type": "dungeon", "description": "A deep cave system"}\n```',
          },
        ],
        usage: { input_tokens: 10, output_tokens: 15 },
        stop_reason: 'end_turn',
      });

      (claudeService as any).client = {
        messages: { create: mockCreate },
      };

      const context = createSimplePrompt('Generate location', 'rpg');

      const result = await claudeService.generateStructured(
        'Generate a fantasy location',
        TestSchema,
        context
      );

      expect(result).toEqual({
        name: 'Dark Cave',
        type: 'dungeon',
        description: 'A deep cave system',
      });
    });

    it('should retry on parsing failures', async () => {
      const mockCreate = jest
        .fn()
        .mockResolvedValueOnce({
          content: [{ type: 'text', text: 'Invalid JSON response' }],
          usage: { input_tokens: 10, output_tokens: 5 },
          stop_reason: 'end_turn',
        })
        .mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: '{"name": "Retry Success", "type": "location", "description": "Generated on retry"}',
            },
          ],
          usage: { input_tokens: 10, output_tokens: 15 },
          stop_reason: 'end_turn',
        });

      (claudeService as any).client = {
        messages: { create: mockCreate },
      };

      const context = createSimplePrompt('Generate location', 'rpg');

      const result = await claudeService.generateStructured(
        'Generate a fantasy location',
        TestSchema,
        context
      );

      expect(result.name).toBe('Retry Success');
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Always invalid JSON' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      });

      (claudeService as any).client = {
        messages: { create: mockCreate },
      };

      const context = createSimplePrompt('Generate location', 'rpg');

      await expect(
        claudeService.generateStructured(
          'Generate a fantasy location',
          TestSchema,
          context,
          { maxRetries: 2 }
        )
      ).rejects.toThrow(GameError);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce session rate limits', async () => {
      const context = createSimplePrompt('Rate limit test', 'rpg');
      context.gameState.gameId = 'test-session-id';

      // Simulate hitting rate limit by making multiple rapid requests
      const rateLimiter = (claudeService as any).rateLimiter;

      // Mock rate limiter to return false after first call
      const checkSessionLimitSpy = jest
        .spyOn(rateLimiter, 'checkSessionLimit')
        .mockResolvedValueOnce(true)
        .mockResolvedValue(false);

      // First request should succeed
      await claudeService.generateContent('First request', context);

      // Second request should fail due to rate limit
      await expect(
        claudeService.generateContent('Second request', context)
      ).rejects.toThrow(GameError);

      expect(checkSessionLimitSpy).toHaveBeenCalledTimes(2);
    });

    it('should enforce concurrent request limits', async () => {
      const context = createSimplePrompt('Concurrent test', 'rpg');
      const rateLimiter = (claudeService as any).rateLimiter;

      const checkConcurrentSpy = jest
        .spyOn(rateLimiter, 'checkConcurrentLimit')
        .mockResolvedValue(false);

      await expect(
        claudeService.generateContent('Test request', context)
      ).rejects.toThrow(GameError);

      expect(checkConcurrentSpy).toHaveBeenCalled();
    });
  });

  describe('Caching System', () => {
    it('should cache and retrieve responses', async () => {
      const context = createSimplePrompt('Cache test', 'rpg');
      const cache = (claudeService as any).cache;

      // Mock cache to return cached response on second call
      const getSpy = jest
        .spyOn(cache, 'get')
        .mockResolvedValueOnce(null) // First call: cache miss
        .mockResolvedValueOnce({
          // Second call: cache hit
          key: 'test-key',
          content: {
            id: 'cached-id',
            requestId: 'test-request',
            content: 'Cached response',
            timestamp: new Date(),
            processingTime: 100,
            tokenUsage: { prompt: 10, completion: 5, total: 15 },
            metadata: {
              model: 'claude-3-5-sonnet-20241022',
              temperature: 0.7,
              promptTokens: 10,
              completionTokens: 5,
              stopReason: 'end_turn',
              safety: {
                flagged: false,
                categories: [],
                severity: 'none',
                action: 'allow',
              },
            },
          },
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 3600000),
          hitCount: 0,
          lastAccessed: new Date(),
          size: 100,
          tags: ['claude-ai'],
        });

      // First request: cache miss, should generate new response
      const result1 = await claudeService.generateContent(
        'Test prompt',
        context
      );
      expect(result1).toBe('Test response from Claude');

      // Second request: cache hit, should return cached response
      const result2 = await claudeService.generateContent(
        'Test prompt',
        context
      );
      expect(result2).toBe('Cached response');

      expect(getSpy).toHaveBeenCalledTimes(2);
    });

    it('should generate consistent cache keys for similar requests', () => {
      const cache = (claudeService as any).cache;

      const request1: AIRequest = {
        id: 'id1',
        promptId: 'test-prompt',
        gameId: 'game1',
        parameters: { prompt: 'Test' },
        context: {
          gameType: 'rpg',
          gameState: { turn: 1 },
          playerHistory: [],
          recentEvents: [],
          systemFlags: {},
        },
        timestamp: new Date(),
        priority: 'normal',
        options: { streaming: false, timeout: 30000, maxRetries: 3 },
      };

      const request2: AIRequest = {
        ...request1,
        id: 'id2', // Different ID
        timestamp: new Date(), // Different timestamp
      };

      const key1 = cache.generateCacheKey(request1);
      const key2 = cache.generateCacheKey(request2);

      expect(key1).toBe(key2); // Should be same despite different ID/timestamp
    });
  });

  describe('Analytics and Monitoring', () => {
    it('should track request analytics', async () => {
      const context = createSimplePrompt('Analytics test', 'rpg');

      await claudeService.generateContent('Test request', context);

      const analytics = claudeService.getAnalytics();
      expect(analytics.totalRequests).toBe(1);
      expect(analytics.successfulRequests).toBe(1);
      expect(analytics.failedRequests).toBe(0);
    });

    it('should track failed requests', async () => {
      const context = createSimplePrompt('Error test', 'rpg');

      // Mock API to throw error
      const mockCreate = jest.fn().mockRejectedValue(new Error('API Error'));
      (claudeService as any).client = {
        messages: { create: mockCreate },
      };

      await expect(
        claudeService.generateContent('Error prompt', context)
      ).rejects.toThrow();

      const analytics = claudeService.getAnalytics();
      expect(analytics.failedRequests).toBe(1);
    });

    it('should provide cache statistics', async () => {
      const analytics = claudeService.getAnalytics();
      expect(analytics.cache).toBeDefined();
      expect(analytics.cache.memoryEntries).toBeDefined();
      expect(analytics.cache.hitRate).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle API rate limit errors', async () => {
      const mockError = {
        status: 429,
        message: 'Rate limit exceeded',
      };

      const mockCreate = jest.fn().mockRejectedValue(mockError);
      (claudeService as any).client = {
        messages: { create: mockCreate },
      };

      const context = createSimplePrompt('Rate limit test', 'rpg');

      await expect(
        claudeService.generateContent('Test', context)
      ).rejects.toThrow(GameError);
    });

    it('should handle API authentication errors', async () => {
      const mockError = {
        status: 401,
        message: 'Authentication failed',
      };

      const mockCreate = jest.fn().mockRejectedValue(mockError);
      (claudeService as any).client = {
        messages: { create: mockCreate },
      };

      const context = createSimplePrompt('Auth test', 'rpg');

      await expect(
        claudeService.generateContent('Test', context)
      ).rejects.toThrow(GameError);
    });

    it('should handle server errors', async () => {
      const mockError = {
        status: 500,
        message: 'Internal server error',
      };

      const mockCreate = jest.fn().mockRejectedValue(mockError);
      (claudeService as any).client = {
        messages: { create: mockCreate },
      };

      const context = createSimplePrompt('Server error test', 'rpg');

      await expect(
        claudeService.generateContent('Test', context)
      ).rejects.toThrow(GameError);
    });

    it('should handle unknown errors', async () => {
      const mockCreate = jest.fn().mockRejectedValue('Unknown error');
      (claudeService as any).client = {
        messages: { create: mockCreate },
      };

      const context = createSimplePrompt('Unknown error test', 'rpg');

      await expect(
        claudeService.generateContent('Test', context)
      ).rejects.toThrow(GameError);
    });
  });

  describe('Safety Analysis', () => {
    it('should analyze content safety', async () => {
      // Test with safe content
      const context = createSimplePrompt('Safe content test', 'rpg');
      const result = await claudeService.generateContent(
        'Generate a peaceful village',
        context
      );

      expect(result).toBe('Test response from Claude');
      // Safety analysis happens internally, we can't directly test it without exposing private methods
    });

    it('should handle cultural preferences', async () => {
      const context: AIContext = {
        gameType: 'rpg',
        gameState: {},
        playerHistory: [],
        recentEvents: [],
        systemFlags: {},
        culturalPreferences: {
          language: 'en',
          region: 'US',
          contentRating: 'general',
          themes: ['adventure', 'friendship'],
          avoidances: ['violence', 'scary'],
        },
      };

      const result = await claudeService.generateContent(
        'Generate content',
        context
      );
      expect(result).toBe('Test response from Claude');
    });
  });

  describe('Health Check', () => {
    it('should perform health check', async () => {
      const health = await claudeService.healthCheck();

      expect(health.status).toMatch(/healthy|degraded|unhealthy/);
      expect(health.checks).toHaveProperty('apiKeyConfigured');
      expect(health.checks).toHaveProperty('cacheWorking');
      expect(health.checks).toHaveProperty('kvServiceConnected');
      expect(health.metrics).toBeDefined();
    });
  });

  describe('Utility Functions', () => {
    it('should create simple prompts correctly', () => {
      const context = createSimplePrompt('Test content', 'deduction');

      expect(context.gameType).toBe('deduction');
      expect(context.gameState.content).toBe('Test content');
      expect(context.playerHistory).toEqual([]);
      expect(context.recentEvents).toEqual([]);
    });

    it('should format AI responses', () => {
      const response = {
        id: 'test-id',
        requestId: 'req-id',
        content: 'Test response content',
        timestamp: new Date(),
        processingTime: 1500,
        tokenUsage: { prompt: 10, completion: 20, total: 30 },
        metadata: {
          model: 'claude-3-5-sonnet-20241022' as any,
          temperature: 0.7,
          promptTokens: 10,
          completionTokens: 20,
          stopReason: 'end_turn' as any,
          safety: {
            flagged: false,
            categories: [],
            severity: 'none' as any,
            action: 'allow' as any,
          },
        },
      };

      const formatted = formatAIResponse(response);

      expect(formatted.content).toBe('Test response content');
      expect(formatted.tokens).toBe(30);
      expect(formatted.cost).toBeGreaterThan(0);
      expect(formatted.metadata).toContain('Model: claude-3-5-sonnet-20241022');
      expect(formatted.metadata).toContain('Time: 1500ms');
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', async () => {
      await expect(claudeService.clearCache()).resolves.not.toThrow();
    });
  });
});
