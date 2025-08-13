/**
 * Get Deduction Game State API Endpoint
 * GET /api/game/deduction/[id]
 *
 * Retrieves the current state of a deduction game with player-specific information
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  DeductionGameState,
  DeductionPlayer,
} from '../../../../../types/deduction';
import { GameError } from '../../../../../types/core';
import { kvService } from '../../../../../lib/database';

// Query parameters validation
const GetGameQuerySchema = z.object({
  playerId: z.string().uuid().optional(),
  includeSecrets: z.coerce.boolean().optional().default(false),
});

interface GetGameResponse {
  success: boolean;
  gameState?: DeductionGameState;
  playerData?: Partial<DeductionPlayer>;
  error?: string;
  code?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<GetGameResponse>> {
  try {
    const gameId = params.id;

    // Validate game ID format
    if (!gameId || !isValidUUID(gameId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid game ID format',
          code: 'INVALID_GAME_ID',
        },
        { status: 400 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = GetGameQuerySchema.parse({
      playerId: searchParams.get('playerId'),
      includeSecrets: searchParams.get('includeSecrets'),
    });

    // Retrieve game state from storage
    const gameStateResult = await kvService.get(`game:${gameId}`);
    const gameState = gameStateResult.success
      ? (gameStateResult.data as DeductionGameState)
      : null;

    if (!gameState) {
      return NextResponse.json(
        {
          success: false,
          error: 'Game not found',
          code: 'GAME_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Note: Game type validation removed - this endpoint is deduction-specific
    // and gameState is already typed as DeductionGameState

    // Create response with sanitized game state
    let sanitizedGameState: DeductionGameState;
    let playerData: Partial<DeductionPlayer> | undefined;

    if (queryParams.playerId) {
      // Validate player is part of this game
      if (!gameState.data.alivePlayers.includes(queryParams.playerId)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Player not in this game',
            code: 'PLAYER_NOT_IN_GAME',
          },
          { status: 403 }
        );
      }

      // Get player-specific data
      playerData = await getPlayerSpecificData(gameId, queryParams.playerId);

      // Sanitize game state based on player's perspective
      sanitizedGameState = sanitizeGameStateForPlayer(
        gameState,
        queryParams.playerId,
        queryParams.includeSecrets
      );
    } else {
      // Public game state (spectator view)
      sanitizedGameState = sanitizeGameStateForPublic(gameState);
    }

    return NextResponse.json(
      {
        success: true,
        gameState: sanitizedGameState,
        playerData,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Failed to get deduction game state:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    if (error instanceof GameError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/game/deduction/[id]
 *
 * Deletes a deduction game (only allowed by creator or admin)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<{ success: boolean; error?: string; code?: string }>> {
  try {
    const gameId = params.id;

    // Validate game ID format
    if (!gameId || !isValidUUID(gameId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid game ID format',
          code: 'INVALID_GAME_ID',
        },
        { status: 400 }
      );
    }

    // Get requester ID from request (should be in auth header)
    const requesterId = request.headers.get('x-player-id');
    if (!requesterId || !isValidUUID(requesterId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      );
    }

    // Retrieve game state to check permissions
    const gameStateResult = await kvService.get(`game:${gameId}`);
    const gameState = gameStateResult.success
      ? (gameStateResult.data as DeductionGameState)
      : null;

    if (!gameState) {
      return NextResponse.json(
        {
          success: false,
          error: 'Game not found',
          code: 'GAME_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Check if requester is the creator or has admin privileges
    const isCreator = gameState.players[0] === requesterId; // First player is creator
    //TODO: Implement admin role checking
    const isAdmin = false;

    if (!isCreator && !isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient permissions to delete game',
          code: 'INSUFFICIENT_PERMISSIONS',
        },
        { status: 403 }
      );
    }

    // Prevent deletion of active games
    if (
      gameState.status === 'active' ||
      gameState.phase !== 'role_assignment'
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete active games',
          code: 'GAME_ACTIVE',
        },
        { status: 400 }
      );
    }

    // Delete game data
    await kvService.delete(`game:${gameId}`);

    // Clean up related data
    await Promise.all([
      kvService.delete(`creator_games:${requesterId}`),
      kvService.delete(`voting_session:${gameId}`),
      //TODO: Clean up additional game-related data (roles, clues, etc.)
    ]);

    return NextResponse.json(
      {
        success: true,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Failed to delete deduction game:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

// Helper functions
function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

async function getPlayerSpecificData(
  gameId: string,
  playerId: string
): Promise<Partial<DeductionPlayer> | undefined> {
  try {
    // Get player's role assignment
    const roleData = await kvService.get(`game_role:${gameId}:${playerId}`);

    // Get player's clues
    const cluesData = await kvService.get(`game_clues:${gameId}:${playerId}`);

    // Get player's voting history
    const votingHistory = await kvService.get(
      `voting_history:${gameId}:${playerId}`
    );

    return {
      gameSpecificData: {
        role: roleData || null,
        status: 'alive', // Default status
        votingPower: 1,
        clues: cluesData || [],
        suspicions: {},
        communications: [],
        actionHistory: [],
        isRevealed: false,
      },
    };
  } catch (error) {
    console.error('Failed to get player specific data:', error);
    return undefined;
  }
}

function sanitizeGameStateForPlayer(
  gameState: DeductionGameState,
  playerId: string,
  includeSecrets: boolean
): DeductionGameState {
  // Create a copy of the game state
  const sanitized = { ...gameState };

  // Filter events based on player visibility
  sanitized.data.events = gameState.data.events.filter(
    event => event.isPublic || event.affectedPlayers.includes(playerId)
  );

  // Filter clues based on player access
  sanitized.data.cluesAvailable = gameState.data.cluesAvailable.filter(clue => {
    return (
      clue.isRevealed || (clue.affectedPlayers?.includes(playerId) ?? false)
    );
  });

  // Filter night actions (players shouldn't see others' secret actions)
  if (!includeSecrets) {
    sanitized.data.nightActions = gameState.data.nightActions.filter(
      action => action.actorId === playerId || action.isResolved
    );
  }

  return sanitized;
}

function sanitizeGameStateForPublic(
  gameState: DeductionGameState
): DeductionGameState {
  const sanitized = { ...gameState };

  // Only show public events
  sanitized.data.events = gameState.data.events.filter(event => event.isPublic);

  // Only show revealed clues
  sanitized.data.cluesAvailable = gameState.data.cluesAvailable.filter(
    clue => clue.isRevealed
  );

  // Don't show night actions at all for public view
  sanitized.data.nightActions = [];

  return sanitized;
}
