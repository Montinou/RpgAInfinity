/**
 * RPG API Validation Schemas
 *
 * Comprehensive validation schemas for all RPG API endpoints using Zod.
 * Ensures type safety and input validation across the entire RPG API surface.
 */

import { z } from 'zod';
import {
  UUIDSchema,
  JSONValueSchema,
  GameActionSchema,
  RPGConfigSchema,
  CharacterStatsSchema,
  CharacterSkillsSchema,
  CombatActionSchema,
} from '@/types';

// ============================================================================
// SHARED VALIDATION SCHEMAS
// ============================================================================

export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export const FilterSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ============================================================================
// RPG GAME MANAGEMENT VALIDATION
// ============================================================================

export const CreateRPGGameSchema = z.object({
  config: RPGConfigSchema,
  worldPreferences: z.object({
    theme: z.string().min(1).max(100),
    size: z.enum(['small', 'medium', 'large']),
    complexity: z.enum(['simple', 'moderate', 'complex']),
    tone: z.enum(['light', 'balanced', 'dark']),
    biomes: z.array(z.string()).min(1).max(10),
    factionCount: z.number().int().min(0).max(10),
    npcDensity: z.enum(['sparse', 'normal', 'dense']),
    questDensity: z.enum(['few', 'moderate', 'many']),
    magicLevel: z.enum(['none', 'rare', 'common', 'abundant']),
    technologyLevel: z.enum([
      'primitive',
      'medieval',
      'renaissance',
      'industrial',
      'modern',
      'future',
    ]),
    dangerLevel: z.enum(['peaceful', 'moderate', 'dangerous']),
    culturalDiversity: z.enum(['homogeneous', 'diverse', 'cosmopolitan']),
  }),
});

export const RPGActionSchema = z.object({
  type: z.string().min(1),
  data: z.record(JSONValueSchema),
  playerId: UUIDSchema,
  metadata: z.record(JSONValueSchema).optional(),
});

export const JoinRPGGameSchema = z.object({
  playerId: UUIDSchema,
  characterData: z.object({
    name: z.string().min(1).max(50),
    race: z.string().min(1).max(50),
    class: z.string().min(1).max(50),
    stats: CharacterStatsSchema.optional(),
    skills: CharacterSkillsSchema.optional(),
    background: z.string().max(500).optional(),
  }),
});

// ============================================================================
// WORLD GENERATION VALIDATION
// ============================================================================

export const GenerateWorldSchema = z.object({
  theme: z.string().min(1).max(100),
  preferences: z.object({
    theme: z.string(),
    size: z.enum(['small', 'medium', 'large']),
    complexity: z.enum(['simple', 'moderate', 'complex']),
    tone: z.enum(['light', 'balanced', 'dark']),
    biomes: z.array(z.string()).min(1),
    factionCount: z.number().int().min(0).max(10),
    npcDensity: z.enum(['sparse', 'normal', 'dense']),
    questDensity: z.enum(['few', 'moderate', 'many']),
    magicLevel: z.enum(['none', 'rare', 'common', 'abundant']),
    technologyLevel: z.enum([
      'primitive',
      'medieval',
      'renaissance',
      'industrial',
      'modern',
      'future',
    ]),
    dangerLevel: z.enum(['peaceful', 'moderate', 'dangerous']),
    culturalDiversity: z.enum(['homogeneous', 'diverse', 'cosmopolitan']),
  }),
  options: z
    .object({
      generateFactions: z.boolean().default(true),
      initializeExpansion: z.boolean().default(true),
      createInitialQuests: z.boolean().default(true),
      populateWithNPCs: z.boolean().default(true),
      enableEnvironmentalEvents: z.boolean().default(true),
    })
    .optional(),
});

export const ExpandWorldSchema = z.object({
  direction: z.enum([
    'north',
    'south',
    'east',
    'west',
    'northeast',
    'northwest',
    'southeast',
    'southwest',
  ]),
  playerLevel: z.number().int().min(1).max(100).default(1),
  expansionPressure: z.enum(['low', 'moderate', 'high']).default('moderate'),
  partySize: z.number().int().min(1).max(8).default(1),
  narrativeNeeds: z.array(z.string()).default([]),
  explorationStyle: z
    .enum(['cautious', 'balanced', 'opportunistic'])
    .default('balanced'),
});

// ============================================================================
// CHARACTER MANAGEMENT VALIDATION
// ============================================================================

export const CreateCharacterSchema = z.object({
  playerId: UUIDSchema,
  name: z.string().min(1).max(50),
  race: z.string().min(1).max(50),
  class: z.string().min(1).max(50),
  stats: CharacterStatsSchema.optional(),
  skills: CharacterSkillsSchema.optional(),
  background: z
    .object({
      name: z.string().min(1).max(100),
      description: z.string().max(500),
      skillBonuses: CharacterSkillsSchema.partial().optional(),
      startingEquipment: z.array(z.string()).optional(),
      connections: z.array(z.string()).optional(),
    })
    .optional(),
  traits: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(300),
        type: z.enum(['positive', 'negative', 'neutral']),
        effects: z.record(JSONValueSchema),
      })
    )
    .optional(),
});

export const UpdateCharacterSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  stats: CharacterStatsSchema.partial().optional(),
  skills: CharacterSkillsSchema.partial().optional(),
  experience: z.number().int().min(0).optional(),
  currentHealth: z.number().int().min(0).optional(),
  statusEffects: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        type: z.enum(['buff', 'debuff', 'neutral']),
        duration: z.number().int().min(0),
        effects: z.record(z.number()),
        stackable: z.boolean(),
      })
    )
    .optional(),
});

export const LevelUpCharacterSchema = z.object({
  skillPoints: z
    .object({
      combat: z.number().int().min(0).max(10).optional(),
      magic: z.number().int().min(0).max(10).optional(),
      stealth: z.number().int().min(0).max(10).optional(),
      diplomacy: z.number().int().min(0).max(10).optional(),
      survival: z.number().int().min(0).max(10).optional(),
      investigation: z.number().int().min(0).max(10).optional(),
      crafting: z.number().int().min(0).max(10).optional(),
      lore: z.number().int().min(0).max(10).optional(),
    })
    .optional(),
  statPoints: z
    .object({
      strength: z.number().int().min(0).max(5).optional(),
      dexterity: z.number().int().min(0).max(5).optional(),
      constitution: z.number().int().min(0).max(5).optional(),
      intelligence: z.number().int().min(0).max(5).optional(),
      wisdom: z.number().int().min(0).max(5).optional(),
      charisma: z.number().int().min(0).max(5).optional(),
      luck: z.number().int().min(0).max(5).optional(),
    })
    .optional(),
  newAbilities: z.array(z.string()).optional(),
});

// ============================================================================
// COMBAT SYSTEM VALIDATION
// ============================================================================

export const InitiateCombatSchema = z.object({
  gameId: UUIDSchema,
  participants: z
    .array(
      z.object({
        id: UUIDSchema,
        type: z.enum(['player', 'npc', 'monster']),
        position: z
          .object({
            x: z.number().int().min(0).max(20),
            y: z.number().int().min(0).max(20),
            zone: z.enum(['front', 'middle', 'back']),
          })
          .optional(),
      })
    )
    .min(2)
    .max(20),
  environment: z
    .object({
      type: z.string().min(1).max(100),
      size: z.object({
        width: z.number().int().min(5).max(50),
        height: z.number().int().min(5).max(50),
      }),
      modifiers: z
        .array(
          z.object({
            name: z.string(),
            type: z.enum(['stat', 'skill', 'damage', 'movement']),
            target: z.string(),
            modifier: z.number(),
          })
        )
        .optional(),
      hazards: z
        .array(
          z.object({
            name: z.string(),
            description: z.string(),
            damage: z.number().int().min(0),
            type: z.enum(['fire', 'ice', 'poison', 'physical', 'magical']),
            frequency: z.number().min(0).max(100),
            area: z.array(
              z.object({
                x: z.number(),
                y: z.number(),
                zone: z.enum(['front', 'middle', 'back']),
              })
            ),
          })
        )
        .optional(),
    })
    .optional(),
});

export const CombatActionValidationSchema = CombatActionSchema.extend({
  combatId: UUIDSchema,
});

// ============================================================================
// REQUEST CONTEXT VALIDATION
// ============================================================================

export const RequestContextSchema = z.object({
  userId: UUIDSchema.optional(),
  sessionId: z.string().optional(),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().optional(),
  timestamp: z.date().default(() => new Date()),
});

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

export const SuccessResponseSchema = z.object({
  success: z.literal(true),
  data: z.any(),
  metadata: z
    .object({
      timestamp: z.date(),
      requestId: z.string(),
      version: z.string().default('1.0.0'),
    })
    .optional(),
});

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(JSONValueSchema).optional(),
    timestamp: z.date(),
    requestId: z.string().optional(),
  }),
  metadata: z
    .object({
      timestamp: z.date(),
      requestId: z.string(),
      version: z.string().default('1.0.0'),
    })
    .optional(),
});

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      'Request validation failed',
      result.error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }))
    );
  }
  return result.data;
}

export function createValidationMiddleware<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): T => {
    return validateRequest(schema, data);
  };
}

// ============================================================================
// VALIDATION ERROR HANDLING
// ============================================================================

export class ValidationError extends Error {
  public readonly issues: Array<{
    path: string;
    message: string;
    code: string;
  }>;

  constructor(
    message: string,
    issues: Array<{ path: string; message: string; code: string }>
  ) {
    super(message);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

// ============================================================================
// TECHNICAL DEBT MARKERS
// ============================================================================

//TODO: Add comprehensive validation for nested game objects (items, equipment, etc.)
//TODO: Implement custom validation rules for business logic constraints
//TODO: Add validation caching for frequently used schemas
//TODO: Implement schema versioning for API backward compatibility
//TODO: Add performance monitoring for validation operations
//TODO: Create validation rule composition utilities for complex scenarios
//TODO: Add multi-language error message support
//TODO: Implement progressive validation for large payloads
