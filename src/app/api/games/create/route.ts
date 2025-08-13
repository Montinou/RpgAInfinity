/**
 * Unified Game Creation API Endpoint
 * POST /api/games/create
 *
 * Creates games of any type (RPG, Deduction, Village) through a single endpoint
 * Routes to specific game engines based on game type
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CoreGameEngine } from '@/lib/game-engine/core';
import { GameTypeSchema, CreateGameConfigSchema } from '../types';

// ============================================================================
// REQUEST VALIDATION
// ============================================================================

const CreateGameRequestSchema = CreateGameConfigSchema;

type CreateGameRequest = z.infer<typeof CreateGameRequestSchema>;

// ============================================================================
// GAME TYPE SPECIFIC CONFIGURATIONS
// ============================================================================

const getDefaultGameConfig = (
  type: 'rpg' | 'deduction' | 'village',
  baseConfig: CreateGameRequest
) => {
  const base = {
    type,
    name: baseConfig.name,
    description: baseConfig.description,
    maxPlayers: baseConfig.maxPlayers,
    minPlayers: baseConfig.minPlayers,
    isPrivate: baseConfig.isPrivate,
    estimatedDurationMinutes: 60, // Default duration
    settings: baseConfig.settings,
  };

  switch (type) {
    case 'rpg':
      return {
        ...base,
        estimatedDurationMinutes: 120,
        settings: {
          ...baseConfig.settings,
          difficulty: 'medium',
          allowPvP: false,
          // TODO: Add RPG-specific settings (world size, starting level, etc.)
        },
      };

    case 'deduction':
      return {
        ...base,
        estimatedDurationMinutes: 30,
        settings: {
          ...baseConfig.settings,
          theme: 'classic',
          allowDiscussion: true,
          // TODO: Add deduction-specific settings (roles, phases, etc.)
        },
      };

    case 'village':
      return {
        ...base,
        estimatedDurationMinutes: 90,
        settings: {
          ...baseConfig.settings,
          seasonLength: 'medium',
          difficulty: 'normal',
          // TODO: Add village-specific settings (resources, events, etc.)
        },
      };

    default:
      return base;
  }
};

// ============================================================================
// API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validatedRequest = CreateGameRequestSchema.parse(body);

    // Initialize game engine
    const gameEngine = new CoreGameEngine();

    // Get game-specific configuration
    const gameConfig = getDefaultGameConfig(
      validatedRequest.type,
      validatedRequest
    );

    // Create game through unified engine
    const game = await gameEngine.createGame(gameConfig);

    // Return success response
    return NextResponse.json({
      success: true,
      data: {
        gameId: game.id,
        type: game.config.type,
        name: game.config.name,
        status: game.state.status,
        maxPlayers: game.config.maxPlayers,
        currentPlayers: game.state.players.length,
        isPrivate: game.config.isPrivate,
        createdAt: game.createdAt,
        // TODO: Add game-specific metadata for UI
      },
      message: `${game.config.type.toUpperCase()} game created successfully`,
    });
  } catch (error) {
    console.error('Game creation error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
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
          error: 'Game creation failed',
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
        message: 'An unexpected error occurred while creating the game',
      },
      { status: 500 }
    );
  }
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
