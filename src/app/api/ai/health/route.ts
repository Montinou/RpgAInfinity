/**
 * AI Service Health Check API Endpoint
 *
 * Provides comprehensive health monitoring for the Claude AI service
 * Used by monitoring systems, load balancers, and operational dashboards
 */

import { NextRequest, NextResponse } from 'next/server';
import { claudeService } from '@/lib/ai/claude';
import { kvService } from '@/lib/database/kv-service';

// ============================================================================
// HEALTH CHECK TYPES
// ============================================================================

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    claude_api: HealthCheck;
    kv_service: HealthCheck;
    cache_system: HealthCheck;
    rate_limiter: HealthCheck;
    analytics: HealthCheck;
  };
  metrics: {
    response_time_ms: number;
    memory_usage?: string;
    request_count: number;
    error_rate: number;
    cache_hit_rate: number;
  };
  dependencies: {
    anthropic_api: 'available' | 'unavailable' | 'degraded';
    vercel_kv: 'available' | 'unavailable' | 'degraded';
  };
}

interface HealthCheck {
  status: 'pass' | 'fail' | 'warn';
  time: string;
  message?: string;
  details?: any;
}

// ============================================================================
// HEALTH CHECK FUNCTIONS
// ============================================================================

async function checkClaudeAPI(): Promise<HealthCheck> {
  try {
    // Test with a minimal request
    const testContext = {
      gameType: 'rpg' as const,
      gameState: {},
      playerHistory: [],
      recentEvents: [],
      systemFlags: {},
    };

    const startTime = Date.now();
    await claudeService.generateContent('Hello', testContext, {
      maxTokens: 10,
      temperature: 0.1,
    });
    const responseTime = Date.now() - startTime;

    return {
      status: responseTime < 5000 ? 'pass' : 'warn',
      time: new Date().toISOString(),
      message:
        responseTime < 5000
          ? 'API responding normally'
          : 'API response time elevated',
      details: { response_time_ms: responseTime },
    };
  } catch (error) {
    return {
      status: 'fail',
      time: new Date().toISOString(),
      message: `Claude API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

async function checkKVService(): Promise<HealthCheck> {
  try {
    const testKey = `health_check_${Date.now()}`;
    const testValue = { test: true, timestamp: new Date() };

    // Test write
    const writeResult = await kvService.set(testKey, testValue, 60);
    if (!writeResult.success) {
      throw new Error('KV write failed');
    }

    // Test read
    const readResult = await kvService.get(testKey);
    if (!readResult.success) {
      throw new Error('KV read failed');
    }

    // Test delete
    await kvService.delete(testKey);

    return {
      status: 'pass',
      time: new Date().toISOString(),
      message: 'KV service operational',
    };
  } catch (error) {
    return {
      status: 'fail',
      time: new Date().toISOString(),
      message: `KV service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function checkCacheSystem(): Promise<HealthCheck> {
  try {
    const analytics = claudeService.getAnalytics();
    const cacheStats = analytics.cache;

    if (!cacheStats) {
      throw new Error('Cache statistics not available');
    }

    const isHealthy = cacheStats.memoryEntries >= 0 && cacheStats.hitRate >= 0;

    return {
      status: isHealthy ? 'pass' : 'warn',
      time: new Date().toISOString(),
      message: isHealthy
        ? 'Cache system operational'
        : 'Cache system may have issues',
      details: {
        memory_entries: cacheStats.memoryEntries,
        hit_rate: cacheStats.hitRate,
        total_hits: cacheStats.totalHits,
      },
    };
  } catch (error) {
    return {
      status: 'fail',
      time: new Date().toISOString(),
      message: `Cache system error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function checkRateLimiter(): Promise<HealthCheck> {
  try {
    // Test rate limiter functionality
    const rateLimiter = (claudeService as any).rateLimiter;
    const testSessionId = 'health_check_session';

    const result = await rateLimiter.checkSessionLimit(testSessionId);

    return {
      status: typeof result === 'boolean' ? 'pass' : 'warn',
      time: new Date().toISOString(),
      message: 'Rate limiter operational',
      details: { test_result: result },
    };
  } catch (error) {
    return {
      status: 'fail',
      time: new Date().toISOString(),
      message: `Rate limiter error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

async function checkAnalytics(): Promise<HealthCheck> {
  try {
    const analytics = claudeService.getAnalytics();

    const hasBasicMetrics =
      typeof analytics.totalRequests === 'number' &&
      typeof analytics.successfulRequests === 'number' &&
      typeof analytics.failedRequests === 'number';

    return {
      status: hasBasicMetrics ? 'pass' : 'warn',
      time: new Date().toISOString(),
      message: hasBasicMetrics
        ? 'Analytics system operational'
        : 'Analytics may have issues',
      details: {
        total_requests: analytics.totalRequests,
        success_rate: analytics.successRate,
      },
    };
  } catch (error) {
    return {
      status: 'fail',
      time: new Date().toISOString(),
      message: `Analytics error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

function getMemoryUsage(): string {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const usage = process.memoryUsage();
    return `${Math.round(usage.heapUsed / 1024 / 1024)}MB`;
  }
  return 'Unknown';
}

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

/**
 * GET /api/ai/health - Comprehensive health check
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Get service uptime (approximate)
    const uptime = Date.now() - (Date.now() % (24 * 60 * 60 * 1000)); // Reset daily

    // Run all health checks in parallel for faster response
    const [
      claudeApiCheck,
      kvServiceCheck,
      cacheCheck,
      rateLimiterCheck,
      analyticsCheck,
    ] = await Promise.allSettled([
      checkClaudeAPI(),
      checkKVService(),
      checkCacheSystem(),
      checkRateLimiter(),
      checkAnalytics(),
    ]);

    // Extract results, handling any failed promises
    const checks = {
      claude_api:
        claudeApiCheck.status === 'fulfilled'
          ? claudeApiCheck.value
          : {
              status: 'fail' as const,
              time: new Date().toISOString(),
              message: 'Health check failed to complete',
            },
      kv_service:
        kvServiceCheck.status === 'fulfilled'
          ? kvServiceCheck.value
          : {
              status: 'fail' as const,
              time: new Date().toISOString(),
              message: 'Health check failed to complete',
            },
      cache_system:
        cacheCheck.status === 'fulfilled'
          ? cacheCheck.value
          : {
              status: 'fail' as const,
              time: new Date().toISOString(),
              message: 'Health check failed to complete',
            },
      rate_limiter:
        rateLimiterCheck.status === 'fulfilled'
          ? rateLimiterCheck.value
          : {
              status: 'fail' as const,
              time: new Date().toISOString(),
              message: 'Health check failed to complete',
            },
      analytics:
        analyticsCheck.status === 'fulfilled'
          ? analyticsCheck.value
          : {
              status: 'fail' as const,
              time: new Date().toISOString(),
              message: 'Health check failed to complete',
            },
    };

    // Get analytics for metrics
    const analytics = claudeService.getAnalytics();

    // Determine overall status
    const failedChecks = Object.values(checks).filter(
      check => check.status === 'fail'
    ).length;
    const warnChecks = Object.values(checks).filter(
      check => check.status === 'warn'
    ).length;

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (failedChecks === 0 && warnChecks === 0) {
      overallStatus = 'healthy';
    } else if (failedChecks <= 1 && warnChecks <= 2) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'unhealthy';
    }

    // Determine dependency status
    const dependencies = {
      anthropic_api:
        checks.claude_api.status === 'pass'
          ? ('available' as const)
          : checks.claude_api.status === 'warn'
            ? ('degraded' as const)
            : ('unavailable' as const),
      vercel_kv:
        checks.kv_service.status === 'pass'
          ? ('available' as const)
          : checks.kv_service.status === 'warn'
            ? ('degraded' as const)
            : ('unavailable' as const),
    };

    const healthResult: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime,
      version: '1.0.0', // TODO: Get from package.json
      checks,
      metrics: {
        response_time_ms: Date.now() - startTime,
        memory_usage: getMemoryUsage(),
        request_count: analytics.totalRequests,
        error_rate: Math.round((1 - analytics.successRate) * 100 * 100) / 100,
        cache_hit_rate: Math.round(analytics.cache.hitRate * 100 * 100) / 100,
      },
      dependencies,
    };

    // Set appropriate HTTP status based on health
    const httpStatus =
      overallStatus === 'healthy'
        ? 200
        : overallStatus === 'degraded'
          ? 200 // Still return 200 but with degraded status
          : 503; // Service unavailable for unhealthy

    return NextResponse.json(healthResult, { status: httpStatus });
  } catch (error) {
    console.error('Health check error:', error);

    // Return minimal error response
    const errorResult: HealthCheckResult = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: 0,
      version: '1.0.0',
      checks: {
        claude_api: {
          status: 'fail',
          time: new Date().toISOString(),
          message: 'Health check failed',
        },
        kv_service: {
          status: 'fail',
          time: new Date().toISOString(),
          message: 'Health check failed',
        },
        cache_system: {
          status: 'fail',
          time: new Date().toISOString(),
          message: 'Health check failed',
        },
        rate_limiter: {
          status: 'fail',
          time: new Date().toISOString(),
          message: 'Health check failed',
        },
        analytics: {
          status: 'fail',
          time: new Date().toISOString(),
          message: 'Health check failed',
        },
      },
      metrics: {
        response_time_ms: Date.now() - startTime,
        request_count: 0,
        error_rate: 100,
        cache_hit_rate: 0,
      },
      dependencies: {
        anthropic_api: 'unavailable',
        vercel_kv: 'unavailable',
      },
    };

    return NextResponse.json(errorResult, { status: 503 });
  }
}

/**
 * GET /api/ai/health?check=quick - Quick health check (lighter)
 */
export async function HEAD(request: NextRequest) {
  try {
    // Quick check - just verify service is responding
    const analytics = claudeService.getAnalytics();
    const isHealthy = analytics && typeof analytics.totalRequests === 'number';

    return new NextResponse(null, {
      status: isHealthy ? 200 : 503,
      headers: {
        'X-Health-Status': isHealthy ? 'healthy' : 'unhealthy',
        'X-Health-Timestamp': new Date().toISOString(),
      },
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}

/**
 * OPTIONS - CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
