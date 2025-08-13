/**
 * GET /api/game/rpg/[id] - Get RPG game state
 * DELETE /api/game/rpg/[id] - End game session
 *
 * Handles RPG game state retrieval and session management operations.
 */

import { NextRequest } from 'next/server';
import { createApiHandler } from '@/lib/api/middleware';
import { gameEngine } from '@/lib/game-engine';
import { rpgWorldOrchestrator } from '@/lib/games/rpg';
import { kvService } from '@/lib/database';
import { RPGGameState, UUID, GameError, ErrorCode } from '@/types';

// ============================================================================
// GET ENDPOINT - Retrieve RPG game state
// ============================================================================

interface GetRPGGameResponse {
  game: {
    id: UUID;
    name: string;
    description?: string;
    status: string;
    phase: string;
    createdAt: string;
    updatedAt: string;
    createdBy: UUID;
    players: Array<{
      id: UUID;
      name: string;
      isActive: boolean;
      joinedAt: string;
      characterName?: string;
      characterLevel?: number;
    }>;
  };
  state: RPGGameState;
  worldStatistics?: any;
  playerPermissions: {
    canModify: boolean;
    canInvite: boolean;
    canKick: boolean;
    canDelete: boolean;
  };
  lastActivity: string;
}

const getHandler = createApiHandler<never, GetRPGGameResponse>({
  rateLimitType: 'default',
  authRules: [
    {
      resource: 'game',
      action: 'read',
      conditions: async req => {
        // Allow read access if user is a player in the game or game is public
        const gameId = getGameIdFromUrl(req.url);
        const game = await gameEngine.loadState(gameId);
        if (!game) return false;

        // Check if user is a player or if game allows spectators
        const userId = req.context.userId;
        if (!userId) return false; // Require auth for game access

        const gameData = await kvService.get(`rpg_game_meta:${gameId}`);
        return (
          gameData &&
          (gameData.createdBy === userId || isPlayerInGame(gameId, userId))
        );
      },
    },
  ],
  requireAuth: true,
  timeout: 10000,
});

export const GET = getHandler(async req => {
  const gameId = getGameIdFromUrl(req.url);
  const userId = req.context.userId!;

  // Load game state from engine
  const gameState = await gameEngine.loadState(gameId);
  if (!gameState) {
    throw {
      code: 'GAME_NOT_FOUND' as ErrorCode,
      message: 'RPG game not found',
      details: { gameId },
      timestamp: new Date(),
      playerId: userId,
    };
  }

  // Load game metadata
  const gameMeta = await kvService.get<any>(`rpg_game_meta:${gameId}`);
  if (!gameMeta) {
    throw {
      code: 'GAME_NOT_FOUND' as ErrorCode,
      message: 'Game metadata not found',
      details: { gameId },
      timestamp: new Date(),
      playerId: userId,
    };
  }

  // Load full game data from engine
  const gameData = await gameEngine.loadState(gameId);
  if (!gameData) {
    throw {
      code: 'GAME_NOT_FOUND' as ErrorCode,
      message: 'Game state not found',
      timestamp: new Date(),
      playerId: userId,
    };
  }

  // Load world statistics if available
  let worldStatistics = null;
  if (gameState.data && 'world' in gameState.data) {
    const worldId = (gameState.data as any).world.id;
    const statsResult = await rpgWorldOrchestrator.getWorldStatistics(worldId);
    if (statsResult.success) {
      worldStatistics = statsResult.data;
    }
  }

  // Calculate user permissions
  const isCreator = gameMeta.createdBy === userId;
  const isPlayer = await isPlayerInGame(gameId, userId);

  const playerPermissions = {
    canModify: isCreator || isPlayer,
    canInvite: isCreator || isPlayer,
    canKick: isCreator,
    canDelete: isCreator,
  };

  return {
    game: {
      id: gameId,
      name: gameMeta.name,
      description: gameMeta.description,
      status: gameMeta.status,
      phase: gameMeta.phase,
      createdAt: new Date(gameMeta.createdAt).toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: gameMeta.createdBy,
      players: [], // TODO: Load actual player data
    },
    state: gameState,
    worldStatistics,
    playerPermissions,
    lastActivity: new Date().toISOString(),
  };
});

// ============================================================================
// DELETE ENDPOINT - End game session
// ============================================================================

interface DeleteRPGGameResponse {
  gameId: UUID;
  deletedAt: string;
  finalStatistics: {
    duration: number;
    totalActions: number;
    playersJoined: number;
    completionStatus: string;
  };
}

const deleteHandler = createApiHandler<never, DeleteRPGGameResponse>({
  rateLimitType: 'gameManagement',
  authRules: [
    {
      resource: 'game',
      action: 'delete',
      conditions: async req => {
        // Only allow deletion by game creator
        const gameId = getGameIdFromUrl(req.url);
        const gameMeta = await kvService.get(`rpg_game_meta:${gameId}`);
        return gameMeta && gameMeta.createdBy === req.context.userId;
      },
    },
  ],
  requireAuth: true,
  timeout: 15000,
});

export const DELETE = deleteHandler(async req => {
  const gameId = getGameIdFromUrl(req.url);
  const userId = req.context.userId!;

  // Load game metadata for final statistics
  const gameMeta = await kvService.get<any>(`rpg_game_meta:${gameId}`);
  if (!gameMeta) {
    throw {
      code: 'GAME_NOT_FOUND' as ErrorCode,
      message: 'Game not found for deletion',
      details: { gameId },
      timestamp: new Date(),
      playerId: userId,
    };
  }

  // Load game state for final statistics
  const gameState = await gameEngine.loadState(gameId);
  if (!gameState) {
    throw {
      code: 'GAME_NOT_FOUND' as ErrorCode,
      message: 'Game state not found for deletion',
      details: { gameId },
      timestamp: new Date(),
      playerId: userId,
    };
  }

  const deletionTime = Date.now();
  const duration = deletionTime - gameMeta.createdAt;

  // Calculate final statistics
  const finalStatistics = {
    duration,
    totalActions: gameState.metadata.actionHistory.length,
    playersJoined: gameMeta.playerCount || 0,
    completionStatus: determineCompletionStatus(gameState),
  };

  try {
    // Archive game data before deletion
    //TODO: Implement game archival system for data retention
    await archiveGameData(gameId, gameMeta, gameState, finalStatistics);

    // Delete game state from engine
    await deleteGameState(gameId);

    // Delete game metadata
    await kvService.delete(`rpg_game_meta:${gameId}`);

    // Delete join code
    if (gameMeta.joinCode) {
      await kvService.delete(`game_join_code:${gameMeta.joinCode}`);
    }

    // Clean up world data if not shared
    if (gameState.data && 'world' in gameState.data) {
      const worldId = (gameState.data as any).world.id;
      await cleanupWorldData(worldId);
    }

    // Log game deletion for analytics
    //TODO: Implement game deletion analytics tracking
    console.log('Game deleted:', { gameId, duration, userId, finalStatistics });

    return {
      gameId,
      deletedAt: new Date(deletionTime).toISOString(),
      finalStatistics,
    };
  } catch (error) {
    throw {
      code: 'DATABASE_ERROR' as ErrorCode,
      message: 'Failed to delete game',
      details: {
        gameId,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      timestamp: new Date(),
      playerId: userId,
    };
  }
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getGameIdFromUrl(url: string): UUID {
  const parts = url.split('/');
  const idIndex = parts.findIndex(part => part === 'rpg') + 1;
  return parts[idIndex] as UUID;
}

async function isPlayerInGame(gameId: UUID, userId: UUID): Promise<boolean> {
  //TODO: Implement proper player membership checking
  // For now, check if user has any game-specific data
  const playerData = await kvService.get(
    `player_game_data:${gameId}:${userId}`
  );
  return !!playerData;
}

function determineCompletionStatus(gameState: RPGGameState): string {
  switch (gameState.phase) {
    case 'character_creation':
    case 'world_generation':
      return 'setup_incomplete';
    case 'exploration':
    case 'conversation':
    case 'combat':
    case 'rest':
    case 'shopping':
      return 'in_progress';
    case 'quest_completion':
      // Check if major quests are completed
      //TODO: Implement quest completion checking
      return 'partially_complete';
    default:
      return 'unknown';
  }
}

async function archiveGameData(
  gameId: UUID,
  gameMeta: any,
  gameState: RPGGameState,
  statistics: any
): Promise<void> {
  //TODO: Implement comprehensive game data archival
  // Store in long-term storage for analytics and potential recovery
  const archiveData = {
    gameId,
    metadata: gameMeta,
    finalState: gameState,
    statistics,
    archivedAt: Date.now(),
  };

  // For now, just log the archive data
  console.log('Archiving game data:', { gameId, statistics });
}

async function deleteGameState(gameId: UUID): Promise<void> {
  //TODO: Implement proper game state deletion from all storage systems
  // This should clean up all game-related data including:
  // - Game state in primary storage
  // - Player-specific data
  // - Combat sessions
  // - Temporary caches

  // For now, use a simple key deletion pattern
  await kvService.delete(`game_state:${gameId}`);
  await kvService.delete(`game_events:${gameId}`);
  await kvService.delete(`game_actions:${gameId}`);
}

async function cleanupWorldData(worldId: UUID): Promise<void> {
  //TODO: Implement intelligent world data cleanup
  // Check if world is shared by other games before deletion
  // Only delete if this was the last game using the world

  console.log('Cleaning up world data:', worldId);
}

// ============================================================================
// TECHNICAL DEBT MARKERS
// ============================================================================

//TODO: Implement proper player membership and role management
//TODO: Add game state caching for frequently accessed games
//TODO: Implement real-time game state synchronization with WebSockets
//TODO: Add game state diff tracking for efficient updates
//TODO: Implement game state versioning and rollback capabilities
//TODO: Add comprehensive game analytics and statistics tracking
//TODO: Implement game data export functionality for players
//TODO: Add game state validation and consistency checks
//TODO: Implement game state compression for large games
//TODO: Add game recovery mechanisms for corrupted state data
