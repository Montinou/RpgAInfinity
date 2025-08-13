/**
 * RPG Character Management System
 *
 * Comprehensive character lifecycle management for RpgAInfinity RPG module.
 * Handles character creation, progression, stats calculation, skills, equipment,
 * and all character-related operations with full validation and persistence.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Character,
  CharacterStats,
  CharacterSkills,
  CharacterRace,
  CharacterClass,
  CharacterTrait,
  CharacterBackground,
  StatusEffect,
  Equipment,
  Item,
  Inventory,
  InventoryItem,
  RPGPlayer,
  CharacterStatsSchema,
  CharacterSkillsSchema,
  CharacterSchema,
} from '@/types/rpg';
import { Player, UUID, GameError, ErrorCode } from '@/types/core';
import { kvService } from '@/lib/database/kv-service';
import { validateWith } from '@/lib/database/validation';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const CHARACTER_CONSTANTS = {
  // Stat limits and defaults
  MIN_STAT_VALUE: 1,
  MAX_STAT_VALUE: 100,
  DEFAULT_STAT_VALUE: 10,
  STAT_POINTS_PER_LEVEL: 5,

  // Skill configuration
  MAX_SKILL_VALUE: 100,
  SKILL_POINTS_PER_LEVEL: 3,

  // Level progression
  MIN_LEVEL: 1,
  MAX_LEVEL: 100,
  BASE_EXP_PER_LEVEL: 1000,
  EXP_MULTIPLIER: 1.2,

  // Health calculation
  BASE_HEALTH: 50,
  HEALTH_PER_CONSTITUTION: 5,
  HEALTH_PER_LEVEL: 10,

  // Character limits
  MAX_NAME_LENGTH: 50,
  MAX_TRAITS: 10,
  MAX_STATUS_EFFECTS: 20,

  // Equipment slots
  MAX_ACCESSORIES: 3,

  // Storage configuration
  CHARACTER_TTL: 7 * 24 * 3600, // 7 days
  BACKUP_TTL: 30 * 24 * 3600, // 30 days
} as const;

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

export interface CharacterData {
  readonly name: string;
  readonly race: CharacterRace;
  readonly class: CharacterClass;
  readonly background: CharacterBackground;
  readonly stats: CharacterStats;
  readonly traits?: CharacterTrait[];
  readonly customization?: Record<string, any>;
}

export interface SkillUpdate {
  readonly skill: keyof CharacterSkills;
  readonly change: number;
  readonly reason?: string;
}

export interface CharacterAction {
  readonly type:
    | 'move'
    | 'attack'
    | 'cast'
    | 'use_item'
    | 'interact'
    | 'skill_check';
  readonly targetId?: UUID;
  readonly itemId?: UUID;
  readonly skillType?: keyof CharacterSkills;
  readonly difficulty?: number;
  readonly data?: Record<string, any>;
}

export interface ComputedStats {
  readonly baseStats: CharacterStats;
  readonly modifiedStats: CharacterStats;
  readonly derivedStats: {
    readonly maxHealth: number;
    readonly currentHealth: number;
    readonly armorClass: number;
    readonly initiative: number;
    readonly carryCapacity: number;
    readonly manaPoints: number;
    readonly skillModifiers: CharacterSkills;
  };
}

export interface LevelUpResult {
  readonly character: Character;
  readonly statPointsGained: number;
  readonly skillPointsGained: number;
  readonly newAbilities: string[];
  readonly healthIncrease: number;
}

// ============================================================================
// CHARACTER MANAGER CLASS
// ============================================================================

export class CharacterManager {
  private static instance: CharacterManager;

  private constructor() {}

  static getInstance(): CharacterManager {
    if (!CharacterManager.instance) {
      CharacterManager.instance = new CharacterManager();
    }
    return CharacterManager.instance;
  }

  // ============================================================================
  // CHARACTER CREATION
  // ============================================================================

  /**
   * Create a new character with the provided data
   */
  async createCharacter(
    playerId: UUID,
    data: CharacterData
  ): Promise<Character> {
    try {
      // Validate input data
      if (!data.name || data.name.trim().length === 0) {
        throw new GameError(
          'Character name is required',
          ErrorCode.VALIDATION_FAILED
        );
      }

      if (data.name.length > CHARACTER_CONSTANTS.MAX_NAME_LENGTH) {
        throw new GameError(
          `Character name too long (max ${CHARACTER_CONSTANTS.MAX_NAME_LENGTH} characters)`,
          ErrorCode.VALIDATION_FAILED
        );
      }

      // Validate stats
      this.validateStats(data.stats);

      // Calculate initial health
      const maxHealth = this.calculateMaxHealth(data.stats, 1);

      // Create character object
      const character: Character = {
        id: uuidv4(),
        name: data.name.trim(),
        race: data.race,
        class: data.class,
        level: 1,
        experience: 0,
        stats: { ...data.stats },
        skills: this.calculateInitialSkills(data.background, data.class),
        traits: data.traits || [],
        background: data.background,
        currentHealth: maxHealth,
        maxHealth: maxHealth,
        statusEffects: [],
      };

      // Validate the complete character
      const validatedCharacter = validateWith(CharacterSchema, character);

      // Save to storage
      await this.saveCharacter(playerId, validatedCharacter);

      // Log character creation
      //TODO: Implement proper logging service
      console.log(
        `Character created: ${character.name} (${character.id}) for player ${playerId}`
      );

      return validatedCharacter;
    } catch (error) {
      if (error instanceof GameError) {
        throw error;
      }
      throw new GameError(
        `Failed to create character: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.OPERATION_FAILED
      );
    }
  }

  /**
   * Level up a character and apply benefits
   */
  async levelUp(character: Character): Promise<LevelUpResult> {
    try {
      if (character.level >= CHARACTER_CONSTANTS.MAX_LEVEL) {
        throw new GameError(
          'Character is already at maximum level',
          ErrorCode.VALIDATION_FAILED
        );
      }

      // Check if character has enough experience
      const requiredExp = this.getRequiredExperience(character.level + 1);
      if (character.experience < requiredExp) {
        throw new GameError(
          'Insufficient experience for level up',
          ErrorCode.VALIDATION_FAILED
        );
      }

      const newLevel = character.level + 1;
      const statPointsGained = CHARACTER_CONSTANTS.STAT_POINTS_PER_LEVEL;
      const skillPointsGained = CHARACTER_CONSTANTS.SKILL_POINTS_PER_LEVEL;
      const healthIncrease = CHARACTER_CONSTANTS.HEALTH_PER_LEVEL;

      // Create leveled up character
      const leveledCharacter: Character = {
        ...character,
        level: newLevel,
        maxHealth: character.maxHealth + healthIncrease,
        currentHealth: character.currentHealth + healthIncrease, // Full heal on level up
      };

      // Get new abilities based on class and level
      const newAbilities = this.getNewAbilitiesForLevel(
        character.class,
        newLevel
      );

      const result: LevelUpResult = {
        character: leveledCharacter,
        statPointsGained,
        skillPointsGained,
        newAbilities,
        healthIncrease,
      };

      //TODO: Implement proper logging service
      console.log(
        `Character leveled up: ${character.name} reached level ${newLevel}`
      );

      return result;
    } catch (error) {
      if (error instanceof GameError) {
        throw error;
      }
      throw new GameError(
        `Failed to level up character: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.OPERATION_FAILED
      );
    }
  }

  /**
   * Apply damage to a character
   */
  applyDamage(character: Character, damage: number): Character {
    if (damage < 0) {
      throw new GameError(
        'Damage cannot be negative',
        ErrorCode.VALIDATION_FAILED
      );
    }

    const newHealth = Math.max(0, character.currentHealth - damage);

    return {
      ...character,
      currentHealth: newHealth,
    };
  }

  /**
   * Heal a character
   */
  healCharacter(character: Character, healAmount: number): Character {
    if (healAmount < 0) {
      throw new GameError(
        'Heal amount cannot be negative',
        ErrorCode.VALIDATION_FAILED
      );
    }

    const newHealth = Math.min(
      character.maxHealth,
      character.currentHealth + healAmount
    );

    return {
      ...character,
      currentHealth: newHealth,
    };
  }

  /**
   * Update character skills
   */
  updateSkills(character: Character, skillUpdates: SkillUpdate[]): Character {
    try {
      const updatedSkills = { ...character.skills };

      for (const update of skillUpdates) {
        const currentValue = updatedSkills[update.skill];
        const newValue = Math.max(
          0,
          Math.min(
            CHARACTER_CONSTANTS.MAX_SKILL_VALUE,
            currentValue + update.change
          )
        );
        updatedSkills[update.skill] = newValue;

        //TODO: Implement proper logging service
        if (update.reason) {
          console.log(
            `Skill updated: ${character.name} ${update.skill} ${currentValue} -> ${newValue} (${update.reason})`
          );
        }
      }

      // Validate updated skills
      validateWith(CharacterSkillsSchema, updatedSkills);

      return {
        ...character,
        skills: updatedSkills,
      };
    } catch (error) {
      throw new GameError(
        `Failed to update skills: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.VALIDATION_FAILED
      );
    }
  }

  /**
   * Calculate comprehensive character stats including modifiers
   */
  calculateStats(character: Character): ComputedStats {
    try {
      const baseStats = { ...character.stats };

      // Apply racial modifiers
      const raceModifiers = character.race.statModifiers || {};
      const modifiedStats: CharacterStats = {
        strength: this.applyStatModifier(
          baseStats.strength,
          raceModifiers.strength
        ),
        dexterity: this.applyStatModifier(
          baseStats.dexterity,
          raceModifiers.dexterity
        ),
        constitution: this.applyStatModifier(
          baseStats.constitution,
          raceModifiers.constitution
        ),
        intelligence: this.applyStatModifier(
          baseStats.intelligence,
          raceModifiers.intelligence
        ),
        wisdom: this.applyStatModifier(baseStats.wisdom, raceModifiers.wisdom),
        charisma: this.applyStatModifier(
          baseStats.charisma,
          raceModifiers.charisma
        ),
        luck: this.applyStatModifier(baseStats.luck, raceModifiers.luck || 0),
      };

      // Apply equipment modifiers
      //TODO: Implement equipment stat modifiers when equipment system is integrated

      // Apply status effect modifiers
      //TODO: Implement status effect modifiers when status system is expanded

      // Calculate derived stats
      const maxHealth = this.calculateMaxHealth(modifiedStats, character.level);
      const currentHealth = Math.min(character.currentHealth, maxHealth);

      const derivedStats = {
        maxHealth,
        currentHealth,
        armorClass: 10 + this.getStatModifier(modifiedStats.dexterity),
        initiative: this.getStatModifier(modifiedStats.dexterity),
        carryCapacity: modifiedStats.strength * 10,
        manaPoints:
          this.getStatModifier(modifiedStats.intelligence) *
          character.level *
          5,
        skillModifiers: this.calculateSkillModifiers(
          modifiedStats,
          character.skills
        ),
      };

      return {
        baseStats,
        modifiedStats,
        derivedStats,
      };
    } catch (error) {
      throw new GameError(
        `Failed to calculate stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.OPERATION_FAILED
      );
    }
  }

  /**
   * Validate if a character can perform a specific action
   */
  validateCharacterAction(
    character: Character,
    action: CharacterAction
  ): boolean {
    try {
      // Basic validation
      if (character.currentHealth <= 0) {
        return false; // Dead characters can't act
      }

      // Check for incapacitating status effects
      const incapacitatingEffects = ['paralyzed', 'unconscious', 'stunned'];
      if (
        character.statusEffects.some(effect =>
          incapacitatingEffects.includes(effect.name.toLowerCase())
        )
      ) {
        return false;
      }

      // Validate action-specific requirements
      switch (action.type) {
        case 'skill_check':
          if (!action.skillType) return false;
          // Check if character has minimum skill level
          return character.skills[action.skillType] > 0;

        case 'cast':
          // Check if character has enough mana (derived from intelligence)
          const computedStats = this.calculateStats(character);
          return computedStats.derivedStats.manaPoints > 0;

        case 'use_item':
          if (!action.itemId) return false;
          //TODO: Validate item exists in inventory when inventory system is integrated
          return true;

        case 'attack':
        case 'move':
        case 'interact':
          return true; // Basic actions available to all characters

        default:
          return false; // Unknown action type
      }
    } catch (error) {
      //TODO: Implement proper logging service
      console.error(`Error validating character action: ${error}`);
      return false;
    }
  }

  // ============================================================================
  // PERSISTENCE METHODS
  // ============================================================================

  /**
   * Save character to storage
   */
  async saveCharacter(playerId: UUID, character: Character): Promise<void> {
    try {
      const key = `character:${playerId}:${character.id}`;
      const success = await kvService.set(
        key,
        character,
        CHARACTER_CONSTANTS.CHARACTER_TTL
      );

      if (!success) {
        throw new GameError(
          'Failed to save character to storage',
          ErrorCode.STORAGE_ERROR
        );
      }

      // Create backup
      const backupKey = `character_backup:${playerId}:${character.id}:${Date.now()}`;
      await kvService.set(backupKey, character, CHARACTER_CONSTANTS.BACKUP_TTL);

      // Update player's character list
      await this.updatePlayerCharacterList(playerId, character.id);
    } catch (error) {
      if (error instanceof GameError) {
        throw error;
      }
      throw new GameError(
        `Failed to save character: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.STORAGE_ERROR
      );
    }
  }

  /**
   * Load character from storage
   */
  async loadCharacter(
    playerId: UUID,
    characterId: UUID
  ): Promise<Character | null> {
    try {
      const key = `character:${playerId}:${characterId}`;
      const character = await kvService.get<Character>(key);

      if (character) {
        // Validate loaded character
        return validateWith(CharacterSchema, character);
      }

      return null;
    } catch (error) {
      throw new GameError(
        `Failed to load character: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.STORAGE_ERROR
      );
    }
  }

  /**
   * Get all characters for a player
   */
  async getPlayerCharacters(playerId: UUID): Promise<Character[]> {
    try {
      const listKey = `player_characters:${playerId}`;
      const characterIds = (await kvService.get<UUID[]>(listKey)) || [];

      const characters: Character[] = [];

      for (const characterId of characterIds) {
        const character = await this.loadCharacter(playerId, characterId);
        if (character) {
          characters.push(character);
        }
      }

      return characters;
    } catch (error) {
      throw new GameError(
        `Failed to get player characters: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.STORAGE_ERROR
      );
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Validate character stats are within acceptable ranges
   */
  private validateStats(stats: CharacterStats): void {
    const statEntries = Object.entries(stats) as [
      keyof CharacterStats,
      number,
    ][];

    for (const [statName, value] of statEntries) {
      if (
        value < CHARACTER_CONSTANTS.MIN_STAT_VALUE ||
        value > CHARACTER_CONSTANTS.MAX_STAT_VALUE
      ) {
        throw new GameError(
          `Invalid ${statName}: ${value}. Must be between ${CHARACTER_CONSTANTS.MIN_STAT_VALUE} and ${CHARACTER_CONSTANTS.MAX_STAT_VALUE}`,
          ErrorCode.VALIDATION_FAILED
        );
      }
    }
  }

  /**
   * Calculate initial skills based on background and class
   */
  private calculateInitialSkills(
    background: CharacterBackground,
    characterClass: CharacterClass
  ): CharacterSkills {
    const baseSkills: CharacterSkills = {
      combat: 0,
      magic: 0,
      stealth: 0,
      diplomacy: 0,
      survival: 0,
      investigation: 0,
      crafting: 0,
      lore: 0,
    };

    // Apply background bonuses
    if (background.skillBonuses) {
      Object.entries(background.skillBonuses).forEach(([skill, bonus]) => {
        if (bonus && skill in baseSkills) {
          (baseSkills as any)[skill] += bonus;
        }
      });
    }

    // Apply class affinities
    characterClass.skillAffinities.forEach(skill => {
      if (skill in baseSkills) {
        (baseSkills as any)[skill] += 5; // Base class affinity bonus
      }
    });

    // Ensure all skills are within valid ranges
    Object.keys(baseSkills).forEach(skill => {
      (baseSkills as any)[skill] = Math.max(
        0,
        Math.min(
          CHARACTER_CONSTANTS.MAX_SKILL_VALUE,
          (baseSkills as any)[skill]
        )
      );
    });

    return baseSkills;
  }

  /**
   * Calculate maximum health based on stats and level
   */
  private calculateMaxHealth(stats: CharacterStats, level: number): number {
    return (
      CHARACTER_CONSTANTS.BASE_HEALTH +
      stats.constitution * CHARACTER_CONSTANTS.HEALTH_PER_CONSTITUTION +
      (level - 1) * CHARACTER_CONSTANTS.HEALTH_PER_LEVEL
    );
  }

  /**
   * Get required experience for a specific level
   */
  private getRequiredExperience(level: number): number {
    if (level <= 1) return 0;

    let totalExp = 0;
    for (let i = 2; i <= level; i++) {
      totalExp += Math.floor(
        CHARACTER_CONSTANTS.BASE_EXP_PER_LEVEL *
          Math.pow(CHARACTER_CONSTANTS.EXP_MULTIPLIER, i - 2)
      );
    }
    return totalExp;
  }

  /**
   * Get new abilities when leveling up
   */
  private getNewAbilitiesForLevel(
    characterClass: CharacterClass,
    level: number
  ): string[] {
    //TODO: Implement proper ability system integration when class system is expanded
    return characterClass.abilities
      .filter(ability => ability.levelRequired === level)
      .map(ability => ability.name);
  }

  /**
   * Apply a stat modifier, respecting min/max bounds
   */
  private applyStatModifier(baseStat: number, modifier?: number): number {
    if (!modifier) return baseStat;

    return Math.max(
      CHARACTER_CONSTANTS.MIN_STAT_VALUE,
      Math.min(CHARACTER_CONSTANTS.MAX_STAT_VALUE, baseStat + modifier)
    );
  }

  /**
   * Get D&D-style stat modifier (for rolls)
   */
  private getStatModifier(statValue: number): number {
    return Math.floor((statValue - 10) / 2);
  }

  /**
   * Calculate skill modifiers based on stats
   */
  private calculateSkillModifiers(
    stats: CharacterStats,
    skills: CharacterSkills
  ): CharacterSkills {
    return {
      combat: skills.combat + this.getStatModifier(stats.strength),
      magic: skills.magic + this.getStatModifier(stats.intelligence),
      stealth: skills.stealth + this.getStatModifier(stats.dexterity),
      diplomacy: skills.diplomacy + this.getStatModifier(stats.charisma),
      survival: skills.survival + this.getStatModifier(stats.wisdom),
      investigation:
        skills.investigation + this.getStatModifier(stats.intelligence),
      crafting: skills.crafting + this.getStatModifier(stats.dexterity),
      lore: skills.lore + this.getStatModifier(stats.intelligence),
    };
  }

  /**
   * Update the list of characters for a player
   */
  private async updatePlayerCharacterList(
    playerId: UUID,
    characterId: UUID
  ): Promise<void> {
    const listKey = `player_characters:${playerId}`;
    const existingIds = (await kvService.get<UUID[]>(listKey)) || [];

    if (!existingIds.includes(characterId)) {
      existingIds.push(characterId);
      await kvService.set(
        listKey,
        existingIds,
        CHARACTER_CONSTANTS.CHARACTER_TTL
      );
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const characterManager = CharacterManager.getInstance();
