/**
 * Game State Retrieval API Endpoint
 * GET /api/games/[id]
 *
 * Retrieves current game state for any game type
 * Returns game-specific data formatted for frontend consumption
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CoreGameEngine } from '@/lib/game-engine/core';
import { UUIDSchema } from '../types';

// ============================================================================
// REQUEST VALIDATION
// ============================================================================

const GameIdParamsSchema = z.object({
  id: UUIDSchema,
});

// ============================================================================
// RESPONSE FORMATTING
// ============================================================================

const formatGameStateForClient = (gameState: any, gameType: string) => {
  // Base game state that's common across all game types
  const baseState = {
    gameId: gameState.gameId,
    status: gameState.status,
    currentPhase: gameState.currentPhase,
    players: gameState.players.map((player: any) => ({
      id: player.id,
      name: player.name,
      role: player.role,
      isActive: player.isActive,
      // TODO: Add player-specific UI state
    })),
    turn: gameState.turn,
    startedAt: gameState.startedAt,
    lastUpdated: gameState.lastUpdated,
  };

  // Add game-specific state based on type
  switch (gameType) {
    case 'rpg':
      return {
        ...baseState,
        type: 'rpg',
        world: {
          currentLocation: gameState.world?.currentLocation,
          availableActions: gameState.world?.availableActions || [],
          // TODO: Add detailed world state for UI
        },
        combat: gameState.combat
          ? {
              isActive: gameState.combat.isActive,
              turn: gameState.combat.turn,
              participants: gameState.combat.participants,
            }
          : null,
        // TODO: Add character sheets, inventory, quests
      };

    case 'deduction':
      return {
        ...baseState,
        type: 'deduction',
        voting: {
          isActive: gameState.voting?.isActive || false,
          phase: gameState.voting?.phase || 'discussion',
          timeRemaining: gameState.voting?.timeRemaining || 0,
          // TODO: Add voting results, accusations
        },
        roles: gameState.roles
          ? {
              assigned: gameState.roles.assigned,
              revealed: gameState.roles.revealed || [],
            }
          : null,
        // TODO: Add clues, night actions, discussion history
      };

    case 'village':
      return {
        ...baseState,
        type: 'village',
        resources: gameState.resources || {},
        season: {
          current: gameState.season?.current || 'spring',
          day: gameState.season?.day || 1,
          year: gameState.season?.year || 1,
        },
        events: {
          active: gameState.events?.active || [],
          pending: gameState.events?.pending || [],
        },
        // TODO: Add NPCs, buildings, trade routes
      };

    default:
      return {
        ...baseState,
        type: 'unknown',
        rawState: gameState, // Fallback for unknown game types
      };
  }
};

// ============================================================================
// API HANDLER
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate game ID parameter
    const { id: gameId } = GameIdParamsSchema.parse(params);

    // Initialize game engine
    const gameEngine = new CoreGameEngine();

    // Load game state
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

    // Load full game metadata (we need the game config for type)
    // TODO: Optimize this by storing game type in state or separate metadata
    let gameConfig;
    try {
      // This is a simplified approach - in production, we'd store game metadata separately
      const gameMetadata = await gameEngine.loadState(`${gameId}:metadata`);
      gameConfig = gameMetadata?.config;
    } catch {
      // Fallback: try to infer game type from state structure
      gameConfig = { type: inferGameType(gameState) };
    }

    const gameType = gameConfig?.type || 'unknown';

    // Format state for client consumption
    const clientState = formatGameStateForClient(gameState, gameType);

    // Return formatted game state
    return NextResponse.json({
      success: true,
      data: clientState,
      message: 'Game state retrieved successfully',
    });
  } catch (error) {
    console.error('Game state retrieval error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid game ID',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    // Handle game engine errors
    if (error instanceof Error && error.name === 'GameError') {
      return NextResponse.json(
        {
          success: false,
          error: 'Game state error',
          message: error.message,
        },
        { status: 400 }
      );
    }

    // Handle unexpected errors
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred while retrieving game state',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Infer game type from state structure
 * TODO: Replace with proper metadata storage
 */
function inferGameType(gameState: any): string {
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
        Allow: 'GET, OPTIONS',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}
