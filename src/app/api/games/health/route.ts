/**
 * Game API Health Check Endpoint
 * GET /api/games/health
 *
 * Quick health check for the unified game API endpoints
 * Validates core game engine functionality without expensive operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { CoreGameEngine } from '@/lib/game-engine/core';

// ============================================================================
// HEALTH CHECK TYPES
// ============================================================================

interface GameAPIHealthResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  endpoints: {
    create: 'available' | 'unavailable';
    retrieve: 'available' | 'unavailable';
    action: 'available' | 'unavailable';
    join: 'available' | 'unavailable';
  };
  game_engines: {
    core: 'available' | 'unavailable';
    rpg: 'available' | 'unavailable';
    deduction: 'available' | 'unavailable';
    village: 'available' | 'unavailable';
  };
  dependencies: {
    kv_service: 'available' | 'unavailable';
    ai_service: 'available' | 'unavailable';
  };
  metrics: {
    response_time_ms: number;
  };
}

// ============================================================================
// HEALTH CHECK FUNCTIONS
// ============================================================================

async function checkGameEngine(): Promise<boolean> {
  try {
    const engine = new CoreGameEngine();
    // Simple validation - just check if the engine can be instantiated
    return engine !== null && typeof engine.createGame === 'function';
  } catch (error) {
    console.error('Game engine health check failed:', error);
    return false;
  }
}

async function checkGameModules(): Promise<Record<string, boolean>> {
  const modules = {
    rpg: false,
    deduction: false,
    village: false,
  };

  try {
    // Check if game modules can be imported
    // RPG Module
    try {
      const rpgModule = await import('@/lib/games/rpg');
      modules.rpg = rpgModule !== null;
    } catch {
      modules.rpg = false;
    }

    // Deduction Module
    try {
      const deductionModule = await import('@/lib/games/deduction');
      modules.deduction = deductionModule !== null;
    } catch {
      modules.deduction = false;
    }

    // Village Module
    try {
      const villageModule = await import('@/lib/games/village');
      modules.village = villageModule !== null;
    } catch {
      modules.village = false;
    }
  } catch (error) {
    console.error('Game modules health check failed:', error);
  }

  return modules;
}

async function checkDependencies(): Promise<Record<string, boolean>> {
  const dependencies = {
    kv_service: false,
    ai_service: false,
  };

  try {
    // Check KV Service
    try {
      const { kvService } = await import('@/lib/database/kv-service');
      dependencies.kv_service = kvService !== null;
    } catch {
      dependencies.kv_service = false;
    }

    // Check AI Service
    try {
      const { claudeService } = await import('@/lib/ai/claude');
      dependencies.ai_service = claudeService !== null;
    } catch {
      dependencies.ai_service = false;
    }
  } catch (error) {
    console.error('Dependencies health check failed:', error);
  }

  return dependencies;
}

// ============================================================================
// API HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Run all health checks in parallel
    const [coreEngineOk, gameModules, dependencies] = await Promise.all([
      checkGameEngine(),
      checkGameModules(),
      checkDependencies(),
    ]);

    // Determine endpoint availability
    const endpoints = {
      create: 'available' as const, // Always available if code is deployed
      retrieve: 'available' as const, // Always available if code is deployed
      action: 'available' as const, // Always available if code is deployed
      join: 'available' as const, // Always available if code is deployed
    };

    // Determine game engine availability
    const game_engines = {
      core: coreEngineOk ? ('available' as const) : ('unavailable' as const),
      rpg: gameModules.rpg ? ('available' as const) : ('unavailable' as const),
      deduction: gameModules.deduction
        ? ('available' as const)
        : ('unavailable' as const),
      village: gameModules.village
        ? ('available' as const)
        : ('unavailable' as const),
    };

    // Map dependencies
    const deps = {
      kv_service: dependencies.kv_service
        ? ('available' as const)
        : ('unavailable' as const),
      ai_service: dependencies.ai_service
        ? ('available' as const)
        : ('unavailable' as const),
    };

    // Determine overall health
    const criticalChecks = [
      coreEngineOk,
      dependencies.kv_service,
      gameModules.rpg || gameModules.deduction || gameModules.village, // At least one game type
    ];

    const failedCritical = criticalChecks.filter(check => !check).length;
    const totalGameEngines = Object.values(gameModules).filter(Boolean).length;

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (failedCritical === 0 && totalGameEngines >= 3) {
      overallStatus = 'healthy';
    } else if (failedCritical === 0 && totalGameEngines >= 1) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'unhealthy';
    }

    const healthResult: GameAPIHealthResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: '1.0.0-mvp',
      endpoints,
      game_engines,
      dependencies: deps,
      metrics: {
        response_time_ms: Date.now() - startTime,
      },
    };

    // Return appropriate HTTP status
    const httpStatus = overallStatus === 'unhealthy' ? 503 : 200;

    return NextResponse.json(healthResult, {
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error) {
    console.error('Game API health check error:', error);

    const errorResult: GameAPIHealthResult = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0-mvp',
      endpoints: {
        create: 'unavailable',
        retrieve: 'unavailable',
        action: 'unavailable',
        join: 'unavailable',
      },
      game_engines: {
        core: 'unavailable',
        rpg: 'unavailable',
        deduction: 'unavailable',
        village: 'unavailable',
      },
      dependencies: {
        kv_service: 'unavailable',
        ai_service: 'unavailable',
      },
      metrics: {
        response_time_ms: Date.now() - startTime,
      },
    };

    return NextResponse.json(errorResult, { status: 503 });
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
        Allow: 'GET, OPTIONS',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }
  );
}
