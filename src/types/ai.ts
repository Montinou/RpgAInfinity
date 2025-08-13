/**
 * AI integration type definitions for RpgAInfinity
 * Claude API integration, prompt management, and AI response processing
 */

import { z } from 'zod';
import {
  UUID,
  Timestamp,
  JSONValue,
  UUIDSchema,
  TimestampSchema,
  JSONValueSchema,
} from './core';

// ============================================================================
// AI SERVICE CONFIGURATION
// ============================================================================

export interface AIServiceConfig {
  readonly apiKey: string;
  readonly model: AIModel;
  readonly maxTokens: number;
  readonly temperature: number;
  readonly rateLimits: RateLimit;
  readonly caching: CacheConfig;
  readonly retryPolicy: RetryConfig;
}

export type AIModel =
  | 'claude-3-5-sonnet-20241022'
  | 'claude-3-5-haiku-20241022'
  | 'claude-3-opus-20240229'
  | 'claude-3-sonnet-20240229'
  | 'claude-3-haiku-20240307';

export interface RateLimit {
  readonly requestsPerMinute: number;
  readonly tokensPerMinute: number;
  readonly concurrent: number;
  readonly backoffStrategy: 'linear' | 'exponential';
}

export interface CacheConfig {
  readonly enabled: boolean;
  readonly ttlMinutes: number;
  readonly maxEntries: number;
  readonly strategy: 'lru' | 'fifo' | 'ttl';
}

export interface RetryConfig {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly retryableErrors: string[];
}

// ============================================================================
// PROMPT SYSTEM
// ============================================================================

export interface PromptTemplate {
  readonly id: string;
  readonly name: string;
  readonly category: PromptCategory;
  readonly gameType: 'core' | 'rpg' | 'deduction' | 'village';
  readonly template: string;
  readonly variables: PromptVariable[];
  readonly constraints: PromptConstraint[];
  readonly metadata: PromptMetadata;
}

export type PromptCategory =
  | 'world_generation'
  | 'character_creation'
  | 'narrative_continuation'
  | 'role_generation'
  | 'clue_creation'
  | 'dialogue_generation'
  | 'event_creation'
  | 'npc_behavior'
  | 'description_enhancement'
  | 'rule_interpretation'
  | 'balance_analysis';

export interface PromptVariable {
  readonly name: string;
  readonly type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  readonly description: string;
  readonly required: boolean;
  readonly defaultValue?: JSONValue;
  readonly validation?: PromptValidation;
}

export interface PromptValidation {
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly allowedValues?: JSONValue[];
  readonly customValidator?: string;
}

export interface PromptConstraint {
  readonly type: 'length' | 'tone' | 'content' | 'format' | 'safety';
  readonly description: string;
  readonly parameters: Record<string, JSONValue>;
}

export interface PromptMetadata {
  readonly author: string;
  readonly version: string;
  readonly createdAt: Timestamp;
  readonly lastModified: Timestamp;
  readonly tags: string[];
  readonly usage: PromptUsageStats;
  readonly rating: number; // 1-5 based on user feedback
}

export interface PromptUsageStats {
  readonly timesUsed: number;
  readonly avgResponseTime: number;
  readonly successRate: number;
  readonly avgTokensUsed: number;
  readonly userSatisfaction: number; // 1-5
}

// ============================================================================
// AI REQUEST & RESPONSE
// ============================================================================

export interface AIRequest {
  readonly id: UUID;
  readonly promptId: string;
  readonly gameId: UUID;
  readonly playerId?: UUID;
  readonly parameters: Record<string, JSONValue>;
  readonly context: AIContext;
  readonly timestamp: Timestamp;
  readonly priority: RequestPriority;
  readonly options: AIRequestOptions;
}

export type RequestPriority = 'low' | 'normal' | 'high' | 'critical';

export interface AIRequestOptions {
  readonly streaming: boolean;
  readonly cacheKey?: string;
  readonly timeout: number;
  readonly maxRetries: number;
  readonly fallbackPrompt?: string;
}

export interface AIContext {
  readonly gameType: 'rpg' | 'deduction' | 'village';
  readonly gameState: Record<string, JSONValue>;
  readonly playerHistory: PlayerContextEntry[];
  readonly recentEvents: ContextualEvent[];
  readonly systemFlags: Record<string, boolean>;
  readonly culturalPreferences?: CulturalContext;
}

export interface PlayerContextEntry {
  readonly playerId: UUID;
  readonly actions: string[];
  readonly preferences: Record<string, JSONValue>;
  readonly personality?: string;
  readonly playStyle?: string;
}

export interface ContextualEvent {
  readonly type: string;
  readonly description: string;
  readonly timestamp: Timestamp;
  readonly impact: 'low' | 'medium' | 'high';
  readonly relatedEntities: string[];
}

export interface CulturalContext {
  readonly language: string;
  readonly region: string;
  readonly contentRating: 'general' | 'teen' | 'mature';
  readonly themes: string[];
  readonly avoidances: string[];
}

export interface AIResponse {
  readonly id: UUID;
  readonly requestId: UUID;
  readonly content: string;
  readonly structured?: StructuredAIResponse;
  readonly metadata: AIResponseMetadata;
  readonly timestamp: Timestamp;
  readonly processingTime: number; // milliseconds
  readonly tokenUsage: TokenUsage;
}

export interface StructuredAIResponse {
  readonly type:
    | 'world'
    | 'character'
    | 'narrative'
    | 'role'
    | 'clue'
    | 'event'
    | 'npc'
    | 'dialogue';
  readonly data: Record<string, JSONValue>;
  readonly confidence: number; // 0-1
  readonly alternativeOptions?: Record<string, JSONValue>[];
}

export interface AIResponseMetadata {
  readonly model: AIModel;
  readonly temperature: number;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly stopReason: 'max_tokens' | 'end_turn' | 'stop_sequence' | 'tool_use';
  readonly finishReasonDetails?: string;
  readonly safety: SafetyAnalysis;
}

export interface TokenUsage {
  readonly prompt: number;
  readonly completion: number;
  readonly total: number;
  readonly cached?: number;
}

export interface SafetyAnalysis {
  readonly flagged: boolean;
  readonly categories: SafetyCategory[];
  readonly severity: 'none' | 'low' | 'medium' | 'high';
  readonly action: 'allow' | 'warn' | 'block';
}

export interface SafetyCategory {
  readonly name: string;
  readonly score: number; // 0-1
  readonly threshold: number;
  readonly triggered: boolean;
}

// ============================================================================
// CONTENT GENERATION TYPES
// ============================================================================

export interface WorldGenerationRequest extends AIRequest {
  readonly parameters: {
    readonly theme: string;
    readonly biome?: string;
    readonly size: 'small' | 'medium' | 'large';
    readonly complexity: 'simple' | 'moderate' | 'complex';
    readonly tone: string;
    readonly playerCount: number;
    readonly existingLore?: string;
    readonly restrictions?: string[];
  };
}

export interface CharacterGenerationRequest extends AIRequest {
  readonly parameters: {
    readonly race?: string;
    readonly class?: string;
    readonly level: number;
    readonly personality?: string;
    readonly background?: string;
    readonly worldContext: string;
    readonly restrictions?: string[];
  };
}

export interface NarrativeGenerationRequest extends AIRequest {
  readonly parameters: {
    readonly currentSituation: string;
    readonly playerActions: string[];
    readonly worldState: Record<string, JSONValue>;
    readonly tone: string;
    readonly length: 'short' | 'medium' | 'long';
    readonly includeDifficulty?: 'easy' | 'medium' | 'hard';
  };
}

export interface RoleGenerationRequest extends AIRequest {
  readonly parameters: {
    readonly theme: string;
    readonly playerCount: number;
    readonly complexity: 'simple' | 'moderate' | 'complex';
    readonly scenario: string;
    readonly balancing: 'favor_town' | 'balanced' | 'favor_mafia';
    readonly customRequirements?: string[];
  };
}

export interface EventGenerationRequest extends AIRequest {
  readonly parameters: {
    readonly eventType: string;
    readonly severity: 'minor' | 'moderate' | 'major' | 'catastrophic';
    readonly villageState: Record<string, JSONValue>;
    readonly season: string;
    readonly previousEvents: string[];
    readonly constraints?: string[];
  };
}

// ============================================================================
// PROCESSING & VALIDATION
// ============================================================================

export interface ContentProcessor {
  readonly type: string;
  readonly inputFormat: 'raw' | 'json' | 'markdown' | 'xml';
  readonly outputFormat: 'structured' | 'validated' | 'enhanced';
  readonly validation: ValidationRule[];
  readonly transformation: TransformationRule[];
}

export interface ValidationRule {
  readonly name: string;
  readonly type:
    | 'required_field'
    | 'format_check'
    | 'content_filter'
    | 'logic_check';
  readonly parameters: Record<string, JSONValue>;
  readonly severity: 'error' | 'warning' | 'info';
  readonly message: string;
}

export interface TransformationRule {
  readonly name: string;
  readonly type: 'format' | 'enhance' | 'sanitize' | 'normalize';
  readonly target: string; // JSON path or field name
  readonly operation: string;
  readonly parameters?: Record<string, JSONValue>;
}

export interface ProcessingResult {
  readonly success: boolean;
  readonly processedContent: JSONValue;
  readonly validationErrors: ValidationError[];
  readonly warnings: ValidationWarning[];
  readonly metadata: ProcessingMetadata;
}

export interface ValidationError {
  readonly rule: string;
  readonly field: string;
  readonly message: string;
  readonly severity: 'error' | 'warning' | 'info';
  readonly suggestedFix?: string;
}

export interface ValidationWarning {
  readonly rule: string;
  readonly field: string;
  readonly message: string;
  readonly impact: 'low' | 'medium' | 'high';
}

export interface ProcessingMetadata {
  readonly processingTime: number;
  readonly rulesApplied: string[];
  readonly transformationsPerformed: number;
  readonly qualityScore: number; // 0-100
  readonly confidence: number; // 0-1
}

// ============================================================================
// CACHING & OPTIMIZATION
// ============================================================================

export interface CacheEntry {
  readonly key: string;
  readonly content: AIResponse;
  readonly createdAt: Timestamp;
  readonly expiresAt: Timestamp;
  readonly hitCount: number;
  readonly lastAccessed: Timestamp;
  readonly size: number; // bytes
  readonly tags: string[];
}

export interface CacheStrategy {
  readonly name: string;
  readonly keyGeneration: KeyGenerationRule[];
  readonly ttlStrategy: TTLStrategy;
  readonly evictionPolicy: EvictionPolicy;
  readonly compression: boolean;
}

export interface KeyGenerationRule {
  readonly include: string[]; // Fields to include in key
  readonly exclude?: string[]; // Fields to exclude
  readonly hash: boolean; // Whether to hash the key
  readonly prefix?: string;
}

export interface TTLStrategy {
  readonly default: number; // minutes
  readonly byCategory: Record<PromptCategory, number>;
  readonly dynamic: boolean; // Adjust based on content quality
  readonly minTTL: number;
  readonly maxTTL: number;
}

export interface EvictionPolicy {
  readonly algorithm: 'lru' | 'lfu' | 'ttl' | 'size';
  readonly maxSize: number; // bytes
  readonly maxEntries: number;
  readonly backgroundCleanup: boolean;
}

// ============================================================================
// ANALYTICS & MONITORING
// ============================================================================

export interface AIUsageAnalytics {
  readonly period: AnalyticsPeriod;
  readonly totalRequests: number;
  readonly successfulRequests: number;
  readonly failedRequests: number;
  readonly averageResponseTime: number;
  readonly totalTokensUsed: number;
  readonly costEstimate: number;
  readonly categoryBreakdown: Record<PromptCategory, UsageCategoryStats>;
  readonly qualityMetrics: QualityMetrics;
}

export interface AnalyticsPeriod {
  readonly startTime: Timestamp;
  readonly endTime: Timestamp;
  readonly duration: number; // minutes
}

export interface UsageCategoryStats {
  readonly requests: number;
  readonly tokens: number;
  readonly averageResponseTime: number;
  readonly successRate: number;
  readonly userSatisfaction: number;
}

export interface QualityMetrics {
  readonly averageConfidence: number;
  readonly validationSuccessRate: number;
  readonly userAcceptanceRate: number;
  readonly contentRelevanceScore: number;
  readonly creativityIndex: number;
}

export interface AIPerformanceMetrics {
  readonly responseTime: ResponseTimeMetrics;
  readonly throughput: ThroughputMetrics;
  readonly reliability: ReliabilityMetrics;
  readonly resourceUsage: ResourceUsageMetrics;
}

export interface ResponseTimeMetrics {
  readonly average: number;
  readonly median: number;
  readonly p95: number;
  readonly p99: number;
  readonly slowestRequests: SlowRequestInfo[];
}

export interface ThroughputMetrics {
  readonly requestsPerSecond: number;
  readonly peakRequestsPerSecond: number;
  readonly concurrentRequests: number;
  readonly maxConcurrentRequests: number;
}

export interface ReliabilityMetrics {
  readonly uptime: number; // percentage
  readonly errorRate: number; // percentage
  readonly retryRate: number; // percentage
  readonly cachehitRate: number; // percentage
}

export interface ResourceUsageMetrics {
  readonly tokenUsageRate: number;
  readonly costPerRequest: number;
  readonly cacheMemoryUsage: number; // bytes
  readonly networkBandwidth: number; // bytes/second
}

export interface SlowRequestInfo {
  readonly requestId: UUID;
  readonly responseTime: number;
  readonly promptCategory: PromptCategory;
  readonly timestamp: Timestamp;
  readonly reason?: string;
}

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

export const AIModelSchema = z.enum([
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307',
]);

export const PromptTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  category: z.enum([
    'world_generation',
    'character_creation',
    'narrative_continuation',
    'role_generation',
    'clue_creation',
    'dialogue_generation',
    'event_creation',
    'npc_behavior',
    'description_enhancement',
    'rule_interpretation',
    'balance_analysis',
  ]),
  gameType: z.enum(['core', 'rpg', 'deduction', 'village']),
  template: z.string().min(10),
  variables: z.array(z.any()),
  constraints: z.array(z.any()),
  metadata: z.any(),
});

export const AIRequestSchema = z.object({
  id: UUIDSchema,
  promptId: z.string(),
  gameId: UUIDSchema,
  playerId: UUIDSchema.optional(),
  parameters: z.record(JSONValueSchema),
  context: z.object({
    gameType: z.enum(['rpg', 'deduction', 'village']),
    gameState: z.record(JSONValueSchema),
    playerHistory: z.array(z.any()),
    recentEvents: z.array(z.any()),
    systemFlags: z.record(z.boolean()),
    culturalPreferences: z.any().optional(),
  }),
  timestamp: TimestampSchema,
  priority: z.enum(['low', 'normal', 'high', 'critical']),
  options: z.object({
    streaming: z.boolean(),
    cacheKey: z.string().optional(),
    timeout: z.number().min(1000).max(60000),
    maxRetries: z.number().min(0).max(5),
    fallbackPrompt: z.string().optional(),
  }),
});

export const AIResponseSchema = z.object({
  id: UUIDSchema,
  requestId: UUIDSchema,
  content: z.string(),
  structured: z
    .object({
      type: z.enum([
        'world',
        'character',
        'narrative',
        'role',
        'clue',
        'event',
        'npc',
        'dialogue',
      ]),
      data: z.record(JSONValueSchema),
      confidence: z.number().min(0).max(1),
      alternativeOptions: z.array(z.record(JSONValueSchema)).optional(),
    })
    .optional(),
  metadata: z.object({
    model: AIModelSchema,
    temperature: z.number().min(0).max(2),
    promptTokens: z.number().min(0),
    completionTokens: z.number().min(0),
    stopReason: z.enum(['max_tokens', 'end_turn', 'stop_sequence', 'tool_use']),
    finishReasonDetails: z.string().optional(),
    safety: z.object({
      flagged: z.boolean(),
      categories: z.array(z.any()),
      severity: z.enum(['none', 'low', 'medium', 'high']),
      action: z.enum(['allow', 'warn', 'block']),
    }),
  }),
  timestamp: TimestampSchema,
  processingTime: z.number().min(0),
  tokenUsage: z.object({
    prompt: z.number().min(0),
    completion: z.number().min(0),
    total: z.number().min(0),
    cached: z.number().min(0).optional(),
  }),
});
