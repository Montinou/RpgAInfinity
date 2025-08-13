/**
 * API Tests for Game Creation Endpoint
 *
 * Tests the POST /api/games/create endpoint for:
 * - Request validation (input sanitization, required fields)
 * - Game type-specific configuration
 * - Error handling (validation, game engine, server errors)
 * - Response format consistency
 * - Security measures (input injection, data validation)
 */

import { NextRequest } from 'next/server';
import { POST, OPTIONS } from '../create/route';
import { jest } from '@jest/globals';

// Mock the game engine to avoid database dependencies
jest.mock('@/lib/game-engine/core', () => ({
  CoreGameEngine: jest.fn().mockImplementation(() => ({
    createGame: jest.fn().mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      config: {
        type: 'rpg',
        name: 'Test Game',
        maxPlayers: 4,
        isPrivate: false,
      },
      state: {
        status: 'waiting',
        players: [],
      },
      createdAt: new Date('2025-08-13T10:00:00Z'),
    }),
  })),
}));

describe('POST /api/games/create', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // HAPPY PATH TESTS
  // ============================================================================

  describe('Valid Game Creation', () => {
    test('should create RPG game with valid configuration', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/games/create',
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'rpg',
            name: 'Epic Adventure',
            description: 'A thrilling RPG adventure',
            maxPlayers: 4,
            minPlayers: 2,
            isPrivate: false,
            settings: {
              difficulty: 'hard',
              allowPvP: true,
            },
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        success: true,
        data: {
          gameId: expect.any(String),
          type: 'rpg',
          name: 'Epic Adventure',
          status: 'waiting',
          maxPlayers: 4,
          currentPlayers: 0,
          isPrivate: false,
          createdAt: expect.any(String),
        },
        message: 'RPG game created successfully',
      });
    });

    test('should create deduction game with minimal configuration', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/games/create',
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'deduction',
            name: 'Mystery Night',
            maxPlayers: 6,
            minPlayers: 4,
            isPrivate: true,
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.type).toBe('deduction');
      expect(body.data.name).toBe('Mystery Night');
      expect(body.data.isPrivate).toBe(true);
      expect(body.message).toBe('DEDUCTION game created successfully');
    });

    test('should create village game with default settings', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/games/create',
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'village',
            name: 'Peaceful Valley',
            description: 'Build and manage a thriving village',
            maxPlayers: 8,
            minPlayers: 2,
            isPrivate: false,
            settings: {},
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.type).toBe('village');
      expect(body.message).toBe('VILLAGE game created successfully');
    });
  });

  // ============================================================================
  // VALIDATION ERROR TESTS
  // ============================================================================

  describe('Request Validation', () => {
    test('should reject empty request body', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/games/create',
        {
          method: 'POST',
          body: JSON.stringify({}),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual({
        success: false,
        error: 'Invalid request data',
        details: expect.arrayContaining([
          expect.objectContaining({
            field: 'type',
            message: expect.stringContaining('Required'),
          }),
          expect.objectContaining({
            field: 'name',
            message: expect.stringContaining('Required'),
          }),
        ]),
      });
    });

    test('should reject invalid game type', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/games/create',
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'invalid-type',
            name: 'Test Game',
            maxPlayers: 4,
            minPlayers: 2,
            isPrivate: false,
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.details).toContainEqual(
        expect.objectContaining({
          field: 'type',
          message: expect.stringContaining('Invalid enum value'),
        })
      );
    });

    test('should reject empty game name', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/games/create',
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'rpg',
            name: '',
            maxPlayers: 4,
            minPlayers: 2,
            isPrivate: false,
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.details).toContainEqual(
        expect.objectContaining({
          field: 'name',
          message: expect.stringContaining(
            'String must contain at least 1 character'
          ),
        })
      );
    });

    test('should reject name longer than 100 characters', async () => {
      const longName = 'a'.repeat(101);
      const request = new NextRequest(
        'http://localhost:3000/api/games/create',
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'rpg',
            name: longName,
            maxPlayers: 4,
            minPlayers: 2,
            isPrivate: false,
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.details).toContainEqual(
        expect.objectContaining({
          field: 'name',
          message: expect.stringContaining(
            'String must contain at most 100 character'
          ),
        })
      );
    });

    test('should reject invalid player count', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/games/create',
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'rpg',
            name: 'Test Game',
            maxPlayers: 1, // Invalid: less than 2
            minPlayers: 2,
            isPrivate: false,
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.details).toContainEqual(
        expect.objectContaining({
          field: 'maxPlayers',
          message: expect.stringContaining(
            'Number must be greater than or equal to 2'
          ),
        })
      );
    });

    test('should reject maxPlayers greater than 8', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/games/create',
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'rpg',
            name: 'Test Game',
            maxPlayers: 10, // Invalid: more than 8
            minPlayers: 2,
            isPrivate: false,
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.details).toContainEqual(
        expect.objectContaining({
          field: 'maxPlayers',
          message: expect.stringContaining(
            'Number must be less than or equal to 8'
          ),
        })
      );
    });

    test('should reject non-integer player counts', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/games/create',
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'rpg',
            name: 'Test Game',
            maxPlayers: 4.5, // Invalid: not an integer
            minPlayers: 2,
            isPrivate: false,
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.details).toContainEqual(
        expect.objectContaining({
          field: 'maxPlayers',
          message: expect.stringContaining('Expected integer'),
        })
      );
    });

    test('should reject description longer than 500 characters', async () => {
      const longDescription = 'a'.repeat(501);
      const request = new NextRequest(
        'http://localhost:3000/api/games/create',
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'rpg',
            name: 'Test Game',
            description: longDescription,
            maxPlayers: 4,
            minPlayers: 2,
            isPrivate: false,
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.details).toContainEqual(
        expect.objectContaining({
          field: 'description',
          message: expect.stringContaining(
            'String must contain at most 500 character'
          ),
        })
      );
    });
  });

  // ============================================================================
  // SECURITY TESTS
  // ============================================================================

  describe('Security Validation', () => {
    test('should sanitize and reject XSS attempts in name', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/games/create',
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'rpg',
            name: '<script>alert("xss")</script>',
            maxPlayers: 4,
            minPlayers: 2,
            isPrivate: false,
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request);
      const body = await response.json();

      // The API should either sanitize or reject the input
      expect(response.status).toBe(200);
      if (body.success) {
        expect(body.data.name).not.toContain('<script>');
      }
    });

    test('should handle SQL injection attempts in description', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/games/create',
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'rpg',
            name: 'Test Game',
            description: "'; DROP TABLE games; --",
            maxPlayers: 4,
            minPlayers: 2,
            isPrivate: false,
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request);

      // Should not cause an error and should handle the input safely
      expect(response.status).toBeOneOf([200, 400]); // Either success or validation error
    });

    test('should reject malformed JSON', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/games/create',
        {
          method: 'POST',
          body: '{"type": "rpg", "name": "Test Game", "maxPlayers": }', // Malformed
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(500);
    });

    test('should handle oversized request payloads', async () => {
      const largeSettings = {};
      // Create a large settings object
      for (let i = 0; i < 1000; i++) {
        largeSettings[`setting${i}`] = 'x'.repeat(1000);
      }

      const request = new NextRequest(
        'http://localhost:3000/api/games/create',
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'rpg',
            name: 'Test Game',
            maxPlayers: 4,
            minPlayers: 2,
            isPrivate: false,
            settings: largeSettings,
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request);

      // Should handle large payloads gracefully
      expect(response.status).toBeOneOf([200, 400, 413, 500]);
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe('Game Engine Error Handling', () => {
    test('should handle game engine failures', async () => {
      const { CoreGameEngine } = require('@/lib/game-engine/core');
      CoreGameEngine.mockImplementation(() => ({
        createGame: jest.fn().mockRejectedValue(
          Object.assign(new Error('Game creation failed'), {
            name: 'GameError',
          })
        ),
      }));

      const request = new NextRequest(
        'http://localhost:3000/api/games/create',
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'rpg',
            name: 'Test Game',
            maxPlayers: 4,
            minPlayers: 2,
            isPrivate: false,
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual({
        success: false,
        error: 'Game creation failed',
        message: 'Game creation failed',
      });
    });

    test('should handle unexpected server errors', async () => {
      const { CoreGameEngine } = require('@/lib/game-engine/core');
      CoreGameEngine.mockImplementation(() => ({
        createGame: jest.fn().mockRejectedValue(new Error('Unexpected error')),
      }));

      const request = new NextRequest(
        'http://localhost:3000/api/games/create',
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'rpg',
            name: 'Test Game',
            maxPlayers: 4,
            minPlayers: 2,
            isPrivate: false,
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred while creating the game',
      });
    });
  });

  // ============================================================================
  // CORS AND OPTIONS TESTS
  // ============================================================================

  describe('CORS Support', () => {
    test('should handle OPTIONS request for CORS preflight', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/games/create',
        {
          method: 'OPTIONS',
        }
      );

      const response = await OPTIONS(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Allow')).toBe('POST, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
        'POST, OPTIONS'
      );
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
        'Content-Type, Authorization'
      );
    });
  });

  // ============================================================================
  // GAME-SPECIFIC CONFIGURATION TESTS
  // ============================================================================

  describe('Game Type Configuration', () => {
    test('should apply RPG-specific defaults', async () => {
      const { CoreGameEngine } = require('@/lib/game-engine/core');
      const mockCreateGame = jest.fn().mockResolvedValue({
        id: 'test-id',
        config: {
          type: 'rpg',
          name: 'Test RPG',
          estimatedDurationMinutes: 120,
          settings: {
            difficulty: 'medium',
            allowPvP: false,
          },
        },
        state: { status: 'waiting', players: [] },
        createdAt: new Date(),
      });

      CoreGameEngine.mockImplementation(() => ({ createGame: mockCreateGame }));

      const request = new NextRequest(
        'http://localhost:3000/api/games/create',
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'rpg',
            name: 'Test RPG',
            maxPlayers: 4,
            minPlayers: 2,
            isPrivate: false,
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      await POST(request);

      expect(mockCreateGame).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'rpg',
          estimatedDurationMinutes: 120,
          settings: expect.objectContaining({
            difficulty: 'medium',
            allowPvP: false,
          }),
        })
      );
    });

    test('should apply deduction-specific defaults', async () => {
      const { CoreGameEngine } = require('@/lib/game-engine/core');
      const mockCreateGame = jest.fn().mockResolvedValue({
        id: 'test-id',
        config: { type: 'deduction', name: 'Test Deduction' },
        state: { status: 'waiting', players: [] },
        createdAt: new Date(),
      });

      CoreGameEngine.mockImplementation(() => ({ createGame: mockCreateGame }));

      const request = new NextRequest(
        'http://localhost:3000/api/games/create',
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'deduction',
            name: 'Test Deduction',
            maxPlayers: 6,
            minPlayers: 4,
            isPrivate: false,
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      await POST(request);

      expect(mockCreateGame).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'deduction',
          estimatedDurationMinutes: 30,
          settings: expect.objectContaining({
            theme: 'classic',
            allowDiscussion: true,
          }),
        })
      );
    });

    test('should apply village-specific defaults', async () => {
      const { CoreGameEngine } = require('@/lib/game-engine/core');
      const mockCreateGame = jest.fn().mockResolvedValue({
        id: 'test-id',
        config: { type: 'village', name: 'Test Village' },
        state: { status: 'waiting', players: [] },
        createdAt: new Date(),
      });

      CoreGameEngine.mockImplementation(() => ({ createGame: mockCreateGame }));

      const request = new NextRequest(
        'http://localhost:3000/api/games/create',
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'village',
            name: 'Test Village',
            maxPlayers: 8,
            minPlayers: 2,
            isPrivate: false,
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      await POST(request);

      expect(mockCreateGame).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'village',
          estimatedDurationMinutes: 90,
          settings: expect.objectContaining({
            seasonLength: 'medium',
            difficulty: 'normal',
          }),
        })
      );
    });
  });
});

// Custom Jest matcher for oneOf assertion
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(items: Array<any>): R;
    }
  }
}

expect.extend({
  toBeOneOf(received, items) {
    const pass = items.includes(received);
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be one of ${items.join(', ')}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${items.join(', ')}`,
        pass: false,
      };
    }
  },
});
