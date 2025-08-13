/**
 * World Generation System for RPG Module
 *
 * AI-powered world generation using Claude API to create rich, coherent
 * worlds with interconnected NPCs, locations, and quests for immersive
 * RPG storytelling experiences.
 */

import { z } from 'zod';
import {
  WorldData,
  Location,
  LocationType,
  NPC,
  Quest,
  QuestDifficulty,
  Faction,
  WorldEvent,
  LocationFeature,
  NPCPersonality,
  NPCBehavior,
  QuestObjective,
  QuestReward,
  Character,
  CharacterStats,
  CharacterSkills,
} from '@/types/rpg';
import { UUID, GameError, ErrorCode } from '@/types/core';
import { generateRPGContent, claudeService, AI_CONFIG } from '@/lib/ai';
import { kvService } from '@/lib/database';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// WORLD GENERATION PREFERENCES & CONFIGURATION
// ============================================================================

export interface WorldPreferences {
  readonly theme: WorldTheme;
  readonly size: WorldSize;
  readonly complexity: WorldComplexity;
  readonly tone: WorldTone;
  readonly biomes: BiomeType[];
  readonly factionCount: number;
  readonly npcDensity: 'sparse' | 'normal' | 'dense';
  readonly questDensity: 'minimal' | 'moderate' | 'abundant';
  readonly magicLevel: 'none' | 'rare' | 'common' | 'ubiquitous';
  readonly technologyLevel:
    | 'stone'
    | 'medieval'
    | 'renaissance'
    | 'industrial'
    | 'modern'
    | 'future';
  readonly dangerLevel: 'peaceful' | 'moderate' | 'dangerous' | 'deadly';
  readonly culturalDiversity: 'homogeneous' | 'diverse' | 'melting_pot';
}

export type WorldTheme =
  | 'fantasy'
  | 'sci-fi'
  | 'steampunk'
  | 'cyberpunk'
  | 'medieval'
  | 'modern'
  | 'horror'
  | 'mystery'
  | 'adventure'
  | 'post-apocalyptic'
  | 'space-opera'
  | 'urban-fantasy'
  | 'historical'
  | 'custom';

export type WorldSize = 'small' | 'medium' | 'large' | 'epic';
export type WorldComplexity = 'simple' | 'moderate' | 'complex' | 'intricate';
export type WorldTone =
  | 'light'
  | 'balanced'
  | 'serious'
  | 'dark'
  | 'humorous'
  | 'epic'
  | 'mysterious';
export type BiomeType =
  | 'forest'
  | 'desert'
  | 'mountain'
  | 'plains'
  | 'ocean'
  | 'arctic'
  | 'swamp'
  | 'volcanic'
  | 'underground'
  | 'floating_islands'
  | 'crystal_caverns'
  | 'shadow_realm'
  | 'urban'
  | 'wasteland'
  | 'jungle';

export type QuestDifficulty =
  | 'trivial'
  | 'easy'
  | 'moderate'
  | 'hard'
  | 'legendary';
export type Direction =
  | 'north'
  | 'south'
  | 'east'
  | 'west'
  | 'up'
  | 'down'
  | 'portal';

// Validation schemas
const WorldPreferencesSchema = z.object({
  theme: z.enum([
    'fantasy',
    'sci-fi',
    'steampunk',
    'cyberpunk',
    'medieval',
    'modern',
    'horror',
    'mystery',
    'adventure',
    'post-apocalyptic',
    'space-opera',
    'urban-fantasy',
    'historical',
    'custom',
  ]),
  size: z.enum(['small', 'medium', 'large', 'epic']),
  complexity: z.enum(['simple', 'moderate', 'complex', 'intricate']),
  tone: z.enum([
    'light',
    'balanced',
    'serious',
    'dark',
    'humorous',
    'epic',
    'mysterious',
  ]),
  biomes: z.array(
    z.enum([
      'forest',
      'desert',
      'mountain',
      'plains',
      'ocean',
      'arctic',
      'swamp',
      'volcanic',
      'underground',
      'floating_islands',
      'crystal_caverns',
      'shadow_realm',
      'urban',
      'wasteland',
      'jungle',
    ])
  ),
  factionCount: z.number().int().min(0).max(20),
  npcDensity: z.enum(['sparse', 'normal', 'dense']),
  questDensity: z.enum(['minimal', 'moderate', 'abundant']),
  magicLevel: z.enum(['none', 'rare', 'common', 'ubiquitous']),
  technologyLevel: z.enum([
    'stone',
    'medieval',
    'renaissance',
    'industrial',
    'modern',
    'future',
  ]),
  dangerLevel: z.enum(['peaceful', 'moderate', 'dangerous', 'deadly']),
  culturalDiversity: z.enum(['homogeneous', 'diverse', 'melting_pot']),
});

// ============================================================================
// WORLD THEME TEMPLATES
// ============================================================================

interface WorldThemeTemplate {
  readonly name: string;
  readonly description: string;
  readonly defaultBiomes: BiomeType[];
  readonly technologyLevel: WorldPreferences['technologyLevel'];
  readonly magicLevel: WorldPreferences['magicLevel'];
  readonly commonLocationTypes: LocationType[];
  readonly culturalElements: string[];
  readonly conflictThemes: string[];
  readonly narrativeElements: string[];
}

const WORLD_THEMES: Record<WorldTheme, WorldThemeTemplate> = {
  fantasy: {
    name: 'Fantasy',
    description:
      'Medieval-inspired worlds with magic, mythical creatures, and ancient mysteries',
    defaultBiomes: ['forest', 'mountain', 'plains', 'desert'],
    technologyLevel: 'medieval',
    magicLevel: 'common',
    commonLocationTypes: ['town', 'castle', 'temple', 'dungeon', 'forest'],
    culturalElements: [
      'kingdoms',
      'guilds',
      'magic schools',
      'ancient prophecies',
    ],
    conflictThemes: [
      'good vs evil',
      'ancient curses',
      'territorial disputes',
      'magical corruption',
    ],
    narrativeElements: [
      'heroic quests',
      'ancient artifacts',
      'magical awakening',
      'chosen one prophecy',
    ],
  },
  'sci-fi': {
    name: 'Science Fiction',
    description:
      'Futuristic worlds with advanced technology, space travel, and alien civilizations',
    defaultBiomes: ['urban', 'wasteland', 'underground'],
    technologyLevel: 'future',
    magicLevel: 'none',
    commonLocationTypes: ['town', 'ruins', 'cave', 'custom'],
    culturalElements: [
      'corporations',
      'AI systems',
      'space colonies',
      'cybernetic enhancement',
    ],
    conflictThemes: [
      'human vs AI',
      'corporate warfare',
      'alien invasion',
      'resource scarcity',
    ],
    narrativeElements: [
      'technological evolution',
      'first contact',
      'dystopian society',
      'space exploration',
    ],
  },
  steampunk: {
    name: 'Steampunk',
    description:
      'Victorian-era inspired world with steam-powered technology and airships',
    defaultBiomes: ['urban', 'mountain', 'floating_islands'],
    technologyLevel: 'industrial',
    magicLevel: 'rare',
    commonLocationTypes: ['town', 'castle', 'ruins', 'custom'],
    culturalElements: [
      'inventor guilds',
      'airship fleets',
      'steam-powered cities',
      'mechanical wonders',
    ],
    conflictThemes: [
      'innovation vs tradition',
      'industrial espionage',
      'social inequality',
      'mechanical rebellion',
    ],
    narrativeElements: [
      'invention discovery',
      'aerial adventures',
      'mechanical mysteries',
      'industrial revolution',
    ],
  },
  cyberpunk: {
    name: 'Cyberpunk',
    description:
      'High-tech, low-life future with corporate control and digital realities',
    defaultBiomes: ['urban', 'underground', 'wasteland'],
    technologyLevel: 'future',
    magicLevel: 'none',
    commonLocationTypes: ['town', 'ruins', 'custom'],
    culturalElements: [
      'megacorporations',
      'hackers',
      'cyberspace',
      'street gangs',
    ],
    conflictThemes: [
      'corporate control',
      'digital freedom',
      'identity crisis',
      'social stratification',
    ],
    narrativeElements: [
      'data heists',
      'virtual reality',
      'corporate conspiracy',
      'technological addiction',
    ],
  },
  medieval: {
    name: 'Medieval',
    description:
      'Historical medieval setting with realistic politics and warfare',
    defaultBiomes: ['plains', 'forest', 'mountain'],
    technologyLevel: 'medieval',
    magicLevel: 'none',
    commonLocationTypes: ['town', 'castle', 'tavern', 'temple'],
    culturalElements: [
      'feudalism',
      'knighthood',
      'church influence',
      'trade guilds',
    ],
    conflictThemes: [
      'dynastic wars',
      'religious disputes',
      'territorial expansion',
      'peasant revolts',
    ],
    narrativeElements: [
      'courtly intrigue',
      'religious pilgrimage',
      'merchant adventures',
      'warfare campaigns',
    ],
  },
  modern: {
    name: 'Modern',
    description:
      'Contemporary setting with current technology and social issues',
    defaultBiomes: ['urban', 'plains', 'forest'],
    technologyLevel: 'modern',
    magicLevel: 'none',
    commonLocationTypes: ['town', 'shop', 'custom'],
    culturalElements: [
      'global communication',
      'multinational corporations',
      'social media',
      'environmental awareness',
    ],
    conflictThemes: [
      'globalization effects',
      'environmental crisis',
      'technological disruption',
      'cultural conflicts',
    ],
    narrativeElements: [
      'global adventure',
      'technology thriller',
      'environmental mission',
      'cultural exploration',
    ],
  },
  horror: {
    name: 'Horror',
    description:
      'Dark worlds filled with supernatural terror and psychological dread',
    defaultBiomes: ['swamp', 'forest', 'underground'],
    technologyLevel: 'modern',
    magicLevel: 'rare',
    commonLocationTypes: ['ruins', 'cave', 'custom'],
    culturalElements: [
      'occult societies',
      'ancient curses',
      'forbidden knowledge',
      'supernatural entities',
    ],
    conflictThemes: [
      'sanity vs madness',
      'life vs death',
      'known vs unknown',
      'corruption of innocence',
    ],
    narrativeElements: [
      'supernatural investigation',
      'psychological horror',
      'ancient evil awakening',
      'survival horror',
    ],
  },
  mystery: {
    name: 'Mystery',
    description:
      'Worlds built around puzzles, investigations, and hidden truths',
    defaultBiomes: ['urban', 'plains', 'forest'],
    technologyLevel: 'modern',
    magicLevel: 'rare',
    commonLocationTypes: ['town', 'shop', 'custom'],
    culturalElements: [
      'detective agencies',
      'secret societies',
      'hidden conspiracies',
      'information networks',
    ],
    conflictThemes: [
      'truth vs deception',
      'justice vs corruption',
      'knowledge vs ignorance',
      'order vs chaos',
    ],
    narrativeElements: [
      'criminal investigation',
      'conspiracy unraveling',
      'puzzle solving',
      'truth revelation',
    ],
  },
  adventure: {
    name: 'Adventure',
    description: 'Action-packed worlds focused on exploration and discovery',
    defaultBiomes: ['jungle', 'desert', 'mountain', 'ocean'],
    technologyLevel: 'modern',
    magicLevel: 'rare',
    commonLocationTypes: ['wilderness', 'ruins', 'cave', 'custom'],
    culturalElements: [
      'explorer guilds',
      'treasure hunters',
      'remote tribes',
      'ancient civilizations',
    ],
    conflictThemes: [
      'civilization vs nature',
      'discovery vs preservation',
      'adventure vs safety',
      'treasure vs danger',
    ],
    narrativeElements: [
      'treasure hunting',
      'exploration journey',
      'survival challenge',
      'ancient discovery',
    ],
  },
  'post-apocalyptic': {
    name: 'Post-Apocalyptic',
    description: 'Worlds rebuilding after catastrophic events',
    defaultBiomes: ['wasteland', 'ruins', 'underground'],
    technologyLevel: 'industrial',
    magicLevel: 'rare',
    commonLocationTypes: ['ruins', 'cave', 'custom'],
    culturalElements: [
      'survivor communities',
      'scavenger tribes',
      'wasteland nomads',
      'technology remnants',
    ],
    conflictThemes: [
      'survival vs humanity',
      'order vs anarchy',
      'hope vs despair',
      'past vs future',
    ],
    narrativeElements: [
      'community building',
      'resource survival',
      'civilization rebuilding',
      'wasteland exploration',
    ],
  },
  'space-opera': {
    name: 'Space Opera',
    description:
      'Epic space adventures across multiple worlds and civilizations',
    defaultBiomes: ['urban', 'desert', 'crystal_caverns'],
    technologyLevel: 'future',
    magicLevel: 'common',
    commonLocationTypes: ['town', 'ruins', 'custom'],
    culturalElements: [
      'galactic empires',
      'alien federations',
      'space pirates',
      'cosmic forces',
    ],
    conflictThemes: [
      'galactic war',
      'alien contact',
      'cosmic balance',
      'technological evolution',
    ],
    narrativeElements: [
      'galactic adventure',
      'alien diplomacy',
      'space battles',
      'cosmic mystery',
    ],
  },
  'urban-fantasy': {
    name: 'Urban Fantasy',
    description:
      'Modern cities with hidden magical elements and supernatural beings',
    defaultBiomes: ['urban', 'underground', 'shadow_realm'],
    technologyLevel: 'modern',
    magicLevel: 'common',
    commonLocationTypes: ['town', 'shop', 'custom'],
    culturalElements: [
      'hidden magical societies',
      'supernatural creatures',
      'modern wizards',
      'magical districts',
    ],
    conflictThemes: [
      'magic vs technology',
      'hidden vs revealed',
      'old magic vs new world',
      'supernatural politics',
    ],
    narrativeElements: [
      'urban magic discovery',
      'supernatural investigation',
      'magical awakening',
      'hidden world exploration',
    ],
  },
  historical: {
    name: 'Historical',
    description:
      'Accurate historical settings with period-appropriate challenges',
    defaultBiomes: ['plains', 'urban', 'forest', 'desert'],
    technologyLevel: 'renaissance',
    magicLevel: 'none',
    commonLocationTypes: ['town', 'castle', 'temple', 'shop'],
    culturalElements: [
      'historical accuracy',
      'period politics',
      'cultural traditions',
      'historical figures',
    ],
    conflictThemes: [
      'historical conflicts',
      'cultural change',
      'exploration vs isolation',
      'tradition vs progress',
    ],
    narrativeElements: [
      'historical adventure',
      'cultural exploration',
      'period drama',
      'historical mystery',
    ],
  },
  custom: {
    name: 'Custom',
    description:
      'Fully customized world created according to specific preferences',
    defaultBiomes: ['plains', 'forest', 'mountain'],
    technologyLevel: 'medieval',
    magicLevel: 'common',
    commonLocationTypes: ['town', 'custom'],
    culturalElements: [
      'player-defined cultures',
      'custom societies',
      'unique traditions',
      'original concepts',
    ],
    conflictThemes: [
      'player-defined conflicts',
      'custom dynamics',
      'unique challenges',
      'original themes',
    ],
    narrativeElements: [
      'custom storylines',
      'unique adventures',
      'original mysteries',
      'player-driven narratives',
    ],
  },
};

// ============================================================================
// WORLD GENERATOR CLASS
// ============================================================================

export class WorldGenerator {
  private static instance: WorldGenerator | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  public static getInstance(): WorldGenerator {
    if (!WorldGenerator.instance) {
      WorldGenerator.instance = new WorldGenerator();
    }
    return WorldGenerator.instance;
  }

  /**
   * Generate a complete world with all essential components
   */
  public async generateWorld(
    theme: string,
    preferences: WorldPreferences
  ): Promise<
    { success: true; data: WorldData } | { success: false; error: GameError }
  > {
    try {
      // Validate input preferences
      const validationResult = WorldPreferencesSchema.safeParse(preferences);
      if (!validationResult.success) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR' as ErrorCode,
            message: 'Invalid world preferences',
            details: validationResult.error.errors,
          },
        };
      }

      const worldId = uuidv4() as UUID;
      const themeTemplate =
        WORLD_THEMES[preferences.theme as WorldTheme] || WORLD_THEMES.fantasy;

      // Generate world foundation using AI
      const worldFoundation = await this.generateWorldFoundation(
        worldId,
        theme,
        preferences,
        themeTemplate
      );
      if (!worldFoundation.success) {
        return worldFoundation;
      }

      // Generate initial locations
      const initialLocations = await this.generateInitialLocations(
        worldId,
        preferences,
        themeTemplate
      );
      if (!initialLocations.success) {
        return { success: false, error: initialLocations.error };
      }

      // Generate factions
      const factions = await this.generateFactions(
        worldId,
        preferences,
        themeTemplate
      );
      if (!factions.success) {
        return { success: false, error: factions.error };
      }

      // Generate initial NPCs
      const npcs = await this.generateInitialNPCs(
        worldId,
        initialLocations.data,
        factions.data,
        preferences
      );
      if (!npcs.success) {
        return { success: false, error: npcs.error };
      }

      // Generate world events
      const worldEvents = await this.generateWorldEvents(
        worldId,
        preferences,
        themeTemplate
      );
      if (!worldEvents.success) {
        return { success: false, error: worldEvents.error };
      }

      // Assemble final world data
      const worldData: WorldData = {
        id: worldId,
        name: worldFoundation.data.name,
        description: worldFoundation.data.description,
        theme: preferences.theme,
        lore: worldFoundation.data.lore,
        locations: initialLocations.data,
        globalEvents: worldEvents.data,
        npcs: npcs.data,
        factions: factions.data,
      };

      // Cache the generated world
      await kvService.set(`world:${worldId}`, worldData, {
        ttl: 7 * 24 * 60 * 60 * 1000,
      }); // 7 days

      return { success: true, data: worldData };
    } catch (error) {
      //TODO: Implement proper error logging service
      console.error('World generation failed:', error);

      return {
        success: false,
        error: {
          code: 'WORLD_GENERATION_ERROR' as ErrorCode,
          message: 'Failed to generate world',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Generate a new location within an existing world
   */
  public async generateLocation(
    worldId: string,
    locationType: LocationType,
    connectedLocationId?: string,
    preferences?: Partial<WorldPreferences>
  ): Promise<
    { success: true; data: Location } | { success: false; error: GameError }
  > {
    try {
      // Load world data for context
      const worldData = await kvService.get<WorldData>(`world:${worldId}`);
      if (!worldData) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND' as ErrorCode,
            message: 'World not found',
            details: `World with ID ${worldId} does not exist`,
          },
        };
      }

      const locationId = uuidv4() as UUID;
      const themeTemplate =
        WORLD_THEMES[worldData.theme as WorldTheme] || WORLD_THEMES.fantasy;

      // Generate location using AI
      const locationResult = await generateRPGContent('world', {
        worldContext: {
          name: worldData.name,
          theme: worldData.theme,
          lore: worldData.lore,
          existingLocations: worldData.locations.map(l => ({
            name: l.name,
            type: l.type,
          })),
        },
        locationType,
        themeTemplate,
        connectedLocationId,
        preferences: preferences || {},
      });

      if (!locationResult.success || !locationResult.response?.content) {
        return {
          success: false,
          error: {
            code: 'AI_GENERATION_ERROR' as ErrorCode,
            message: 'Failed to generate location content',
            details: locationResult.error || 'No content generated',
          },
        };
      }

      // Parse AI response and create location
      const aiContent = this.parseLocationFromAI(
        locationResult.response.content
      );

      // Generate location features
      const features = await this.generateLocationFeatures(
        locationId,
        locationType,
        themeTemplate
      );

      const location: Location = {
        id: locationId,
        name: aiContent.name,
        description: aiContent.description,
        type: locationType,
        connections: connectedLocationId ? [connectedLocationId as UUID] : [],
        features: features,
        npcs: [], // Will be populated separately
        items: [], // Will be populated separately
        secrets: [], // Will be populated separately
        isDiscovered: false,
      };

      // Update world with new location
      worldData.locations.push(location);
      if (connectedLocationId) {
        const connectedLocation = worldData.locations.find(
          l => l.id === connectedLocationId
        );
        if (
          connectedLocation &&
          !connectedLocation.connections.includes(locationId)
        ) {
          // Add bidirectional connection
          (connectedLocation.connections as UUID[]).push(locationId);
        }
      }

      await kvService.set(`world:${worldId}`, worldData, {
        ttl: 7 * 24 * 60 * 60 * 1000,
      });

      return { success: true, data: location };
    } catch (error) {
      //TODO: Implement proper error logging service
      console.error('Location generation failed:', error);

      return {
        success: false,
        error: {
          code: 'LOCATION_GENERATION_ERROR' as ErrorCode,
          message: 'Failed to generate location',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Generate NPCs for a specific location
   */
  public async generateNPCs(
    locationId: string,
    count: number = 3,
    worldContext?: { worldId: string; factions: Faction[] }
  ): Promise<
    { success: true; data: NPC[] } | { success: false; error: GameError }
  > {
    try {
      if (count <= 0 || count > 20) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR' as ErrorCode,
            message: 'Invalid NPC count',
            details: 'NPC count must be between 1 and 20',
          },
        };
      }

      const npcs: NPC[] = [];

      for (let i = 0; i < count; i++) {
        const npcResult = await this.generateSingleNPC(
          locationId,
          worldContext
        );
        if (npcResult.success) {
          npcs.push(npcResult.data);
        } else {
          //TODO: Log NPC generation failures
          console.warn(
            `Failed to generate NPC ${i + 1}/${count}:`,
            npcResult.error
          );
        }
      }

      if (npcs.length === 0) {
        return {
          success: false,
          error: {
            code: 'NPC_GENERATION_ERROR' as ErrorCode,
            message: 'Failed to generate any NPCs',
            details: 'All NPC generation attempts failed',
          },
        };
      }

      return { success: true, data: npcs };
    } catch (error) {
      //TODO: Implement proper error logging service
      console.error('NPC generation failed:', error);

      return {
        success: false,
        error: {
          code: 'NPC_GENERATION_ERROR' as ErrorCode,
          message: 'Failed to generate NPCs',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Generate quests for a world with specified difficulty
   */
  public async generateQuests(
    worldId: string,
    difficulty: QuestDifficulty,
    count: number = 5
  ): Promise<
    { success: true; data: Quest[] } | { success: false; error: GameError }
  > {
    try {
      // Load world data for context
      const worldData = await kvService.get<WorldData>(`world:${worldId}`);
      if (!worldData) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND' as ErrorCode,
            message: 'World not found',
            details: `World with ID ${worldId} does not exist`,
          },
        };
      }

      const quests: Quest[] = [];
      const questTypes = [
        'main',
        'side',
        'personal',
        'faction',
        'discovery',
        'fetch',
        'escort',
      ] as const;

      for (let i = 0; i < count; i++) {
        const questType =
          questTypes[Math.floor(Math.random() * questTypes.length)];
        const questResult = await this.generateSingleQuest(
          worldData,
          difficulty,
          questType
        );

        if (questResult.success) {
          quests.push(questResult.data);
        } else {
          //TODO: Log quest generation failures
          console.warn(
            `Failed to generate quest ${i + 1}/${count}:`,
            questResult.error
          );
        }
      }

      if (quests.length === 0) {
        return {
          success: false,
          error: {
            code: 'QUEST_GENERATION_ERROR' as ErrorCode,
            message: 'Failed to generate any quests',
            details: 'All quest generation attempts failed',
          },
        };
      }

      return { success: true, data: quests };
    } catch (error) {
      //TODO: Implement proper error logging service
      console.error('Quest generation failed:', error);

      return {
        success: false,
        error: {
          code: 'QUEST_GENERATION_ERROR' as ErrorCode,
          message: 'Failed to generate quests',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Expand world in specified direction
   */
  public async expandWorld(
    worldId: string,
    direction: Direction,
    fromLocationId?: string
  ): Promise<
    { success: true; data: Location[] } | { success: false; error: GameError }
  > {
    try {
      // Load world data
      const worldData = await kvService.get<WorldData>(`world:${worldId}`);
      if (!worldData) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND' as ErrorCode,
            message: 'World not found',
            details: `World with ID ${worldId} does not exist`,
          },
        };
      }

      const expansionSize = this.calculateExpansionSize(
        worldData.locations.length
      );
      const newLocations: Location[] = [];

      // Determine appropriate biomes for the direction
      const biomes = this.getBiomesForDirection(
        direction,
        worldData.theme as WorldTheme
      );

      for (let i = 0; i < expansionSize; i++) {
        const biome = biomes[Math.floor(Math.random() * biomes.length)];
        const locationType = this.getLocationTypeForBiome(biome);

        const locationResult = await this.generateLocation(
          worldId,
          locationType,
          fromLocationId ||
            (newLocations.length > 0
              ? newLocations[newLocations.length - 1].id
              : undefined)
        );

        if (locationResult.success) {
          newLocations.push(locationResult.data);
        }
      }

      if (newLocations.length === 0) {
        return {
          success: false,
          error: {
            code: 'EXPANSION_ERROR' as ErrorCode,
            message: 'Failed to expand world',
            details: 'No new locations could be generated',
          },
        };
      }

      return { success: true, data: newLocations };
    } catch (error) {
      //TODO: Implement proper error logging service
      console.error('World expansion failed:', error);

      return {
        success: false,
        error: {
          code: 'EXPANSION_ERROR' as ErrorCode,
          message: 'Failed to expand world',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Generate world foundation (name, description, lore)
   */
  private async generateWorldFoundation(
    worldId: UUID,
    theme: string,
    preferences: WorldPreferences,
    themeTemplate: WorldThemeTemplate
  ): Promise<
    | {
        success: true;
        data: { name: string; description: string; lore: string };
      }
    | { success: false; error: GameError }
  > {
    try {
      const result = await generateRPGContent('world', {
        worldId,
        theme,
        preferences,
        themeTemplate,
        generationType: 'foundation',
        culturalElements: themeTemplate.culturalElements,
        conflictThemes: themeTemplate.conflictThemes,
        narrativeElements: themeTemplate.narrativeElements,
      });

      if (!result.success || !result.response?.content) {
        return {
          success: false,
          error: {
            code: 'AI_GENERATION_ERROR' as ErrorCode,
            message: 'Failed to generate world foundation',
            details: result.error || 'No content generated',
          },
        };
      }

      const parsedContent = this.parseWorldFoundationFromAI(
        result.response.content
      );
      return { success: true, data: parsedContent };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'WORLD_FOUNDATION_ERROR' as ErrorCode,
          message: 'Failed to generate world foundation',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Generate initial set of locations for a world
   */
  private async generateInitialLocations(
    worldId: UUID,
    preferences: WorldPreferences,
    themeTemplate: WorldThemeTemplate
  ): Promise<
    { success: true; data: Location[] } | { success: false; error: GameError }
  > {
    try {
      const locationCount = this.getInitialLocationCount(preferences.size);
      const locations: Location[] = [];

      // Generate starting location (always a safe town/settlement)
      const startingLocationResult = await this.createStartingLocation(
        worldId,
        preferences,
        themeTemplate
      );
      if (!startingLocationResult.success) {
        return { success: false, error: startingLocationResult.error };
      }
      locations.push(startingLocationResult.data);

      // Generate additional locations
      for (let i = 1; i < locationCount; i++) {
        const biome =
          preferences.biomes[
            Math.floor(Math.random() * preferences.biomes.length)
          ];
        const locationType = this.getLocationTypeForBiome(biome);

        const locationResult = await this.generateLocation(
          worldId,
          locationType,
          locations[Math.floor(Math.random() * locations.length)].id
        );

        if (locationResult.success) {
          locations.push(locationResult.data);
        }
      }

      return { success: true, data: locations };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'LOCATION_GENERATION_ERROR' as ErrorCode,
          message: 'Failed to generate initial locations',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Generate factions for the world
   */
  private async generateFactions(
    worldId: UUID,
    preferences: WorldPreferences,
    themeTemplate: WorldThemeTemplate
  ): Promise<
    { success: true; data: Faction[] } | { success: false; error: GameError }
  > {
    try {
      const factions: Faction[] = [];

      for (let i = 0; i < preferences.factionCount; i++) {
        const factionResult = await generateRPGContent('world', {
          worldId,
          generationType: 'faction',
          themeTemplate,
          existingFactions: factions,
          culturalDiversity: preferences.culturalDiversity,
        });

        if (factionResult.success && factionResult.response?.content) {
          const faction = this.parseFactionFromAI(
            factionResult.response.content
          );
          factions.push(faction);
        }
      }

      return { success: true, data: factions };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'FACTION_GENERATION_ERROR' as ErrorCode,
          message: 'Failed to generate factions',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Generate initial NPCs for the world
   */
  private async generateInitialNPCs(
    worldId: UUID,
    locations: Location[],
    factions: Faction[],
    preferences: WorldPreferences
  ): Promise<
    { success: true; data: NPC[] } | { success: false; error: GameError }
  > {
    try {
      const npcs: NPC[] = [];
      const npcPerLocationBase =
        preferences.npcDensity === 'sparse'
          ? 1
          : preferences.npcDensity === 'normal'
            ? 2
            : 3;

      for (const location of locations) {
        const npcCount = npcPerLocationBase + Math.floor(Math.random() * 2);
        const locationNPCs = await this.generateNPCs(location.id, npcCount, {
          worldId,
          factions,
        });

        if (locationNPCs.success) {
          npcs.push(...locationNPCs.data);
        }
      }

      return { success: true, data: npcs };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NPC_GENERATION_ERROR' as ErrorCode,
          message: 'Failed to generate initial NPCs',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Generate world events
   */
  private async generateWorldEvents(
    worldId: UUID,
    preferences: WorldPreferences,
    themeTemplate: WorldThemeTemplate
  ): Promise<
    { success: true; data: WorldEvent[] } | { success: false; error: GameError }
  > {
    try {
      const events: WorldEvent[] = [];
      const eventCount = Math.min(
        5,
        Math.floor(preferences.factionCount * 0.8) + 2
      );

      for (let i = 0; i < eventCount; i++) {
        const eventResult = await generateRPGContent('world', {
          worldId,
          generationType: 'world_event',
          themeTemplate,
          conflictThemes: themeTemplate.conflictThemes,
          dangerLevel: preferences.dangerLevel,
        });

        if (eventResult.success && eventResult.response?.content) {
          const worldEvent = this.parseWorldEventFromAI(
            eventResult.response.content
          );
          events.push(worldEvent);
        }
      }

      return { success: true, data: events };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EVENT_GENERATION_ERROR' as ErrorCode,
          message: 'Failed to generate world events',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private getInitialLocationCount(size: WorldSize): number {
    switch (size) {
      case 'small':
        return 5;
      case 'medium':
        return 8;
      case 'large':
        return 12;
      case 'epic':
        return 20;
      default:
        return 8;
    }
  }

  private calculateExpansionSize(currentLocationCount: number): number {
    return Math.max(1, Math.min(5, Math.floor(currentLocationCount * 0.3)));
  }

  private getBiomesForDirection(
    direction: Direction,
    theme: WorldTheme
  ): BiomeType[] {
    const themeTemplate = WORLD_THEMES[theme];
    const baseBiomes = themeTemplate.defaultBiomes;

    // Direction-based biome suggestions
    const directionBiomes: Record<Direction, BiomeType[]> = {
      north: ['arctic', 'mountain', 'forest'],
      south: ['desert', 'plains', 'jungle'],
      east: ['ocean', 'plains', 'forest'],
      west: ['mountain', 'desert', 'wasteland'],
      up: ['floating_islands', 'mountain', 'crystal_caverns'],
      down: ['underground', 'cave', 'crystal_caverns'],
      portal: ['shadow_realm', 'crystal_caverns', 'floating_islands'],
    };

    return [...new Set([...baseBiomes, ...directionBiomes[direction]])];
  }

  private getLocationTypeForBiome(biome: BiomeType): LocationType {
    const biomeLocationMap: Record<BiomeType, LocationType[]> = {
      forest: ['forest', 'temple', 'ruins'],
      desert: ['ruins', 'cave', 'custom'],
      mountain: ['mountain', 'cave', 'castle'],
      plains: ['town', 'castle', 'ruins'],
      ocean: ['town', 'ruins', 'custom'],
      arctic: ['cave', 'ruins', 'custom'],
      swamp: ['ruins', 'temple', 'custom'],
      volcanic: ['cave', 'ruins', 'custom'],
      underground: ['cave', 'dungeon', 'ruins'],
      floating_islands: ['castle', 'temple', 'custom'],
      crystal_caverns: ['cave', 'temple', 'custom'],
      shadow_realm: ['ruins', 'temple', 'custom'],
      urban: ['town', 'shop', 'tavern'],
      wasteland: ['ruins', 'cave', 'custom'],
      jungle: ['forest', 'temple', 'ruins'],
    };

    const possibleTypes = biomeLocationMap[biome] || ['custom'];
    return possibleTypes[Math.floor(Math.random() * possibleTypes.length)];
  }

  // ============================================================================
  // AI RESPONSE PARSING METHODS
  // ============================================================================

  private parseWorldFoundationFromAI(content: string): {
    name: string;
    description: string;
    lore: string;
  } {
    // Extract JSON or structured content from AI response
    //TODO: Implement robust AI content parsing with fallbacks
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          name: parsed.name || 'Generated World',
          description: parsed.description || 'A world generated by AI.',
          lore: parsed.lore || 'Ancient mysteries await discovery...',
        };
      }
    } catch (e) {
      // Fallback parsing
    }

    return {
      name: 'Generated World',
      description: content.substring(0, 500),
      lore: 'Rich lore and history span countless ages...',
    };
  }

  private parseLocationFromAI(content: string): {
    name: string;
    description: string;
  } {
    //TODO: Implement robust location content parsing
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          name: parsed.name || 'Unknown Location',
          description:
            parsed.description || 'A mysterious place awaits exploration.',
        };
      }
    } catch (e) {
      // Fallback parsing
    }

    return {
      name: 'Generated Location',
      description: content.substring(0, 300),
    };
  }

  private parseFactionFromAI(content: string): Faction {
    //TODO: Implement robust faction parsing
    const id = uuidv4() as UUID;

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          id,
          name: parsed.name || 'Unknown Faction',
          description: parsed.description || 'A mysterious organization.',
          alignment: parsed.alignment || 'neutral',
          allies: [],
          enemies: [],
          territory: [],
          leadership: [],
        };
      }
    } catch (e) {
      // Fallback parsing
    }

    return {
      id,
      name: 'Generated Faction',
      description: content.substring(0, 200),
      alignment: 'neutral',
      allies: [],
      enemies: [],
      territory: [],
      leadership: [],
    };
  }

  private parseWorldEventFromAI(content: string): WorldEvent {
    //TODO: Implement robust world event parsing
    const id = uuidv4() as UUID;

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          id,
          name: parsed.name || 'World Event',
          description: parsed.description || 'Something significant occurs.',
          type: parsed.type || 'social',
          startDate: parsed.startDate || 1,
          duration: parsed.duration || 7,
          effects: parsed.effects || {},
          affectedLocations: [],
          isActive: false,
        };
      }
    } catch (e) {
      // Fallback parsing
    }

    return {
      id,
      name: 'Generated Event',
      description: content.substring(0, 200),
      type: 'social',
      startDate: 1,
      duration: 7,
      effects: {},
      affectedLocations: [],
      isActive: false,
    };
  }

  private async createStartingLocation(
    worldId: UUID,
    preferences: WorldPreferences,
    themeTemplate: WorldThemeTemplate
  ): Promise<
    { success: true; data: Location } | { success: false; error: GameError }
  > {
    const locationId = uuidv4() as UUID;

    const location: Location = {
      id: locationId,
      name: 'Starting Settlement',
      description: 'A safe haven where adventures begin.',
      type: 'town',
      connections: [],
      features: await this.generateLocationFeatures(
        locationId,
        'town',
        themeTemplate
      ),
      npcs: [],
      items: [],
      secrets: [],
      isDiscovered: true,
    };

    return { success: true, data: location };
  }

  private async generateLocationFeatures(
    locationId: UUID,
    locationType: LocationType,
    themeTemplate: WorldThemeTemplate
  ): Promise<LocationFeature[]> {
    //TODO: Implement comprehensive location feature generation
    const features: LocationFeature[] = [];
    const featureCount = Math.floor(Math.random() * 3) + 1;

    for (let i = 0; i < featureCount; i++) {
      features.push({
        id: uuidv4() as UUID,
        name: `Feature ${i + 1}`,
        description: 'An interesting location feature.',
        type: 'interactive',
        interactionType: 'examine',
      });
    }

    return features;
  }

  private async generateSingleNPC(
    locationId: string,
    worldContext?: { worldId: string; factions: Faction[] }
  ): Promise<
    { success: true; data: NPC } | { success: false; error: GameError }
  > {
    try {
      //TODO: Implement comprehensive NPC generation using AI
      const npcId = uuidv4() as UUID;

      const character: Character = {
        id: uuidv4() as UUID,
        name: 'Generated NPC',
        race: {
          name: 'Human',
          description: 'Common human',
          statModifiers: {},
          abilities: [],
          restrictions: [],
        },
        class: {
          name: 'Commoner',
          description: 'Ordinary person',
          primaryStat: 'charisma',
          skillAffinities: ['diplomacy'],
          abilities: [],
          equipment: [],
        },
        level: 1,
        experience: 0,
        stats: {
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 10,
          charisma: 12,
          luck: 10,
        } as CharacterStats,
        skills: {
          combat: 5,
          magic: 5,
          stealth: 5,
          diplomacy: 8,
          survival: 6,
          investigation: 5,
          crafting: 7,
          lore: 6,
        } as CharacterSkills,
        traits: [],
        background: {
          name: 'Local Resident',
          description: 'Lives in the area',
          skillBonuses: {},
          startingEquipment: [],
          connections: [],
        },
        currentHealth: 10,
        maxHealth: 10,
        statusEffects: [],
      };

      const npc: NPC = {
        id: npcId,
        name: 'Generated NPC',
        description: 'A friendly local resident.',
        character,
        personality: {
          traits: ['friendly', 'helpful'],
          alignment: 'good',
          disposition: 'friendly',
          motivations: ['help others'],
          fears: ['violence'],
          secrets: [],
        } as NPCPersonality,
        currentLocation: locationId as UUID,
        behavior: {
          routine: [],
          combatStyle: 'defensive',
          fleeThreshold: 25,
          alliances: [],
          enemies: [],
        } as NPCBehavior,
        dialogue: {
          greetings: [
            {
              text: 'Hello there!',
              conditions: [],
              effects: [],
              responses: [],
            },
          ],
          conversations: {},
          farewells: ['Goodbye!'],
          combat: ['Help!'],
        },
        quests: [],
        relationships: {},
      };

      return { success: true, data: npc };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NPC_GENERATION_ERROR' as ErrorCode,
          message: 'Failed to generate NPC',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  private async generateSingleQuest(
    worldData: WorldData,
    difficulty: QuestDifficulty,
    questType: Quest['type']
  ): Promise<
    { success: true; data: Quest } | { success: false; error: GameError }
  > {
    try {
      //TODO: Implement comprehensive quest generation using AI
      const questId = uuidv4() as UUID;
      const location =
        worldData.locations[
          Math.floor(Math.random() * worldData.locations.length)
        ];
      const npc =
        worldData.npcs[Math.floor(Math.random() * worldData.npcs.length)];

      const objectives: QuestObjective[] = [
        {
          id: uuidv4() as UUID,
          description: 'Complete the quest objective',
          type: 'custom',
          requiredCount: 1,
          currentCount: 0,
          isCompleted: false,
          isOptional: false,
        },
      ];

      const rewards: QuestReward[] = [
        {
          type: 'experience',
          amount:
            difficulty === 'trivial'
              ? 50
              : difficulty === 'easy'
                ? 100
                : difficulty === 'moderate'
                  ? 200
                  : difficulty === 'hard'
                    ? 400
                    : 1000,
        },
      ];

      const quest: Quest = {
        id: questId,
        title: 'Generated Quest',
        description: 'A quest generated by the AI system.',
        type: questType,
        status: 'available',
        objectives,
        rewards,
        giver: npc?.id || (uuidv4() as UUID),
        location: location.id,
        timeLimit: undefined,
        prerequisites: [],
      };

      return { success: true, data: quest };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'QUEST_GENERATION_ERROR' as ErrorCode,
          message: 'Failed to generate quest',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE EXPORT
// ============================================================================

export const worldGenerator = WorldGenerator.getInstance();

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export { WORLD_THEMES };
export type {
  WorldPreferences,
  WorldTheme,
  WorldSize,
  WorldComplexity,
  WorldTone,
  BiomeType,
  Direction,
};
