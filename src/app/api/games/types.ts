/**
 * Simple type definitions for API endpoints
 * Isolated from main type system to avoid compilation issues
 */

import { z } from 'zod';

// Game types for API validation
export const GameTypeSchema = z.enum(['rpg', 'deduction', 'village']);
export type GameType = z.infer<typeof GameTypeSchema>;

// Simple UUID validation
export const UUIDSchema = z.string().uuid();

// Basic game config for API
export const CreateGameConfigSchema = z.object({
  type: GameTypeSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  maxPlayers: z.number().int().min(2).max(8),
  minPlayers: z.number().int().min(2).max(8),
  isPrivate: z.boolean().default(false),
  settings: z.record(z.any()).default({}),
});

export type CreateGameConfig = z.infer<typeof CreateGameConfigSchema>;
