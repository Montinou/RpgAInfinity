/**
 * Data Serialization Utilities for KV Storage
 *
 * Handles conversion between TypeScript objects and JSON for Redis storage
 * Manages Date serialization, deep object serialization, and type safety
 */

import {
  Player,
  GameSession,
  GameEvent,
  RPGCharacter,
  RPGWorld,
  Village,
  VillageEvent,
  DeductionRole,
  Serializable,
} from '@/types';

// ============================================================================
// CORE SERIALIZATION FUNCTIONS
// ============================================================================

/**
 * Recursively serialize an object, converting Date objects to ISO strings
 */
export function serialize<T>(obj: T): Serializable<T> {
  if (obj === null || obj === undefined) {
    return obj as Serializable<T>;
  }

  if (obj instanceof Date) {
    return obj.toISOString() as Serializable<T>;
  }

  if (Array.isArray(obj)) {
    return obj.map(serialize) as Serializable<T>;
  }

  if (typeof obj === 'object') {
    const serialized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      serialized[key] = serialize(value);
    }
    return serialized;
  }

  return obj as Serializable<T>;
}

/**
 * Recursively deserialize an object, converting ISO strings back to Date objects
 */
export function deserialize<T>(obj: Serializable<T>): T {
  if (obj === null || obj === undefined) {
    return obj as T;
  }

  if (typeof obj === 'string' && isISODateString(obj)) {
    return new Date(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(deserialize) as T;
  }

  if (typeof obj === 'object') {
    const deserialized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      deserialized[key] = deserialize(value);
    }
    return deserialized;
  }

  return obj as T;
}

/**
 * Check if a string is a valid ISO date string
 */
function isISODateString(str: string): boolean {
  if (typeof str !== 'string') return false;

  // Basic ISO date format check
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
  if (!isoDateRegex.test(str)) return false;

  // Validate it's actually a valid date
  const date = new Date(str);
  return (
    date instanceof Date && !isNaN(date.getTime()) && date.toISOString() === str
  );
}

// ============================================================================
// GAME-SPECIFIC SERIALIZATION HELPERS
// ============================================================================

/**
 * Serialize Player object with proper Date handling
 */
export function serializePlayer(player: Player): Serializable<Player> {
  return {
    ...player,
    createdAt: player.createdAt.toISOString(),
    lastActive: player.lastActive.toISOString(),
  };
}

/**
 * Deserialize Player object with proper Date reconstruction
 */
export function deserializePlayer(data: Serializable<Player>): Player {
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    lastActive: new Date(data.lastActive),
  };
}

/**
 * Serialize GameSession object with nested Date handling
 */
export function serializeGameSession(
  session: GameSession
): Serializable<GameSession> {
  return {
    ...session,
    createdAt: session.createdAt.toISOString(),
    startedAt: session.startedAt?.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    endedAt: session.endedAt?.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    players: session.players.map(player => ({
      ...player,
      joinedAt: player.joinedAt.toISOString(),
      lastAction: player.lastAction?.toISOString(),
    })),
    eventHistory: session.eventHistory.map(event => ({
      ...event,
      timestamp: event.timestamp.toISOString(),
    })),
  };
}

/**
 * Deserialize GameSession object with nested Date reconstruction
 */
export function deserializeGameSession(
  data: Serializable<GameSession>
): GameSession {
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
    updatedAt: new Date(data.updatedAt),
    endedAt: data.endedAt ? new Date(data.endedAt) : undefined,
    expiresAt: new Date(data.expiresAt),
    players: data.players.map(player => ({
      ...player,
      joinedAt: new Date(player.joinedAt),
      lastAction: player.lastAction ? new Date(player.lastAction) : undefined,
    })),
    eventHistory: data.eventHistory.map(event => ({
      ...event,
      timestamp: new Date(event.timestamp),
    })),
  };
}

/**
 * Serialize GameEvent object
 */
export function serializeGameEvent(event: GameEvent): Serializable<GameEvent> {
  return {
    ...event,
    timestamp: event.timestamp.toISOString(),
  };
}

/**
 * Deserialize GameEvent object
 */
export function deserializeGameEvent(data: Serializable<GameEvent>): GameEvent {
  return {
    ...data,
    timestamp: new Date(data.timestamp),
  };
}

// ============================================================================
// RPG-SPECIFIC SERIALIZATION
// ============================================================================

/**
 * Serialize RPG Character with complex nested structures
 */
export function serializeRPGCharacter(
  character: RPGCharacter
): Serializable<RPGCharacter> {
  return {
    ...character,
    createdAt: character.createdAt.toISOString(),
    updatedAt: character.updatedAt.toISOString(),
    skills: character.skills.map(skill => ({
      ...skill,
      lastUsed: skill.lastUsed.toISOString(),
    })),
    workers: character.workers
      ? character.workers.map(worker => ({
          ...worker,
          assignedAt: worker.assignedAt.toISOString(),
        }))
      : [],
  };
}

/**
 * Deserialize RPG Character
 */
export function deserializeRPGCharacter(
  data: Serializable<RPGCharacter>
): RPGCharacter {
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
    skills: data.skills.map(skill => ({
      ...skill,
      lastUsed: new Date(skill.lastUsed),
    })),
    workers: data.workers
      ? data.workers.map(worker => ({
          ...worker,
          assignedAt: new Date(worker.assignedAt),
        }))
      : [],
  };
}

/**
 * Serialize RPG World with all nested dates
 */
export function serializeRPGWorld(world: RPGWorld): Serializable<RPGWorld> {
  return serialize(world);
}

/**
 * Deserialize RPG World
 */
export function deserializeRPGWorld(data: Serializable<RPGWorld>): RPGWorld {
  return deserialize(data);
}

// ============================================================================
// VILLAGE-SPECIFIC SERIALIZATION
// ============================================================================

/**
 * Serialize Village with complex nested structures and dates
 */
export function serializeVillage(village: Village): Serializable<Village> {
  return serialize(village);
}

/**
 * Deserialize Village
 */
export function deserializeVillage(data: Serializable<Village>): Village {
  return deserialize(data);
}

/**
 * Serialize Village Event
 */
export function serializeVillageEvent(
  event: VillageEvent
): Serializable<VillageEvent> {
  return {
    ...event,
    startDate: event.startDate.toISOString(),
    endDate: event.endDate?.toISOString(),
  };
}

/**
 * Deserialize Village Event
 */
export function deserializeVillageEvent(
  data: Serializable<VillageEvent>
): VillageEvent {
  return {
    ...data,
    startDate: new Date(data.startDate),
    endDate: data.endDate ? new Date(data.endDate) : undefined,
  };
}

// ============================================================================
// DEDUCTION GAME SERIALIZATION
// ============================================================================

/**
 * Serialize Deduction Role (mostly static data, minimal dates)
 */
export function serializeDeductionRole(
  role: DeductionRole
): Serializable<DeductionRole> {
  return serialize(role);
}

/**
 * Deserialize Deduction Role
 */
export function deserializeDeductionRole(
  data: Serializable<DeductionRole>
): DeductionRole {
  return deserialize(data);
}

// ============================================================================
// BULK SERIALIZATION UTILITIES
// ============================================================================

/**
 * Serialize an array of objects
 */
export function serializeArray<T>(items: T[]): Serializable<T>[] {
  return items.map(serialize);
}

/**
 * Deserialize an array of objects
 */
export function deserializeArray<T>(items: Serializable<T>[]): T[] {
  return items.map(deserialize);
}

/**
 * Serialize a Map to an object
 */
export function serializeMap<K extends string | number, V>(
  map: Map<K, V>
): Record<K, Serializable<V>> {
  const obj: Record<K, Serializable<V>> = {} as Record<K, Serializable<V>>;
  for (const [key, value] of map.entries()) {
    obj[key] = serialize(value);
  }
  return obj;
}

/**
 * Deserialize an object to a Map
 */
export function deserializeMap<K extends string | number, V>(
  obj: Record<K, Serializable<V>>
): Map<K, V> {
  const map = new Map<K, V>();
  for (const [key, value] of Object.entries(obj)) {
    map.set(key as K, deserialize(value));
  }
  return map;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate that a serialized object can be safely stored in KV
 */
export function validateSerialized(data: any): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  try {
    // Check if it can be JSON stringified
    JSON.stringify(data);
  } catch (error) {
    errors.push(`JSON serialization failed: ${error}`);
  }

  // Check for circular references
  const seen = new Set();
  function checkCircular(obj: any, path = ''): void {
    if (obj === null || typeof obj !== 'object') return;

    if (seen.has(obj)) {
      errors.push(`Circular reference detected at path: ${path}`);
      return;
    }

    seen.add(obj);

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => checkCircular(item, `${path}[${index}]`));
    } else {
      Object.entries(obj).forEach(([key, value]) => {
        checkCircular(value, path ? `${path}.${key}` : key);
      });
    }

    seen.delete(obj);
  }

  checkCircular(data);

  // Check for Date objects that weren't serialized
  function checkForDates(obj: any, path = ''): void {
    if (obj instanceof Date) {
      errors.push(`Unserialised Date object at path: ${path}`);
      return;
    }

    if (obj === null || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => checkForDates(item, `${path}[${index}]`));
    } else {
      Object.entries(obj).forEach(([key, value]) => {
        checkForDates(value, path ? `${path}.${key}` : key);
      });
    }
  }

  checkForDates(data);

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate the approximate size of serialized data in bytes
 */
export function getSerializedSize(data: any): number {
  try {
    return new Blob([JSON.stringify(data)]).size;
  } catch {
    return -1; // Error calculating size
  }
}

/**
 * Check if serialized data exceeds KV limits (Vercel KV has a 25MB limit per key)
 */
export function checkSizeLimit(
  data: any,
  maxSizeBytes = 25 * 1024 * 1024
): { withinLimit: boolean; size: number } {
  const size = getSerializedSize(data);
  return {
    withinLimit: size !== -1 && size <= maxSizeBytes,
    size,
  };
}

// ============================================================================
// PERFORMANCE OPTIMIZED SERIALIZATION
// ============================================================================

/**
 * Fast serialization for hot paths - less thorough but faster
 */
export function fastSerialize<T extends Record<string, any>>(
  obj: T,
  dateFields: (keyof T)[]
): Serializable<T> {
  const result = { ...obj } as any;

  for (const field of dateFields) {
    if (obj[field] instanceof Date) {
      result[field] = (obj[field] as Date).toISOString();
    }
  }

  return result;
}

/**
 * Fast deserialization for hot paths
 */
export function fastDeserialize<T extends Record<string, any>>(
  data: Serializable<T>,
  dateFields: (keyof T)[]
): T {
  const result = { ...data } as any;

  for (const field of dateFields) {
    if (
      typeof data[field] === 'string' &&
      isISODateString(data[field] as string)
    ) {
      result[field] = new Date(data[field] as string);
    }
  }

  return result;
}

// ============================================================================
// MIGRATION HELPERS
// ============================================================================

/**
 * Handle version changes in serialized data structures
 */
export interface MigrationRule<T> {
  fromVersion: string;
  toVersion: string;
  migrate: (data: any) => T;
}

/**
 * Apply migration rules to serialized data
 */
export function migrateSerializedData<T>(
  data: any,
  currentVersion: string,
  migrations: MigrationRule<T>[]
): T {
  let result = data;
  let version = data.__version || '1.0.0';

  // Apply migrations in sequence
  for (const migration of migrations) {
    if (version === migration.fromVersion) {
      result = migration.migrate(result);
      version = migration.toVersion;
      result.__version = version;
    }
  }

  if (version !== currentVersion) {
    console.warn(
      `Data version ${version} does not match current version ${currentVersion}`
    );
  }

  return result;
}

// ============================================================================
// EXPORTS
// ============================================================================

export { isISODateString };
