/**
 * Configuration type definitions for RpgAInfinity
 * Application settings, environment variables, and runtime configuration
 */

import { z } from 'zod';

// ============================================================================
// APPLICATION CONFIGURATION
// ============================================================================

export interface AppConfig {
  readonly app: AppSettings;
  readonly database: DatabaseConfig;
  readonly ai: AIServiceSettings;
  readonly auth: AuthConfig;
  readonly cache: CacheSettings;
  readonly monitoring: MonitoringConfig;
  readonly features: FeatureFlags;
  readonly security: SecurityConfig;
}

export interface AppSettings {
  readonly name: string;
  readonly version: string;
  readonly environment: Environment;
  readonly baseUrl: string;
  readonly port: number;
  readonly cors: CORSSettings;
  readonly rateLimit: RateLimitSettings;
  readonly logging: LoggingConfig;
}

export type Environment = 'development' | 'staging' | 'production' | 'test';

export interface CORSSettings {
  readonly enabled: boolean;
  readonly origins: string[];
  readonly credentials: boolean;
  readonly methods: string[];
  readonly headers: string[];
}

export interface RateLimitSettings {
  readonly enabled: boolean;
  readonly windowMs: number;
  readonly maxRequests: number;
  readonly skipSuccessfulRequests: boolean;
  readonly keyGenerator: 'ip' | 'user' | 'session';
}

export interface LoggingConfig {
  readonly level: LogLevel;
  readonly format: 'json' | 'pretty' | 'simple';
  readonly outputs: LogOutput[];
  readonly enableRequestLogging: boolean;
  readonly enableErrorTracking: boolean;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type LogOutput = 'console' | 'file' | 'external';

// ============================================================================
// DATABASE CONFIGURATION
// ============================================================================

export interface DatabaseConfig {
  readonly kv: VercelKVConfig;
  readonly blob: VercelBlobConfig;
  readonly connectionTimeout: number;
  readonly operationTimeout: number;
  readonly retries: RetryConfig;
}

export interface VercelKVConfig {
  readonly url: string;
  readonly token: string;
  readonly namespace?: string;
  readonly keyPrefix: string;
  readonly compression: boolean;
  readonly serialization: 'json' | 'msgpack';
}

export interface VercelBlobConfig {
  readonly token: string;
  readonly baseUrl?: string;
  readonly maxFileSize: number;
  readonly allowedMimeTypes: string[];
  readonly enablePublicAccess: boolean;
}

export interface RetryConfig {
  readonly maxAttempts: number;
  readonly baseDelay: number;
  readonly maxDelay: number;
  readonly backoffMultiplier: number;
  readonly retryableErrors: string[];
}

// ============================================================================
// AI SERVICE CONFIGURATION
// ============================================================================

export interface AIServiceSettings {
  readonly anthropic: AnthropicConfig;
  readonly caching: AICacheConfig;
  readonly rateLimit: AIRateLimitConfig;
  readonly safety: AISafetyConfig;
  readonly monitoring: AIMonitoringConfig;
}

export interface AnthropicConfig {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly defaultModel: string;
  readonly maxTokens: number;
  readonly temperature: number;
  readonly topP?: number;
  readonly topK?: number;
  readonly timeout: number;
}

export interface AICacheConfig {
  readonly enabled: boolean;
  readonly provider: 'memory' | 'redis' | 'vercel-kv';
  readonly defaultTTL: number;
  readonly maxSize: number;
  readonly keyPattern: string;
  readonly compression: boolean;
}

export interface AIRateLimitConfig {
  readonly enabled: boolean;
  readonly requestsPerMinute: number;
  readonly tokensPerMinute: number;
  readonly burstLimit: number;
  readonly queueSize: number;
  readonly backpressureThreshold: number;
}

export interface AISafetyConfig {
  readonly contentFiltering: boolean;
  readonly harmDetection: boolean;
  readonly toxicityThreshold: number;
  readonly biasDetection: boolean;
  readonly outputValidation: boolean;
  readonly blockedPatterns: string[];
}

export interface AIMonitoringConfig {
  readonly enabled: boolean;
  readonly logRequests: boolean;
  readonly logResponses: boolean;
  readonly trackTokenUsage: boolean;
  readonly trackLatency: boolean;
  readonly alertThresholds: {
    readonly errorRate: number;
    readonly avgLatency: number;
    readonly tokenUsageRate: number;
  };
}

// ============================================================================
// AUTHENTICATION CONFIGURATION
// ============================================================================

export interface AuthConfig {
  readonly enabled: boolean;
  readonly providers: AuthProvider[];
  readonly session: SessionConfig;
  readonly jwt: JWTConfig;
  readonly oauth: OAuthConfig;
  readonly security: AuthSecurityConfig;
}

export interface AuthProvider {
  readonly name: string;
  readonly type: 'oauth' | 'credentials' | 'magic-link' | 'anonymous';
  readonly enabled: boolean;
  readonly config: Record<string, string>;
}

export interface SessionConfig {
  readonly strategy: 'jwt' | 'database';
  readonly maxAge: number;
  readonly updateAge: number;
  readonly secureCookies: boolean;
  readonly cookieName: string;
}

export interface JWTConfig {
  readonly secret: string;
  readonly algorithm: 'HS256' | 'RS256';
  readonly issuer: string;
  readonly audience: string;
  readonly expiresIn: string;
}

export interface OAuthConfig {
  readonly redirectUrl: string;
  readonly allowedDomains: string[];
  readonly scopes: Record<string, string[]>;
}

export interface AuthSecurityConfig {
  readonly bcryptRounds: number;
  readonly maxLoginAttempts: number;
  readonly lockoutDuration: number;
  readonly requireEmailVerification: boolean;
  readonly passwordPolicy: PasswordPolicy;
}

export interface PasswordPolicy {
  readonly minLength: number;
  readonly requireUppercase: boolean;
  readonly requireLowercase: boolean;
  readonly requireNumbers: boolean;
  readonly requireSymbols: boolean;
  readonly maxAge: number; // days
}

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

export interface CacheSettings {
  readonly provider: CacheProvider;
  readonly defaultTTL: number;
  readonly maxMemory: number;
  readonly compression: boolean;
  readonly serialization: 'json' | 'msgpack';
  readonly strategies: CacheStrategy[];
}

export type CacheProvider = 'memory' | 'redis' | 'vercel-kv' | 'hybrid';

export interface CacheStrategy {
  readonly name: string;
  readonly pattern: string;
  readonly ttl: number;
  readonly staleWhileRevalidate: boolean;
  readonly tags: string[];
}

// ============================================================================
// MONITORING CONFIGURATION
// ============================================================================

export interface MonitoringConfig {
  readonly enabled: boolean;
  readonly analytics: AnalyticsConfig;
  readonly telemetry: TelemetryConfig;
  readonly healthChecks: HealthCheckConfig;
  readonly alerts: AlertConfig;
}

export interface AnalyticsConfig {
  readonly provider: 'vercel' | 'google' | 'custom' | 'none';
  readonly trackPageViews: boolean;
  readonly trackEvents: boolean;
  readonly trackPerformance: boolean;
  readonly trackErrors: boolean;
  readonly samplingRate: number;
}

export interface TelemetryConfig {
  readonly enabled: boolean;
  readonly endpoint?: string;
  readonly serviceName: string;
  readonly serviceVersion: string;
  readonly tracesSampleRate: number;
  readonly metricsEnabled: boolean;
}

export interface HealthCheckConfig {
  readonly enabled: boolean;
  readonly endpoint: string;
  readonly interval: number;
  readonly timeout: number;
  readonly checks: HealthCheck[];
}

export interface HealthCheck {
  readonly name: string;
  readonly type: 'database' | 'external-api' | 'memory' | 'disk' | 'custom';
  readonly config: Record<string, any>;
  readonly critical: boolean;
}

export interface AlertConfig {
  readonly enabled: boolean;
  readonly channels: AlertChannel[];
  readonly rules: AlertRule[];
  readonly throttling: AlertThrottling;
}

export interface AlertChannel {
  readonly name: string;
  readonly type: 'email' | 'slack' | 'webhook' | 'sms';
  readonly config: Record<string, any>;
  readonly enabled: boolean;
}

export interface AlertRule {
  readonly name: string;
  readonly condition: string;
  readonly threshold: number;
  readonly duration: number;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly channels: string[];
}

export interface AlertThrottling {
  readonly enabled: boolean;
  readonly windowSize: number;
  readonly maxAlertsPerWindow: number;
}

// ============================================================================
// FEATURE FLAGS
// ============================================================================

export interface FeatureFlags {
  readonly games: GameFeatureFlags;
  readonly ai: AIFeatureFlags;
  readonly social: SocialFeatureFlags;
  readonly monetization: MonetizationFeatureFlags;
  readonly experimental: ExperimentalFeatureFlags;
}

export interface GameFeatureFlags {
  readonly rpgGame: boolean;
  readonly deductionGame: boolean;
  readonly villageGame: boolean;
  readonly multiplayerMode: boolean;
  readonly realtimeUpdates: boolean;
  readonly gameRecording: boolean;
  readonly spectatorMode: boolean;
}

export interface AIFeatureFlags {
  readonly worldGeneration: boolean;
  readonly characterGeneration: boolean;
  readonly narrativeGeneration: boolean;
  readonly voiceGeneration: boolean;
  readonly imageGeneration: boolean;
  readonly advancedPrompting: boolean;
  readonly caching: boolean;
}

export interface SocialFeatureFlags {
  readonly userProfiles: boolean;
  readonly friendSystem: boolean;
  readonly chat: boolean;
  readonly guilds: boolean;
  readonly leaderboards: boolean;
  readonly achievements: boolean;
  readonly userGeneratedContent: boolean;
}

export interface MonetizationFeatureFlags {
  readonly premiumFeatures: boolean;
  readonly subscriptions: boolean;
  readonly marketplace: boolean;
  readonly advertising: boolean;
  readonly analytics: boolean;
}

export interface ExperimentalFeatureFlags {
  readonly betaFeatures: boolean;
  readonly advancedAI: boolean;
  readonly newGameModes: boolean;
  readonly performanceOptimizations: boolean;
  readonly mobileApp: boolean;
}

// ============================================================================
// SECURITY CONFIGURATION
// ============================================================================

export interface SecurityConfig {
  readonly cors: CORSSecurityConfig;
  readonly headers: SecurityHeaders;
  readonly validation: ValidationConfig;
  readonly encryption: EncryptionConfig;
  readonly audit: AuditConfig;
}

export interface CORSSecurityConfig extends CORSSettings {
  readonly maxAge: number;
  readonly strictMode: boolean;
}

export interface SecurityHeaders {
  readonly contentSecurityPolicy: string;
  readonly strictTransportSecurity: string;
  readonly xFrameOptions: string;
  readonly xContentTypeOptions: string;
  readonly referrerPolicy: string;
  readonly permissionsPolicy: string;
}

export interface ValidationConfig {
  readonly strictMode: boolean;
  readonly maxPayloadSize: number;
  readonly allowUnknownFields: boolean;
  readonly sanitizeInputs: boolean;
  readonly validateSchemas: boolean;
}

export interface EncryptionConfig {
  readonly algorithm: string;
  readonly keySize: number;
  readonly saltRounds: number;
  readonly encryptSensitiveData: boolean;
  readonly keyRotationInterval: number;
}

export interface AuditConfig {
  readonly enabled: boolean;
  readonly logLevel: 'minimal' | 'standard' | 'detailed';
  readonly retention: number; // days
  readonly sensitiveDataMasking: boolean;
  readonly realTimeAlerts: boolean;
}

// ============================================================================
// GAME-SPECIFIC CONFIGURATIONS
// ============================================================================

export interface GameSystemConfig {
  readonly defaultSettings: {
    readonly maxConcurrentGames: number;
    readonly gameTimeout: number;
    readonly maxPlayersPerGame: number;
    readonly autoSaveInterval: number;
  };
  readonly rpg: RPGSystemConfig;
  readonly deduction: DeductionSystemConfig;
  readonly village: VillageSystemConfig;
}

export interface RPGSystemConfig {
  readonly maxLevel: number;
  readonly experienceMultiplier: number;
  readonly combatBalancing: boolean;
  readonly narrativeComplexity: 'simple' | 'moderate' | 'complex';
  readonly worldGenerationDepth: number;
}

export interface DeductionSystemConfig {
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly defaultGameDuration: number;
  readonly roleBalancing: boolean;
  readonly clueGenerationRate: number;
}

export interface VillageSystemConfig {
  readonly simulationSpeed: number;
  readonly maxVillageSize: number;
  readonly resourceBalancing: boolean;
  readonly eventFrequency: number;
  readonly aiNpcBehavior: boolean;
}

// ============================================================================
// ENVIRONMENT VARIABLE SCHEMAS
// ============================================================================

export const EnvironmentSchema = z.object({
  // App
  NODE_ENV: z
    .enum(['development', 'staging', 'production', 'test'])
    .default('development'),
  PORT: z.string().transform(Number).default(3000),

  // Database
  KV_URL: z.string(),
  KV_REST_API_URL: z.string(),
  KV_REST_API_TOKEN: z.string(),
  BLOB_READ_WRITE_TOKEN: z.string(),

  // AI
  ANTHROPIC_API_KEY: z.string(),

  // Auth (Optional)
  NEXTAUTH_SECRET: z.string().optional(),
  NEXTAUTH_URL: z.string().url().optional(),

  // Monitoring (Optional)
  VERCEL_ANALYTICS_ID: z.string().optional(),

  // Feature Flags
  ENABLE_RPG_GAME: z.string().transform(Boolean).default(true),
  ENABLE_DEDUCTION_GAME: z.string().transform(Boolean).default(true),
  ENABLE_VILLAGE_GAME: z.string().transform(Boolean).default(true),
  ENABLE_AI_GENERATION: z.string().transform(Boolean).default(true),
});

export const ConfigSchema = z.object({
  app: z.object({
    name: z.string(),
    version: z.string(),
    environment: z.enum(['development', 'staging', 'production', 'test']),
    baseUrl: z.string().url(),
    port: z.number().int().min(1).max(65535),
    cors: z.object({
      enabled: z.boolean(),
      origins: z.array(z.string()),
      credentials: z.boolean(),
      methods: z.array(z.string()),
      headers: z.array(z.string()),
    }),
    rateLimit: z.object({
      enabled: z.boolean(),
      windowMs: z.number().min(1000),
      maxRequests: z.number().min(1),
      skipSuccessfulRequests: z.boolean(),
      keyGenerator: z.enum(['ip', 'user', 'session']),
    }),
    logging: z.object({
      level: z.enum(['debug', 'info', 'warn', 'error', 'fatal']),
      format: z.enum(['json', 'pretty', 'simple']),
      outputs: z.array(z.enum(['console', 'file', 'external'])),
      enableRequestLogging: z.boolean(),
      enableErrorTracking: z.boolean(),
    }),
  }),
  features: z.object({
    games: z.object({
      rpgGame: z.boolean(),
      deductionGame: z.boolean(),
      villageGame: z.boolean(),
      multiplayerMode: z.boolean(),
      realtimeUpdates: z.boolean(),
      gameRecording: z.boolean(),
      spectatorMode: z.boolean(),
    }),
    ai: z.object({
      worldGeneration: z.boolean(),
      characterGeneration: z.boolean(),
      narrativeGeneration: z.boolean(),
      voiceGeneration: z.boolean(),
      imageGeneration: z.boolean(),
      advancedPrompting: z.boolean(),
      caching: z.boolean(),
    }),
  }),
});

// ============================================================================
// CONFIGURATION UTILITIES
// ============================================================================

/**
 * Load configuration from environment variables
 */
export function loadEnvironmentConfig(): Record<string, any> {
  return EnvironmentSchema.parse(process.env);
}

/**
 * Validate configuration object
 */
export function validateConfig(config: unknown): AppConfig {
  return ConfigSchema.parse(config) as AppConfig;
}

/**
 * Get feature flag value with fallback
 */
export function getFeatureFlag(
  config: FeatureFlags,
  path: string,
  defaultValue: boolean = false
): boolean {
  const keys = path.split('.');
  let current: any = config;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return defaultValue;
    }
  }

  return typeof current === 'boolean' ? current : defaultValue;
}

/**
 * Check if environment is production
 */
export function isProduction(env: Environment): boolean {
  return env === 'production';
}

/**
 * Check if environment is development
 */
export function isDevelopment(env: Environment): boolean {
  return env === 'development';
}

/**
 * Check if feature is enabled
 */
export function isFeatureEnabled(
  flags: FeatureFlags,
  feature:
    | keyof GameFeatureFlags
    | keyof AIFeatureFlags
    | keyof SocialFeatureFlags
): boolean {
  if (feature in flags.games) {
    return flags.games[feature as keyof GameFeatureFlags];
  }
  if (feature in flags.ai) {
    return flags.ai[feature as keyof AIFeatureFlags];
  }
  if (feature in flags.social) {
    return flags.social[feature as keyof SocialFeatureFlags];
  }
  return false;
}
