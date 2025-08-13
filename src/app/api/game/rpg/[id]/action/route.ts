/**
 * POST /api/game/rpg/[id]/action - Process player action
 *
 * Processes player actions in RPG games and returns updated game state.
 * Handles all types of RPG actions including movement, combat, dialogue, etc.
 */

import { NextRequest } from 'next/server';
import { createApiHandler } from '@/lib/api/middleware';
import { RPGActionSchema } from '@/lib/api/rpg-validation';
import { gameEngine } from '@/lib/game-engine';
import { rpgWorldOrchestrator } from '@/lib/games/rpg';
import { kvService } from '@/lib/database';
import {
  RPGGameState,
  UUID,
  GameAction,
  ActionResult,
  ErrorCode,
  GameEvent,
} from '@/types';

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

interface RPGActionRequest {
  type: string;
  data: Record<string, any>;
  playerId: UUID;
  metadata?: Record<string, any>;
}

interface RPGActionResponse {
  success: boolean;
  newState: RPGGameState;
  events: GameEvent[];
  narrative?: {
    content: string;
    type: 'action_result' | 'dialogue' | 'combat' | 'exploration' | 'system';
    mood: string;
    choices?: Array<{
      id: string;
      text: string;
      consequences: string[];
    }>;
  };
  actionResult: {
    type: string;
    success: boolean;
    description: string;
    effects: Record<string, any>;
    nextPossibleActions: string[];
  };
  performanceMetrics: {
    processingTime: number;
    aiGenerationTime?: number;
    validationTime: number;
  };
}

// ============================================================================
// MAIN ACTION HANDLER
// ============================================================================

const handler = createApiHandler<RPGActionRequest, RPGActionResponse>({
  rateLimitType: 'default',
  authRules: [
    {
      resource: 'game',
      action: 'play',
      conditions: async req => {
        // Verify user is a player in the game
        const gameId = getGameIdFromUrl(req.url);
        const userId = req.context.userId;
        if (!userId) return false;

        return await isPlayerInGame(gameId, userId);
      },
    },
  ],
  requestSchema: RPGActionSchema,
  requireAuth: true,
  timeout: 30000, // 30 seconds for complex actions
});

export const POST = handler(async (req, body) => {
  const gameId = getGameIdFromUrl(req.url);
  const userId = req.context.userId!;
  const startTime = Date.now();
  let aiGenerationTime = 0;

  // Validate player is in the game and action is allowed
  await validatePlayerAction(gameId, userId, body);

  // Load current game state
  const currentState = await gameEngine.loadState(gameId);
  if (!currentState) {
    throw {
      code: 'GAME_NOT_FOUND' as ErrorCode,
      message: 'Game state not found',
      details: { gameId },
      timestamp: new Date(),
      playerId: userId,
    };
  }

  const validationEndTime = Date.now();
  const validationTime = validationEndTime - startTime;

  try {
    // Create game action object
    const gameAction: GameAction = {
      id: crypto.randomUUID(),
      type: body.type,
      playerId: body.playerId,
      gameId,
      timestamp: new Date(),
      data: body.data,
      metadata: body.metadata,
    };

    // Process action based on type
    const actionResult = await processRPGAction(gameAction, currentState);

    if (!actionResult.success) {
      throw {
        code: 'INVALID_ACTION' as ErrorCode,
        message: actionResult.error?.message || 'Action processing failed',
        details: actionResult.error?.details || {},
        timestamp: new Date(),
        playerId: userId,
      };
    }

    // Generate AI narrative response if needed
    let narrative = undefined;
    const aiStartTime = Date.now();

    if (shouldGenerateNarrative(body.type, actionResult)) {
      narrative = await generateActionNarrative(
        gameAction,
        actionResult,
        currentState
      );
      aiGenerationTime = Date.now() - aiStartTime;
    }

    // Update world systems if action affects them
    if (affectsWorldSystems(body.type)) {
      await updateWorldSystems(gameId, gameAction, actionResult);
    }

    // Save updated game state
    await gameEngine.saveState(gameId, actionResult.newState!);

    // Update game metadata
    await updateGameMetadata(gameId, actionResult.newState!);

    // Log action for analytics
    await logPlayerAction(gameId, userId, gameAction, actionResult);

    const processingTime = Date.now() - startTime;

    return {
      success: true,
      newState: actionResult.newState!,
      events: actionResult.events,
      narrative,
      actionResult: {
        type: body.type,
        success: true,
        description: generateActionDescription(gameAction, actionResult),
        effects: extractActionEffects(actionResult),
        nextPossibleActions: determineNextActions(
          actionResult.newState!,
          gameAction
        ),
      },
      performanceMetrics: {
        processingTime,
        aiGenerationTime: aiGenerationTime > 0 ? aiGenerationTime : undefined,
        validationTime,
      },
    };
  } catch (error) {
    // Handle action processing errors
    if (isActionError(error)) {
      throw error;
    }

    throw {
      code: 'INVALID_ACTION' as ErrorCode,
      message: 'Failed to process RPG action',
      details: {
        actionType: body.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      timestamp: new Date(),
      playerId: userId,
    };
  }
});

// ============================================================================
// ACTION PROCESSING LOGIC
// ============================================================================

async function processRPGAction(
  action: GameAction,
  currentState: RPGGameState
): Promise<ActionResult> {
  // Delegate to game engine for processing
  const result = await gameEngine.processAction(action.gameId, action);

  // Add RPG-specific processing
  if (result.success && result.newState) {
    const enhancedResult = await enhanceRPGActionResult(
      action,
      result,
      currentState
    );
    return enhancedResult;
  }

  return result;
}

async function enhanceRPGActionResult(
  action: GameAction,
  result: ActionResult,
  previousState: RPGGameState
): Promise<ActionResult> {
  const newState = result.newState as RPGGameState;

  // Process specific RPG action types
  switch (action.type) {
    case 'move':
      return await processMovementAction(
        action,
        newState,
        previousState,
        result
      );

    case 'explore':
      return await processExplorationAction(
        action,
        newState,
        previousState,
        result
      );

    case 'talk':
      return await processDialogueAction(
        action,
        newState,
        previousState,
        result
      );

    case 'use_item':
      return await processItemAction(action, newState, previousState, result);

    case 'rest':
      return await processRestAction(action, newState, previousState, result);

    case 'trade':
      return await processTradeAction(action, newState, previousState, result);

    default:
      return result;
  }
}

// ============================================================================
// SPECIFIC ACTION PROCESSORS
// ============================================================================

async function processMovementAction(
  action: GameAction,
  newState: RPGGameState,
  previousState: RPGGameState,
  result: ActionResult
): Promise<ActionResult> {
  const targetLocationId = action.data.targetLocation as UUID;

  // Update current location in state
  const updatedData = {
    ...newState.data,
    currentLocation: targetLocationId,
  };

  const updatedState: RPGGameState = {
    ...newState,
    data: updatedData,
    metadata: {
      ...newState.metadata,
      version: newState.metadata.version + 1,
    },
  };

  // Generate location discovery events if needed
  const world = newState.data.world;
  const targetLocation = world.locations.find(
    loc => loc.id === targetLocationId
  );

  const events = [...result.events];
  if (targetLocation && !targetLocation.isDiscovered) {
    events.push({
      id: crypto.randomUUID(),
      type: 'location_discovered',
      gameId: action.gameId,
      timestamp: new Date(),
      data: {
        locationId: targetLocationId,
        locationName: targetLocation.name,
        playerId: action.playerId,
      },
      affectedPlayers: [action.playerId],
      isPublic: true,
    });
  }

  return {
    ...result,
    newState: updatedState,
    events,
  };
}

async function processExplorationAction(
  action: GameAction,
  newState: RPGGameState,
  previousState: RPGGameState,
  result: ActionResult
): Promise<ActionResult> {
  // Handle exploration mechanics
  //TODO: Implement comprehensive exploration system with skill checks
  return result;
}

async function processDialogueAction(
  action: GameAction,
  newState: RPGGameState,
  previousState: RPGGameState,
  result: ActionResult
): Promise<ActionResult> {
  // Handle NPC dialogue interactions
  //TODO: Implement dynamic dialogue system with AI-generated responses
  return result;
}

async function processItemAction(
  action: GameAction,
  newState: RPGGameState,
  previousState: RPGGameState,
  result: ActionResult
): Promise<ActionResult> {
  // Handle item usage and effects
  //TODO: Implement comprehensive item system with complex effects
  return result;
}

async function processRestAction(
  action: GameAction,
  newState: RPGGameState,
  previousState: RPGGameState,
  result: ActionResult
): Promise<ActionResult> {
  // Handle rest mechanics - heal players, advance time, etc.
  //TODO: Implement rest system with time progression and random events
  return result;
}

async function processTradeAction(
  action: GameAction,
  newState: RPGGameState,
  previousState: RPGGameState,
  result: ActionResult
): Promise<ActionResult> {
  // Handle trading with NPCs or other players
  //TODO: Implement comprehensive trading system with dynamic prices
  return result;
}

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
  const playerData = await kvService.get(
    `player_game_data:${gameId}:${userId}`
  );
  return !!playerData;
}

async function validatePlayerAction(
  gameId: UUID,
  userId: UUID,
  action: RPGActionRequest
): Promise<void> {
  // Verify player is in game
  if (!(await isPlayerInGame(gameId, userId))) {
    throw {
      code: 'PERMISSION_DENIED' as ErrorCode,
      message: 'Player is not a member of this game',
      details: { gameId, userId },
      timestamp: new Date(),
      playerId: userId,
    };
  }

  // Verify action is valid for current game phase
  const gameState = await gameEngine.loadState(gameId);
  if (!gameState) {
    throw {
      code: 'GAME_NOT_FOUND' as ErrorCode,
      message: 'Game state not found',
      timestamp: new Date(),
      playerId: userId,
    };
  }

  // Check if action is valid for current phase
  if (!isActionValidForPhase(action.type, gameState.phase)) {
    throw {
      code: 'INVALID_PHASE' as ErrorCode,
      message: `Action '${action.type}' not valid in phase '${gameState.phase}'`,
      details: { actionType: action.type, currentPhase: gameState.phase },
      timestamp: new Date(),
      playerId: userId,
    };
  }
}

function shouldGenerateNarrative(
  actionType: string,
  result: ActionResult
): boolean {
  const narrativeActions = [
    'move',
    'explore',
    'talk',
    'attack',
    'cast_spell',
    'use_item',
    'rest',
  ];
  return narrativeActions.includes(actionType) && result.success;
}

async function generateActionNarrative(
  action: GameAction,
  result: ActionResult,
  state: RPGGameState
): Promise<any> {
  //TODO: Implement AI-powered narrative generation
  return {
    content: `You ${action.type}. The action was successful.`,
    type: 'action_result',
    mood: 'neutral',
    choices: [],
  };
}

function affectsWorldSystems(actionType: string): boolean {
  const worldActions = ['move', 'explore', 'complete_quest', 'faction_action'];
  return worldActions.includes(actionType);
}

async function updateWorldSystems(
  gameId: UUID,
  action: GameAction,
  result: ActionResult
): Promise<void> {
  //TODO: Implement world system updates based on player actions
  console.log('Updating world systems for action:', action.type);
}

async function updateGameMetadata(
  gameId: UUID,
  state: RPGGameState
): Promise<void> {
  const metadata = await kvService.get(`rpg_game_meta:${gameId}`);
  if (metadata) {
    await kvService.set(
      `rpg_game_meta:${gameId}`,
      {
        ...metadata,
        phase: state.phase,
        lastActivity: Date.now(),
      },
      { ttl: 30 * 24 * 60 * 60 * 1000 }
    );
  }
}

async function logPlayerAction(
  gameId: UUID,
  userId: UUID,
  action: GameAction,
  result: ActionResult
): Promise<void> {
  //TODO: Implement comprehensive action logging for analytics
  console.log('Player action logged:', {
    gameId,
    userId,
    actionType: action.type,
    success: result.success,
    timestamp: action.timestamp,
  });
}

function generateActionDescription(
  action: GameAction,
  result: ActionResult
): string {
  //TODO: Generate descriptive text based on action type and result
  return `${action.type} action completed successfully`;
}

function extractActionEffects(result: ActionResult): Record<string, any> {
  //TODO: Extract and format action effects from result
  return (
    result.sideEffects?.reduce(
      (acc, effect) => {
        acc[effect.type] = effect.data;
        return acc;
      },
      {} as Record<string, any>
    ) || {}
  );
}

function determineNextActions(
  state: RPGGameState,
  lastAction: GameAction
): string[] {
  //TODO: Implement dynamic next action determination based on game state
  const baseActions = ['move', 'explore', 'talk', 'use_item', 'rest'];

  // Add context-specific actions based on current phase and location
  switch (state.phase) {
    case 'combat':
      return ['attack', 'defend', 'cast_spell', 'use_item', 'flee'];
    case 'conversation':
      return ['talk', 'give_item', 'end_conversation'];
    case 'shopping':
      return ['buy', 'sell', 'browse', 'leave_shop'];
    default:
      return baseActions;
  }
}

function isActionValidForPhase(actionType: string, phase: string): boolean {
  const phaseActions: Record<string, string[]> = {
    character_creation: ['create_character', 'select_background'],
    world_generation: ['wait'],
    exploration: ['move', 'explore', 'talk', 'use_item', 'rest', 'trade'],
    conversation: ['talk', 'give_item', 'end_conversation'],
    combat: ['attack', 'defend', 'cast_spell', 'use_item', 'flee', 'wait'],
    rest: ['rest', 'wake_up'],
    shopping: ['buy', 'sell', 'browse', 'leave_shop'],
    quest_completion: ['complete_quest', 'accept_reward'],
  };

  return phaseActions[phase]?.includes(actionType) || false;
}

function isActionError(error: any): error is {
  code: ErrorCode;
  message: string;
  details?: any;
  timestamp: Date;
  playerId?: UUID;
} {
  return (
    error && typeof error === 'object' && 'code' in error && 'message' in error
  );
}

// ============================================================================
// TECHNICAL DEBT MARKERS
// ============================================================================

//TODO: Implement comprehensive RPG action validation system
//TODO: Add action queuing and batch processing for performance
//TODO: Implement action undo/redo functionality
//TODO: Add action result caching for repeated actions
//TODO: Implement action hooks and plugins system
//TODO: Add action success/failure probability calculations
//TODO: Implement action cost and resource management
//TODO: Add action animation and effect triggers for frontend
//TODO: Implement action templates for common action patterns
//TODO: Add action performance monitoring and optimization
