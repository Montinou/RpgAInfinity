/**
 * Status Effects System for RPG Combat
 *
 * Manages buffs, debuffs, and conditions that affect characters during combat.
 * Handles duration tracking, effect stacking, and automatic expiration.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  StatusEffect,
  Character,
  CharacterStats,
  CharacterSkills,
  UUID,
} from '@/types/rpg';

// ============================================================================
// STATUS EFFECT TYPES & CONSTANTS
// ============================================================================

export const STATUS_EFFECT_TYPES = {
  // Stat Modifiers
  STRENGTH_BUFF: 'strength_buff',
  STRENGTH_DEBUFF: 'strength_debuff',
  DEXTERITY_BUFF: 'dexterity_buff',
  DEXTERITY_DEBUFF: 'dexterity_debuff',
  CONSTITUTION_BUFF: 'constitution_buff',
  CONSTITUTION_DEBUFF: 'constitution_debuff',
  INTELLIGENCE_BUFF: 'intelligence_buff',
  INTELLIGENCE_DEBUFF: 'intelligence_debuff',
  WISDOM_BUFF: 'wisdom_buff',
  WISDOM_DEBUFF: 'wisdom_debuff',
  CHARISMA_BUFF: 'charisma_buff',
  CHARISMA_DEBUFF: 'charisma_debuff',

  // Combat Conditions
  POISONED: 'poisoned',
  BURNING: 'burning',
  FROZEN: 'frozen',
  STUNNED: 'stunned',
  PARALYZED: 'paralyzed',
  BLESSED: 'blessed',
  CURSED: 'cursed',

  // Action Modifiers
  HASTE: 'haste',
  SLOW: 'slow',
  INVISIBLE: 'invisible',
  BLIND: 'blind',
  MUTED: 'muted',

  // Damage Over Time
  POISON_DOT: 'poison_dot',
  BURN_DOT: 'burn_dot',
  BLEED_DOT: 'bleed_dot',

  // Healing Over Time
  REGENERATION: 'regeneration',
  HEALING_AURA: 'healing_aura',

  // Resistances
  FIRE_RESISTANCE: 'fire_resistance',
  ICE_RESISTANCE: 'ice_resistance',
  LIGHTNING_RESISTANCE: 'lightning_resistance',
  MAGIC_RESISTANCE: 'magic_resistance',
  PHYSICAL_RESISTANCE: 'physical_resistance',
} as const;

export type StatusEffectType =
  (typeof STATUS_EFFECT_TYPES)[keyof typeof STATUS_EFFECT_TYPES];

const STATUS_EFFECT_CONFIG = {
  MAX_DURATION: 50,
  MAX_STACKS: 10,
  DEFAULT_TICK_INTERVAL: 1, // Turns between ticks
  PERMANENT_DURATION: -1,
} as const;

// ============================================================================
// STATUS EFFECT DEFINITIONS
// ============================================================================

export interface StatusEffectDefinition {
  readonly type: StatusEffectType;
  readonly name: string;
  readonly description: string;
  readonly category: 'buff' | 'debuff' | 'neutral';
  readonly stackable: boolean;
  readonly maxStacks: number;
  readonly defaultDuration: number;
  readonly tickInterval: number;
  readonly effects: StatusEffectModifiers;
  readonly onApply?: (character: Character, stacks: number) => void;
  readonly onTick?: (
    character: Character,
    stacks: number
  ) => { damage?: number; healing?: number };
  readonly onRemove?: (character: Character, stacks: number) => void;
}

export interface StatusEffectModifiers {
  readonly statModifiers?: Partial<CharacterStats>;
  readonly skillModifiers?: Partial<CharacterSkills>;
  readonly damageModifier?: number; // Multiplier for outgoing damage
  readonly damageReduction?: number; // Reduction for incoming damage
  readonly accuracyModifier?: number; // Bonus/penalty to hit chance
  readonly dodgeModifier?: number; // Bonus/penalty to dodge chance
  readonly actionPointModifier?: number; // Bonus/penalty to action points per turn
  readonly movementModifier?: number; // Movement speed multiplier
  readonly healingModifier?: number; // Multiplier for healing received
  readonly spellPowerModifier?: number; // Multiplier for spell damage
}

// ============================================================================
// STATUS EFFECT DEFINITIONS DATABASE
// ============================================================================

export const STATUS_EFFECT_DEFINITIONS: Record<
  StatusEffectType,
  StatusEffectDefinition
> = {
  // Stat Buffs
  [STATUS_EFFECT_TYPES.STRENGTH_BUFF]: {
    type: STATUS_EFFECT_TYPES.STRENGTH_BUFF,
    name: 'Strength Boost',
    description: 'Increased physical power and damage',
    category: 'buff',
    stackable: true,
    maxStacks: 5,
    defaultDuration: 10,
    tickInterval: 0,
    effects: {
      statModifiers: { strength: 5 },
      damageModifier: 1.2,
    },
  },

  [STATUS_EFFECT_TYPES.STRENGTH_DEBUFF]: {
    type: STATUS_EFFECT_TYPES.STRENGTH_DEBUFF,
    name: 'Weakened',
    description: 'Reduced physical power and damage',
    category: 'debuff',
    stackable: true,
    maxStacks: 5,
    defaultDuration: 10,
    tickInterval: 0,
    effects: {
      statModifiers: { strength: -5 },
      damageModifier: 0.8,
    },
  },

  [STATUS_EFFECT_TYPES.DEXTERITY_BUFF]: {
    type: STATUS_EFFECT_TYPES.DEXTERITY_BUFF,
    name: 'Agility Boost',
    description: 'Increased speed and accuracy',
    category: 'buff',
    stackable: true,
    maxStacks: 5,
    defaultDuration: 10,
    tickInterval: 0,
    effects: {
      statModifiers: { dexterity: 5 },
      accuracyModifier: 10,
      dodgeModifier: 10,
    },
  },

  [STATUS_EFFECT_TYPES.DEXTERITY_DEBUFF]: {
    type: STATUS_EFFECT_TYPES.DEXTERITY_DEBUFF,
    name: 'Sluggish',
    description: 'Reduced speed and accuracy',
    category: 'debuff',
    stackable: true,
    maxStacks: 5,
    defaultDuration: 10,
    tickInterval: 0,
    effects: {
      statModifiers: { dexterity: -5 },
      accuracyModifier: -10,
      dodgeModifier: -10,
    },
  },

  [STATUS_EFFECT_TYPES.CONSTITUTION_BUFF]: {
    type: STATUS_EFFECT_TYPES.CONSTITUTION_BUFF,
    name: 'Fortified',
    description: 'Increased health and damage resistance',
    category: 'buff',
    stackable: true,
    maxStacks: 5,
    defaultDuration: 15,
    tickInterval: 0,
    effects: {
      statModifiers: { constitution: 5 },
      damageReduction: 2,
      healingModifier: 1.2,
    },
  },

  [STATUS_EFFECT_TYPES.CONSTITUTION_DEBUFF]: {
    type: STATUS_EFFECT_TYPES.CONSTITUTION_DEBUFF,
    name: 'Frail',
    description: 'Reduced health and damage resistance',
    category: 'debuff',
    stackable: true,
    maxStacks: 5,
    defaultDuration: 15,
    tickInterval: 0,
    effects: {
      statModifiers: { constitution: -5 },
      damageReduction: -2,
      healingModifier: 0.8,
    },
  },

  [STATUS_EFFECT_TYPES.INTELLIGENCE_BUFF]: {
    type: STATUS_EFFECT_TYPES.INTELLIGENCE_BUFF,
    name: 'Mental Clarity',
    description: 'Enhanced magical power and mana',
    category: 'buff',
    stackable: true,
    maxStacks: 5,
    defaultDuration: 12,
    tickInterval: 0,
    effects: {
      statModifiers: { intelligence: 5 },
      spellPowerModifier: 1.3,
    },
  },

  [STATUS_EFFECT_TYPES.INTELLIGENCE_DEBUFF]: {
    type: STATUS_EFFECT_TYPES.INTELLIGENCE_DEBUFF,
    name: 'Mind Fog',
    description: 'Reduced magical power and mana',
    category: 'debuff',
    stackable: true,
    maxStacks: 5,
    defaultDuration: 12,
    tickInterval: 0,
    effects: {
      statModifiers: { intelligence: -5 },
      spellPowerModifier: 0.7,
    },
  },

  [STATUS_EFFECT_TYPES.WISDOM_BUFF]: {
    type: STATUS_EFFECT_TYPES.WISDOM_BUFF,
    name: 'Enlightened',
    description: 'Enhanced perception and insight',
    category: 'buff',
    stackable: true,
    maxStacks: 3,
    defaultDuration: 20,
    tickInterval: 0,
    effects: {
      statModifiers: { wisdom: 5 },
      skillModifiers: { investigation: 10, lore: 10 },
    },
  },

  [STATUS_EFFECT_TYPES.WISDOM_DEBUFF]: {
    type: STATUS_EFFECT_TYPES.WISDOM_DEBUFF,
    name: 'Confused',
    description: 'Impaired judgment and perception',
    category: 'debuff',
    stackable: true,
    maxStacks: 3,
    defaultDuration: 8,
    tickInterval: 0,
    effects: {
      statModifiers: { wisdom: -5 },
      skillModifiers: { investigation: -10, lore: -10 },
    },
  },

  [STATUS_EFFECT_TYPES.CHARISMA_BUFF]: {
    type: STATUS_EFFECT_TYPES.CHARISMA_BUFF,
    name: 'Inspiring Presence',
    description: 'Enhanced leadership and persuasion',
    category: 'buff',
    stackable: true,
    maxStacks: 3,
    defaultDuration: 15,
    tickInterval: 0,
    effects: {
      statModifiers: { charisma: 5 },
      skillModifiers: { diplomacy: 15 },
    },
  },

  [STATUS_EFFECT_TYPES.CHARISMA_DEBUFF]: {
    type: STATUS_EFFECT_TYPES.CHARISMA_DEBUFF,
    name: 'Intimidated',
    description: 'Reduced confidence and social skills',
    category: 'debuff',
    stackable: true,
    maxStacks: 3,
    defaultDuration: 10,
    tickInterval: 0,
    effects: {
      statModifiers: { charisma: -5 },
      skillModifiers: { diplomacy: -15 },
    },
  },

  // Combat Conditions
  [STATUS_EFFECT_TYPES.POISONED]: {
    type: STATUS_EFFECT_TYPES.POISONED,
    name: 'Poisoned',
    description: 'Taking damage over time from toxins',
    category: 'debuff',
    stackable: true,
    maxStacks: 10,
    defaultDuration: 8,
    tickInterval: 1,
    effects: {
      healingModifier: 0.5,
    },
    onTick: (character: Character, stacks: number) => {
      return { damage: stacks * 2 };
    },
  },

  [STATUS_EFFECT_TYPES.BURNING]: {
    type: STATUS_EFFECT_TYPES.BURNING,
    name: 'Burning',
    description: 'Taking fire damage over time',
    category: 'debuff',
    stackable: true,
    maxStacks: 5,
    defaultDuration: 5,
    tickInterval: 1,
    effects: {},
    onTick: (character: Character, stacks: number) => {
      return { damage: stacks * 3 };
    },
  },

  [STATUS_EFFECT_TYPES.FROZEN]: {
    type: STATUS_EFFECT_TYPES.FROZEN,
    name: 'Frozen',
    description: 'Cannot move or act, takes extra damage',
    category: 'debuff',
    stackable: false,
    maxStacks: 1,
    defaultDuration: 3,
    tickInterval: 0,
    effects: {
      actionPointModifier: -999, // Effectively prevents actions
      movementModifier: 0,
      damageReduction: -5,
    },
  },

  [STATUS_EFFECT_TYPES.STUNNED]: {
    type: STATUS_EFFECT_TYPES.STUNNED,
    name: 'Stunned',
    description: 'Cannot act for a short time',
    category: 'debuff',
    stackable: false,
    maxStacks: 1,
    defaultDuration: 2,
    tickInterval: 0,
    effects: {
      actionPointModifier: -999,
    },
  },

  [STATUS_EFFECT_TYPES.PARALYZED]: {
    type: STATUS_EFFECT_TYPES.PARALYZED,
    name: 'Paralyzed',
    description: 'Cannot move or perform physical actions',
    category: 'debuff',
    stackable: false,
    maxStacks: 1,
    defaultDuration: 4,
    tickInterval: 0,
    effects: {
      movementModifier: 0,
      accuracyModifier: -50,
      dodgeModifier: -50,
    },
  },

  [STATUS_EFFECT_TYPES.BLESSED]: {
    type: STATUS_EFFECT_TYPES.BLESSED,
    name: 'Blessed',
    description: 'Divine protection enhances all abilities',
    category: 'buff',
    stackable: false,
    maxStacks: 1,
    defaultDuration: 20,
    tickInterval: 0,
    effects: {
      damageModifier: 1.1,
      accuracyModifier: 10,
      dodgeModifier: 10,
      healingModifier: 1.5,
    },
  },

  [STATUS_EFFECT_TYPES.CURSED]: {
    type: STATUS_EFFECT_TYPES.CURSED,
    name: 'Cursed',
    description: 'Dark magic weakens all abilities',
    category: 'debuff',
    stackable: false,
    maxStacks: 1,
    defaultDuration: 15,
    tickInterval: 0,
    effects: {
      damageModifier: 0.9,
      accuracyModifier: -10,
      dodgeModifier: -10,
      healingModifier: 0.5,
    },
  },

  // Action Modifiers
  [STATUS_EFFECT_TYPES.HASTE]: {
    type: STATUS_EFFECT_TYPES.HASTE,
    name: 'Haste',
    description: 'Increased speed and extra actions',
    category: 'buff',
    stackable: false,
    maxStacks: 1,
    defaultDuration: 8,
    tickInterval: 0,
    effects: {
      actionPointModifier: 1,
      movementModifier: 2.0,
      statModifiers: { dexterity: 10 },
    },
  },

  [STATUS_EFFECT_TYPES.SLOW]: {
    type: STATUS_EFFECT_TYPES.SLOW,
    name: 'Slow',
    description: 'Reduced speed and fewer actions',
    category: 'debuff',
    stackable: false,
    maxStacks: 1,
    defaultDuration: 6,
    tickInterval: 0,
    effects: {
      actionPointModifier: -1,
      movementModifier: 0.5,
      statModifiers: { dexterity: -10 },
    },
  },

  [STATUS_EFFECT_TYPES.INVISIBLE]: {
    type: STATUS_EFFECT_TYPES.INVISIBLE,
    name: 'Invisible',
    description: 'Cannot be targeted by most attacks',
    category: 'buff',
    stackable: false,
    maxStacks: 1,
    defaultDuration: 6,
    tickInterval: 0,
    effects: {
      dodgeModifier: 50,
      accuracyModifier: 20, // Sneak attack bonus
    },
  },

  [STATUS_EFFECT_TYPES.BLIND]: {
    type: STATUS_EFFECT_TYPES.BLIND,
    name: 'Blind',
    description: 'Cannot see, severely reduced accuracy',
    category: 'debuff',
    stackable: false,
    maxStacks: 1,
    defaultDuration: 5,
    tickInterval: 0,
    effects: {
      accuracyModifier: -75,
      skillModifiers: { investigation: -50 },
    },
  },

  [STATUS_EFFECT_TYPES.MUTED]: {
    type: STATUS_EFFECT_TYPES.MUTED,
    name: 'Muted',
    description: 'Cannot cast spells or use vocal abilities',
    category: 'debuff',
    stackable: false,
    maxStacks: 1,
    defaultDuration: 4,
    tickInterval: 0,
    effects: {
      spellPowerModifier: 0, // Cannot cast spells
      skillModifiers: { diplomacy: -30 },
    },
  },

  // Damage Over Time
  [STATUS_EFFECT_TYPES.POISON_DOT]: {
    type: STATUS_EFFECT_TYPES.POISON_DOT,
    name: 'Toxic Poison',
    description: 'Deadly poison coursing through veins',
    category: 'debuff',
    stackable: true,
    maxStacks: 5,
    defaultDuration: 10,
    tickInterval: 1,
    effects: {
      healingModifier: 0.3,
    },
    onTick: (character: Character, stacks: number) => {
      return { damage: Math.min(stacks * 4, character.maxHealth * 0.1) };
    },
  },

  [STATUS_EFFECT_TYPES.BURN_DOT]: {
    type: STATUS_EFFECT_TYPES.BURN_DOT,
    name: 'Searing Flames',
    description: 'Intense fire burning from within',
    category: 'debuff',
    stackable: true,
    maxStacks: 3,
    defaultDuration: 6,
    tickInterval: 1,
    effects: {},
    onTick: (character: Character, stacks: number) => {
      return { damage: stacks * 6 };
    },
  },

  [STATUS_EFFECT_TYPES.BLEED_DOT]: {
    type: STATUS_EFFECT_TYPES.BLEED_DOT,
    name: 'Deep Wounds',
    description: 'Bleeding from severe injuries',
    category: 'debuff',
    stackable: true,
    maxStacks: 8,
    defaultDuration: 12,
    tickInterval: 1,
    effects: {
      statModifiers: { constitution: -2 },
    },
    onTick: (character: Character, stacks: number) => {
      return { damage: stacks * 2 };
    },
  },

  // Healing Over Time
  [STATUS_EFFECT_TYPES.REGENERATION]: {
    type: STATUS_EFFECT_TYPES.REGENERATION,
    name: 'Regeneration',
    description: 'Slowly healing over time',
    category: 'buff',
    stackable: true,
    maxStacks: 5,
    defaultDuration: 15,
    tickInterval: 1,
    effects: {},
    onTick: (character: Character, stacks: number) => {
      return { healing: stacks * 3 };
    },
  },

  [STATUS_EFFECT_TYPES.HEALING_AURA]: {
    type: STATUS_EFFECT_TYPES.HEALING_AURA,
    name: 'Healing Aura',
    description: 'Divine energy restoring health',
    category: 'buff',
    stackable: false,
    maxStacks: 1,
    defaultDuration: 10,
    tickInterval: 2,
    effects: {
      healingModifier: 1.3,
    },
    onTick: (character: Character, stacks: number) => {
      return { healing: Math.max(5, character.maxHealth * 0.05) };
    },
  },

  // Resistances
  [STATUS_EFFECT_TYPES.FIRE_RESISTANCE]: {
    type: STATUS_EFFECT_TYPES.FIRE_RESISTANCE,
    name: 'Fire Resistance',
    description: 'Reduced damage from fire attacks',
    category: 'buff',
    stackable: true,
    maxStacks: 3,
    defaultDuration: 20,
    tickInterval: 0,
    effects: {
      damageReduction: 5, // Reduced fire damage (would need type-specific implementation)
    },
  },

  [STATUS_EFFECT_TYPES.ICE_RESISTANCE]: {
    type: STATUS_EFFECT_TYPES.ICE_RESISTANCE,
    name: 'Ice Resistance',
    description: 'Reduced damage from ice attacks',
    category: 'buff',
    stackable: true,
    maxStacks: 3,
    defaultDuration: 20,
    tickInterval: 0,
    effects: {
      damageReduction: 5, // Reduced ice damage
    },
  },

  [STATUS_EFFECT_TYPES.LIGHTNING_RESISTANCE]: {
    type: STATUS_EFFECT_TYPES.LIGHTNING_RESISTANCE,
    name: 'Lightning Resistance',
    description: 'Reduced damage from lightning attacks',
    category: 'buff',
    stackable: true,
    maxStacks: 3,
    defaultDuration: 20,
    tickInterval: 0,
    effects: {
      damageReduction: 5, // Reduced lightning damage
    },
  },

  [STATUS_EFFECT_TYPES.MAGIC_RESISTANCE]: {
    type: STATUS_EFFECT_TYPES.MAGIC_RESISTANCE,
    name: 'Magic Resistance',
    description: 'Reduced damage from magical attacks',
    category: 'buff',
    stackable: true,
    maxStacks: 5,
    defaultDuration: 25,
    tickInterval: 0,
    effects: {
      damageReduction: 3, // Reduced magical damage
    },
  },

  [STATUS_EFFECT_TYPES.PHYSICAL_RESISTANCE]: {
    type: STATUS_EFFECT_TYPES.PHYSICAL_RESISTANCE,
    name: 'Physical Resistance',
    description: 'Reduced damage from physical attacks',
    category: 'buff',
    stackable: true,
    maxStacks: 5,
    defaultDuration: 25,
    tickInterval: 0,
    effects: {
      damageReduction: 3, // Reduced physical damage
    },
  },
};

// ============================================================================
// STATUS EFFECT MANAGER
// ============================================================================

export class StatusEffectManager {
  private static instance: StatusEffectManager;
  private turnCounters: Map<UUID, number> = new Map();

  private constructor() {}

  static getInstance(): StatusEffectManager {
    if (!StatusEffectManager.instance) {
      StatusEffectManager.instance = new StatusEffectManager();
    }
    return StatusEffectManager.instance;
  }

  /**
   * Apply a status effect to a character
   */
  applyStatusEffect(
    character: Character,
    effectType: StatusEffectType,
    duration?: number,
    stacks: number = 1
  ): StatusEffect[] {
    const definition = STATUS_EFFECT_DEFINITIONS[effectType];
    if (!definition) {
      console.warn(`Unknown status effect type: ${effectType}`);
      return character.statusEffects;
    }

    const effectDuration = duration || definition.defaultDuration;
    const updatedEffects = [...character.statusEffects];

    if (definition.stackable) {
      // Find existing effect of same type
      const existingIndex = updatedEffects.findIndex(
        effect => effect.name === definition.name
      );

      if (existingIndex >= 0) {
        const existing = updatedEffects[existingIndex];
        const newStacks = Math.min(
          definition.maxStacks,
          this.getStackCount(existing) + stacks
        );

        // Update existing effect with new stacks and refresh duration
        updatedEffects[existingIndex] = {
          ...existing,
          duration: Math.max(existing.duration, effectDuration),
          effects: this.calculateStackedEffects(definition.effects, newStacks),
        };
      } else {
        // Add new stackable effect
        const newEffect = this.createStatusEffect(
          definition,
          effectDuration,
          stacks
        );
        updatedEffects.push(newEffect);
      }
    } else {
      // Non-stackable: replace existing or add new
      const existingIndex = updatedEffects.findIndex(
        effect => effect.name === definition.name
      );
      const newEffect = this.createStatusEffect(definition, effectDuration, 1);

      if (existingIndex >= 0) {
        updatedEffects[existingIndex] = newEffect;
      } else {
        updatedEffects.push(newEffect);
      }
    }

    // Apply onApply callback if present
    if (definition.onApply) {
      definition.onApply(character, stacks);
    }

    return updatedEffects;
  }

  /**
   * Remove a specific status effect from character
   */
  removeStatusEffect(character: Character, effectName: string): StatusEffect[] {
    const effectIndex = character.statusEffects.findIndex(
      effect => effect.name === effectName
    );
    if (effectIndex === -1) {
      return character.statusEffects;
    }

    const removedEffect = character.statusEffects[effectIndex];
    const definition = this.getDefinitionByName(effectName);

    // Apply onRemove callback if present
    if (definition && definition.onRemove) {
      definition.onRemove(character, this.getStackCount(removedEffect));
    }

    return character.statusEffects.filter((_, index) => index !== effectIndex);
  }

  /**
   * Process status effect ticks for a character (called each turn)
   */
  processStatusEffectTicks(character: Character): {
    updatedEffects: StatusEffect[];
    tickResults: Array<{
      damage?: number;
      healing?: number;
      description: string;
    }>;
  } {
    const characterTurn = this.turnCounters.get(character.id) || 0;
    this.turnCounters.set(character.id, characterTurn + 1);

    const updatedEffects: StatusEffect[] = [];
    const tickResults: Array<{
      damage?: number;
      healing?: number;
      description: string;
    }> = [];

    for (const effect of character.statusEffects) {
      const definition = this.getDefinitionByName(effect.name);
      if (!definition) {
        continue;
      }

      // Reduce duration
      const newDuration = effect.duration - 1;

      // Check if effect should tick
      const shouldTick =
        definition.tickInterval > 0 &&
        characterTurn % definition.tickInterval === 0 &&
        definition.onTick;

      // Process tick effect
      if (shouldTick && definition.onTick) {
        const stacks = this.getStackCount(effect);
        const tickResult = definition.onTick(character, stacks);

        if (tickResult.damage || tickResult.healing) {
          tickResults.push({
            ...tickResult,
            description: `${effect.name} ${tickResult.damage ? 'deals damage' : 'provides healing'}`,
          });
        }
      }

      // Keep effect if duration remains
      if (newDuration > 0) {
        updatedEffects.push({
          ...effect,
          duration: newDuration,
        });
      } else {
        // Effect expired, call onRemove if present
        if (definition.onRemove) {
          definition.onRemove(character, this.getStackCount(effect));
        }
        tickResults.push({
          description: `${effect.name} has worn off`,
        });
      }
    }

    return { updatedEffects, tickResults };
  }

  /**
   * Get all active status effect modifiers for a character
   */
  getStatusEffectModifiers(character: Character): StatusEffectModifiers {
    const combinedModifiers: StatusEffectModifiers = {
      statModifiers: {},
      skillModifiers: {},
      damageModifier: 1,
      damageReduction: 0,
      accuracyModifier: 0,
      dodgeModifier: 0,
      actionPointModifier: 0,
      movementModifier: 1,
      healingModifier: 1,
      spellPowerModifier: 1,
    };

    for (const effect of character.statusEffects) {
      const definition = this.getDefinitionByName(effect.name);
      if (!definition) continue;

      const stacks = this.getStackCount(effect);
      const effectModifiers = this.calculateStackedEffects(
        definition.effects,
        stacks
      );

      // Combine stat modifiers
      if (effectModifiers.statModifiers) {
        Object.entries(effectModifiers.statModifiers).forEach(
          ([stat, value]) => {
            if (value !== undefined) {
              const currentValue =
                (combinedModifiers.statModifiers as any)[stat] || 0;
              (combinedModifiers.statModifiers as any)[stat] =
                currentValue + value;
            }
          }
        );
      }

      // Combine skill modifiers
      if (effectModifiers.skillModifiers) {
        Object.entries(effectModifiers.skillModifiers).forEach(
          ([skill, value]) => {
            if (value !== undefined) {
              const currentValue =
                (combinedModifiers.skillModifiers as any)[skill] || 0;
              (combinedModifiers.skillModifiers as any)[skill] =
                currentValue + value;
            }
          }
        );
      }

      // Combine multiplicative modifiers
      if (effectModifiers.damageModifier !== undefined) {
        combinedModifiers.damageModifier! *= effectModifiers.damageModifier;
      }
      if (effectModifiers.healingModifier !== undefined) {
        combinedModifiers.healingModifier! *= effectModifiers.healingModifier;
      }
      if (effectModifiers.spellPowerModifier !== undefined) {
        combinedModifiers.spellPowerModifier! *=
          effectModifiers.spellPowerModifier;
      }
      if (effectModifiers.movementModifier !== undefined) {
        combinedModifiers.movementModifier! *= effectModifiers.movementModifier;
      }

      // Combine additive modifiers
      if (effectModifiers.damageReduction !== undefined) {
        combinedModifiers.damageReduction! += effectModifiers.damageReduction;
      }
      if (effectModifiers.accuracyModifier !== undefined) {
        combinedModifiers.accuracyModifier! += effectModifiers.accuracyModifier;
      }
      if (effectModifiers.dodgeModifier !== undefined) {
        combinedModifiers.dodgeModifier! += effectModifiers.dodgeModifier;
      }
      if (effectModifiers.actionPointModifier !== undefined) {
        combinedModifiers.actionPointModifier! +=
          effectModifiers.actionPointModifier;
      }
    }

    return combinedModifiers;
  }

  /**
   * Clear all status effects from character
   */
  clearAllStatusEffects(character: Character): StatusEffect[] {
    // Call onRemove for all effects
    for (const effect of character.statusEffects) {
      const definition = this.getDefinitionByName(effect.name);
      if (definition && definition.onRemove) {
        definition.onRemove(character, this.getStackCount(effect));
      }
    }

    return [];
  }

  /**
   * Get human-readable description of character's status effects
   */
  getStatusEffectSummary(character: Character): string {
    if (character.statusEffects.length === 0) {
      return 'No status effects';
    }

    const descriptions = character.statusEffects.map(effect => {
      const stacks = this.getStackCount(effect);
      const stackText = stacks > 1 ? ` (${stacks} stacks)` : '';
      return `${effect.name}${stackText} (${effect.duration} turns)`;
    });

    return descriptions.join(', ');
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private createStatusEffect(
    definition: StatusEffectDefinition,
    duration: number,
    stacks: number
  ): StatusEffect {
    return {
      id: uuidv4(),
      name: definition.name,
      description: definition.description,
      type: definition.category,
      duration,
      effects: this.calculateStackedEffects(definition.effects, stacks),
      stackable: definition.stackable,
    };
  }

  private calculateStackedEffects(
    baseEffects: StatusEffectModifiers,
    stacks: number
  ): Record<string, number> {
    const stackedEffects: Record<string, number> = {};

    // Apply stacking to all numeric modifiers
    Object.entries(baseEffects).forEach(([key, value]) => {
      if (typeof value === 'number') {
        if (
          key.includes('Modifier') &&
          (key.includes('damage') ||
            key.includes('healing') ||
            key.includes('movement'))
        ) {
          // Multiplicative modifiers: compound stacking
          stackedEffects[key] = Math.pow(value as number, stacks);
        } else {
          // Additive modifiers: linear stacking
          stackedEffects[key] = (value as number) * stacks;
        }
      } else if (typeof value === 'object' && value !== null) {
        // Handle nested objects (stat/skill modifiers)
        Object.entries(value).forEach(([nestedKey, nestedValue]) => {
          if (typeof nestedValue === 'number') {
            stackedEffects[`${key}.${nestedKey}`] = nestedValue * stacks;
          }
        });
      }
    });

    return stackedEffects;
  }

  private getStackCount(effect: StatusEffect): number {
    // Extract stack count from effect properties
    // For now, we'll use a simple approach - look for stack indicators in effects
    const stacksFromEffects = Object.keys(effect.effects).length > 0 ? 1 : 1;

    //TODO: Implement proper stack tracking in StatusEffect interface
    return stacksFromEffects;
  }

  private getDefinitionByName(
    effectName: string
  ): StatusEffectDefinition | undefined {
    return Object.values(STATUS_EFFECT_DEFINITIONS).find(
      def => def.name === effectName
    );
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const statusEffectManager = StatusEffectManager.getInstance();
export default statusEffectManager;
