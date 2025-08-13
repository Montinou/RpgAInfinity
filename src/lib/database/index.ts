/**
 * Database Layer - Barrel Export
 *
 * Central export point for all database-related functionality
 * Provides a clean API for data access, validation, and asset management
 */

// Core Services
export { kvService, KVService } from './kv-service';
export { blobService, BlobService } from './blob-service';

// Serialization utilities
export {
  serialize,
  deserialize,
  serializePlayer,
  deserializePlayer,
  serializeGameSession,
  deserializeGameSession,
  serializeGameEvent,
  deserializeGameEvent,
  serializeRPGCharacter,
  deserializeRPGCharacter,
  serializeRPGWorld,
  deserializeRPGWorld,
  serializeVillage,
  deserializeVillage,
  serializeVillageEvent,
  deserializeVillageEvent,
  serializeDeductionRole,
  deserializeDeductionRole,
  serializeArray,
  deserializeArray,
  serializeMap,
  deserializeMap,
  validateSerialized,
  getSerializedSize,
  checkSizeLimit,
  fastSerialize,
  fastDeserialize,
  migrateSerializedData,
  isISODateString,
  type MigrationRule,
} from './serialization';

// Validation schemas and utilities
export {
  ValidationSchemas,
  validateData,
  safeValidate,
  validatePartial,
  validateArray,
  validateSessionConstraints,
  validateRPGCharacterConstraints,

  // Individual schemas for direct import
  PlayerSchema,
  GameSessionSchema,
  GameEventSchema,
  AIGenerationRequestSchema,
  AIGenerationResponseSchema,
  AssetReferenceSchema,
  RPGCharacterSchema,
  RPGGameStateSchema,
  DeductionRoleSchema,
  DeductionGameStateSchema,
  BuildingSchema,
  ResidentSchema,
  VillageEventSchema,
  VillageGameStateSchema,
  CreateSessionRequestSchema,
  JoinSessionRequestSchema,
  GameActionRequestSchema,
  AIGenerateRequestSchema,
} from './validation';

// Asset management utilities
export { base64ToBuffer, createThumbnail, validateAsset } from './blob-service';

// ============================================================================
// UNIFIED DATABASE API
// ============================================================================

/**
 * High-level database operations that combine KV and Blob services
 * Provides game-focused APIs with built-in validation and serialization
 */

import { kvService } from './kv-service';
import { blobService } from './blob-service';
import { validateData, ValidationSchemas } from './validation';
import {
  serializePlayer,
  deserializePlayer,
  serializeGameSession,
  deserializeGameSession,
} from './serialization';
import type {
  Player,
  GameSession,
  KVResult,
  GameType,
  AssetReference,
} from '@/types';

export class DatabaseAPI {
  private static instance: DatabaseAPI;

  private constructor() {}

  static getInstance(): DatabaseAPI {
    if (!DatabaseAPI.instance) {
      DatabaseAPI.instance = new DatabaseAPI();
    }
    return DatabaseAPI.instance;
  }

  // ============================================================================
  // PLAYER OPERATIONS
  // ============================================================================

  /**
   * Create or update a player with validation
   */
  async savePlayer(
    playerData: Partial<Player> & { id: string }
  ): Promise<KVResult<Player>> {
    // Validate player data
    const validation = validateData(ValidationSchemas.Player, playerData);
    if (!validation.success) {
      return {
        success: false,
        error: `Player validation failed: ${validation.errors?.join(', ')}`,
        timestamp: new Date(),
      };
    }

    const player = validation.data!;
    return kvService.setPlayer(player).then(() => ({
      success: true,
      data: player,
      timestamp: new Date(),
    }));
  }

  /**
   * Get player by ID with deserialization
   */
  async getPlayer(playerId: string): Promise<KVResult<Player>> {
    return kvService.getPlayer(playerId);
  }

  // ============================================================================
  // GAME SESSION OPERATIONS
  // ============================================================================

  /**
   * Create a new game session with validation
   */
  async createGameSession(
    sessionData: Partial<GameSession> & {
      id: string;
      gameType: GameType;
      hostId: string;
    }
  ): Promise<KVResult<GameSession>> {
    // Set default values
    const now = new Date();
    const session: GameSession = {
      status: 'waiting',
      players: [],
      maxPlayers: 6,
      minPlayers: 2,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24 hours
      eventHistory: [],
      currentState: {
        turn: 0,
        phase: 'setup',
        metadata: {},
      },
      config: {
        difficulty: 'normal',
      },
      ...sessionData,
    } as GameSession;

    // Validate session data
    const validation = validateData(ValidationSchemas.GameSession, session);
    if (!validation.success) {
      return {
        success: false,
        error: `Session validation failed: ${validation.errors?.join(', ')}`,
        timestamp: new Date(),
      };
    }

    return kvService.setGameSession(validation.data!).then(() => ({
      success: true,
      data: validation.data!,
      timestamp: new Date(),
    }));
  }

  /**
   * Get game session by ID with deserialization
   */
  async getGameSession(sessionId: string): Promise<KVResult<GameSession>> {
    return kvService.getGameSession(sessionId);
  }

  /**
   * Update game session with validation
   */
  async updateGameSession(
    sessionId: string,
    updates: Partial<GameSession>
  ): Promise<KVResult<GameSession>> {
    // Get existing session
    const existingResult = await kvService.getGameSession(sessionId);
    if (!existingResult.success || !existingResult.data) {
      return existingResult;
    }

    // Merge updates
    const updatedSession = {
      ...existingResult.data,
      ...updates,
      updatedAt: new Date(),
    };

    // Validate updated session
    const validation = validateData(
      ValidationSchemas.GameSession,
      updatedSession
    );
    if (!validation.success) {
      return {
        success: false,
        error: `Session update validation failed: ${validation.errors?.join(', ')}`,
        timestamp: new Date(),
      };
    }

    return kvService.setGameSession(validation.data!).then(() => ({
      success: true,
      data: validation.data!,
      timestamp: new Date(),
    }));
  }

  // ============================================================================
  // ASSET OPERATIONS WITH GAME CONTEXT
  // ============================================================================

  /**
   * Upload and associate an asset with a game session
   */
  async uploadGameAsset(
    sessionId: string,
    gameType: GameType,
    filename: string,
    data: Blob | Buffer,
    assetType: 'image' | 'audio' | 'data' = 'image',
    context?: Record<string, any>
  ): Promise<KVResult<AssetReference>> {
    if (assetType === 'image') {
      return blobService.uploadGameImage(
        sessionId,
        gameType,
        data,
        context?.description || filename,
        context
      );
    } else if (assetType === 'audio') {
      return blobService.uploadGameAudio(
        sessionId,
        gameType,
        data,
        context?.audioType || 'sfx',
        context?.duration
      );
    } else {
      return blobService.uploadFile(filename, data, {
        access: 'public',
        metadata: {
          sessionId,
          gameType,
          ...context,
        },
      });
    }
  }

  /**
   * Get all assets for a game session
   */
  async getGameAssets(sessionId: string): Promise<KVResult<AssetReference[]>> {
    return blobService.getSessionAssets(sessionId);
  }

  // ============================================================================
  // MAINTENANCE OPERATIONS
  // ============================================================================

  /**
   * Clean up expired data and assets
   */
  async performMaintenance(): Promise<{
    kvCleaned: number;
    assetsCleaned: number;
    errors: string[];
  }> {
    const results = {
      kvCleaned: 0,
      assetsCleaned: 0,
      errors: [] as string[],
    };

    try {
      // Clean up KV data
      const kvCleanup = await kvService.cleanup();
      if (kvCleanup.success) {
        results.kvCleaned = kvCleanup.data || 0;
      } else {
        results.errors.push(`KV cleanup failed: ${kvCleanup.error}`);
      }

      // Clean up old assets (30 days)
      const assetCleanup = await blobService.cleanupOldAssets(30);
      if (assetCleanup.success) {
        results.assetsCleaned = assetCleanup.data || 0;
      } else {
        results.errors.push(`Asset cleanup failed: ${assetCleanup.error}`);
      }
    } catch (error) {
      results.errors.push(`Maintenance failed: ${error}`);
    }

    return results;
  }

  /**
   * Get comprehensive storage statistics
   */
  async getStorageStatistics(): Promise<{
    kv: any;
    assets: any;
    errors: string[];
  }> {
    const stats = {
      kv: null,
      assets: null,
      errors: [] as string[],
    };

    try {
      const kvStats = await kvService.getStats();
      if (kvStats.success) {
        stats.kv = kvStats.data;
      } else {
        stats.errors.push(`KV stats failed: ${kvStats.error}`);
      }

      const assetStats = await blobService.getStorageStats();
      if (assetStats.success) {
        stats.assets = assetStats.data;
      } else {
        stats.errors.push(`Asset stats failed: ${assetStats.error}`);
      }
    } catch (error) {
      stats.errors.push(`Stats collection failed: ${error}`);
    }

    return stats;
  }
}

// ============================================================================
// SINGLETON INSTANCE EXPORT
// ============================================================================

export const databaseAPI = DatabaseAPI.getInstance();

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Quick access to common database operations
 */
export const db = {
  // Core services
  kv: kvService,
  blob: blobService,
  api: databaseAPI,

  // Quick operations
  savePlayer: (player: Player) => databaseAPI.savePlayer(player),
  getPlayer: (id: string) => databaseAPI.getPlayer(id),
  saveSession: (session: GameSession) => databaseAPI.createGameSession(session),
  getSession: (id: string) => databaseAPI.getGameSession(id),
  uploadAsset: (
    sessionId: string,
    gameType: GameType,
    filename: string,
    data: Blob | Buffer
  ) => databaseAPI.uploadGameAsset(sessionId, gameType, filename, data),

  // Maintenance
  cleanup: () => databaseAPI.performMaintenance(),
  stats: () => databaseAPI.getStorageStatistics(),
};
