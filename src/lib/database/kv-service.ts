/**
 * Vercel KV Service - Core data access layer for RpgAInfinity
 *
 * Provides a high-level interface for interacting with Vercel KV (Redis)
 * Handles serialization, caching, error handling, and atomic operations
 */

import { kv } from '@vercel/kv';
import {
  Player,
  GameSession,
  GameState,
  GameEvent,
  AIGenerationRequest,
  AIGenerationResponse,
  AICacheEntry,
  AssetReference,
  KVResult,
  Pagination,
  PaginatedResult,
  RateLimit,
  KV_KEY_PATTERNS,
  TTL,
  GameType,
  Serializable,
} from '@/types';

// ============================================================================
// CORE KV SERVICE CLASS
// ============================================================================

export class KVService {
  private static instance: KVService;

  private constructor() {}

  static getInstance(): KVService {
    if (!KVService.instance) {
      KVService.instance = new KVService();
    }
    return KVService.instance;
  }

  // ============================================================================
  // BASIC KV OPERATIONS
  // ============================================================================

  /**
   * Get a value from KV storage with automatic JSON parsing
   */
  async get<T = any>(key: string): Promise<KVResult<T>> {
    try {
      const value = await kv.get<T>(key);
      return {
        success: true,
        data: value ?? undefined,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get key ${key}: ${error}`,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Set a value in KV storage with optional TTL
   */
  async set<T = any>(
    key: string,
    value: T,
    ttl?: number
  ): Promise<KVResult<boolean>> {
    try {
      if (ttl && ttl > 0) {
        await kv.setex(key, ttl, JSON.stringify(value));
      } else {
        await kv.set(key, value);
      }

      return {
        success: true,
        data: true,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to set key ${key}: ${error}`,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Delete a key from KV storage
   */
  async delete(key: string): Promise<KVResult<boolean>> {
    try {
      const deleted = await kv.del(key);
      return {
        success: true,
        data: deleted > 0,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete key ${key}: ${error}`,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Check if a key exists in KV storage
   */
  async exists(key: string): Promise<KVResult<boolean>> {
    try {
      const exists = await kv.exists(key);
      return {
        success: true,
        data: exists === 1,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to check existence of key ${key}: ${error}`,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Set TTL for an existing key
   */
  async expire(key: string, seconds: number): Promise<KVResult<boolean>> {
    try {
      const result = await kv.expire(key, seconds);
      return {
        success: true,
        data: result === 1,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to set TTL for key ${key}: ${error}`,
        timestamp: new Date(),
      };
    }
  }

  // ============================================================================
  // ATOMIC OPERATIONS
  // ============================================================================

  /**
   * Execute multiple operations atomically using Redis pipeline
   */
  async batch(
    operations: Array<{
      operation: 'get' | 'set' | 'del' | 'exists';
      key: string;
      value?: any;
      ttl?: number;
    }>
  ): Promise<KVResult<any[]>> {
    try {
      const pipeline = kv.multi();

      for (const op of operations) {
        switch (op.operation) {
          case 'get':
            pipeline.get(op.key);
            break;
          case 'set':
            if (op.ttl && op.ttl > 0) {
              pipeline.setex(op.key, op.ttl, JSON.stringify(op.value));
            } else {
              pipeline.set(op.key, op.value);
            }
            break;
          case 'del':
            pipeline.del(op.key);
            break;
          case 'exists':
            pipeline.exists(op.key);
            break;
        }
      }

      const results = await pipeline.exec();

      return {
        success: true,
        data: results,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Batch operation failed: ${error}`,
        timestamp: new Date(),
      };
    }
  }

  // ============================================================================
  // HIGH-LEVEL GAME DATA OPERATIONS
  // ============================================================================

  /**
   * Get player data by ID
   */
  async getPlayer(playerId: string): Promise<KVResult<Player>> {
    const key = KV_KEY_PATTERNS.PLAYER(playerId);
    return this.get<Player>(key);
  }

  /**
   * Save player data with automatic TTL based on activity
   */
  async setPlayer(player: Player): Promise<KVResult<boolean>> {
    const key = KV_KEY_PATTERNS.PLAYER(player.id);
    const ttl = player.isOnline ? TTL.SESSION_ACTIVE : TTL.SESSION_COMPLETED;

    // Serialize dates to strings for Redis storage
    const serializedPlayer: Serializable<Player> = {
      ...player,
      createdAt: player.createdAt.toISOString(),
      lastActive: player.lastActive.toISOString(),
    };

    return this.set(key, serializedPlayer, ttl);
  }

  /**
   * Get game session by ID
   */
  async getGameSession(sessionId: string): Promise<KVResult<GameSession>> {
    const key = KV_KEY_PATTERNS.SESSION(sessionId);
    const result = await this.get<Serializable<GameSession>>(key);

    if (result.success && result.data) {
      // Deserialize dates from strings
      const deserializedSession: GameSession = {
        ...result.data,
        createdAt: new Date(result.data.createdAt),
        startedAt: result.data.startedAt
          ? new Date(result.data.startedAt)
          : undefined,
        updatedAt: new Date(result.data.updatedAt),
        endedAt: result.data.endedAt
          ? new Date(result.data.endedAt)
          : undefined,
        expiresAt: new Date(result.data.expiresAt),
        eventHistory: result.data.eventHistory.map(event => ({
          ...event,
          timestamp: new Date(event.timestamp),
        })),
      };

      return {
        ...result,
        data: deserializedSession,
      };
    }

    return result as KVResult<GameSession>;
  }

  /**
   * Save game session with automatic TTL management
   */
  async setGameSession(session: GameSession): Promise<KVResult<boolean>> {
    const key = KV_KEY_PATTERNS.SESSION(session.id);
    const ttl =
      session.status === 'active' ? TTL.SESSION_ACTIVE : TTL.SESSION_COMPLETED;

    // Serialize dates to strings
    const serializedSession: Serializable<GameSession> = {
      ...session,
      createdAt: session.createdAt.toISOString(),
      startedAt: session.startedAt?.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      endedAt: session.endedAt?.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      eventHistory: session.eventHistory.map(event => ({
        ...event,
        timestamp: event.timestamp.toISOString(),
      })),
    };

    // Also update session indexes for querying
    await this.updateSessionIndexes(session);

    return this.set(key, serializedSession, ttl);
  }

  /**
   * Get game state for a session
   */
  async getGameState(sessionId: string): Promise<KVResult<GameState>> {
    const key = KV_KEY_PATTERNS.GAME_STATE(sessionId);
    return this.get<GameState>(key);
  }

  /**
   * Save game state with optimistic locking
   */
  async setGameState(
    sessionId: string,
    state: GameState,
    expectedTurn?: number
  ): Promise<KVResult<boolean>> {
    const key = KV_KEY_PATTERNS.GAME_STATE(sessionId);

    // Optimistic concurrency control
    if (expectedTurn !== undefined) {
      const currentState = await this.getGameState(sessionId);
      if (
        currentState.success &&
        currentState.data &&
        currentState.data.turn !== expectedTurn
      ) {
        return {
          success: false,
          error: `State conflict: expected turn ${expectedTurn}, but current turn is ${currentState.data.turn}`,
          timestamp: new Date(),
        };
      }
    }

    return this.set(key, state, TTL.SESSION_ACTIVE);
  }

  // ============================================================================
  // INDEXING AND QUERYING
  // ============================================================================

  /**
   * Update session indexes for efficient querying
   */
  private async updateSessionIndexes(session: GameSession): Promise<void> {
    const operations = [];

    // Index by game type for finding active sessions
    const activeSessionsKey = KV_KEY_PATTERNS.ACTIVE_SESSIONS(session.gameType);
    operations.push({
      operation: 'set' as const,
      key: activeSessionsKey,
      value: session.id,
      ttl: TTL.SESSION_ACTIVE,
    });

    // Index by player for finding player's sessions
    for (const player of session.players) {
      const playerSessionsKey = KV_KEY_PATTERNS.PLAYER_SESSIONS(
        player.playerId
      );
      operations.push({
        operation: 'set' as const,
        key: playerSessionsKey,
        value: session.id,
        ttl: TTL.PLAYER_SESSION,
      });
    }

    await this.batch(operations);
  }

  /**
   * Get active sessions by game type
   */
  async getActiveSessionsByType(
    gameType: GameType,
    pagination?: Pagination
  ): Promise<PaginatedResult<string>> {
    try {
      const pattern = KV_KEY_PATTERNS.ACTIVE_SESSIONS(gameType);
      const keys = await kv.keys(`${pattern}*`);

      const limit = pagination?.limit ?? 20;
      const offset = pagination?.offset ?? 0;

      const paginatedKeys = keys.slice(offset, offset + limit);

      return {
        items: paginatedKeys,
        pagination: {
          page: Math.floor(offset / limit) + 1,
          limit,
          total: keys.length,
          hasNext: offset + limit < keys.length,
          hasPrev: offset > 0,
        },
      };
    } catch (error) {
      return {
        items: [],
        pagination: {
          page: 1,
          limit: pagination?.limit ?? 20,
          total: 0,
          hasNext: false,
          hasPrev: false,
        },
      };
    }
  }

  /**
   * Get player's active sessions
   */
  async getPlayerSessions(playerId: string): Promise<KVResult<string[]>> {
    try {
      const pattern = KV_KEY_PATTERNS.PLAYER_SESSIONS(playerId);
      const keys = await kv.keys(`${pattern}*`);

      return {
        success: true,
        data: keys,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get sessions for player ${playerId}: ${error}`,
        timestamp: new Date(),
      };
    }
  }

  // ============================================================================
  // AI CACHING SYSTEM
  // ============================================================================

  /**
   * Generate cache key for AI requests
   */
  private generateAICacheHash(request: AIGenerationRequest): string {
    const content = JSON.stringify({
      type: request.type,
      prompt: request.prompt,
      context: request.context,
      gameType: request.gameType,
    });

    // Simple hash function for cache key
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(36);
  }

  /**
   * Get cached AI response
   */
  async getAICacheEntry(
    request: AIGenerationRequest
  ): Promise<KVResult<AICacheEntry>> {
    const hash = this.generateAICacheHash(request);
    const key = KV_KEY_PATTERNS.AI_CACHE(hash);

    const result = await this.get<AICacheEntry>(key);

    if (result.success && result.data) {
      // Update access count and last accessed time
      result.data.accessCount += 1;
      result.data.lastAccessed = new Date();
      await this.set(key, result.data, TTL.AI_CACHE_HOT);
    }

    return result;
  }

  /**
   * Cache AI response
   */
  async setAICacheEntry(
    request: AIGenerationRequest,
    response: AIGenerationResponse
  ): Promise<KVResult<boolean>> {
    const hash = this.generateAICacheHash(request);
    const key = KV_KEY_PATTERNS.AI_CACHE(hash);

    const cacheEntry: AICacheEntry = {
      hash,
      request,
      response,
      createdAt: new Date(),
      accessCount: 1,
      lastAccessed: new Date(),
      expiresAt: new Date(Date.now() + TTL.AI_CACHE_HOT * 1000),
    };

    return this.set(key, cacheEntry, TTL.AI_CACHE_HOT);
  }

  // ============================================================================
  // RATE LIMITING
  // ============================================================================

  /**
   * Check and update rate limit for a key
   */
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<RateLimit> {
    const rateLimitKey = KV_KEY_PATTERNS.RATE_LIMIT(key);

    try {
      const current = await kv.get<RateLimit>(rateLimitKey);
      const now = new Date();

      if (!current) {
        const newLimit: RateLimit = {
          key,
          count: 1,
          resetTime: new Date(now.getTime() + windowSeconds * 1000),
          limit,
        };

        await this.set(rateLimitKey, newLimit, windowSeconds);
        return newLimit;
      }

      if (now > current.resetTime) {
        // Reset window
        const resetLimit: RateLimit = {
          key,
          count: 1,
          resetTime: new Date(now.getTime() + windowSeconds * 1000),
          limit,
        };

        await this.set(rateLimitKey, resetLimit, windowSeconds);
        return resetLimit;
      }

      // Increment count
      current.count += 1;
      await this.set(
        rateLimitKey,
        current,
        Math.floor((current.resetTime.getTime() - now.getTime()) / 1000)
      );

      return current;
    } catch (error) {
      // If rate limiting fails, allow the request but log the error
      console.error('Rate limiting error:', error);
      return {
        key,
        count: 1,
        resetTime: new Date(Date.now() + windowSeconds * 1000),
        limit,
      };
    }
  }

  // ============================================================================
  // ASSET MANAGEMENT
  // ============================================================================

  /**
   * Store asset reference
   */
  async setAssetReference(asset: AssetReference): Promise<KVResult<boolean>> {
    const key = KV_KEY_PATTERNS.ASSET(asset.id);
    return this.set(key, asset, TTL.SESSION_COMPLETED);
  }

  /**
   * Get asset reference
   */
  async getAssetReference(assetId: string): Promise<KVResult<AssetReference>> {
    const key = KV_KEY_PATTERNS.ASSET(assetId);
    return this.get<AssetReference>(key);
  }

  /**
   * Get assets by type
   */
  async getAssetsByType(type: string): Promise<KVResult<string[]>> {
    try {
      const indexKey = KV_KEY_PATTERNS.ASSET_INDEX(type);
      const result = await this.get<string[]>(indexKey);

      return {
        success: true,
        data: result.data ?? [],
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get assets by type ${type}: ${error}`,
        timestamp: new Date(),
      };
    }
  }

  // ============================================================================
  // CLEANUP AND MAINTENANCE
  // ============================================================================

  /**
   * Clean up expired sessions and data
   */
  async cleanup(): Promise<KVResult<number>> {
    try {
      let cleanedCount = 0;

      // Clean up expired sessions
      const sessionKeys = await kv.keys(KV_KEY_PATTERNS.SESSION('*'));

      for (const key of sessionKeys) {
        const ttl = await kv.ttl(key);
        if (ttl === -1) {
          // Key exists but has no expiration
          await this.expire(key, TTL.SESSION_COMPLETED);
        } else if (ttl === -2) {
          // Key doesn't exist
          cleanedCount++;
        }
      }

      return {
        success: true,
        data: cleanedCount,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Cleanup failed: ${error}`,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<
    KVResult<{
      totalKeys: number;
      sessionCount: number;
      playerCount: number;
      aiCacheCount: number;
    }>
  > {
    try {
      const [allKeys, sessionKeys, playerKeys, aiCacheKeys] = await Promise.all(
        [
          kv.keys('*'),
          kv.keys(KV_KEY_PATTERNS.SESSION('*')),
          kv.keys(KV_KEY_PATTERNS.PLAYER('*')),
          kv.keys(KV_KEY_PATTERNS.AI_CACHE('*')),
        ]
      );

      return {
        success: true,
        data: {
          totalKeys: allKeys.length,
          sessionCount: sessionKeys.length,
          playerCount: playerKeys.length,
          aiCacheCount: aiCacheKeys.length,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get stats: ${error}`,
        timestamp: new Date(),
      };
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE EXPORT
// ============================================================================

export const kvService = KVService.getInstance();
