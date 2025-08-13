/**
 * Location Generator for RPG World System
 *
 * Specialized system for generating rich, detailed locations with
 * environmental storytelling, interactive elements, and atmospheric details
 * that enhance immersion and provide meaningful exploration opportunities.
 */

import { z } from 'zod';
import {
  Location,
  LocationType,
  LocationFeature,
  Item,
  Secret,
  BiomeType,
  WeatherCondition,
  EnvironmentModifier,
  WorldTheme,
} from '@/types/rpg';
import { UUID, GameError, ErrorCode } from '@/types/core';
import { generateRPGContent, AI_CONFIG } from '@/lib/ai';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// LOCATION GENERATION PARAMETERS
// ============================================================================

export interface LocationGenerationParams {
  readonly biome: BiomeType;
  readonly size: LocationSize;
  readonly dangerLevel: DangerLevel;
  readonly theme: WorldTheme;
  readonly weatherCondition?: WeatherCondition;
  readonly timeOfDay: TimeOfDay;
  readonly seasonalInfluence?: SeasonalInfluence;
  readonly culturalInfluence?: CulturalInfluence;
  readonly connectivityLevel: ConnectivityLevel;
  readonly mysticalResonance: MysticalResonance;
}

export type LocationSize = 'tiny' | 'small' | 'medium' | 'large' | 'vast';
export type DangerLevel = 'safe' | 'low' | 'moderate' | 'high' | 'extreme';
export type TimeOfDay =
  | 'dawn'
  | 'morning'
  | 'noon'
  | 'afternoon'
  | 'dusk'
  | 'night'
  | 'midnight';
export type SeasonalInfluence = 'spring' | 'summer' | 'autumn' | 'winter';
export type CulturalInfluence =
  | 'ancient'
  | 'tribal'
  | 'civilized'
  | 'ruined'
  | 'foreign'
  | 'mysterious';
export type ConnectivityLevel =
  | 'isolated'
  | 'remote'
  | 'connected'
  | 'hub'
  | 'crossroads';
export type MysticalResonance =
  | 'none'
  | 'faint'
  | 'moderate'
  | 'strong'
  | 'overwhelming';

// ============================================================================
// ENVIRONMENTAL STORYTELLING SYSTEM
// ============================================================================

export interface EnvironmentalStory {
  readonly narrative: string;
  readonly clues: EnvironmentalClue[];
  readonly atmosphere: AtmosphericDetails;
  readonly hiddenElements: HiddenElement[];
  readonly interactiveElements: InteractiveElement[];
}

export interface EnvironmentalClue {
  readonly id: UUID;
  readonly type: ClueType;
  readonly description: string;
  readonly skillRequired?: 'investigation' | 'survival' | 'lore' | 'magic';
  readonly difficultyClass: number;
  readonly revealsSecret?: UUID;
  readonly connectsToLocation?: UUID;
}

export interface AtmosphericDetails {
  readonly soundscape: string[];
  readonly visualElements: string[];
  readonly scents: string[];
  readonly tactileElements: string[];
  readonly emotionalResonance: EmotionalTone[];
  readonly lighting: LightingCondition;
}

export interface HiddenElement {
  readonly id: UUID;
  readonly name: string;
  readonly description: string;
  readonly discoveryCriteria: DiscoveryCriteria;
  readonly reward: HiddenReward;
  readonly storySignificance: string;
}

export interface InteractiveElement {
  readonly id: UUID;
  readonly name: string;
  readonly description: string;
  readonly interactionType: InteractionType;
  readonly requirements: InteractionRequirement[];
  readonly outcomes: InteractionOutcome[];
  readonly narrativeContext: string;
}

export type ClueType =
  | 'physical'
  | 'magical'
  | 'historical'
  | 'social'
  | 'natural'
  | 'technological';
export type EmotionalTone =
  | 'mysterious'
  | 'peaceful'
  | 'ominous'
  | 'melancholic'
  | 'hopeful'
  | 'tense'
  | 'awe-inspiring';
export type LightingCondition =
  | 'bright'
  | 'dim'
  | 'shadowy'
  | 'dark'
  | 'flickering'
  | 'colored'
  | 'supernatural';
export type InteractionType =
  | 'examine'
  | 'touch'
  | 'activate'
  | 'climb'
  | 'dig'
  | 'cast_spell'
  | 'solve_puzzle'
  | 'ritual';

export interface DiscoveryCriteria {
  readonly method:
    | 'observation'
    | 'investigation'
    | 'skill_check'
    | 'item_use'
    | 'spell_cast'
    | 'environmental_trigger';
  readonly requirements: string[];
  readonly difficulty: number;
}

export interface HiddenReward {
  readonly type:
    | 'item'
    | 'information'
    | 'ability'
    | 'connection'
    | 'story_progression';
  readonly value: any;
  readonly significance: 'minor' | 'moderate' | 'major' | 'legendary';
}

export interface InteractionRequirement {
  readonly type: 'skill' | 'item' | 'spell' | 'attribute' | 'knowledge';
  readonly target: string;
  readonly threshold: number | string;
}

export interface InteractionOutcome {
  readonly condition: string;
  readonly result: string;
  readonly consequences: string[];
  readonly rewards?: any[];
}

// ============================================================================
// POINTS OF INTEREST SYSTEM
// ============================================================================

export interface PointOfInterest {
  readonly id: UUID;
  readonly name: string;
  readonly description: string;
  readonly category: POICategory;
  readonly significance: POISignificance;
  readonly accessibility: POIAccessibility;
  readonly interactiveElements: InteractiveElement[];
  readonly narrativeHooks: NarrativeHook[];
  readonly connections: POIConnection[];
  readonly secrets: UUID[]; // Secret IDs
}

export interface NarrativeHook {
  readonly id: UUID;
  readonly trigger: string;
  readonly narrative: string;
  readonly choices: NarrativeChoice[];
  readonly consequences: string[];
}

export interface NarrativeChoice {
  readonly id: string;
  readonly text: string;
  readonly outcome: string;
  readonly skillCheck?: {
    skill: string;
    difficulty: number;
    successOutcome: string;
    failureOutcome: string;
  };
}

export interface POIConnection {
  readonly type: 'leads_to' | 'relates_to' | 'reveals' | 'unlocks' | 'warns_of';
  readonly target: UUID;
  readonly description: string;
}

export type POICategory =
  | 'landmark'
  | 'structure'
  | 'natural_feature'
  | 'ruins'
  | 'settlement'
  | 'hazard'
  | 'resource'
  | 'mystical';
export type POISignificance =
  | 'minor'
  | 'notable'
  | 'important'
  | 'major'
  | 'legendary';
export type POIAccessibility =
  | 'open'
  | 'restricted'
  | 'hidden'
  | 'dangerous'
  | 'magical_barrier'
  | 'skill_required';

// ============================================================================
// ENHANCED LOCATION GENERATOR CLASS
// ============================================================================

export class LocationGenerator {
  private static instance: LocationGenerator | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  public static getInstance(): LocationGenerator {
    if (!LocationGenerator.instance) {
      LocationGenerator.instance = new LocationGenerator();
    }
    return LocationGenerator.instance;
  }

  /**
   * Generate a complete location with environmental storytelling
   */
  public async generateEnhancedLocation(
    params: LocationGenerationParams,
    existingLocationContext?: {
      connectedLocations: Location[];
      worldLore: string;
      activeEvents: string[];
    }
  ): Promise<
    | {
        success: true;
        data: Location & {
          environmentalStory: EnvironmentalStory;
          pointsOfInterest: PointOfInterest[];
        };
      }
    | { success: false; error: GameError }
  > {
    try {
      const locationId = uuidv4() as UUID;

      // Generate base location structure
      const baseLocationResult = await this.generateBaseLocation(
        locationId,
        params,
        existingLocationContext
      );
      if (!baseLocationResult.success) {
        return baseLocationResult;
      }

      // Generate environmental storytelling
      const environmentalStoryResult = await this.generateEnvironmentalStory(
        locationId,
        params,
        baseLocationResult.data
      );
      if (!environmentalStoryResult.success) {
        return { success: false, error: environmentalStoryResult.error };
      }

      // Generate points of interest
      const pointsOfInterestResult = await this.generatePointsOfInterest(
        locationId,
        params,
        baseLocationResult.data
      );
      if (!pointsOfInterestResult.success) {
        return { success: false, error: pointsOfInterestResult.error };
      }

      // Generate enhanced features
      const enhancedFeatures = await this.generateEnhancedFeatures(
        locationId,
        params,
        environmentalStoryResult.data,
        pointsOfInterestResult.data
      );

      // Generate contextual secrets
      const secrets = await this.generateContextualSecrets(
        locationId,
        params,
        environmentalStoryResult.data
      );

      // Assemble enhanced location
      const enhancedLocation = {
        ...baseLocationResult.data,
        features: enhancedFeatures,
        secrets: secrets,
        environmentalStory: environmentalStoryResult.data,
        pointsOfInterest: pointsOfInterestResult.data,
      };

      return { success: true, data: enhancedLocation };
    } catch (error) {
      //TODO: Implement proper error logging service
      console.error('Enhanced location generation failed:', error);

      return {
        success: false,
        error: {
          code: 'LOCATION_GENERATION_ERROR' as ErrorCode,
          message: 'Failed to generate enhanced location',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Generate multiple interconnected locations for region building
   */
  public async generateLocationCluster(
    centerParams: LocationGenerationParams,
    clusterSize: number = 3,
    connectionDensity: 'sparse' | 'moderate' | 'dense' = 'moderate'
  ): Promise<
    | {
        success: true;
        data: Array<
          Location & {
            environmentalStory: EnvironmentalStory;
            pointsOfInterest: PointOfInterest[];
          }
        >;
      }
    | { success: false; error: GameError }
  > {
    try {
      if (clusterSize < 1 || clusterSize > 10) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR' as ErrorCode,
            message: 'Invalid cluster size',
            details: 'Cluster size must be between 1 and 10',
          },
        };
      }

      const locations: Array<
        Location & {
          environmentalStory: EnvironmentalStory;
          pointsOfInterest: PointOfInterest[];
        }
      > = [];

      // Generate center location first
      const centerLocationResult =
        await this.generateEnhancedLocation(centerParams);
      if (!centerLocationResult.success) {
        return centerLocationResult;
      }
      locations.push(centerLocationResult.data);

      // Generate surrounding locations
      for (let i = 1; i < clusterSize; i++) {
        const variationParams = this.generateVariationParams(centerParams, i);
        const locationResult = await this.generateEnhancedLocation(
          variationParams,
          {
            connectedLocations: locations,
            worldLore: `Connected region centered around ${centerLocationResult.data.name}`,
            activeEvents: [],
          }
        );

        if (locationResult.success) {
          // Create connections based on density
          this.establishConnections(
            locationResult.data,
            locations,
            connectionDensity
          );
          locations.push(locationResult.data);
        }
      }

      return { success: true, data: locations };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CLUSTER_GENERATION_ERROR' as ErrorCode,
          message: 'Failed to generate location cluster',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ============================================================================
  // PRIVATE GENERATION METHODS
  // ============================================================================

  private async generateBaseLocation(
    locationId: UUID,
    params: LocationGenerationParams,
    context?: {
      connectedLocations: Location[];
      worldLore: string;
      activeEvents: string[];
    }
  ): Promise<
    { success: true; data: Location } | { success: false; error: GameError }
  > {
    try {
      // Generate location using AI
      const locationResult = await generateRPGContent('world', {
        generationType: 'detailed_location',
        locationId,
        params,
        context: context || {},
        biomeDetails: this.getBiomeDetails(params.biome),
        themeInfluence: this.getThemeInfluence(params.theme),
        sizeDescriptors: this.getSizeDescriptors(params.size),
        dangerIndicators: this.getDangerIndicators(params.dangerLevel),
      });

      if (!locationResult.success || !locationResult.response?.content) {
        return {
          success: false,
          error: {
            code: 'AI_GENERATION_ERROR' as ErrorCode,
            message: 'Failed to generate base location',
            details: locationResult.error || 'No content generated',
          },
        };
      }

      // Parse AI response
      const aiContent = this.parseLocationFromAI(
        locationResult.response.content
      );

      const location: Location = {
        id: locationId,
        name: aiContent.name,
        description: aiContent.description,
        type: this.getLocationTypeForBiome(params.biome, params.theme),
        connections: [],
        features: [], // Will be populated by enhanced feature generation
        npcs: [],
        items: [],
        secrets: [], // Will be populated by secret generation
        isDiscovered: false,
      };

      return { success: true, data: location };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'BASE_LOCATION_ERROR' as ErrorCode,
          message: 'Failed to generate base location',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  private async generateEnvironmentalStory(
    locationId: UUID,
    params: LocationGenerationParams,
    baseLocation: Location
  ): Promise<
    | { success: true; data: EnvironmentalStory }
    | { success: false; error: GameError }
  > {
    try {
      // Generate environmental storytelling using AI
      const storyResult = await generateRPGContent('narrative', {
        generationType: 'environmental_storytelling',
        locationId,
        locationName: baseLocation.name,
        locationDescription: baseLocation.description,
        params,
        storyElements: {
          atmosphere: this.generateAtmosphericPrompts(params),
          narrativeStyle: this.getNarrativeStyleForTheme(params.theme),
          sensoryDetails: this.getSensoryPrompts(
            params.biome,
            params.timeOfDay
          ),
          mysticalElements: this.getMysticalPrompts(params.mysticalResonance),
        },
      });

      if (!storyResult.success || !storyResult.response?.content) {
        return {
          success: false,
          error: {
            code: 'STORY_GENERATION_ERROR' as ErrorCode,
            message: 'Failed to generate environmental story',
            details: storyResult.error || 'No story content generated',
          },
        };
      }

      // Parse environmental story from AI response
      const environmentalStory = this.parseEnvironmentalStoryFromAI(
        storyResult.response.content,
        params
      );

      return { success: true, data: environmentalStory };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'STORY_GENERATION_ERROR' as ErrorCode,
          message: 'Failed to generate environmental story',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  private async generatePointsOfInterest(
    locationId: UUID,
    params: LocationGenerationParams,
    baseLocation: Location
  ): Promise<
    | { success: true; data: PointOfInterest[] }
    | { success: false; error: GameError }
  > {
    try {
      const poiCount = this.calculatePOICount(params.size, params.biome);
      const pointsOfInterest: PointOfInterest[] = [];

      for (let i = 0; i < poiCount; i++) {
        const poiResult = await generateRPGContent('world', {
          generationType: 'point_of_interest',
          locationId,
          locationContext: baseLocation,
          params,
          poiIndex: i,
          existingPOIs: pointsOfInterest.map(poi => ({
            name: poi.name,
            category: poi.category,
          })),
          biomeInspiration: this.getBiomePOIInspiration(params.biome),
          themeInspiration: this.getThemePOIInspiration(params.theme),
        });

        if (poiResult.success && poiResult.response?.content) {
          const poi = this.parsePOIFromAI(poiResult.response.content, params);
          pointsOfInterest.push(poi);
        }
      }

      return { success: true, data: pointsOfInterest };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'POI_GENERATION_ERROR' as ErrorCode,
          message: 'Failed to generate points of interest',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  private async generateEnhancedFeatures(
    locationId: UUID,
    params: LocationGenerationParams,
    environmentalStory: EnvironmentalStory,
    pointsOfInterest: PointOfInterest[]
  ): Promise<LocationFeature[]> {
    //TODO: Implement comprehensive enhanced feature generation
    const features: LocationFeature[] = [];

    // Generate features based on environmental story
    environmentalStory.interactiveElements.forEach((element, index) => {
      features.push({
        id: uuidv4() as UUID,
        name: element.name,
        description: element.description,
        type: this.mapInteractionToFeatureType(element.interactionType),
        interactionType: element.interactionType,
        requirements: element.requirements.map(
          req => `${req.type}: ${req.target}`
        ),
        effects: this.generateFeatureEffects(element),
      });
    });

    // Generate features from points of interest
    pointsOfInterest.forEach(poi => {
      poi.interactiveElements.forEach(element => {
        features.push({
          id: uuidv4() as UUID,
          name: element.name,
          description: `${poi.name} - ${element.description}`,
          type: this.mapInteractionToFeatureType(element.interactionType),
          interactionType: element.interactionType,
          requirements: element.requirements.map(
            req => `${req.type}: ${req.target}`
          ),
        });
      });
    });

    // Generate biome-specific features
    const biomeFeatures = this.generateBiomeSpecificFeatures(
      params.biome,
      params.dangerLevel
    );
    features.push(...biomeFeatures);

    return features;
  }

  private async generateContextualSecrets(
    locationId: UUID,
    params: LocationGenerationParams,
    environmentalStory: EnvironmentalStory
  ): Promise<Secret[]> {
    //TODO: Implement comprehensive contextual secret generation
    const secrets: Secret[] = [];

    // Generate secrets from hidden elements
    environmentalStory.hiddenElements.forEach(hidden => {
      secrets.push({
        id: hidden.id,
        name: hidden.name,
        description: hidden.description,
        requirements: hidden.discoveryCriteria.requirements,
        reward:
          hidden.reward.type === 'item'
            ? {
                type: 'item',
                itemId: uuidv4() as UUID,
              }
            : undefined,
        isDiscovered: false,
        revealText: hidden.storySignificance,
      });
    });

    return secrets;
  }

  // ============================================================================
  // HELPER METHODS FOR AI CONTENT GENERATION
  // ============================================================================

  private getBiomeDetails(biome: BiomeType): any {
    const biomeDetails: Record<BiomeType, any> = {
      forest: {
        vegetation: 'dense',
        visibility: 'limited',
        sounds: 'rustling leaves, bird calls',
        hazards: 'wildlife, thick undergrowth',
      },
      desert: {
        terrain: 'sandy dunes',
        visibility: 'excellent',
        sounds: 'wind-blown sand, distant calls',
        hazards: 'heat, sandstorms',
      },
      mountain: {
        elevation: 'high',
        visibility: 'panoramic',
        sounds: 'wind, echoing calls',
        hazards: 'cliffs, altitude',
      },
      plains: {
        terrain: 'rolling grassland',
        visibility: 'far-reaching',
        sounds: 'wind in grass, wildlife',
        hazards: 'exposure, storms',
      },
      ocean: {
        environment: 'coastal/marine',
        visibility: 'varies',
        sounds: 'waves, seabirds',
        hazards: 'storms, tides',
      },
      arctic: {
        climate: 'freezing',
        visibility: 'varies',
        sounds: 'wind, cracking ice',
        hazards: 'cold, ice',
      },
      swamp: {
        terrain: 'wetland',
        visibility: 'poor',
        sounds: 'bubbling, croaking',
        hazards: 'disease, predators',
      },
      volcanic: {
        geology: 'igneous',
        visibility: 'hazy',
        sounds: 'rumbling, hissing',
        hazards: 'heat, toxic gases',
      },
      underground: {
        environment: 'subterranean',
        visibility: 'dark',
        sounds: 'echoes, dripping',
        hazards: 'darkness, cave-ins',
      },
      floating_islands: {
        physics: 'aerial',
        visibility: 'spectacular',
        sounds: 'wind, distant calls',
        hazards: 'falls, weather',
      },
      crystal_caverns: {
        geology: 'crystalline',
        visibility: 'reflective',
        sounds: 'chiming, echoes',
        hazards: 'sharp edges, disorientation',
      },
      shadow_realm: {
        reality: 'otherworldly',
        visibility: 'supernatural',
        sounds: 'whispers, unnatural',
        hazards: 'sanity, lost souls',
      },
      urban: {
        development: 'civilized',
        visibility: 'structured',
        sounds: 'human activity',
        hazards: 'crime, pollution',
      },
      wasteland: {
        condition: 'desolate',
        visibility: 'stark',
        sounds: 'emptiness, wind',
        hazards: 'radiation, scarcity',
      },
      jungle: {
        vegetation: 'dense tropical',
        visibility: 'very limited',
        sounds: 'animal calls, rustling',
        hazards: 'disease, predators',
      },
    };

    return biomeDetails[biome] || biomeDetails.plains;
  }

  private getThemeInfluence(theme: WorldTheme): any {
    const themeInfluences: Record<WorldTheme, any> = {
      fantasy: {
        magic: 'common',
        technology: 'medieval',
        creatures: 'mythical',
      },
      'sci-fi': {
        technology: 'advanced',
        science: 'prominent',
        atmosphere: 'futuristic',
      },
      steampunk: {
        technology: 'steam-powered',
        aesthetics: 'victorian',
        innovation: 'mechanical',
      },
      cyberpunk: {
        technology: 'digital',
        society: 'dystopian',
        aesthetics: 'neon-dark',
      },
      medieval: {
        technology: 'historical',
        society: 'feudal',
        authenticity: 'period-accurate',
      },
      modern: {
        technology: 'contemporary',
        society: 'global',
        realism: 'high',
      },
      horror: {
        atmosphere: 'terrifying',
        supernatural: 'present',
        psychology: 'dark',
      },
      mystery: {
        intrigue: 'high',
        secrets: 'abundant',
        investigation: 'central',
      },
      adventure: {
        exploration: 'emphasized',
        discovery: 'rewarding',
        action: 'prominent',
      },
      'post-apocalyptic': {
        survival: 'harsh',
        technology: 'scavenged',
        hope: 'scarce',
      },
      'space-opera': {
        scale: 'galactic',
        technology: 'exotic',
        adventure: 'epic',
      },
      'urban-fantasy': {
        magic: 'hidden',
        setting: 'modern',
        supernatural: 'secret',
      },
      historical: {
        accuracy: 'high',
        period: 'authentic',
        research: 'detailed',
      },
      custom: {
        flexibility: 'maximum',
        creativity: 'unrestricted',
        uniqueness: 'emphasized',
      },
    };

    return themeInfluences[theme] || themeInfluences.fantasy;
  }

  // ============================================================================
  // PARSING METHODS
  // ============================================================================

  private parseLocationFromAI(content: string): {
    name: string;
    description: string;
  } {
    //TODO: Implement robust location parsing with JSON extraction
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          name: parsed.name || 'Generated Location',
          description:
            parsed.description ||
            'A place of mystery and wonder awaits exploration.',
        };
      }
    } catch (e) {
      // Fallback parsing
    }

    return {
      name: 'Generated Location',
      description:
        content.length > 300 ? `${content.substring(0, 300)}...` : content,
    };
  }

  private parseEnvironmentalStoryFromAI(
    content: string,
    params: LocationGenerationParams
  ): EnvironmentalStory {
    //TODO: Implement robust environmental story parsing
    const defaultStory: EnvironmentalStory = {
      narrative: content.substring(0, 500),
      clues: this.generateDefaultClues(params),
      atmosphere: this.generateDefaultAtmosphere(params),
      hiddenElements: this.generateDefaultHiddenElements(params),
      interactiveElements: this.generateDefaultInteractiveElements(params),
    };

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          narrative: parsed.narrative || defaultStory.narrative,
          clues: parsed.clues || defaultStory.clues,
          atmosphere: parsed.atmosphere || defaultStory.atmosphere,
          hiddenElements: parsed.hiddenElements || defaultStory.hiddenElements,
          interactiveElements:
            parsed.interactiveElements || defaultStory.interactiveElements,
        };
      }
    } catch (e) {
      // Return default story
    }

    return defaultStory;
  }

  private parsePOIFromAI(
    content: string,
    params: LocationGenerationParams
  ): PointOfInterest {
    //TODO: Implement robust POI parsing
    const id = uuidv4() as UUID;

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          id,
          name: parsed.name || 'Point of Interest',
          description: parsed.description || 'An interesting location feature.',
          category: parsed.category || 'landmark',
          significance: parsed.significance || 'notable',
          accessibility: parsed.accessibility || 'open',
          interactiveElements: parsed.interactiveElements || [],
          narrativeHooks: parsed.narrativeHooks || [],
          connections: [],
          secrets: [],
        };
      }
    } catch (e) {
      // Fallback parsing
    }

    return {
      id,
      name: 'Point of Interest',
      description: content.substring(0, 200),
      category: 'landmark',
      significance: 'notable',
      accessibility: 'open',
      interactiveElements: [],
      narrativeHooks: [],
      connections: [],
      secrets: [],
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private getLocationTypeForBiome(
    biome: BiomeType,
    theme: WorldTheme
  ): LocationType {
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

  private calculatePOICount(size: LocationSize, biome: BiomeType): number {
    const baseCount = {
      tiny: 1,
      small: 2,
      medium: 3,
      large: 5,
      vast: 8,
    }[size];

    const biomeModifier =
      {
        urban: 1.5,
        ruins: 1.3,
        underground: 1.2,
        default: 1.0,
      }[biome] || 1.0;

    return Math.floor(baseCount * biomeModifier);
  }

  // Default generators for fallback content
  private generateDefaultClues(
    params: LocationGenerationParams
  ): EnvironmentalClue[] {
    return [
      {
        id: uuidv4() as UUID,
        type: 'physical',
        description: 'Subtle signs tell a story of what happened here.',
        skillRequired: 'investigation',
        difficultyClass: 15,
      },
    ];
  }

  private generateDefaultAtmosphere(
    params: LocationGenerationParams
  ): AtmosphericDetails {
    return {
      soundscape: ['ambient environmental sounds'],
      visualElements: ['atmospheric lighting and shadows'],
      scents: ['natural scents of the environment'],
      tactileElements: ['environmental textures'],
      emotionalResonance: ['mysterious'],
      lighting: 'dim',
    };
  }

  private generateDefaultHiddenElements(
    params: LocationGenerationParameters
  ): HiddenElement[] {
    return [
      {
        id: uuidv4() as UUID,
        name: 'Hidden Discovery',
        description: 'A secret awaits those who look closely.',
        discoveryCriteria: {
          method: 'investigation',
          requirements: ['careful observation'],
          difficulty: 12,
        },
        reward: {
          type: 'information',
          value: 'A piece of the greater story',
          significance: 'minor',
        },
        storySignificance: "Adds depth to the location's history",
      },
    ];
  }

  private generateDefaultInteractiveElements(
    params: LocationGenerationParams
  ): InteractiveElement[] {
    return [
      {
        id: uuidv4() as UUID,
        name: 'Interactive Feature',
        description: 'Something here can be examined more closely.',
        interactionType: 'examine',
        requirements: [],
        outcomes: [
          {
            condition: 'success',
            result: 'You discover something interesting.',
            consequences: ['gained insight'],
          },
        ],
        narrativeContext: 'A point of interaction within the location',
      },
    ];
  }

  private generateVariationParams(
    centerParams: LocationGenerationParams,
    variation: number
  ): LocationGenerationParams {
    const biomeVariations = this.getAdjacentBiomes(centerParams.biome);
    const selectedBiome = biomeVariations[variation % biomeVariations.length];

    return {
      ...centerParams,
      biome: selectedBiome,
      size: this.varySize(centerParams.size),
      dangerLevel: this.varyDangerLevel(centerParams.dangerLevel),
      connectivityLevel: 'connected',
    };
  }

  private getAdjacentBiomes(biome: BiomeType): BiomeType[] {
    const adjacentMap: Record<BiomeType, BiomeType[]> = {
      plains: ['forest', 'mountain', 'desert'],
      forest: ['plains', 'mountain', 'swamp'],
      mountain: ['plains', 'forest', 'arctic'],
      desert: ['plains', 'mountain', 'wasteland'],
      // Add more mappings as needed
    };

    return adjacentMap[biome] || [biome];
  }

  private varySize(size: LocationSize): LocationSize {
    const sizes: LocationSize[] = ['tiny', 'small', 'medium', 'large', 'vast'];
    const currentIndex = sizes.indexOf(size);
    const variation = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
    const newIndex = Math.max(
      0,
      Math.min(sizes.length - 1, currentIndex + variation)
    );
    return sizes[newIndex];
  }

  private varyDangerLevel(danger: DangerLevel): DangerLevel {
    const levels: DangerLevel[] = [
      'safe',
      'low',
      'moderate',
      'high',
      'extreme',
    ];
    const currentIndex = levels.indexOf(danger);
    const variation = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
    const newIndex = Math.max(
      0,
      Math.min(levels.length - 1, currentIndex + variation)
    );
    return levels[newIndex];
  }

  private establishConnections(
    newLocation: Location,
    existingLocations: Location[],
    density: 'sparse' | 'moderate' | 'dense'
  ): void {
    const connectionCount = {
      sparse: 1,
      moderate: 2,
      dense: 3,
    }[density];

    for (
      let i = 0;
      i < Math.min(connectionCount, existingLocations.length);
      i++
    ) {
      const targetLocation =
        existingLocations[Math.floor(Math.random() * existingLocations.length)];
      if (!newLocation.connections.includes(targetLocation.id)) {
        (newLocation.connections as UUID[]).push(targetLocation.id);
        (targetLocation.connections as UUID[]).push(newLocation.id);
      }
    }
  }

  // Additional helper methods for feature generation
  private mapInteractionToFeatureType(
    interactionType: InteractionType
  ): LocationFeature['type'] {
    const mapping: Record<InteractionType, LocationFeature['type']> = {
      examine: 'interactive',
      touch: 'interactive',
      activate: 'interactive',
      climb: 'interactive',
      dig: 'treasure',
      cast_spell: 'interactive',
      solve_puzzle: 'interactive',
      ritual: 'interactive',
    };

    return mapping[interactionType] || 'interactive';
  }

  private generateFeatureEffects(
    element: InteractiveElement
  ): Record<string, any> {
    //TODO: Implement comprehensive feature effect generation
    return {
      interaction: element.interactionType,
      requirements: element.requirements,
      outcomes: element.outcomes.length,
    };
  }

  private generateBiomeSpecificFeatures(
    biome: BiomeType,
    dangerLevel: DangerLevel
  ): LocationFeature[] {
    //TODO: Implement biome-specific feature generation
    const features: LocationFeature[] = [];

    const biomeFeatureTemplates: Record<
      BiomeType,
      Array<{ name: string; type: LocationFeature['type'] }>
    > = {
      forest: [
        { name: 'Ancient Tree', type: 'interactive' },
        { name: 'Hidden Grove', type: 'treasure' },
        { name: 'Animal Trail', type: 'interactive' },
      ],
      desert: [
        { name: 'Oasis', type: 'interactive' },
        { name: 'Sand Dune', type: 'decorative' },
        { name: 'Buried Relic', type: 'treasure' },
      ],
      // Add more biome templates
    };

    const templates = biomeFeatureTemplates[biome] || [
      { name: 'Natural Feature', type: 'decorative' },
    ];

    templates.forEach(template => {
      features.push({
        id: uuidv4() as UUID,
        name: template.name,
        description: `A ${biome} feature that adds to the location's character.`,
        type: template.type,
        interactionType: 'examine',
      });
    });

    return features;
  }

  // Atmospheric and sensory prompt generators
  private generateAtmosphericPrompts(params: LocationGenerationParams): any {
    return {
      timeOfDay: params.timeOfDay,
      weather: params.weatherCondition,
      mysticalResonance: params.mysticalResonance,
      culturalInfluence: params.culturalInfluence,
    };
  }

  private getNarrativeStyleForTheme(theme: WorldTheme): string {
    const styles: Record<WorldTheme, string> = {
      fantasy: 'epic and mystical',
      'sci-fi': 'analytical and speculative',
      horror: 'atmospheric and foreboding',
      mystery: 'intriguing and observant',
      adventure: 'exciting and descriptive',
    };

    return styles[theme] || 'descriptive and immersive';
  }

  private getSensoryPrompts(biome: BiomeType, timeOfDay: TimeOfDay): any {
    return {
      biome: this.getBiomeDetails(biome),
      timeOfDay,
      sensoryFocus: ['visual', 'auditory', 'tactile', 'olfactory'],
    };
  }

  private getMysticalPrompts(mysticalResonance: MysticalResonance): any {
    const prompts: Record<MysticalResonance, any> = {
      none: { magical: false, supernatural: false },
      faint: { magical: 'subtle', supernatural: 'barely perceptible' },
      moderate: { magical: 'noticeable', supernatural: 'present' },
      strong: { magical: 'prominent', supernatural: 'obvious' },
      overwhelming: { magical: 'dominant', supernatural: 'all-encompassing' },
    };

    return prompts[mysticalResonance] || prompts.none;
  }

  private getBiomePOIInspiration(biome: BiomeType): any {
    const inspirations: Record<BiomeType, string[]> = {
      forest: [
        'ancient groves',
        'wildlife clearings',
        'hidden streams',
        'ruined structures',
      ],
      desert: ['oases', 'rock formations', 'buried treasures', 'nomad camps'],
      mountain: ['peaks', 'caves', 'waterfalls', 'ancient paths'],
      // Add more biome inspirations
    };

    return (
      inspirations[biome] || [
        'natural features',
        'interesting formations',
        'hidden discoveries',
      ]
    );
  }

  private getThemePOIInspiration(theme: WorldTheme): any {
    const inspirations: Record<WorldTheme, string[]> = {
      fantasy: [
        'magical phenomena',
        'ancient artifacts',
        'mystical creatures',
        'enchanted locations',
      ],
      'sci-fi': [
        'technological remnants',
        'energy sources',
        'alien structures',
        'data caches',
      ],
      horror: [
        'ominous signs',
        'supernatural presences',
        'disturbing discoveries',
        'cursed objects',
      ],
      // Add more theme inspirations
    };

    return (
      inspirations[theme] || [
        'interesting features',
        'notable locations',
        'discovery opportunities',
      ]
    );
  }
}

// ============================================================================
// SINGLETON INSTANCE EXPORT
// ============================================================================

export const locationGenerator = LocationGenerator.getInstance();

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export type {
  LocationGenerationParams,
  EnvironmentalStory,
  PointOfInterest,
  AtmosphericDetails,
  InteractiveElement,
  HiddenElement,
  LocationSize,
  DangerLevel,
  TimeOfDay,
  MysticalResonance,
};
