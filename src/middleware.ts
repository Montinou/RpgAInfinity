/**
 * Production Monitoring Middleware
 * Handles request tracking, performance monitoring, and security for all API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { monitorAPIResponse, startTiming } from './lib/monitoring/performance';
import { trackError, trackWarning } from './lib/monitoring/error-tracking';

const RATE_LIMIT_REQUESTS = 100; // Requests per minute
const RATE_LIMIT_AI_REQUESTS = 10; // AI requests per minute
const BLOCKED_IPS = new Set<string>(); // Could be loaded from KV in production

/**
 * Middleware for monitoring, rate limiting, and security
 */
export async function middleware(request: NextRequest) {
  const startTime = performance.now();
  const pathname = request.nextUrl.pathname;
  const method = request.method;

  // Skip middleware for static assets and certain paths
  if (shouldSkipMiddleware(pathname)) {
    return NextResponse.next();
  }

  try {
    // Security checks
    const securityCheck = await performSecurityChecks(request);
    if (securityCheck) {
      return securityCheck;
    }

    // Rate limiting
    const rateLimitCheck = await performRateLimiting(request);
    if (rateLimitCheck) {
      return rateLimitCheck;
    }

    // Process the request
    const response = NextResponse.next();

    // Add security headers
    addSecurityHeaders(response);

    // Monitor performance
    const duration = Math.round(performance.now() - startTime);
    const statusCode = response.status || 200;

    // Record metrics asynchronously to avoid blocking the response
    recordMetricsAsync(pathname, method, statusCode, duration, request);

    return response;
  } catch (error) {
    // Log middleware errors
    await trackError(`Middleware error: ${error}`, {
      pathname,
      method,
      userAgent: request.headers.get('user-agent'),
    });

    // Continue with request even if monitoring fails
    return NextResponse.next();
  }
}

/**
 * Check if middleware should be skipped for this path
 */
function shouldSkipMiddleware(pathname: string): boolean {
  const skipPaths = [
    '/_next',
    '/__nextjs',
    '/favicon.ico',
    '/robots.txt',
    '/sitemap.xml',
    '/manifest.json',
  ];

  return (
    skipPaths.some(path => pathname.startsWith(path)) ||
    pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$/)
  );
}

/**
 * Perform security checks
 */
async function performSecurityChecks(
  request: NextRequest
): Promise<NextResponse | null> {
  const ip = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || '';
  const pathname = request.nextUrl.pathname;

  // Block known bad IPs
  if (BLOCKED_IPS.has(ip)) {
    await trackWarning(`Blocked IP attempted access: ${ip}`, {
      ip,
      pathname,
      userAgent,
    });

    return new NextResponse('Forbidden', { status: 403 });
  }

  // Check for suspicious patterns
  if (isSuspiciousRequest(request)) {
    await trackWarning(`Suspicious request detected from ${ip}`, {
      ip,
      pathname,
      userAgent,
      method: request.method,
    });

    // Don't block, just log for now
  }

  // Validate content-type for POST/PUT requests
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    const contentType = request.headers.get('content-type');
    if (!contentType || !isValidContentType(contentType)) {
      return new NextResponse('Invalid Content-Type', { status: 400 });
    }
  }

  return null;
}

/**
 * Perform rate limiting
 */
async function performRateLimiting(
  request: NextRequest
): Promise<NextResponse | null> {
  if (process.env.NODE_ENV !== 'production') {
    return null; // Skip rate limiting in development
  }

  try {
    const ip = getClientIP(request);
    const pathname = request.nextUrl.pathname;
    const isAIEndpoint = pathname.startsWith('/api/ai/');

    // Use different rate limits for AI endpoints
    const rateLimit = isAIEndpoint
      ? RATE_LIMIT_AI_REQUESTS
      : RATE_LIMIT_REQUESTS;
    const windowKey = `rate_limit:${ip}:${Math.floor(Date.now() / 60000)}`;

    // This would need KV implementation in a real production environment
    // For now, we'll just log the rate limiting attempt
    await trackWarning(`Rate limit check for ${ip}: ${pathname}`, {
      ip,
      pathname,
      is_ai_endpoint: isAIEndpoint,
      rate_limit: rateLimit,
    });

    // TODO: Implement actual rate limiting with KV
    // const currentRequests = await kv.incr(windowKey);
    // await kv.expire(windowKey, 60);
    //
    // if (currentRequests > rateLimit) {
    //   return new NextResponse('Rate limit exceeded', { status: 429 });
    // }
  } catch (error) {
    // Log rate limiting errors but don't block requests
    await trackError(`Rate limiting check failed: ${error}`, {
      pathname: request.nextUrl.pathname,
    });
  }

  return null;
}

/**
 * Add security headers to response
 */
function addSecurityHeaders(response: NextResponse): void {
  // These headers are also set in next.config.js, but adding here for redundancy
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Add request ID for tracing
  response.headers.set('X-Request-ID', generateRequestId());

  // Add timing information
  response.headers.set('X-Response-Time', Date.now().toString());
}

/**
 * Record metrics asynchronously
 */
async function recordMetricsAsync(
  pathname: string,
  method: string,
  statusCode: number,
  duration: number,
  request: NextRequest
): Promise<void> {
  try {
    // Record API performance metric
    await monitorAPIResponse(pathname, method, statusCode, duration);

    // Log slow requests
    if (duration > 1000) {
      await trackWarning(
        `Slow request detected: ${method} ${pathname} took ${duration}ms`,
        {
          pathname,
          method,
          duration,
          status_code: statusCode,
          user_agent: request.headers.get('user-agent'),
        }
      );
    }

    // Log errors
    if (statusCode >= 400) {
      const errorLevel = statusCode >= 500 ? 'error' : 'warning';
      await trackWarning(`HTTP ${statusCode} response: ${method} ${pathname}`, {
        pathname,
        method,
        status_code: statusCode,
        duration,
      });
    }
  } catch (error) {
    // Don't let monitoring failures affect the application
    console.error('Failed to record metrics:', error);
  }
}

/**
 * Get client IP address
 */
function getClientIP(request: NextRequest): string {
  // Check various headers for the real IP
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfIP = request.headers.get('cf-connecting-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  if (realIP) {
    return realIP;
  }

  if (cfIP) {
    return cfIP;
  }

  // Fallback to connection IP (not available in Edge Runtime)
  return 'unknown';
}

/**
 * Check if request appears suspicious
 */
function isSuspiciousRequest(request: NextRequest): boolean {
  const userAgent = request.headers.get('user-agent') || '';
  const pathname = request.nextUrl.pathname;

  // Common suspicious patterns
  const suspiciousPatterns = [
    /bot|crawler|spider/i,
    /scan|probe|test/i,
    /sqlmap|burp|nmap/i,
  ];

  // Check for suspicious user agents
  if (suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
    return true;
  }

  // Check for suspicious paths
  const suspiciousPaths = [
    '/wp-admin',
    '/wp-login',
    '/.env',
    '/config',
    '/admin',
    '/phpmyadmin',
  ];

  if (suspiciousPaths.some(path => pathname.includes(path))) {
    return true;
  }

  return false;
}

/**
 * Validate content-type header
 */
function isValidContentType(contentType: string): boolean {
  const validTypes = [
    'application/json',
    'multipart/form-data',
    'application/x-www-form-urlencoded',
    'text/plain',
  ];

  return validTypes.some(type => contentType.startsWith(type));
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    // Run on all API routes
    '/api/:path*',
    // Run on all app routes (excluding static assets)
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};
