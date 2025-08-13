/**
 * Village Creation API Endpoint
 * POST /api/game/village/create
 *
 * Creates a new village instance with initial settings and default state
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { kvService } from '@/lib/database';
import {
  Village,
  VillageConfig,
  VillageSize,
  ClimateType,
  SeasonType,
  VillageGameState,
  ResourceType,
} from '@/types/village';

// Validation schema for village creation request
const CreateVillageSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  name: z
    .string()
    .min(1, 'Village name is required')
    .max(50, 'Village name too long'),
  size: z.enum(['hamlet', 'village', 'town', 'city']).default('hamlet'),
  climate: z
    .enum([
      'tropical',
      'temperate',
      'arid',
      'continental',
      'polar',
      'mediterranean',
    ])
    .default('temperate'),
  location: z
    .object({
      region: z.string().default('Fertile Valley'),
      terrain: z.array(z.string()).default(['plain', 'forest']),
      waterAccess: z
        .enum([
          'riverside',
          'lakeside',
          'coastal',
          'inland_spring',
          'dry',
          'oasis',
        ])
        .default('riverside'),
    })
    .default({}),
  config: z
    .object({
      realTimeProgression: z.boolean().default(false),
      dayLength: z.number().min(1).max(1440).default(60), // minutes per game day
      seasonLength: z.number().min(10).max(365).default(90), // game days per season
      resourceScarcity: z.number().min(0).max(100).default(30),
      eventFrequency: z.number().min(0).max(100).default(40),
      crisisIntensity: z.number().min(0).max(100).default(25),
    })
    .default({}),
  startingPopulation: z.number().min(10).max(1000).default(50),
});

type CreateVillageRequest = z.infer<typeof CreateVillageSchema>;

/**
 * Generate starting resources based on village size and settings
 */
function generateStartingResources(
  size: VillageSize,
  population: number,
  climate: ClimateType
): Record<ResourceType, number> {
  const baseMultiplier = {
    hamlet: 1.0,
    village: 1.5,
    town: 2.5,
    city: 4.0,
  }[size];

  const climateModifier = {
    tropical: { food: 1.2, wood: 1.3, water: 0.9 },
    temperate: { food: 1.0, wood: 1.0, water: 1.0 },
    arid: { food: 0.7, wood: 0.6, water: 1.5 },
    continental: { food: 0.9, wood: 1.1, water: 1.0 },
    polar: { food: 0.6, wood: 0.8, water: 1.2 },
    mediterranean: { food: 1.1, wood: 0.9, water: 0.8 },
  }[climate];

  return {
    // Basic survival resources (scaled by population)
    food: Math.floor(
      population * 3 * baseMultiplier * (climateModifier.food || 1)
    ),
    water: Math.floor(
      population * 2 * baseMultiplier * (climateModifier.water || 1)
    ),

    // Building materials
    wood: Math.floor(100 * baseMultiplier * (climateModifier.wood || 1)),
    stone: Math.floor(50 * baseMultiplier),
    iron: Math.floor(20 * baseMultiplier),

    // Tools and processed goods
    lumber: Math.floor(30 * baseMultiplier),
    tools: Math.floor(15 * baseMultiplier),
    weapons: Math.floor(5 * baseMultiplier),
    cloth: Math.floor(25 * baseMultiplier),
    pottery: Math.floor(10 * baseMultiplier),
    books: Math.floor(2 * baseMultiplier),

    // Luxury items (minimal at start)
    spices: 0,
    jewelry: 0,
    art: 0,
    wine: Math.floor(5 * baseMultiplier),
    silk: 0,

    // Currency
    gold: Math.floor(500 * baseMultiplier),

    // Abstract resources
    knowledge: Math.floor(10 * baseMultiplier),
    culture: Math.floor(20 * baseMultiplier),
    faith: Math.floor(15 * baseMultiplier),
    influence: Math.floor(5 * baseMultiplier),
  };
}

/**
 * Create initial village state
 */
function createInitialVillage(data: CreateVillageRequest): Village {
  const villageId = nanoid();
  const now = new Date();

  const startingResources = generateStartingResources(
    data.size,
    data.startingPopulation,
    (data.location?.region as ClimateType) || 'temperate'
  );

  const village: Village = {
    id: villageId,
    sessionId: data.sessionId,
    name: data.name,
    size: data.size,
    founded: now,
    age: 0,

    // Initialize basic layout
    layout: {
      size: { width: 100, height: 100 },
      centerX: 50,
      centerY: 50,
      residential: [],
      commercial: [],
      agricultural: [],
      industrial: [],
      recreational: [],
      terrain: [],
      waterSources: [
        {
          id: nanoid(),
          type: 'river',
          position: { x: 45, y: 50 },
          quality: 85,
          capacity: 1000,
          isRenewable: true,
        },
      ],
      resources: [],
    },

    // Empty buildings array (will be populated as village grows)
    buildings: [],
    infrastructure: [],

    // Initialize population
    population: {
      total: data.startingPopulation,
      children: Math.floor(data.startingPopulation * 0.25),
      adults: Math.floor(data.startingPopulation * 0.65),
      elderly: Math.floor(data.startingPopulation * 0.1),
      employed: Math.floor(data.startingPopulation * 0.6),
      unemployed: Math.floor(data.startingPopulation * 0.15),
      skilled: Math.floor(data.startingPopulation * 0.3),
      unskilled: Math.floor(data.startingPopulation * 0.55),
      averageHappiness: 65,
      averageHealth: 70,
      averageEducation: 40,
      birthRate: 25,
      deathRate: 8,
      migrationRate: 2,
      housedPopulation: Math.floor(data.startingPopulation * 0.85),
      homelessPopulation: Math.floor(data.startingPopulation * 0.15),
      updatedAt: now,
    },

    residents: [],

    // Initialize resources
    resources: {
      resources: Object.fromEntries(
        Object.entries(startingResources).map(([resourceType, amount]) => [
          resourceType,
          {
            current: amount,
            maximum: Math.floor(amount * 2),
            reserved: 0,
            quality: 75,
            storageBuildings: [],
            spoilageRate: resourceType === 'food' ? 0.02 : 0,
            lastUpdated: now,
          },
        ])
      ) as Record<ResourceType, any>,
      totalCapacity: Object.values(startingResources).reduce(
        (sum, amount) => sum + Math.floor(amount * 2),
        0
      ),
      usedCapacity: Object.values(startingResources).reduce(
        (sum, amount) => sum + amount,
        0
      ),
      dailyProduction: {} as Record<ResourceType, number>,
      dailyConsumption: {} as Record<ResourceType, number>,
      netFlow: {} as Record<ResourceType, number>,
      tradeRoutes: [],
      marketPrices: {} as Record<ResourceType, number>,
      updatedAt: now,
    },

    // Initialize economy
    economy: {
      treasury: startingResources.gold,
      monthlyIncome: 0,
      monthlyExpenses: 0,
      netProfit: 0,
      economicHealth: 60,
      inflation: 2,
      unemployment: 15,
      taxRate: 10,
      tradeFees: 5,
      policies: [],
      supplyDemand: {} as any,
      priceHistory: [],
    },

    // Initial village stats
    happiness: 65,
    stability: 70,
    prosperity: 40,
    defense: 30,

    // Environment and location
    location: {
      region: data.location?.region || 'Fertile Valley',
      climate: data.climate || 'temperate',
      terrain: (data.location?.terrain || ['plain', 'forest']) as any[],
      elevation: 100,
      waterAccess: data.location?.waterAccess || 'riverside',
      naturalResources: ['food', 'wood', 'stone'],
      tradeRouteAccess: 50,
      defensibility: 40,
      expansionPotential: 80,
      naturalHazards: [],
      wildlife: [],
    },

    // Initialize season and weather
    season: {
      current: 'spring' as SeasonType,
      day: 1,
      totalDays: data.config?.seasonLength || 90,
      temperature: { min: 15, max: 25, average: 20, comfort: 75 },
      rainfall: 60,
      growingConditions: 80,
      productionModifiers: {} as Record<ResourceType, number>,
      happinessModifier: 0,
      healthModifier: 0,
      seasonalEvents: [],
    },

    weather: {
      current: 'sunny',
      forecast: [],
      temperature: 20,
      humidity: 65,
      windSpeed: 10,
      visibility: 90,
      effects: [],
      duration: 8,
    },

    // Empty events (will be populated by event system)
    currentEvents: [],
    eventHistory: [],

    // Basic AI personality
    aiPersonality: {
      conservatism: 50,
      cooperation: 70,
      ambition: 60,
      caution: 55,
      creativity: 45,
      values: [],
      traditions: [],
      socialNorms: [],
      decisionStyle: 'democratic',
      priorityTypes: ['survival', 'happiness', 'growth'],
      adaptability: 60,
      memoryStrength: 70,
      learningRate: 50,
    },

    createdAt: now,
    updatedAt: now,
  };

  return village;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request data
    const validationResult = CreateVillageSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid village creation data',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Check if session already has a village
    const existingVillageKey = `village_session:${data.sessionId}`;
    const existingVillage = await kvService.get(existingVillageKey);

    if (existingVillage) {
      return NextResponse.json(
        {
          success: false,
          error: 'Session already has an active village',
          villageId: (existingVillage as any).id,
        },
        { status: 409 }
      );
    }

    // Create new village
    const village = createInitialVillage(data);

    // Store village in database
    const villageKey = `village:${village.id}`;
    const sessionVillageKey = `village_session:${data.sessionId}`;

    await Promise.all([
      kvService.set(villageKey, village),
      kvService.set(sessionVillageKey, {
        id: village.id,
        sessionId: data.sessionId,
      }),
    ]);

    // Create initial village game state
    const gameState: VillageGameState = {
      sessionId: data.sessionId,
      playerId: '', // Will be set when player joins
      gameType: 'village',
      phase: 'active',
      turn: 0,
      score: 0,

      // Village-specific state
      villageId: village.id,
      gameDay: 0,
      season: village.season,
      weather: village.weather,
      dailyProduction: {} as Record<ResourceType, number>,
      dailyConsumption: {} as Record<ResourceType, number>,
      resourceAlerts: [],
      populationGrowth: 0,
      happinessChange: 0,
      activeProjects: [],
      queuedActions: [],
      activeCrises: [],
      crisisResponse: [],
      developmentGoals: [],
      aiDecisions: [],
      lastAIEvent: new Date(),

      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store game state
    const gameStateKey = `gamestate:${village.id}`;
    await kvService.set(gameStateKey, gameState);

    //TODO: Initialize NPC system with starting population
    //TODO: Generate initial buildings based on village size
    //TODO: Set up initial trade routes based on location
    //TODO: Schedule first random events based on config

    return NextResponse.json(
      {
        success: true,
        village: {
          id: village.id,
          name: village.name,
          size: village.size,
          population: village.population.total,
          happiness: village.happiness,
          stability: village.stability,
          prosperity: village.prosperity,
          defense: village.defense,
          season: village.season.current,
          gameDay: gameState.gameDay,
        },
        gameState: {
          villageId: gameState.villageId,
          gameDay: gameState.gameDay,
          phase: gameState.phase,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Village creation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error during village creation',
      },
      { status: 500 }
    );
  }
}
