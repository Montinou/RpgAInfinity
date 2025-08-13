# 🔌 API Reference - RpgAInfinity

## 📍 Base URL

```
Production: https://rpgainfinity.vercel.app/api
Development: http://localhost:3000/api
```

## 🔐 Authentication

Todos los endpoints requieren autenticación via Bearer token:

```typescript
headers: {
  'Authorization': 'Bearer YOUR_API_TOKEN',
  'Content-Type': 'application/json'
}
```

## 📊 Rate Limiting

- **General**: 60 requests/minute
- **AI Generation**: 100 requests/hour
- **Game Creation**: 20 requests/hour

## 🎮 Game Endpoints

### Create Game Session

`POST /api/game/create`

Crea una nueva sesión de juego.

**Request Body:**
```json
{
  "gameType": "rpg" | "deduction" | "village",
  "players": [
    {
      "id": "string",
      "name": "string"
    }
  ],
  "settings": {
    "difficulty": "easy" | "normal" | "hard",
    "theme": "string",
    "duration": "number (minutes)"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "gameType": "string",
    "players": "array",
    "world": "object",
    "characters": "array",
    "startTime": "ISO 8601"
  }
}
```

### Get Game State

`GET /api/game/:sessionId`

Obtiene el estado actual del juego.

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "string",
    "state": "setup" | "playing" | "voting" | "ended",
    "currentTurn": "number",
    "currentDay": "number",
    "players": "array",
    "events": "array",
    "resources": "object"
  }
}
```

### Process Action

`POST /api/game/:sessionId/action`

Procesa una acción del jugador.

**Request Body:**
```json
{
  "playerId": "string",
  "action": {
    "type": "string",
    "target": "string (optional)",
    "parameters": "object (optional)"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "result": "success" | "partial" | "failure",
    "narrative": "string",
    "consequences": "object",
    "newState": "object",
    "rewards": "object"
  }
}
```

### End Game

`POST /api/game/:sessionId/end`

Finaliza una sesión de juego.

**Response:**
```json
{
  "success": true,
  "data": {
    "finalScore": "number",
    "winner": "string",
    "statistics": "object",
    "achievements": "array"
  }
}
```

## 🤖 AI Generation Endpoints

### Generate World

`POST /api/ai/generate/world`

Genera un mundo único para el juego.

**Request Body:**
```json
{
  "theme": "fantasy" | "scifi" | "horror" | "pirate" | "medieval",
  "complexity": "simple" | "moderate" | "complex",
  "customPrompt": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "string",
    "description": "string",
    "history": "string",
    "locations": "array",
    "factions": "array",
    "conflicts": "array",
    "secrets": "array"
  }
}
```

### Generate Character

`POST /api/ai/generate/character`

Genera un personaje único.

**Request Body:**
```json
{
  "playerName": "string",
  "class": "string",
  "worldContext": "object",
  "personality": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "string",
    "class": "string",
    "background": "string",
    "personality": "string",
    "abilities": "array",
    "stats": "object",
    "inventory": "object",
    "secrets": "array"
  }
}
```

### Generate Event

`POST /api/ai/generate/event`

Genera un evento narrativo.

**Request Body:**
```json
{
  "sessionId": "string",
  "context": {
    "world": "object",
    "characters": "array",
    "previousEvents": "array",
    "currentLocation": "string"
  },
  "eventType": "combat" | "social" | "exploration" | "mystery"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "title": "string",
    "description": "string",
    "choices": "array",
    "consequences": "object",
    "clues": "array"
  }
}
```

### Generate Narrative

`POST /api/ai/generate/narrative`

Genera texto narrativo contextual.

**Request Body:**
```json
{
  "prompt": "string",
  "context": "object",
  "style": "epic" | "mysterious" | "comedic" | "dark",
  "maxLength": "number"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "narrative": "string",
    "tokens": "number",
    "model": "string"
  }
}
```

## 👥 Player Endpoints

### Get Player Profile

`GET /api/player/:playerId`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "name": "string",
    "avatar": "string",
    "stats": {
      "gamesPlayed": "number",
      "wins": "number",
      "favoriteGame": "string",
      "totalPlayTime": "number"
    },
    "achievements": "array",
    "recentGames": "array"
  }
}
```

### Update Player

`PATCH /api/player/:playerId`

**Request Body:**
```json
{
  "name": "string",
  "avatar": "string",
  "preferences": "object"
}
```

## 📈 Analytics Endpoints

### Game Analytics

`GET /api/analytics/game/:sessionId`

**Response:**
```json
{
  "success": true,
  "data": {
    "duration": "number",
    "turns": "number",
    "decisions": "array",
    "playerEngagement": "object",
    "narrativeFlow": "object"
  }
}
```

### Player Analytics

`GET /api/analytics/player/:playerId`

**Response:**
```json
{
  "success": true,
  "data": {
    "playtime": "number",
    "preferences": "object",
    "performance": "object",
    "socialMetrics": "object"
  }
}
```

## 🔄 WebSocket Events

### Connection

```javascript
const socket = io('wss://rpgainfinity.vercel.app', {
  auth: {
    token: 'YOUR_TOKEN'
  }
});
```

### Events

**Client to Server:**
- `join_game`: Join a game session
- `leave_game`: Leave current game
- `player_action`: Send player action
- `chat_message`: Send chat message
- `vote`: Submit vote

**Server to Client:**
- `game_update`: Game state update
- `player_joined`: New player joined
- `player_left`: Player left
- `event_occurred`: New game event
- `turn_changed`: Turn changed
- `game_ended`: Game ended

## 🛡️ Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": "object (optional)"
  }
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `AUTH_REQUIRED` | 401 | Authentication required |
| `AUTH_INVALID` | 401 | Invalid token |
| `FORBIDDEN` | 403 | Access denied |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `RATE_LIMIT` | 429 | Too many requests |
| `AI_ERROR` | 500 | AI generation failed |
| `SERVER_ERROR` | 500 | Internal server error |

## 📝 TypeScript Types

```typescript
// Core Types
interface GameSession {
  id: string;
  type: GameType;
  players: Player[];
  state: GameState;
  world: World;
  createdAt: Date;
  updatedAt: Date;
}

interface Player {
  id: string;
  name: string;
  avatar?: string;
  character?: Character;
  stats: PlayerStats;
}

interface World {
  name: string;
  description: string;
  theme: Theme;
  locations: Location[];
  factions: Faction[];
}

interface Character {
  id: string;
  name: string;
  class: string;
  level: number;
  stats: CharacterStats;
  abilities: Ability[];
  inventory: Inventory;
}

interface GameEvent {
  id: string;
  type: EventType;
  title: string;
  description: string;
  choices: Choice[];
  timestamp: Date;
}

// Enums
enum GameType {
  RPG = 'rpg',
  DEDUCTION = 'deduction',
  VILLAGE = 'village'
}

enum GameState {
  SETUP = 'setup',
  PLAYING = 'playing',
  VOTING = 'voting',
  PAUSED = 'paused',
  ENDED = 'ended'
}

enum EventType {
  COMBAT = 'combat',
  SOCIAL = 'social',
  EXPLORATION = 'exploration',
  MYSTERY = 'mystery',
  RESOURCE = 'resource'
}
```

## 🔧 SDK Example

```typescript
import { RpgAInfinitySDK } from '@rpgainfinity/sdk';

const sdk = new RpgAInfinitySDK({
  apiKey: 'YOUR_API_KEY',
  baseUrl: 'https://rpgainfinity.vercel.app/api'
});

// Create game
const game = await sdk.games.create({
  gameType: 'rpg',
  players: [
    { id: '1', name: 'Alice' },
    { id: '2', name: 'Bob' }
  ],
  settings: {
    difficulty: 'normal',
    theme: 'fantasy',
    duration: 30
  }
});

// Process action
const result = await sdk.games.action(game.sessionId, {
  playerId: '1',
  action: {
    type: 'explore',
    target: 'dark_forest'
  }
});

// Subscribe to updates
sdk.subscribe(game.sessionId, (event) => {
  console.log('Game event:', event);
});
```

## 📚 Pagination

Endpoints que retornan listas soportan paginación:

```
GET /api/endpoint?page=1&limit=20&sort=created_at&order=desc
```

**Response Headers:**
```
X-Total-Count: 100
X-Page-Count: 5
Link: <url>; rel="next", <url>; rel="prev"
```

## 🔍 Filtering & Search

```
GET /api/games?type=rpg&state=playing&theme=fantasy&search=dragon
```

## 📊 Webhooks

Configura webhooks para recibir notificaciones:

```json
{
  "url": "https://your-server.com/webhook",
  "events": ["game.created", "game.ended", "player.achievement"],
  "secret": "your_webhook_secret"
}
```

---

*Para más información, consulta la [documentación completa](https://rpgainfinity.vercel.app/docs)*