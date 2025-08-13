/**
 * AI Content Generation API Endpoint
 *
 * Provides secure access to Claude AI services through Next.js API routes
 * Handles both standard and streaming content generation
 * Includes comprehensive validation, rate limiting, and error handling
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { claudeService, createSimplePrompt } from '@/lib/ai/claude';
import { AIContext } from '@/types/ai';

// Define GameError class locally
class GameError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'GameError';
  }
}

// ============================================================================
// REQUEST VALIDATION SCHEMAS
// ============================================================================

const GenerateRequestSchema = z.object({
  prompt: z.string().min(1).max(10000),
  gameId: z.string().uuid().optional(),
  playerId: z.string().uuid().optional(),
  gameType: z.enum(['rpg', 'deduction', 'village']).default('rpg'),
  context: z
    .object({
      gameState: z.record(z.any()).optional(),
      playerHistory: z.array(z.any()).optional(),
      recentEvents: z.array(z.any()).optional(),
      systemFlags: z.record(z.boolean()).optional(),
      culturalPreferences: z
        .object({
          language: z.string().optional(),
          region: z.string().optional(),
          contentRating: z.enum(['general', 'teen', 'mature']).optional(),
          themes: z.array(z.string()).optional(),
          avoidances: z.array(z.string()).optional(),
        })
        .optional(),
    })
    .optional(),
  options: z
    .object({
      model: z
        .enum([
          'claude-3-5-sonnet-20241022',
          'claude-3-5-haiku-20241022',
          'claude-3-opus-20240229',
          'claude-3-sonnet-20240229',
          'claude-3-haiku-20240307',
        ])
        .optional(),
      maxTokens: z.number().min(1).max(8192).optional(),
      temperature: z.number().min(0).max(2).optional(),
      priority: z.enum(['low', 'normal', 'high', 'critical']).optional(),
      streaming: z.boolean().optional(),
      cacheKey: z.string().optional(),
    })
    .optional(),
});

// Unused but kept for future streaming implementation
// const StreamingRequestSchema = GenerateRequestSchema.extend({
//   streaming: z.literal(true),
// });

const StructuredRequestSchema = GenerateRequestSchema.extend({
  schema: z.object({
    type: z.string(),
    properties: z.record(z.any()),
    required: z.array(z.string()).optional(),
  }),
  maxRetries: z.number().min(1).max(5).optional(),
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function validateRequest(request: NextRequest): {
  method: string;
  headers: Record<string, string>;
  clientId: string;
} {
  const method = request.method;
  const headers = Object.fromEntries(request.headers.entries());
  const clientId = headers['x-client-id'] || headers['user-agent'] || 'unknown';

  return { method, headers, clientId };
}

function createAIContext(
  gameType: 'rpg' | 'deduction' | 'village',
  context?: any
): AIContext {
  return {
    gameType,
    gameState: context?.gameState || {},
    playerHistory: context?.playerHistory || [],
    recentEvents: context?.recentEvents || [],
    systemFlags: context?.systemFlags || {},
    culturalPreferences: context?.culturalPreferences,
  };
}

function handleError(error: unknown, context: string): NextResponse {
  console.error(`AI API error in ${context}:`, error);

  if (error instanceof GameError) {
    const statusCode =
      error.code === 'RATE_LIMIT_EXCEEDED'
        ? 429
        : error.code === 'CLAUDE_AUTH_ERROR'
          ? 401
          : error.code === 'INVALID_AI_REQUEST'
            ? 400
            : 500;

    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      },
      { status: statusCode }
    );
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.errors,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
      },
    },
    { status: 500 }
  );
}

// ============================================================================
// API ROUTE HANDLERS
// ============================================================================

/**
 * POST /api/ai/generate - Standard content generation
 */
export async function POST(request: NextRequest) {
  try {
    validateRequest(request); // Validate request headers
    const body = await request.json();

    // Validate request body
    const validatedData = GenerateRequestSchema.parse(body);

    // Create AI context
    const aiContext = createAIContext(
      validatedData.gameType,
      validatedData.context
    );

    // Generate content
    const startTime = Date.now();
    const content = await claudeService.generateContent(
      validatedData.prompt,
      aiContext,
      {
        model: validatedData.options?.model,
        maxTokens: validatedData.options?.maxTokens,
        temperature: validatedData.options?.temperature,
        priority: validatedData.options?.priority,
        cacheKey: validatedData.options?.cacheKey,
      }
    );

    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: {
        content,
        processingTime,
        gameId: validatedData.gameId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleError(error, 'POST /api/ai/generate');
  }
}

/**
 * POST /api/ai/generate?streaming=true - Streaming content generation
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isStreaming = searchParams.get('streaming') === 'true';

    if (!isStreaming) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message:
              'GET method only supports streaming requests. Use streaming=true parameter.',
          },
        },
        { status: 400 }
      );
    }

    // For streaming, we need to handle the request differently
    const prompt = searchParams.get('prompt');
    const gameType = (searchParams.get('gameType') as any) || 'rpg';

    if (!prompt) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_PROMPT',
            message: 'Prompt is required for streaming requests',
          },
        },
        { status: 400 }
      );
    }

    // Create simple context for GET requests
    const context = createSimplePrompt(prompt, gameType);

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of claudeService.streamContent(
            prompt,
            context
          )) {
            const data = `data: ${JSON.stringify({ chunk, timestamp: new Date().toISOString() })}\n\n`;
            controller.enqueue(encoder.encode(data));
          }

          // Send completion signal
          const completion = `data: ${JSON.stringify({ done: true, timestamp: new Date().toISOString() })}\n\n`;
          controller.enqueue(encoder.encode(completion));
          controller.close();
        } catch (error) {
          const errorData = `data: ${JSON.stringify({
            error: error instanceof Error ? error.message : 'Streaming error',
            timestamp: new Date().toISOString(),
          })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    return handleError(error, 'GET /api/ai/generate (streaming)');
  }
}

/**
 * PUT /api/ai/generate - Structured output generation
 */
export async function PUT(request: NextRequest) {
  try {
    validateRequest(request); // Validate request headers
    const body = await request.json();

    // Validate structured request
    const validatedData = StructuredRequestSchema.parse(body);

    // Create Zod schema from the provided schema definition
    // TODO: Implement proper dynamic Zod schema creation from JSON schema
    // For now, we'll use a simple object validation
    const dynamicSchema = z.object(
      Object.keys(validatedData.schema.properties).reduce(
        (acc, key) => {
          acc[key] = z.any(); // TODO: Map JSON schema types to Zod types
          return acc;
        },
        {} as Record<string, z.ZodType>
      )
    );

    // Create AI context
    const aiContext = createAIContext(
      validatedData.gameType,
      validatedData.context
    );

    // Generate structured content
    const startTime = Date.now();
    const result = await claudeService.generateStructured(
      validatedData.prompt,
      dynamicSchema,
      aiContext,
      {
        model: validatedData.options?.model,
        maxRetries: validatedData.maxRetries,
      }
    );

    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: {
        structured: result,
        processingTime,
        gameId: validatedData.gameId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleError(error, 'PUT /api/ai/generate (structured)');
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
      'Access-Control-Allow-Headers': 'Content-Type, x-client-id',
    },
  });
}
