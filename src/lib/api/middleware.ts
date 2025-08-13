/**
 * API Middleware for RPG Endpoints
 *
 * Comprehensive middleware system for authentication, authorization,
 * error handling, and request/response processing for RPG API endpoints.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ValidationError,
  isValidationError,
  ErrorResponseSchema,
  SuccessResponseSchema,
  RequestContextSchema,
} from './rpg-validation';
import {
  createRateLimitMiddleware,
  addRateLimitHeaders,
} from './rate-limiting';
import { UUID, GameError, ErrorCode } from '@/types/core';

// ============================================================================
// REQUEST CONTEXT TYPES
// ============================================================================

export interface RequestContext {
  userId?: UUID;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  requestId: string;
  correlationId?: string;
}

export interface AuthenticatedRequest extends NextRequest {
  context: RequestContext;
  user?: {
    id: UUID;
    name: string;
    email: string;
    tier: 'free' | 'premium' | 'enterprise';
    permissions: string[];
  };
}

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

export async function authenticationMiddleware(req: NextRequest): Promise<{
  request: AuthenticatedRequest;
  response?: NextResponse;
}> {
  // Create request context
  const requestId = crypto.randomUUID();
  const correlationId = req.headers.get('x-correlation-id') || requestId;

  const context: RequestContext = {
    requestId,
    correlationId,
    timestamp: new Date(),
    ipAddress: req.ip,
    userAgent: req.headers.get('user-agent') || undefined,
    sessionId: req.headers.get('x-session-id') || undefined,
  };

  // Extract authentication token
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    // For now, allow unauthenticated access but mark as anonymous
    //TODO: Implement proper session-based authentication for anonymous users
    context.userId = (req.headers.get('x-user-id') as UUID) || undefined;
  } else {
    try {
      // Verify JWT token
      //TODO: Implement proper JWT verification with Supabase integration
      const user = await verifyAuthToken(token);
      context.userId = user.id;

      const authenticatedReq = req as AuthenticatedRequest;
      authenticatedReq.context = context;
      authenticatedReq.user = user;

      return { request: authenticatedReq };
    } catch (error) {
      return {
        request: req as AuthenticatedRequest,
        response: createErrorResponse(
          {
            code: 'AUTHENTICATION_ERROR' as ErrorCode,
            message: 'Invalid authentication token',
            details: { reason: 'token_verification_failed' },
            timestamp: new Date(),
            playerId: context.userId,
          },
          401,
          context
        ),
      };
    }
  }

  const authenticatedReq = req as AuthenticatedRequest;
  authenticatedReq.context = context;

  return { request: authenticatedReq };
}

// ============================================================================
// AUTHORIZATION MIDDLEWARE
// ============================================================================

export interface AuthorizationRule {
  resource: string;
  action: string;
  conditions?: (req: AuthenticatedRequest) => boolean | Promise<boolean>;
}

export function createAuthorizationMiddleware(rules: AuthorizationRule[]) {
  return async function authorizationMiddleware(
    req: AuthenticatedRequest
  ): Promise<NextResponse | null> {
    if (!req.user && rules.some(rule => rule.resource !== 'public')) {
      return createErrorResponse(
        {
          code: 'PERMISSION_DENIED' as ErrorCode,
          message: 'Authentication required for this resource',
          timestamp: new Date(),
          playerId: req.context.userId,
        },
        403,
        req.context
      );
    }

    // Check authorization rules
    for (const rule of rules) {
      if (rule.resource === 'public') continue;

      const hasPermission = req.user?.permissions.includes(
        `${rule.resource}:${rule.action}`
      );
      if (!hasPermission) {
        return createErrorResponse(
          {
            code: 'PERMISSION_DENIED' as ErrorCode,
            message: `Insufficient permissions for ${rule.resource}:${rule.action}`,
            details: {
              required: `${rule.resource}:${rule.action}`,
              user_permissions: req.user?.permissions || [],
            },
            timestamp: new Date(),
            playerId: req.context.userId,
          },
          403,
          req.context
        );
      }

      // Check additional conditions if specified
      if (rule.conditions) {
        const conditionMet = await rule.conditions(req);
        if (!conditionMet) {
          return createErrorResponse(
            {
              code: 'PERMISSION_DENIED' as ErrorCode,
              message: 'Authorization condition not met',
              timestamp: new Date(),
              playerId: req.context.userId,
            },
            403,
            req.context
          );
        }
      }
    }

    return null; // Authorization passed
  };
}

// ============================================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================================

export function createErrorHandler() {
  return function errorHandler(
    error: unknown,
    req: AuthenticatedRequest
  ): NextResponse {
    const context = req.context;

    // Log error for monitoring
    logError(error, context);

    // Handle different error types
    if (isValidationError(error)) {
      return createErrorResponse(
        {
          code: 'VALIDATION_ERROR' as ErrorCode,
          message: error.message,
          details: { issues: error.issues },
          timestamp: new Date(),
          playerId: context.userId,
        },
        400,
        context
      );
    }

    if (isGameError(error)) {
      const statusCode = getStatusCodeFromErrorCode(error.code);
      return createErrorResponse(error, statusCode, context);
    }

    if (error instanceof Error) {
      // Generic error
      return createErrorResponse(
        {
          code: 'INTERNAL_ERROR' as ErrorCode,
          message: 'An unexpected error occurred',
          details: {
            error_type: error.constructor.name,
            stack:
              process.env.NODE_ENV === 'development' ? error.stack : undefined,
          },
          timestamp: new Date(),
          playerId: context.userId,
        },
        500,
        context
      );
    }

    // Unknown error
    return createErrorResponse(
      {
        code: 'INTERNAL_ERROR' as ErrorCode,
        message: 'An unknown error occurred',
        timestamp: new Date(),
        playerId: context.userId,
      },
      500,
      context
    );
  };
}

// ============================================================================
// REQUEST/RESPONSE PROCESSING
// ============================================================================

export function createApiHandler<TRequest = any, TResponse = any>(
  options: {
    rateLimitType?: keyof typeof import('./rate-limiting').RPG_RATE_LIMITS;
    authRules?: AuthorizationRule[];
    requestSchema?: z.ZodSchema<TRequest>;
    requireAuth?: boolean;
    timeout?: number;
  } = {}
) {
  return function apiHandler(
    handler: (req: AuthenticatedRequest, body: TRequest) => Promise<TResponse>
  ) {
    return async function (req: NextRequest): Promise<NextResponse> {
      const startTime = Date.now();
      let authenticatedReq: AuthenticatedRequest;

      try {
        // 1. Authentication
        const authResult = await authenticationMiddleware(req);
        if (authResult.response) {
          return authResult.response;
        }
        authenticatedReq = authResult.request;

        // 2. Rate Limiting
        if (options.rateLimitType) {
          const rateLimitMiddleware = createRateLimitMiddleware(
            options.rateLimitType
          );
          const rateLimitResponse = await rateLimitMiddleware(req);
          if (rateLimitResponse) {
            return rateLimitResponse;
          }
        }

        // 3. Authorization
        if (options.authRules && options.authRules.length > 0) {
          const authMiddleware = createAuthorizationMiddleware(
            options.authRules
          );
          const authResponse = await authMiddleware(authenticatedReq);
          if (authResponse) {
            return authResponse;
          }
        }

        // 4. Request timeout
        const timeoutPromise = options.timeout
          ? new Promise<never>((_, reject) => {
              setTimeout(
                () => reject(new Error('Request timeout')),
                options.timeout
              );
            })
          : null;

        // 5. Parse request body
        let body: TRequest | undefined;
        if (req.method !== 'GET' && req.method !== 'DELETE') {
          try {
            const rawBody = await req.json();
            if (options.requestSchema) {
              body = options.requestSchema.parse(rawBody);
            } else {
              body = rawBody;
            }
          } catch (error) {
            if (error instanceof z.ZodError) {
              throw new ValidationError(
                'Request body validation failed',
                error.issues.map(issue => ({
                  path: issue.path.join('.'),
                  message: issue.message,
                  code: issue.code,
                }))
              );
            }
            throw error;
          }
        }

        // 6. Execute handler
        const handlerPromise = handler(authenticatedReq, body!);
        const result = timeoutPromise
          ? await Promise.race([handlerPromise, timeoutPromise])
          : await handlerPromise;

        // 7. Create success response
        const response = createSuccessResponse(
          result,
          authenticatedReq.context
        );

        // 8. Add rate limit headers
        const finalResponse = addRateLimitHeaders(response, req);

        // 9. Log successful request
        logRequest(authenticatedReq, Date.now() - startTime, 200);

        return finalResponse;
      } catch (error) {
        // Handle all errors
        const errorHandler = createErrorHandler();
        const errorResponse = errorHandler(error, authenticatedReq!);

        // Log error request
        if (authenticatedReq!) {
          logRequest(
            authenticatedReq,
            Date.now() - startTime,
            errorResponse.status
          );
        }

        return errorResponse;
      }
    };
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function createSuccessResponse(
  data: any,
  context: RequestContext
): NextResponse {
  const response = {
    success: true,
    data,
    metadata: {
      timestamp: new Date().toISOString(),
      requestId: context.requestId,
      correlationId: context.correlationId,
      version: '1.0.0',
    },
  };

  return NextResponse.json(response, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': context.requestId,
      'X-Correlation-ID': context.correlationId || context.requestId,
    },
  });
}

function createErrorResponse(
  error: GameError,
  statusCode: number,
  context: RequestContext
): NextResponse {
  const response = {
    success: false,
    error: {
      ...error,
      requestId: context.requestId,
    },
    metadata: {
      timestamp: new Date().toISOString(),
      requestId: context.requestId,
      correlationId: context.correlationId,
      version: '1.0.0',
    },
  };

  return NextResponse.json(response, {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': context.requestId,
      'X-Correlation-ID': context.correlationId || context.requestId,
    },
  });
}

function getStatusCodeFromErrorCode(code: ErrorCode): number {
  switch (code) {
    case 'GAME_NOT_FOUND':
    case 'PLAYER_NOT_FOUND':
      return 404;
    case 'INVALID_ACTION':
    case 'INVALID_PHASE':
    case 'VALIDATION_ERROR':
      return 400;
    case 'PERMISSION_DENIED':
      return 403;
    case 'RATE_LIMIT_EXCEEDED':
      return 429;
    case 'GAME_FULL':
    case 'GAME_ENDED':
      return 409;
    case 'AI_SERVICE_ERROR':
    case 'DATABASE_ERROR':
    default:
      return 500;
  }
}

function isGameError(error: unknown): error is GameError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'timestamp' in error
  );
}

// ============================================================================
// AUTHENTICATION FUNCTIONS
// ============================================================================

async function verifyAuthToken(token: string): Promise<{
  id: UUID;
  name: string;
  email: string;
  tier: 'free' | 'premium' | 'enterprise';
  permissions: string[];
}> {
  //TODO: Implement Supabase JWT verification
  // For now, return a mock user for development
  if (process.env.NODE_ENV === 'development') {
    return {
      id: crypto.randomUUID(),
      name: 'Developer User',
      email: 'dev@example.com',
      tier: 'premium',
      permissions: [
        'rpg:all',
        'game:create',
        'world:generate',
        'character:manage',
        'combat:participate',
      ],
    };
  }

  throw new Error('Authentication not implemented');
}

// ============================================================================
// LOGGING FUNCTIONS
// ============================================================================

function logError(error: unknown, context: RequestContext): void {
  //TODO: Implement structured logging with external service integration
  console.error('API Error:', {
    error:
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : error,
    context: {
      requestId: context.requestId,
      userId: context.userId,
      timestamp: context.timestamp.toISOString(),
    },
  });
}

function logRequest(
  req: AuthenticatedRequest,
  duration: number,
  statusCode: number
): void {
  //TODO: Implement structured request logging for monitoring and analytics
  const logData = {
    method: req.method,
    url: req.url,
    userId: req.context.userId,
    duration,
    statusCode,
    timestamp: req.context.timestamp.toISOString(),
    requestId: req.context.requestId,
    userAgent: req.context.userAgent,
    ipAddress: req.context.ipAddress,
  };

  console.log('API Request:', logData);
}

// ============================================================================
// TECHNICAL DEBT MARKERS
// ============================================================================

//TODO: Implement proper Supabase authentication integration
//TODO: Add request correlation tracking across microservices
//TODO: Implement comprehensive audit logging for security compliance
//TODO: Add API versioning support in middleware
//TODO: Implement request/response compression for large payloads
//TODO: Add CORS handling for browser-based clients
//TODO: Implement request ID propagation to downstream services
//TODO: Add performance monitoring integration (DataDog, New Relic, etc.)
//TODO: Implement proper session management with refresh tokens
//TODO: Add API documentation generation from middleware schemas
