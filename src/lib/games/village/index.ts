/**
 * Village Game Logic Export Index
 *
 * Centralizes exports for Village Simulator game logic and systems
 * Main entry point for village event management functionality
 */

// Core Event System
export {
  VillageEventManager,
  createEventManager,
  calculateCrisisLevel,
  getEmergencyResponseOptions,
  EVENT_CATEGORIES,
} from './events';

// Export core types and interfaces
export type {
  EventManager,
  GameEvent,
  PlayerChoice,
  EventResult,
  VillageStateChanges,
  ScheduledEvent,
  RecurrencePattern,
  EventTrigger,
  ChainReaction,
  DelayedEffect,
  NarrativeContext,
  CrisisEvent,
  ResourceAllocation,
  EmergencyAction,
} from './events';

/**
 * Village Event System Factory
 *
 * Creates a complete village event system instance with all components
 *
 * @example
 * ```typescript
 * import { createVillageEventSystem } from '@/lib/games/village';
 *
 * const eventSystem = createVillageEventSystem(village);
 *
 * // Generate and process events
 * const newEvents = await eventSystem.generateRandomEvents(village);
 * const result = await eventSystem.processEvent(newEvents[0], village);
 * ```
 */
export function createVillageEventSystem(village: Village) {
  const eventManager = createEventManager(village);

  return {
    manager: eventManager,

    // Convenience methods
    generateEvents: () => eventManager.generateRandomEvents(village),
    processEvent: (event: GameEvent) =>
      eventManager.processEvent(event, village),
    handleChoice: (event: GameEvent, choice: PlayerChoice) =>
      eventManager.handlePlayerChoices(event, choice),
    scheduleSeasonalEvents: (season: SeasonType) =>
      eventManager.scheduleSeasonalEvents(village, season),

    // Crisis management
    getCrisisLevel: (events: GameEvent[]) => calculateCrisisLevel(events),
    getEmergencyOptions: (event: GameEvent) =>
      getEmergencyResponseOptions(event, village),
  };
}

/**
 * Event system configuration and constants
 */
export const VILLAGE_EVENT_CONFIG = {
  // Event generation settings
  BASE_EVENT_CHANCE: 0.15,
  MAX_ACTIVE_EVENTS: 5,
  CRISIS_THRESHOLD: 50,

  // Timing settings
  DEFAULT_EVENT_DURATION: 1, // days
  CRISIS_AUTO_RESOLVE_TIME: 300, // seconds

  // AI generation settings
  MAX_AI_RETRIES: 3,
  FALLBACK_EVENT_ENABLED: true,

  // Resource impact settings
  MAX_RESOURCE_IMPACT: 50,
  MAX_POPULATION_IMPACT: 10,
} as const;

/**
 * Village event system validation and health check
 */
export function validateVillageEventSystem(village: Village): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate village data
  if (!village.id) errors.push('Village must have valid ID');
  if (!village.name) errors.push('Village must have name');
  if (village.population.total < 0)
    errors.push('Village population cannot be negative');

  // Validate village state
  if (village.happiness < 0 || village.happiness > 100) {
    warnings.push('Village happiness outside normal range (0-100)');
  }
  if (village.stability < 0 || village.stability > 100) {
    warnings.push('Village stability outside normal range (0-100)');
  }

  // Check required systems
  if (!village.resources) errors.push('Village must have resource system');
  if (!village.buildings) warnings.push('Village has no buildings defined');
  if (!village.residents) warnings.push('Village has no residents defined');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// Re-export village types for convenience
export type {
  Village,
  VillageEvent,
  EventType,
  EventSeverity,
  SeasonType,
  HistoricalEvent,
  VillageGameState,
} from '@/types/village';

/**
 * Development and debugging utilities
 */
export const VillageEventDebug = {
  /**
   * Generate test events for development
   */
  generateTestEvents: (
    village: Village,
    count: number = 3
  ): Promise<GameEvent[]> => {
    const eventManager = createEventManager(village);
    return Promise.all(
      Array(count)
        .fill(null)
        .map(() => eventManager.generateRandomEvents(village))
    ).then(results => results.flat());
  },

  /**
   * Simulate event processing for testing
   */
  simulateEventChain: async (
    village: Village,
    initialEvent: GameEvent,
    maxDepth: number = 3
  ): Promise<GameEvent[]> => {
    const eventManager = createEventManager(village);
    const processedEvents: GameEvent[] = [initialEvent];

    let currentEvents = [initialEvent];
    let depth = 0;

    while (currentEvents.length > 0 && depth < maxDepth) {
      const chainEvents: GameEvent[] = [];

      for (const event of currentEvents) {
        const result = await eventManager.processEvent(event, village);
        chainEvents.push(...result.chainEvents);
      }

      processedEvents.push(...chainEvents);
      currentEvents = chainEvents;
      depth++;
    }

    return processedEvents;
  },

  /**
   * Analyze village event susceptibility
   */
  analyzeEventSusceptibility: (village: Village) => {
    const eventManager = createEventManager(village);
    const analysis = {
      natural: eventManager.calculateEventProbability('natural', village),
      social: eventManager.calculateEventProbability('social', village),
      economic: eventManager.calculateEventProbability('economic', village),
      military: eventManager.calculateEventProbability('military', village),
      cultural: eventManager.calculateEventProbability('cultural', village),
    };

    return {
      ...analysis,
      mostLikely: Object.entries(analysis).reduce((a, b) =>
        a[1] > b[1] ? a : b
      )[0],
      totalRisk:
        Object.values(analysis).reduce((sum, prob) => sum + prob, 0) / 5,
    };
  },
};

//TODO: Implement event mod system for community content
//TODO: Add event analytics and performance tracking
//TODO: Create event localization system for multiple languages
//TODO: Implement event networking for multiplayer village interactions
//TODO: Add event scripting system for custom scenarios
