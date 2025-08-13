/**
 * Join Deduction Game API Endpoint
 * POST /api/game/deduction/[id]/join
 *
 * Allows a player to join an existing deduction game
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DeductionGameState } from '../../../../../../types/deduction';
import { GameError } from '../../../../../../types/core';
import { kvService } from '../../../../../../lib/database';

// Request validation schema
const JoinGameRequestSchema = z.object({
  playerId: z.string().uuid(),
  playerName: z.string().min(1).max(50).optional(),
  inviteCode: z.string().optional(), // For private games
});

type JoinGameRequest = z.infer<typeof JoinGameRequestSchema>;

interface JoinGameResponse {
  success: boolean;
  gameState?: DeductionGameState;
  playerPosition?: number;
  error?: string;
  code?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<JoinGameResponse>> {
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

    // Parse and validate request body
    const body = await request.json();
    const validatedRequest = JoinGameRequestSchema.parse(body);

    // Retrieve game state from storage
    const gameState = (await kvService.get(
      `game:${gameId}`
    )) as DeductionGameState | null;

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

    // Validate game type
    if (gameState.type !== 'deduction') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid game type',
          code: 'INVALID_GAME_TYPE',
        },
        { status: 400 }
      );
    }

    // Check if game is in a joinable state
    if (gameState.status !== 'waiting_for_players') {
      return NextResponse.json(
        {
          success: false,
          error: 'Game is not accepting new players',
          code: 'GAME_NOT_JOINABLE',
        },
        { status: 400 }
      );
    }

    // Check if player is already in the game
    if (gameState.players.includes(validatedRequest.playerId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Player already in game',
          code: 'PLAYER_ALREADY_JOINED',
        },
        { status: 400 }
      );
    }

    // Check if game is full
    if (gameState.currentPlayerCount >= gameState.config.maxPlayers) {
      return NextResponse.json(
        {
          success: false,
          error: 'Game is full',
          code: 'GAME_FULL',
        },
        { status: 400 }
      );
    }

    // Validate access to private games
    if (gameState.config.isPrivate) {
      if (!validatedRequest.inviteCode) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invite code required for private game',
            code: 'INVITE_CODE_REQUIRED',
          },
          { status: 403 }
        );
      }

      // Validate invite code
      const validInviteCode = await kvService.get(`invite_code:${gameId}`);
      if (validatedRequest.inviteCode !== validInviteCode) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid invite code',
            code: 'INVALID_INVITE_CODE',
          },
          { status: 403 }
        );
      }
    }

    // Add player to game
    const updatedGameState: DeductionGameState = {
      ...gameState,
      players: [...gameState.players, validatedRequest.playerId],
      currentPlayerCount: gameState.currentPlayerCount + 1,
      updatedAt: Date.now(),
      data: {
        ...gameState.data,
        alivePlayers: [
          ...gameState.data.alivePlayers,
          validatedRequest.playerId,
        ],
        events: [
          ...gameState.data.events,
          {
            id: crypto.randomUUID(),
            type: 'phase_change',
            description: `Player ${validatedRequest.playerName || validatedRequest.playerId} joined the game`,
            timestamp: Date.now(),
            affectedPlayers: [validatedRequest.playerId],
            isPublic: true,
            flavorText: `Welcome to the game!`,
          },
        ],
      },
    };

    // Check if we can start the game (minimum players reached)
    if (
      updatedGameState.currentPlayerCount >= updatedGameState.config.minPlayers
    ) {
      updatedGameState.status = 'ready_to_start';
    }

    // Save updated game state
    await kvService.set(
      `game:${gameId}`,
      updatedGameState,
      7 * 24 * 60 * 60 // 7 day TTL
    );

    // Store player-to-game mapping for easy lookup
    await kvService.set(
      `player_game:${validatedRequest.playerId}`,
      gameId,
      7 * 24 * 60 * 60
    );

    // Initialize player-specific data
    await initializePlayerData(gameId, validatedRequest.playerId);

    //TODO: Implement WebSocket notification to other players about new joiner

    const playerPosition = updatedGameState.players.length;

    return NextResponse.json(
      {
        success: true,
        gameState: updatedGameState,
        playerPosition,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Failed to join deduction game:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request format',
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

// Helper functions
function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

async function initializePlayerData(
  gameId: string,
  playerId: string
): Promise<void> {
  try {
    // Initialize player's game-specific data storage
    const initialPlayerData = {
      suspicions: {},
      communications: [],
      actionHistory: [],
      joinedAt: Date.now(),
    };

    // Store initial player data
    await kvService.set(
      `player_data:${gameId}:${playerId}`,
      initialPlayerData,
      7 * 24 * 60 * 60 // 7 day TTL
    );

    // Initialize empty clues collection for player
    await kvService.set(
      `game_clues:${gameId}:${playerId}`,
      [],
      7 * 24 * 60 * 60
    );

    // Initialize empty voting history
    await kvService.set(
      `voting_history:${gameId}:${playerId}`,
      [],
      7 * 24 * 60 * 60
    );
  } catch (error) {
    console.error('Failed to initialize player data:', error);
    //TODO: Implement proper error logging service
    // Non-critical error, don't throw to prevent join failure
  }
}
