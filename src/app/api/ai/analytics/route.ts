/**
 * AI Analytics and Monitoring API Endpoint
 *
 * Provides insights into AI usage patterns, performance metrics, and costs
 * Used for dashboard monitoring and optimization decisions
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { claudeService } from '@/lib/ai/claude';

// ============================================================================
// REQUEST VALIDATION
// ============================================================================

const AnalyticsRequestSchema = z.object({
  period: z.enum(['hour', 'day', 'week', 'month']).optional().default('day'),
  includeCache: z.boolean().optional().default(true),
  includeBreakdown: z.boolean().optional().default(false),
});

// ============================================================================
// ANALYTICS RESPONSE FORMATTING
// ============================================================================

function formatAnalytics(rawAnalytics: any) {
  const {
    totalRequests,
    successfulRequests,
    failedRequests,
    averageResponseTime,
    successRate,
    totalTokensUsed,
    estimatedCost,
    cache,
    categoryStats,
  } = rawAnalytics;

  return {
    overview: {
      totalRequests,
      successfulRequests,
      failedRequests,
      successRate: Math.round(successRate * 100 * 100) / 100, // Round to 2 decimals
      averageResponseTime: Math.round(averageResponseTime),
      totalTokensUsed,
      estimatedCost: Math.round(estimatedCost * 10000) / 10000, // Round to 4 decimals
    },
    performance: {
      averageResponseTime,
      successRate,
      errorRate: Math.round((1 - successRate) * 100 * 100) / 100,
      tokensPerRequest:
        totalRequests > 0 ? Math.round(totalTokensUsed / totalRequests) : 0,
      costPerRequest:
        totalRequests > 0
          ? Math.round((estimatedCost / totalRequests) * 10000) / 10000
          : 0,
    },
    cache: {
      enabled: true,
      memoryEntries: cache.memoryEntries,
      totalHits: cache.totalHits,
      hitRate: Math.round(cache.hitRate * 100 * 100) / 100,
      efficiency:
        cache.hitRate > 0.3
          ? 'good'
          : cache.hitRate > 0.15
            ? 'moderate'
            : 'poor',
    },
    categories: Object.fromEntries(
      Object.entries(categoryStats).map(([category, stats]: [string, any]) => [
        category,
        {
          requests: stats.requests,
          tokens: stats.tokens,
          averageResponseTime: Math.round(stats.responseTime / stats.requests),
          tokensPerRequest: Math.round(stats.tokens / stats.requests),
        },
      ])
    ),
    health: {
      status:
        successRate > 0.95
          ? 'excellent'
          : successRate > 0.85
            ? 'good'
            : successRate > 0.7
              ? 'fair'
              : 'poor',
      uptime: Math.round(successRate * 100 * 100) / 100,
      averageLatency: Math.round(averageResponseTime),
      recommendations: generateRecommendations(rawAnalytics),
    },
    timestamp: new Date().toISOString(),
  };
}

function generateRecommendations(analytics: any): string[] {
  const recommendations: string[] = [];

  // Cache efficiency recommendations
  if (analytics.cache.hitRate < 0.15) {
    recommendations.push(
      'Cache hit rate is low. Consider adjusting cache TTL or improving cache key generation.'
    );
  }

  // Performance recommendations
  if (analytics.averageResponseTime > 3000) {
    recommendations.push(
      'Average response time is high. Consider using faster models for simpler requests.'
    );
  }

  // Cost optimization recommendations
  if (analytics.estimatedCost > 10) {
    recommendations.push(
      'Daily AI costs are significant. Review token usage and consider caching strategies.'
    );
  }

  // Error rate recommendations
  if (analytics.successRate < 0.9) {
    recommendations.push(
      'Error rate is elevated. Check API connectivity and rate limiting configurations.'
    );
  }

  // Usage pattern recommendations
  if (analytics.totalRequests > 1000) {
    recommendations.push(
      'High request volume detected. Consider implementing request prioritization.'
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('AI service is performing optimally.');
  }

  return recommendations;
}

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

/**
 * GET /api/ai/analytics - Get AI usage analytics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryParams = {
      period: searchParams.get('period') || 'day',
      includeCache: searchParams.get('includeCache') !== 'false',
      includeBreakdown: searchParams.get('includeBreakdown') === 'true',
    };

    // Validate query parameters
    const validatedParams = AnalyticsRequestSchema.parse(queryParams);

    // Get analytics from Claude service
    const rawAnalytics = claudeService.getAnalytics();

    // Format response
    const formattedAnalytics = formatAnalytics(rawAnalytics);

    // Add service health check
    const healthCheck = await claudeService.healthCheck();

    // Merge health check data with existing health metrics
    Object.assign(formattedAnalytics.health, {
      serviceStatus: healthCheck.status,
      checks: healthCheck.checks,
    });

    return NextResponse.json({
      success: true,
      data: formattedAnalytics,
      meta: {
        period: validatedParams.period,
        includeCache: validatedParams.includeCache,
        includeBreakdown: validatedParams.includeBreakdown,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Analytics API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ANALYTICS_ERROR',
          message: 'Failed to retrieve AI analytics',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/analytics/reset - Reset analytics (for development/testing)
 */
export async function POST(request: NextRequest) {
  try {
    // Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Analytics reset is not allowed in production',
          },
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { resetCache = false, resetMetrics = false } = body;

    if (resetCache) {
      await claudeService.clearCache();
    }

    // TODO: Implement metrics reset functionality
    // if (resetMetrics) {
    //   await claudeService.resetMetrics();
    // }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Analytics reset completed',
        resetCache,
        resetMetrics,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Analytics reset error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'RESET_ERROR',
          message: 'Failed to reset analytics',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/ai/analytics/export - Export analytics data
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { format = 'json', period = 'week' } = body;

    if (!['json', 'csv'].includes(format)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_FORMAT',
            message: 'Export format must be json or csv',
          },
        },
        { status: 400 }
      );
    }

    const rawAnalytics = claudeService.getAnalytics();
    const formattedAnalytics = formatAnalytics(rawAnalytics);

    if (format === 'csv') {
      // Convert to CSV format
      const csvData = [
        ['Metric', 'Value'],
        [
          'Total Requests',
          formattedAnalytics.overview.totalRequests.toString(),
        ],
        [
          'Successful Requests',
          formattedAnalytics.overview.successfulRequests.toString(),
        ],
        [
          'Failed Requests',
          formattedAnalytics.overview.failedRequests.toString(),
        ],
        [
          'Success Rate (%)',
          formattedAnalytics.overview.successRate.toString(),
        ],
        [
          'Average Response Time (ms)',
          formattedAnalytics.overview.averageResponseTime.toString(),
        ],
        [
          'Total Tokens Used',
          formattedAnalytics.overview.totalTokensUsed.toString(),
        ],
        [
          'Estimated Cost ($)',
          formattedAnalytics.overview.estimatedCost.toString(),
        ],
        ['Cache Hit Rate (%)', formattedAnalytics.cache.hitRate.toString()],
        [
          'Cache Memory Entries',
          formattedAnalytics.cache.memoryEntries.toString(),
        ],
      ]
        .map(row => row.join(','))
        .join('\n');

      return new NextResponse(csvData, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="ai-analytics-${period}-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // JSON format
    return NextResponse.json({
      success: true,
      data: {
        analytics: formattedAnalytics,
        export: {
          format,
          period,
          exportedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('Analytics export error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'EXPORT_ERROR',
          message: 'Failed to export analytics data',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS - CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
