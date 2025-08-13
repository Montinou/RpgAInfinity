/**
 * Unit Tests for Validation Service
 *
 * Tests validation rules, error handling, permissions,
 * state transitions, and custom validation rule management.
 */

import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { ValidationService } from '../validation';
import {
  GameAction,
  GameState,
  Game,
  Player,
  ActionValidationContext,
} from '@/types/core';

describe('ValidationService', () => {
  let validationService: ValidationService;
  let mockContext: ActionValidationContext;

  beforeEach(() => {
    validationService = ValidationService.getInstance();

    // Setup mock context
    const mockPlayer: Player = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Test Player',
      avatar: 'https://example.com/avatar.jpg',
      isActive: true,
      joinedAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      lastActivity: new Date(Date.now() - 1000), // 1 second ago
      gameSpecificData: {},
    };

    const mockGame: Game = {
      id: '550e8400-e29b-41d4-a716-446655440002',
      config: {
        type: 'rpg',
        name: 'Test Game',
        maxPlayers: 4,
        minPlayers: 2,
        estimatedDurationMinutes: 60,
        isPrivate: false,
        settings: {},
      },
      status: 'active',
      currentPhase: 'playing',
      createdAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      updatedAt: new Date(Date.now() - 1000), // 1 second ago
      createdBy: '550e8400-e29b-41d4-a716-446655440003',
      players: [mockPlayer],
      state: {
        gameId: '550e8400-e29b-41d4-a716-446655440002',
        phase: 'playing',
        turn: 1,
        data: {},
        metadata: { version: 1, actionHistory: [] },
      },
    };

    const mockAction: GameAction = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      type: 'test-action',
      playerId: '550e8400-e29b-41d4-a716-446655440001',
      gameId: '550e8400-e29b-41d4-a716-446655440002',
      timestamp: new Date(Date.now() - 1000), // 1 second ago
      data: { test: true },
    };

    const mockCurrentState: GameState = {
      gameId: '550e8400-e29b-41d4-a716-446655440002',
      phase: 'playing',
      turn: 1,
      data: {},
      metadata: { version: 1, actionHistory: [] },
    };

    mockContext = {
      action: mockAction,
      currentState: mockCurrentState,
      game: mockGame,
      player: mockPlayer,
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Action Validation', () => {
    test('should validate correct action structure', async () => {
      // Act
      const result = await validationService.validateAction(mockContext);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toEqual(expect.any(Array));
    });

    test('should reject action with missing ID', async () => {
      // Arrange
      const invalidContext = {
        ...mockContext,
        action: {
          ...mockContext.action,
          // @ts-ignore - Intentionally invalid for testing
          id: null,
        },
      };

      // Act
      const result = await validationService.validateAction(invalidContext);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Action must have a valid ID',
        })
      );
    });

    test('should reject action with missing type', async () => {
      // Arrange
      const invalidContext = {
        ...mockContext,
        action: {
          ...mockContext.action,
          // @ts-ignore - Intentionally invalid for testing
          type: '',
        },
      };

      // Act
      const result = await validationService.validateAction(invalidContext);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Action must have a valid type',
        })
      );
    });

    test('should reject action with invalid timestamp', async () => {
      // Arrange
      const invalidContext = {
        ...mockContext,
        action: {
          ...mockContext.action,
          // @ts-ignore - Intentionally invalid for testing
          timestamp: 'invalid-date',
        },
      };

      // Act
      const result = await validationService.validateAction(invalidContext);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Action must have a valid timestamp',
        })
      );
    });

    test('should reject future-dated actions', async () => {
      // Arrange
      const futureTimestamp = new Date(Date.now() + 10000); // 10 seconds in future
      const invalidContext = {
        ...mockContext,
        action: {
          ...mockContext.action,
          timestamp: futureTimestamp,
        },
      };

      // Act
      const result = await validationService.validateAction(invalidContext);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Action timestamp cannot be in the future',
        })
      );
    });

    test('should reject very old actions (replay attack prevention)', async () => {
      // Arrange
      const oldTimestamp = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      const invalidContext = {
        ...mockContext,
        action: {
          ...mockContext.action,
          timestamp: oldTimestamp,
        },
      };

      // Act
      const result = await validationService.validateAction(invalidContext);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Action timestamp is too old',
        })
      );
    });

    test('should handle validation rule exceptions', async () => {
      // Arrange - Register a rule that throws an error
      validationService.registerValidationRule(['test-action'], {
        name: 'throwing-rule',
        description: 'A rule that throws errors',
        priority: 'medium',
        validate: () => {
          throw new Error('Validation rule error');
        },
      });

      // Act
      const result = await validationService.validateAction(mockContext);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining(
            "Validation rule 'throwing-rule' failed"
          ),
        })
      );

      // Cleanup
      validationService.removeValidationRule('test-action', 'throwing-rule');
    });
  });

  describe('State Transition Validation', () => {
    let fromState: GameState;
    let toState: GameState;
    let action: GameAction;

    beforeEach(() => {
      fromState = {
        gameId: '550e8400-e29b-41d4-a716-446655440002',
        phase: 'playing',
        turn: 5,
        data: { health: 100 },
        metadata: {
          version: 10,
          actionHistory: [],
        },
      };

      toState = {
        gameId: '550e8400-e29b-41d4-a716-446655440002',
        phase: 'playing',
        turn: 6,
        data: { health: 90 },
        metadata: {
          version: 11,
          lastAction: {
            id: '550e8400-e29b-41d4-a716-446655440004',
            type: 'damage',
            playerId: '550e8400-e29b-41d4-a716-446655440001',
            gameId: '550e8400-e29b-41d4-a716-446655440002',
            timestamp: new Date(),
            data: { amount: 10 },
          },
          actionHistory: [
            {
              id: '550e8400-e29b-41d4-a716-446655440004',
              type: 'damage',
              playerId: '550e8400-e29b-41d4-a716-446655440001',
              gameId: '550e8400-e29b-41d4-a716-446655440002',
              timestamp: new Date(),
              data: { amount: 10 },
            },
          ],
        },
      };

      action = toState.metadata.lastAction!;
    });

    test('should validate correct state transition', async () => {
      // Act
      const result = await validationService.validateStateTransition(
        fromState,
        toState,
        action
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject state transition with incorrect version increment', async () => {
      // Arrange
      const invalidToState = {
        ...toState,
        metadata: {
          ...toState.metadata,
          version: 12, // Should be 11, not 12
        },
      };

      // Act
      const result = await validationService.validateStateTransition(
        fromState,
        invalidToState,
        action
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'State version must increment by exactly 1',
        })
      );
    });

    test('should reject state transition with backwards turn', async () => {
      // Arrange
      const invalidToState = {
        ...toState,
        turn: 4, // Less than fromState.turn (5)
      };

      // Act
      const result = await validationService.validateStateTransition(
        fromState,
        invalidToState,
        action
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Game turn cannot move backwards',
        })
      );
    });

    test('should reject state transition with changed game ID', async () => {
      // Arrange
      const invalidToState = {
        ...toState,
        gameId: 'different-game-id',
      };

      // Act
      const result = await validationService.validateStateTransition(
        fromState,
        invalidToState,
        action
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Game ID cannot change during state transition',
        })
      );
    });

    test('should reject state transition with incorrect action history', async () => {
      // Arrange
      const invalidToState = {
        ...toState,
        metadata: {
          ...toState.metadata,
          actionHistory: [], // Should contain the new action
        },
      };

      // Act
      const result = await validationService.validateStateTransition(
        fromState,
        invalidToState,
        action
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Action history must include exactly one new action',
        })
      );
    });

    test('should reject state transition with mismatched last action', async () => {
      // Arrange
      const differentAction = { ...action, id: 'different-action-id' };

      // Act
      const result = await validationService.validateStateTransition(
        fromState,
        toState,
        differentAction
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Last action in state must match the triggering action',
        })
      );
    });
  });

  describe('Player Permission Validation', () => {
    test('should validate permissions for valid player and action', async () => {
      // Act
      const result = await validationService.validatePlayerPermissions(
        mockContext.player,
        mockContext.action,
        mockContext.game
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject action from player not in game', async () => {
      // Arrange
      const gameWithoutPlayer = {
        ...mockContext.game,
        players: [], // Empty players list
      };

      // Act
      const result = await validationService.validatePlayerPermissions(
        mockContext.player,
        mockContext.action,
        gameWithoutPlayer
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'PERMISSION_DENIED',
          message: 'Player is not part of this game',
        })
      );
    });

    test('should reject action from inactive player', async () => {
      // Arrange
      const inactivePlayer = {
        ...mockContext.player,
        isActive: false,
      };

      // Act
      const result = await validationService.validatePlayerPermissions(
        inactivePlayer,
        mockContext.action,
        mockContext.game
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'PERMISSION_DENIED',
          message: 'Inactive players cannot perform actions',
        })
      );
    });

    test('should reject action when game is not active', async () => {
      // Arrange
      const inactiveGame = {
        ...mockContext.game,
        status: 'completed' as const,
      };

      // Act
      const result = await validationService.validatePlayerPermissions(
        mockContext.player,
        mockContext.action,
        inactiveGame
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_PHASE',
          message: 'Game is not active (current status: completed)',
        })
      );
    });

    test('should reject action with mismatched player ID', async () => {
      // Arrange
      const actionFromDifferentPlayer = {
        ...mockContext.action,
        playerId: 'different-player-id',
      };

      // Act
      const result = await validationService.validatePlayerPermissions(
        mockContext.player,
        actionFromDifferentPlayer,
        mockContext.game
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'PERMISSION_DENIED',
          message: 'Player can only perform their own actions',
        })
      );
    });
  });

  describe('Validation Rule Management', () => {
    test('should register and execute custom validation rule', async () => {
      // Arrange
      const mockRule = {
        name: 'test-custom-rule',
        description: 'A test rule',
        priority: 'high' as const,
        validate: jest.fn().mockResolvedValue({
          isValid: false,
          errors: [
            {
              code: 'VALIDATION_ERROR',
              message: 'Custom rule failed',
              timestamp: new Date(),
            },
          ],
          warnings: [],
        }),
      };

      // Act
      validationService.registerValidationRule(['test-action'], mockRule);
      const result = await validationService.validateAction(mockContext);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: 'Custom rule failed',
        })
      );
      expect(mockRule.validate).toHaveBeenCalledWith(mockContext);

      // Cleanup
      validationService.removeValidationRule('test-action', 'test-custom-rule');
    });

    test('should remove validation rule', async () => {
      // Arrange
      const mockRule = {
        name: 'removable-rule',
        description: 'A rule to be removed',
        priority: 'medium' as const,
        validate: jest.fn().mockResolvedValue({
          isValid: true,
          errors: [],
          warnings: [],
        }),
      };

      validationService.registerValidationRule(['test-action'], mockRule);

      // Act
      validationService.removeValidationRule('test-action', 'removable-rule');
      await validationService.validateAction(mockContext);

      // Assert
      expect(mockRule.validate).not.toHaveBeenCalled();
    });

    test('should get validation rules for action type', () => {
      // Arrange
      const mockRule = {
        name: 'get-rules-test',
        description: 'A test rule',
        priority: 'low' as const,
        validate: () => ({ isValid: true, errors: [], warnings: [] }),
      };

      validationService.registerValidationRule(['get-rules-action'], mockRule);

      // Act
      const rules = validationService.getValidationRules('get-rules-action');

      // Assert
      expect(rules).toContainEqual(mockRule);

      // Cleanup
      validationService.removeValidationRule(
        'get-rules-action',
        'get-rules-test'
      );
    });

    test('should replace existing rule with same name', async () => {
      // Arrange
      const originalRule = {
        name: 'replace-test',
        description: 'Original rule',
        priority: 'medium' as const,
        validate: jest.fn().mockResolvedValue({
          isValid: true,
          errors: [],
          warnings: ['Original rule executed'],
        }),
      };

      const newRule = {
        name: 'replace-test', // Same name
        description: 'New rule',
        priority: 'high' as const,
        validate: jest.fn().mockResolvedValue({
          isValid: true,
          errors: [],
          warnings: ['New rule executed'],
        }),
      };

      // Act
      validationService.registerValidationRule(
        ['replace-action'],
        originalRule
      );
      validationService.registerValidationRule(['replace-action'], newRule);

      const result = await validationService.validateAction({
        ...mockContext,
        action: { ...mockContext.action, type: 'replace-action' },
      });

      // Assert
      expect(originalRule.validate).not.toHaveBeenCalled();
      expect(newRule.validate).toHaveBeenCalled();
      expect(result.warnings).toContain('New rule executed');

      // Cleanup
      validationService.removeValidationRule('replace-action', 'replace-test');
    });
  });

  describe('Singleton Pattern', () => {
    test('should return same instance on multiple getInstance calls', () => {
      // Act
      const instance1 = ValidationService.getInstance();
      const instance2 = ValidationService.getInstance();

      // Assert
      expect(instance1).toBe(instance2);
    });
  });
});
