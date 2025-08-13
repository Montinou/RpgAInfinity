/**
 * Game Joining API Endpoint
 * POST /api/games/[id]/join
 *
 * Allows players to join any game type through a unified endpoint
 * Handles player validation, capacity checks, and game state updates
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CoreGameEngine } from '@/lib/game-engine/core';
import { v4 as uuidv4 } from 'uuid';
import { UUIDSchema } from '../../types';

// ============================================================================
// REQUEST VALIDATION
// ============================================================================

const GameIdParamsSchema = z.object({
  id: UUIDSchema,
});

const JoinGameRequestSchema = z.object({
  playerName: z.string().min(1).max(50),
  playerId: UUIDSchema.optional(), // Optional for existing players
  role: z.enum(['player', 'spectator']).default('player'),
  // TODO: Add game-specific join preferences
});

type JoinGameRequest = z.infer<typeof JoinGameRequestSchema>;

// ============================================================================
// GAME-SPECIFIC JOIN LOGIC
// ============================================================================

const validateJoinRequest = (
  request: JoinGameRequest,
  gameState: any,
  gameType: string
) => {
  // Common validations for all game types
  const validations = {
    canJoin: true,
    reason: '',
    playerRole: request.role,
  };

  // Check if game is in joinable state
  if (gameState.status === 'completed' || gameState.status === 'abandoned') {
    return {
      ...validations,
      canJoin: false,
      reason: `Cannot join ${gameState.status} game`,
    };
  }

  // Check if game is full
  const currentPlayerCount = gameState.players.filter(
    (p: any) => p.role === 'player'
  ).length;
  const maxPlayers = gameState.maxPlayers || 8;

  if (request.role === 'player' && currentPlayerCount >= maxPlayers) {
    return {
      ...validations,
      canJoin: false,
      reason: 'Game is full',
    };
  }

  // Check if player is already in game
  const existingPlayer = gameState.players.find(
    (p: any) => p.id === request.playerId || p.name === request.playerName
  );

  if (existingPlayer) {
    return {
      ...validations,
      canJoin: false,
      reason: 'Player already in game',
    };
  }

  // Game-specific validations
  switch (gameType) {
    case 'rpg':
      // RPG games can usually be joined mid-game
      if (gameState.status === 'active') {
        // TODO: Check if RPG allows mid-game joining based on settings
        return {
          ...validations,
          canJoin: true,
          reason: 'Joining active RPG game',
        };
      }
      break;

    case 'deduction':
      // Deduction games typically can't be joined once started
      if (gameState.status === 'active') {
        return {
          ...validations,
          canJoin: false,
          reason: 'Cannot join active deduction game',
        };
      }
      break;

    case 'village':
      // Village games allow joining but with limitations
      if (gameState.status === 'active') {
        // TODO: Check village-specific join rules (season, resources, etc.)
        return {
          ...validations,
          canJoin: true,
          reason: 'Joining active village game',
        };
      }
      break;
  }

  return validations;
};

const createPlayerData = (request: JoinGameRequest, gameType: string) => {
  const basePlayer = {
    id: request.playerId || uuidv4(),
    name: request.playerName,
    role: request.role,
    isActive: true,
    joinedAt: new Date(),
  };

  // Add game-specific player initialization
  switch (gameType) {
    case 'rpg':
      return {
        ...basePlayer,
        character: {
          level: 1,
          health: 100,
          mana: 50,
          // TODO: Add default character creation based on game settings
        },
        inventory: [],
        position: { x: 0, y: 0 }, // Starting position
      };

    case 'deduction':
      return {
        ...basePlayer,
        roleAssigned: null, // Will be assigned when game starts
        isAlive: true,
        votesReceived: 0,
        // TODO: Add deduction-specific player state
      };

    case 'village':
      return {
        ...basePlayer,
        resources: {
          food: 10,
          wood: 5,
          stone: 2,
          // TODO: Add village-specific starting resources
        },
        buildings: [],
        workers: [],
      };

    default:
      return basePlayer;
  }
};

// ============================================================================
// API HANDLER
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate game ID parameter
    const { id: gameId } = GameIdParamsSchema.parse(params);

    // Parse and validate request body
    const body = await request.json();
    const joinRequest = JoinGameRequestSchema.parse(body);

    // Initialize game engine
    const gameEngine = new CoreGameEngine();

    // Load current game state
    const gameState = await gameEngine.loadState(gameId);
    if (!gameState) {
      return NextResponse.json(
        {
          success: false,
          error: 'Game not found',
          message: `No game found with ID: ${gameId}`,
        },
        { status: 404 }
      );
    }

    // Determine game type
    const gameType = inferGameTypeFromState(gameState);

    // Validate join request
    const validation = validateJoinRequest(joinRequest, gameState, gameType);
    if (!validation.canJoin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot join game',
          message: validation.reason,
        },
        { status: 400 }
      );
    }

    // Create player data
    const playerData = createPlayerData(joinRequest, gameType);

    // Add player to game state
    const updatedState = {
      ...gameState,
      players: [...gameState.players, playerData],
      lastUpdated: new Date(),
    };

    // Save updated state
    await gameEngine.saveState(gameId, updatedState);

    // TODO: Trigger game events (player joined, role assignment, etc.)
    // TODO: Send real-time notifications to other players

    // Return success response
    return NextResponse.json({
      success: true,
      data: {
        playerId: playerData.id,
        playerName: playerData.name,
        role: playerData.role,
        gameType: gameType,
        currentPlayers: updatedState.players.length,
        gameStatus: updatedState.status,
        // TODO: Add game-specific welcome data
      },
      message: `Successfully joined ${gameType} game`,
    });
  } catch (error) {
    console.error('Game join error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid join request',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }

    // Handle game engine errors
    if (error instanceof Error && error.name === 'GameError') {
      return NextResponse.json(
        {
          success: false,
          error: 'Join failed',
          message: error.message,
        },
        { status: 400 }
      );
    }

    // Handle concurrency errors
    if (error instanceof Error && error.message.includes('concurrent')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Join conflict',
          message: 'Another player joined at the same time, please try again',
        },
        { status: 409 }
      );
    }

    // Handle unexpected errors
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred while joining the game',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function inferGameTypeFromState(gameState: any): string {
  if (gameState.world || gameState.combat || gameState.characters) {
    return 'rpg';
  }
  if (gameState.voting || gameState.roles || gameState.clues) {
    return 'deduction';
  }
  if (gameState.resources || gameState.season || gameState.npcs) {
    return 'village';
  }
  return 'unknown';
}

// ============================================================================
// OPTIONS HANDLER (CORS Support)
// ============================================================================

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        Allow: 'POST, OPTIONS',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}
