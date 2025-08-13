/**
 * Create Deduction Game API Endpoint
 * POST /api/game/deduction/create
 *
 * Creates a new social deduction game with specified theme and settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  DeductionConfig,
  DeductionConfigSchema,
  DeductionGameState,
  DeductionScenario,
  DeductionPhase,
} from '../../../../../types/deduction';
import { GameError, UUID } from '../../../../../types/core';
import { kvService } from '../../../../../lib/database';
import { generateDeductionContent } from '../../../../../lib/ai';
import { deductionClueSystem } from '../../../../../lib/games/deduction';

// Request validation schema
const CreateGameRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  maxPlayers: z.number().int().min(4).max(20),
  minPlayers: z.number().int().min(4).max(20),
  isPrivate: z.boolean(),
  settings: z.object({
    theme: z.string().min(1).max(100),
    scenario: z.enum([
      'mafia',
      'werewolf',
      'space_station',
      'medieval_court',
      'custom',
    ]),
    duration: z.enum(['short', 'medium', 'long']),
    discussionTimePerRound: z.number().int().min(3).max(30),
    votingTimeLimit: z.number().int().min(1).max(10),
    allowsWhispering: z.boolean(),
    revealRolesOnDeath: z.boolean(),
    allowsLastWords: z.boolean(),
    enableClues: z.boolean(),
    difficultyModifiers: z.array(z.any()).optional().default([]),
  }),
  creatorId: z.string().uuid(),
});

type CreateGameRequest = z.infer<typeof CreateGameRequestSchema>;

interface CreateGameResponse {
  success: boolean;
  gameId?: string;
  gameState?: DeductionGameState;
  error?: string;
  code?: string;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<CreateGameResponse>> {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validatedRequest = CreateGameRequestSchema.parse(body);

    // Validate player count constraints
    if (validatedRequest.minPlayers > validatedRequest.maxPlayers) {
      return NextResponse.json(
        {
          success: false,
          error: 'Minimum players cannot exceed maximum players',
          code: 'INVALID_PLAYER_RANGE',
        },
        { status: 400 }
      );
    }

    // Generate unique game ID
    const gameId = crypto.randomUUID();

    // Create initial game configuration
    const gameConfig: DeductionConfig = {
      type: 'deduction',
      name: validatedRequest.name,
      description: validatedRequest.description,
      maxPlayers: validatedRequest.maxPlayers,
      minPlayers: validatedRequest.minPlayers,
      estimatedDurationMinutes: getDurationMinutes(
        validatedRequest.settings.duration
      ),
      isPrivate: validatedRequest.isPrivate,
      settings: {
        theme: validatedRequest.settings.theme,
        scenario: validatedRequest.settings.scenario,
        duration: validatedRequest.settings.duration,
        discussionTimePerRound:
          validatedRequest.settings.discussionTimePerRound,
        votingTimeLimit: validatedRequest.settings.votingTimeLimit,
        allowsWhispering: validatedRequest.settings.allowsWhispering,
        revealRolesOnDeath: validatedRequest.settings.revealRolesOnDeath,
        allowsLastWords: validatedRequest.settings.allowsLastWords,
        enableClues: validatedRequest.settings.enableClues,
        difficultyModifiers:
          validatedRequest.settings.difficultyModifiers || [],
      },
    };

    // Generate scenario data using AI
    let scenarioData;
    try {
      scenarioData = await generateDeductionContent('scenario_generation', {
        theme: validatedRequest.settings.theme,
        scenario: validatedRequest.settings.scenario,
        maxPlayers: validatedRequest.maxPlayers,
        duration: validatedRequest.settings.duration,
      });
    } catch (aiError) {
      // TODO: Fallback to predefined scenario templates if AI fails
      console.error('AI scenario generation failed:', aiError);
      scenarioData = getDefaultScenarioData(validatedRequest.settings.scenario);
    }

    // Create initial game state
    const initialGameState: DeductionGameState = {
      id: gameId,
      type: 'deduction',
      status: 'waiting_for_players',
      phase: 'role_assignment',
      players: [validatedRequest.creatorId], // Creator automatically joins
      currentPlayerCount: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      config: gameConfig,
      data: {
        scenario: scenarioData,
        round: 0,
        timeRemaining: 0,
        alivePlayers: [validatedRequest.creatorId],
        eliminatedPlayers: [],
        nightActions: [],
        cluesAvailable: [],
        events: [
          {
            id: crypto.randomUUID(),
            type: 'phase_change',
            description: 'Game created and waiting for players',
            timestamp: Date.now(),
            affectedPlayers: [validatedRequest.creatorId],
            isPublic: true,
            flavorText: scenarioData?.introduction || 'Welcome to the game!',
          },
        ],
      },
    };

    // Store game state with 7-day TTL
    await kvService.set(
      `game:${gameId}`,
      initialGameState,
      7 * 24 * 60 * 60 // 7 days in seconds
    );

    // Store creator-to-game mapping for easy lookup
    await kvService.set(
      `creator_games:${validatedRequest.creatorId}`,
      gameId,
      7 * 24 * 60 * 60
    );

    //TODO: Implement game analytics tracking for creation metrics

    return NextResponse.json(
      {
        success: true,
        gameId,
        gameState: initialGameState,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create deduction game:', error);

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
function getDurationMinutes(duration: 'short' | 'medium' | 'long'): number {
  switch (duration) {
    case 'short':
      return 15;
    case 'medium':
      return 30;
    case 'long':
      return 60;
    default:
      return 30;
  }
}

function getDefaultScenarioData(scenario: DeductionScenario): any {
  // Fallback scenario data when AI generation fails
  const baseScenario = {
    id: crypto.randomUUID(),
    name: `${scenario.charAt(0).toUpperCase() + scenario.slice(1)} Game`,
    theme: scenario,
    description: `A classic ${scenario} social deduction game`,
    setting: getScenarioSetting(scenario),
    lore: getScenarioLore(scenario),
    availableRoles: [], // Will be populated during role assignment
    winConditions: [], // Will be populated during role assignment
    customRules: [],
    flavorText: {
      introduction: `Welcome to ${scenario}! Work together to find the truth.`,
      dayPhaseStart: 'The day begins. Discuss and decide who to eliminate.',
      nightPhaseStart: 'Night falls. Those with night abilities may act.',
      eliminationText: 'A player has been eliminated.',
      victoryTexts: {
        town: 'The town emerges victorious!',
        mafia: 'The mafia has taken control!',
        neutral: 'The neutral party achieves their goals!',
        survivor: 'The survivor lives to tell the tale!',
      },
      roleRevealTexts: {},
    },
  };

  return baseScenario;
}

function getScenarioSetting(scenario: DeductionScenario): string {
  const settings: Record<DeductionScenario, string> = {
    mafia: 'A modern city plagued by organized crime',
    werewolf: 'A medieval village under supernatural threat',
    space_station: 'A high-tech space station in crisis',
    medieval_court: 'A royal palace filled with political intrigue',
    custom: 'A unique setting crafted for this game',
  };

  return settings[scenario];
}

function getScenarioLore(scenario: DeductionScenario): string {
  const lore: Record<DeductionScenario, string> = {
    mafia:
      'Crime families operate in the shadows while law enforcement seeks justice.',
    werewolf:
      'Lycanthropes hunt under the full moon while villagers fight for survival.',
    space_station:
      'Saboteurs threaten the mission while crew members maintain order.',
    medieval_court: 'Nobles scheme for power while loyalists defend the crown.',
    custom: 'A tale waiting to be written by the players.',
  };

  return lore[scenario];
}
