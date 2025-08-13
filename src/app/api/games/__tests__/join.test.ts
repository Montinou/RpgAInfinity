/**
 * API Tests for Game Join Endpoint
 *
 * Tests the POST /api/games/[id]/join endpoint for:
 * - Player validation and capacity checks
 * - Game state validation (joinable states)
 * - Game type-specific join rules
 * - Concurrency handling (multiple players joining)
 * - Security measures (duplicate names, invalid players)
 * - Error handling and response consistency
 */

import { NextRequest } from 'next/server';
import { POST, OPTIONS } from '../[id]/join/route';
import { jest } from '@jest/globals';

// Mock UUID generation for consistent testing
jest.mock('uuid', () => ({
  v4: jest.fn(() => '550e8400-e29b-41d4-a716-446655440000'),
}));

// Mock the game engine
const mockLoadState = jest.fn();
const mockSaveState = jest.fn();

jest.mock('@/lib/game-engine/core', () => ({
  CoreGameEngine: jest.fn().mockImplementation(() => ({
    loadState: mockLoadState,
    saveState: mockSaveState,
  })),
}));

describe('POST /api/games/[id]/join', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadState.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440001',
      status: 'waiting',
      players: [],
      maxPlayers: 4,
      resources: { food: 100 }, // Village game indicator
    });
    mockSaveState.mockResolvedValue(undefined);
  });

  // ============================================================================
  // HAPPY PATH TESTS
  // ============================================================================

  describe('Successful Game Joining', () => {
    test('should allow player to join waiting game', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/games/123/join',
        {
          method: 'POST',
          body: JSON.stringify({
            playerName: 'Alice',
            role: 'player',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request, {
        params: { id: '550e8400-e29b-41d4-a716-446655440001' },
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        success: true,
        data: {
          playerId: '550e8400-e29b-41d4-a716-446655440000',
          playerName: 'Alice',
          role: 'player',
          gameType: 'village',
          currentPlayers: 1,
          gameStatus: 'waiting',
        },
        message: 'Successfully joined village game',
      });

      expect(mockSaveState).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440001',
        expect.objectContaining({
          players: expect.arrayContaining([
            expect.objectContaining({
              id: '550e8400-e29b-41d4-a716-446655440000',
              name: 'Alice',
              role: 'player',
              isActive: true,
            }),
          ]),
        })
      );
    });

    test('should allow spectator to join full game', async () => {
      // Mock a full game
      mockLoadState.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        status: 'active',
        players: [
          { id: '1', name: 'Player1', role: 'player' },
          { id: '2', name: 'Player2', role: 'player' },
          { id: '3', name: 'Player3', role: 'player' },
          { id: '4', name: 'Player4', role: 'player' },
        ],
        maxPlayers: 4,
        resources: { food: 100 },
      });

      const request = new NextRequest(
        'http://localhost:3000/api/games/123/join',
        {
          method: 'POST',
          body: JSON.stringify({
            playerName: 'Observer',
            role: 'spectator',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request, {
        params: { id: '550e8400-e29b-41d4-a716-446655440001' },
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.role).toBe('spectator');
    });

    test('should create RPG-specific player data', async () => {
      mockLoadState.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        status: 'waiting',
        players: [],
        maxPlayers: 4,
        world: {}, // RPG game indicator
      });

      const request = new NextRequest(
        'http://localhost:3000/api/games/123/join',
        {
          method: 'POST',
          body: JSON.stringify({
            playerName: 'Warrior',
            role: 'player',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request, {
        params: { id: '550e8400-e29b-41d4-a716-446655440001' },
      });

      expect(response.status).toBe(200);
      expect(mockSaveState).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440001',
        expect.objectContaining({
          players: expect.arrayContaining([
            expect.objectContaining({
              name: 'Warrior',
              character: expect.objectContaining({
                level: 1,
                health: 100,
                mana: 50,
              }),
              inventory: expect.any(Array),
              position: { x: 0, y: 0 },
            }),
          ]),
        })
      );
    });

    test('should create deduction-specific player data', async () => {
      mockLoadState.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        status: 'waiting',
        players: [],
        maxPlayers: 6,
        roles: [], // Deduction game indicator
      });

      const request = new NextRequest(
        'http://localhost:3000/api/games/123/join',
        {
          method: 'POST',
          body: JSON.stringify({
            playerName: 'Detective',
            role: 'player',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request, {
        params: { id: '550e8400-e29b-41d4-a716-446655440001' },
      });

      expect(response.status).toBe(200);
      expect(mockSaveState).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440001',
        expect.objectContaining({
          players: expect.arrayContaining([
            expect.objectContaining({
              name: 'Detective',
              roleAssigned: null,
              isAlive: true,
              votesReceived: 0,
            }),
          ]),
        })
      );
    });

    test('should use existing player ID if provided', async () => {
      const existingPlayerId = '550e8400-e29b-41d4-a716-446655440099';

      const request = new NextRequest(
        'http://localhost:3000/api/games/123/join',
        {
          method: 'POST',
          body: JSON.stringify({
            playerName: 'ReturningPlayer',
            playerId: existingPlayerId,
            role: 'player',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request, {
        params: { id: '550e8400-e29b-41d4-a716-446655440001' },
      });

      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.data.playerId).toBe(existingPlayerId);
    });
  });

  // ============================================================================
  // VALIDATION ERROR TESTS
  // ============================================================================

  describe('Join Validation', () => {
    test('should reject join for non-existent game', async () => {
      mockLoadState.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/games/123/join',
        {
          method: 'POST',
          body: JSON.stringify({
            playerName: 'Alice',
            role: 'player',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request, {
        params: { id: '550e8400-e29b-41d4-a716-446655440001' },
      });
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body).toEqual({
        success: false,
        error: 'Game not found',
        message: 'No game found with ID: 550e8400-e29b-41d4-a716-446655440001',
      });
    });

    test('should reject join for completed game', async () => {
      mockLoadState.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        status: 'completed',
        players: [],
        maxPlayers: 4,
      });

      const request = new NextRequest(
        'http://localhost:3000/api/games/123/join',
        {
          method: 'POST',
          body: JSON.stringify({
            playerName: 'Alice',
            role: 'player',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request, {
        params: { id: '550e8400-e29b-41d4-a716-446655440001' },
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual({
        success: false,
        error: 'Cannot join game',
        message: 'Cannot join completed game',
      });
    });

    test('should reject player when game is full', async () => {
      mockLoadState.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        status: 'waiting',
        players: [
          { id: '1', name: 'Player1', role: 'player' },
          { id: '2', name: 'Player2', role: 'player' },
          { id: '3', name: 'Player3', role: 'player' },
          { id: '4', name: 'Player4', role: 'player' },
        ],
        maxPlayers: 4,
      });

      const request = new NextRequest(
        'http://localhost:3000/api/games/123/join',
        {
          method: 'POST',
          body: JSON.stringify({
            playerName: 'Alice',
            role: 'player',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request, {
        params: { id: '550e8400-e29b-41d4-a716-446655440001' },
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual({
        success: false,
        error: 'Cannot join game',
        message: 'Game is full',
      });
    });

    test('should reject duplicate player by ID', async () => {
      const existingPlayerId = '550e8400-e29b-41d4-a716-446655440099';
      mockLoadState.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        status: 'waiting',
        players: [
          { id: existingPlayerId, name: 'ExistingPlayer', role: 'player' },
        ],
        maxPlayers: 4,
      });

      const request = new NextRequest(
        'http://localhost:3000/api/games/123/join',
        {
          method: 'POST',
          body: JSON.stringify({
            playerName: 'DifferentName',
            playerId: existingPlayerId,
            role: 'player',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request, {
        params: { id: '550e8400-e29b-41d4-a716-446655440001' },
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual({
        success: false,
        error: 'Cannot join game',
        message: 'Player already in game',
      });
    });

    test('should reject duplicate player by name', async () => {
      mockLoadState.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        status: 'waiting',
        players: [{ id: 'different-id', name: 'Alice', role: 'player' }],
        maxPlayers: 4,
      });

      const request = new NextRequest(
        'http://localhost:3000/api/games/123/join',
        {
          method: 'POST',
          body: JSON.stringify({
            playerName: 'Alice',
            role: 'player',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request, {
        params: { id: '550e8400-e29b-41d4-a716-446655440001' },
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.message).toBe('Player already in game');
    });

    test('should reject joining active deduction game', async () => {
      mockLoadState.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        status: 'active',
        players: [],
        maxPlayers: 6,
        roles: [], // Deduction game indicator
      });

      const request = new NextRequest(
        'http://localhost:3000/api/games/123/join',
        {
          method: 'POST',
          body: JSON.stringify({
            playerName: 'Alice',
            role: 'player',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request, {
        params: { id: '550e8400-e29b-41d4-a716-446655440001' },
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual({
        success: false,
        error: 'Cannot join game',
        message: 'Cannot join active deduction game',
      });
    });
  });

  // ============================================================================
  // INPUT VALIDATION TESTS
  // ============================================================================

  describe('Request Validation', () => {
    test('should reject empty player name', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/games/123/join',
        {
          method: 'POST',
          body: JSON.stringify({
            playerName: '',
            role: 'player',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request, {
        params: { id: '550e8400-e29b-41d4-a716-446655440001' },
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Invalid join request');
      expect(body.details).toContainEqual(
        expect.objectContaining({
          field: 'playerName',
          message: expect.stringContaining(
            'String must contain at least 1 character'
          ),
        })
      );
    });

    test('should reject player name longer than 50 characters', async () => {
      const longName = 'a'.repeat(51);
      const request = new NextRequest(
        'http://localhost:3000/api/games/123/join',
        {
          method: 'POST',
          body: JSON.stringify({
            playerName: longName,
            role: 'player',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request, {
        params: { id: '550e8400-e29b-41d4-a716-446655440001' },
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.details).toContainEqual(
        expect.objectContaining({
          field: 'playerName',
          message: expect.stringContaining(
            'String must contain at most 50 character'
          ),
        })
      );
    });

    test('should reject invalid player role', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/games/123/join',
        {
          method: 'POST',
          body: JSON.stringify({
            playerName: 'Alice',
            role: 'admin', // Invalid role
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request, {
        params: { id: '550e8400-e29b-41d4-a716-446655440001' },
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.details).toContainEqual(
        expect.objectContaining({
          field: 'role',
          message: expect.stringContaining('Invalid enum value'),
        })
      );
    });

    test('should reject invalid UUID for player ID', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/games/123/join',
        {
          method: 'POST',
          body: JSON.stringify({
            playerName: 'Alice',
            playerId: 'invalid-uuid',
            role: 'player',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request, {
        params: { id: '550e8400-e29b-41d4-a716-446655440001' },
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.details).toContainEqual(
        expect.objectContaining({
          field: 'playerId',
          message: expect.stringContaining('Invalid uuid'),
        })
      );
    });

    test('should reject invalid UUID for game ID', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/games/123/join',
        {
          method: 'POST',
          body: JSON.stringify({
            playerName: 'Alice',
            role: 'player',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request, {
        params: { id: 'invalid-uuid' },
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
    });
  });

  // ============================================================================
  // SECURITY TESTS
  // ============================================================================

  describe('Security Validation', () => {
    test('should sanitize XSS attempts in player name', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/games/123/join',
        {
          method: 'POST',
          body: JSON.stringify({
            playerName: '<script>alert("xss")</script>',
            role: 'player',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request, {
        params: { id: '550e8400-e29b-41d4-a716-446655440001' },
      });

      // Should either sanitize or reject the input
      expect(response.status).toBeOneOf([200, 400]);

      if (response.status === 200) {
        const body = await response.json();
        expect(body.data.playerName).not.toContain('<script>');
      }
    });

    test('should handle SQL injection attempts', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/games/123/join',
        {
          method: 'POST',
          body: JSON.stringify({
            playerName: "'; DROP TABLE players; --",
            role: 'player',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request, {
        params: { id: '550e8400-e29b-41d4-a716-446655440001' },
      });

      // Should not cause an error and should handle safely
      expect(response.status).toBeOneOf([200, 400]);
    });

    test('should handle malformed JSON gracefully', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/games/123/join',
        {
          method: 'POST',
          body: '{"playerName": "Alice", "role": }', // Malformed JSON
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request, {
        params: { id: '550e8400-e29b-41d4-a716-446655440001' },
      });

      expect(response.status).toBe(500);
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe('Error Handling', () => {
    test('should handle game engine errors', async () => {
      mockLoadState.mockRejectedValue(
        Object.assign(new Error('Engine failure'), { name: 'GameError' })
      );

      const request = new NextRequest(
        'http://localhost:3000/api/games/123/join',
        {
          method: 'POST',
          body: JSON.stringify({
            playerName: 'Alice',
            role: 'player',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request, {
        params: { id: '550e8400-e29b-41d4-a716-446655440001' },
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body).toEqual({
        success: false,
        error: 'Join failed',
        message: 'Engine failure',
      });
    });

    test('should handle concurrency conflicts', async () => {
      mockSaveState.mockRejectedValue(
        new Error('concurrent modification detected')
      );

      const request = new NextRequest(
        'http://localhost:3000/api/games/123/join',
        {
          method: 'POST',
          body: JSON.stringify({
            playerName: 'Alice',
            role: 'player',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request, {
        params: { id: '550e8400-e29b-41d4-a716-446655440001' },
      });
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body).toEqual({
        success: false,
        error: 'Join conflict',
        message: 'Another player joined at the same time, please try again',
      });
    });

    test('should handle unexpected server errors', async () => {
      mockLoadState.mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest(
        'http://localhost:3000/api/games/123/join',
        {
          method: 'POST',
          body: JSON.stringify({
            playerName: 'Alice',
            role: 'player',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request, {
        params: { id: '550e8400-e29b-41d4-a716-446655440001' },
      });
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred while joining the game',
      });
    });
  });

  // ============================================================================
  // CORS TESTS
  // ============================================================================

  describe('CORS Support', () => {
    test('should handle OPTIONS request for CORS preflight', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/games/123/join',
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
  // GAME TYPE SPECIFIC TESTS
  // ============================================================================

  describe('Game Type Detection and Handling', () => {
    test('should detect RPG game correctly', async () => {
      mockLoadState.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        status: 'waiting',
        players: [],
        maxPlayers: 4,
        world: { size: 'large' },
        combat: { mode: 'turnBased' },
      });

      const request = new NextRequest(
        'http://localhost:3000/api/games/123/join',
        {
          method: 'POST',
          body: JSON.stringify({
            playerName: 'Hero',
            role: 'player',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request, {
        params: { id: '550e8400-e29b-41d4-a716-446655440001' },
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.gameType).toBe('rpg');
      expect(body.message).toBe('Successfully joined rpg game');
    });

    test('should detect deduction game correctly', async () => {
      mockLoadState.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        status: 'waiting',
        players: [],
        maxPlayers: 6,
        voting: { phase: 'discussion' },
        roles: ['detective', 'suspect'],
      });

      const request = new NextRequest(
        'http://localhost:3000/api/games/123/join',
        {
          method: 'POST',
          body: JSON.stringify({
            playerName: 'Investigator',
            role: 'player',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request, {
        params: { id: '550e8400-e29b-41d4-a716-446655440001' },
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.gameType).toBe('deduction');
    });

    test('should detect village game correctly', async () => {
      mockLoadState.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        status: 'waiting',
        players: [],
        maxPlayers: 8,
        resources: { food: 100, wood: 50 },
        season: { current: 'spring' },
      });

      const request = new NextRequest(
        'http://localhost:3000/api/games/123/join',
        {
          method: 'POST',
          body: JSON.stringify({
            playerName: 'Villager',
            role: 'player',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request, {
        params: { id: '550e8400-e29b-41d4-a716-446655440001' },
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.gameType).toBe('village');
    });

    test('should handle unknown game type', async () => {
      mockLoadState.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440001',
        status: 'waiting',
        players: [],
        maxPlayers: 4,
        // No specific game type indicators
      });

      const request = new NextRequest(
        'http://localhost:3000/api/games/123/join',
        {
          method: 'POST',
          body: JSON.stringify({
            playerName: 'Player',
            role: 'player',
          }),
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const response = await POST(request, {
        params: { id: '550e8400-e29b-41d4-a716-446655440001' },
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.gameType).toBe('unknown');
    });
  });
});

// Custom Jest matcher
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
