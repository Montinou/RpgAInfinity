/**
 * Type definitions barrel export for RpgAInfinity
 * Provides clean imports for all type definitions
 */

// ============================================================================
// CORE TYPES
// ============================================================================
export type {
  UUID,
  Timestamp,
  JSONValue,
  GameEngine,
  GameConfig,
  GameType,
  Player,
  Game,
  GameState,
  GameStatus,
  GamePhase,
  GameAction,
  ActionType,
  ActionResult,
  GameEvent,
  GameEventType,
  EventHandler,
  IGameError,
  SideEffect,
  SideEffectType,
} from './core';

// Export ErrorCode separately as it's a type
export { type ErrorCode } from './core';

export {
  UUIDSchema,
  TimestampSchema,
  JSONValueSchema,
  GameConfigSchema,
  PlayerSchema,
  GameSchema,
  GameStateSchema,
  GameActionSchema,
  ActionResultSchema,
  GameEventSchema,
  GameErrorSchema,
  GameError,
  SideEffectSchema,
  validateWith,
  createValidator,
  isPlayer,
  isGame,
  isGameState,
  isGameAction,
  isGameEvent,
  isGameError,
} from './core';

// ============================================================================
// RPG TYPES
// ============================================================================
export type {
  RPGConfig,
  WorldData,
  Location,
  LocationType,
  LocationFeature,
  RPGPlayer,
  Character,
  CharacterStats,
  CharacterSkills,
  CharacterRace,
  CharacterClass,
  CharacterTrait,
  CharacterBackground,
  Inventory,
  InventoryItem,
  Item,
  ItemType,
  ItemRarity,
  Equipment,
  ItemProperties,
  ItemRequirements,
  ItemEffect,
  CombatSession,
  CombatParticipant,
  CombatPosition,
  CombatEnvironment,
  CombatAction,
  CombatActionType,
  Quest,
  QuestType,
  QuestStatus,
  QuestObjective,
  QuestReward,
  NPC,
  NPCPersonality,
  NPCBehavior,
  ScheduleEntry,
  NPCDialogue,
  DialogueOption,
  DialogueTree,
  RPGGameState,
  RPGPhase,
  WeatherCondition,
  StatusEffect,
  RacialAbility,
  ClassAbility,
  EnvironmentModifier,
  EnvironmentHazard,
  CombatLogEntry,
  Faction,
  WorldEvent,
  Secret,
  NPCShop,
  DialogueCondition,
  DialogueEffect,
  QuestPrerequisite,
} from './rpg';

export {
  RPGConfigSchema,
  CharacterStatsSchema,
  CharacterSkillsSchema,
  CharacterSchema,
  CombatActionSchema,
} from './rpg';

// ============================================================================
// DEDUCTION TYPES
// ============================================================================
export type {
  DeductionConfig,
  DeductionScenario,
  ScenarioData,
  FlavorText,
  CustomRule,
  DifficultyModifier,
  RoleAlignment,
  RoleType,
  RoleDefinition,
  RoleAbility,
  AbilityType,
  AbilityTiming,
  TargetType,
  UsageLimit,
  AbilityEffect,
  AbilityCondition,
  RoleRestriction,
  DeductionPlayer,
  AssignedRole,
  ActiveAbility,
  RoleObjective,
  PlayerStatus,
  DeductionPhase,
  DeductionGameState,
  GamePhaseEvent,
  VotingResults,
  Vote,
  TiebreakResult,
  VotingAction,
  NightAction,
  NightActionResult,
  NightActionSchema,
  ClueCard,
  ClueType,
  ClueRevealCondition,
  Communication,
  CommunicationType,
  CommunicationAction,
  WinCondition,
  WinRequirement,
  DeductionAction,
  DeductionActionType,
  AccusationAction,
  GameStatistics,
  PlayerGameStats,
  RoleBalanceStats,
  VotingPattern,
  AbilityUsageStats,
  CommunicationStats,
} from './deduction';

export {
  DeductionConfigSchema,
  RoleDefinitionSchema,
  VotingActionSchema,
  CommunicationActionSchema,
  AccusationActionSchema,
} from './deduction';

// ============================================================================
// VILLAGE TYPES
// ============================================================================
export type {
  VillageConfig,
  BiomeType,
  ResourceType,
  ResourcePool,
  ResourceTransaction,
  ResourceBuilding,
  BuildingType,
  BuildingStatus,
  BuildingRequirement,
  UpgradeOption,
  VillagePopulation,
  VillageNPC,
  NPCOccupation,
  NPCSkills,
  NPCTrait,
  NPCStatus,
  NPCNeeds,
  NPCSchedule,
  NPCHistoryEvent,
  TerrainType,
  Position2D,
  VillageMap,
  TerrainTile,
  Road,
  NaturalFeature,
  ResourceNode,
  TerrainModifier,
  Season,
  Weather,
  TimeSystem,
  VillageTime,
  WeatherSystem,
  WeatherPattern,
  WeatherEffect,
  VillageEvent,
  EventType,
  EventSeverity,
  EventRequirement,
  EventEffect,
  EventChoice,
  TechnologyTree,
  Technology,
  TechCategory,
  TechRequirement,
  TechEffect,
  VillageGameState,
  VillagePhase,
  VillageData,
  CultureAspect,
  VillageAction,
  VillageActionType,
  ConstructionAction,
  WorkerAssignmentAction,
  TradeAction,
  ResearchAction,
  PolicyAction,
  PolicyType,
  VillageStatistics,
  PerformanceMetrics,
} from './village';

export {
  NPCBehaviorSchema,
  ResourceEventSchema,
  VillageEventSchema,
} from './village';

// ============================================================================
// AI TYPES
// ============================================================================
export type {
  AIServiceConfig,
  AIModel,
  RateLimit,
  CacheConfig,
  RetryConfig,
  PromptTemplate,
  PromptCategory,
  PromptVariable,
  PromptValidation,
  PromptConstraint,
  PromptMetadata,
  PromptUsageStats,
  AIRequest,
  RequestPriority,
  AIRequestOptions,
  AIContext,
  PlayerContextEntry,
  ContextualEvent,
  CulturalContext,
  AIResponse,
  StructuredAIResponse,
  AIResponseMetadata,
  TokenUsage,
  SafetyAnalysis,
  SafetyCategory,
  WorldGenerationRequest,
  CharacterGenerationRequest,
  NarrativeGenerationRequest,
  RoleGenerationRequest,
  EventGenerationRequest,
  ContentProcessor,
  ValidationRule,
  TransformationRule,
  ProcessingResult,
  ValidationError,
  ValidationWarning,
  ProcessingMetadata,
  CacheEntry,
  CacheStrategy,
  KeyGenerationRule,
  TTLStrategy,
  EvictionPolicy,
  AIUsageAnalytics,
  AnalyticsPeriod,
  UsageCategoryStats,
  QualityMetrics,
  AIPerformanceMetrics,
  ResponseTimeMetrics,
  ThroughputMetrics,
  ReliabilityMetrics,
  ResourceUsageMetrics,
  SlowRequestInfo,
} from './ai';

export {
  AIModelSchema,
  PromptTemplateSchema,
  AIRequestSchema,
  AIResponseSchema,
} from './ai';

// ============================================================================
// API RESPONSE TYPES
// ============================================================================
export type {
  APIResponse,
  APIError,
  APIErrorCode,
  APIMetadata,
  RateLimitInfo,
  PaginationInfo,
  CacheInfo,
  GameCreateResponse,
  GameJoinResponse,
  GameStateResponse,
  GameActionResponse,
  GameListResponse,
  AIGenerationResponse,
  AIStreamResponse,
  PromptTemplateResponse,
  WorldGenerationResponse,
  CharacterGenerationResponse,
  CombatActionResponse,
  RoleAssignmentResponse,
  VotingResponse,
  VotingResultsResponse,
  ClueRevealResponse,
  VillageStatusResponse,
  BuildingConstructionResponse,
  ResourceTradeResponse,
  EventResponse,
  GameStatisticsResponse,
  AnalyticsResponse,
} from './api';

export {
  APIErrorSchema,
  APIMetadataSchema,
  APIResponseSchema,
  createSuccessResponse,
  createErrorResponse,
  isSuccessResponse,
  isErrorResponse,
} from './api';

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================
export type {
  AppConfig,
  AppSettings,
  Environment,
  CORSSettings,
  RateLimitSettings,
  LoggingConfig,
  LogLevel,
  LogOutput,
  DatabaseConfig,
  VercelKVConfig,
  VercelBlobConfig,
  AIServiceSettings,
  AnthropicConfig,
  AICacheConfig,
  AIRateLimitConfig,
  AISafetyConfig,
  AIMonitoringConfig,
  AuthConfig,
  AuthProvider,
  SessionConfig,
  JWTConfig,
  OAuthConfig,
  AuthSecurityConfig,
  PasswordPolicy,
  CacheSettings,
  CacheProvider,
  MonitoringConfig,
  AnalyticsConfig,
  TelemetryConfig,
  HealthCheckConfig,
  HealthCheck,
  AlertConfig,
  AlertChannel,
  AlertRule,
  AlertThrottling,
  FeatureFlags,
  GameFeatureFlags,
  AIFeatureFlags,
  SocialFeatureFlags,
  MonetizationFeatureFlags,
  ExperimentalFeatureFlags,
  SecurityConfig,
  CORSSecurityConfig,
  SecurityHeaders,
  ValidationConfig,
  EncryptionConfig,
  AuditConfig,
  GameSystemConfig,
  RPGSystemConfig,
  DeductionSystemConfig,
  VillageSystemConfig,
} from './config';

export {
  EnvironmentSchema,
  ConfigSchema,
  loadEnvironmentConfig,
  validateConfig,
  getFeatureFlag,
  isProduction,
  isDevelopment,
  isFeatureEnabled,
} from './config';

// ============================================================================
// KV STORAGE TYPES AND CONSTANTS
// ============================================================================

/**
 * Result type for KV operations
 */
export interface KVResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

/**
 * Pagination parameters
 */
export interface Pagination {
  limit: number;
  offset: number;
  cursor?: string;
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
    nextCursor?: string;
  };
}

/**
 * Game session type
 */
export interface GameSession {
  id: string;
  gameId: string;
  gameType: GameType;
  players: Array<{ playerId: string; joinedAt: Date }>;
  status: 'waiting' | 'active' | 'completed' | 'cancelled';
  createdAt: Date;
  startedAt?: Date;
  updatedAt: Date;
  endedAt?: Date;
  expiresAt: Date;
  eventHistory: GameEvent[];
  metadata?: Record<string, any>;
}

/**
 * AI cache entry
 */
export interface AICacheEntry {
  key: string;
  value: any;
  createdAt: Date;
  expiresAt: Date;
  hitCount: number;
  lastAccessed: Date;
}

/**
 * Asset reference
 */
export interface AssetReference {
  id: string;
  type: 'image' | 'audio' | 'video' | 'document';
  url: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

/**
 * AI generation request base
 */
export interface AIGenerationRequest {
  id: string;
  type: string;
  prompt: string;
  parameters?: Record<string, any>;
  timestamp: Date;
}

/**
 * AI generation response base
 */
export interface AIGenerationResponse {
  id: string;
  requestId: string;
  content: any;
  metadata?: Record<string, any>;
  timestamp: Date;
}

/**
 * Serializable type helper for date conversion
 */
export type Serializable<T> = {
  [K in keyof T]: T[K] extends Date
    ? string
    : T[K] extends Date | undefined
      ? string | undefined
      : T[K] extends Array<infer U>
        ? Array<Serializable<U>>
        : T[K] extends object | undefined
          ? Serializable<T[K]>
          : T[K];
};

// ============================================================================
// KV STORAGE CONSTANTS
// ============================================================================

/**
 * Key patterns for Vercel KV storage
 */
export const KV_KEY_PATTERNS = {
  PLAYER: (playerId: string) => `player:${playerId}`,
  SESSION: (sessionId: string) => `session:${sessionId}`,
  GAME_STATE: (sessionId: string) => `game:${sessionId}:state`,
  ACTIVE_SESSIONS: (gameType: string) => `sessions:active:${gameType}`,
  PLAYER_SESSIONS: (playerId: string) => `player:${playerId}:sessions`,
  AI_CACHE: (hash: string) => `ai:cache:${hash}`,
  RATE_LIMIT: (key: string) => `ratelimit:${key}`,
  ASSET: (assetId: string) => `asset:${assetId}`,
  ASSET_INDEX: (type: string) => `assets:index:${type}`,
} as const;

/**
 * TTL values in seconds for different cache types
 */
export const TTL = {
  SESSION_ACTIVE: 3600, // 1 hour for active sessions
  SESSION_COMPLETED: 86400, // 24 hours for completed sessions
  PLAYER_SESSION: 7200, // 2 hours for player session data
  AI_CACHE_HOT: 1800, // 30 minutes for frequently accessed AI cache
  AI_CACHE_COLD: 86400, // 24 hours for less frequently accessed AI cache
} as const;

// ============================================================================
// UTILITY TYPE EXPORTS
// ============================================================================

/**
 * Union of all game-specific configurations
 */
export type AnyGameConfig = RPGConfig | DeductionConfig | VillageConfig;

/**
 * Union of all game-specific states
 */
export type AnyGameState = RPGGameState | DeductionGameState | VillageGameState;

/**
 * Union of all game-specific players
 */
export type AnyGamePlayer = RPGPlayer | DeductionPlayer | Player;

/**
 * Union of all game-specific actions
 */
export type AnyGameAction =
  | CombatAction
  | VotingAction
  | CommunicationAction
  | AccusationAction
  | ConstructionAction
  | WorkerAssignmentAction
  | TradeAction
  | ResearchAction
  | PolicyAction;

/**
 * Union of all AI generation requests
 */
export type AnyAIGenerationRequest =
  | WorldGenerationRequest
  | CharacterGenerationRequest
  | NarrativeGenerationRequest
  | RoleGenerationRequest
  | EventGenerationRequest;

// ============================================================================
// TYPE HELPERS & UTILITIES
// ============================================================================

/**
 * Extract the game type from a game configuration
 */
export type ExtractGameType<T extends AnyGameConfig> = T['type'];

/**
 * Type guard to check if a config is for a specific game type
 */
export function isGameType<T extends GameType>(
  config: AnyGameConfig,
  type: T
): config is Extract<AnyGameConfig, { type: T }> {
  return config.type === type;
}

/**
 * Type-safe game config validator
 */
export function validateGameConfig<T extends AnyGameConfig>(
  config: unknown,
  type: T['type']
): config is T {
  if (typeof config !== 'object' || config === null) return false;
  const gameConfig = config as { type?: unknown };
  return gameConfig.type === type;
}

/**
 * Helper to create type-safe game actions
 */
export function createGameAction<T extends AnyGameAction>(
  baseAction: Omit<T, 'id' | 'timestamp'>,
  id: UUID = crypto.randomUUID(),
  timestamp: Timestamp = new Date()
): T {
  return {
    ...baseAction,
    id,
    timestamp,
  } as T;
}

/**
 * Helper to create AI requests with proper typing
 */
export function createAIRequest<T extends AnyAIGenerationRequest>(
  baseRequest: Omit<T, 'id' | 'timestamp'>,
  id: UUID = crypto.randomUUID(),
  timestamp: Timestamp = new Date()
): T {
  return {
    ...baseRequest,
    id,
    timestamp,
  } as T;
}

// ============================================================================
// RE-EXPORT COMMON VALIDATION UTILITIES
// ============================================================================
// validateWith and createValidator already exported above from './core'
