/**
 * Unified Action Processing API Endpoint
 * POST /api/games/[id]/action
 *
 * Processes player actions for any game type through a single endpoint
 * Routes to appropriate game engine handlers based on action type and game context
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CoreGameEngine } from '@/lib/game-engine/core';
import { UUIDSchema } from '../../types';

// ============================================================================
// REQUEST VALIDATION
// ============================================================================

const GameIdParamsSchema = z.object({
  id: UUIDSchema,
});

const BaseActionSchema = z.object({
  type: z.string().min(1),
  playerId: UUIDSchema,
  data: z.record(z.any()).default({}),
  // TODO: Add action-specific validation schemas
});

// Game-specific action schemas
const RPGActionSchema = BaseActionSchema.extend({
  type: z.enum(['move', 'attack', 'cast', 'interact', 'rest', 'inventory']),
  data: z
    .object({
      target: z.string().optional(),
      location: z.string().optional(),
      itemId: z.string().optional(),
      spellId: z.string().optional(),
      // TODO: Add RPG-specific action data validation
    })
    .passthrough(),
});

const DeductionActionSchema = BaseActionSchema.extend({
  type: z.enum(['vote', 'accuse', 'discuss', 'ability', 'investigate']),
  data: z
    .object({
      target: z.string().optional(),
      message: z.string().optional(),
      abilityId: z.string().optional(),
      vote: z.string().optional(),
      // TODO: Add deduction-specific action data validation
    })
    .passthrough(),
});

const VillageActionSchema = BaseActionSchema.extend({
  type: z.enum(['build', 'trade', 'assign', 'explore', 'interact']),
  data: z
    .object({
      buildingType: z.string().optional(),
      resourceType: z.string().optional(),
      amount: z.number().optional(),
      workerId: z.string().optional(),
      location: z.string().optional(),
      // TODO: Add village-specific action data validation
    })
    .passthrough(),
});

type GameAction =
  | z.infer<typeof RPGActionSchema>
  | z.infer<typeof DeductionActionSchema>
  | z.infer<typeof VillageActionSchema>;

// ============================================================================
// ACTION PROCESSING LOGIC
// ============================================================================

const validateActionForGameType = (action: any, gameType: string) => {
  switch (gameType) {
    case 'rpg':
      return RPGActionSchema.parse(action);
    case 'deduction':
      return DeductionActionSchema.parse(action);
    case 'village':
      return VillageActionSchema.parse(action);
    default:
      return BaseActionSchema.parse(action);
  }
};

const processGameAction = async (
  gameEngine: CoreGameEngine,
  gameId: string,
  action: GameAction,
  gameType: string
) => {
  // Process action through unified game engine
  const result = await gameEngine.processAction(gameId, action);

  // Add game-specific processing results
  switch (gameType) {
    case 'rpg':
      return {
        ...result,
        type: 'rpg',
        effects: {
          characterUpdates: result.sideEffects?.characterUpdates || [],
          combatEvents: result.sideEffects?.combatEvents || [],
          worldChanges: result.sideEffects?.worldChanges || [],
          // TODO: Add detailed RPG effect processing
        },
      };

    case 'deduction':
      return {
        ...result,
        type: 'deduction',
        effects: {
          votingUpdates: result.sideEffects?.votingUpdates || [],
          roleReveals: result.sideEffects?.roleReveals || [],
          clueUpdates: result.sideEffects?.clueUpdates || [],
          // TODO: Add detailed deduction effect processing
        },
      };

    case 'village':
      return {
        ...result,
        type: 'village',
        effects: {
          resourceChanges: result.sideEffects?.resourceChanges || [],
          buildingUpdates: result.sideEffects?.buildingUpdates || [],
          npcInteractions: result.sideEffects?.npcInteractions || [],
          // TODO: Add detailed village effect processing
        },
      };

    default:
      return result;
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

    // Parse request body
    const body = await request.json();

    // Initialize game engine
    const gameEngine = new CoreGameEngine();

    // Load current game state to determine game type
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

    // Infer game type (TODO: store this in game metadata)
    const gameType = inferGameTypeFromState(gameState);

    // Validate action based on game type
    const validatedAction = validateActionForGameType(body, gameType);

    // Verify player is in the game
    const player = gameState.players.find(
      (p: any) => p.id === validatedAction.playerId
    );
    if (!player) {
      return NextResponse.json(
        {
          success: false,
          error: 'Player not in game',
          message: 'You must be a player in this game to perform actions',
        },
        { status: 403 }
      );
    }

    // Verify game is in active state
    if (gameState.status !== 'active') {
      return NextResponse.json(
        {
          success: false,
          error: 'Game not active',
          message: `Cannot perform actions when game status is: ${gameState.status}`,
        },
        { status: 400 }
      );
    }

    // Process the action
    const actionResult = await processGameAction(
      gameEngine,
      gameId,
      validatedAction,
      gameType
    );

    // Return success response with action results
    return NextResponse.json({
      success: true,
      data: {
        actionId: actionResult.id,
        success: actionResult.success,
        message: actionResult.message,
        effects: actionResult.effects,
        updatedState: actionResult.newState,
        // TODO: Add real-time event notifications
      },
      message: 'Action processed successfully',
    });
  } catch (error) {
    console.error('Action processing error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid action data',
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
          error: 'Action processing failed',
          message: error.message,
        },
        { status: 400 }
      );
    }

    // Handle timeout errors
    if (error instanceof Error && error.message.includes('timeout')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Action timeout',
          message: 'Action processing took too long and was cancelled',
        },
        { status: 408 }
      );
    }

    // Handle unexpected errors
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred while processing the action',
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
