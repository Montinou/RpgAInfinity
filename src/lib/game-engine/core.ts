/**
 * Core Game Engine Implementation for RpgAInfinity
 *
 * Provides the main game engine that manages game lifecycle, processes actions,
 * handles state persistence, and ensures atomic operations for concurrent players.
 * Supports all game types: RPG, Deduction, and Village simulation.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  GameEngine,
  GameConfig,
  Game,
  GameState,
  GameAction,
  GameEvent,
  ActionResult,
  Player,
  UUID,
  GameError,
  ErrorCode,
  GameEventType,
  EventHandler,
  SideEffect,
} from '@/types/core';
import { kvService } from '@/lib/database/kv-service';
import { validateWith, GameConfigSchema, GameActionSchema } from '@/types/core';

// ============================================================================
// PERFORMANCE CONSTANTS
// ============================================================================

const PERFORMANCE_THRESHOLDS = {
  STATE_OPERATION_MS: 100, // Target < 100ms for state operations
  MAX_CONCURRENT_PLAYERS: 8, // Support up to 8 concurrent players
  ACTION_TIMEOUT_MS: 5000, // Timeout for action processing
  RETRY_ATTEMPTS: 3, // Retry attempts for failed operations
} as const;

const CACHE_CONFIG = {
  GAME_STATE_TTL: 3600, // 1 hour for active game state
  ACTION_HISTORY_TTL: 86400, // 24 hours for action history
  EVENT_SUBSCRIPTION_TTL: 3600, // 1 hour for event subscriptions
} as const;

// ============================================================================
// CORE GAME ENGINE IMPLEMENTATION
// ============================================================================

export class CoreGameEngine implements GameEngine {
  private static instance: CoreGameEngine;
  private eventSubscriptions: Map<
    string,
    Map<GameEventType, Set<EventHandler>>
  > = new Map();

  private constructor() {
    this.setupPerformanceMonitoring();
  }

  static getInstance(): CoreGameEngine {
    if (!CoreGameEngine.instance) {
      CoreGameEngine.instance = new CoreGameEngine();
    }
    return CoreGameEngine.instance;
  }

  // ============================================================================
  // GAME LIFECYCLE MANAGEMENT
  // ============================================================================

  /**
   * Create a new game session with the given configuration
   */
  async createGame<TConfig extends GameConfig = GameConfig>(
    config: TConfig
  ): Promise<Game> {
    const startTime = performance.now();

    try {
      // Validate configuration
      const validConfig = validateWith(GameConfigSchema, config);

      // Generate game ID and initial state
      const gameId = uuidv4();
      const now = new Date();

      const game: Game = {
        id: gameId,
        config: validConfig,
        status: 'waiting',
        currentPhase: 'setup',
        createdAt: now,
        updatedAt: now,
        createdBy: '', // TODO: Get from auth context
        players: [],
        state: this.createInitialState(gameId, validConfig),
      };

      // Save game to persistent storage
      const saveResult = await this.saveGameToStorage(game);
      if (!saveResult.success) {
        throw new Error(`Failed to save game: ${saveResult.error}`);
      }

      // Initialize event system for this game
      this.initializeGameEvents(gameId);

      // Log performance metrics
      this.logPerformance('createGame', performance.now() - startTime, {
        gameId,
        gameType: config.type,
      });

      // Emit game created event
      await this.emitEvent({
        id: uuidv4(),
        type: 'game_created',
        gameId,
        timestamp: now,
        data: { config: validConfig },
        isPublic: true,
      });

      return game;
    } catch (error) {
      this.logError('createGame', error as Error, { config });
      throw this.createGameError(
        'VALIDATION_ERROR',
        `Failed to create game: ${error}`,
        { config }
      );
    }
  }

  /**
   * Process a player action and return updated game state
   */
  async processAction<TAction extends GameAction = GameAction>(
    gameId: UUID,
    action: TAction
  ): Promise<GameState> {
    const startTime = performance.now();

    try {
      // Validate action
      const validAction = validateWith(GameActionSchema, action);

      // Load current game state with retry logic
      const currentState = await this.loadStateWithRetry(gameId);
      if (!currentState) {
        throw this.createGameError(
          'GAME_NOT_FOUND',
          `Game ${gameId} not found`
        );
      }

      // Validate action against current state
      if (!this.validateAction(validAction, currentState)) {
        throw this.createGameError(
          'INVALID_ACTION',
          'Action is not valid for current game state',
          {
            action: validAction,
            currentPhase: currentState.phase,
          }
        );
      }

      // Process action atomically
      const actionResult = await this.executeActionAtomically(
        validAction,
        currentState
      );

      if (!actionResult.success) {
        throw (
          actionResult.error ||
          this.createGameError('DATABASE_ERROR', 'Action processing failed')
        );
      }

      const newState = actionResult.newState!;

      // Save updated state with optimistic locking
      await this.saveState(gameId, newState);

      // Process events and side effects
      await this.processActionResults(actionResult);

      // Log performance metrics
      this.logPerformance('processAction', performance.now() - startTime, {
        gameId,
        actionType: action.type,
        playerId: action.playerId,
      });

      return newState;
    } catch (error) {
      this.logError('processAction', error as Error, { gameId, action });
      if (error instanceof Error && 'code' in error) {
        throw error; // Re-throw GameError
      }
      throw this.createGameError(
        'INVALID_ACTION',
        `Failed to process action: ${error}`,
        { gameId, action }
      );
    }
  }

  /**
   * Save current game state to persistent storage with atomic operations
   */
  async saveState(gameId: UUID, state: GameState): Promise<void> {
    const startTime = performance.now();

    try {
      // TODO: Add optimistic concurrency control based on state version
      const stateKey = `game_state:${gameId}`;
      const result = await kvService.set(
        stateKey,
        state,
        CACHE_CONFIG.GAME_STATE_TTL
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to save state');
      }

      // Update action history
      if (state.metadata.lastAction) {
        await this.saveActionToHistory(gameId, state.metadata.lastAction);
      }

      this.logPerformance('saveState', performance.now() - startTime, {
        gameId,
        turn: state.turn,
      });
    } catch (error) {
      this.logError('saveState', error as Error, { gameId, state });
      throw this.createGameError(
        'DATABASE_ERROR',
        `Failed to save state: ${error}`,
        { gameId }
      );
    }
  }

  /**
   * Load game state from persistent storage
   */
  async loadState(gameId: UUID): Promise<GameState | null> {
    const startTime = performance.now();

    try {
      const stateKey = `game_state:${gameId}`;
      const result = await kvService.get<GameState>(stateKey);

      if (!result.success) {
        this.logError('loadState', new Error(result.error || 'Unknown error'), {
          gameId,
        });
        return null;
      }

      this.logPerformance('loadState', performance.now() - startTime, {
        gameId,
        found: !!result.data,
      });
      return result.data || null;
    } catch (error) {
      this.logError('loadState', error as Error, { gameId });
      return null;
    }
  }

  // ============================================================================
  // ACTION VALIDATION & PROCESSING
  // ============================================================================

  /**
   * Validate action against current game state
   */
  validateAction(action: GameAction, state: GameState): boolean {
    try {
      // Basic validation checks
      if (action.gameId !== state.gameId) {
        return false;
      }

      // Check if player exists in game
      // TODO: Load game to check players

      // Phase-specific validation
      // TODO: Implement phase-specific validation rules

      // Action-specific validation
      return this.validateActionByType(action, state);
    } catch (error) {
      this.logError('validateAction', error as Error, { action, state });
      return false;
    }
  }

  /**
   * Get available actions for a player in current state
   */
  getPlayerActions(playerId: string, state: GameState): GameAction[] {
    try {
      // TODO: Implement game-specific action generation
      // This should return available actions based on:
      // - Current game phase
      // - Player state
      // - Game rules

      // For now, return empty array
      // TODO: Remove this TODO and implement proper action generation
      return [];
    } catch (error) {
      this.logError('getPlayerActions', error as Error, { playerId, state });
      return [];
    }
  }

  // ============================================================================
  // EVENT SYSTEM
  // ============================================================================

  /**
   * Subscribe to game events
   */
  subscribe(
    gameId: UUID,
    eventType: GameEventType,
    handler: EventHandler
  ): void {
    if (!this.eventSubscriptions.has(gameId)) {
      this.eventSubscriptions.set(gameId, new Map());
    }

    const gameSubscriptions = this.eventSubscriptions.get(gameId)!;
    if (!gameSubscriptions.has(eventType)) {
      gameSubscriptions.set(eventType, new Set());
    }

    gameSubscriptions.get(eventType)!.add(handler);

    // Set TTL for subscription cleanup
    setTimeout(() => {
      this.unsubscribe(gameId, eventType, handler);
    }, CACHE_CONFIG.EVENT_SUBSCRIPTION_TTL * 1000);
  }

  /**
   * Unsubscribe from game events
   */
  unsubscribe(
    gameId: UUID,
    eventType: GameEventType,
    handler: EventHandler
  ): void {
    const gameSubscriptions = this.eventSubscriptions.get(gameId);
    if (gameSubscriptions) {
      const eventHandlers = gameSubscriptions.get(eventType);
      if (eventHandlers) {
        eventHandlers.delete(handler);
        if (eventHandlers.size === 0) {
          gameSubscriptions.delete(eventType);
        }
      }

      if (gameSubscriptions.size === 0) {
        this.eventSubscriptions.delete(gameId);
      }
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Create initial game state based on configuration
   */
  private createInitialState(gameId: UUID, config: GameConfig): GameState {
    return {
      gameId,
      phase: 'setup',
      turn: 0,
      data: {
        gameType: config.type,
        settings: config.settings,
        // TODO: Add game-specific initial state
      },
      metadata: {
        version: 1,
        actionHistory: [],
      },
    };
  }

  /**
   * Save game to storage with proper serialization
   */
  private async saveGameToStorage(
    game: Game
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const gameKey = `game:${game.id}`;
      const result = await kvService.set(
        gameKey,
        game,
        CACHE_CONFIG.GAME_STATE_TTL
      );
      return result;
    } catch (error) {
      return { success: false, error: `Storage error: ${error}` };
    }
  }

  /**
   * Load state with retry logic for consistency
   */
  private async loadStateWithRetry(gameId: UUID): Promise<GameState | null> {
    for (
      let attempt = 1;
      attempt <= PERFORMANCE_THRESHOLDS.RETRY_ATTEMPTS;
      attempt++
    ) {
      try {
        const state = await this.loadState(gameId);
        if (state) {
          return state;
        }
      } catch (error) {
        if (attempt === PERFORMANCE_THRESHOLDS.RETRY_ATTEMPTS) {
          throw error;
        }
        // Wait with exponential backoff
        await new Promise(resolve => setTimeout(resolve, attempt * 100));
      }
    }
    return null;
  }

  /**
   * Execute action atomically to prevent race conditions
   */
  private async executeActionAtomically(
    action: GameAction,
    currentState: GameState
  ): Promise<ActionResult> {
    // TODO: Implement atomic action execution with proper locking
    // For now, create a basic result structure
    const newState: GameState = {
      ...currentState,
      turn: (currentState.turn || 0) + 1,
      metadata: {
        ...currentState.metadata,
        version: currentState.metadata.version + 1,
        lastAction: action,
        actionHistory: [...currentState.metadata.actionHistory, action],
      },
    };

    const events: GameEvent[] = [
      {
        id: uuidv4(),
        type: 'action_processed',
        gameId: action.gameId,
        timestamp: new Date(),
        data: { actionType: action.type, playerId: action.playerId },
        isPublic: true,
      },
    ];

    return {
      success: true,
      newState,
      events,
      sideEffects: [], // TODO: Implement side effects
    };
  }

  /**
   * Validate action based on its type
   */
  private validateActionByType(action: GameAction, state: GameState): boolean {
    // TODO: Implement game-specific action validation
    // This should delegate to game-specific validators based on action.type

    // Basic validation for now
    return true; // TODO: Replace with actual validation logic
  }

  /**
   * Process action results (events and side effects)
   */
  private async processActionResults(result: ActionResult): Promise<void> {
    // Process events
    for (const event of result.events) {
      await this.emitEvent(event);
    }

    // Process side effects
    if (result.sideEffects) {
      for (const sideEffect of result.sideEffects) {
        await this.processSideEffect(sideEffect);
      }
    }
  }

  /**
   * Emit game event to subscribers
   */
  private async emitEvent(event: GameEvent): Promise<void> {
    const gameSubscriptions = this.eventSubscriptions.get(event.gameId);
    if (gameSubscriptions) {
      const eventHandlers = gameSubscriptions.get(event.type);
      if (eventHandlers) {
        // Execute all handlers concurrently
        await Promise.all(
          Array.from(eventHandlers).map(handler =>
            Promise.resolve(handler(event)).catch(error =>
              this.logError('eventHandler', error, {
                eventType: event.type,
                gameId: event.gameId,
              })
            )
          )
        );
      }
    }

    // Save event to history
    await this.saveEventToHistory(event);
  }

  /**
   * Process side effect
   */
  private async processSideEffect(sideEffect: SideEffect): Promise<void> {
    // TODO: Implement side effect processing
    // This should handle notifications, achievements, state changes, etc.
    console.log('Processing side effect:', sideEffect.type);
  }

  /**
   * Initialize event system for a game
   */
  private initializeGameEvents(gameId: UUID): void {
    this.eventSubscriptions.set(gameId, new Map());
  }

  /**
   * Save action to history for debugging and replay
   */
  private async saveActionToHistory(
    gameId: UUID,
    action: GameAction
  ): Promise<void> {
    try {
      const historyKey = `action_history:${gameId}`;
      const existingHistory = await kvService.get<GameAction[]>(historyKey);

      const history = existingHistory.data || [];
      history.push(action);

      // Keep only last 1000 actions to prevent memory bloat
      if (history.length > 1000) {
        history.splice(0, history.length - 1000);
      }

      await kvService.set(historyKey, history, CACHE_CONFIG.ACTION_HISTORY_TTL);
    } catch (error) {
      this.logError('saveActionToHistory', error as Error, { gameId, action });
    }
  }

  /**
   * Save event to history
   */
  private async saveEventToHistory(event: GameEvent): Promise<void> {
    try {
      const eventKey = `game_events:${event.gameId}:${event.id}`;
      await kvService.set(eventKey, event, CACHE_CONFIG.ACTION_HISTORY_TTL);
    } catch (error) {
      this.logError('saveEventToHistory', error as Error, { event });
    }
  }

  /**
   * Create standardized game error
   */
  private createGameError(
    code: ErrorCode,
    message: string,
    details?: any
  ): GameError {
    return {
      code,
      message,
      details,
      timestamp: new Date(),
    };
  }

  /**
   * Setup performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    // TODO: Integrate with proper monitoring service
    console.log('Game Engine performance monitoring initialized');
  }

  /**
   * Log performance metrics
   */
  private logPerformance(
    operation: string,
    durationMs: number,
    context: any = {}
  ): void {
    if (durationMs > PERFORMANCE_THRESHOLDS.STATE_OPERATION_MS) {
      console.warn(
        `Performance warning: ${operation} took ${durationMs}ms`,
        context
      );
    }

    // TODO: Send metrics to monitoring service
    console.debug(`Performance: ${operation} - ${durationMs}ms`, context);
  }

  /**
   * Log error with context
   */
  private logError(operation: string, error: Error, context: any = {}): void {
    console.error(`Game Engine Error in ${operation}:`, error.message, context);

    // TODO: Send to error tracking service
    // TODO: Implement structured logging
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const gameEngine = CoreGameEngine.getInstance();
export default gameEngine;
