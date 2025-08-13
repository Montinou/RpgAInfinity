import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

/**
 * System Status Dashboard API
 * Provides comprehensive system status for monitoring dashboards
 */
export async function GET(request: NextRequest) {
  try {
    const timestamp = new Date().toISOString();

    const status = {
      timestamp,
      status: 'operational',
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      environment: process.env.VERCEL_ENV || 'development',
      region: process.env.VERCEL_REGION || 'iad1',

      // System Health
      system: {
        uptime: process.uptime ? Math.floor(process.uptime()) : 0,
        memory: getSystemMemory(),
        node_version: process.version,
        platform: process.platform,
      },

      // Service Status
      services: {
        database: await checkDatabaseStatus(),
        ai_service: await checkAIServiceStatus(),
        blob_storage: await checkBlobStorageStatus(),
      },

      // Performance Metrics
      performance: {
        response_times: await getResponseTimes(),
        throughput: await getThroughputMetrics(),
        error_rates: await getErrorRates(),
      },

      // Business Metrics
      business: {
        active_sessions: await getActiveSessionsCount(),
        games_running: await getRunningGamesCount(),
        recent_activity: await getRecentActivity(),
      },
    };

    // Determine overall status
    const services = Object.values(status.services);
    const unhealthyServices = services.filter(
      service => service.status === 'down'
    );
    const degradedServices = services.filter(
      service => service.status === 'degraded'
    );

    if (unhealthyServices.length > 0) {
      status.status = 'major_outage';
    } else if (degradedServices.length > 0) {
      status.status = 'partial_outage';
    }

    const httpStatus =
      status.status === 'operational'
        ? 200
        : status.status === 'partial_outage'
          ? 206
          : 503;

    return NextResponse.json(status, {
      status: httpStatus,
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Status check failed:', error);

    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        status: 'major_outage',
        error: 'Status check failed',
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

function getSystemMemory() {
  if (!process.memoryUsage) {
    return { status: 'unavailable' };
  }

  const memory = process.memoryUsage();
  const heapUsedMB = Math.round(memory.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memory.heapTotal / 1024 / 1024);
  const utilization = Math.round((heapUsedMB / heapTotalMB) * 100);

  return {
    heap_used_mb: heapUsedMB,
    heap_total_mb: heapTotalMB,
    utilization_percent: utilization,
    status:
      utilization > 90 ? 'critical' : utilization > 75 ? 'warning' : 'healthy',
  };
}

async function checkDatabaseStatus() {
  try {
    const start = performance.now();
    await kv.ping();
    const latency = Math.round(performance.now() - start);

    return {
      status:
        latency < 100 ? 'operational' : latency < 500 ? 'degraded' : 'down',
      latency_ms: latency,
      last_check: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
      last_check: new Date().toISOString(),
    };
  }
}

async function checkAIServiceStatus() {
  const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY);

  if (!hasApiKey) {
    return {
      status: 'down',
      error: 'API key not configured',
      last_check: new Date().toISOString(),
    };
  }

  try {
    // Check recent AI service metrics
    const metrics = await kv.hgetall('ai:health');
    const lastCheck = metrics?.last_successful_request;
    const recentErrors = metrics?.recent_errors || 0;

    // If we had successful requests in the last 5 minutes, consider it operational
    const lastCheckTime = lastCheck ? new Date(lastCheck).getTime() : 0;
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    let status = 'operational';
    if (lastCheckTime < fiveMinutesAgo && recentErrors > 0) {
      status = 'degraded';
    }

    return {
      status,
      configured: true,
      last_successful_request: lastCheck || 'none',
      recent_errors: recentErrors,
      last_check: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'degraded',
      error: error instanceof Error ? error.message : 'Unknown error',
      configured: true,
      last_check: new Date().toISOString(),
    };
  }
}

async function checkBlobStorageStatus() {
  const hasToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  return {
    status: hasToken ? 'operational' : 'degraded',
    configured: hasToken,
    note: hasToken ? 'Ready for file uploads' : 'Token not configured',
    last_check: new Date().toISOString(),
  };
}

async function getResponseTimes() {
  try {
    const metrics = await kv.hgetall('performance:response_times');

    return {
      api_avg_ms: parseInt(metrics?.api_avg || '0'),
      ai_avg_ms: parseInt(metrics?.ai_avg || '0'),
      database_avg_ms: parseInt(metrics?.db_avg || '0'),
      last_updated: metrics?.last_updated || 'never',
    };
  } catch (error) {
    return {
      api_avg_ms: 0,
      ai_avg_ms: 0,
      database_avg_ms: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function getThroughputMetrics() {
  try {
    const currentMinute = Math.floor(Date.now() / 60000);
    const currentRequests = (await kv.get(`requests:${currentMinute}`)) || 0;
    const lastMinuteRequests =
      (await kv.get(`requests:${currentMinute - 1}`)) || 0;

    return {
      requests_per_minute: currentRequests,
      requests_last_minute: lastMinuteRequests,
      trend:
        currentRequests > lastMinuteRequests
          ? 'increasing'
          : currentRequests < lastMinuteRequests
            ? 'decreasing'
            : 'stable',
    };
  } catch (error) {
    return {
      requests_per_minute: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function getErrorRates() {
  try {
    const errorMetrics = await kv.hgetall('errors:rates');

    return {
      error_rate_percent: parseFloat(errorMetrics?.rate || '0'),
      total_errors_today: parseInt(errorMetrics?.total_today || '0'),
      last_error: errorMetrics?.last_error || 'none',
      last_updated: errorMetrics?.last_updated || 'never',
    };
  } catch (error) {
    return {
      error_rate_percent: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function getActiveSessionsCount() {
  try {
    // Count active sessions (placeholder - would be implemented with real session management)
    const sessions = await kv.scan(0, { match: 'session:*', count: 100 });

    return {
      total: sessions[1].length,
      note: 'Session tracking not fully implemented',
    };
  } catch (error) {
    return {
      total: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function getRunningGamesCount() {
  try {
    const rpgGames = await kv.scan(0, {
      match: 'game:rpg:*:state',
      count: 100,
    });
    const deductionGames = await kv.scan(0, {
      match: 'game:deduction:*:state',
      count: 100,
    });
    const villageGames = await kv.scan(0, {
      match: 'game:village:*:state',
      count: 100,
    });

    return {
      total:
        rpgGames[1].length + deductionGames[1].length + villageGames[1].length,
      by_type: {
        rpg: rpgGames[1].length,
        deduction: deductionGames[1].length,
        village: villageGames[1].length,
      },
    };
  } catch (error) {
    return {
      total: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function getRecentActivity() {
  try {
    // Get recent activity logs
    const recentLogs = await kv.lrange('activity:recent', 0, 9);

    return {
      recent_actions: recentLogs || [],
      count: recentLogs?.length || 0,
    };
  } catch (error) {
    return {
      recent_actions: [],
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
