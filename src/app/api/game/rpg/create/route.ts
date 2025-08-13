/**
 * POST /api/game/rpg/create - Create new RPG session
 *
 * Creates a new RPG game session with world generation and initial setup.
 * This endpoint orchestrates the complete game initialization process.
 */

import { NextRequest } from 'next/server';
import { createApiHandler } from '@/lib/api/middleware';
import { CreateRPGGameSchema } from '@/lib/api/rpg-validation';
import { gameEngine } from '@/lib/game-engine';
import { rpgWorldOrchestrator } from '@/lib/games/rpg';
import { kvService } from '@/lib/database';
import { RPGConfig, RPGGameState, UUID } from '@/types';

interface CreateRPGGameRequest {
  config: RPGConfig;
  worldPreferences: {
    theme: string;
    size: 'small' | 'medium' | 'large';
    complexity: 'simple' | 'moderate' | 'complex';
    tone: 'light' | 'balanced' | 'dark';
    biomes: string[];
    factionCount: number;
    npcDensity: 'sparse' | 'normal' | 'dense';
    questDensity: 'few' | 'moderate' | 'many';
    magicLevel: 'none' | 'rare' | 'common' | 'abundant';
    technologyLevel:
      | 'primitive'
      | 'medieval'
      | 'renaissance'
      | 'industrial'
      | 'modern'
      | 'future';
    dangerLevel: 'peaceful' | 'moderate' | 'dangerous';
    culturalDiversity: 'homogeneous' | 'diverse' | 'cosmopolitan';
  };
}

interface CreateRPGGameResponse {
  gameId: UUID;
  config: RPGConfig;
  worldData: any;
  initialState: RPGGameState;
  joinCode: string;
  estimatedSetupTime: number;
}

const handler = createApiHandler<CreateRPGGameRequest, CreateRPGGameResponse>({
  rateLimitType: 'gameManagement',
  authRules: [{ resource: 'game', action: 'create' }],
  requestSchema: CreateRPGGameSchema,
  requireAuth: false, // Allow anonymous game creation for now
  timeout: 45000, // 45 seconds for world generation
});

export const POST = handler(async (req, body) => {
  const { config, worldPreferences } = body;
  const userId = req.context.userId;
  const startTime = Date.now();

  try {
    // Step 1: Generate complete world
    const worldResult = await rpgWorldOrchestrator.generateCompleteWorld(
      worldPreferences.theme,
      {
        theme: worldPreferences.theme as any,
        size: worldPreferences.size,
        complexity: worldPreferences.complexity,
        tone: worldPreferences.tone,
        biomes: worldPreferences.biomes as any[],
        factionCount: worldPreferences.factionCount,
        npcDensity: worldPreferences.npcDensity,
        questDensity: worldPreferences.questDensity,
        magicLevel: worldPreferences.magicLevel,
        technologyLevel: worldPreferences.technologyLevel,
        dangerLevel: worldPreferences.dangerLevel,
        culturalDiversity: worldPreferences.culturalDiversity,
      }
    );

    if (!worldResult.success) {
      throw {
        code: 'AI_SERVICE_ERROR',
        message: 'Failed to generate game world',
        details: worldResult.error,
        timestamp: new Date(),
        playerId: userId,
      };
    }

    // Step 2: Create game session through game engine
    const game = await gameEngine.createGame({
      ...config,
      settings: {
        ...config.settings,
        worldId: worldResult.data.worldData.id,
      },
    });

    // Step 3: Initialize RPG game state
    const initialState: RPGGameState = {
      gameId: game.id,
      phase: 'character_creation',
      turn: 0,
      data: {
        world: worldResult.data.worldData,
        currentLocation: worldResult.data.worldData.locations[0]?.id || '',
        timeOfDay: 8, // Start at 8 AM
        dayCount: 1,
        weather: {
          type: 'clear',
          intensity: 'light',
          effects: [],
        },
        globalFlags: {},
        partyInventory: {
          capacity: 100,
          items: [],
          equipment: {
            accessories: [],
          },
          currency: 100, // Starting gold
        },
        partyReputation: {},
      },
      metadata: {
        version: 1,
        actionHistory: [],
      },
    };

    // Step 4: Save initial game state
    await gameEngine.saveState(game.id, initialState);

    // Step 5: Generate join code
    const joinCode = generateJoinCode(game.id);
    await kvService.set(
      `game_join_code:${joinCode}`,
      { gameId: game.id, createdBy: userId, createdAt: Date.now() },
      { ttl: 24 * 60 * 60 * 1000 } // 24 hour expiry
    );

    // Step 6: Store game metadata for quick access
    await kvService.set(
      `rpg_game_meta:${game.id}`,
      {
        gameId: game.id,
        name: config.name,
        description: config.description,
        createdBy: userId,
        createdAt: Date.now(),
        status: game.status,
        phase: initialState.phase,
        playerCount: game.players.length,
        maxPlayers: config.maxPlayers,
        worldTheme: worldPreferences.theme,
        worldSize: worldPreferences.size,
        joinCode,
      },
      { ttl: 30 * 24 * 60 * 60 * 1000 } // 30 day expiry
    );

    const setupTime = Date.now() - startTime;

    return {
      gameId: game.id,
      config,
      worldData: {
        id: worldResult.data.worldData.id,
        name: worldResult.data.worldData.name,
        description: worldResult.data.worldData.description,
        theme: worldResult.data.worldData.theme,
        locationCount: worldResult.data.worldData.locations.length,
        npcCount: worldResult.data.worldData.npcs.length,
        factionCount: worldResult.data.worldStats.totalFactions,
        systemsEnabled: worldResult.data.worldStats.systemsEnabled,
      },
      initialState,
      joinCode,
      estimatedSetupTime: setupTime,
    };
  } catch (error) {
    // Clean up any partial state on error
    //TODO: Implement proper cleanup on failed game creation
    throw error;
  }
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateJoinCode(gameId: UUID): string {
  // Generate a human-readable join code
  const adjectives = [
    'brave',
    'swift',
    'wise',
    'bold',
    'clever',
    'mighty',
    'noble',
    'fierce',
    'loyal',
    'bright',
    'strong',
    'quick',
    'keen',
    'wild',
    'free',
    'pure',
  ];

  const nouns = [
    'dragon',
    'phoenix',
    'lion',
    'eagle',
    'wolf',
    'bear',
    'tiger',
    'falcon',
    'horse',
    'stag',
    'raven',
    'hawk',
    'fox',
    'elk',
    'owl',
    'shark',
  ];

  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');

  return `${adjective}-${noun}-${number}`;
}

// ============================================================================
// TECHNICAL DEBT MARKERS
// ============================================================================

//TODO: Implement game creation queue for handling concurrent requests
//TODO: Add game template system for quick setup with predefined configurations
//TODO: Implement world generation progress tracking with WebSocket updates
//TODO: Add game creation analytics and performance monitoring
//TODO: Implement game creation rollback mechanism for failures
//TODO: Add support for importing custom world data
//TODO: Implement game creation webhook notifications
//TODO: Add game creation cost calculation for premium features
