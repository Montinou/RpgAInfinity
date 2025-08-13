import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

/**
 * Application Metrics Endpoint
 * Provides performance and usage metrics for monitoring dashboards
 */
export async function GET(request: NextRequest) {
  try {
    const timestamp = new Date().toISOString();

    // Get authentication (in production, this should be protected)
    const authHeader = request.headers.get('authorization');
    if (
      process.env.VERCEL_ENV === 'production' &&
      authHeader !== `Bearer ${process.env.METRICS_API_KEY}`
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const metrics = {
      timestamp,
      application: {
        version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
        environment: process.env.VERCEL_ENV || 'development',
        uptime: process.uptime ? Math.floor(process.uptime()) : 0,
      },
      performance: {
        memory: getMemoryMetrics(),
        database: await getDatabaseMetrics(),
        ai_service: await getAIServiceMetrics(),
      },
      business: {
        active_games: await getActiveGamesCount(),
        total_users: await getTotalUsersCount(),
        requests_per_minute: await getRequestsPerMinute(),
      },
    };

    return NextResponse.json(metrics, {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Metrics collection failed:', error);

    return NextResponse.json(
      {
        error: 'Metrics collection failed',
        timestamp: new Date().toISOString(),
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

function getMemoryMetrics() {
  if (!process.memoryUsage) {
    return { status: 'unavailable' };
  }

  const memory = process.memoryUsage();
  return {
    heap_used_mb: Math.round(memory.heapUsed / 1024 / 1024),
    heap_total_mb: Math.round(memory.heapTotal / 1024 / 1024),
    external_mb: Math.round(memory.external / 1024 / 1024),
    rss_mb: Math.round(memory.rss / 1024 / 1024),
  };
}

async function getDatabaseMetrics() {
  try {
    const start = performance.now();
    await kv.ping();
    const latency = Math.round(performance.now() - start);

    // Get some basic KV stats
    const dbInfo = await kv.dbsize();

    return {
      status: 'healthy',
      latency_ms: latency,
      keys_count: dbInfo,
      connection_pool: 'shared', // Vercel KV uses shared connections
    };
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function getAIServiceMetrics() {
  try {
    // Get AI service usage metrics from cache
    const aiMetrics = await kv.hgetall('ai:metrics:daily');
    const currentHour = new Date().getHours();

    return {
      status: process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing',
      requests_today: aiMetrics?.requests_today || 0,
      tokens_used_today: aiMetrics?.tokens_today || 0,
      average_latency_ms: aiMetrics?.avg_latency || 0,
      error_rate_percent: aiMetrics?.error_rate || 0,
      last_request: aiMetrics?.last_request || null,
    };
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function getActiveGamesCount() {
  try {
    // Count active games from different game types
    const rpgGames = await kv.scan(0, { match: 'game:rpg:*', count: 1000 });
    const deductionGames = await kv.scan(0, {
      match: 'game:deduction:*',
      count: 1000,
    });
    const villageGames = await kv.scan(0, {
      match: 'game:village:*',
      count: 1000,
    });

    return {
      total:
        rpgGames[1].length + deductionGames[1].length + villageGames[1].length,
      rpg: rpgGames[1].length,
      deduction: deductionGames[1].length,
      village: villageGames[1].length,
    };
  } catch (error) {
    return {
      total: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function getTotalUsersCount() {
  try {
    // For now, return placeholder since we don't have user auth yet
    return {
      total: 0,
      active_today: 0,
      note: 'User authentication not yet implemented',
    };
  } catch (error) {
    return {
      total: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function getRequestsPerMinute() {
  try {
    // Get request metrics from cache (would be populated by middleware)
    const currentMinute = Math.floor(Date.now() / 60000);
    const requests = (await kv.get(`requests:${currentMinute}`)) || 0;
    const prevRequests = (await kv.get(`requests:${currentMinute - 1}`)) || 0;

    return {
      current_minute: requests,
      previous_minute: prevRequests,
      trend:
        requests > prevRequests
          ? 'increasing'
          : requests < prevRequests
            ? 'decreasing'
            : 'stable',
    };
  } catch (error) {
    return {
      current_minute: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Reset daily metrics (called by cron job)
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Reset daily AI metrics
    await kv.hdel(
      'ai:metrics:daily',
      'requests_today',
      'tokens_today',
      'avg_latency',
      'error_rate'
    );

    // Clean up old request counts
    const currentMinute = Math.floor(Date.now() / 60000);
    const oldKeys = [];
    for (let i = 2; i <= 1440; i++) {
      // Clean up requests older than 24 hours
      oldKeys.push(`requests:${currentMinute - i}`);
    }

    if (oldKeys.length > 0) {
      await kv.del(...oldKeys);
    }

    return NextResponse.json({
      message: 'Metrics reset successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Metrics reset failed:', error);
    return NextResponse.json(
      {
        error: 'Metrics reset failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
