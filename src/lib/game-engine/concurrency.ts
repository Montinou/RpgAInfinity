/**
 * Concurrency Manager for Game Engine
 *
 * Handles concurrent player actions safely using atomic operations,
 * optimistic locking, and distributed locking patterns to prevent
 * race conditions and ensure data consistency across multiple players.
 */

import { v4 as uuidv4 } from 'uuid';
import { GameState, GameAction, UUID, GameError } from '@/types/core';
import { kvService } from '@/lib/database/kv-service';

// ============================================================================
// CONCURRENCY TYPES
// ============================================================================

export interface LockInfo {
  readonly lockId: string;
  readonly gameId: string;
  readonly playerId: string;
  readonly acquiredAt: Date;
  readonly expiresAt: Date;
  readonly operation: string;
}

export interface AtomicOperation<T = any> {
  readonly operationId: string;
  readonly gameId: string;
  readonly playerId: string;
  readonly expectedVersion: number;
  readonly operation: (
    currentState: GameState
  ) => Promise<GameState> | GameState;
  readonly retryCount?: number;
  readonly timeout?: number;
}

export interface ConcurrencyResult<T = any> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: GameError;
  readonly retryCount: number;
  readonly duration: number;
}

// ============================================================================
// CONCURRENCY MANAGER
// ============================================================================

export class ConcurrencyManager {
  private static instance: ConcurrencyManager;
  private readonly DEFAULT_LOCK_TTL = 30; // 30 seconds
  private readonly DEFAULT_RETRY_ATTEMPTS = 3;
  private readonly DEFAULT_RETRY_DELAY = 100; // 100ms
  private readonly DEFAULT_OPERATION_TIMEOUT = 10000; // 10 seconds

  private activeLocks: Map<string, LockInfo> = new Map();
  private operationQueue: Map<string, AtomicOperation[]> = new Map();

  private constructor() {}

  static getInstance(): ConcurrencyManager {
    if (!ConcurrencyManager.instance) {
      ConcurrencyManager.instance = new ConcurrencyManager();
    }
    return ConcurrencyManager.instance;
  }

  // ============================================================================
  // DISTRIBUTED LOCKING
  // ============================================================================

  /**
   * Acquire a distributed lock for a game
   */
  async acquireLock(
    gameId: string,
    playerId: string,
    operation: string,
    ttlSeconds: number = this.DEFAULT_LOCK_TTL
  ): Promise<ConcurrencyResult<LockInfo>> {
    const startTime = performance.now();
    const lockKey = `game_lock:${gameId}`;
    const lockId = uuidv4();

    try {
      const existingLock = await kvService.get<LockInfo>(lockKey);

      // Check if lock is already held and not expired
      if (existingLock.success && existingLock.data) {
        const now = new Date();
        if (existingLock.data.expiresAt > now) {
          return {
            success: false,
            error: {
              code: 'PERMISSION_DENIED',
              message: 'Game is locked by another operation',
              timestamp: now,
              details: {
                lockedBy: existingLock.data.playerId,
                operation: existingLock.data.operation,
                expiresAt: existingLock.data.expiresAt,
              },
            },
            retryCount: 0,
            duration: performance.now() - startTime,
          };
        }
      }

      // Acquire lock
      const lockInfo: LockInfo = {
        lockId,
        gameId,
        playerId,
        acquiredAt: new Date(),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
        operation,
      };

      const setResult = await kvService.set(lockKey, lockInfo, ttlSeconds);

      if (!setResult.success) {
        return {
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: `Failed to acquire lock: ${setResult.error}`,
            timestamp: new Date(),
          },
          retryCount: 0,
          duration: performance.now() - startTime,
        };
      }

      // Store lock locally for tracking
      this.activeLocks.set(lockKey, lockInfo);

      return {
        success: true,
        data: lockInfo,
        retryCount: 0,
        duration: performance.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: `Lock acquisition failed: ${error}`,
          timestamp: new Date(),
        },
        retryCount: 0,
        duration: performance.now() - startTime,
      };
    }
  }

  /**
   * Release a distributed lock
   */
  async releaseLock(lockInfo: LockInfo): Promise<ConcurrencyResult<boolean>> {
    const startTime = performance.now();
    const lockKey = `game_lock:${lockInfo.gameId}`;

    try {
      // Verify we still own the lock
      const currentLock = await kvService.get<LockInfo>(lockKey);

      if (!currentLock.success || !currentLock.data) {
        return {
          success: true, // Lock doesn't exist, consider it released
          data: true,
          retryCount: 0,
          duration: performance.now() - startTime,
        };
      }

      if (currentLock.data.lockId !== lockInfo.lockId) {
        return {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'Cannot release lock owned by another operation',
            timestamp: new Date(),
            details: {
              expectedLockId: lockInfo.lockId,
              actualLockId: currentLock.data.lockId,
            },
          },
          retryCount: 0,
          duration: performance.now() - startTime,
        };
      }

      // Release lock
      const deleteResult = await kvService.delete(lockKey);
      this.activeLocks.delete(lockKey);

      return {
        success: deleteResult.success,
        data: deleteResult.success,
        error: deleteResult.success
          ? undefined
          : {
              code: 'DATABASE_ERROR',
              message: `Failed to release lock: ${deleteResult.error}`,
              timestamp: new Date(),
            },
        retryCount: 0,
        duration: performance.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: `Lock release failed: ${error}`,
          timestamp: new Date(),
        },
        retryCount: 0,
        duration: performance.now() - startTime,
      };
    }
  }

  // ============================================================================
  // ATOMIC OPERATIONS
  // ============================================================================

  /**
   * Execute an atomic operation with optimistic locking
   */
  async executeAtomic<T = GameState>(
    operation: AtomicOperation<T>
  ): Promise<ConcurrencyResult<T>> {
    const startTime = performance.now();
    const retryCount = 0;
    const maxRetries = operation.retryCount ?? this.DEFAULT_RETRY_ATTEMPTS;
    const timeout = operation.timeout ?? this.DEFAULT_OPERATION_TIMEOUT;

    // Set operation timeout
    const timeoutPromise = new Promise<ConcurrencyResult<T>>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`));
      }, timeout);
    });

    const operationPromise = this.executeAtomicInternal(operation, maxRetries);

    try {
      const result = await Promise.race([operationPromise, timeoutPromise]);
      return {
        ...result,
        duration: performance.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: `Atomic operation failed: ${error}`,
          timestamp: new Date(),
          gameId: operation.gameId,
          playerId: operation.playerId,
        },
        retryCount,
        duration: performance.now() - startTime,
      };
    }
  }

  /**
   * Internal atomic operation executor with retry logic
   */
  private async executeAtomicInternal<T = GameState>(
    operation: AtomicOperation<T>,
    maxRetries: number
  ): Promise<ConcurrencyResult<T>> {
    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {
        // Acquire lock for the game
        const lockResult = await this.acquireLock(
          operation.gameId,
          operation.playerId,
          `atomic_${operation.operationId}`
        );

        if (!lockResult.success) {
          // If we can't get a lock, wait and retry
          if (retryCount < maxRetries) {
            await this.waitWithBackoff(retryCount);
            retryCount++;
            continue;
          } else {
            return {
              success: false,
              error: lockResult.error,
              retryCount,
              duration: 0,
            };
          }
        }

        const lockInfo = lockResult.data!;

        try {
          // Load current state
          const stateKey = `game_state:${operation.gameId}`;
          const currentStateResult = await kvService.get<GameState>(stateKey);

          if (!currentStateResult.success || !currentStateResult.data) {
            return {
              success: false,
              error: {
                code: 'GAME_NOT_FOUND',
                message: 'Game state not found',
                timestamp: new Date(),
                gameId: operation.gameId,
              },
              retryCount,
              duration: 0,
            };
          }

          const currentState = currentStateResult.data;

          // Check optimistic concurrency control
          if (currentState.metadata.version !== operation.expectedVersion) {
            // Version mismatch - retry with new version
            if (retryCount < maxRetries) {
              await this.releaseLock(lockInfo);
              await this.waitWithBackoff(retryCount);
              retryCount++;
              continue;
            } else {
              return {
                success: false,
                error: {
                  code: 'VALIDATION_ERROR',
                  message: 'State version conflict - too many retries',
                  timestamp: new Date(),
                  details: {
                    expectedVersion: operation.expectedVersion,
                    actualVersion: currentState.metadata.version,
                  },
                },
                retryCount,
                duration: 0,
              };
            }
          }

          // Execute operation
          const newState = await Promise.resolve(
            operation.operation(currentState)
          );

          // Validate new state version
          if (newState.metadata.version !== currentState.metadata.version + 1) {
            return {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Operation must increment state version by exactly 1',
                timestamp: new Date(),
                details: {
                  originalVersion: currentState.metadata.version,
                  newVersion: newState.metadata.version,
                },
              },
              retryCount,
              duration: 0,
            };
          }

          // Save new state atomically
          const saveResult = await kvService.set(stateKey, newState);

          if (!saveResult.success) {
            return {
              success: false,
              error: {
                code: 'DATABASE_ERROR',
                message: `Failed to save state: ${saveResult.error}`,
                timestamp: new Date(),
              },
              retryCount,
              duration: 0,
            };
          }

          // Release lock
          await this.releaseLock(lockInfo);

          return {
            success: true,
            data: newState as T,
            retryCount,
            duration: 0,
          };
        } catch (operationError) {
          // Always release lock on error
          await this.releaseLock(lockInfo);
          throw operationError;
        }
      } catch (error) {
        if (retryCount < maxRetries) {
          await this.waitWithBackoff(retryCount);
          retryCount++;
          continue;
        } else {
          return {
            success: false,
            error: {
              code: 'DATABASE_ERROR',
              message: `Atomic operation failed after ${retryCount} retries: ${error}`,
              timestamp: new Date(),
            },
            retryCount,
            duration: 0,
          };
        }
      }
    }

    // This should never be reached
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Unexpected error in atomic operation',
        timestamp: new Date(),
      },
      retryCount,
      duration: 0,
    };
  }

  // ============================================================================
  // BATCH OPERATIONS
  // ============================================================================

  /**
   * Execute multiple actions atomically in a batch
   */
  async executeBatch(
    gameId: string,
    playerId: string,
    actions: GameAction[]
  ): Promise<ConcurrencyResult<GameState>> {
    const operationId = uuidv4();

    const batchOperation: AtomicOperation<GameState> = {
      operationId,
      gameId,
      playerId,
      expectedVersion: -1, // Will be set when we load current state
      operation: async (currentState: GameState) => {
        let state = currentState;

        // Process each action sequentially within the atomic operation
        for (const action of actions) {
          // TODO: Implement action processing logic
          // For now, just increment version and add to history
          state = {
            ...state,
            turn: (state.turn || 0) + 1,
            metadata: {
              ...state.metadata,
              version: state.metadata.version + 1,
              lastAction: action,
              actionHistory: [...state.metadata.actionHistory, action],
            },
          };
        }

        return state;
      },
    };

    // Load current state to get expected version
    const currentStateResult = await kvService.get<GameState>(
      `game_state:${gameId}`
    );
    if (!currentStateResult.success || !currentStateResult.data) {
      return {
        success: false,
        error: {
          code: 'GAME_NOT_FOUND',
          message: 'Game state not found',
          timestamp: new Date(),
          gameId,
        },
        retryCount: 0,
        duration: 0,
      };
    }

    batchOperation.expectedVersion = currentStateResult.data.metadata.version;

    return this.executeAtomic(batchOperation);
  }

  // ============================================================================
  // QUEUE MANAGEMENT
  // ============================================================================

  /**
   * Add operation to queue for sequential processing
   */
  async queueOperation(operation: AtomicOperation): Promise<void> {
    if (!this.operationQueue.has(operation.gameId)) {
      this.operationQueue.set(operation.gameId, []);
    }

    const queue = this.operationQueue.get(operation.gameId)!;
    queue.push(operation);

    // Process queue if this is the first operation
    if (queue.length === 1) {
      this.processOperationQueue(operation.gameId);
    }
  }

  /**
   * Process queued operations for a game
   */
  private async processOperationQueue(gameId: string): Promise<void> {
    const queue = this.operationQueue.get(gameId);
    if (!queue || queue.length === 0) {
      return;
    }

    const operation = queue[0];

    try {
      await this.executeAtomic(operation);
    } catch (error) {
      console.error(`Queued operation failed for game ${gameId}:`, error);
    } finally {
      // Remove processed operation and continue with next
      queue.shift();
      if (queue.length > 0) {
        // Process next operation after a small delay
        setTimeout(() => this.processOperationQueue(gameId), 10);
      } else {
        // Clean up empty queue
        this.operationQueue.delete(gameId);
      }
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Wait with exponential backoff
   */
  private async waitWithBackoff(retryCount: number): Promise<void> {
    const delay = this.DEFAULT_RETRY_DELAY * Math.pow(2, retryCount);
    const jitter = Math.random() * delay * 0.1; // Add 10% jitter
    await new Promise(resolve => setTimeout(resolve, delay + jitter));
  }

  /**
   * Clean up expired locks
   */
  async cleanupExpiredLocks(): Promise<void> {
    const now = new Date();
    const expiredLocks: string[] = [];

    for (const [key, lockInfo] of this.activeLocks.entries()) {
      if (lockInfo.expiresAt <= now) {
        expiredLocks.push(key);
      }
    }

    for (const key of expiredLocks) {
      this.activeLocks.delete(key);
      await kvService.delete(key);
    }
  }

  /**
   * Get concurrency statistics
   */
  getStats(): {
    activeLocks: number;
    queuedOperations: number;
    gameQueues: number;
  } {
    let totalQueuedOperations = 0;
    for (const queue of this.operationQueue.values()) {
      totalQueuedOperations += queue.length;
    }

    return {
      activeLocks: this.activeLocks.size,
      queuedOperations: totalQueuedOperations,
      gameQueues: this.operationQueue.size,
    };
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const concurrencyManager = ConcurrencyManager.getInstance();
export default concurrencyManager;
