/**
 * Real-time Character Updates and Validation System
 *
 * Handles real-time character stat updates, validation, and synchronization
 * for RpgAInfinity RPG module with optimistic updates and conflict resolution.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Character,
  CharacterStats,
  CharacterSkills,
  Equipment,
  Inventory,
  StatusEffect,
  UUID,
} from '@/types/rpg';
import { GameError, ErrorCode, GameEvent, GameEventType } from '@/types/core';
import { characterManager, ComputedStats } from './character';
import { skillTreeManager, SkillProgression } from './skills';
import { inventoryManager } from './inventory';
import { kvService } from '@/lib/database/kv-service';

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

export interface CharacterUpdateEvent {
  readonly type: CharacterUpdateType;
  readonly characterId: UUID;
  readonly playerId: UUID;
  readonly timestamp: Date;
  readonly data: any;
  readonly version: number;
}

export type CharacterUpdateType =
  | 'stats_changed'
  | 'health_changed'
  | 'experience_gained'
  | 'level_up'
  | 'status_effect_added'
  | 'status_effect_removed'
  | 'equipment_changed'
  | 'inventory_changed'
  | 'skill_learned'
  | 'trait_gained';

export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
  readonly correctedValues?: Partial<Character>;
}

export interface UpdateBatch {
  readonly id: UUID;
  readonly characterId: UUID;
  readonly playerId: UUID;
  readonly updates: CharacterUpdateEvent[];
  readonly timestamp: Date;
  readonly version: number;
}

export interface ConflictResolution {
  readonly strategy: 'merge' | 'override' | 'reject';
  readonly resolvedCharacter: Character;
  readonly conflicts: string[];
}

// ============================================================================
// CHARACTER UPDATE MANAGER CLASS
// ============================================================================

export class CharacterUpdateManager {
  private static instance: CharacterUpdateManager;
  private updateListeners: Map<
    UUID,
    ((event: CharacterUpdateEvent) => void)[]
  > = new Map();
  private pendingUpdates: Map<UUID, UpdateBatch> = new Map();
  private lastKnownVersions: Map<UUID, number> = new Map();

  private constructor() {
    this.startPeriodicSync();
  }

  static getInstance(): CharacterUpdateManager {
    if (!CharacterUpdateManager.instance) {
      CharacterUpdateManager.instance = new CharacterUpdateManager();
    }
    return CharacterUpdateManager.instance;
  }

  // ============================================================================
  // REAL-TIME UPDATE METHODS
  // ============================================================================

  /**
   * Apply a real-time update to a character with validation
   */
  async applyUpdate(
    character: Character,
    playerId: UUID,
    updateType: CharacterUpdateType,
    updateData: any
  ): Promise<{
    character: Character;
    events: CharacterUpdateEvent[];
    computedStats?: ComputedStats;
  }> {
    try {
      // Validate the update
      const validationResult = this.validateUpdate(
        character,
        updateType,
        updateData
      );
      if (!validationResult.isValid) {
        throw new GameError(
          `Validation failed: ${validationResult.errors.join(', ')}`,
          ErrorCode.VALIDATION_FAILED
        );
      }

      // Apply the update
      const { updatedCharacter, events } = await this.processUpdate(
        character,
        updateType,
        updateData
      );

      // Calculate new computed stats
      const computedStats = characterManager.calculateStats(updatedCharacter);

      // Create update event
      const updateEvent: CharacterUpdateEvent = {
        type: updateType,
        characterId: character.id,
        playerId,
        timestamp: new Date(),
        data: updateData,
        version: this.getNextVersion(character.id),
      };

      // Store for batching
      this.addToPendingUpdates(playerId, updateEvent);

      // Notify listeners
      this.notifyUpdateListeners(character.id, updateEvent);

      // Save to storage asynchronously
      this.saveCharacterAsync(playerId, updatedCharacter);

      return {
        character: updatedCharacter,
        events: [...events, updateEvent],
        computedStats,
      };
    } catch (error) {
      if (error instanceof GameError) {
        throw error;
      }
      throw new GameError(
        `Failed to apply update: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.OPERATION_FAILED
      );
    }
  }

  /**
   * Batch multiple updates for efficiency
   */
  async applyBatchUpdates(
    character: Character,
    playerId: UUID,
    updates: Array<{ type: CharacterUpdateType; data: any }>
  ): Promise<{
    character: Character;
    events: CharacterUpdateEvent[];
    computedStats: ComputedStats;
  }> {
    let currentCharacter = character;
    const allEvents: CharacterUpdateEvent[] = [];

    try {
      // Apply updates sequentially to maintain consistency
      for (const update of updates) {
        const result = await this.applyUpdate(
          currentCharacter,
          playerId,
          update.type,
          update.data
        );
        currentCharacter = result.character;
        allEvents.push(...result.events);
      }

      const computedStats = characterManager.calculateStats(currentCharacter);

      return {
        character: currentCharacter,
        events: allEvents,
        computedStats,
      };
    } catch (error) {
      // If batch fails, revert to original character
      throw error;
    }
  }

  /**
   * Validate an update before applying it
   */
  validateUpdate(
    character: Character,
    updateType: CharacterUpdateType,
    updateData: any
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let correctedValues: Partial<Character> | undefined;

    switch (updateType) {
      case 'stats_changed':
        return this.validateStatUpdate(character, updateData);

      case 'health_changed':
        return this.validateHealthUpdate(character, updateData);

      case 'experience_gained':
        return this.validateExperienceUpdate(character, updateData);

      case 'level_up':
        return this.validateLevelUpUpdate(character, updateData);

      case 'status_effect_added':
        return this.validateStatusEffectUpdate(character, updateData);

      case 'equipment_changed':
        return this.validateEquipmentUpdate(character, updateData);

      case 'skill_learned':
        return this.validateSkillUpdate(character, updateData);

      default:
        errors.push(`Unknown update type: ${updateType}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      correctedValues,
    };
  }

  // ============================================================================
  // UPDATE LISTENERS & SYNCHRONIZATION
  // ============================================================================

  /**
   * Subscribe to real-time character updates
   */
  subscribeToUpdates(
    characterId: UUID,
    callback: (event: CharacterUpdateEvent) => void
  ): () => void {
    const listeners = this.updateListeners.get(characterId) || [];
    listeners.push(callback);
    this.updateListeners.set(characterId, listeners);

    // Return unsubscribe function
    return () => {
      const currentListeners = this.updateListeners.get(characterId) || [];
      const index = currentListeners.indexOf(callback);
      if (index > -1) {
        currentListeners.splice(index, 1);
        this.updateListeners.set(characterId, currentListeners);
      }
    };
  }

  /**
   * Sync character state with server
   */
  async syncCharacterState(
    playerId: UUID,
    characterId: UUID
  ): Promise<Character | null> {
    try {
      // Load from storage
      const storedCharacter = await characterManager.loadCharacter(
        playerId,
        characterId
      );

      // Check for conflicts with pending updates
      if (this.pendingUpdates.has(characterId)) {
        const resolution = await this.resolveConflicts(
          storedCharacter,
          characterId
        );
        return resolution.resolvedCharacter;
      }

      return storedCharacter;
    } catch (error) {
      throw new GameError(
        `Failed to sync character state: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.STORAGE_ERROR
      );
    }
  }

  // ============================================================================
  // VALIDATION METHODS
  // ============================================================================

  private validateStatUpdate(
    character: Character,
    updateData: any
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!updateData || typeof updateData !== 'object') {
      errors.push('Invalid stat update data');
      return { isValid: false, errors, warnings };
    }

    const { stat, newValue } = updateData;

    if (!stat || !(stat in character.stats)) {
      errors.push(`Invalid stat: ${stat}`);
    }

    if (typeof newValue !== 'number' || newValue < 1 || newValue > 100) {
      errors.push('Stat value must be between 1 and 100');
    }

    // Check if change is too dramatic
    const currentValue = character.stats[stat as keyof CharacterStats];
    if (Math.abs(newValue - currentValue) > 10) {
      warnings.push('Large stat change detected - please verify');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateHealthUpdate(
    character: Character,
    updateData: any
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof updateData.newHealth !== 'number') {
      errors.push('Invalid health value');
    }

    if (updateData.newHealth < 0) {
      errors.push('Health cannot be negative');
    }

    if (updateData.newHealth > character.maxHealth) {
      warnings.push('Health exceeds maximum - will be capped');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateExperienceUpdate(
    character: Character,
    updateData: any
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (
      typeof updateData.experienceGained !== 'number' ||
      updateData.experienceGained <= 0
    ) {
      errors.push('Experience gained must be a positive number');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateLevelUpUpdate(
    character: Character,
    updateData: any
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (character.level >= 100) {
      errors.push('Character is already at maximum level');
    }

    // Check if character has enough experience
    //TODO: Implement proper experience requirement calculation

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateStatusEffectUpdate(
    character: Character,
    updateData: any
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!updateData.statusEffect || !updateData.statusEffect.name) {
      errors.push('Invalid status effect data');
    }

    // Check for conflicting effects
    const hasConflictingEffect = character.statusEffects.some(
      effect =>
        effect.name === updateData.statusEffect.name &&
        effect.type !== updateData.statusEffect.type
    );

    if (hasConflictingEffect) {
      warnings.push('Conflicting status effect detected');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateEquipmentUpdate(
    character: Character,
    updateData: any
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic equipment validation
    //TODO: Implement comprehensive equipment validation when equipment system is enhanced

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateSkillUpdate(
    character: Character,
    updateData: any
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!updateData.skillId || !updateData.skillProgression) {
      errors.push('Invalid skill update data');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  // ============================================================================
  // UPDATE PROCESSING METHODS
  // ============================================================================

  private async processUpdate(
    character: Character,
    updateType: CharacterUpdateType,
    updateData: any
  ): Promise<{ updatedCharacter: Character; events: CharacterUpdateEvent[] }> {
    let updatedCharacter = { ...character };
    const events: CharacterUpdateEvent[] = [];

    switch (updateType) {
      case 'stats_changed':
        updatedCharacter = this.processStatUpdate(updatedCharacter, updateData);
        break;

      case 'health_changed':
        updatedCharacter = this.processHealthUpdate(
          updatedCharacter,
          updateData
        );
        break;

      case 'experience_gained':
        updatedCharacter = this.processExperienceUpdate(
          updatedCharacter,
          updateData
        );
        break;

      case 'level_up':
        const levelUpResult = await characterManager.levelUp(updatedCharacter);
        updatedCharacter = levelUpResult.character;
        break;

      case 'status_effect_added':
        updatedCharacter = this.processStatusEffectAdd(
          updatedCharacter,
          updateData
        );
        break;

      case 'status_effect_removed':
        updatedCharacter = this.processStatusEffectRemove(
          updatedCharacter,
          updateData
        );
        break;

      case 'equipment_changed':
        //TODO: Implement equipment change processing
        break;

      case 'inventory_changed':
        //TODO: Implement inventory change processing
        break;

      case 'skill_learned':
        //TODO: Implement skill learning processing
        break;

      case 'trait_gained':
        //TODO: Implement trait gaining processing
        break;
    }

    return { updatedCharacter, events };
  }

  private processStatUpdate(character: Character, updateData: any): Character {
    const { stat, newValue } = updateData;
    return {
      ...character,
      stats: {
        ...character.stats,
        [stat]: Math.max(1, Math.min(100, newValue)),
      },
    };
  }

  private processHealthUpdate(
    character: Character,
    updateData: any
  ): Character {
    return characterManager.healCharacter(
      character,
      updateData.newHealth - character.currentHealth
    );
  }

  private processExperienceUpdate(
    character: Character,
    updateData: any
  ): Character {
    return {
      ...character,
      experience: character.experience + updateData.experienceGained,
    };
  }

  private processStatusEffectAdd(
    character: Character,
    updateData: any
  ): Character {
    const statusEffect = updateData.statusEffect;

    // Remove existing effect with same name if not stackable
    let statusEffects = character.statusEffects;
    if (!statusEffect.stackable) {
      statusEffects = statusEffects.filter(
        effect => effect.name !== statusEffect.name
      );
    }

    return {
      ...character,
      statusEffects: [...statusEffects, statusEffect],
    };
  }

  private processStatusEffectRemove(
    character: Character,
    updateData: any
  ): Character {
    const { statusEffectId } = updateData;
    return {
      ...character,
      statusEffects: character.statusEffects.filter(
        effect => effect.id !== statusEffectId
      ),
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private notifyUpdateListeners(
    characterId: UUID,
    event: CharacterUpdateEvent
  ): void {
    const listeners = this.updateListeners.get(characterId) || [];
    listeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in update listener:', error);
      }
    });
  }

  private addToPendingUpdates(
    playerId: UUID,
    event: CharacterUpdateEvent
  ): void {
    const batchId = `${playerId}-${event.characterId}`;
    const existing = this.pendingUpdates.get(event.characterId);

    if (existing) {
      existing.updates.push(event);
    } else {
      const batch: UpdateBatch = {
        id: uuidv4(),
        characterId: event.characterId,
        playerId,
        updates: [event],
        timestamp: new Date(),
        version: event.version,
      };
      this.pendingUpdates.set(event.characterId, batch);
    }

    // Auto-flush after a short delay
    setTimeout(() => this.flushPendingUpdates(event.characterId), 1000);
  }

  private async flushPendingUpdates(characterId: UUID): Promise<void> {
    const batch = this.pendingUpdates.get(characterId);
    if (!batch) return;

    try {
      // Process batch updates
      //TODO: Implement batch processing to storage
      this.pendingUpdates.delete(characterId);
    } catch (error) {
      console.error('Error flushing pending updates:', error);
    }
  }

  private getNextVersion(characterId: UUID): number {
    const current = this.lastKnownVersions.get(characterId) || 0;
    const next = current + 1;
    this.lastKnownVersions.set(characterId, next);
    return next;
  }

  private async resolveConflicts(
    storedCharacter: Character | null,
    characterId: UUID
  ): Promise<ConflictResolution> {
    const batch = this.pendingUpdates.get(characterId);

    if (!storedCharacter || !batch) {
      return {
        strategy: 'reject',
        resolvedCharacter: storedCharacter || ({} as Character),
        conflicts: ['No stored character or pending updates'],
      };
    }

    // Simple merge strategy for now
    //TODO: Implement sophisticated conflict resolution
    return {
      strategy: 'merge',
      resolvedCharacter: storedCharacter,
      conflicts: [],
    };
  }

  private async saveCharacterAsync(
    playerId: UUID,
    character: Character
  ): Promise<void> {
    try {
      await characterManager.saveCharacter(playerId, character);
    } catch (error) {
      console.error('Error saving character:', error);
      //TODO: Implement proper error logging and retry logic
    }
  }

  private startPeriodicSync(): void {
    // Sync pending updates every 5 seconds
    setInterval(() => {
      for (const characterId of this.pendingUpdates.keys()) {
        this.flushPendingUpdates(characterId);
      }
    }, 5000);

    // Clean up old listeners every minute
    setInterval(() => {
      for (const [characterId, listeners] of this.updateListeners.entries()) {
        if (listeners.length === 0) {
          this.updateListeners.delete(characterId);
        }
      }
    }, 60000);
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const characterUpdateManager = CharacterUpdateManager.getInstance();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a real-time character update hook for React components
 */
export function createCharacterUpdateHook() {
  return {
    subscribeToUpdates: characterUpdateManager.subscribeToUpdates.bind(
      characterUpdateManager
    ),
    applyUpdate: characterUpdateManager.applyUpdate.bind(
      characterUpdateManager
    ),
    syncCharacterState: characterUpdateManager.syncCharacterState.bind(
      characterUpdateManager
    ),
    validateUpdate: characterUpdateManager.validateUpdate.bind(
      characterUpdateManager
    ),
  };
}

/**
 * Batch multiple stat updates for efficiency
 */
export async function batchStatUpdates(
  character: Character,
  playerId: UUID,
  statUpdates: Array<{ stat: keyof CharacterStats; newValue: number }>
): Promise<{
  character: Character;
  events: CharacterUpdateEvent[];
  computedStats: ComputedStats;
}> {
  const updates = statUpdates.map(update => ({
    type: 'stats_changed' as const,
    data: { stat: update.stat, newValue: update.newValue },
  }));

  return characterUpdateManager.applyBatchUpdates(character, playerId, updates);
}
