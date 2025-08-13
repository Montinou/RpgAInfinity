/**
 * Unit Tests for Concurrency Manager
 *
 * Tests distributed locking, atomic operations, batch processing,
 * optimistic concurrency control, and error handling.
 */

import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { ConcurrencyManager } from '../concurrency';
import { kvService } from '@/lib/database/kv-service';
import { GameState, GameAction } from '@/types/core';

// Mock the KV service
jest.mock('@/lib/database/kv-service');
const mockKvService = jest.mocked(kvService);

// Mock performance.now for consistent timing
const mockPerformanceNow = jest.fn();
Object.defineProperty(global, 'performance', {
  value: { now: mockPerformanceNow },
});

describe('ConcurrencyManager', () => {
  let concurrencyManager: ConcurrencyManager;
  let mockGameState: GameState;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset performance.now mock
    mockPerformanceNow.mockReturnValue(1000);

    concurrencyManager = ConcurrencyManager.getInstance();

    // Mock successful KV operations by default
    mockKvService.get.mockResolvedValue({
      success: true,
      data: null,
      timestamp: new Date(),
    });
    mockKvService.set.mockResolvedValue({
      success: true,
      data: true,
      timestamp: new Date(),
    });
    mockKvService.delete.mockResolvedValue({
      success: true,
      data: true,
      timestamp: new Date(),
    });

    mockGameState = {
      gameId: 'game-123',
      phase: 'playing',
      turn: 5,
      data: { score: 100 },
      metadata: {
        version: 10,
        actionHistory: [],
      },
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Distributed Locking', () => {
    test('should acquire lock successfully when no existing lock', async () => {
      // Arrange
      mockKvService.get.mockResolvedValueOnce({
        success: true,
        data: null, // No existing lock
        timestamp: new Date(),
      });

      // Act
      const result = await concurrencyManager.acquireLock(
        'game-123',
        'player-456',
        'test-operation'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        lockId: expect.any(String),
        gameId: 'game-123',
        playerId: 'player-456',
        operation: 'test-operation',
        acquiredAt: expect.any(Date),
        expiresAt: expect.any(Date),
      });

      expect(mockKvService.set).toHaveBeenCalledWith(
        'game_lock:game-123',
        expect.objectContaining({
          gameId: 'game-123',
          playerId: 'player-456',
          operation: 'test-operation',
        }),
        30 // default TTL
      );
    });

    test('should fail to acquire lock when already held by another operation', async () => {
      // Arrange
      const existingLock = {
        lockId: 'existing-lock-123',
        gameId: 'game-123',
        playerId: 'other-player',
        acquiredAt: new Date(),
        expiresAt: new Date(Date.now() + 10000), // Not expired
        operation: 'other-operation',
      };

      mockKvService.get.mockResolvedValueOnce({
        success: true,
        data: existingLock,
        timestamp: new Date(),
      });

      // Act
      const result = await concurrencyManager.acquireLock(
        'game-123',
        'player-456',
        'test-operation'
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toMatchObject({
        code: 'PERMISSION_DENIED',
        message: 'Game is locked by another operation',
        details: expect.objectContaining({
          lockedBy: 'other-player',
          operation: 'other-operation',
        }),
      });

      expect(mockKvService.set).not.toHaveBeenCalled();
    });

    test('should acquire lock when existing lock is expired', async () => {
      // Arrange
      const expiredLock = {
        lockId: 'expired-lock-123',
        gameId: 'game-123',
        playerId: 'other-player',
        acquiredAt: new Date(Date.now() - 60000),
        expiresAt: new Date(Date.now() - 1000), // Expired
        operation: 'expired-operation',
      };

      mockKvService.get.mockResolvedValueOnce({
        success: true,
        data: expiredLock,
        timestamp: new Date(),
      });

      // Act
      const result = await concurrencyManager.acquireLock(
        'game-123',
        'player-456',
        'test-operation'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.playerId).toBe('player-456');
    });

    test('should handle KV errors during lock acquisition', async () => {
      // Arrange
      mockKvService.get.mockRejectedValueOnce(new Error('Network error'));

      // Act
      const result = await concurrencyManager.acquireLock(
        'game-123',
        'player-456',
        'test-operation'
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toMatchObject({
        code: 'DATABASE_ERROR',
        message: expect.stringContaining('Lock acquisition failed'),
      });
    });

    test('should release lock successfully', async () => {
      // Arrange - First acquire a lock
      const lockInfo = {
        lockId: 'lock-456',
        gameId: 'game-123',
        playerId: 'player-456',
        acquiredAt: new Date(),
        expiresAt: new Date(Date.now() + 30000),
        operation: 'test-operation',
      };

      mockKvService.get.mockResolvedValueOnce({
        success: true,
        data: lockInfo,
        timestamp: new Date(),
      });

      // Act
      const result = await concurrencyManager.releaseLock(lockInfo);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
      expect(mockKvService.delete).toHaveBeenCalledWith('game_lock:game-123');
    });

    test('should fail to release lock owned by another operation', async () => {
      // Arrange
      const ownLockInfo = {
        lockId: 'own-lock-123',
        gameId: 'game-123',
        playerId: 'player-456',
        acquiredAt: new Date(),
        expiresAt: new Date(Date.now() + 30000),
        operation: 'test-operation',
      };

      const otherLockInfo = {
        lockId: 'other-lock-456',
        gameId: 'game-123',
        playerId: 'other-player',
        acquiredAt: new Date(),
        expiresAt: new Date(Date.now() + 30000),
        operation: 'other-operation',
      };

      mockKvService.get.mockResolvedValueOnce({
        success: true,
        data: otherLockInfo,
        timestamp: new Date(),
      });

      // Act
      const result = await concurrencyManager.releaseLock(ownLockInfo);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toMatchObject({
        code: 'PERMISSION_DENIED',
        message: 'Cannot release lock owned by another operation',
      });
    });
  });

  describe('Atomic Operations', () => {
    test('should execute atomic operation successfully', async () => {
      // Arrange
      const operation = {
        operationId: 'op-123',
        gameId: 'game-123',
        playerId: 'player-456',
        expectedVersion: 10,
        operation: jest.fn().mockResolvedValue({
          ...mockGameState,
          metadata: {
            ...mockGameState.metadata,
            version: 11,
          },
        }),
      };

      // Mock successful lock acquisition
      mockKvService.get
        .mockResolvedValueOnce({
          success: true,
          data: null,
          timestamp: new Date(),
        }) // No existing lock
        .mockResolvedValueOnce({
          success: true,
          data: mockGameState,
          timestamp: new Date(),
        }); // Current state

      // Act
      const result = await concurrencyManager.executeAtomic(operation);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        metadata: {
          version: 11,
        },
      });
      expect(operation.operation).toHaveBeenCalledWith(mockGameState);
    });

    test('should retry on version conflict', async () => {
      // Arrange
      let callCount = 0;
      const operation = {
        operationId: 'op-retry-test',
        gameId: 'game-123',
        playerId: 'player-456',
        expectedVersion: 9, // Wrong version initially
        operation: jest.fn().mockResolvedValue({
          ...mockGameState,
          metadata: { ...mockGameState.metadata, version: 11 },
        }),
      };

      // Mock lock acquisition and state loading
      mockKvService.get.mockImplementation((key: string) => {
        if (key.includes('game_lock:')) {
          return Promise.resolve({
            success: true,
            data: null,
            timestamp: new Date(),
          });
        } else if (key.includes('game_state:')) {
          callCount++;
          if (callCount === 1) {
            // First call - version mismatch
            return Promise.resolve({
              success: true,
              data: {
                ...mockGameState,
                metadata: { ...mockGameState.metadata, version: 10 },
              },
              timestamp: new Date(),
            });
          } else {
            // Second call (after retry) - version matches
            return Promise.resolve({
              success: true,
              data: {
                ...mockGameState,
                metadata: { ...mockGameState.metadata, version: 9 },
              },
              timestamp: new Date(),
            });
          }
        }
        return Promise.resolve({
          success: true,
          data: null,
          timestamp: new Date(),
        });
      });

      // Update expected version for retry
      operation.expectedVersion = 10; // This would be updated in real scenario

      // Act
      const result = await concurrencyManager.executeAtomic({
        ...operation,
        expectedVersion: 10,
      });

      // Assert
      expect(result.retryCount).toBeGreaterThan(0);
    });

    test('should fail after maximum retries on persistent version conflicts', async () => {
      // Arrange
      const operation = {
        operationId: 'op-fail-test',
        gameId: 'game-123',
        playerId: 'player-456',
        expectedVersion: 5, // Always wrong
        retryCount: 2, // Max 2 retries
        operation: jest.fn().mockResolvedValue({
          ...mockGameState,
          metadata: { ...mockGameState.metadata, version: 11 },
        }),
      };

      // Mock state with different version every time
      mockKvService.get.mockImplementation((key: string) => {
        if (key.includes('game_lock:')) {
          return Promise.resolve({
            success: true,
            data: null,
            timestamp: new Date(),
          });
        } else if (key.includes('game_state:')) {
          return Promise.resolve({
            success: true,
            data: mockGameState, // Version is 10, expected is 5
            timestamp: new Date(),
          });
        }
        return Promise.resolve({
          success: true,
          data: null,
          timestamp: new Date(),
        });
      });

      // Act
      const result = await concurrencyManager.executeAtomic(operation);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('State version conflict'),
      });
    });

    test('should validate new state version increment', async () => {
      // Arrange
      const operation = {
        operationId: 'op-version-test',
        gameId: 'game-123',
        playerId: 'player-456',
        expectedVersion: 10,
        operation: jest.fn().mockResolvedValue({
          ...mockGameState,
          metadata: {
            ...mockGameState.metadata,
            version: 12, // Invalid increment (should be 11)
          },
        }),
      };

      // Mock successful setup
      mockKvService.get
        .mockResolvedValueOnce({
          success: true,
          data: null,
          timestamp: new Date(),
        }) // No lock
        .mockResolvedValueOnce({
          success: true,
          data: mockGameState,
          timestamp: new Date(),
        }); // Current state

      // Act
      const result = await concurrencyManager.executeAtomic(operation);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Operation must increment state version by exactly 1',
      });
    });

    test('should handle operation timeout', async () => {
      // Arrange
      const operation = {
        operationId: 'op-timeout-test',
        gameId: 'game-123',
        playerId: 'player-456',
        expectedVersion: 10,
        timeout: 100, // 100ms timeout
        operation: jest.fn().mockImplementation(() => {
          // Return a promise that never resolves (simulating timeout)
          return new Promise(() => {});
        }),
      };

      // Mock successful lock acquisition and state loading
      mockKvService.get
        .mockResolvedValueOnce({
          success: true,
          data: null,
          timestamp: new Date(),
        })
        .mockResolvedValueOnce({
          success: true,
          data: mockGameState,
          timestamp: new Date(),
        });

      // Act & Assert
      await expect(concurrencyManager.executeAtomic(operation)).rejects.toThrow(
        'timed out'
      );
    });
  });

  describe('Batch Operations', () => {
    test('should execute batch of actions atomically', async () => {
      // Arrange
      const actions: GameAction[] = [
        {
          id: 'action-1',
          type: 'move',
          playerId: 'player-456',
          gameId: 'game-123',
          timestamp: new Date(),
          data: { direction: 'north' },
        },
        {
          id: 'action-2',
          type: 'attack',
          playerId: 'player-456',
          gameId: 'game-123',
          timestamp: new Date(),
          data: { target: 'enemy-1' },
        },
      ];

      // Mock successful operations
      mockKvService.get
        .mockResolvedValueOnce({
          success: true,
          data: mockGameState,
          timestamp: new Date(),
        }) // Load for expected version
        .mockResolvedValueOnce({
          success: true,
          data: null,
          timestamp: new Date(),
        }) // No lock
        .mockResolvedValueOnce({
          success: true,
          data: mockGameState,
          timestamp: new Date(),
        }); // Load current state

      // Act
      const result = await concurrencyManager.executeBatch(
        'game-123',
        'player-456',
        actions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        turn: 7, // Original turn (5) + 2 actions
        metadata: {
          version: 12, // Original version (10) + 2 actions
          actionHistory: actions,
        },
      });
    });

    test('should fail batch when game state not found', async () => {
      // Arrange
      const actions: GameAction[] = [
        {
          id: 'action-1',
          type: 'move',
          playerId: 'player-456',
          gameId: 'nonexistent-game',
          timestamp: new Date(),
          data: { direction: 'north' },
        },
      ];

      mockKvService.get.mockResolvedValueOnce({
        success: true,
        data: null, // Game not found
        timestamp: new Date(),
      });

      // Act
      const result = await concurrencyManager.executeBatch(
        'nonexistent-game',
        'player-456',
        actions
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toMatchObject({
        code: 'GAME_NOT_FOUND',
        message: 'Game state not found',
      });
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should return concurrency statistics', () => {
      // Act
      const stats = concurrencyManager.getStats();

      // Assert
      expect(stats).toMatchObject({
        activeLocks: expect.any(Number),
        queuedOperations: expect.any(Number),
        gameQueues: expect.any(Number),
      });
      expect(stats.activeLocks).toBeGreaterThanOrEqual(0);
      expect(stats.queuedOperations).toBeGreaterThanOrEqual(0);
      expect(stats.gameQueues).toBeGreaterThanOrEqual(0);
    });

    test('should clean up expired locks', async () => {
      // This is primarily an internal operation, so we test that it doesn't throw
      await expect(
        concurrencyManager.cleanupExpiredLocks()
      ).resolves.not.toThrow();
    });
  });

  describe('Singleton Pattern', () => {
    test('should return same instance on multiple getInstance calls', () => {
      // Act
      const instance1 = ConcurrencyManager.getInstance();
      const instance2 = ConcurrencyManager.getInstance();

      // Assert
      expect(instance1).toBe(instance2);
    });
  });
});
