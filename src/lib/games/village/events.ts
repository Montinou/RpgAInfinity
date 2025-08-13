/**
 * Village Events System for RpgAInfinity
 *
 * Implements dynamic event generation, player choice systems, and consequence tracking
 * for the Village Simulator game mode. Integrates with AI services for narrative generation.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Village,
  VillageEvent,
  EventType,
  EventSeverity,
  EventResponse,
  EventEffect,
  EventOutcome,
  HistoricalEvent,
  SeasonType,
  ResourceType,
  EventRequirement,
  VillageGameState,
  ImpactAssessment,
} from '@/types/village';
import { generateVillageContent } from '@/lib/ai';
import { kvService } from '@/lib/database/kv-service';

// ============================================================================
// CORE EVENT MANAGER INTERFACE
// ============================================================================

export interface EventManager {
  generateRandomEvents(village: Village): Promise<GameEvent[]>;
  processEvent(event: GameEvent, village: Village): Promise<EventResult>;
  createEventChains(
    triggerEvent: GameEvent,
    village: Village
  ): Promise<GameEvent[]>;
  calculateEventProbability(eventType: EventType, village: Village): number;
  handlePlayerChoices(
    event: GameEvent,
    choice: PlayerChoice
  ): Promise<EventOutcome>;
  scheduleSeasonalEvents(
    village: Village,
    season: SeasonType
  ): Promise<ScheduledEvent[]>;
}

// ============================================================================
// EXTENDED EVENT TYPES AND INTERFACES
// ============================================================================

export interface GameEvent extends VillageEvent {
  // Enhanced event data
  probability: number; // 0-100, calculated probability of this event
  triggerConditions: EventTrigger[];
  chainReactions: ChainReaction[];

  // Player interaction
  playerChoices: PlayerChoice[];
  timeLimit?: number; // Seconds to make choice, undefined = no limit

  // Event state
  parentEventId?: string; // If this is part of an event chain
  childEventIds: string[]; // Events spawned from this one

  // AI generation metadata
  generationSeed?: string;
  narrativeContext?: NarrativeContext;
}

export interface EventTrigger {
  type:
    | 'resource'
    | 'population'
    | 'happiness'
    | 'season'
    | 'building'
    | 'time'
    | 'random';
  condition: string; // Specific condition description
  threshold?: number; // Numeric threshold if applicable
  probability: number; // 0-100, chance this trigger fires
}

export interface ChainReaction {
  eventType: EventType;
  delay: number; // Days until triggered
  probability: number; // 0-100
  condition?: string; // Additional condition for trigger
  description: string;
}

export interface PlayerChoice {
  id: string;
  name: string;
  description: string;
  icon?: string; // UI icon identifier

  // Requirements and costs
  requirements: EventRequirement[];
  resourceCost: Array<{ resource: ResourceType; amount: number }>;
  timeCost?: number; // Days to implement

  // Outcomes and consequences
  immediateEffects: EventEffect[];
  delayedEffects: DelayedEffect[];
  chainEvents: string[]; // Event IDs that may be triggered

  // Probability and risk
  successChance: number; // 0-100
  criticalSuccessChance: number; // 0-100, chance of better outcome
  failureConsequences: EventEffect[];

  // Narrative
  flavorText?: string;
  outcomeDescriptions: {
    success: string;
    criticalSuccess?: string;
    failure: string;
  };
}

export interface DelayedEffect extends EventEffect {
  delay: number; // Days until effect triggers
  condition?: string; // Optional condition for effect to trigger
}

export interface NarrativeContext {
  tone: 'serious' | 'lighthearted' | 'mysterious' | 'urgent' | 'celebratory';
  themes: string[];
  previousEvents: string[]; // Recent event IDs for context
  villagePersonality: string; // Village personality summary
  culturalElements: string[]; // Cultural aspects to include
}

export interface EventResult {
  success: boolean;
  event: GameEvent;
  outcome: EventOutcome;
  chainEvents: GameEvent[];
  villageChanges: VillageStateChanges;
  narrativeText: string;
}

export interface VillageStateChanges {
  resourceChanges: Record<ResourceType, number>;
  happinessChange: number;
  stabilityChange: number;
  prosperityChange: number;
  defenseChange: number;
  populationChange: number;
  buildingEffects: Array<{ buildingId: string; effects: EventEffect[] }>;
  newBuildings: Array<{ type: string; position: { x: number; y: number } }>;
}

export interface ScheduledEvent {
  eventId: string;
  scheduledDate: Date;
  eventType: EventType;
  name: string;
  description: string;
  isRecurring: boolean;
  recurrencePattern?: RecurrencePattern;
}

export interface RecurrencePattern {
  type: 'daily' | 'weekly' | 'monthly' | 'seasonal' | 'annual';
  interval: number; // Every N periods
  conditions?: string[]; // Additional conditions for recurrence
}

// ============================================================================
// EVENT CATEGORIES AND DEFINITIONS
// ============================================================================

export const EVENT_CATEGORIES = {
  NATURAL: {
    types: ['weather', 'disaster', 'abundance', 'seasonal_change'],
    baseWeight: 25,
    seasonalModifiers: {
      spring: 1.2,
      summer: 1.0,
      autumn: 0.8,
      winter: 1.1,
    },
  },
  SOCIAL: {
    types: ['festival', 'conflict', 'migration', 'marriage', 'birth', 'death'],
    baseWeight: 30,
    populationModifiers: {
      low: 0.7,
      medium: 1.0,
      high: 1.3,
    },
  },
  ECONOMIC: {
    types: [
      'trade_opportunity',
      'market_crash',
      'discovery',
      'resource_depletion',
    ],
    baseWeight: 20,
    prosperityModifiers: {
      poor: 1.5,
      modest: 1.0,
      wealthy: 0.8,
    },
  },
  MAGICAL: {
    types: [
      'mysterious_phenomena',
      'magical_discovery',
      'supernatural_visitor',
      'ancient_awakening',
    ],
    baseWeight: 10,
    //TODO: Implement magic system integration
    magicModifiers: {
      low: 0.5,
      medium: 1.0,
      high: 1.5,
    },
  },
  CRISIS: {
    types: [
      'plague',
      'raid',
      'famine',
      'political_upheaval',
      'natural_disaster',
    ],
    baseWeight: 15,
    stabilityModifiers: {
      unstable: 2.0,
      stable: 1.0,
      very_stable: 0.5,
    },
  },
} as const;

// ============================================================================
// MAIN EVENT MANAGER IMPLEMENTATION
// ============================================================================

export class VillageEventManager implements EventManager {
  private village: Village;
  private activeEvents: Map<string, GameEvent> = new Map();
  private eventHistory: HistoricalEvent[] = [];
  private scheduledEvents: ScheduledEvent[] = [];

  constructor(village: Village) {
    this.village = village;
    this.loadEventHistory();
    this.loadScheduledEvents();
  }

  /**
   * Generate random events based on village state and conditions
   */
  async generateRandomEvents(village: Village): Promise<GameEvent[]> {
    const events: GameEvent[] = [];
    const currentDate = new Date();

    // Calculate how many events to generate based on village size and activity
    const baseEventChance = this.calculateBaseEventChance(village);
    const eventCount = Math.random() < baseEventChance ? 1 : 0;

    if (eventCount === 0) return events;

    // Generate event using weighted category selection
    const selectedCategory = this.selectEventCategory(village);
    const eventType = this.selectEventType(selectedCategory, village);

    try {
      // Use AI to generate event content
      const aiResponse = await generateVillageContent('events', {
        villageState: {
          name: village.name,
          size: village.size,
          population: village.population.total,
          happiness: village.happiness,
          stability: village.stability,
          prosperity: village.prosperity,
          resources: this.simplifyResources(village.resources),
          age: village.age,
        },
        season: village.season.current,
        weather: village.weather.current,
        eventCategory: selectedCategory,
        eventType,
        severity: this.calculateEventSeverity(village),
        previousEvents: this.getRecentEventSummary(),
        villagePersonality: this.getVillagePersonalitySummary(village),
        culturalContext: village.aiPersonality || {},
      });

      if (aiResponse.success && aiResponse.response?.content) {
        const generatedEvent = this.parseAIEventResponse(
          aiResponse.response.content
        );
        const event = this.enrichEventData(
          generatedEvent,
          village,
          selectedCategory,
          eventType
        );
        events.push(event);

        // Store event for future reference
        this.activeEvents.set(event.id, event);
      }
    } catch (error) {
      console.error('Failed to generate village event:', error);

      // Fallback to predefined event if AI generation fails
      const fallbackEvent = this.generateFallbackEvent(
        selectedCategory,
        eventType,
        village
      );
      events.push(fallbackEvent);
    }

    return events;
  }

  /**
   * Process an event and apply its effects to the village
   */
  async processEvent(event: GameEvent, village: Village): Promise<EventResult> {
    const startTime = Date.now();

    try {
      // Validate event can be processed
      if (!this.validateEventProcessing(event, village)) {
        throw new Error(
          `Event ${event.id} cannot be processed in current village state`
        );
      }

      // Calculate event outcome
      const outcome = await this.calculateEventOutcome(event, village);

      // Apply immediate effects
      const villageChanges = this.applyEventEffects(event.effects, village);

      // Generate chain events if applicable
      const chainEvents = await this.createEventChains(event, village);

      // Generate narrative description
      const narrativeText = await this.generateEventNarrative(
        event,
        outcome,
        village
      );

      // Update village state
      this.updateVillageFromChanges(village, villageChanges);

      // Record in history
      await this.recordEventInHistory(event, outcome, villageChanges);

      // Schedule any delayed effects
      this.scheduleDelayedEffects(event);

      return {
        success: true,
        event,
        outcome,
        chainEvents,
        villageChanges,
        narrativeText,
      };
    } catch (error) {
      console.error('Error processing village event:', error);

      return {
        success: false,
        event,
        outcome: {
          success: false,
          description: `Event processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          unexpectedConsequences: ['Event processing error occurred'],
          resourceChanges: {} as Record<ResourceType, number>,
          populationChange: 0,
          happinessChange: -5, // Small happiness penalty for system errors
          stabilityChange: -2,
        },
        chainEvents: [],
        villageChanges: {
          resourceChanges: {} as Record<ResourceType, number>,
          happinessChange: -5,
          stabilityChange: -2,
          prosperityChange: 0,
          defenseChange: 0,
          populationChange: 0,
          buildingEffects: [],
          newBuildings: [],
        },
        narrativeText:
          'The village experienced some confusion as strange circumstances unfolded, but life continues on.',
      };
    }
  }

  /**
   * Create event chains from trigger events
   */
  async createEventChains(
    triggerEvent: GameEvent,
    village: Village
  ): Promise<GameEvent[]> {
    const chainEvents: GameEvent[] = [];

    // Process chain reactions defined in the trigger event
    for (const reaction of triggerEvent.chainReactions) {
      // Check if chain reaction should trigger
      const shouldTrigger = Math.random() * 100 < reaction.probability;
      if (!shouldTrigger) continue;

      // Check additional conditions
      if (
        reaction.condition &&
        !this.evaluateCondition(reaction.condition, village)
      ) {
        continue;
      }

      try {
        // Generate chained event
        const chainedEvents = await this.generateChainedEvent(
          reaction,
          triggerEvent,
          village
        );
        chainEvents.push(...chainedEvents);

        // Schedule delayed chain events
        if (reaction.delay > 0) {
          this.scheduleChainEvent(chainedEvents[0], reaction.delay);
        }
      } catch (error) {
        console.error(`Failed to create chain event: ${error}`);
        // Continue processing other chain reactions
      }
    }

    return chainEvents;
  }

  /**
   * Calculate event probability based on village conditions
   */
  calculateEventProbability(eventType: EventType, village: Village): number {
    let baseProbability = 10; // Base 10% chance per check

    // Adjust based on event type and village conditions
    switch (eventType) {
      case 'natural':
        baseProbability *= this.getNaturalEventModifier(village);
        break;
      case 'social':
        baseProbability *= this.getSocialEventModifier(village);
        break;
      case 'economic':
        baseProbability *= this.getEconomicEventModifier(village);
        break;
      case 'military':
        baseProbability *= this.getMilitaryEventModifier(village);
        break;
      case 'cultural':
        baseProbability *= this.getCulturalEventModifier(village);
        break;
      default:
        // Default modifier for other event types
        baseProbability *= 1.0;
    }

    // Apply general village state modifiers
    baseProbability *= this.getVillageStateModifier(village);

    // Ensure probability stays within reasonable bounds
    return Math.max(1, Math.min(95, baseProbability));
  }

  /**
   * Handle player choices for events
   */
  async handlePlayerChoices(
    event: GameEvent,
    choice: PlayerChoice
  ): Promise<EventOutcome> {
    try {
      // Validate choice requirements
      if (!this.validateChoiceRequirements(choice, this.village)) {
        return {
          success: false,
          description:
            'The chosen action cannot be taken due to insufficient resources or unmet requirements.',
          unexpectedConsequences: ['Player choice requirements not met'],
          resourceChanges: {} as Record<ResourceType, number>,
          populationChange: 0,
          happinessChange: -5,
          stabilityChange: -2,
        };
      }

      // Apply resource costs
      this.applyChoiceCosts(choice, this.village);

      // Calculate success based on choice success chance
      const roll = Math.random() * 100;
      const isSuccess = roll < choice.successChance;
      const isCriticalSuccess = roll < choice.criticalSuccessChance;

      let effects: EventEffect[];
      let description: string;

      if (isCriticalSuccess) {
        effects = [...choice.immediateEffects].map(effect => ({
          ...effect,
          modifier: effect.modifier * 1.5, // 50% bonus for critical success
        }));
        description =
          choice.outcomeDescriptions.criticalSuccess ||
          choice.outcomeDescriptions.success;
      } else if (isSuccess) {
        effects = choice.immediateEffects;
        description = choice.outcomeDescriptions.success;
      } else {
        effects = choice.failureConsequences;
        description = choice.outcomeDescriptions.failure;
      }

      // Apply effects to village
      const villageChanges = this.applyEventEffects(effects, this.village);

      // Schedule delayed effects
      this.scheduleDelayedEffects(choice.delayedEffects);

      // Trigger chain events
      await this.triggerChainEvents(choice.chainEvents, event);

      return {
        success: isSuccess,
        description,
        unexpectedConsequences: this.generateUnexpectedConsequences(
          choice,
          isSuccess
        ),
        resourceChanges: villageChanges.resourceChanges,
        populationChange: villageChanges.populationChange,
        happinessChange: villageChanges.happinessChange,
        stabilityChange: villageChanges.stabilityChange,
      };
    } catch (error) {
      console.error('Error handling player choice:', error);

      return {
        success: false,
        description:
          'An unexpected complication arose while implementing your decision.',
        unexpectedConsequences: ['System error during choice processing'],
        resourceChanges: {} as Record<ResourceType, number>,
        populationChange: 0,
        happinessChange: -3,
        stabilityChange: -1,
      };
    }
  }

  /**
   * Schedule seasonal events
   */
  async scheduleSeasonalEvents(
    village: Village,
    season: SeasonType
  ): Promise<ScheduledEvent[]> {
    const scheduledEvents: ScheduledEvent[] = [];
    const seasonalEventTypes = this.getSeasonalEventTypes(season);

    for (const eventType of seasonalEventTypes) {
      const scheduledDate = this.calculateSeasonalEventDate(season, eventType);

      const scheduledEvent: ScheduledEvent = {
        eventId: uuidv4(),
        scheduledDate,
        eventType: 'cultural',
        name: this.getSeasonalEventName(eventType, season),
        description: this.getSeasonalEventDescription(eventType, season),
        isRecurring: true,
        recurrencePattern: {
          type: 'seasonal',
          interval: 1,
          conditions: [`season:${season}`],
        },
      };

      scheduledEvents.push(scheduledEvent);
    }

    // Store scheduled events
    this.scheduledEvents.push(...scheduledEvents);
    await this.persistScheduledEvents();

    return scheduledEvents;
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private calculateBaseEventChance(village: Village): number {
    // Base chance starts at 15%
    let chance = 0.15;

    // Village size affects event frequency
    const sizeMultipliers = {
      hamlet: 0.8,
      village: 1.0,
      town: 1.2,
      city: 1.4,
    };
    chance *= sizeMultipliers[village.size];

    // Population density affects social events
    if (village.population.total > 200) chance *= 1.1;
    if (village.population.total > 500) chance *= 1.2;

    // Instability increases event chance
    if (village.stability < 30) chance *= 1.5;
    else if (village.stability < 60) chance *= 1.2;

    // Very happy villages have more celebratory events
    if (village.happiness > 80) chance *= 1.3;

    return Math.min(0.8, chance); // Cap at 80% chance
  }

  private selectEventCategory(village: Village): string {
    const categories = Object.keys(EVENT_CATEGORIES);
    const weights: number[] = [];

    for (const category of categories) {
      let weight =
        EVENT_CATEGORIES[category as keyof typeof EVENT_CATEGORIES].baseWeight;

      // Apply modifiers based on village state
      switch (category) {
        case 'NATURAL':
          weight *= this.getSeasonalModifier(village.season.current);
          break;
        case 'SOCIAL':
          weight *= this.getPopulationModifier(village.population.total);
          break;
        case 'ECONOMIC':
          weight *= this.getProsperityModifier(village.prosperity);
          break;
        case 'CRISIS':
          weight *= this.getStabilityModifier(village.stability);
          break;
      }

      weights.push(weight);
    }

    return this.weightedRandomSelect(categories, weights);
  }

  private selectEventType(category: string, village: Village): string {
    const categoryData =
      EVENT_CATEGORIES[category as keyof typeof EVENT_CATEGORIES];
    if (!categoryData) return 'miscellaneous';

    const types = categoryData.types;
    const weights = new Array(types.length).fill(1); // Equal weights for now

    //TODO: Implement more sophisticated event type weighting based on village conditions

    return this.weightedRandomSelect(types, weights);
  }

  private weightedRandomSelect(items: string[], weights: number[]): string {
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < items.length; i++) {
      if (random < weights[i]) {
        return items[i];
      }
      random -= weights[i];
    }

    return items[items.length - 1]; // Fallback
  }

  private async loadEventHistory(): Promise<void> {
    try {
      const historyKey = `village:${this.village.id}:event_history`;
      const history = await kvService.get<HistoricalEvent[]>(historyKey);
      this.eventHistory = history || [];
    } catch (error) {
      console.error('Failed to load event history:', error);
      this.eventHistory = [];
    }
  }

  private async loadScheduledEvents(): Promise<void> {
    try {
      const scheduleKey = `village:${this.village.id}:scheduled_events`;
      const scheduled = await kvService.get<ScheduledEvent[]>(scheduleKey);
      this.scheduledEvents = scheduled || [];
    } catch (error) {
      console.error('Failed to load scheduled events:', error);
      this.scheduledEvents = [];
    }
  }

  private simplifyResources(resources: any): Record<string, number> {
    //TODO: Properly type the resource simplification
    return {
      food: resources?.resources?.food?.current || 0,
      wood: resources?.resources?.wood?.current || 0,
      stone: resources?.resources?.stone?.current || 0,
      gold: resources?.resources?.gold?.current || 0,
    };
  }

  private getRecentEventSummary(): string[] {
    return this.eventHistory
      .slice(-5) // Last 5 events
      .map(event => event.name);
  }

  private getVillagePersonalitySummary(village: Village): string {
    const personality = village.aiPersonality;
    if (!personality) return 'pragmatic and adaptable';

    const traits = [
      personality.conservatism > 70
        ? 'traditional'
        : personality.conservatism < 30
          ? 'progressive'
          : 'balanced',
      personality.cooperation > 70
        ? 'cooperative'
        : personality.cooperation < 30
          ? 'individualistic'
          : 'moderate',
      personality.ambition > 70
        ? 'ambitious'
        : personality.ambition < 30
          ? 'content'
          : 'steady',
    ];

    return traits.join(', ');
  }

  private parseAIEventResponse(content: string): Partial<GameEvent> {
    //TODO: Implement proper AI response parsing with JSON schema validation
    // For now, return a basic structure that will be enriched
    return {
      name: 'AI Generated Event',
      description: content.substring(0, 500),
      type: 'social' as EventType,
      severity: 'moderate' as EventSeverity,
    };
  }

  private enrichEventData(
    baseEvent: Partial<GameEvent>,
    village: Village,
    category: string,
    eventType: string
  ): GameEvent {
    const id = uuidv4();
    const now = new Date();

    return {
      id,
      name: baseEvent.name || `${category} Event`,
      type: (baseEvent.type || eventType) as EventType,
      severity: baseEvent.severity || ('moderate' as EventSeverity),
      description:
        baseEvent.description ||
        'Something interesting happens in the village.',
      startDate: now,
      duration: baseEvent.duration || 1,
      effects: baseEvent.effects || [],
      responses: baseEvent.responses || [],
      isActive: true,
      isResolved: false,
      generatedByAI: true,

      // Enhanced properties
      probability: this.calculateEventProbability(
        (baseEvent.type as EventType) || 'social',
        village
      ),
      triggerConditions: [],
      chainReactions: [],
      playerChoices:
        baseEvent.responses?.map(r => this.convertResponseToChoice(r)) || [],
      parentEventId: undefined,
      childEventIds: [],
      generationSeed: uuidv4(),
      narrativeContext: {
        tone: this.determineTone(baseEvent.severity || 'moderate'),
        themes: [category.toLowerCase()],
        previousEvents: this.getRecentEventSummary(),
        villagePersonality: this.getVillagePersonalitySummary(village),
        culturalElements: [],
      },
    };
  }

  private generateFallbackEvent(
    category: string,
    eventType: string,
    village: Village
  ): GameEvent {
    const fallbackEvents = {
      SOCIAL: {
        name: 'Village Gathering',
        description:
          'The villagers come together for an impromptu gathering to discuss recent happenings.',
        effects: [
          {
            type: 'happiness' as const,
            modifier: 5,
            duration: 1,
            description: 'Community bonding',
          },
        ],
      },
      ECONOMIC: {
        name: 'Trade Opportunity',
        description:
          'A traveling merchant offers to trade goods with the village.',
        effects: [
          {
            type: 'resource' as const,
            modifier: 10,
            duration: 1,
            description: 'Trade opportunity',
          },
        ],
      },
      NATURAL: {
        name: 'Pleasant Weather',
        description:
          "The weather has been particularly pleasant, lifting everyone's spirits.",
        effects: [
          {
            type: 'happiness' as const,
            modifier: 3,
            duration: 2,
            description: 'Good weather',
          },
        ],
      },
    };

    const fallback =
      fallbackEvents[category as keyof typeof fallbackEvents] ||
      fallbackEvents.SOCIAL;

    return this.enrichEventData(fallback, village, category, eventType);
  }

  // Additional helper methods continue...
  //TODO: Implement remaining helper methods for complete event processing

  private validateEventProcessing(event: GameEvent, village: Village): boolean {
    // Basic validation - can be expanded
    return event.isActive && !event.isResolved;
  }

  private async calculateEventOutcome(
    event: GameEvent,
    village: Village
  ): Promise<EventOutcome> {
    // Simplified outcome calculation
    return {
      success: true,
      description: 'The event unfolded as expected.',
      unexpectedConsequences: [],
      resourceChanges: {} as Record<ResourceType, number>,
      populationChange: 0,
      happinessChange: 0,
      stabilityChange: 0,
    };
  }

  private applyEventEffects(
    effects: EventEffect[],
    village: Village
  ): VillageStateChanges {
    const changes: VillageStateChanges = {
      resourceChanges: {} as Record<ResourceType, number>,
      happinessChange: 0,
      stabilityChange: 0,
      prosperityChange: 0,
      defenseChange: 0,
      populationChange: 0,
      buildingEffects: [],
      newBuildings: [],
    };

    for (const effect of effects) {
      switch (effect.type) {
        case 'happiness':
          changes.happinessChange += effect.modifier;
          break;
        case 'stability':
          changes.stabilityChange += effect.modifier;
          break;
        case 'resource':
          // TODO: Properly handle resource effects
          break;
        case 'population':
          changes.populationChange += effect.modifier;
          break;
      }
    }

    return changes;
  }

  private async generateEventNarrative(
    event: GameEvent,
    outcome: EventOutcome,
    village: Village
  ): Promise<string> {
    // TODO: Use AI to generate rich narrative text
    return `The ${event.name.toLowerCase()} ${outcome.success ? 'concluded successfully' : 'had mixed results'} in ${village.name}.`;
  }

  private updateVillageFromChanges(
    village: Village,
    changes: VillageStateChanges
  ): void {
    village.happiness = Math.max(
      0,
      Math.min(100, village.happiness + changes.happinessChange)
    );
    village.stability = Math.max(
      0,
      Math.min(100, village.stability + changes.stabilityChange)
    );
    village.prosperity = Math.max(
      0,
      Math.min(100, village.prosperity + changes.prosperityChange)
    );
    village.defense = Math.max(
      0,
      Math.min(100, village.defense + changes.defenseChange)
    );

    village.population.total += changes.populationChange;
    village.updatedAt = new Date();
  }

  private async recordEventInHistory(
    event: GameEvent,
    outcome: EventOutcome,
    changes: VillageStateChanges
  ): Promise<void> {
    const historicalEvent: HistoricalEvent = {
      eventId: event.id,
      name: event.name,
      type: event.type,
      date: event.startDate,
      duration: event.duration,
      outcome,
      consequences: [outcome.description],
      shortTermImpact: this.calculateImpactAssessment(changes, 'short'),
      longTermImpact: this.calculateImpactAssessment(changes, 'long'),
      lessonsLearned: [],
      commemorated: false,
    };

    this.eventHistory.push(historicalEvent);

    // Persist to storage
    const historyKey = `village:${this.village.id}:event_history`;
    await kvService.set(historyKey, this.eventHistory);
  }

  private calculateImpactAssessment(
    changes: VillageStateChanges,
    timeframe: 'short' | 'long'
  ): ImpactAssessment {
    // Simplified impact assessment
    return {
      economic: changes.prosperityChange,
      social: changes.happinessChange,
      political: changes.stabilityChange,
      cultural: 0,
      description: `${timeframe === 'short' ? 'Immediate' : 'Long-term'} effects on the village.`,
    };
  }

  private scheduleDelayedEffects(
    effects: DelayedEffect[] | EventEffect[]
  ): void {
    // TODO: Implement delayed effect scheduling
  }

  private async generateChainedEvent(
    reaction: ChainReaction,
    triggerEvent: GameEvent,
    village: Village
  ): Promise<GameEvent[]> {
    // TODO: Implement chained event generation
    return [];
  }

  private scheduleChainEvent(event: GameEvent, delay: number): void {
    // TODO: Implement chain event scheduling
  }

  private evaluateCondition(condition: string, village: Village): boolean {
    // TODO: Implement condition evaluation
    return true;
  }

  // More helper methods...
  private getNaturalEventModifier(village: Village): number {
    return 1.0;
  }
  private getSocialEventModifier(village: Village): number {
    return 1.0;
  }
  private getEconomicEventModifier(village: Village): number {
    return 1.0;
  }
  private getMilitaryEventModifier(village: Village): number {
    return 1.0;
  }
  private getCulturalEventModifier(village: Village): number {
    return 1.0;
  }
  private getVillageStateModifier(village: Village): number {
    return 1.0;
  }
  private getSeasonalModifier(season: SeasonType): number {
    return 1.0;
  }
  private getPopulationModifier(population: number): number {
    return 1.0;
  }
  private getProsperityModifier(prosperity: number): number {
    return 1.0;
  }
  private getStabilityModifier(stability: number): number {
    return 1.0;
  }

  private validateChoiceRequirements(
    choice: PlayerChoice,
    village: Village
  ): boolean {
    // TODO: Implement choice validation
    return true;
  }

  private applyChoiceCosts(choice: PlayerChoice, village: Village): void {
    // TODO: Implement cost application
  }

  private generateUnexpectedConsequences(
    choice: PlayerChoice,
    success: boolean
  ): string[] {
    // TODO: Implement unexpected consequence generation
    return [];
  }

  private async triggerChainEvents(
    chainEventIds: string[],
    parentEvent: GameEvent
  ): Promise<void> {
    // TODO: Implement chain event triggering
  }

  private getSeasonalEventTypes(season: SeasonType): string[] {
    // TODO: Return season-specific event types
    return [];
  }

  private calculateSeasonalEventDate(
    season: SeasonType,
    eventType: string
  ): Date {
    // TODO: Calculate appropriate date for seasonal event
    return new Date();
  }

  private getSeasonalEventName(eventType: string, season: SeasonType): string {
    // TODO: Generate season-specific event names
    return `${season} Event`;
  }

  private getSeasonalEventDescription(
    eventType: string,
    season: SeasonType
  ): string {
    // TODO: Generate season-specific descriptions
    return `A ${season} event occurs in the village.`;
  }

  private async persistScheduledEvents(): Promise<void> {
    const scheduleKey = `village:${this.village.id}:scheduled_events`;
    await kvService.set(scheduleKey, this.scheduledEvents);
  }

  private convertResponseToChoice(response: EventResponse): PlayerChoice {
    return {
      id: response.id,
      name: response.name,
      description: response.description,
      requirements: response.requirements,
      resourceCost: response.cost.map(cost => ({
        resource: cost.resource,
        amount: cost.amount,
      })),
      timeCost: response.implementationTime,
      immediateEffects: response.effects,
      delayedEffects: [],
      chainEvents: [],
      successChance: response.successChance,
      criticalSuccessChance: Math.min(20, response.successChance * 0.2),
      failureConsequences: [],
      outcomeDescriptions: {
        success: `Successfully ${response.name.toLowerCase()}`,
        failure: `Failed to ${response.name.toLowerCase()}`,
      },
    };
  }

  private determineTone(
    severity: EventSeverity
  ): 'serious' | 'lighthearted' | 'mysterious' | 'urgent' | 'celebratory' {
    switch (severity) {
      case 'catastrophic':
        return 'urgent';
      case 'major':
        return 'serious';
      case 'beneficial':
        return 'celebratory';
      case 'minor':
        return 'lighthearted';
      default:
        return 'serious';
    }
  }
}

// ============================================================================
// FACTORY AND UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a new EventManager instance for a village
 */
export function createEventManager(village: Village): VillageEventManager {
  return new VillageEventManager(village);
}

/**
 * Calculate crisis level based on active events
 */
export function calculateCrisisLevel(activeEvents: GameEvent[]): number {
  let crisisLevel = 0;

  for (const event of activeEvents) {
    switch (event.severity) {
      case 'catastrophic':
        crisisLevel += 40;
        break;
      case 'major':
        crisisLevel += 25;
        break;
      case 'moderate':
        crisisLevel += 10;
        break;
      case 'minor':
        crisisLevel += 2;
        break;
      case 'beneficial':
        crisisLevel -= 5;
        break;
    }
  }

  return Math.max(0, Math.min(100, crisisLevel));
}

/**
 * Get emergency response options for crisis events
 */
export function getEmergencyResponseOptions(
  event: GameEvent,
  village: Village
): PlayerChoice[] {
  const emergencyChoices: PlayerChoice[] = [
    {
      id: 'emergency_resources',
      name: 'Emergency Resource Allocation',
      description:
        'Allocate emergency resources to address the crisis immediately.',
      requirements: [],
      resourceCost: [
        {
          resource: 'gold',
          amount: village.economy?.treasury
            ? Math.floor(village.economy.treasury * 0.1)
            : 50,
        },
      ],
      timeCost: 1,
      immediateEffects: [
        {
          type: 'stability',
          modifier: 15,
          duration: 3,
          description: 'Emergency response boost',
        },
      ],
      delayedEffects: [],
      chainEvents: [],
      successChance: 80,
      criticalSuccessChance: 15,
      failureConsequences: [
        {
          type: 'stability',
          modifier: -5,
          duration: 2,
          description: 'Wasted emergency resources',
        },
      ],
      outcomeDescriptions: {
        success:
          'Emergency resources were deployed effectively, stabilizing the situation.',
        failure:
          'The emergency response was poorly coordinated, wasting valuable resources.',
      },
    },
  ];

  return emergencyChoices;
}
