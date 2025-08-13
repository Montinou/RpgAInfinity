import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

/**
 * Health Check Endpoint
 * Provides comprehensive application health status for monitoring
 */
export async function GET(request: NextRequest) {
  try {
    const timestamp = new Date().toISOString();
    const status = {
      status: 'healthy',
      timestamp,
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      environment: process.env.VERCEL_ENV || 'development',
      checks: {
        database: { status: 'unknown', latency: 0 },
        ai_service: { status: 'unknown', configured: false },
        memory: { status: 'healthy', usage: 0 },
      },
    };

    // Database connectivity check
    const dbStart = performance.now();
    try {
      await kv.ping();
      const dbLatency = performance.now() - dbStart;
      status.checks.database = {
        status: dbLatency < 100 ? 'healthy' : 'degraded',
        latency: Math.round(dbLatency),
      };
    } catch (error) {
      status.checks.database = {
        status: 'unhealthy',
        latency: -1,
        error: 'Connection failed',
      };
    }

    // AI Service check
    status.checks.ai_service = {
      status: process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing',
      configured: Boolean(process.env.ANTHROPIC_API_KEY),
    };

    // Memory usage check
    if (process.memoryUsage) {
      const memory = process.memoryUsage();
      const memoryUsageMB = Math.round(memory.heapUsed / 1024 / 1024);
      status.checks.memory = {
        status: memoryUsageMB < 512 ? 'healthy' : 'high',
        usage: memoryUsageMB,
        unit: 'MB',
      };
    }

    // Overall health determination
    const unhealthyChecks = Object.values(status.checks).filter(
      check => check.status === 'unhealthy'
    );

    if (unhealthyChecks.length > 0) {
      status.status = 'unhealthy';
      return NextResponse.json(status, { status: 503 });
    }

    const degradedChecks = Object.values(status.checks).filter(
      check => check.status === 'degraded' || check.status === 'high'
    );

    if (degradedChecks.length > 0) {
      status.status = 'degraded';
    }

    return NextResponse.json(status, {
      status: status.status === 'healthy' ? 200 : 206,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Health check failed:', error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

/**
 * Readiness Check - Returns 200 when app is ready to serve traffic
 */
export async function HEAD(request: NextRequest) {
  try {
    // Quick readiness check - just verify basic services
    await kv.ping();

    if (!process.env.ANTHROPIC_API_KEY) {
      return new NextResponse(null, { status: 503 });
    }

    return new NextResponse(null, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}
