/**
 * API response type definitions for RpgAInfinity
 * Standardized API response formats for all endpoints
 */

import { z } from 'zod';
import {
  UUID,
  Timestamp,
  JSONValue,
  UUIDSchema,
  TimestampSchema,
  JSONValueSchema,
  ErrorCode,
} from './core';

// ============================================================================
// BASE API RESPONSE TYPES
// ============================================================================

export interface APIResponse<T = JSONValue> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: APIError;
  readonly metadata: APIMetadata;
}

export interface APIError {
  readonly code: ErrorCode | APIErrorCode;
  readonly message: string;
  readonly details?: Record<string, JSONValue>;
  readonly stack?: string; // Only in development
  readonly timestamp: Timestamp;
  readonly requestId: UUID;
  readonly path?: string;
}

export type APIErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'CONFLICT'
  | 'UNPROCESSABLE_ENTITY'
  | 'TOO_MANY_REQUESTS'
  | 'INTERNAL_SERVER_ERROR'
  | 'BAD_GATEWAY'
  | 'SERVICE_UNAVAILABLE';

export interface APIMetadata {
  readonly requestId: UUID;
  readonly timestamp: Timestamp;
  readonly version: string;
  readonly processingTime: number; // milliseconds
  readonly rateLimit?: RateLimitInfo;
  readonly pagination?: PaginationInfo;
  readonly cacheInfo?: CacheInfo;
}

export interface RateLimitInfo {
  readonly limit: number;
  readonly remaining: number;
  readonly reset: Timestamp;
  readonly retryAfter?: number; // seconds
}

export interface PaginationInfo {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasNext: boolean;
  readonly hasPrev: boolean;
}

export interface CacheInfo {
  readonly hit: boolean;
  readonly key: string;
  readonly ttl: number; // seconds remaining
  readonly generatedAt: Timestamp;
}

// ============================================================================
// GAME API RESPONSES
// ============================================================================

export interface GameCreateResponse
  extends APIResponse<{
    readonly game: {
      readonly id: UUID;
      readonly config: Record<string, JSONValue>;
      readonly status: string;
      readonly joinCode?: string;
      readonly playerLimit: number;
      readonly createdAt: Timestamp;
    };
  }> {}

export interface GameJoinResponse
  extends APIResponse<{
    readonly gameId: UUID;
    readonly playerId: UUID;
    readonly playerName: string;
    readonly gameState: Record<string, JSONValue>;
    readonly playerData: Record<string, JSONValue>;
    readonly isGameStarted: boolean;
  }> {}

export interface GameStateResponse
  extends APIResponse<{
    readonly gameId: UUID;
    readonly state: Record<string, JSONValue>;
    readonly phase: string;
    readonly currentPlayer?: UUID;
    readonly players: Array<{
      readonly id: UUID;
      readonly name: string;
      readonly isActive: boolean;
      readonly publicData: Record<string, JSONValue>;
    }>;
    readonly lastUpdated: Timestamp;
    readonly version: number;
  }> {}

export interface GameActionResponse
  extends APIResponse<{
    readonly actionId: UUID;
    readonly gameId: UUID;
    readonly newState?: Record<string, JSONValue>;
    readonly events: Array<{
      readonly id: UUID;
      readonly type: string;
      readonly description: string;
      readonly affectedPlayers?: UUID[];
      readonly isPublic: boolean;
    }>;
    readonly sideEffects?: Array<{
      readonly type: string;
      readonly description: string;
      readonly executeAt?: Timestamp;
    }>;
  }> {}

export interface GameListResponse
  extends APIResponse<{
    readonly games: Array<{
      readonly id: UUID;
      readonly name: string;
      readonly type: string;
      readonly status: string;
      readonly playerCount: number;
      readonly maxPlayers: number;
      readonly isPrivate: boolean;
      readonly createdAt: Timestamp;
      readonly estimatedDuration: number;
    }>;
    readonly filters: {
      readonly type?: string;
      readonly status?: string;
      readonly availability?: 'joinable' | 'full' | 'all';
    };
  }> {}

// ============================================================================
// AI API RESPONSES
// ============================================================================

export interface AIGenerationResponse
  extends APIResponse<{
    readonly requestId: UUID;
    readonly content: string;
    readonly structured?: Record<string, JSONValue>;
    readonly alternatives?: string[];
    readonly confidence: number;
    readonly tokenUsage: {
      readonly prompt: number;
      readonly completion: number;
      readonly total: number;
    };
    readonly model: string;
    readonly processingTime: number;
    readonly cacheHit: boolean;
  }> {}

export interface AIStreamResponse {
  readonly requestId: UUID;
  readonly type: 'start' | 'content' | 'end' | 'error';
  readonly content?: string;
  readonly delta?: string;
  readonly metadata?: Record<string, JSONValue>;
  readonly error?: APIError;
}

export interface PromptTemplateResponse
  extends APIResponse<{
    readonly templates: Array<{
      readonly id: string;
      readonly name: string;
      readonly category: string;
      readonly gameType: string;
      readonly description: string;
      readonly variables: Array<{
        readonly name: string;
        readonly type: string;
        readonly required: boolean;
        readonly description: string;
      }>;
      readonly usage: {
        readonly timesUsed: number;
        readonly avgResponseTime: number;
        readonly successRate: number;
        readonly userRating: number;
      };
    }>;
  }> {}

// ============================================================================
// RPG-SPECIFIC API RESPONSES
// ============================================================================

export interface WorldGenerationResponse extends AIGenerationResponse {
  readonly data: {
    readonly content: string;
    readonly structured: {
      readonly world: {
        readonly name: string;
        readonly theme: string;
        readonly description: string;
        readonly locations: Array<{
          readonly name: string;
          readonly type: string;
          readonly description: string;
          readonly connections: string[];
        }>;
        readonly npcs: Array<{
          readonly name: string;
          readonly role: string;
          readonly personality: string;
          readonly location: string;
        }>;
        readonly lore: string;
        readonly questHooks: string[];
      };
    };
  };
}

export interface CharacterGenerationResponse extends AIGenerationResponse {
  readonly data: {
    readonly content: string;
    readonly structured: {
      readonly character: {
        readonly name: string;
        readonly race: string;
        readonly class: string;
        readonly background: string;
        readonly personality: string;
        readonly stats: Record<string, number>;
        readonly skills: Record<string, number>;
        readonly equipment: string[];
        readonly backstory: string;
      };
    };
  };
}

export interface CombatActionResponse
  extends APIResponse<{
    readonly combatId: UUID;
    readonly turn: number;
    readonly participant: UUID;
    readonly action: {
      readonly type: string;
      readonly target?: UUID;
      readonly result: string;
      readonly damage?: number;
      readonly effects: string[];
    };
    readonly newCombatState: {
      readonly participants: Array<{
        readonly id: UUID;
        readonly health: number;
        readonly status: string[];
        readonly position: { x: number; y: number; zone: string };
      }>;
      readonly currentTurn: number;
      readonly turnOrder: UUID[];
      readonly isEnded: boolean;
    };
  }> {}

// ============================================================================
// DEDUCTION-SPECIFIC API RESPONSES
// ============================================================================

export interface RoleAssignmentResponse
  extends APIResponse<{
    readonly gameId: UUID;
    readonly playerId: UUID;
    readonly role: {
      readonly name: string;
      readonly alignment: string;
      readonly description: string;
      readonly abilities: Array<{
        readonly name: string;
        readonly description: string;
        readonly timing: string;
      }>;
      readonly winCondition: string;
      readonly secretInfo: string[];
      readonly teammates?: UUID[];
    };
    readonly scenario: {
      readonly theme: string;
      readonly setting: string;
      readonly introduction: string;
    };
  }> {}

export interface VotingResponse
  extends APIResponse<{
    readonly voteId: UUID;
    readonly round: number;
    readonly voterId: UUID;
    readonly targetId: UUID | string;
    readonly voteCount: Record<UUID | string, number>;
    readonly timeRemaining: number;
    readonly canChangeVote: boolean;
    readonly votingPhase: 'active' | 'counting' | 'results';
  }> {}

export interface VotingResultsResponse
  extends APIResponse<{
    readonly round: number;
    readonly results: {
      readonly eliminated?: UUID;
      readonly votes: Array<{
        readonly target: UUID | string;
        readonly count: number;
        readonly percentage: number;
      }>;
      readonly tiebreaker?: {
        readonly method: string;
        readonly explanation: string;
      };
      readonly abstentions: number;
    };
    readonly nextPhase: string;
    readonly timeToNextPhase: number;
  }> {}

export interface ClueRevealResponse
  extends APIResponse<{
    readonly clueId: UUID;
    readonly title: string;
    readonly content: string;
    readonly type: string;
    readonly reliability: string;
    readonly affectedPlayers?: UUID[];
    readonly revealedBy?: UUID;
    readonly round: number;
  }> {}

// ============================================================================
// VILLAGE-SPECIFIC API RESPONSES
// ============================================================================

export interface VillageStatusResponse
  extends APIResponse<{
    readonly villageId: UUID;
    readonly name: string;
    readonly population: {
      readonly total: number;
      readonly adults: number;
      readonly children: number;
      readonly happiness: number;
      readonly health: number;
    };
    readonly resources: Record<
      string,
      {
        readonly current: number;
        readonly capacity: number;
        readonly production: number;
        readonly consumption: number;
      }
    >;
    readonly buildings: Array<{
      readonly id: UUID;
      readonly type: string;
      readonly level: number;
      readonly status: string;
      readonly efficiency: number;
    }>;
    readonly time: {
      readonly hour: number;
      readonly day: number;
      readonly season: string;
      readonly year: number;
    };
    readonly weather: {
      readonly type: string;
      readonly intensity: number;
      readonly effects: string[];
    };
  }> {}

export interface BuildingConstructionResponse
  extends APIResponse<{
    readonly buildingId: UUID;
    readonly type: string;
    readonly position: { x: number; y: number };
    readonly constructionTime: number;
    readonly resourceCost: Record<string, number>;
    readonly estimatedCompletion: Timestamp;
    readonly assignedWorkers: UUID[];
    readonly requirements: Array<{
      readonly type: string;
      readonly requirement: string;
      readonly isMet: boolean;
    }>;
  }> {}

export interface ResourceTradeResponse
  extends APIResponse<{
    readonly tradeId: UUID;
    readonly offer: Record<string, number>;
    readonly request: Record<string, number>;
    readonly exchangeRate: Record<string, number>;
    readonly tradingPartner?: string;
    readonly status: 'pending' | 'accepted' | 'rejected' | 'completed';
    readonly completionTime?: Timestamp;
  }> {}

export interface EventResponse
  extends APIResponse<{
    readonly eventId: UUID;
    readonly name: string;
    readonly type: string;
    readonly severity: string;
    readonly description: string;
    readonly effects: Array<{
      readonly type: string;
      readonly target: string;
      readonly value: number;
    }>;
    readonly choices: Array<{
      readonly id: string;
      readonly description: string;
      readonly consequences: Array<{
        readonly type: string;
        readonly description: string;
        readonly probability: number;
      }>;
    }>;
    readonly timeToDecide: number;
  }> {}

// ============================================================================
// ANALYTICS & STATISTICS RESPONSES
// ============================================================================

export interface GameStatisticsResponse
  extends APIResponse<{
    readonly gameId: UUID;
    readonly gameType: string;
    readonly duration: number;
    readonly outcome: string;
    readonly playerStats: Array<{
      readonly playerId: UUID;
      readonly playerName: string;
      readonly performance: string;
      readonly achievements: string[];
      readonly finalScore?: number;
    }>;
    readonly gameMetrics: {
      readonly totalActions: number;
      readonly averageResponseTime: number;
      readonly playerEngagement: number;
      readonly difficultyRating: number;
    };
  }> {}

export interface AnalyticsResponse
  extends APIResponse<{
    readonly period: {
      readonly start: Timestamp;
      readonly end: Timestamp;
    };
    readonly metrics: {
      readonly totalGames: number;
      readonly totalPlayers: number;
      readonly averageGameDuration: number;
      readonly popularGameTypes: Array<{
        readonly type: string;
        readonly count: number;
        readonly percentage: number;
      }>;
      readonly playerRetention: {
        readonly daily: number;
        readonly weekly: number;
        readonly monthly: number;
      };
      readonly aiUsage: {
        readonly totalRequests: number;
        readonly totalTokens: number;
        readonly averageResponseTime: number;
        readonly successRate: number;
      };
    };
  }> {}

// ============================================================================
// ZOD SCHEMAS FOR VALIDATION
// ============================================================================

export const APIErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(JSONValueSchema).optional(),
  stack: z.string().optional(),
  timestamp: TimestampSchema,
  requestId: UUIDSchema,
  path: z.string().optional(),
});

export const APIMetadataSchema = z.object({
  requestId: UUIDSchema,
  timestamp: TimestampSchema,
  version: z.string(),
  processingTime: z.number().min(0),
  rateLimit: z
    .object({
      limit: z.number(),
      remaining: z.number(),
      reset: TimestampSchema,
      retryAfter: z.number().optional(),
    })
    .optional(),
  pagination: z
    .object({
      page: z.number().min(1),
      limit: z.number().min(1),
      total: z.number().min(0),
      totalPages: z.number().min(1),
      hasNext: z.boolean(),
      hasPrev: z.boolean(),
    })
    .optional(),
  cacheInfo: z
    .object({
      hit: z.boolean(),
      key: z.string(),
      ttl: z.number().min(0),
      generatedAt: TimestampSchema,
    })
    .optional(),
});

export const APIResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: APIErrorSchema.optional(),
    metadata: APIMetadataSchema,
  });

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Creates a successful API response
 */
export function createSuccessResponse<T>(
  data: T,
  metadata: Partial<APIMetadata> = {}
): APIResponse<T> {
  return {
    success: true,
    data,
    error: undefined,
    metadata: {
      requestId: crypto.randomUUID(),
      timestamp: new Date(),
      version: '1.0.0',
      processingTime: 0,
      ...metadata,
    },
  };
}

/**
 * Creates an error API response
 */
export function createErrorResponse(
  code: ErrorCode | APIErrorCode,
  message: string,
  details?: Record<string, JSONValue>,
  metadata: Partial<APIMetadata> = {}
): APIResponse<never> {
  return {
    success: false,
    data: undefined,
    error: {
      code,
      message,
      details,
      timestamp: new Date(),
      requestId: crypto.randomUUID(),
    },
    metadata: {
      requestId: crypto.randomUUID(),
      timestamp: new Date(),
      version: '1.0.0',
      processingTime: 0,
      ...metadata,
    },
  };
}

/**
 * Type guard to check if response is successful
 */
export function isSuccessResponse<T>(
  response: APIResponse<T>
): response is APIResponse<T> & { success: true; data: T } {
  return response.success === true && response.data !== undefined;
}

/**
 * Type guard to check if response is an error
 */
export function isErrorResponse<T>(
  response: APIResponse<T>
): response is APIResponse<T> & { success: false; error: APIError } {
  return response.success === false && response.error !== undefined;
}
