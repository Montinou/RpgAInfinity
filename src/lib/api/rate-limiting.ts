/**
 * Rate Limiting Middleware for RPG API
 *
 * Implements comprehensive rate limiting with Redis-based storage,
 * different limits per endpoint type, and user-specific tracking.
 */

import { NextRequest, NextResponse } from 'next/server';
import { kvService } from '@/lib/database';

// ============================================================================
// RATE LIMITING CONFIGURATION
// ============================================================================

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator: (req: NextRequest) => string;
  onLimitReached?: (req: NextRequest) => NextResponse;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export const RPG_RATE_LIMITS: Record<string, RateLimitConfig> = {
  // General RPG API endpoints - 60 requests per minute per user
  default: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    keyGenerator: (req: NextRequest) => {
      const userId = req.headers.get('user-id') || req.ip || 'anonymous';
      return `rpg:default:${userId}`;
    },
  },

  // World generation - More expensive, limit to 5 per minute per user
  worldGeneration: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
    keyGenerator: (req: NextRequest) => {
      const userId = req.headers.get('user-id') || req.ip || 'anonymous';
      return `rpg:world_gen:${userId}`;
    },
  },

  // Combat actions - High frequency, 120 per minute per user
  combat: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 120,
    keyGenerator: (req: NextRequest) => {
      const userId = req.headers.get('user-id') || req.ip || 'anonymous';
      return `rpg:combat:${userId}`;
    },
  },

  // Character creation - 10 per hour per user
  characterCreation: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    keyGenerator: (req: NextRequest) => {
      const userId = req.headers.get('user-id') || req.ip || 'anonymous';
      return `rpg:char_creation:${userId}`;
    },
  },

  // Game session management - 30 per minute per user
  gameManagement: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    keyGenerator: (req: NextRequest) => {
      const userId = req.headers.get('user-id') || req.ip || 'anonymous';
      return `rpg:game_mgmt:${userId}`;
    },
  },
};

// ============================================================================
// RATE LIMITING IMPLEMENTATION
// ============================================================================

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export class RateLimiter {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  async checkLimit(req: NextRequest): Promise<RateLimitResult> {
    const key = this.config.keyGenerator(req);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    try {
      // Get current count from Redis/KV store
      const currentData = await kvService.get<{
        count: number;
        windowStart: number;
        requests: number[];
      }>(`rate_limit:${key}`);

      let count = 0;
      let requests: number[] = [];

      if (currentData) {
        // Filter requests within current window
        requests = currentData.requests.filter(
          timestamp => timestamp > windowStart
        );
        count = requests.length;
      }

      const allowed = count < this.config.maxRequests;
      const remaining = Math.max(0, this.config.maxRequests - count - 1);
      const resetTime = windowStart + this.config.windowMs;

      if (allowed) {
        // Add current request
        requests.push(now);

        // Store updated data
        await kvService.set(
          `rate_limit:${key}`,
          {
            count: requests.length,
            windowStart,
            requests,
          },
          { ttl: this.config.windowMs }
        );
      }

      const result: RateLimitResult = {
        allowed,
        count: allowed ? count + 1 : count,
        remaining,
        resetTime,
      };

      if (!allowed) {
        result.retryAfter = Math.ceil((resetTime - now) / 1000);
      }

      return result;
    } catch (error) {
      // On Redis/KV error, allow the request but log the error
      //TODO: Implement proper error logging service integration
      console.error('Rate limiting error:', error);

      return {
        allowed: true,
        count: 0,
        remaining: this.config.maxRequests,
        resetTime: now + this.config.windowMs,
      };
    }
  }
}

// ============================================================================
// MIDDLEWARE FACTORY
// ============================================================================

export function createRateLimitMiddleware(
  limitType: keyof typeof RPG_RATE_LIMITS = 'default'
) {
  const config = RPG_RATE_LIMITS[limitType];
  const rateLimiter = new RateLimiter(config);

  return async function rateLimitMiddleware(
    req: NextRequest
  ): Promise<NextResponse | null> {
    const result = await rateLimiter.checkLimit(req);

    // Add rate limit headers to response
    const headers = new Headers();
    headers.set('X-RateLimit-Limit', config.maxRequests.toString());
    headers.set('X-RateLimit-Remaining', result.remaining.toString());
    headers.set('X-RateLimit-Reset', result.resetTime.toString());
    headers.set('X-RateLimit-Window', config.windowMs.toString());

    if (!result.allowed) {
      // Rate limit exceeded
      headers.set('Retry-After', result.retryAfter?.toString() || '60');

      return new NextResponse(
        JSON.stringify({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Rate limit exceeded. Please try again later.',
            details: {
              limit: config.maxRequests,
              windowMs: config.windowMs,
              retryAfter: result.retryAfter,
            },
            timestamp: new Date().toISOString(),
          },
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...Object.fromEntries(headers.entries()),
          },
        }
      );
    }

    // Store headers for later use in response
    (req as any).rateLimitHeaders = headers;

    return null; // Continue to next middleware
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export async function getRateLimitStatus(
  req: NextRequest,
  limitType: keyof typeof RPG_RATE_LIMITS = 'default'
): Promise<RateLimitResult> {
  const config = RPG_RATE_LIMITS[limitType];
  const rateLimiter = new RateLimiter(config);
  return rateLimiter.checkLimit(req);
}

export function addRateLimitHeaders(
  response: NextResponse,
  req: NextRequest
): NextResponse {
  const headers = (req as any).rateLimitHeaders as Headers;
  if (headers) {
    for (const [key, value] of headers.entries()) {
      response.headers.set(key, value);
    }
  }
  return response;
}

// ============================================================================
// RATE LIMIT ANALYTICS
// ============================================================================

export interface RateLimitAnalytics {
  totalRequests: number;
  blockedRequests: number;
  topUsers: Array<{ userId: string; requestCount: number }>;
  topEndpoints: Array<{ endpoint: string; requestCount: number }>;
  averageRequestsPerUser: number;
  timeWindow: { start: number; end: number };
}

export async function getRateLimitAnalytics(
  timeWindowMs: number = 24 * 60 * 60 * 1000 // Default: 24 hours
): Promise<RateLimitAnalytics> {
  //TODO: Implement comprehensive rate limit analytics
  // This would require tracking additional metrics in Redis/KV

  return {
    totalRequests: 0,
    blockedRequests: 0,
    topUsers: [],
    topEndpoints: [],
    averageRequestsPerUser: 0,
    timeWindow: {
      start: Date.now() - timeWindowMs,
      end: Date.now(),
    },
  };
}

// ============================================================================
// DYNAMIC RATE LIMITING
// ============================================================================

export interface DynamicRateLimit {
  baseLimit: number;
  userTier: 'free' | 'premium' | 'enterprise';
  gameComplexity: 'simple' | 'moderate' | 'complex';
  serverLoad: 'low' | 'medium' | 'high';
}

export function calculateDynamicRateLimit(params: DynamicRateLimit): number {
  let limit = params.baseLimit;

  // Adjust for user tier
  switch (params.userTier) {
    case 'premium':
      limit *= 2;
      break;
    case 'enterprise':
      limit *= 5;
      break;
    default:
      // free tier uses base limit
      break;
  }

  // Adjust for game complexity
  switch (params.gameComplexity) {
    case 'simple':
      limit *= 1.5;
      break;
    case 'complex':
      limit *= 0.7;
      break;
    default:
      // moderate uses base multiplier
      break;
  }

  // Adjust for server load
  switch (params.serverLoad) {
    case 'high':
      limit *= 0.5;
      break;
    case 'medium':
      limit *= 0.8;
      break;
    default:
      // low load uses base multiplier
      break;
  }

  return Math.max(1, Math.floor(limit));
}

// ============================================================================
// TECHNICAL DEBT MARKERS
// ============================================================================

//TODO: Implement distributed rate limiting for multi-server deployments
//TODO: Add rate limiting bypass for system administrators
//TODO: Implement sliding window rate limiting algorithm for smoother limits
//TODO: Add rate limiting monitoring dashboard integration
//TODO: Implement IP-based fallback when user authentication is not available
//TODO: Add rate limiting exemptions for critical game actions
//TODO: Implement rate limiting warming periods for new users
//TODO: Add geographic rate limiting for region-specific limits
//TODO: Implement rate limiting analytics export functionality
//TODO: Add rate limiting A/B testing capabilities for optimization
