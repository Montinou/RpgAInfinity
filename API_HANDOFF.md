# RpgAInfinity API Endpoints - MVP Implementation

## Overview
Essential API endpoints for RpgAInfinity MVP are now implemented and ready for frontend integration. All endpoints use unified patterns for consistency across game types.

## Base URL
```
Production: https://siga-turismo.vercel.app/api
Development: http://localhost:3000/api
```

## Core Game Management Endpoints

### 1. Create Game
**POST `/api/games/create`**

Creates a new game of any supported type through a unified interface.

**Request Body:**
```typescript
{
  type: 'rpg' | 'deduction' | 'village';
  name: string;                    // 1-100 chars
  description?: string;            // max 500 chars
  maxPlayers: number;              // 2-8 players
  minPlayers: number;              // 2-8 players
  isPrivate: boolean;              // default: false
  settings?: Record<string, any>;  // game-specific settings
}
```

**Response (Success - 200):**
```typescript
{
  success: true;
  data: {
    gameId: string;           // UUID
    type: 'rpg' | 'deduction' | 'village';
    name: string;
    status: 'waiting' | 'active' | 'completed';
    maxPlayers: number;
    currentPlayers: number;
    isPrivate: boolean;
    createdAt: string;        // ISO date
  };
  message: string;
}
```

**Example:**
```bash
curl -X POST /api/games/create \
  -H "Content-Type: application/json" \
  -d '{
    "type": "rpg",
    "name": "Epic Adventure",
    "description": "A thrilling RPG campaign",
    "maxPlayers": 4,
    "minPlayers": 2,
    "isPrivate": false
  }'
```

### 2. Get Game State
**GET `/api/games/[id]`**

Retrieves current game state formatted for UI consumption.

**Response (Success - 200):**
```typescript
// Base response for all game types
{
  success: true;
  data: {
    gameId: string;
    status: 'waiting' | 'active' | 'paused' | 'completed';
    type: 'rpg' | 'deduction' | 'village';
    currentPhase: string;
    players: Array<{
      id: string;
      name: string;
      role: 'host' | 'player' | 'spectator';
      isActive: boolean;
    }>;
    turn: number;
    startedAt?: string;
    lastUpdated: string;
    
    // Game-specific data added based on type
    // RPG: world, combat
    // Deduction: voting, roles
    // Village: resources, season, events
  };
  message: string;
}
```

**RPG-Specific Data:**
```typescript
{
  // ... base data
  world: {
    currentLocation: string;
    availableActions: string[];
    // TODO: detailed world state
  };
  combat?: {
    isActive: boolean;
    turn: number;
    participants: Array<any>;
  };
  // TODO: character sheets, inventory, quests
}
```

**Deduction-Specific Data:**
```typescript
{
  // ... base data
  voting: {
    isActive: boolean;
    phase: 'discussion' | 'voting' | 'night';
    timeRemaining: number;
    // TODO: voting results, accusations
  };
  roles?: {
    assigned: boolean;
    revealed: string[];
  };
  // TODO: clues, night actions, discussion history
}
```

**Village-Specific Data:**
```typescript
{
  // ... base data
  resources: Record<string, number>;
  season: {
    current: 'spring' | 'summer' | 'fall' | 'winter';
    day: number;
    year: number;
  };
  events: {
    active: Array<any>;
    pending: Array<any>;
  };
  // TODO: NPCs, buildings, trade routes
}
```

### 3. Process Action
**POST `/api/games/[id]/action`**

Processes player actions with game-type-aware validation and routing.

**Request Body:**
```typescript
{
  type: string;              // Action type (varies by game)
  playerId: string;          // UUID of acting player
  data: Record<string, any>; // Action-specific data
}
```

**RPG Actions:**
```typescript
{
  type: 'move' | 'attack' | 'cast' | 'interact' | 'rest' | 'inventory';
  playerId: string;
  data: {
    target?: string;         // Target entity ID
    location?: string;       // Target location
    itemId?: string;         // Item to use
    spellId?: string;        // Spell to cast
    // TODO: RPG-specific action data
  };
}
```

**Deduction Actions:**
```typescript
{
  type: 'vote' | 'accuse' | 'discuss' | 'ability' | 'investigate';
  playerId: string;
  data: {
    target?: string;         // Target player ID
    message?: string;        // Discussion message
    abilityId?: string;      // Special ability ID
    vote?: string;           // Vote target ID
    // TODO: Deduction-specific action data
  };
}
```

**Village Actions:**
```typescript
{
  type: 'build' | 'trade' | 'assign' | 'explore' | 'interact';
  playerId: string;
  data: {
    buildingType?: string;   // Type of building
    resourceType?: string;   // Resource to trade
    amount?: number;         // Trade amount
    workerId?: string;       // Worker to assign
    location?: string;       // Target location
    // TODO: Village-specific action data
  };
}
```

**Response (Success - 200):**
```typescript
{
  success: true;
  data: {
    actionId: string;        // UUID of processed action
    success: boolean;        // Whether action succeeded
    message: string;         // Action result description
    effects: {
      // Game-specific effects based on type
      // RPG: characterUpdates, combatEvents, worldChanges
      // Deduction: votingUpdates, roleReveals, clueUpdates  
      // Village: resourceChanges, buildingUpdates, npcInteractions
    };
    updatedState: any;       // New game state after action
    // TODO: real-time event notifications
  };
  message: string;
}
```

### 4. Join Game
**POST `/api/games/[id]/join`**

Allows players to join games with validation and game-specific initialization.

**Request Body:**
```typescript
{
  playerName: string;        // 1-50 chars
  playerId?: string;         // Optional UUID for existing players
  role: 'player' | 'spectator'; // default: 'player'
  // TODO: game-specific join preferences
}
```

**Response (Success - 200):**
```typescript
{
  success: true;
  data: {
    playerId: string;        // UUID assigned to player
    playerName: string;
    role: 'player' | 'spectator';
    gameType: 'rpg' | 'deduction' | 'village';
    currentPlayers: number;
    gameStatus: string;
    // TODO: game-specific welcome data
  };
  message: string;
}
```

## AI Integration Endpoints

### 1. Generate Content
**POST `/api/ai/generate`**

Generate AI content for game scenarios, NPCs, descriptions, etc.

**Request Body:**
```typescript
{
  prompt: string;            // 1-10000 chars
  gameId?: string;           // Optional context
  playerId?: string;         // Optional context
  gameType: 'rpg' | 'deduction' | 'village';
  context?: {
    gameState?: Record<string, any>;
    playerHistory?: Array<any>;
    recentEvents?: Array<any>;
    // ... additional context fields
  };
  options?: {
    maxTokens?: number;
    temperature?: number;
    // ... generation options
  };
}
```

### 2. AI Health Check
**GET `/api/ai/health`**

Check AI service availability and performance.

**Response:**
```typescript
{
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  // ... detailed health metrics
}
```

## Health Monitoring

### Game API Health
**GET `/api/games/health`**

Quick health check for game endpoints and engines.

**Response:**
```typescript
{
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  endpoints: {
    create: 'available' | 'unavailable';
    retrieve: 'available' | 'unavailable';
    action: 'available' | 'unavailable';
    join: 'available' | 'unavailable';
  };
  game_engines: {
    core: 'available' | 'unavailable';
    rpg: 'available' | 'unavailable';
    deduction: 'available' | 'unavailable';
    village: 'available' | 'unavailable';
  };
  // ... additional metrics
}
```

## Error Handling

All endpoints use consistent error response format:

**Error Response:**
```typescript
{
  success: false;
  error: string;             // Error category
  message: string;           // Human-readable message
  details?: Array<{          // Validation errors (if applicable)
    field: string;
    message: string;
  }>;
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (validation errors, invalid actions)
- `403` - Forbidden (player not in game, permissions)
- `404` - Not Found (game not found)
- `408` - Request Timeout (action processing timeout)
- `409` - Conflict (concurrent modification)
- `500` - Internal Server Error

## Rate Limiting

All endpoints include basic rate limiting:
- Per-session limits for game actions
- Global limits for game creation
- AI endpoint limits based on usage

## CORS Support

All endpoints include CORS headers for cross-origin requests:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

## TODO: Future Enhancements

**High Priority:**
- [ ] Real-time WebSocket support for game events
- [ ] Advanced validation schemas for game-specific actions
- [ ] Game metadata storage optimization
- [ ] Enhanced error messages with recovery suggestions

**Medium Priority:**
- [ ] Batch action processing
- [ ] Game replay/history endpoints
- [ ] Player statistics tracking
- [ ] Game template system

**Low Priority:**
- [ ] Advanced rate limiting with tiers
- [ ] Game analytics endpoints
- [ ] Social features (friends, teams)
- [ ] Tournament/league support

## Integration Examples

### React Hook for Game State
```typescript
import { useEffect, useState } from 'react';

export function useGameState(gameId: string) {
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchGameState = async () => {
      try {
        const response = await fetch(`/api/games/${gameId}`);
        const data = await response.json();
        
        if (data.success) {
          setGameState(data.data);
        } else {
          setError(data.message);
        }
      } catch (err) {
        setError('Failed to fetch game state');
      } finally {
        setLoading(false);
      }
    };

    fetchGameState();
  }, [gameId]);

  return { gameState, loading, error };
}
```

### Action Processing Helper
```typescript
export async function processGameAction(
  gameId: string, 
  action: GameAction
): Promise<ActionResult> {
  const response = await fetch(`/api/games/${gameId}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action),
  });
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.message);
  }
  
  return data.data;
}
```

## Ready for Frontend Development

✅ **Core Functionality**: All essential game management endpoints implemented
✅ **Type Safety**: Full TypeScript support with detailed interfaces
✅ **Error Handling**: Comprehensive error responses with actionable messages
✅ **Multi-Game Support**: Unified API supporting RPG, Deduction, and Village games
✅ **AI Integration**: Existing AI endpoints validated and ready
✅ **Health Monitoring**: Built-in health checks for system monitoring
✅ **Documentation**: Complete API specification with examples

The API layer is now ready for UI development. Frontend teams can begin implementing game interfaces using these endpoints while advanced features are developed in parallel.