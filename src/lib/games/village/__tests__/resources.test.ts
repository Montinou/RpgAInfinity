/**
 * Resource Management System Tests
 *
 * Comprehensive tests for the ResourceManager class covering all major functionality
 */

import { ResourceManager } from '../resources';
import {
  VillageConfig,
  Village,
  ResourceType,
  VillagePopulation,
  Building,
  SeasonType,
  WeatherState,
} from '../../../../types/village';

describe('ResourceManager', () => {
  let resourceManager: ResourceManager;
  let mockVillageConfig: VillageConfig;
  let mockVillage: Village;

  beforeEach(() => {
    resourceManager = new ResourceManager();

    mockVillageConfig = {
      id: 'test-config',
      name: 'Test Village Config',
      description: 'Test configuration',
      difficulty: 'medium',
      enableRealTime: false,
      startingSize: 'village',
      startingPopulation: 100,
      startingResources: {
        food: 200,
        wood: 150,
        stone: 100,
        iron: 50,
        gold: 25,
        water: 300,
        lumber: 0,
        tools: 10,
        weapons: 5,
        cloth: 20,
        pottery: 0,
        books: 0,
        spices: 0,
        jewelry: 0,
        art: 0,
        wine: 0,
        silk: 0,
        knowledge: 10,
        culture: 5,
        faith: 0,
        influence: 0,
      },
      location: {
        region: 'test-region',
        climate: 'temperate',
        terrain: ['plain', 'forest'],
        elevation: 100,
        waterAccess: 'riverside',
        naturalResources: ['food', 'wood', 'stone'],
        tradeRouteAccess: 75,
        defensibility: 60,
        expansionPotential: 80,
        naturalHazards: [],
        wildlife: [],
      },
      realTimeProgression: false,
      dayLength: 60,
      seasonLength: 30,
      resourceScarcity: 50,
      eventFrequency: 50,
      crisisIntensity: 50,
      aiPersonality: {
        conservatism: 50,
        cooperation: 70,
        ambition: 60,
        caution: 55,
        creativity: 65,
        values: [],
        traditions: [],
        socialNorms: [],
        decisionStyle: 'democratic',
        priorityTypes: ['survival', 'growth'],
        adaptability: 70,
        memoryStrength: 80,
        learningRate: 75,
      },
      aiFrequency: 3,
      aiCreativity: 70,
      enableWeather: true,
      enableSeasons: true,
      enableEvents: true,
      enableTrading: true,
      enablePopulationGrowth: true,
      victoryConditions: [],
    };

    // Create mock village with minimal required properties
    mockVillage = {
      id: 'test-village',
      sessionId: 'test-session',
      name: 'Test Village',
      size: 'village',
      founded: new Date(),
      age: 30,
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
            id: 'river-1',
            type: 'river',
            position: { x: 30, y: 40 },
            quality: 85,
            capacity: 500,
            isRenewable: true,
          },
        ],
        resources: [],
      },
      buildings: [],
      infrastructure: [],
      population: {
        total: 100,
        children: 20,
        adults: 65,
        elderly: 15,
        employed: 45,
        unemployed: 20,
        skilled: 25,
        unskilled: 40,
        averageHappiness: 75,
        averageHealth: 80,
        averageEducation: 60,
        birthRate: 15,
        deathRate: 8,
        migrationRate: 2,
        housedPopulation: 95,
        homelessPopulation: 5,
        updatedAt: new Date(),
      },
      residents: [],
      resources: {
        resources: {},
        totalCapacity: 0,
        usedCapacity: 0,
        dailyProduction: {} as Record<ResourceType, number>,
        dailyConsumption: {} as Record<ResourceType, number>,
        netFlow: {} as Record<ResourceType, number>,
        tradeRoutes: [],
        marketPrices: {} as Record<ResourceType, number>,
        updatedAt: new Date(),
      },
      economy: {
        treasury: 500,
        monthlyIncome: 100,
        monthlyExpenses: 80,
        netProfit: 20,
        economicHealth: 75,
        inflation: 2,
        unemployment: 20,
        taxRate: 10,
        tradeFees: 5,
        policies: [],
        supplyDemand: {} as any,
        priceHistory: [],
      },
      happiness: 75,
      stability: 80,
      prosperity: 70,
      defense: 60,
      location: mockVillageConfig.location,
      season: {
        current: 'summer',
        day: 15,
        totalDays: 30,
        temperature: { min: 18, max: 28, average: 23, comfort: 85 },
        rainfall: 40,
        growingConditions: 90,
        productionModifiers: {} as Record<ResourceType, number>,
        happinessModifier: 10,
        healthModifier: 5,
        seasonalEvents: [],
      },
      weather: {
        current: 'sunny',
        forecast: [],
        temperature: 25,
        humidity: 60,
        windSpeed: 10,
        visibility: 95,
        effects: [],
        duration: 8,
      },
      currentEvents: [],
      eventHistory: [],
      aiPersonality: mockVillageConfig.aiPersonality,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Village;
  });

  describe('Resource Initialization', () => {
    test('should initialize resources with correct starting amounts', () => {
      const resourceState =
        resourceManager.initializeResources(mockVillageConfig);

      expect(resourceState.resources.food.current).toBe(200);
      expect(resourceState.resources.wood.current).toBe(150);
      expect(resourceState.resources.stone.current).toBe(100);
      expect(resourceState.resources.gold.current).toBe(25);

      // Check that all resource types are initialized
      expect(Object.keys(resourceState.resources)).toHaveLength(20); // All resource types
    });

    test('should set appropriate storage capacities based on population', () => {
      const resourceState =
        resourceManager.initializeResources(mockVillageConfig);

      // Storage should scale with population (100 people)
      expect(resourceState.resources.food.maximum).toBeGreaterThan(400); // Should be >= base capacity * population factor
      expect(resourceState.resources.water.maximum).toBeGreaterThan(800);
    });

    test('should initialize production and consumption rates', () => {
      const resourceState =
        resourceManager.initializeResources(mockVillageConfig);

      expect(resourceState.dailyProduction.food).toBeGreaterThan(0);
      expect(resourceState.dailyProduction.water).toBeGreaterThan(0);
      expect(resourceState.dailyConsumption.food).toBe(200); // 100 people * 2 food per day
      expect(resourceState.dailyConsumption.water).toBe(300); // 100 people * 3 water per day
    });

    test('should set spoilage rates correctly', () => {
      const resourceState =
        resourceManager.initializeResources(mockVillageConfig);

      expect(resourceState.resources.food.spoilageRate).toBe(0.02); // 2% daily spoilage
      expect(resourceState.resources.stone.spoilageRate).toBe(0); // No spoilage for stone
      expect(resourceState.resources.wine.spoilageRate).toBe(-0.001); // Wine improves with age
    });
  });

  describe('Resource Updates Over Time', () => {
    test('should update resources correctly over time', () => {
      const initialState =
        resourceManager.initializeResources(mockVillageConfig);

      // Set some test values
      initialState.resources.food.current = 100;
      initialState.dailyProduction.food = 10;
      initialState.dailyConsumption.food = 8;
      initialState.efficiency.food = 1.0;

      const updatedState = resourceManager.updateResources(initialState, 24); // 24 hours = 1 day

      // Expected: 100 + (10 * 1.0) - 8 - (100 * 0.02) = 100 + 10 - 8 - 2 = 100
      expect(updatedState.resources.food.current).toBeCloseTo(100, 1);
    });

    test('should apply spoilage correctly', () => {
      const initialState =
        resourceManager.initializeResources(mockVillageConfig);

      initialState.resources.food.current = 100;
      initialState.dailyProduction.food = 0;
      initialState.dailyConsumption.food = 0;
      initialState.efficiency.food = 1.0;

      const updatedState = resourceManager.updateResources(initialState, 24); // 1 day

      // Only spoilage should apply: 100 - (100 * 0.02) = 98
      expect(updatedState.resources.food.current).toBeCloseTo(98, 1);
    });

    test('should not allow negative resources', () => {
      const initialState =
        resourceManager.initializeResources(mockVillageConfig);

      initialState.resources.food.current = 10;
      initialState.dailyProduction.food = 0;
      initialState.dailyConsumption.food = 20; // More than available
      initialState.efficiency.food = 1.0;

      const updatedState = resourceManager.updateResources(initialState, 24);

      expect(updatedState.resources.food.current).toBe(0);
    });

    test('should respect storage capacity limits', () => {
      const initialState =
        resourceManager.initializeResources(mockVillageConfig);

      initialState.resources.food.current = 450;
      initialState.resources.food.maximum = 500;
      initialState.dailyProduction.food = 100; // Would exceed capacity
      initialState.dailyConsumption.food = 0;
      initialState.efficiency.food = 1.0;

      const updatedState = resourceManager.updateResources(initialState, 24);

      expect(updatedState.resources.food.current).toBeLessThanOrEqual(500);
    });
  });

  describe('Transaction Validation', () => {
    test('should validate successful consumption transaction', () => {
      const resourceState =
        resourceManager.initializeResources(mockVillageConfig);
      resourceState.resources.wood.current = 100;
      resourceState.resources.wood.reserved = 10;

      const transaction = {
        id: 'test-transaction',
        type: 'consumption' as const,
        resources: [{ resource: 'wood' as ResourceType, amount: 50 }],
        timestamp: new Date(),
        description: 'Build house',
      };

      const validation = resourceManager.validateTransaction(
        transaction,
        resourceState
      );

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should reject transaction with insufficient resources', () => {
      const resourceState =
        resourceManager.initializeResources(mockVillageConfig);
      resourceState.resources.iron.current = 10;
      resourceState.resources.iron.reserved = 0;

      const transaction = {
        id: 'test-transaction',
        type: 'consumption' as const,
        resources: [{ resource: 'iron' as ResourceType, amount: 20 }],
        timestamp: new Date(),
        description: 'Make tools',
      };

      const validation = resourceManager.validateTransaction(
        transaction,
        resourceState
      );

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        'Insufficient iron: need 20, have 10 available'
      );
    });

    test('should validate quality requirements', () => {
      const resourceState =
        resourceManager.initializeResources(mockVillageConfig);
      resourceState.resources.food.current = 100;
      resourceState.resources.food.quality = 30; // Poor quality

      const transaction = {
        id: 'test-transaction',
        type: 'consumption' as const,
        resources: [
          { resource: 'food' as ResourceType, amount: 50, quality: 50 },
        ],
        timestamp: new Date(),
        description: 'Feed population',
      };

      const validation = resourceManager.validateTransaction(
        transaction,
        resourceState
      );

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        'food quality too low: need 50, have 30'
      );
    });

    test('should provide warnings for low resources', () => {
      const resourceState =
        resourceManager.initializeResources(mockVillageConfig);
      resourceState.resources.stone.current = 60;
      resourceState.resources.stone.reserved = 0;

      const transaction = {
        id: 'test-transaction',
        type: 'consumption' as const,
        resources: [{ resource: 'stone' as ResourceType, amount: 55 }],
        timestamp: new Date(),
        description: 'Build foundation',
      };

      const validation = resourceManager.validateTransaction(
        transaction,
        resourceState
      );

      expect(validation.isValid).toBe(true);
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Population Consumption Modeling', () => {
    test('should calculate demographic-specific consumption correctly', () => {
      const population: VillagePopulation = {
        total: 100,
        children: 20,
        adults: 65,
        elderly: 15,
        employed: 45,
        unemployed: 20,
        skilled: 25,
        unskilled: 40,
        averageHappiness: 75,
        averageHealth: 80,
        averageEducation: 60,
        birthRate: 15,
        deathRate: 8,
        migrationRate: 2,
        housedPopulation: 95,
        homelessPopulation: 5,
        updatedAt: new Date(),
      };

      const demand = resourceManager.calculateConsumption(population);

      // Check total food consumption: (20 * 1.5) + (65 * 2) + (15 * 1.8) = 30 + 130 + 27 = 187
      expect(demand.totalDemand.food).toBeCloseTo(187, 1);

      // Check water consumption: (20 * 2.5) + (65 * 3) + (15 * 2.8) = 50 + 195 + 42 = 287
      expect(demand.totalDemand.water).toBeCloseTo(287, 1);

      // Verify demographic breakdown
      expect(demand.demographicBreakdown.children.food).toBe(30); // 20 * 1.5
      expect(demand.demographicBreakdown.adults.food).toBe(130); // 65 * 2
      expect(demand.demographicBreakdown.elderly.food).toBe(27); // 15 * 1.8
    });

    test('should identify urgent needs correctly', () => {
      const population = mockVillage.population;
      const demand = resourceManager.calculateConsumption(population);

      // Should have urgent needs for food and water
      const foodUrgent = demand.urgentNeeds.find(
        need => need.resource === 'food'
      );
      const waterUrgent = demand.urgentNeeds.find(
        need => need.resource === 'water'
      );

      expect(foodUrgent).toBeDefined();
      expect(waterUrgent).toBeDefined();
      expect(foodUrgent!.amount).toBeGreaterThan(0);
      expect(waterUrgent!.amount).toBeGreaterThan(0);
    });

    test('should calculate projected growth correctly', () => {
      const population = mockVillage.population;
      population.birthRate = 20; // 20 per 1000
      population.deathRate = 10; // 10 per 1000

      const demand = resourceManager.calculateConsumption(population);

      // Growth rate = (20 - 10) / 1000 = 0.01 = 1%
      expect(demand.projectedGrowth.food).toBeCloseTo(
        demand.totalDemand.food * 0.01,
        2
      );
    });
  });

  describe('Seasonal Effects', () => {
    test('should apply seasonal modifiers correctly', () => {
      const resourceState =
        resourceManager.initializeResources(mockVillageConfig);
      resourceState.dailyProduction.food = 100;

      const weather: WeatherState = {
        current: 'sunny',
        forecast: [],
        temperature: 25,
        humidity: 60,
        windSpeed: 10,
        visibility: 95,
        effects: [],
        duration: 8,
      };

      // Test spring effects (should boost food production)
      const springState = resourceManager.manageSeasonalEffects(
        resourceState,
        'spring',
        weather
      );
      expect(springState.dailyProduction.food).toBeGreaterThan(
        resourceState.dailyProduction.food
      );

      // Test winter effects (should reduce food production)
      const winterState = resourceManager.manageSeasonalEffects(
        resourceState,
        'winter',
        weather
      );
      expect(winterState.dailyProduction.food).toBeLessThan(
        resourceState.dailyProduction.food
      );
    });

    test('should increase wood consumption in winter', () => {
      const resourceState =
        resourceManager.initializeResources(mockVillageConfig);
      const originalWoodConsumption = resourceState.dailyConsumption.wood;

      const weather: WeatherState = {
        current: 'snowy',
        forecast: [],
        temperature: -5,
        humidity: 80,
        windSpeed: 20,
        visibility: 60,
        effects: [],
        duration: 12,
      };

      const winterState = resourceManager.manageSeasonalEffects(
        resourceState,
        'winter',
        weather
      );

      expect(winterState.dailyConsumption.wood).toBeGreaterThan(
        originalWoodConsumption
      );
    });
  });

  describe('Resource Optimization', () => {
    test('should identify optimization opportunities', () => {
      // Set up a village with some inefficiencies
      mockVillage.buildings = [
        {
          id: 'farm-1',
          name: 'Old Farm',
          type: 'farm',
          category: 'economic',
          position: { x: 10, y: 10 },
          size: { width: 5, height: 5 },
          level: 1,
          condition: 'poor', // Poor condition = low efficiency
          durability: 40,
          lastMaintained: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          maintenanceCost: [{ resource: 'wood', amount: 10 }],
          capacity: 20,
          efficiency: 60,
          produces: [{ resource: 'food', amountPerDay: 10, efficiency: 60 }],
          consumes: [],
          stores: [],
          workers: [],
          requiredWorkers: 2,
          maxWorkers: 4,
          prerequisites: [],
          availableUpgrades: [],
          constructionCost: [],
          constructionTime: 0,
          isUnderConstruction: false,
          constructionProgress: 100,
          specialEffects: [],
          connectedBuildings: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Building,
      ];

      mockVillage.resources =
        resourceManager.initializeResources(mockVillageConfig);

      const optimization =
        resourceManager.optimizeResourceDistribution(mockVillage);

      expect(optimization.recommendations).toBeDefined();
      expect(optimization.potentialSavings).toBeDefined();
      expect(optimization.priority).toBeDefined();

      // Should recommend improvements for the poor condition building
      expect(optimization.efficiencyGains['farm-1']).toBeGreaterThan(0);
    });

    test('should recommend storage expansion when near capacity', () => {
      mockVillage.resources =
        resourceManager.initializeResources(mockVillageConfig);

      // Fill storage to 96% capacity
      Object.values(mockVillage.resources.resources).forEach(stock => {
        stock.current = stock.maximum * 0.96;
      });

      const optimization =
        resourceManager.optimizeResourceDistribution(mockVillage);

      const storageRecommendation = optimization.recommendations.find(
        r => r.type === 'build' && r.target === 'warehouse'
      );
      expect(storageRecommendation).toBeDefined();
    });
  });

  describe('Crisis Management', () => {
    test('should detect resource shortages correctly', () => {
      mockVillage.resources =
        resourceManager.initializeResources(mockVillageConfig);

      // Set up a food shortage scenario
      mockVillage.resources.resources.food.current = 10; // Very low food
      mockVillage.resources.dailyConsumption.food = 100; // High consumption

      const crises = resourceManager.detectResourceCrises(mockVillage);

      const foodCrisis = crises.find(
        c => c.resource === 'food' && c.type === 'shortage'
      );
      expect(foodCrisis).toBeDefined();
      expect(foodCrisis!.severity).toBe('catastrophic'); // Less than 1 day supply
      expect(foodCrisis!.daysUntilDepletion).toBeLessThan(1);
    });

    test('should detect quality degradation crises', () => {
      mockVillage.resources =
        resourceManager.initializeResources(mockVillageConfig);

      // Set up a quality crisis
      mockVillage.resources.resources.food.quality = 5; // Very poor quality

      const crises = resourceManager.detectResourceCrises(mockVillage);

      const qualityCrisis = crises.find(
        c => c.resource === 'food' && c.type === 'quality_degradation'
      );
      expect(qualityCrisis).toBeDefined();
      expect(qualityCrisis!.severity).toBe('major');
    });

    test('should detect storage overflow crises', () => {
      mockVillage.resources =
        resourceManager.initializeResources(mockVillageConfig);

      // Fill storage beyond 95%
      mockVillage.resources.resources.wood.current =
        mockVillage.resources.resources.wood.maximum * 0.98;

      const crises = resourceManager.detectResourceCrises(mockVillage);

      const storageCrisis = crises.find(
        c => c.resource === 'wood' && c.type === 'storage_overflow'
      );
      expect(storageCrisis).toBeDefined();
      expect(storageCrisis!.severity).toBe('major'); // > 99% full
    });

    test('should provide appropriate emergency responses', () => {
      mockVillage.resources =
        resourceManager.initializeResources(mockVillageConfig);

      const crisis = {
        type: 'shortage' as const,
        resource: 'food' as ResourceType,
        severity: 'major' as const,
        currentAmount: 20,
        dailyConsumption: 100,
        daysUntilDepletion: 0.2,
        impact: {
          populationHappiness: -60,
          populationHealth: -45,
          economicDamage: 200,
          buildingEfficiency: 0,
          description: 'Food shortage threatens population survival',
        },
        suggestedActions: ['Emergency food procurement'],
        urgency: 80,
      };

      const response = resourceManager.implementEmergencyProtocols(
        crisis,
        mockVillage
      );

      expect(response.actions.length).toBeGreaterThan(0);
      expect(response.estimatedEffectiveness).toBeGreaterThan(0);
      expect(response.expectedOutcome).toBeDefined();

      // Should include rationing as an immediate action
      const rationingAction = response.actions.find(
        a => a.type === 'rationing'
      );
      expect(rationingAction).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete resource management cycle', () => {
      // Initialize resources
      const resourceState =
        resourceManager.initializeResources(mockVillageConfig);
      mockVillage.resources = resourceState;

      // Simulate time passage
      const updatedState = resourceManager.updateResources(resourceState, 24);
      mockVillage.resources = updatedState;

      // Check for crises
      const crises = resourceManager.detectResourceCrises(mockVillage);

      // Optimize distribution
      const optimization =
        resourceManager.optimizeResourceDistribution(mockVillage);

      // Verify everything works together
      expect(updatedState.lastUpdated).toBeInstanceOf(Date);
      expect(Array.isArray(crises)).toBe(true);
      expect(optimization.recommendations).toBeDefined();
    });

    test('should maintain resource consistency across operations', () => {
      const initialState =
        resourceManager.initializeResources(mockVillageConfig);

      // Track total resources before operations
      const initialTotal = Object.values(initialState.resources).reduce(
        (sum, stock) => sum + stock.current,
        0
      );

      // Update resources over time
      const updatedState = resourceManager.updateResources(initialState, 12); // 12 hours

      // Total should change due to production/consumption but remain consistent
      const updatedTotal = Object.values(updatedState.resources).reduce(
        (sum, stock) => sum + stock.current,
        0
      );

      expect(updatedTotal).not.toBe(initialTotal); // Should have changed
      expect(updatedState.usedCapacity).toBeCloseTo(updatedTotal, 1);
    });
  });
});
