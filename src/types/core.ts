/**
 * Core type definitions for RpgAInfinity game engine
 * Provides fundamental interfaces and types used across all game modules
 */

import { z } from 'zod';

// ============================================================================
// BASE IDENTIFIERS & PRIMITIVES
// ============================================================================

export type UUID = string;
export type Timestamp = Date;
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

// Zod schemas for primitives
export const UUIDSchema = z.string().uuid();
export const TimestampSchema = z.date();
export const JSONValueSchema: z.ZodType<JSONValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JSONValueSchema),
    z.record(JSONValueSchema),
  ])
);

// ============================================================================
// GAME ENGINE CORE INTERFACES
// ============================================================================

export interface GameEngine {
  /**
   * Create a new game session with the given configuration
   */
  createGame<TConfig extends GameConfig = GameConfig>(
    config: TConfig
  ): Promise<Game>;

  /**
   * Process a player action and return updated game state
   */
  processAction<TAction extends GameAction = GameAction>(
    gameId: UUID,
    action: TAction
  ): Promise<GameState>;

  /**
   * Save current game state to persistent storage
   */
  saveState(gameId: UUID, state: GameState): Promise<void>;

  /**
   * Load game state from persistent storage
   */
  loadState(gameId: UUID): Promise<GameState | null>;

  /**
   * Subscribe to game events
   */
  subscribe(
    gameId: UUID,
    eventType: GameEventType,
    handler: EventHandler
  ): void;

  /**
   * Unsubscribe from game events
   */
  unsubscribe(
    gameId: UUID,
    eventType: GameEventType,
    handler: EventHandler
  ): void;
}

// ============================================================================
// GAME CONFIGURATION & METADATA
// ============================================================================

export type GameType = 'rpg' | 'deduction' | 'village';

export interface GameConfig {
  readonly type: GameType;
  readonly name: string;
  readonly description?: string;
  readonly maxPlayers: number;
  readonly minPlayers: number;
  readonly estimatedDurationMinutes: number;
  readonly isPrivate: boolean;
  readonly settings: Record<string, any>;
}

export const GameConfigSchema = z.object({
  type: z.enum(['rpg', 'deduction', 'village']),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  maxPlayers: z.number().int().min(1).max(20),
  minPlayers: z.number().int().min(1).max(20),
  estimatedDurationMinutes: z.number().int().min(5).max(480),
  isPrivate: z.boolean(),
  settings: z.record(JSONValueSchema),
});

// ============================================================================
// PLAYER SYSTEM
// ============================================================================

export interface Player {
  readonly id: UUID;
  readonly name: string;
  readonly avatar?: string;
  readonly isActive: boolean;
  readonly joinedAt: Timestamp;
  readonly lastActivity: Timestamp;
  readonly gameSpecificData: Record<string, any>;
}

export const PlayerSchema = z.object({
  id: UUIDSchema,
  name: z.string().min(1).max(50),
  avatar: z.string().url().optional(),
  isActive: z.boolean(),
  joinedAt: TimestampSchema,
  lastActivity: TimestampSchema,
  gameSpecificData: z.record(JSONValueSchema),
});

// ============================================================================
// GAME SESSION & STATE
// ============================================================================

export type GameStatus =
  | 'waiting'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled';
export type GamePhase = string; // Game-specific phases like 'setup', 'playing', 'voting', etc.

export interface Game {
  readonly id: UUID;
  readonly config: GameConfig;
  readonly status: GameStatus;
  readonly currentPhase: GamePhase;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly createdBy: UUID;
  readonly players: Player[];
  readonly state: GameState;
}

export const GameSchema = z.object({
  id: UUIDSchema,
  config: GameConfigSchema,
  status: z.enum(['waiting', 'active', 'paused', 'completed', 'cancelled']),
  currentPhase: z.string(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  createdBy: UUIDSchema,
  players: z.array(PlayerSchema),
  state: z.any(), // Will be refined by specific game types
});

export interface GameState {
  readonly gameId: UUID;
  readonly phase: GamePhase;
  readonly turn?: number;
  readonly currentPlayer?: UUID;
  readonly data: Record<string, any>;
  readonly metadata: {
    readonly version: number;
    readonly lastAction?: GameAction;
    readonly actionHistory: GameAction[];
  };
}

export const GameStateSchema = z.object({
  gameId: UUIDSchema,
  phase: z.string(),
  turn: z.number().int().min(0).optional(),
  currentPlayer: UUIDSchema.optional(),
  data: z.record(JSONValueSchema),
  metadata: z.object({
    version: z.number().int().min(0),
    lastAction: z.any().optional(), // Will be refined by specific action types
    actionHistory: z.array(z.any()),
  }),
});

// ============================================================================
// ACTION SYSTEM
// ============================================================================

export type ActionType = string; // Game-specific actions like 'move', 'attack', 'vote', etc.

export interface GameAction {
  readonly id: UUID;
  readonly type: ActionType;
  readonly playerId: UUID;
  readonly gameId: UUID;
  readonly timestamp: Timestamp;
  readonly data: Record<string, any>;
  readonly metadata?: Record<string, JSONValue>;
}

export const GameActionSchema = z.object({
  id: UUIDSchema,
  type: z.string().min(1),
  playerId: UUIDSchema,
  gameId: UUIDSchema,
  timestamp: TimestampSchema,
  data: z.record(JSONValueSchema),
  metadata: z.record(JSONValueSchema).optional(),
});

export interface ActionResult {
  readonly success: boolean;
  readonly newState?: GameState;
  readonly events: GameEvent[];
  readonly error?: GameError;
  readonly sideEffects?: SideEffect[];
}

export const ActionResultSchema = z.object({
  success: z.boolean(),
  newState: GameStateSchema.optional(),
  events: z.array(z.any()), // Will be refined by GameEventSchema
  error: z.any().optional(), // Will be refined by GameErrorSchema
  sideEffects: z.array(z.any()).optional(),
});

// ============================================================================
// EVENT SYSTEM
// ============================================================================

export type GameEventType = string; // Game-specific events
export type EventHandler = (event: GameEvent) => void | Promise<void>;

export interface GameEvent {
  readonly id: UUID;
  readonly type: GameEventType;
  readonly gameId: UUID;
  readonly timestamp: Timestamp;
  readonly data: Record<string, any>;
  readonly affectedPlayers?: UUID[];
  readonly isPublic: boolean;
}

export const GameEventSchema = z.object({
  id: UUIDSchema,
  type: z.string().min(1),
  gameId: UUIDSchema,
  timestamp: TimestampSchema,
  data: z.record(JSONValueSchema),
  affectedPlayers: z.array(UUIDSchema).optional(),
  isPublic: z.boolean(),
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

export type ErrorCode =
  | 'GAME_NOT_FOUND'
  | 'PLAYER_NOT_FOUND'
  | 'INVALID_ACTION'
  | 'INVALID_PHASE'
  | 'PERMISSION_DENIED'
  | 'VALIDATION_ERROR'
  | 'AI_SERVICE_ERROR'
  | 'DATABASE_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'GAME_FULL'
  | 'GAME_ENDED'
  | 'NO_ELIGIBLE_VOTERS'
  | 'VOTING_START_FAILED'
  | 'SESSION_NOT_FOUND'
  | 'VOTE_CHANGE_NOT_ALLOWED'
  | 'VOTE_TALLY_FAILED'
  | 'VOTING_PROCESS_FAILED'
  | 'NOT_ELIGIBLE_TO_VOTE'
  | 'ABSTENTION_FAILED'
  | 'CONSENSUS_CHECK_FAILED'
  | 'SESSION_NOT_ACTIVE'
  | 'INVALID_VOTING_PHASE'
  | 'VOTING_TIME_EXPIRED'
  | 'INVALID_VOTE_TARGET'
  | 'SELF_VOTE_NOT_ALLOWED'
  | 'INVALID_VOTING_POWER';

export interface IGameError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: Record<string, JSONValue>;
  readonly timestamp: Timestamp;
  readonly playerId?: UUID;
  readonly gameId?: UUID;
}

/**
 * GameError class for throwing game-related errors
 */
export class GameError extends Error implements IGameError {
  readonly code: ErrorCode;
  readonly details?: Record<string, JSONValue>;
  readonly timestamp: Timestamp;
  readonly playerId?: UUID;
  readonly gameId?: UUID;

  constructor(
    code: ErrorCode | string,
    message: string,
    details?: Record<string, JSONValue>
  ) {
    super(message);
    this.name = 'GameError';
    this.code = code as ErrorCode;
    this.message = message;
    this.details = details;
    this.timestamp = new Date();
    this.playerId = details?.playerId as UUID;
    this.gameId = details?.gameId as UUID;
  }
}

export const GameErrorSchema = z.object({
  code: z.enum([
    'GAME_NOT_FOUND',
    'PLAYER_NOT_FOUND',
    'INVALID_ACTION',
    'INVALID_PHASE',
    'PERMISSION_DENIED',
    'VALIDATION_ERROR',
    'AI_SERVICE_ERROR',
    'DATABASE_ERROR',
    'RATE_LIMIT_EXCEEDED',
    'GAME_FULL',
    'GAME_ENDED',
    'NO_ELIGIBLE_VOTERS',
    'VOTING_START_FAILED',
    'SESSION_NOT_FOUND',
    'VOTE_CHANGE_NOT_ALLOWED',
    'VOTE_TALLY_FAILED',
    'VOTING_PROCESS_FAILED',
    'NOT_ELIGIBLE_TO_VOTE',
    'ABSTENTION_FAILED',
    'CONSENSUS_CHECK_FAILED',
    'SESSION_NOT_ACTIVE',
    'INVALID_VOTING_PHASE',
    'VOTING_TIME_EXPIRED',
    'INVALID_VOTE_TARGET',
    'SELF_VOTE_NOT_ALLOWED',
    'INVALID_VOTING_POWER',
  ]),
  message: z.string(),
  details: z.record(JSONValueSchema).optional(),
  timestamp: TimestampSchema,
  playerId: UUIDSchema.optional(),
  gameId: UUIDSchema.optional(),
});

// ============================================================================
// SIDE EFFECTS
// ============================================================================

export type SideEffectType =
  | 'notification'
  | 'achievement'
  | 'state_change'
  | 'external_api';

export interface SideEffect {
  readonly type: SideEffectType;
  readonly target: 'player' | 'game' | 'system';
  readonly targetId?: UUID;
  readonly data: Record<string, any>;
  readonly executeAt?: Timestamp;
}

export const SideEffectSchema = z.object({
  type: z.enum(['notification', 'achievement', 'state_change', 'external_api']),
  target: z.enum(['player', 'game', 'system']),
  targetId: UUIDSchema.optional(),
  data: z.record(JSONValueSchema),
  executeAt: TimestampSchema.optional(),
});

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validates any object against its corresponding Zod schema
 */
export function validateWith<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`Validation failed: ${result.error.message}`);
  }
  return result.data;
}

/**
 * Creates a type-safe validator function
 */
export function createValidator<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): data is T => {
    return schema.safeParse(data).success;
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export const isPlayer = createValidator(PlayerSchema);
export const isGame = createValidator(GameSchema);
export const isGameState = createValidator(GameStateSchema);
export const isGameAction = createValidator(GameActionSchema);
export const isGameEvent = createValidator(GameEventSchema);
export const isGameError = createValidator(GameErrorSchema);
