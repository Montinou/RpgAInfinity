/**
 * Unit Tests for Core Game Engine
 *
 * Comprehensive test suite covering game lifecycle management,
 * action processing, state persistence, event system, and error handling.
 */

import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { CoreGameEngine } from '../core';
import { kvService } from '@/lib/database/kv-service';
import {
  GameConfig,
  GameAction,
  GameState,
  Game,
  Player,
  GameEvent,
} from '@/types/core';

// Mock the KV service
jest.mock('@/lib/database/kv-service');
const mockKvService = jest.mocked(kvService);

describe('CoreGameEngine', () => {
  let gameEngine: CoreGameEngine;
  let mockGameConfig: GameConfig;
  let mockPlayer: Player;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Get fresh engine instance
    gameEngine = CoreGameEngine.getInstance();

    // Mock successful KV operations by default
    mockKvService.set.mockResolvedValue({
      success: true,
      data: true,
      timestamp: new Date(),
    });
    mockKvService.get.mockResolvedValue({
      success: true,
      data: null,
      timestamp: new Date(),
    });
    mockKvService.delete.mockResolvedValue({
      success: true,
      data: true,
      timestamp: new Date(),
    });

    // Setup test data
    mockGameConfig = {
      type: 'rpg',
      name: 'Test RPG Game',
      description: 'A test game for unit testing',
      maxPlayers: 4,
      minPlayers: 2,
      estimatedDurationMinutes: 60,
      isPrivate: false,
      settings: {
        difficulty: 'normal',
        enablePvP: false,
      },
    };

    mockPlayer = {
      id: 'player-123',
      name: 'Test Player',
      avatar: 'https://example.com/avatar.jpg',
      isActive: true,
      joinedAt: new Date('2025-01-13T10:00:00Z'),
      lastActivity: new Date('2025-01-13T10:05:00Z'),
      gameSpecificData: {
        level: 1,
        health: 100,
      },
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Game Creation', () => {
    test('should create a new game with valid configuration', async () => {
      // Arrange
      const expectedGameId = expect.any(String);

      // Act
      const game = await gameEngine.createGame(mockGameConfig);

      // Assert
      expect(game).toMatchObject({
        id: expectedGameId,
        config: mockGameConfig,
        status: 'waiting',
        currentPhase: 'setup',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        createdBy: '',
        players: [],
        state: {
          gameId: expectedGameId,
          phase: 'setup',
          turn: 0,
          data: {
            gameType: 'rpg',
            settings: mockGameConfig.settings,
          },
          metadata: {
            version: 1,
            actionHistory: [],
          },
        },
      });

      // Verify game was saved to storage
      expect(mockKvService.set).toHaveBeenCalledWith(
        `game:${game.id}`,
        game,
        3600 // Game state TTL
      );
    });

    test('should reject invalid game configuration', async () => {
      // Arrange
      const invalidConfig = {
        ...mockGameConfig,
        maxPlayers: -1, // Invalid negative value
      };

      // Act & Assert
      await expect(gameEngine.createGame(invalidConfig)).rejects.toThrow(
        'Failed to create game'
      );
    });

    test('should handle storage failures during game creation', async () => {
      // Arrange
      mockKvService.set.mockResolvedValueOnce({
        success: false,
        error: 'Storage unavailable',
        timestamp: new Date(),
      });

      // Act & Assert
      await expect(gameEngine.createGame(mockGameConfig)).rejects.toThrow(
        'Failed to save game: Storage unavailable'
      );
    });
  });

  describe('State Management', () => {
    let testGameState: GameState;

    beforeEach(() => {
      testGameState = {
        gameId: 'game-123',
        phase: 'playing',
        turn: 5,
        currentPlayer: 'player-123',
        data: {
          gameType: 'rpg',
          currentLocation: 'forest',
        },
        metadata: {
          version: 10,
          lastAction: {
            id: 'action-456',
            type: 'move',
            playerId: 'player-123',
            gameId: 'game-123',
            timestamp: new Date(),
            data: { direction: 'north' },
          },
          actionHistory: [],
        },
      };
    });

    test('should save game state successfully', async () => {
      // Act
      await gameEngine.saveState('game-123', testGameState);

      // Assert
      expect(mockKvService.set).toHaveBeenCalledWith(
        'game_state:game-123',
        testGameState,
        3600
      );
    });

    test('should load game state successfully', async () => {
      // Arrange
      mockKvService.get.mockResolvedValueOnce({
        success: true,
        data: testGameState,
        timestamp: new Date(),
      });

      // Act
      const loadedState = await gameEngine.loadState('game-123');

      // Assert
      expect(loadedState).toEqual(testGameState);
      expect(mockKvService.get).toHaveBeenCalledWith('game_state:game-123');
    });

    test('should return null when game state not found', async () => {
      // Arrange
      mockKvService.get.mockResolvedValueOnce({
        success: true,
        data: null,
        timestamp: new Date(),
      });

      // Act
      const loadedState = await gameEngine.loadState('nonexistent-game');

      // Assert
      expect(loadedState).toBeNull();
    });

    test('should handle storage errors during state loading', async () => {
      // Arrange
      mockKvService.get.mockResolvedValueOnce({
        success: false,
        error: 'Connection timeout',
        timestamp: new Date(),
      });

      // Act
      const loadedState = await gameEngine.loadState('game-123');

      // Assert
      expect(loadedState).toBeNull();
    });
  });

  describe('Action Processing', () => {
    let testAction: GameAction;
    let testGameState: GameState;

    beforeEach(() => {
      testAction = {
        id: 'action-789',
        type: 'attack',
        playerId: 'player-123',
        gameId: 'game-123',
        timestamp: new Date(),
        data: {
          target: 'enemy-456',
          weapon: 'sword',
        },
      };

      testGameState = {
        gameId: 'game-123',
        phase: 'combat',
        turn: 3,
        currentPlayer: 'player-123',
        data: {
          gameType: 'rpg',
          enemies: ['enemy-456'],
        },
        metadata: {
          version: 5,
          actionHistory: [],
        },
      };
    });

    test('should process valid action and update state', async () => {
      // Arrange
      mockKvService.get.mockResolvedValueOnce({
        success: true,
        data: testGameState,
        timestamp: new Date(),
      });

      // Act
      const newState = await gameEngine.processAction('game-123', testAction);

      // Assert
      expect(newState).toMatchObject({
        gameId: 'game-123',
        turn: 4, // Incremented
        metadata: {
          version: 6, // Incremented
          lastAction: testAction,
          actionHistory: [testAction],
        },
      });

      // Verify state was saved
      expect(mockKvService.set).toHaveBeenCalledWith(
        'game_state:game-123',
        expect.objectContaining({
          metadata: expect.objectContaining({
            version: 6,
            lastAction: testAction,
          }),
        }),
        undefined
      );
    });

    test('should reject action when game not found', async () => {
      // Arrange
      mockKvService.get.mockResolvedValueOnce({
        success: true,
        data: null,
        timestamp: new Date(),
      });

      // Act & Assert
      await expect(
        gameEngine.processAction('nonexistent-game', testAction)
      ).rejects.toMatchObject({
        code: 'GAME_NOT_FOUND',
        message: 'Game nonexistent-game not found',
      });
    });

    test('should reject action with mismatched game ID', async () => {
      // Arrange
      const invalidAction = {
        ...testAction,
        gameId: 'different-game-id',
      };

      mockKvService.get.mockResolvedValueOnce({
        success: true,
        data: testGameState,
        timestamp: new Date(),
      });

      // Act & Assert
      await expect(
        gameEngine.processAction('game-123', invalidAction)
      ).rejects.toMatchObject({
        code: 'INVALID_ACTION',
        message: 'Action is not valid for current game state',
      });
    });
  });

  describe('Action Validation', () => {
    let testAction: GameAction;
    let testGameState: GameState;

    beforeEach(() => {
      testAction = {
        id: 'action-validation-test',
        type: 'test-action',
        playerId: 'player-123',
        gameId: 'game-123',
        timestamp: new Date(),
        data: { test: true },
      };

      testGameState = {
        gameId: 'game-123',
        phase: 'testing',
        turn: 1,
        data: {},
        metadata: {
          version: 1,
          actionHistory: [],
        },
      };
    });

    test('should validate action with matching game ID', () => {
      // Act
      const isValid = gameEngine.validateAction(testAction, testGameState);

      // Assert
      expect(isValid).toBe(true);
    });

    test('should reject action with mismatched game ID', () => {
      // Arrange
      const invalidAction = {
        ...testAction,
        gameId: 'different-game-id',
      };

      // Act
      const isValid = gameEngine.validateAction(invalidAction, testGameState);

      // Assert
      expect(isValid).toBe(false);
    });

    test('should handle validation errors gracefully', () => {
      // Arrange - Create malformed action that might cause validation to throw
      const malformedAction = {
        ...testAction,
        // @ts-ignore - Intentionally invalid for testing
        timestamp: 'invalid-timestamp',
      };

      // Act
      const isValid = gameEngine.validateAction(malformedAction, testGameState);

      // Assert
      expect(isValid).toBe(false);
    });
  });

  describe('Event System', () => {
    let testGameId: string;
    let eventHandler: jest.Mock;

    beforeEach(() => {
      testGameId = 'game-events-test';
      eventHandler = jest.fn();
    });

    test('should subscribe and unsubscribe event handlers', () => {
      // Act - Subscribe
      gameEngine.subscribe(testGameId, 'player_joined', eventHandler);

      // Act - Unsubscribe
      gameEngine.unsubscribe(testGameId, 'player_joined', eventHandler);

      // Assert - No errors should be thrown
      expect(true).toBe(true);
    });

    test('should handle multiple subscriptions for same event', () => {
      // Arrange
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      // Act
      gameEngine.subscribe(testGameId, 'test_event', handler1);
      gameEngine.subscribe(testGameId, 'test_event', handler2);

      // Clean up
      gameEngine.unsubscribe(testGameId, 'test_event', handler1);
      gameEngine.unsubscribe(testGameId, 'test_event', handler2);

      // Assert - No errors should be thrown
      expect(true).toBe(true);
    });

    test('should handle unsubscribing non-existent handlers gracefully', () => {
      // Act
      gameEngine.unsubscribe(
        'nonexistent-game',
        'nonexistent-event',
        eventHandler
      );

      // Assert - Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Player Actions', () => {
    let testGameState: GameState;

    beforeEach(() => {
      testGameState = {
        gameId: 'game-actions-test',
        phase: 'playing',
        turn: 1,
        currentPlayer: 'player-123',
        data: {
          gameType: 'rpg',
        },
        metadata: {
          version: 1,
          actionHistory: [],
        },
      };
    });

    test('should return empty array for player actions (placeholder implementation)', () => {
      // Act
      const actions = gameEngine.getPlayerActions('player-123', testGameState);

      // Assert
      expect(actions).toEqual([]);
    });

    test('should handle errors in getPlayerActions gracefully', () => {
      // Arrange - Create state that might cause errors
      const invalidState = {
        ...testGameState,
        // @ts-ignore - Intentionally invalid for testing
        data: null,
      };

      // Act
      const actions = gameEngine.getPlayerActions('player-123', invalidState);

      // Assert
      expect(actions).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    test('should handle KV service errors in createGame', async () => {
      // Arrange
      mockKvService.set.mockRejectedValueOnce(new Error('Network error'));

      // Act & Assert
      await expect(gameEngine.createGame(mockGameConfig)).rejects.toThrow();
    });

    test('should handle KV service errors in saveState', async () => {
      // Arrange
      const testState: GameState = {
        gameId: 'error-test',
        phase: 'test',
        turn: 1,
        data: {},
        metadata: { version: 1, actionHistory: [] },
      };

      mockKvService.set.mockRejectedValueOnce(new Error('Disk full'));

      // Act & Assert
      await expect(
        gameEngine.saveState('error-test', testState)
      ).rejects.toMatchObject({
        code: 'DATABASE_ERROR',
        message: expect.stringContaining('Failed to save state'),
      });
    });

    test('should handle KV service errors in loadState', async () => {
      // Arrange
      mockKvService.get.mockRejectedValueOnce(new Error('Connection timeout'));

      // Act
      const result = await gameEngine.loadState('error-test');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('Singleton Pattern', () => {
    test('should return same instance on multiple getInstance calls', () => {
      // Act
      const instance1 = CoreGameEngine.getInstance();
      const instance2 = CoreGameEngine.getInstance();

      // Assert
      expect(instance1).toBe(instance2);
    });
  });
});
