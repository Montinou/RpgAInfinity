/**
 * Start Deduction Game API Endpoint
 * POST /api/game/deduction/[id]/start
 *
 * Starts a deduction game by assigning roles and transitioning to active phase
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  DeductionGameState,
  RoleDefinition,
  AssignedRole,
} from '../../../../../../types/deduction';
import { GameError } from '../../../../../../types/core';
import { kvService } from '../../../../../../lib/database';
import { generateDeductionContent } from '../../../../../../lib/ai';
import {
  deductionClueSystem,
  createStandardClueConfig,
} from '../../../../../../lib/games/deduction';

// Request validation schema
const StartGameRequestSchema = z.object({
  requesterId: z.string().uuid(),
  forceStart: z.boolean().optional().default(false),
  customRoleDistribution: z.record(z.number()).optional(),
});

type StartGameRequest = z.infer<typeof StartGameRequestSchema>;

interface StartGameResponse {
  success: boolean;
  gameState?: DeductionGameState;
  assignedRoles?: Record<string, { role: string; alignment: string }>;
  error?: string;
  code?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<StartGameResponse>> {
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
    const validatedRequest = StartGameRequestSchema.parse(body);

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

    // Verify requester is the game creator
    if (gameState.players[0] !== validatedRequest.requesterId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Only the game creator can start the game',
          code: 'INSUFFICIENT_PERMISSIONS',
        },
        { status: 403 }
      );
    }

    // Check if game can be started
    if (gameState.status === 'active') {
      return NextResponse.json(
        {
          success: false,
          error: 'Game is already active',
          code: 'GAME_ALREADY_ACTIVE',
        },
        { status: 400 }
      );
    }

    if (gameState.status === 'completed') {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot start completed game',
          code: 'GAME_COMPLETED',
        },
        { status: 400 }
      );
    }

    // Check minimum player requirement
    if (
      gameState.currentPlayerCount < gameState.config.minPlayers &&
      !validatedRequest.forceStart
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Need at least ${gameState.config.minPlayers} players to start`,
          code: 'INSUFFICIENT_PLAYERS',
        },
        { status: 400 }
      );
    }

    // Generate roles for the scenario
    let roleDefinitions: RoleDefinition[];
    try {
      const roleGenerationResult = await generateDeductionContent(
        'role_generation',
        {
          scenario: gameState.data.scenario,
          playerCount: gameState.currentPlayerCount,
          theme: gameState.config.settings.theme,
          customDistribution: validatedRequest.customRoleDistribution,
        }
      );

      roleDefinitions = roleGenerationResult.roles || [];
    } catch (aiError) {
      console.error('AI role generation failed:', aiError);
      // Fallback to default role distribution
      roleDefinitions = generateDefaultRoles(
        gameState.data.scenario.theme,
        gameState.currentPlayerCount
      );
    }

    // Assign roles to players randomly
    const roleAssignments = await assignRolesToPlayers(
      gameState.players,
      roleDefinitions
    );

    // Store role assignments securely
    await storeRoleAssignments(gameId, roleAssignments);

    // Generate initial clues if enabled
    let initialClues: any[] = [];
    if (gameState.config.settings.enableClues) {
      try {
        const clueConfig = createStandardClueConfig(
          gameState.data.scenario,
          roleDefinitions,
          gameState.players.map(id => ({ id })), // Simplified player objects
          gameState,
          {
            difficulty: getDifficultyFromConfig(gameState.config),
            narrativeFocus: true,
          }
        );

        const clueSet = await deductionClueSystem.generateGameClues(clueConfig);
        initialClues = clueSet.clues;
      } catch (clueError) {
        console.error('Initial clue generation failed:', clueError);
        //TODO: Generate fallback clues or continue without clues
      }
    }

    // Update game state to active
    const updatedGameState: DeductionGameState = {
      ...gameState,
      status: 'active',
      phase: 'day_discussion',
      updatedAt: Date.now(),
      data: {
        ...gameState.data,
        scenario: {
          ...gameState.data.scenario,
          availableRoles: roleDefinitions,
        },
        round: 1,
        timeRemaining: gameState.config.settings.discussionTimePerRound * 60, // Convert to seconds
        cluesAvailable: initialClues,
        events: [
          ...gameState.data.events,
          {
            id: crypto.randomUUID(),
            type: 'phase_change',
            description: 'Game has started! Roles have been assigned.',
            timestamp: Date.now(),
            affectedPlayers: gameState.players,
            isPublic: true,
            flavorText:
              gameState.data.scenario.flavorText?.dayPhaseStart ||
              'The game begins!',
          },
        ],
      },
    };

    // Save updated game state
    await kvService.set(
      `game:${gameId}`,
      updatedGameState,
      7 * 24 * 60 * 60 // 7 day TTL
    );

    // Store initial clues in game storage
    if (initialClues.length > 0) {
      await kvService.set(
        `game_clues:${gameId}`,
        initialClues,
        7 * 24 * 60 * 60
      );
    }

    //TODO: Implement WebSocket notifications to all players about game start
    //TODO: Set up automated phase timers

    // Prepare public role information (without secrets)
    const publicRoleAssignments: Record<
      string,
      { role: string; alignment: string }
    > = {};
    for (const [playerId, assignment] of Object.entries(roleAssignments)) {
      publicRoleAssignments[playerId] = {
        role: assignment.definition.name,
        alignment: assignment.definition.alignment,
      };
    }

    return NextResponse.json(
      {
        success: true,
        gameState: updatedGameState,
        assignedRoles: publicRoleAssignments,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Failed to start deduction game:', error);

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

function generateDefaultRoles(
  theme: string,
  playerCount: number
): RoleDefinition[] {
  // Fallback role generation when AI fails
  const roles: RoleDefinition[] = [];

  // Calculate role distribution (roughly 1/3 mafia, 2/3 town)
  const mafiaCount = Math.max(1, Math.floor(playerCount / 3));
  const townCount = playerCount - mafiaCount;

  // Add mafia roles
  for (let i = 0; i < mafiaCount; i++) {
    roles.push({
      id: `mafia_${i}`,
      name: i === 0 ? 'Mafia Boss' : `Mafia Member ${i}`,
      alignment: 'mafia',
      type: i === 0 ? 'power' : 'vanilla',
      description: 'Eliminate all town members to win',
      abilities: [],
      restrictions: [],
      winCondition: 'Eliminate all town members',
      flavorText: `A member of the criminal organization`,
      rarity: 'common',
      requiresMinPlayers: 4,
    });
  }

  // Add town roles
  for (let i = 0; i < townCount; i++) {
    roles.push({
      id: `town_${i}`,
      name: i === 0 ? 'Detective' : `Townsperson ${i}`,
      alignment: 'town',
      type: i === 0 ? 'investigative' : 'vanilla',
      description: 'Find and eliminate all mafia members',
      abilities: [],
      restrictions: [],
      winCondition: 'Eliminate all mafia members',
      flavorText: `A concerned citizen fighting for justice`,
      rarity: 'common',
      requiresMinPlayers: 4,
    });
  }

  return roles;
}

async function assignRolesToPlayers(
  playerIds: string[],
  roleDefinitions: RoleDefinition[]
): Promise<Record<string, AssignedRole>> {
  // Shuffle players randomly
  const shuffledPlayers = [...playerIds].sort(() => Math.random() - 0.5);

  // Ensure we have enough roles
  if (roleDefinitions.length < shuffledPlayers.length) {
    throw new GameError(
      'INSUFFICIENT_ROLES',
      'Not enough roles defined for all players',
      { players: shuffledPlayers.length, roles: roleDefinitions.length }
    );
  }

  const assignments: Record<string, AssignedRole> = {};

  for (let i = 0; i < shuffledPlayers.length; i++) {
    const playerId = shuffledPlayers[i];
    const role = roleDefinitions[i];

    // Find teammates for mafia-type roles
    const teammates = assignments[playerId]?.teammates || [];
    if (role.alignment === 'mafia') {
      // Add other mafia members as teammates
      for (const [otherPlayerId, otherAssignment] of Object.entries(
        assignments
      )) {
        if (otherAssignment.definition.alignment === 'mafia') {
          teammates.push(otherPlayerId);
          // Add this player to other mafia members' teams
          otherAssignment.teammates?.push(playerId);
        }
      }
    }

    assignments[playerId] = {
      definition: role,
      secretInfo: generateSecretInfo(role),
      teammates: teammates.length > 0 ? teammates : undefined,
      abilities: role.abilities.map(ability => ({
        ability,
        remainingUses: getAbilityUses(ability),
        isBlocked: false,
      })),
      objectives: generateRoleObjectives(role),
    };
  }

  return assignments;
}

async function storeRoleAssignments(
  gameId: string,
  assignments: Record<string, AssignedRole>
): Promise<void> {
  // Store each player's role assignment separately for security
  const storePromises = Object.entries(assignments).map(
    ([playerId, assignment]) =>
      kvService.set(
        `game_role:${gameId}:${playerId}`,
        assignment,
        7 * 24 * 60 * 60 // 7 day TTL
      )
  );

  await Promise.all(storePromises);
}

function getDifficultyFromConfig(config: any): 'easy' | 'medium' | 'hard' {
  // Analyze config to determine difficulty
  if (config.settings.duration === 'short') return 'easy';
  if (config.settings.duration === 'long') return 'hard';
  return 'medium';
}

function generateSecretInfo(role: RoleDefinition): string[] {
  const secrets: string[] = [];

  if (role.alignment === 'mafia') {
    secrets.push('You know who the other mafia members are');
    secrets.push('You can communicate privately with your team');
  }

  if (role.type === 'investigative') {
    secrets.push(
      'You have the ability to learn information about other players'
    );
  }

  return secrets;
}

function getAbilityUses(ability: any): number {
  // Default ability usage limits
  if (ability.usageLimit?.type === 'per_night') return 1;
  if (ability.usageLimit?.type === 'per_game')
    return ability.usageLimit.count || 1;
  if (ability.usageLimit?.type === 'one_time') return 1;
  return -1; // Unlimited
}

function generateRoleObjectives(role: RoleDefinition): any[] {
  const objectives: any[] = [];

  if (role.alignment === 'town') {
    objectives.push({
      id: 'eliminate_mafia',
      description: 'Eliminate all mafia members',
      type: 'eliminate',
      target: 'mafia',
      isCompleted: false,
      points: 100,
    });
  } else if (role.alignment === 'mafia') {
    objectives.push({
      id: 'eliminate_town',
      description: 'Eliminate all town members',
      type: 'eliminate',
      target: 'town',
      isCompleted: false,
      points: 100,
    });
  }

  return objectives;
}
