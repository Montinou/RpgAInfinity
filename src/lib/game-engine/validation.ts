/**
 * Game Engine Validation Service
 *
 * Provides comprehensive validation for game actions, state transitions,
 * and business logic enforcement to ensure game integrity and prevent
 * invalid states or exploits.
 */

import {
  GameAction,
  GameState,
  Game,
  Player,
  GameConfig,
  GameError,
  ErrorCode,
  UUID,
} from '@/types/core';

// ============================================================================
// VALIDATION RESULT TYPES
// ============================================================================

export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: GameError[];
  readonly warnings: string[];
}

export interface ActionValidationContext {
  readonly action: GameAction;
  readonly currentState: GameState;
  readonly game: Game;
  readonly player: Player;
}

// ============================================================================
// VALIDATION RULES INTERFACE
// ============================================================================

export interface ValidationRule {
  readonly name: string;
  readonly description: string;
  readonly priority: 'critical' | 'high' | 'medium' | 'low';
  validate(
    context: ActionValidationContext
  ): ValidationResult | Promise<ValidationResult>;
}

// ============================================================================
// CORE VALIDATION SERVICE
// ============================================================================

export class ValidationService {
  private static instance: ValidationService;
  private validationRules: Map<string, ValidationRule[]> = new Map();

  private constructor() {
    this.initializeBaseValidationRules();
  }

  static getInstance(): ValidationService {
    if (!ValidationService.instance) {
      ValidationService.instance = new ValidationService();
    }
    return ValidationService.instance;
  }

  // ============================================================================
  // PUBLIC VALIDATION METHODS
  // ============================================================================

  /**
   * Validate an action against current game state
   */
  async validateAction(
    context: ActionValidationContext
  ): Promise<ValidationResult> {
    const results: ValidationResult[] = [];

    try {
      // Get applicable rules for this action type
      const rules = this.getValidationRules(context.action.type);

      // Run all validation rules
      for (const rule of rules) {
        try {
          const result = await Promise.resolve(rule.validate(context));
          results.push(result);
        } catch (error) {
          results.push({
            isValid: false,
            errors: [
              {
                code: 'VALIDATION_ERROR',
                message: `Validation rule '${rule.name}' failed: ${error}`,
                timestamp: new Date(),
                gameId: context.game.id,
                playerId: context.player.id,
              },
            ],
            warnings: [],
          });
        }
      }

      // Combine all results
      return this.combineValidationResults(results);
    } catch (error) {
      return {
        isValid: false,
        errors: [
          {
            code: 'VALIDATION_ERROR',
            message: `Action validation failed: ${error}`,
            timestamp: new Date(),
            gameId: context.game.id,
            playerId: context.player.id,
          },
        ],
        warnings: [],
      };
    }
  }

  /**
   * Validate game state transition
   */
  async validateStateTransition(
    fromState: GameState,
    toState: GameState,
    action: GameAction
  ): Promise<ValidationResult> {
    const errors: GameError[] = [];
    const warnings: string[] = [];

    try {
      // Version consistency check
      if (toState.metadata.version !== fromState.metadata.version + 1) {
        errors.push(
          this.createValidationError(
            'VALIDATION_ERROR',
            'State version must increment by exactly 1',
            {
              expectedVersion: fromState.metadata.version + 1,
              actualVersion: toState.metadata.version,
            }
          )
        );
      }

      // Turn progression check
      if (toState.turn !== undefined && fromState.turn !== undefined) {
        if (toState.turn < fromState.turn) {
          errors.push(
            this.createValidationError(
              'VALIDATION_ERROR',
              'Game turn cannot move backwards',
              { fromTurn: fromState.turn, toTurn: toState.turn }
            )
          );
        }
      }

      // Game ID consistency
      if (fromState.gameId !== toState.gameId) {
        errors.push(
          this.createValidationError(
            'VALIDATION_ERROR',
            'Game ID cannot change during state transition',
            { fromGameId: fromState.gameId, toGameId: toState.gameId }
          )
        );
      }

      // Action history integrity
      const expectedActionCount = fromState.metadata.actionHistory.length + 1;
      if (toState.metadata.actionHistory.length !== expectedActionCount) {
        errors.push(
          this.createValidationError(
            'VALIDATION_ERROR',
            'Action history must include exactly one new action',
            {
              expectedCount: expectedActionCount,
              actualCount: toState.metadata.actionHistory.length,
            }
          )
        );
      }

      // Last action consistency
      if (toState.metadata.lastAction?.id !== action.id) {
        errors.push(
          this.createValidationError(
            'VALIDATION_ERROR',
            'Last action in state must match the triggering action',
            {
              expectedActionId: action.id,
              actualActionId: toState.metadata.lastAction?.id,
            }
          )
        );
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [
          {
            code: 'VALIDATION_ERROR',
            message: `State transition validation failed: ${error}`,
            timestamp: new Date(),
            gameId: fromState.gameId,
          },
        ],
        warnings,
      };
    }
  }

  /**
   * Validate player permissions for an action
   */
  async validatePlayerPermissions(
    player: Player,
    action: GameAction,
    game: Game
  ): Promise<ValidationResult> {
    const errors: GameError[] = [];
    const warnings: string[] = [];

    try {
      // Check if player is in the game
      const playerInGame = game.players.some(p => p.id === player.id);
      if (!playerInGame) {
        errors.push(
          this.createValidationError(
            'PERMISSION_DENIED',
            'Player is not part of this game',
            { playerId: player.id, gameId: game.id }
          )
        );
      }

      // Check if player is active
      if (!player.isActive) {
        errors.push(
          this.createValidationError(
            'PERMISSION_DENIED',
            'Inactive players cannot perform actions',
            { playerId: player.id }
          )
        );
      }

      // Check game status
      if (game.status !== 'active') {
        errors.push(
          this.createValidationError(
            'INVALID_PHASE',
            `Game is not active (current status: ${game.status})`,
            { gameStatus: game.status }
          )
        );
      }

      // Action ownership validation
      if (action.playerId !== player.id) {
        errors.push(
          this.createValidationError(
            'PERMISSION_DENIED',
            'Player can only perform their own actions',
            { actionPlayerId: action.playerId, actualPlayerId: player.id }
          )
        );
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [
          {
            code: 'VALIDATION_ERROR',
            message: `Permission validation failed: ${error}`,
            timestamp: new Date(),
            gameId: game.id,
            playerId: player.id,
          },
        ],
        warnings,
      };
    }
  }

  // ============================================================================
  // VALIDATION RULE MANAGEMENT
  // ============================================================================

  /**
   * Register a custom validation rule for specific action types
   */
  registerValidationRule(actionTypes: string[], rule: ValidationRule): void {
    for (const actionType of actionTypes) {
      if (!this.validationRules.has(actionType)) {
        this.validationRules.set(actionType, []);
      }

      const rules = this.validationRules.get(actionType)!;

      // Remove existing rule with same name
      const existingIndex = rules.findIndex(r => r.name === rule.name);
      if (existingIndex >= 0) {
        rules.splice(existingIndex, 1);
      }

      // Insert rule based on priority
      const insertIndex = this.findInsertionIndex(rules, rule.priority);
      rules.splice(insertIndex, 0, rule);
    }
  }

  /**
   * Remove a validation rule
   */
  removeValidationRule(actionType: string, ruleName: string): void {
    const rules = this.validationRules.get(actionType);
    if (rules) {
      const index = rules.findIndex(r => r.name === ruleName);
      if (index >= 0) {
        rules.splice(index, 1);
      }
    }
  }

  /**
   * Get all validation rules for an action type
   */
  getValidationRules(actionType: string): ValidationRule[] {
    const specificRules = this.validationRules.get(actionType) || [];
    const universalRules = this.validationRules.get('*') || [];
    return [...universalRules, ...specificRules];
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Initialize base validation rules that apply to all games
   */
  private initializeBaseValidationRules(): void {
    // Basic action structure validation
    this.registerValidationRule(['*'], {
      name: 'basic-action-structure',
      description: 'Validates basic action structure and required fields',
      priority: 'critical',
      validate: context => this.validateBasicActionStructure(context),
    });

    // Timing validation
    this.registerValidationRule(['*'], {
      name: 'action-timing',
      description: 'Validates action timing and prevents replay attacks',
      priority: 'high',
      validate: context => this.validateActionTiming(context),
    });

    // Rate limiting validation
    this.registerValidationRule(['*'], {
      name: 'rate-limiting',
      description: 'Prevents action spam and enforces rate limits',
      priority: 'high',
      validate: context => this.validateRateLimit(context),
    });
  }

  /**
   * Validate basic action structure
   */
  private validateBasicActionStructure(
    context: ActionValidationContext
  ): ValidationResult {
    const errors: GameError[] = [];
    const warnings: string[] = [];
    const { action } = context;

    // Required fields validation
    if (!action.id || typeof action.id !== 'string') {
      errors.push(
        this.createValidationError(
          'VALIDATION_ERROR',
          'Action must have a valid ID'
        )
      );
    }

    if (!action.type || typeof action.type !== 'string') {
      errors.push(
        this.createValidationError(
          'VALIDATION_ERROR',
          'Action must have a valid type'
        )
      );
    }

    if (!action.playerId || typeof action.playerId !== 'string') {
      errors.push(
        this.createValidationError(
          'VALIDATION_ERROR',
          'Action must have a valid player ID'
        )
      );
    }

    if (!action.gameId || typeof action.gameId !== 'string') {
      errors.push(
        this.createValidationError(
          'VALIDATION_ERROR',
          'Action must have a valid game ID'
        )
      );
    }

    if (!action.timestamp || !(action.timestamp instanceof Date)) {
      errors.push(
        this.createValidationError(
          'VALIDATION_ERROR',
          'Action must have a valid timestamp'
        )
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate action timing
   */
  private validateActionTiming(
    context: ActionValidationContext
  ): ValidationResult {
    const errors: GameError[] = [];
    const warnings: string[] = [];
    const { action } = context;

    const now = new Date();
    const actionTime = action.timestamp;

    // Action cannot be from the future (allow 5 seconds clock skew)
    if (actionTime.getTime() > now.getTime() + 5000) {
      errors.push(
        this.createValidationError(
          'VALIDATION_ERROR',
          'Action timestamp cannot be in the future',
          {
            actionTime: actionTime.toISOString(),
            serverTime: now.toISOString(),
          }
        )
      );
    }

    // Action cannot be too old (prevent replay attacks)
    const maxAgeMs = 5 * 60 * 1000; // 5 minutes
    if (actionTime.getTime() < now.getTime() - maxAgeMs) {
      errors.push(
        this.createValidationError(
          'VALIDATION_ERROR',
          'Action timestamp is too old',
          { actionTime: actionTime.toISOString(), maxAgeMinutes: 5 }
        )
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate rate limiting
   */
  private async validateRateLimit(
    context: ActionValidationContext
  ): Promise<ValidationResult> {
    const errors: GameError[] = [];
    const warnings: string[] = [];

    try {
      // TODO: Implement rate limiting check using KV service
      // For now, this is a placeholder that always passes

      // Basic rate limit: 1 action per second per player
      const rateLimitKey = `rate_limit:${context.player.id}`;
      // const rateLimit = await kvService.checkRateLimit(rateLimitKey, 1, 1);

      // if (rateLimit.count > rateLimit.limit) {
      //   errors.push(this.createValidationError(
      //     'RATE_LIMIT_EXCEEDED',
      //     'Too many actions, please slow down'
      //   ));
      // }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      warnings.push(`Rate limiting validation failed: ${error}`);
      return { isValid: true, errors, warnings }; // Allow action if rate limiting fails
    }
  }

  /**
   * Combine multiple validation results
   */
  private combineValidationResults(
    results: ValidationResult[]
  ): ValidationResult {
    const allErrors: GameError[] = [];
    const allWarnings: string[] = [];
    let isValid = true;

    for (const result of results) {
      if (!result.isValid) {
        isValid = false;
      }
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
    }

    return {
      isValid,
      errors: allErrors,
      warnings: allWarnings,
    };
  }

  /**
   * Create a standardized validation error
   */
  private createValidationError(
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
   * Find insertion index for rule based on priority
   */
  private findInsertionIndex(
    rules: ValidationRule[],
    priority: ValidationRule['priority']
  ): number {
    const priorities = ['critical', 'high', 'medium', 'low'];
    const priorityValue = priorities.indexOf(priority);

    for (let i = 0; i < rules.length; i++) {
      const rulePriorityValue = priorities.indexOf(rules[i].priority);
      if (priorityValue < rulePriorityValue) {
        return i;
      }
    }

    return rules.length;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const validationService = ValidationService.getInstance();
export default validationService;
