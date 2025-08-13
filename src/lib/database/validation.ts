/**
 * Zod Validation Schemas for RpgAInfinity Data Types
 *
 * Provides runtime validation for all game data structures
 * Ensures data integrity and type safety for API endpoints and database operations
 */

import { z } from 'zod';
import type { GameType, PlayerRole, ActionType, GameStatus } from '@/types';

// ============================================================================
// BASE VALIDATION SCHEMAS
// ============================================================================

// Common validation patterns
const UUIDSchema = z.string().uuid();
const EmailSchema = z.string().email();
const DateStringSchema = z.string().datetime(); // ISO 8601 format
const PercentageSchema = z.number().min(0).max(100);
const RatingSchema = z.number().min(-100).max(100);

// Game-specific enums
const GameTypeSchema = z.enum(['rpg', 'deduction', 'village'] as const);
const GameStatusSchema = z.enum([
  'waiting',
  'active',
  'paused',
  'completed',
  'abandoned',
] as const);
const PlayerRoleSchema = z.enum(['host', 'player', 'spectator'] as const);
const ActionTypeSchema = z.enum([
  'move',
  'attack',
  'interact',
  'cast',
  'vote',
  'build',
  'trade',
] as const);

// ============================================================================
// CORE GAME SCHEMAS
// ============================================================================

export const PlayerStatsSchema = z.object({
  gamesPlayed: z.number().int().min(0),
  gamesWon: z.number().int().min(0),
  totalPlayTime: z.number().int().min(0),
  favoriteGameType: GameTypeSchema,
  achievements: z.array(z.string()),
});

export const PlayerPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']),
  language: z.enum(['en', 'es', 'fr']),
  soundEnabled: z.boolean(),
  animationsEnabled: z.boolean(),
  autoJoinEnabled: z.boolean(),
});

export const PlayerSchema = z.object({
  id: UUIDSchema,
  name: z.string().min(1).max(50),
  email: EmailSchema.optional(),
  avatar: z.string().url().optional(),
  createdAt: DateStringSchema,
  lastActive: DateStringSchema,
  stats: PlayerStatsSchema,
  preferences: PlayerPreferencesSchema,
  currentGameId: UUIDSchema.optional(),
  currentSessionId: UUIDSchema.optional(),
  isOnline: z.boolean(),
});

export const SessionPlayerSchema = z.object({
  playerId: UUIDSchema,
  role: PlayerRoleSchema,
  joinedAt: DateStringSchema,
  isReady: z.boolean(),
  isConnected: z.boolean(),
  lastAction: DateStringSchema.optional(),
});

export const GameEventSchema = z.object({
  id: UUIDSchema,
  sessionId: UUIDSchema,
  playerId: UUIDSchema,
  type: ActionTypeSchema,
  timestamp: DateStringSchema,
  data: z.record(z.any()),
  result: z.record(z.any()).optional(),
});

export const GameConfigSchema = z.object({
  difficulty: z.enum(['easy', 'normal', 'hard']),
  timeLimit: z.number().int().positive().optional(),
  customRules: z.record(z.any()).optional(),
  seed: z.string().optional(),
});

export const GameStateSchema = z.object({
  turn: z.number().int().min(0),
  phase: z.string(),
  currentPlayerId: UUIDSchema.optional(),
  timeRemaining: z.number().int().min(0).optional(),
  metadata: z.record(z.any()),
});

export const GameSessionSchema = z.object({
  id: UUIDSchema,
  gameType: GameTypeSchema,
  status: GameStatusSchema,
  hostId: UUIDSchema,
  players: z.array(SessionPlayerSchema),
  maxPlayers: z.number().int().min(1).max(20),
  minPlayers: z.number().int().min(1).max(20),
  createdAt: DateStringSchema,
  startedAt: DateStringSchema.optional(),
  updatedAt: DateStringSchema,
  endedAt: DateStringSchema.optional(),
  config: GameConfigSchema,
  currentState: GameStateSchema,
  eventHistory: z.array(GameEventSchema),
  expiresAt: DateStringSchema,
});

// ============================================================================
// AI INTEGRATION SCHEMAS
// ============================================================================

export const AIGenerationRequestSchema = z.object({
  type: z.enum(['world', 'character', 'narrative', 'dialogue', 'event']),
  prompt: z.string().min(1).max(5000),
  context: z.record(z.any()).optional(),
  gameType: GameTypeSchema,
  sessionId: UUIDSchema.optional(),
  playerId: UUIDSchema.optional(),
});

export const AIGenerationResponseSchema = z.object({
  id: UUIDSchema,
  type: z.string(),
  content: z.string(),
  metadata: z.record(z.any()),
  generatedAt: DateStringSchema,
  tokensUsed: z.number().int().min(0),
});

export const AICacheEntrySchema = z.object({
  hash: z.string(),
  request: AIGenerationRequestSchema,
  response: AIGenerationResponseSchema,
  createdAt: DateStringSchema,
  accessCount: z.number().int().min(0),
  lastAccessed: DateStringSchema,
  expiresAt: DateStringSchema,
});

// ============================================================================
// ASSET MANAGEMENT SCHEMAS
// ============================================================================

export const AssetReferenceSchema = z.object({
  id: UUIDSchema,
  type: z.enum(['image', 'audio', 'data']),
  url: z.string().url(),
  filename: z.string(),
  size: z.number().int().min(0),
  contentType: z.string(),
  uploadedAt: DateStringSchema,
  uploadedBy: UUIDSchema,
  tags: z.array(z.string()),
  gameType: GameTypeSchema.optional(),
  sessionId: UUIDSchema.optional(),
  blobToken: z.string(),
  downloadUrl: z.string().url(),
});

// ============================================================================
// RPG GAME SCHEMAS
// ============================================================================

const RPGClassSchema = z.enum([
  'warrior',
  'mage',
  'rogue',
  'cleric',
  'ranger',
  'bard',
]);
const RPGRaceSchema = z.enum([
  'human',
  'elf',
  'dwarf',
  'halfling',
  'orc',
  'dragonborn',
]);
const RPGAlignmentSchema = z.enum([
  'lawful_good',
  'neutral_good',
  'chaotic_good',
  'lawful_neutral',
  'true_neutral',
  'chaotic_neutral',
  'lawful_evil',
  'neutral_evil',
  'chaotic_evil',
]);

export const RPGStatsSchema = z.object({
  strength: z.number().int().min(1).max(30),
  dexterity: z.number().int().min(1).max(30),
  constitution: z.number().int().min(1).max(30),
  intelligence: z.number().int().min(1).max(30),
  wisdom: z.number().int().min(1).max(30),
  charisma: z.number().int().min(1).max(30),
  hitPoints: z.number().int().min(0),
  manaPoints: z.number().int().min(0),
  armorClass: z.number().int().min(0),
  initiative: z.number(),
});

export const HealthStateSchema = z.object({
  current: z.number().int().min(0),
  maximum: z.number().int().min(1),
  temporary: z.number().int().min(0),
  conditions: z.array(z.string()),
});

export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number().optional(),
  region: z.string(),
  area: z.string(),
});

export const ItemSchema = z.object({
  id: UUIDSchema,
  name: z.string().min(1).max(100),
  type: z.enum(['weapon', 'armor', 'consumable', 'tool', 'treasure', 'quest']),
  rarity: z.enum([
    'common',
    'uncommon',
    'rare',
    'epic',
    'legendary',
    'artifact',
  ]),
  description: z.string(),
  statModifiers: RPGStatsSchema.partial(),
  weight: z.number().min(0),
  value: z.number().min(0),
  durability: z.number().int().min(0).optional(),
  maxDurability: z.number().int().min(0).optional(),
  enchantments: z.array(z.string()).optional(),
  requirements: z
    .array(
      z.object({
        type: z.enum(['level', 'class', 'stat']),
        value: z.union([z.string(), z.number()]),
      })
    )
    .optional(),
});

export const RPGCharacterSchema = z.object({
  id: UUIDSchema,
  playerId: UUIDSchema,
  sessionId: UUIDSchema,
  name: z.string().min(1).max(50),
  class: RPGClassSchema,
  race: RPGRaceSchema,
  alignment: RPGAlignmentSchema,
  level: z.number().int().min(1).max(30),
  experience: z.number().int().min(0),
  stats: RPGStatsSchema,
  skills: z.record(z.number().min(0).max(100)),
  health: HealthStateSchema,
  equipment: z.object({
    mainHand: ItemSchema.optional(),
    offHand: ItemSchema.optional(),
    armor: ItemSchema.optional(),
    helmet: ItemSchema.optional(),
    gloves: ItemSchema.optional(),
    boots: ItemSchema.optional(),
    accessories: z.array(ItemSchema),
  }),
  inventory: z.array(
    z.object({
      item: ItemSchema,
      quantity: z.number().int().min(0),
      equipped: z.boolean(),
    })
  ),
  abilities: z.array(
    z.object({
      id: UUIDSchema,
      name: z.string(),
      description: z.string(),
      type: z.enum(['passive', 'active', 'reaction']),
      cooldown: z.number().int().min(0),
      manaCost: z.number().int().min(0),
      range: z.number().min(0),
    })
  ),
  position: PositionSchema,
  createdAt: DateStringSchema,
  updatedAt: DateStringSchema,
});

export const RPGGameStateSchema = GameStateSchema.extend({
  worldId: UUIDSchema,
  partyLevel: z.number().int().min(1),
  partyExperience: z.number().int().min(0),
  partyGold: z.number().int().min(0),
  currentLocation: z.string(),
  currentQuest: UUIDSchema.optional(),
  inCombat: z.boolean(),
  combatEncounter: UUIDSchema.optional(),
  narrativeContext: z.string(),
  lastNarrativeEvent: DateStringSchema,
  timeOfDay: z.object({
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
    phase: z.enum([
      'dawn',
      'morning',
      'noon',
      'afternoon',
      'dusk',
      'night',
      'midnight',
    ]),
  }),
});

// ============================================================================
// DEDUCTION GAME SCHEMAS
// ============================================================================

const DeductionThemeSchema = z.enum([
  'mafia',
  'werewolf',
  'space_mafia',
  'vampire',
  'spy',
  'custom',
]);
const DeductionPhaseSchema = z.enum([
  'setup',
  'day',
  'discussion',
  'voting',
  'night',
  'action',
  'results',
  'ended',
]);
const AlignmentTypeSchema = z.enum(['town', 'mafia', 'neutral', 'survivor']);

export const DeductionRoleSchema = z.object({
  id: UUIDSchema,
  name: z.string().min(1).max(50),
  alignment: AlignmentTypeSchema,
  theme: DeductionThemeSchema,
  abilities: z.array(
    z.object({
      id: UUIDSchema,
      name: z.string(),
      type: z.enum([
        'kill',
        'investigate',
        'protect',
        'block',
        'redirect',
        'manipulate',
        'inform',
        'vote',
        'passive',
        'trigger',
      ]),
      timing: z.enum([
        'day',
        'night',
        'voting',
        'immediate',
        'passive',
        'death',
      ]),
      usesPerGame: z.number().int().min(-1),
      usesPerPhase: z.number().int().min(-1),
      cooldown: z.number().int().min(0),
      targets: z.enum([
        'player',
        'role',
        'alignment',
        'none',
        'vote',
        'action',
      ]),
      targetCount: z.number().int().min(0),
      canTargetSelf: z.boolean(),
      description: z.string(),
    })
  ),
  winConditions: z.array(
    z.object({
      type: z.enum([
        'eliminate',
        'survive',
        'outnumber',
        'complete_objective',
        'custom',
      ]),
      description: z.string(),
      requirements: z.array(
        z.object({
          type: z.enum([
            'alignment_count',
            'role_count',
            'player_alive',
            'phase_count',
            'action_completed',
          ]),
          operator: z.enum(['=', '!=', '>', '<', '>=', '<=']),
          value: z.union([z.number(), z.string()]),
          alignments: z.array(AlignmentTypeSchema).optional(),
          roles: z.array(z.string()).optional(),
        })
      ),
    })
  ),
  description: z.string(),
  flavorText: z.string(),
  powerLevel: z.number().int().min(1).max(10),
  rarity: z.enum(['common', 'uncommon', 'rare', 'special']),
});

export const VotingSessionSchema = z.object({
  id: UUIDSchema,
  sessionId: UUIDSchema,
  phase: z.number().int().min(0),
  type: z.enum([
    'elimination',
    'no_elimination',
    'policy',
    'leader',
    'ability_target',
  ]),
  purpose: z.string(),
  startTime: DateStringSchema,
  endTime: DateStringSchema,
  duration: z.number().int().min(0),
  votingType: z.enum(['majority', 'plurality', 'elimination', 'ranked']),
  tieBreaker: z.enum([
    'random',
    'no_elimination',
    'all_tied_die',
    'host_decides',
    'previous_vote',
  ]),
  eligibleVoters: z.array(UUIDSchema),
  requiredVotes: z.number().int().min(0),
  votes: z.array(
    z.object({
      id: UUIDSchema,
      voterId: UUIDSchema,
      targetId: UUIDSchema.optional(),
      weight: z.number(),
      timestamp: DateStringSchema,
      isPublic: z.boolean(),
      isChangeable: z.boolean(),
      reasoning: z.string().optional(),
    })
  ),
});

export const DeductionGameStateSchema = GameStateSchema.extend({
  theme: DeductionThemeSchema,
  phase: DeductionPhaseSchema,
  dayNumber: z.number().int().min(0),
  phaseEndTime: DateStringSchema.optional(),
  playerStates: z.array(
    z.object({
      playerId: UUIDSchema,
      roleId: UUIDSchema,
      isAlive: z.boolean(),
      deathPhase: z.number().int().optional(),
      deathCause: z.string().optional(),
      votingPower: z.number().min(0),
      canVote: z.boolean(),
      credibility: RatingSchema,
      influence: PercentageSchema,
    })
  ),
  currentVote: VotingSessionSchema.optional(),
  voteHistory: z.array(VotingSessionSchema),
  deadPlayers: z.array(UUIDSchema),
  gameEnded: z.boolean(),
  winners: z.array(UUIDSchema),
  winCondition: z.string().optional(),
});

// ============================================================================
// VILLAGE SIMULATION SCHEMAS
// ============================================================================

const VillageSizeSchema = z.enum(['hamlet', 'village', 'town', 'city']);
const SeasonTypeSchema = z.enum(['spring', 'summer', 'autumn', 'winter']);
const ResourceTypeSchema = z.enum([
  'food',
  'wood',
  'stone',
  'iron',
  'gold',
  'water',
  'lumber',
  'tools',
  'weapons',
  'cloth',
  'pottery',
  'books',
  'spices',
  'jewelry',
  'art',
  'wine',
  'silk',
  'knowledge',
  'culture',
  'faith',
  'influence',
]);

export const BuildingSchema = z.object({
  id: UUIDSchema,
  name: z.string().min(1).max(100),
  type: z.enum([
    'house',
    'apartment',
    'mansion',
    'inn',
    'farm',
    'mine',
    'lumber_mill',
    'workshop',
    'market',
    'bank',
    'town_hall',
    'courthouse',
    'tax_office',
    'barracks',
    'watchtower',
    'wall',
    'gate',
    'temple',
    'library',
    'school',
    'theater',
    'road',
    'bridge',
    'aqueduct',
    'sewer',
    'warehouse',
    'monument',
    'wonder',
    'ruins',
  ]),
  category: z.enum([
    'residential',
    'economic',
    'military',
    'cultural',
    'infrastructure',
    'administrative',
    'special',
  ]),
  position: z.object({ x: z.number(), y: z.number() }),
  size: z.object({ width: z.number().min(1), height: z.number().min(1) }),
  level: z.number().int().min(1),
  condition: z.enum([
    'perfect',
    'good',
    'fair',
    'poor',
    'dilapidated',
    'ruins',
  ]),
  durability: PercentageSchema,
  lastMaintained: DateStringSchema,
  capacity: z.number().int().min(0),
  efficiency: PercentageSchema,
  requiredWorkers: z.number().int().min(0),
  maxWorkers: z.number().int().min(0),
  constructionCost: z.array(
    z.object({
      resource: ResourceTypeSchema,
      amount: z.number().min(0),
      quality: z.number().min(0).max(100).optional(),
    })
  ),
  constructionTime: z.number().int().min(1),
  isUnderConstruction: z.boolean(),
  constructionProgress: PercentageSchema,
  createdAt: DateStringSchema,
  updatedAt: DateStringSchema,
});

export const ResidentSchema = z.object({
  id: UUIDSchema,
  name: z.string().min(1).max(50),
  age: z.number().int().min(0).max(150),
  gender: z.enum(['male', 'female', 'other']),
  health: PercentageSchema,
  happiness: PercentageSchema,
  education: PercentageSchema,
  profession: z.object({
    id: UUIDSchema,
    name: z.string(),
    category: z.enum([
      'agriculture',
      'crafting',
      'trade',
      'military',
      'administration',
      'education',
      'religion',
      'entertainment',
    ]),
    skillLevel: PercentageSchema,
    income: z.number().min(0),
    prestige: PercentageSchema,
    workloadStress: PercentageSchema,
  }),
  skills: z.array(
    z.object({
      skill: z.enum([
        'farming',
        'crafting',
        'trading',
        'combat',
        'leadership',
        'education',
        'medicine',
        'construction',
        'artistry',
        'diplomacy',
      ]),
      level: PercentageSchema,
      experience: z.number().int().min(0),
      trainedBy: UUIDSchema.optional(),
      lastUsed: DateStringSchema,
    })
  ),
  wealth: z.number().min(0),
  income: z.number(),
  expenses: z.number().min(0),
  reputation: RatingSchema,
  housing: z.object({
    buildingId: UUIDSchema.optional(),
    type: z.enum([
      'owned_house',
      'rented_room',
      'family_home',
      'shared_housing',
      'homeless',
    ]),
    quality: PercentageSchema,
    capacity: z.number().int().min(1),
    occupants: z.array(UUIDSchema),
    rent: z.number().min(0),
    isOwned: z.boolean(),
  }),
  employment: z.object({
    buildingId: UUIDSchema.optional(),
    position: z.string(),
    salary: z.number().min(0),
    satisfaction: PercentageSchema,
    performance: PercentageSchema,
    startDate: DateStringSchema,
    workHours: z.number().min(0).max(24),
  }),
  createdAt: DateStringSchema,
  updatedAt: DateStringSchema,
});

export const VillageEventSchema = z.object({
  id: UUIDSchema,
  name: z.string().min(1).max(100),
  type: z.enum([
    'natural',
    'economic',
    'social',
    'military',
    'technological',
    'political',
    'cultural',
    'supernatural',
  ]),
  severity: z.enum([
    'minor',
    'moderate',
    'major',
    'catastrophic',
    'beneficial',
  ]),
  description: z.string(),
  cause: z.string().optional(),
  startDate: DateStringSchema,
  duration: z.number().int().min(1),
  endDate: DateStringSchema.optional(),
  effects: z.array(
    z.object({
      type: z.enum([
        'resource',
        'population',
        'building',
        'happiness',
        'stability',
      ]),
      target: z.string().optional(),
      modifier: z.number(),
      duration: z.number().int().min(-1),
      description: z.string(),
    })
  ),
  responses: z.array(
    z.object({
      id: UUIDSchema,
      name: z.string(),
      description: z.string(),
      cost: z.array(
        z.object({
          resource: ResourceTypeSchema,
          amount: z.number().min(0),
        })
      ),
      effects: z.array(
        z.object({
          type: z.string(),
          modifier: z.number(),
          description: z.string(),
        })
      ),
      successChance: PercentageSchema,
      implementationTime: z.number().int().min(0),
    })
  ),
  chosenResponse: UUIDSchema.optional(),
  isActive: z.boolean(),
  isResolved: z.boolean(),
  generatedByAI: z.boolean(),
  generationContext: z.record(z.any()).optional(),
});

export const VillageGameStateSchema = GameStateSchema.extend({
  villageId: UUIDSchema,
  gameDay: z.number().int().min(0),
  season: z.object({
    current: SeasonTypeSchema,
    day: z.number().int().min(0),
    totalDays: z.number().int().min(1),
    temperature: z.object({
      min: z.number(),
      max: z.number(),
      average: z.number(),
      comfort: PercentageSchema,
    }),
    rainfall: PercentageSchema,
    growingConditions: PercentageSchema,
    productionModifiers: z.record(ResourceTypeSchema, z.number()),
    happinessModifier: z.number(),
    healthModifier: z.number(),
  }),
  dailyProduction: z.record(ResourceTypeSchema, z.number().min(0)),
  dailyConsumption: z.record(ResourceTypeSchema, z.number().min(0)),
  populationGrowth: z.number(),
  happinessChange: z.number(),
  activeCrises: z.array(UUIDSchema),
});

// ============================================================================
// REQUEST/RESPONSE VALIDATION SCHEMAS
// ============================================================================

// API request schemas for different endpoints
export const CreateSessionRequestSchema = z.object({
  gameType: GameTypeSchema,
  hostId: UUIDSchema,
  maxPlayers: z.number().int().min(2).max(20),
  config: GameConfigSchema,
});

export const JoinSessionRequestSchema = z.object({
  sessionId: UUIDSchema,
  playerId: UUIDSchema,
});

export const GameActionRequestSchema = z.object({
  sessionId: UUIDSchema,
  playerId: UUIDSchema,
  action: ActionTypeSchema,
  data: z.record(z.any()),
  expectedTurn: z.number().int().min(0).optional(),
});

export const AIGenerateRequestSchema = z.object({
  type: z.enum(['world', 'character', 'narrative', 'dialogue', 'event']),
  prompt: z.string().min(1).max(5000),
  context: z.record(z.any()).optional(),
  gameType: GameTypeSchema,
  sessionId: UUIDSchema.optional(),
});

// ============================================================================
// VALIDATION UTILITY FUNCTIONS
// ============================================================================

/**
 * Validate and parse data with detailed error reporting
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): {
  success: boolean;
  data?: T;
  errors?: string[];
} {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(
        err => `${err.path.join('.')}: ${err.message}`
      );
      return { success: false, errors };
    }
    return { success: false, errors: [`Validation failed: ${error}`] };
  }
}

/**
 * Safe validation that returns the original data on failure
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T | null {
  try {
    return schema.parse(data);
  } catch {
    return null;
  }
}

/**
 * Validate partial updates (allows undefined fields)
 */
export function validatePartial<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): {
  success: boolean;
  data?: Partial<T>;
  errors?: string[];
} {
  const partialSchema = schema.partial();
  return validateData(partialSchema, data);
}

/**
 * Validate array of items
 */
export function validateArray<T>(
  schema: z.ZodSchema<T>,
  data: unknown[]
): {
  success: boolean;
  data?: T[];
  errors?: string[];
} {
  const arraySchema = z.array(schema);
  return validateData(arraySchema, data);
}

// ============================================================================
// CUSTOM VALIDATION RULES
// ============================================================================

/**
 * Custom validation for game session constraints
 */
export function validateSessionConstraints(session: any): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check player count constraints
  if (session.players && session.players.length > session.maxPlayers) {
    errors.push(
      `Too many players: ${session.players.length} > ${session.maxPlayers}`
    );
  }

  if (
    session.players &&
    session.players.length < session.minPlayers &&
    session.status === 'active'
  ) {
    errors.push(
      `Not enough players to start: ${session.players.length} < ${session.minPlayers}`
    );
  }

  // Check host is in players list
  if (
    session.players &&
    !session.players.some((p: any) => p.playerId === session.hostId)
  ) {
    errors.push('Host must be in the players list');
  }

  // Validate dates
  if (
    session.startedAt &&
    session.createdAt &&
    new Date(session.startedAt) < new Date(session.createdAt)
  ) {
    errors.push('Start date cannot be before creation date');
  }

  if (
    session.endedAt &&
    session.startedAt &&
    new Date(session.endedAt) < new Date(session.startedAt)
  ) {
    errors.push('End date cannot be before start date');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate RPG character constraints
 */
export function validateRPGCharacterConstraints(character: any): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check level vs experience consistency (simplified formula)
  const expectedLevel = Math.floor(character.experience / 1000) + 1;
  if (Math.abs(character.level - expectedLevel) > 2) {
    errors.push(
      `Level ${character.level} inconsistent with experience ${character.experience}`
    );
  }

  // Check health constraints
  if (character.health && character.health.current > character.health.maximum) {
    errors.push('Current health cannot exceed maximum health');
  }

  // Check stats are within reasonable bounds
  const stats = character.stats;
  if (stats) {
    Object.entries(stats).forEach(([stat, value]) => {
      if (typeof value === 'number' && (value < 1 || value > 30)) {
        errors.push(
          `Stat ${stat} value ${value} is outside valid range (1-30)`
        );
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// SCHEMA EXPORTS
// ============================================================================

export const ValidationSchemas = {
  // Core
  Player: PlayerSchema,
  GameSession: GameSessionSchema,
  GameEvent: GameEventSchema,

  // AI
  AIGenerationRequest: AIGenerationRequestSchema,
  AIGenerationResponse: AIGenerationResponseSchema,
  AICacheEntry: AICacheEntrySchema,

  // Assets
  AssetReference: AssetReferenceSchema,

  // RPG
  RPGCharacter: RPGCharacterSchema,
  RPGGameState: RPGGameStateSchema,

  // Deduction
  DeductionRole: DeductionRoleSchema,
  VotingSession: VotingSessionSchema,
  DeductionGameState: DeductionGameStateSchema,

  // Village
  Building: BuildingSchema,
  Resident: ResidentSchema,
  VillageEvent: VillageEventSchema,
  VillageGameState: VillageGameStateSchema,

  // Requests
  CreateSessionRequest: CreateSessionRequestSchema,
  JoinSessionRequest: JoinSessionRequestSchema,
  GameActionRequest: GameActionRequestSchema,
  AIGenerateRequest: AIGenerateRequestSchema,
} as const;
