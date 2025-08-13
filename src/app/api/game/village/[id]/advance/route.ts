/**
 * Village Time Advancement API Endpoint
 * POST /api/game/village/[id]/advance
 *
 * Advances village time by specified amount, processing all time-based mechanics
 * including resource production/consumption, population changes, building progress,
 * event progression, and seasonal effects
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { kvService } from '@/lib/database';
import { createEventManager } from '@/lib/games/village';
import {
  Village,
  VillageGameState,
  ResourceType,
  SeasonType,
  VillageEvent,
} from '@/types/village';

// Validation schema for time advancement request
const AdvanceTimeSchema = z.object({
  days: z.number().min(0.1).max(365).default(1), // Game days to advance
  autoResolveEvents: z.boolean().default(false), // Auto-resolve minor events
  simulationSpeed: z
    .enum(['slow', 'normal', 'fast', 'turbo'])
    .default('normal'),
});

type AdvanceTimeRequest = z.infer<typeof AdvanceTimeSchema>;

/**
 * Calculate daily resource production for a village
 */
function calculateDailyProduction(
  village: Village
): Record<ResourceType, number> {
  const production: Partial<Record<ResourceType, number>> = {};

  // Calculate production from buildings
  for (const building of village.buildings) {
    for (const prod of building.produces) {
      const resourceType = prod.resource;
      const dailyAmount =
        prod.amountPerDay *
        prod.efficiency *
        (building.condition === 'perfect'
          ? 1.0
          : building.condition === 'good'
            ? 0.9
            : building.condition === 'fair'
              ? 0.8
              : building.condition === 'poor'
                ? 0.6
                : 0.3);

      production[resourceType] = (production[resourceType] || 0) + dailyAmount;
    }
  }

  // Base population production (gathering, basic crafting)
  const workingPopulation = village.population.employed;
  production.food = (production.food || 0) + workingPopulation * 0.5;
  production.wood = (production.wood || 0) + workingPopulation * 0.2;
  production.stone = (production.stone || 0) + workingPopulation * 0.1;

  // Apply seasonal modifiers
  const seasonMultiplier =
    {
      spring: { food: 1.2, wood: 1.1 },
      summer: { food: 1.3, wood: 1.0 },
      autumn: { food: 1.1, wood: 0.9 },
      winter: { food: 0.6, wood: 0.8 },
    }[village.season.current] || {};

  Object.keys(production).forEach(resource => {
    const multiplier =
      seasonMultiplier[resource as keyof typeof seasonMultiplier] || 1.0;
    production[resource as ResourceType] =
      (production[resource as ResourceType] || 0) * multiplier;
  });

  return production as Record<ResourceType, number>;
}

/**
 * Calculate daily resource consumption for a village
 */
function calculateDailyConsumption(
  village: Village
): Record<ResourceType, number> {
  const consumption: Partial<Record<ResourceType, number>> = {};

  // Basic population needs
  const totalPop = village.population.total;
  consumption.food = totalPop * 1.5; // 1.5 food per person per day
  consumption.water = totalPop * 2.0; // 2 water per person per day

  // Building maintenance and operation
  for (const building of village.buildings) {
    for (const cons of building.consumes) {
      const resourceType = cons.resource;
      consumption[resourceType] =
        (consumption[resourceType] || 0) + cons.amountPerDay;
    }

    // Maintenance costs
    for (const maintCost of building.maintenanceCost) {
      consumption[maintCost.resource] =
        (consumption[maintCost.resource] || 0) + maintCost.amount / 30; // Daily portion
    }
  }

  // Luxury consumption based on prosperity
  if (village.prosperity > 50) {
    consumption.wine = (consumption.wine || 0) + totalPop * 0.1;
    consumption.spices = (consumption.spices || 0) + totalPop * 0.05;
  }

  return consumption as Record<ResourceType, number>;
}

/**
 * Process population changes over time
 */
function processPopulationChanges(
  village: Village,
  days: number
): {
  births: number;
  deaths: number;
  migrants: number;
  newTotal: number;
} {
  const currentPop = village.population.total;

  // Calculate changes based on rates (annual rates converted to daily)
  const dailyBirthRate = village.population.birthRate / 1000 / 365;
  const dailyDeathRate = village.population.deathRate / 1000 / 365;
  const dailyMigrationRate = village.population.migrationRate / 1000 / 365;

  const births = Math.floor(currentPop * dailyBirthRate * days);
  const deaths = Math.floor(currentPop * dailyDeathRate * days);
  const migrants = Math.floor(currentPop * dailyMigrationRate * days);

  const newTotal = Math.max(0, currentPop + births - deaths + migrants);

  return { births, deaths, migrants, newTotal };
}

/**
 * Update seasonal progression
 */
function updateSeasonalProgression(
  village: Village,
  days: number
): {
  newSeason: SeasonType;
  seasonChanged: boolean;
  weatherEvents: string[];
} {
  const currentSeasonDay = village.season.day + days;
  const totalDaysInSeason = village.season.totalDays;

  let newSeason = village.season.current;
  let seasonChanged = false;
  const weatherEvents: string[] = [];

  if (currentSeasonDay >= totalDaysInSeason) {
    seasonChanged = true;
    const seasonOrder: SeasonType[] = ['spring', 'summer', 'autumn', 'winter'];
    const currentIndex = seasonOrder.indexOf(village.season.current);
    newSeason = seasonOrder[(currentIndex + 1) % 4];

    weatherEvents.push(
      `Season changed from ${village.season.current} to ${newSeason}`
    );
  }

  return { newSeason, seasonChanged, weatherEvents };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const villageId = params.id;
    const body = await request.json();

    if (!villageId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Village ID is required',
        },
        { status: 400 }
      );
    }

    // Validate request data
    const validationResult = AdvanceTimeSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid time advancement data',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { days, autoResolveEvents, simulationSpeed } = validationResult.data;

    // Fetch village and game state
    const villageKey = `village:${villageId}`;
    const gameStateKey = `gamestate:${villageId}`;

    const [village, gameState] = await Promise.all([
      kvService.get(villageKey) as Promise<Village | null>,
      kvService.get(gameStateKey) as Promise<VillageGameState | null>,
    ]);

    if (!village || !gameState) {
      return NextResponse.json(
        {
          success: false,
          error: 'Village or game state not found',
        },
        { status: 404 }
      );
    }

    // Calculate time progression effects
    const dailyProduction = calculateDailyProduction(village);
    const dailyConsumption = calculateDailyConsumption(village);
    const populationChanges = processPopulationChanges(village, days);
    const seasonalChanges = updateSeasonalProgression(village, days);

    // Update resources
    const updatedResources = { ...village.resources };
    for (const [resourceType, stock] of Object.entries(
      updatedResources.resources
    )) {
      const production = dailyProduction[resourceType as ResourceType] || 0;
      const consumption = dailyConsumption[resourceType as ResourceType] || 0;
      const netChange = (production - consumption) * days;

      // Apply spoilage for perishable goods
      const spoilage = stock.current * stock.spoilageRate * days;

      const newAmount = Math.max(
        0,
        Math.min(stock.maximum, stock.current + netChange - spoilage)
      );

      updatedResources.resources[resourceType as ResourceType] = {
        ...stock,
        current: newAmount,
        lastUpdated: new Date(),
      };
    }

    // Update daily flows
    updatedResources.dailyProduction = dailyProduction;
    updatedResources.dailyConsumption = dailyConsumption;
    updatedResources.netFlow = Object.fromEntries(
      Object.keys(dailyProduction).map(resource => [
        resource,
        (dailyProduction[resource as ResourceType] || 0) -
          (dailyConsumption[resource as ResourceType] || 0),
      ])
    ) as Record<ResourceType, number>;

    // Update population
    const updatedPopulation = {
      ...village.population,
      total: populationChanges.newTotal,
      // Redistribute age groups proportionally
      children: Math.floor(populationChanges.newTotal * 0.25),
      adults: Math.floor(populationChanges.newTotal * 0.65),
      elderly: Math.floor(populationChanges.newTotal * 0.1),
      // Update employment based on new population
      employed: Math.min(
        Math.floor(populationChanges.newTotal * 0.7),
        village.population.employed
      ),
      unemployed: Math.max(
        0,
        populationChanges.newTotal -
          Math.floor(populationChanges.newTotal * 0.7)
      ),
      updatedAt: new Date(),
    };

    // Update season if changed
    const updatedSeason = seasonalChanges.seasonChanged
      ? {
          ...village.season,
          current: seasonalChanges.newSeason,
          day: 1,
        }
      : {
          ...village.season,
          day: village.season.day + days,
        };

    // Process building construction and maintenance
    const updatedBuildings = village.buildings.map(building => {
      if (building.isUnderConstruction) {
        const progressPerDay = 100 / building.constructionTime;
        const newProgress = Math.min(
          100,
          building.constructionProgress + progressPerDay * days
        );

        return {
          ...building,
          constructionProgress: newProgress,
          isUnderConstruction: newProgress < 100,
          completionDate: newProgress >= 100 ? new Date() : undefined,
        };
      }

      // Gradual building deterioration
      const deteriorationRate = 0.1; // 0.1% per day
      const newDurability = Math.max(
        0,
        building.durability - deteriorationRate * days
      );

      return {
        ...building,
        durability: newDurability,
        condition:
          newDurability > 80
            ? 'perfect'
            : newDurability > 60
              ? 'good'
              : newDurability > 40
                ? 'fair'
                : newDurability > 20
                  ? 'poor'
                  : 'dilapidated',
      };
    });

    // Generate random events if enabled
    const eventManager = createEventManager(village);
    let newEvents: VillageEvent[] = [];

    if (Math.random() < 0.3 * days) {
      // 30% chance per day
      try {
        const generatedEvents =
          await eventManager.generateRandomEvents(village);
        newEvents = generatedEvents.slice(0, Math.min(2, Math.ceil(days))); // Max 2 events, scaled by time
      } catch (error) {
        console.warn('Event generation failed during time advancement:', error);
      }
    }

    // Update village stats based on changes
    let happinessChange = 0;
    let stabilityChange = 0;

    // Population changes affect happiness
    if (populationChanges.births > populationChanges.deaths) {
      happinessChange += 2;
    } else if (populationChanges.deaths > populationChanges.births) {
      happinessChange -= 1;
    }

    // Resource scarcity affects happiness and stability
    const criticalShortages = Object.entries(updatedResources.netFlow).filter(
      ([_, flow]) => flow < -10
    ).length;

    happinessChange -= criticalShortages * 3;
    stabilityChange -= criticalShortages * 2;

    // Seasonal effects on happiness
    if (seasonalChanges.seasonChanged) {
      const seasonalMood =
        {
          spring: 5,
          summer: 3,
          autumn: 0,
          winter: -3,
        }[seasonalChanges.newSeason] || 0;

      happinessChange += seasonalMood;
    }

    // Create updated village
    const updatedVillage: Village = {
      ...village,
      age: village.age + days,
      buildings: updatedBuildings,
      population: updatedPopulation,
      resources: updatedResources,
      season: updatedSeason,
      currentEvents: [...village.currentEvents, ...newEvents],
      happiness: Math.max(
        0,
        Math.min(100, village.happiness + happinessChange)
      ),
      stability: Math.max(
        0,
        Math.min(100, village.stability + stabilityChange)
      ),
      updatedAt: new Date(),
    };

    // Update game state
    const updatedGameState: VillageGameState = {
      ...gameState,
      gameDay: gameState.gameDay + days,
      season: updatedSeason,
      dailyProduction: dailyProduction,
      dailyConsumption: dailyConsumption,
      populationGrowth: populationChanges.newTotal - village.population.total,
      happinessChange,
      updatedAt: new Date(),
    };

    // Store updated data
    await Promise.all([
      kvService.set(villageKey, updatedVillage),
      kvService.set(gameStateKey, updatedGameState),
    ]);

    //TODO: Process active projects and update progress
    //TODO: Trigger AI NPC behavior updates based on time passage
    //TODO: Update trade route activities and deliveries
    //TODO: Process infrastructure maintenance and repairs

    const advancementResult = {
      success: true,
      village: {
        id: updatedVillage.id,
        name: updatedVillage.name,
        age: updatedVillage.age,
        population: updatedVillage.population.total,
        happiness: updatedVillage.happiness,
        stability: updatedVillage.stability,
        prosperity: updatedVillage.prosperity,
        season: updatedVillage.season.current,
      },
      changes: {
        daysAdvanced: days,
        populationChanges,
        seasonalChanges,
        resourceChanges: Object.fromEntries(
          Object.entries(updatedResources.netFlow).map(([resource, flow]) => [
            resource,
            flow * days,
          ])
        ),
        happinessChange,
        stabilityChange,
        newEvents: newEvents.length,
        completedBuildings: updatedBuildings.filter(
          b =>
            b.completionDate &&
            new Date(b.completionDate).getTime() >
              Date.now() - days * 24 * 60 * 60 * 1000
        ).length,
      },
      newEvents: newEvents.map(event => ({
        id: event.id,
        name: event.name,
        type: event.type,
        severity: event.severity,
        description: event.description,
      })),
      warnings: seasonalChanges.weatherEvents,
    };

    return NextResponse.json(advancementResult);
  } catch (error) {
    console.error('Time advancement error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error during time advancement',
      },
      { status: 500 }
    );
  }
}
