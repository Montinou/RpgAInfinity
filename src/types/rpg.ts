/**
 * RPG-specific type definitions for RpgAInfinity
 * Extends core types with RPG game mechanics
 */

import { z } from 'zod';
import {
  GameConfig,
  GameState,
  GameAction,
  Player,
  UUID,
  Timestamp,
  JSONValue,
  UUIDSchema,
  TimestampSchema,
  JSONValueSchema,
} from './core';

// ============================================================================
// RPG GAME CONFIGURATION
// ============================================================================

export interface RPGConfig extends GameConfig {
  readonly type: 'rpg';
  readonly settings: {
    readonly worldTheme: string;
    readonly difficulty: 'easy' | 'medium' | 'hard' | 'custom';
    readonly combatEnabled: boolean;
    readonly permaDeath: boolean;
    readonly voiceActing: boolean;
    readonly narrativeStyle:
      | 'epic'
      | 'dark'
      | 'humorous'
      | 'mystery'
      | 'adventure';
    readonly allowCustomCharacters: boolean;
    readonly maxLevel: number;
    readonly startingLevel: number;
  };
}

export const RPGConfigSchema = z.object({
  type: z.literal('rpg'),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  maxPlayers: z.number().int().min(1).max(8),
  minPlayers: z.number().int().min(1).max(8),
  estimatedDurationMinutes: z.number().int().min(30).max(480),
  isPrivate: z.boolean(),
  settings: z.object({
    worldTheme: z.string().min(1).max(100),
    difficulty: z.enum(['easy', 'medium', 'hard', 'custom']),
    combatEnabled: z.boolean(),
    permaDeath: z.boolean(),
    voiceActing: z.boolean(),
    narrativeStyle: z.enum([
      'epic',
      'dark',
      'humorous',
      'mystery',
      'adventure',
    ]),
    allowCustomCharacters: z.boolean(),
    maxLevel: z.number().int().min(1).max(100),
    startingLevel: z.number().int().min(1).max(20),
  }),
});

// ============================================================================
// WORLD & LOCATION SYSTEM
// ============================================================================

export interface WorldData {
  readonly id: UUID;
  readonly name: string;
  readonly description: string;
  readonly theme: string;
  readonly lore: string;
  readonly locations: Location[];
  readonly globalEvents: WorldEvent[];
  readonly npcs: NPC[];
  readonly factions: Faction[];
}

export interface Location {
  readonly id: UUID;
  readonly name: string;
  readonly description: string;
  readonly type: LocationType;
  readonly connections: UUID[]; // Connected location IDs
  readonly features: LocationFeature[];
  readonly npcs: UUID[]; // NPC IDs present at this location
  readonly items: Item[];
  readonly secrets: Secret[];
  readonly isDiscovered: boolean;
}

export type LocationType =
  | 'town'
  | 'dungeon'
  | 'forest'
  | 'mountain'
  | 'cave'
  | 'castle'
  | 'temple'
  | 'ruins'
  | 'tavern'
  | 'shop'
  | 'wilderness'
  | 'custom';

export interface LocationFeature {
  readonly id: UUID;
  readonly name: string;
  readonly description: string;
  readonly type: 'interactive' | 'decorative' | 'hazard' | 'treasure';
  readonly interactionType?: 'examine' | 'use' | 'climb' | 'open' | 'cast';
  readonly requirements?: string[]; // Skills, items, or conditions required
  readonly effects?: Record<string, JSONValue>;
}

// ============================================================================
// CHARACTER SYSTEM
// ============================================================================

export interface RPGPlayer extends Player {
  readonly gameSpecificData: {
    readonly character: Character;
    readonly inventory: Inventory;
    readonly questLog: Quest[];
    readonly relationships: Record<UUID, number>; // NPC ID -> relationship value
    readonly discoveries: UUID[]; // Location/secret IDs discovered
  };
}

export interface Character {
  readonly id: UUID;
  readonly name: string;
  readonly race: CharacterRace;
  readonly class: CharacterClass;
  readonly level: number;
  readonly experience: number;
  readonly stats: CharacterStats;
  readonly skills: CharacterSkills;
  readonly traits: CharacterTrait[];
  readonly background: CharacterBackground;
  readonly currentHealth: number;
  readonly maxHealth: number;
  readonly statusEffects: StatusEffect[];
}

export interface CharacterStats {
  readonly strength: number;
  readonly dexterity: number;
  readonly constitution: number;
  readonly intelligence: number;
  readonly wisdom: number;
  readonly charisma: number;
  readonly luck: number;
}

export interface CharacterSkills {
  readonly combat: number;
  readonly magic: number;
  readonly stealth: number;
  readonly diplomacy: number;
  readonly survival: number;
  readonly investigation: number;
  readonly crafting: number;
  readonly lore: number;
}

export interface CharacterRace {
  readonly name: string;
  readonly description: string;
  readonly statModifiers: Partial<CharacterStats>;
  readonly abilities: RacialAbility[];
  readonly restrictions: string[];
}

export interface CharacterClass {
  readonly name: string;
  readonly description: string;
  readonly primaryStat: keyof CharacterStats;
  readonly skillAffinities: (keyof CharacterSkills)[];
  readonly abilities: ClassAbility[];
  readonly equipment: string[]; // Starting equipment types
}

export interface CharacterTrait {
  readonly name: string;
  readonly description: string;
  readonly type: 'positive' | 'negative' | 'neutral';
  readonly effects: Record<string, JSONValue>;
}

export interface CharacterBackground {
  readonly name: string;
  readonly description: string;
  readonly skillBonuses: Partial<CharacterSkills>;
  readonly startingEquipment: string[];
  readonly connections: string[]; // Social connections
}

// ============================================================================
// INVENTORY & ITEMS
// ============================================================================

export interface Inventory {
  readonly capacity: number;
  readonly items: InventoryItem[];
  readonly equipment: Equipment;
  readonly currency: number;
}

export interface InventoryItem {
  readonly item: Item;
  readonly quantity: number;
  readonly condition?:
    | 'broken'
    | 'damaged'
    | 'good'
    | 'excellent'
    | 'legendary';
}

export interface Item {
  readonly id: UUID;
  readonly name: string;
  readonly description: string;
  readonly type: ItemType;
  readonly rarity: ItemRarity;
  readonly value: number;
  readonly weight: number;
  readonly properties: ItemProperties;
  readonly requirements?: ItemRequirements;
  readonly effects?: ItemEffect[];
}

export type ItemType =
  | 'weapon'
  | 'armor'
  | 'accessory'
  | 'consumable'
  | 'tool'
  | 'quest'
  | 'misc';

export type ItemRarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'artifact';

export interface Equipment {
  readonly mainHand?: Item;
  readonly offHand?: Item;
  readonly armor?: Item;
  readonly helmet?: Item;
  readonly gloves?: Item;
  readonly boots?: Item;
  readonly accessories: Item[];
}

export interface ItemProperties {
  readonly stackable: boolean;
  readonly consumable: boolean;
  readonly equipable: boolean;
  readonly tradeable: boolean;
  readonly questItem: boolean;
}

export interface ItemRequirements {
  readonly level?: number;
  readonly stats?: Partial<CharacterStats>;
  readonly skills?: Partial<CharacterSkills>;
  readonly race?: string[];
  readonly class?: string[];
}

export interface ItemEffect {
  readonly type:
    | 'stat_modifier'
    | 'skill_modifier'
    | 'special_ability'
    | 'status_effect';
  readonly target: string;
  readonly value: number | string;
  readonly duration?: 'permanent' | 'combat' | number; // Number of turns/minutes
}

// ============================================================================
// COMBAT SYSTEM
// ============================================================================

export interface CombatSession {
  readonly id: UUID;
  readonly participants: CombatParticipant[];
  readonly currentTurn: number;
  readonly turnOrder: UUID[];
  readonly currentParticipant: UUID;
  readonly environment: CombatEnvironment;
  readonly status: 'active' | 'ended';
  readonly log: CombatLogEntry[];
}

export interface CombatParticipant {
  readonly id: UUID;
  readonly type: 'player' | 'npc' | 'monster';
  readonly character: Character;
  readonly position: CombatPosition;
  readonly actionPoints: number;
  readonly maxActionPoints: number;
  readonly hasActed: boolean;
}

export interface CombatPosition {
  readonly x: number;
  readonly y: number;
  readonly zone: 'front' | 'middle' | 'back';
}

export interface CombatEnvironment {
  readonly type: string;
  readonly modifiers: EnvironmentModifier[];
  readonly hazards: EnvironmentHazard[];
  readonly size: { width: number; height: number };
}

export interface CombatAction extends GameAction {
  readonly type: CombatActionType;
  readonly data: {
    readonly targetId?: UUID;
    readonly position?: CombatPosition;
    readonly itemId?: UUID;
    readonly spellId?: UUID;
    readonly skillUsed?: keyof CharacterSkills;
  };
}

export type CombatActionType =
  | 'attack'
  | 'defend'
  | 'move'
  | 'cast_spell'
  | 'use_item'
  | 'flee'
  | 'wait';

// ============================================================================
// QUEST SYSTEM
// ============================================================================

export interface Quest {
  readonly id: UUID;
  readonly title: string;
  readonly description: string;
  readonly type: QuestType;
  readonly status: QuestStatus;
  readonly objectives: QuestObjective[];
  readonly rewards: QuestReward[];
  readonly giver: UUID; // NPC ID
  readonly location: UUID; // Location ID
  readonly timeLimit?: number; // Minutes
  readonly prerequisites?: QuestPrerequisite[];
}

export type QuestType =
  | 'main'
  | 'side'
  | 'personal'
  | 'faction'
  | 'discovery'
  | 'fetch'
  | 'escort';
export type QuestStatus =
  | 'available'
  | 'active'
  | 'completed'
  | 'failed'
  | 'expired';

export interface QuestObjective {
  readonly id: UUID;
  readonly description: string;
  readonly type:
    | 'kill'
    | 'collect'
    | 'deliver'
    | 'explore'
    | 'talk'
    | 'survive'
    | 'custom';
  readonly target?: string;
  readonly requiredCount: number;
  readonly currentCount: number;
  readonly isCompleted: boolean;
  readonly isOptional: boolean;
}

export interface QuestReward {
  readonly type: 'experience' | 'currency' | 'item' | 'skill' | 'reputation';
  readonly amount: number;
  readonly itemId?: UUID;
  readonly skillType?: keyof CharacterSkills;
  readonly factionId?: UUID;
}

// ============================================================================
// NPC & AI SYSTEM
// ============================================================================

export interface NPC {
  readonly id: UUID;
  readonly name: string;
  readonly description: string;
  readonly character: Character;
  readonly personality: NPCPersonality;
  readonly currentLocation: UUID;
  readonly behavior: NPCBehavior;
  readonly dialogue: NPCDialogue;
  readonly quests: UUID[]; // Quest IDs this NPC provides
  readonly shop?: NPCShop;
  readonly faction?: UUID;
  readonly relationships: Record<UUID, number>; // Player ID -> relationship value
}

export interface NPCPersonality {
  readonly traits: string[];
  readonly alignment: 'good' | 'neutral' | 'evil';
  readonly disposition:
    | 'friendly'
    | 'neutral'
    | 'hostile'
    | 'suspicious'
    | 'helpful';
  readonly motivations: string[];
  readonly fears: string[];
  readonly secrets: string[];
}

export interface NPCBehavior {
  readonly routine: ScheduleEntry[];
  readonly combatStyle?: 'aggressive' | 'defensive' | 'tactical' | 'support';
  readonly fleeThreshold?: number; // Health percentage to flee
  readonly alliances: UUID[]; // Allied NPC/faction IDs
  readonly enemies: UUID[]; // Enemy NPC/faction IDs
}

export interface ScheduleEntry {
  readonly time: string; // Format: "HH:MM"
  readonly activity: string;
  readonly location: UUID;
  readonly duration: number; // Minutes
}

export interface NPCDialogue {
  readonly greetings: DialogueOption[];
  readonly conversations: Record<string, DialogueTree>;
  readonly farewells: string[];
  readonly combat: string[];
  readonly merchant?: string[];
}

export interface DialogueOption {
  readonly text: string;
  readonly conditions?: DialogueCondition[];
  readonly effects?: DialogueEffect[];
  readonly responses?: DialogueOption[];
}

export interface DialogueTree {
  readonly root: DialogueOption;
  readonly branches: Record<string, DialogueOption[]>;
}

// ============================================================================
// RPG GAME STATE
// ============================================================================

export interface RPGGameState extends GameState {
  readonly phase: RPGPhase;
  readonly data: {
    readonly world: WorldData;
    readonly currentLocation: UUID;
    readonly timeOfDay: number; // 0-23 hours
    readonly dayCount: number;
    readonly weather: WeatherCondition;
    readonly activeCombat?: CombatSession;
    readonly globalFlags: Record<string, boolean>;
    readonly partyInventory: Inventory;
    readonly partyReputation: Record<UUID, number>; // Faction ID -> reputation
  };
}

export type RPGPhase =
  | 'character_creation'
  | 'world_generation'
  | 'exploration'
  | 'conversation'
  | 'combat'
  | 'rest'
  | 'shopping'
  | 'quest_completion';

export interface WeatherCondition {
  readonly type: 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog';
  readonly intensity: 'light' | 'moderate' | 'heavy';
  readonly effects: EnvironmentModifier[];
}

// ============================================================================
// SUPPORTING TYPES
// ============================================================================

export interface StatusEffect {
  readonly id: UUID;
  readonly name: string;
  readonly description: string;
  readonly type: 'buff' | 'debuff' | 'neutral';
  readonly duration: number; // Turns or minutes remaining
  readonly effects: Record<string, number>;
  readonly stackable: boolean;
}

export interface RacialAbility {
  readonly name: string;
  readonly description: string;
  readonly type: 'passive' | 'active';
  readonly cooldown?: number;
  readonly effects: Record<string, JSONValue>;
}

export interface ClassAbility {
  readonly name: string;
  readonly description: string;
  readonly levelRequired: number;
  readonly type: 'passive' | 'active' | 'spell';
  readonly cost?: number; // Mana, stamina, etc.
  readonly cooldown?: number;
  readonly effects: Record<string, JSONValue>;
}

export interface EnvironmentModifier {
  readonly name: string;
  readonly type: 'stat' | 'skill' | 'damage' | 'movement';
  readonly target: string;
  readonly modifier: number; // Positive or negative
}

export interface EnvironmentHazard {
  readonly name: string;
  readonly description: string;
  readonly damage: number;
  readonly type: 'fire' | 'ice' | 'poison' | 'physical' | 'magical';
  readonly frequency: number; // Chance per turn
  readonly area: CombatPosition[];
}

export interface CombatLogEntry {
  readonly timestamp: Timestamp;
  readonly participantId: UUID;
  readonly action: CombatActionType;
  readonly target?: UUID;
  readonly result: string;
  readonly damage?: number;
  readonly effects?: string[];
}

export interface Faction {
  readonly id: UUID;
  readonly name: string;
  readonly description: string;
  readonly alignment: 'good' | 'neutral' | 'evil';
  readonly allies: UUID[];
  readonly enemies: UUID[];
  readonly territory: UUID[]; // Location IDs controlled
  readonly leadership: UUID[]; // NPC IDs of leaders
}

export interface WorldEvent {
  readonly id: UUID;
  readonly name: string;
  readonly description: string;
  readonly type: 'political' | 'natural' | 'magical' | 'social' | 'economic';
  readonly startDate: number; // Day count when event begins
  readonly duration: number; // Duration in days
  readonly effects: Record<string, JSONValue>;
  readonly affectedLocations: UUID[];
  readonly isActive: boolean;
}

export interface Secret {
  readonly id: UUID;
  readonly name: string;
  readonly description: string;
  readonly requirements: string[]; // Skills, items, or conditions to discover
  readonly reward?: QuestReward;
  readonly isDiscovered: boolean;
  readonly revealText: string;
}

export interface NPCShop {
  readonly inventory: InventoryItem[];
  readonly buyPriceModifier: number; // 1.0 = normal prices
  readonly sellPriceModifier: number; // 1.0 = normal prices
  readonly refreshInterval: number; // Hours between inventory refresh
  readonly specialItems: UUID[]; // Unique items only this shop sells
}

export interface DialogueCondition {
  readonly type: 'stat' | 'skill' | 'item' | 'quest' | 'reputation' | 'flag';
  readonly target: string;
  readonly operator: '>' | '>=' | '=' | '<=' | '<' | '!=';
  readonly value: number | string | boolean;
}

export interface DialogueEffect {
  readonly type: 'stat' | 'skill' | 'item' | 'quest' | 'reputation' | 'flag';
  readonly target: string;
  readonly change: number | string | boolean;
}

export interface QuestPrerequisite {
  readonly type: 'level' | 'quest' | 'reputation' | 'item' | 'skill' | 'flag';
  readonly target: string;
  readonly requirement: number | string | boolean;
}

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

export const CharacterStatsSchema = z.object({
  strength: z.number().int().min(1).max(100),
  dexterity: z.number().int().min(1).max(100),
  constitution: z.number().int().min(1).max(100),
  intelligence: z.number().int().min(1).max(100),
  wisdom: z.number().int().min(1).max(100),
  charisma: z.number().int().min(1).max(100),
  luck: z.number().int().min(1).max(100),
});

export const CharacterSkillsSchema = z.object({
  combat: z.number().int().min(0).max(100),
  magic: z.number().int().min(0).max(100),
  stealth: z.number().int().min(0).max(100),
  diplomacy: z.number().int().min(0).max(100),
  survival: z.number().int().min(0).max(100),
  investigation: z.number().int().min(0).max(100),
  crafting: z.number().int().min(0).max(100),
  lore: z.number().int().min(0).max(100),
});

export const CharacterSchema = z.object({
  id: UUIDSchema,
  name: z.string().min(1).max(50),
  race: z.any(), // Will be detailed in a separate schema
  class: z.any(), // Will be detailed in a separate schema
  level: z.number().int().min(1).max(100),
  experience: z.number().int().min(0),
  stats: CharacterStatsSchema,
  skills: CharacterSkillsSchema,
  traits: z.array(z.any()),
  background: z.any(),
  currentHealth: z.number().int().min(0),
  maxHealth: z.number().int().min(1),
  statusEffects: z.array(z.any()),
});

export const CombatActionSchema = z.object({
  id: UUIDSchema,
  type: z.enum([
    'attack',
    'defend',
    'move',
    'cast_spell',
    'use_item',
    'flee',
    'wait',
  ]),
  playerId: UUIDSchema,
  gameId: UUIDSchema,
  timestamp: TimestampSchema,
  data: z.object({
    targetId: UUIDSchema.optional(),
    position: z
      .object({
        x: z.number(),
        y: z.number(),
        zone: z.enum(['front', 'middle', 'back']),
      })
      .optional(),
    itemId: UUIDSchema.optional(),
    spellId: UUIDSchema.optional(),
    skillUsed: z
      .enum([
        'combat',
        'magic',
        'stealth',
        'diplomacy',
        'survival',
        'investigation',
        'crafting',
        'lore',
      ])
      .optional(),
  }),
  metadata: z.record(JSONValueSchema).optional(),
});

// ============================================================================
// AI RESPONSE DATA INTERFACES
// ============================================================================

export interface NarrativeData {
  readonly content: string;
  readonly type:
    | 'introduction'
    | 'continuation'
    | 'climax'
    | 'resolution'
    | 'description'
    | 'action';
  readonly mood:
    | 'epic'
    | 'dark'
    | 'humorous'
    | 'mysterious'
    | 'tense'
    | 'peaceful'
    | 'neutral';
  readonly consequences: string[];
  readonly choices: NarrativeChoice[];
}

export interface NarrativeChoice {
  readonly id: string;
  readonly text: string;
  readonly consequences: string[];
  readonly skillRequirement?: {
    readonly skill: keyof CharacterSkills;
    readonly difficulty: number;
  };
}

export interface DialogueData {
  readonly speaker: string;
  readonly content: string;
  readonly emotion:
    | 'happy'
    | 'sad'
    | 'angry'
    | 'surprised'
    | 'neutral'
    | 'excited'
    | 'fearful';
  readonly context:
    | 'greeting'
    | 'conversation'
    | 'farewell'
    | 'combat'
    | 'merchant'
    | 'quest';
  readonly choices: DialogueChoice[];
}

export interface DialogueChoice {
  readonly id: string;
  readonly text: string;
  readonly response: string;
  readonly effects?: DialogueEffect[];
}

export interface CombatData {
  readonly outcome:
    | 'hit'
    | 'miss'
    | 'critical'
    | 'fumble'
    | 'block'
    | 'ongoing';
  readonly description: string;
  readonly damageDealt: number;
  readonly damageReceived: number;
  readonly statusChanges: StatusEffect[];
  readonly nextPossibleActions: CombatActionType[];
}

export type CombatActionType =
  | 'attack'
  | 'defend'
  | 'move'
  | 'cast_spell'
  | 'use_item'
  | 'flee'
  | 'wait';

// Validation schemas for AI response data
export const NarrativeDataSchema = z.object({
  content: z.string().min(10).max(2000),
  type: z.enum([
    'introduction',
    'continuation',
    'climax',
    'resolution',
    'description',
    'action',
  ]),
  mood: z.enum([
    'epic',
    'dark',
    'humorous',
    'mysterious',
    'tense',
    'peaceful',
    'neutral',
  ]),
  consequences: z.array(z.string()),
  choices: z.array(
    z.object({
      id: z.string(),
      text: z.string().min(5).max(200),
      consequences: z.array(z.string()),
      skillRequirement: z
        .object({
          skill: z.enum([
            'combat',
            'magic',
            'stealth',
            'diplomacy',
            'survival',
            'investigation',
            'crafting',
            'lore',
          ]),
          difficulty: z.number().min(1).max(20),
        })
        .optional(),
    })
  ),
});

export const DialogueDataSchema = z.object({
  speaker: z.string().min(1).max(100),
  content: z.string().min(1).max(1000),
  emotion: z.enum([
    'happy',
    'sad',
    'angry',
    'surprised',
    'neutral',
    'excited',
    'fearful',
  ]),
  context: z.enum([
    'greeting',
    'conversation',
    'farewell',
    'combat',
    'merchant',
    'quest',
  ]),
  choices: z.array(
    z.object({
      id: z.string(),
      text: z.string().min(1).max(200),
      response: z.string().min(1).max(500),
      effects: z.array(z.any()).optional(),
    })
  ),
});

export const CombatDataSchema = z.object({
  outcome: z.enum(['hit', 'miss', 'critical', 'fumble', 'block', 'ongoing']),
  description: z.string().min(10).max(500),
  damageDealt: z.number().min(0).max(1000),
  damageReceived: z.number().min(0).max(1000),
  statusChanges: z.array(z.any()),
  nextPossibleActions: z.array(
    z.enum([
      'attack',
      'defend',
      'move',
      'cast_spell',
      'use_item',
      'flee',
      'wait',
    ])
  ),
});
