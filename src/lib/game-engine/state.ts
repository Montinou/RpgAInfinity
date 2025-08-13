/**
 * State Management System - RpgAInfinity Game Engine
 *
 * Provides comprehensive state management with immutability, concurrency control,
 * validation, diffing, and history tracking for multiplayer game sessions.
 *
 * Key Features:
 * - Immutable state updates with deep cloning
 * - Optimistic concurrency control for multiplayer
 * - State validation with comprehensive rules
 * - Efficient state diffing for network synchronization
 * - State history for undo/replay functionality
 * - Memory-efficient operations
 */

import { z } from 'zod';
import {
  GameState,
  GameAction,
  GameEvent,
  UUID,
  Timestamp,
  JSONValue,
  GameError,
  ErrorCode,
  GameStateSchema,
  validateWith,
} from '@/types/core';
import { kvService } from '@/lib/database/kv-service';

// ============================================================================
// STATE MANAGEMENT TYPES
// ============================================================================

/**
 * Result of state validation
 */
export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
  readonly metadata: {
    readonly validationTime: Timestamp;
    readonly rulesApplied: string[];
    readonly performanceMetrics: {
      readonly validationTimeMs: number;
      readonly memoryUsageMB?: number;
    };
  };
}

/**
 * State difference representation for efficient synchronization
 */
export interface StateDiff {
  readonly id: UUID;
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly timestamp: Timestamp;
  readonly changes: StateChange[];
  readonly metadata: {
    readonly diffSizeBytes: number;
    readonly compressionRatio?: number;
    readonly affectedPaths: string[];
  };
}

/**
 * Individual state change within a diff
 */
export interface StateChange {
  readonly path: string;
  readonly operation: 'add' | 'remove' | 'replace' | 'move';
  readonly oldValue?: JSONValue;
  readonly newValue?: JSONValue;
  readonly metadata?: Record<string, JSONValue>;
}

/**
 * State history entry for undo/replay functionality
 */
export interface StateHistoryEntry {
  readonly id: UUID;
  readonly gameId: UUID;
  readonly version: number;
  readonly state: GameState;
  readonly action?: GameAction;
  readonly timestamp: Timestamp;
  readonly playerId?: UUID;
  readonly isCheckpoint: boolean;
  readonly metadata: {
    readonly sizeBytes: number;
    readonly compressionUsed: boolean;
    readonly tags: string[];
  };
}

/**
 * Configuration for state management behavior
 */
export interface StateManagerConfig {
  readonly enableHistory: boolean;
  readonly maxHistoryEntries: number;
  readonly compressionThreshold: number; // bytes
  readonly validationLevel: 'strict' | 'normal' | 'lenient';
  readonly optimisticLocking: boolean;
  readonly rateLimiting: {
    readonly maxUpdatesPerSecond: number;
    readonly maxUpdatesPerMinute: number;
  };
}

/**
 * State update options
 */
export interface StateUpdateOptions {
  readonly skipValidation?: boolean;
  readonly createCheckpoint?: boolean;
  readonly expectedVersion?: number;
  readonly playerId?: UUID;
  readonly tags?: string[];
  readonly metadata?: Record<string, JSONValue>;
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const ValidationResultSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  metadata: z.object({
    validationTime: z.date(),
    rulesApplied: z.array(z.string()),
    performanceMetrics: z.object({
      validationTimeMs: z.number(),
      memoryUsageMB: z.number().optional(),
    }),
  }),
});

const StateChangeSchema = z.object({
  path: z.string(),
  operation: z.enum(['add', 'remove', 'replace', 'move']),
  oldValue: z.any().optional(),
  newValue: z.any().optional(),
  metadata: z.record(z.any()).optional(),
});

const StateDiffSchema = z.object({
  id: z.string().uuid(),
  fromVersion: z.number().int().min(0),
  toVersion: z.number().int().min(0),
  timestamp: z.date(),
  changes: z.array(StateChangeSchema),
  metadata: z.object({
    diffSizeBytes: z.number(),
    compressionRatio: z.number().optional(),
    affectedPaths: z.array(z.string()),
  }),
});

// ============================================================================
// STATE MANAGER INTERFACE
// ============================================================================

export interface StateManager {
  /**
   * Get current game state from storage
   */
  getState(gameId: string): Promise<GameState | null>;

  /**
   * Update game state with validation and concurrency control
   */
  updateState(
    gameId: string,
    updates: Partial<GameState>,
    options?: StateUpdateOptions
  ): Promise<GameState>;

  /**
   * Validate game state against business rules
   */
  validateState(state: GameState): ValidationResult;

  /**
   * Create deep immutable clone of game state
   */
  cloneState(state: GameState): GameState;

  /**
   * Generate diff between two game states
   */
  diffStates(oldState: GameState, newState: GameState): StateDiff;

  /**
   * Apply state diff to create new state
   */
  applyDiff(state: GameState, diff: StateDiff): GameState;

  /**
   * Get state history for a game
   */
  getStateHistory(gameId: string, limit?: number): Promise<StateHistoryEntry[]>;

  /**
   * Restore state to a previous version
   */
  restoreState(gameId: string, version: number): Promise<GameState>;

  /**
   * Create state checkpoint
   */
  createCheckpoint(gameId: string, tags?: string[]): Promise<void>;

  /**
   * Clean up old state history
   */
  cleanupHistory(gameId: string, keepCheckpoints?: boolean): Promise<number>;
}

// ============================================================================
// STATE MANAGER IMPLEMENTATION
// ============================================================================

export class GameStateManager implements StateManager {
  private config: StateManagerConfig;
  private rateLimitCache = new Map<
    string,
    { count: number; resetTime: number }
  >();

  constructor(config?: Partial<StateManagerConfig>) {
    this.config = {
      enableHistory: true,
      maxHistoryEntries: 100,
      compressionThreshold: 1024 * 10, // 10KB
      validationLevel: 'normal',
      optimisticLocking: true,
      rateLimiting: {
        maxUpdatesPerSecond: 10,
        maxUpdatesPerMinute: 100,
      },
      ...config,
    };
  }

  // ============================================================================
  // CORE STATE OPERATIONS
  // ============================================================================

  async getState(gameId: string): Promise<GameState | null> {
    try {
      const result = await kvService.getGameState(gameId);

      if (!result.success) {
        throw new Error(`Failed to get state: ${result.error}`);
      }

      return result.data || null;
    } catch (error) {
      console.error('StateManager.getState error:', error);
      throw new GameError({
        code: 'DATABASE_ERROR',
        message: `Failed to retrieve game state: ${error}`,
        timestamp: new Date(),
        gameId,
      });
    }
  }

  async updateState(
    gameId: string,
    updates: Partial<GameState>,
    options: StateUpdateOptions = {}
  ): Promise<GameState> {
    // Rate limiting check
    if (!this.checkRateLimit(gameId, options.playerId)) {
      throw new GameError({
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many state updates. Please wait before trying again.',
        timestamp: new Date(),
        gameId,
        playerId: options.playerId,
      });
    }

    try {
      // Get current state
      const currentState = await this.getState(gameId);
      if (!currentState) {
        throw new GameError({
          code: 'GAME_NOT_FOUND',
          message: `Game ${gameId} not found`,
          timestamp: new Date(),
          gameId,
        });
      }

      // Optimistic concurrency control
      if (
        this.config.optimisticLocking &&
        options.expectedVersion !== undefined
      ) {
        if (currentState.metadata.version !== options.expectedVersion) {
          throw new GameError({
            code: 'VALIDATION_ERROR',
            message: `State version conflict: expected ${options.expectedVersion}, got ${currentState.metadata.version}`,
            timestamp: new Date(),
            gameId,
          });
        }
      }

      // Create new state with updates
      const newState = this.createNewState(currentState, updates);

      // Validation
      if (!options.skipValidation) {
        const validationResult = this.validateState(newState);
        if (!validationResult.isValid) {
          throw new GameError({
            code: 'VALIDATION_ERROR',
            message: `State validation failed: ${validationResult.errors.join(', ')}`,
            timestamp: new Date(),
            gameId,
            details: {
              errors: validationResult.errors,
              warnings: validationResult.warnings,
            },
          });
        }
      }

      // Save state history if enabled
      if (this.config.enableHistory) {
        await this.saveStateHistory(currentState, options);
      }

      // Create checkpoint if requested
      if (options.createCheckpoint) {
        await this.saveStateHistory(newState, {
          ...options,
          isCheckpoint: true,
        });
      }

      // Persist new state
      const saveResult = await kvService.setGameState(
        gameId,
        newState,
        options.expectedVersion
      );

      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to save state');
      }

      return newState;
    } catch (error) {
      console.error('StateManager.updateState error:', error);

      if (error instanceof GameError) {
        throw error;
      }

      throw new GameError({
        code: 'DATABASE_ERROR',
        message: `Failed to update game state: ${error}`,
        timestamp: new Date(),
        gameId,
        playerId: options.playerId,
      });
    }
  }

  // ============================================================================
  // STATE VALIDATION
  // ============================================================================

  validateState(state: GameState): ValidationResult {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    const rulesApplied: string[] = [];

    try {
      // Schema validation
      rulesApplied.push('schema-validation');
      const schemaValidation = GameStateSchema.safeParse(state);
      if (!schemaValidation.success) {
        errors.push(
          `Schema validation failed: ${schemaValidation.error.message}`
        );
      }

      // Business rule validation
      this.validateBusinessRules(state, errors, warnings, rulesApplied);

      // Game-specific validation
      this.validateGameSpecificRules(state, errors, warnings, rulesApplied);

      // Performance validation
      this.validatePerformanceConstraints(
        state,
        errors,
        warnings,
        rulesApplied
      );

      const endTime = Date.now();
      const validationTimeMs = endTime - startTime;

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        metadata: {
          validationTime: new Date(),
          rulesApplied,
          performanceMetrics: {
            validationTimeMs,
            memoryUsageMB: this.getMemoryUsage(),
          },
        },
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation error: ${error}`],
        warnings: [],
        metadata: {
          validationTime: new Date(),
          rulesApplied,
          performanceMetrics: {
            validationTimeMs: Date.now() - startTime,
          },
        },
      };
    }
  }

  // ============================================================================
  // STATE CLONING
  // ============================================================================

  cloneState(state: GameState): GameState {
    try {
      // Use structured cloning for deep immutable copy
      return structuredClone(state);
    } catch (error) {
      // Fallback to JSON serialization for older environments
      console.warn(
        'Structured cloning not available, falling back to JSON:',
        error
      );
      return JSON.parse(JSON.stringify(state));
    }
  }

  // ============================================================================
  // STATE DIFFING
  // ============================================================================

  diffStates(oldState: GameState, newState: GameState): StateDiff {
    const changes: StateChange[] = [];
    const affectedPaths: string[] = [];

    // Generate changes recursively
    this.generateChanges('', oldState, newState, changes, affectedPaths);

    const diffId = crypto.randomUUID();
    const timestamp = new Date();

    // Calculate diff size
    const diffSizeBytes = JSON.stringify(changes).length;

    return {
      id: diffId,
      fromVersion: oldState.metadata.version,
      toVersion: newState.metadata.version,
      timestamp,
      changes,
      metadata: {
        diffSizeBytes,
        affectedPaths: [...new Set(affectedPaths)], // Remove duplicates
      },
    };
  }

  applyDiff(state: GameState, diff: StateDiff): GameState {
    let newState = this.cloneState(state);

    for (const change of diff.changes) {
      try {
        newState = this.applyChange(newState, change);
      } catch (error) {
        console.error(`Failed to apply change at path ${change.path}:`, error);
        throw new GameError({
          code: 'VALIDATION_ERROR',
          message: `Failed to apply diff change at path ${change.path}: ${error}`,
          timestamp: new Date(),
          gameId: state.gameId,
          details: { change },
        });
      }
    }

    // Update version
    newState.metadata = {
      ...newState.metadata,
      version: diff.toVersion,
    };

    return newState;
  }

  // ============================================================================
  // STATE HISTORY
  // ============================================================================

  async getStateHistory(
    gameId: string,
    limit: number = 10
  ): Promise<StateHistoryEntry[]> {
    try {
      const pattern = `state:history:${gameId}:*`;
      const keys = await kvService.get<string[]>(
        `state:history:index:${gameId}`
      );

      if (!keys.success || !keys.data) {
        return [];
      }

      const sortedKeys = keys.data
        .sort((a, b) => b.localeCompare(a)) // Sort by version descending
        .slice(0, limit);

      const entries: StateHistoryEntry[] = [];

      for (const key of sortedKeys) {
        const result = await kvService.get<StateHistoryEntry>(key);
        if (result.success && result.data) {
          entries.push(result.data);
        }
      }

      return entries;
    } catch (error) {
      console.error('StateManager.getStateHistory error:', error);
      return [];
    }
  }

  async restoreState(gameId: string, version: number): Promise<GameState> {
    try {
      const historyKey = `state:history:${gameId}:${version.toString().padStart(8, '0')}`;
      const result = await kvService.get<StateHistoryEntry>(historyKey);

      if (!result.success || !result.data) {
        throw new GameError({
          code: 'GAME_NOT_FOUND',
          message: `State version ${version} not found for game ${gameId}`,
          timestamp: new Date(),
          gameId,
        });
      }

      const restoredState = result.data.state;

      // Update state with restored version
      await this.updateState(gameId, restoredState, {
        skipValidation: true,
        createCheckpoint: true,
        tags: ['restored', `from-version-${version}`],
      });

      return restoredState;
    } catch (error) {
      console.error('StateManager.restoreState error:', error);
      throw error instanceof GameError
        ? error
        : new GameError({
            code: 'DATABASE_ERROR',
            message: `Failed to restore state: ${error}`,
            timestamp: new Date(),
            gameId,
          });
    }
  }

  async createCheckpoint(gameId: string, tags: string[] = []): Promise<void> {
    const currentState = await this.getState(gameId);
    if (!currentState) {
      throw new GameError({
        code: 'GAME_NOT_FOUND',
        message: `Game ${gameId} not found`,
        timestamp: new Date(),
        gameId,
      });
    }

    await this.saveStateHistory(currentState, {
      isCheckpoint: true,
      tags: ['checkpoint', ...tags],
    });
  }

  async cleanupHistory(
    gameId: string,
    keepCheckpoints: boolean = true
  ): Promise<number> {
    try {
      const history = await this.getStateHistory(
        gameId,
        this.config.maxHistoryEntries * 2
      );
      let cleanedCount = 0;

      // Keep only recent entries and checkpoints
      const toKeep = keepCheckpoints
        ? history.filter(entry => entry.isCheckpoint).slice(0, 10) // Keep up to 10 checkpoints
        : [];

      const recentEntries = history
        .filter(entry => !entry.isCheckpoint)
        .slice(0, this.config.maxHistoryEntries);

      toKeep.push(...recentEntries);

      // Delete entries not in keep list
      const keepIds = new Set(toKeep.map(entry => entry.id));

      for (const entry of history) {
        if (!keepIds.has(entry.id)) {
          const historyKey = `state:history:${gameId}:${entry.version.toString().padStart(8, '0')}`;
          await kvService.delete(historyKey);
          cleanedCount++;
        }
      }

      return cleanedCount;
    } catch (error) {
      console.error('StateManager.cleanupHistory error:', error);
      return 0;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private createNewState(
    currentState: GameState,
    updates: Partial<GameState>
  ): GameState {
    const newState = this.cloneState(currentState);

    // Apply updates
    Object.assign(newState, updates);

    // Update metadata
    newState.metadata = {
      ...newState.metadata,
      version: newState.metadata.version + 1,
      lastAction: updates.metadata?.lastAction || newState.metadata.lastAction,
      actionHistory: [
        ...newState.metadata.actionHistory,
        ...(updates.metadata?.lastAction ? [updates.metadata.lastAction] : []),
      ],
    };

    return newState;
  }

  private validateBusinessRules(
    state: GameState,
    errors: string[],
    warnings: string[],
    rulesApplied: string[]
  ): void {
    rulesApplied.push('business-rules');

    // Validate game phase consistency
    if (!state.phase || state.phase.trim() === '') {
      errors.push('Game phase cannot be empty');
    }

    // Validate turn progression
    if (state.turn !== undefined && state.turn < 0) {
      errors.push('Turn number cannot be negative');
    }

    // Validate player consistency
    if (state.currentPlayer) {
      // TODO: Add player existence validation when player management is integrated
      rulesApplied.push('player-validation');
    }

    // Validate metadata integrity
    if (state.metadata.version < 0) {
      errors.push('State version cannot be negative');
    }

    if (state.metadata.actionHistory.length > 10000) {
      warnings.push('Action history is very large, consider cleanup');
    }
  }

  private validateGameSpecificRules(
    state: GameState,
    errors: string[],
    warnings: string[],
    rulesApplied: string[]
  ): void {
    rulesApplied.push('game-specific-rules');

    // TODO: Add game-specific validation when game modules are integrated
    // This will be extended by specific game implementations

    // Validate data structure integrity
    if (typeof state.data !== 'object' || state.data === null) {
      errors.push('State data must be a valid object');
    }

    // Check for circular references (basic check)
    try {
      JSON.stringify(state.data);
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('circular')) {
        errors.push('State data contains circular references');
      }
    }
  }

  private validatePerformanceConstraints(
    state: GameState,
    errors: string[],
    warnings: string[],
    rulesApplied: string[]
  ): void {
    rulesApplied.push('performance-constraints');

    // Check state size
    const stateSize = JSON.stringify(state).length;
    const maxSize = 1024 * 1024; // 1MB limit

    if (stateSize > maxSize) {
      errors.push(
        `State size ${stateSize} bytes exceeds maximum ${maxSize} bytes`
      );
    } else if (stateSize > maxSize * 0.8) {
      warnings.push(
        `State size ${stateSize} bytes is approaching limit ${maxSize} bytes`
      );
    }

    // Check action history size
    if (state.metadata.actionHistory.length > 1000) {
      warnings.push(
        `Action history has ${state.metadata.actionHistory.length} entries, consider cleanup`
      );
    }
  }

  private generateChanges(
    path: string,
    oldValue: any,
    newValue: any,
    changes: StateChange[],
    affectedPaths: string[]
  ): void {
    if (oldValue === newValue) {
      return;
    }

    const currentPath = path;
    affectedPaths.push(currentPath);

    // Handle null/undefined values
    if (oldValue === null || oldValue === undefined) {
      changes.push({
        path: currentPath,
        operation: 'add',
        newValue: newValue,
      });
      return;
    }

    if (newValue === null || newValue === undefined) {
      changes.push({
        path: currentPath,
        operation: 'remove',
        oldValue: oldValue,
      });
      return;
    }

    // Handle primitive values
    if (typeof oldValue !== 'object' || typeof newValue !== 'object') {
      changes.push({
        path: currentPath,
        operation: 'replace',
        oldValue: oldValue,
        newValue: newValue,
      });
      return;
    }

    // Handle arrays
    if (Array.isArray(oldValue) || Array.isArray(newValue)) {
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          path: currentPath,
          operation: 'replace',
          oldValue: oldValue,
          newValue: newValue,
        });
      }
      return;
    }

    // Handle objects recursively
    const allKeys = new Set([
      ...Object.keys(oldValue),
      ...Object.keys(newValue),
    ]);

    for (const key of allKeys) {
      const nestedPath = currentPath ? `${currentPath}.${key}` : key;
      this.generateChanges(
        nestedPath,
        oldValue[key],
        newValue[key],
        changes,
        affectedPaths
      );
    }
  }

  private applyChange(state: GameState, change: StateChange): GameState {
    const pathParts = change.path.split('.');
    let current: any = state;

    // Navigate to parent of target
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }

    const finalKey = pathParts[pathParts.length - 1];

    switch (change.operation) {
      case 'add':
      case 'replace':
        current[finalKey] = change.newValue;
        break;
      case 'remove':
        delete current[finalKey];
        break;
      case 'move':
        // TODO: Implement move operation if needed
        throw new Error('Move operation not yet implemented');
    }

    return state;
  }

  private async saveStateHistory(
    state: GameState,
    options: StateUpdateOptions & { isCheckpoint?: boolean } = {}
  ): Promise<void> {
    try {
      const stateSize = JSON.stringify(state).length;
      const historyEntry: StateHistoryEntry = {
        id: crypto.randomUUID(),
        gameId: state.gameId,
        version: state.metadata.version,
        state: this.cloneState(state),
        action: state.metadata.lastAction,
        timestamp: new Date(),
        playerId: options.playerId,
        isCheckpoint: options.isCheckpoint || false,
        metadata: {
          sizeBytes: stateSize,
          compressionUsed: stateSize > this.config.compressionThreshold,
          tags: options.tags || [],
        },
      };

      const historyKey = `state:history:${state.gameId}:${state.metadata.version.toString().padStart(8, '0')}`;

      // Save history entry
      await kvService.set(historyKey, historyEntry, 24 * 60 * 60); // 24 hour TTL

      // Update history index
      const indexKey = `state:history:index:${state.gameId}`;
      const indexResult = await kvService.get<string[]>(indexKey);
      const currentIndex = indexResult.data || [];

      currentIndex.push(historyKey);

      // Keep only recent entries in index
      const sortedIndex = currentIndex
        .sort((a, b) => b.localeCompare(a))
        .slice(0, this.config.maxHistoryEntries);

      await kvService.set(indexKey, sortedIndex, 7 * 24 * 60 * 60); // 7 day TTL
    } catch (error) {
      console.error('Failed to save state history:', error);
      // Don't throw - history is not critical for game operation
    }
  }

  private checkRateLimit(gameId: string, playerId?: string): boolean {
    const now = Date.now();
    const key = `${gameId}:${playerId || 'anonymous'}`;

    const current = this.rateLimitCache.get(key);

    if (!current || now > current.resetTime) {
      // Reset rate limit window
      this.rateLimitCache.set(key, {
        count: 1,
        resetTime: now + 1000, // 1 second window
      });
      return true;
    }

    if (current.count >= this.config.rateLimiting.maxUpdatesPerSecond) {
      return false;
    }

    current.count++;
    return true;
  }

  private getMemoryUsage(): number | undefined {
    try {
      // Only available in Node.js environments
      if (typeof process !== 'undefined' && process.memoryUsage) {
        return process.memoryUsage().heapUsed / 1024 / 1024; // MB
      }
    } catch (error) {
      // Ignore errors in browser environments
    }
    return undefined;
  }
}

// ============================================================================
// GAME ERROR CLASS
// ============================================================================

class GameError extends Error {
  public readonly code: ErrorCode;
  public readonly timestamp: Timestamp;
  public readonly gameId?: UUID;
  public readonly playerId?: UUID;
  public readonly details?: Record<string, JSONValue>;

  constructor(params: {
    code: ErrorCode;
    message: string;
    timestamp: Timestamp;
    gameId?: UUID;
    playerId?: UUID;
    details?: Record<string, JSONValue>;
  }) {
    super(params.message);
    this.name = 'GameError';
    this.code = params.code;
    this.timestamp = params.timestamp;
    this.gameId = params.gameId;
    this.playerId = params.playerId;
    this.details = params.details;
  }
}

// ============================================================================
// FACTORY AND EXPORTS
// ============================================================================

/**
 * Create a new StateManager instance with configuration
 */
export function createStateManager(
  config?: Partial<StateManagerConfig>
): StateManager {
  return new GameStateManager(config);
}

/**
 * Default state manager instance for convenience
 */
export const stateManager = createStateManager({
  validationLevel: 'normal',
  enableHistory: true,
  maxHistoryEntries: 50,
  optimisticLocking: true,
});

// Export types and schemas for external use
export {
  ValidationResult,
  StateDiff,
  StateChange,
  StateHistoryEntry,
  StateManagerConfig,
  StateUpdateOptions,
  ValidationResultSchema,
  StateDiffSchema,
  StateChangeSchema,
};
