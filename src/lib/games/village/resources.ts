/**
 * Village Resource Management System
 *
 * Handles complex resource management for the RpgAInfinity Village Simulator
 * Includes production chains, consumption models, trade, and crisis management
 */

import {
  ResourceType,
  ResourceStore,
  ResourceStock,
  ResourceCost,
  Village,
  VillageConfig,
  VillagePopulation,
  Building,
  SeasonType,
  TradeRoute,
  TradeGood,
  ResourceAlert,
  NaturalResource,
  BuildingType,
  WeatherState,
} from '../../../types/village';

// ============================================================================
// CORE RESOURCE MANAGEMENT INTERFACES
// ============================================================================

export interface ResourceState {
  resources: Record<ResourceType, ResourceStock>;
  totalCapacity: number;
  usedCapacity: number;
  dailyProduction: Record<ResourceType, number>;
  dailyConsumption: Record<ResourceType, number>;
  netFlow: Record<ResourceType, number>;
  efficiency: Record<ResourceType, number>;
  lastUpdated: Date;
}

export interface Transaction {
  id: string;
  type: 'production' | 'consumption' | 'trade' | 'construction' | 'emergency';
  resources: ResourceCost[];
  source?: string; // Building or entity ID
  target?: string; // Building or entity ID
  timestamp: Date;
  description: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface ResourceUpdate {
  resource: ResourceType;
  previousAmount: number;
  newAmount: number;
  change: number;
  reason: string;
  efficiency: number;
  timestamp: Date;
}

export interface ResourceDemand {
  totalDemand: Record<ResourceType, number>;
  demographicBreakdown: {
    children: Record<ResourceType, number>;
    adults: Record<ResourceType, number>;
    elderly: Record<ResourceType, number>;
  };
  urgentNeeds: ResourceCost[];
  luxuryWants: ResourceCost[];
  projectedGrowth: Record<ResourceType, number>;
}

export interface OptimizationResult {
  recommendations: OptimizationRecommendation[];
  potentialSavings: Record<ResourceType, number>;
  effiencyGains: Record<string, number>; // Building ID -> efficiency gain
  implementationCost: ResourceCost[];
  expectedROI: number; // Days to return investment
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface OptimizationRecommendation {
  type: 'build' | 'upgrade' | 'demolish' | 'reassign' | 'trade' | 'policy';
  target: string; // Building ID, policy name, etc.
  description: string;
  cost: ResourceCost[];
  benefits: string[];
  timeToImplement: number; // Days
  confidence: number; // 0-100
}

export interface ProductionChain {
  id: string;
  name: string;
  inputResources: ResourceCost[];
  outputResources: ResourceCost[];
  requiredBuildings: BuildingType[];
  requiredWorkers: number;
  processingTime: number; // Hours
  efficiency: number; // 0-100
  seasonalModifiers: Record<SeasonType, number>;
}

export interface CrisisScenario {
  type:
    | 'drought'
    | 'plague'
    | 'raid'
    | 'famine'
    | 'economic_collapse'
    | 'natural_disaster';
  severity: 'minor' | 'moderate' | 'major' | 'catastrophic';
  affectedResources: ResourceType[];
  duration: number; // Days
  effects: CrisisEffect[];
  mitigationStrategies: MitigationStrategy[];
}

export interface CrisisEffect {
  resource: ResourceType;
  modifier: number; // Multiplier (0.5 = 50% reduction, 1.5 = 50% increase)
  type: 'production' | 'consumption' | 'spoilage' | 'demand';
  description: string;
}

export interface MitigationStrategy {
  name: string;
  description: string;
  cost: ResourceCost[];
  effectiveness: number; // 0-100% crisis reduction
  requirements: string[]; // Buildings, technologies, etc.
  implementationTime: number; // Days
}

// ============================================================================
// RESOURCE MANAGER CLASS
// ============================================================================

export class ResourceManager {
  private static readonly BASE_RESOURCE_TYPES: ResourceType[] = [
    // Basic resources
    'food',
    'wood',
    'stone',
    'iron',
    'gold',
    'water',
    // Processed materials
    'lumber',
    'tools',
    'weapons',
    'cloth',
    'pottery',
    'books',
    // Luxury goods
    'spices',
    'jewelry',
    'art',
    'wine',
    'silk',
    // Abstract resources
    'knowledge',
    'culture',
    'faith',
    'influence',
  ];

  private static readonly PRODUCTION_CHAINS: ProductionChain[] = [
    // Basic processing chains
    {
      id: 'wood_to_lumber',
      name: 'Wood Processing',
      inputResources: [{ resource: 'wood', amount: 2 }],
      outputResources: [{ resource: 'lumber', amount: 1 }],
      requiredBuildings: ['lumber_mill'],
      requiredWorkers: 1,
      processingTime: 4, // 4 hours
      efficiency: 85,
      seasonalModifiers: {
        spring: 1.1,
        summer: 1.2,
        autumn: 1.0,
        winter: 0.8,
      },
    },
    {
      id: 'iron_to_tools',
      name: 'Tool Manufacturing',
      inputResources: [
        { resource: 'iron', amount: 1 },
        { resource: 'wood', amount: 1 },
      ],
      outputResources: [{ resource: 'tools', amount: 1 }],
      requiredBuildings: ['workshop'],
      requiredWorkers: 2,
      processingTime: 8,
      efficiency: 90,
      seasonalModifiers: {
        spring: 1.0,
        summer: 1.0,
        autumn: 1.0,
        winter: 1.0,
      },
    },
    {
      id: 'tools_to_weapons',
      name: 'Weapon Smithing',
      inputResources: [
        { resource: 'iron', amount: 2 },
        { resource: 'tools', amount: 1 },
      ],
      outputResources: [{ resource: 'weapons', amount: 1 }],
      requiredBuildings: ['workshop'],
      requiredWorkers: 3,
      processingTime: 12,
      efficiency: 80,
      seasonalModifiers: {
        spring: 1.0,
        summer: 1.0,
        autumn: 1.0,
        winter: 0.9,
      },
    },
  ];

  private static readonly SPOILAGE_RATES: Record<ResourceType, number> = {
    // Perishables (daily spoilage rate)
    food: 0.02, // 2% per day without proper storage
    water: 0.001, // 0.1% per day (evaporation/contamination)
    // Non-perishables
    wood: 0,
    stone: 0,
    iron: 0,
    gold: 0,
    lumber: 0.001, // Very slow degradation
    tools: 0.0005, // Rust/wear
    weapons: 0.0005, // Rust/wear
    cloth: 0.005, // Moths, decay
    pottery: 0,
    books: 0.002, // Aging, damage
    spices: 0.01, // Flavor loss
    jewelry: 0,
    art: 0.001, // Very slow degradation
    wine: -0.001, // Actually improves with age (negative spoilage)
    silk: 0.003, // Fabric degradation
    knowledge: 0.0001, // Very slow information decay
    culture: 0,
    faith: 0,
    influence: 0.005, // Political influence decays faster
  };

  /**
   * Initialize resources for a new village
   */
  public initializeResources(villageConfig: VillageConfig): ResourceState {
    const initialResources: Record<ResourceType, ResourceStock> = {} as Record<
      ResourceType,
      ResourceStock
    >;

    // Initialize all resource types
    for (const resourceType of ResourceManager.BASE_RESOURCE_TYPES) {
      const startingAmount = villageConfig.startingResources[resourceType] || 0;

      initialResources[resourceType] = {
        current: startingAmount,
        maximum: this.calculateInitialCapacity(resourceType, villageConfig),
        reserved: 0,
        quality: 75, // Start with decent quality
        storageBuildings: [],
        spoilageRate: ResourceManager.SPOILAGE_RATES[resourceType] || 0,
        lastUpdated: new Date(),
      };
    }

    // Calculate initial production and consumption
    const dailyProduction = this.calculateInitialProduction(villageConfig);
    const dailyConsumption = this.calculateInitialConsumption(villageConfig);

    // Calculate net flow
    const netFlow: Record<ResourceType, number> = {} as Record<
      ResourceType,
      number
    >;
    for (const resourceType of ResourceManager.BASE_RESOURCE_TYPES) {
      netFlow[resourceType] =
        dailyProduction[resourceType] - dailyConsumption[resourceType];
    }

    return {
      resources: initialResources,
      totalCapacity: Object.values(initialResources).reduce(
        (sum, stock) => sum + stock.maximum,
        0
      ),
      usedCapacity: Object.values(initialResources).reduce(
        (sum, stock) => sum + stock.current,
        0
      ),
      dailyProduction,
      dailyConsumption,
      netFlow,
      efficiency: this.initializeEfficiency(),
      lastUpdated: new Date(),
    };
  }

  /**
   * Update resources based on time passage
   */
  public updateResources(
    state: ResourceState,
    deltaHours: number
  ): ResourceState {
    const updatedState = { ...state };
    const deltaFraction = deltaHours / 24; // Convert hours to day fraction

    // Process each resource
    for (const [resourceType, stock] of Object.entries(state.resources) as [
      ResourceType,
      ResourceStock,
    ][]) {
      let newAmount = stock.current;

      // Apply production
      const production = state.dailyProduction[resourceType] * deltaFraction;
      newAmount += production * state.efficiency[resourceType];

      // Apply consumption
      const consumption = state.dailyConsumption[resourceType] * deltaFraction;
      newAmount -= consumption;

      // Apply spoilage
      const spoilage = stock.current * stock.spoilageRate * deltaFraction;
      newAmount -= spoilage;

      // Ensure bounds
      newAmount = Math.max(0, Math.min(newAmount, stock.maximum));

      // Update the stock
      updatedState.resources[resourceType] = {
        ...stock,
        current: newAmount,
        lastUpdated: new Date(),
      };
    }

    // Recalculate totals
    updatedState.usedCapacity = Object.values(updatedState.resources).reduce(
      (sum, stock) => sum + stock.current,
      0
    );
    updatedState.lastUpdated = new Date();

    return updatedState;
  }

  /**
   * Validate if a transaction can be completed
   */
  public validateTransaction(
    transaction: Transaction,
    currentState: ResourceState
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check if we have enough resources for consumption transactions
    if (
      transaction.type === 'consumption' ||
      transaction.type === 'construction' ||
      transaction.type === 'trade'
    ) {
      for (const cost of transaction.resources) {
        const available = currentState.resources[cost.resource].current;
        const reserved = currentState.resources[cost.resource].reserved;
        const availableAmount = available - reserved;

        if (availableAmount < cost.amount) {
          errors.push(
            `Insufficient ${cost.resource}: need ${cost.amount}, have ${availableAmount} available`
          );
        } else if (availableAmount < cost.amount * 1.2) {
          warnings.push(
            `Low ${cost.resource}: transaction will use ${cost.amount} of ${availableAmount} available`
          );
        }

        // Quality check
        if (
          cost.quality &&
          currentState.resources[cost.resource].quality < cost.quality
        ) {
          errors.push(
            `${cost.resource} quality too low: need ${cost.quality}, have ${currentState.resources[cost.resource].quality}`
          );
        }
      }
    }

    // Check storage capacity for production transactions
    if (transaction.type === 'production') {
      for (const production of transaction.resources) {
        const stock = currentState.resources[production.resource];
        const availableCapacity = stock.maximum - stock.current;

        if (availableCapacity < production.amount) {
          errors.push(
            `Insufficient storage for ${production.resource}: need ${production.amount}, have ${availableCapacity} capacity`
          );
        } else if (availableCapacity < production.amount * 1.2) {
          warnings.push(
            `Limited storage for ${production.resource}: production will use ${production.amount} of ${availableCapacity} capacity`
          );
        }
      }
    }

    // Generate suggestions based on warnings
    if (warnings.length > 0) {
      suggestions.push('Consider building additional storage facilities');
      suggestions.push('Review resource production to increase supply');
      suggestions.push(
        'Consider trade opportunities to acquire needed resources'
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Process production from all buildings in the village
   */
  public processProduction(village: Village): ResourceUpdate[] {
    const updates: ResourceUpdate[] = [];

    // Process building production
    for (const building of village.buildings) {
      if (building.produces && building.produces.length > 0) {
        for (const production of building.produces) {
          const efficiency = this.calculateBuildingEfficiency(
            building,
            village
          );
          const actualProduction = production.amountPerDay * efficiency;

          // Check if building has required resources for production
          let canProduce = true;
          if (building.consumes) {
            for (const consumption of building.consumes) {
              const available =
                village.resources.resources[consumption.resource].current;
              if (
                available < consumption.amountPerDay &&
                consumption.isRequired
              ) {
                canProduce = false;
                break;
              }
            }
          }

          if (canProduce) {
            const previousAmount =
              village.resources.resources[production.resource].current;
            const newAmount = Math.min(
              previousAmount + actualProduction,
              village.resources.resources[production.resource].maximum
            );

            updates.push({
              resource: production.resource,
              previousAmount,
              newAmount,
              change: newAmount - previousAmount,
              reason: `Production from ${building.name} (${building.type})`,
              efficiency,
              timestamp: new Date(),
            });
          }
        }
      }
    }

    // Process natural resource extraction
    for (const naturalResource of village.layout.resources) {
      const updates_from_natural = this.processNaturalResourceExtraction(
        naturalResource,
        village
      );
      updates.push(...updates_from_natural);
    }

    return updates;
  }

  /**
   * Calculate resource consumption based on population
   */
  public calculateConsumption(population: VillagePopulation): ResourceDemand {
    const totalDemand: Record<ResourceType, number> = {} as Record<
      ResourceType,
      number
    >;

    // Initialize all demands to 0
    for (const resourceType of ResourceManager.BASE_RESOURCE_TYPES) {
      totalDemand[resourceType] = 0;
    }

    // Calculate demographic-specific consumption
    const demographicBreakdown = {
      children: this.calculateChildConsumption(population.children),
      adults: this.calculateAdultConsumption(population.adults),
      elderly: this.calculateElderlyConsumption(population.elderly),
    };

    // Sum up total demand
    for (const [demographic, consumption] of Object.entries(
      demographicBreakdown
    )) {
      for (const [resource, amount] of Object.entries(consumption) as [
        ResourceType,
        number,
      ][]) {
        totalDemand[resource] += amount;
      }
    }

    // Identify urgent needs (survival requirements)
    const urgentNeeds: ResourceCost[] = [
      { resource: 'food', amount: totalDemand.food * 0.8 }, // 80% of food need is urgent
      { resource: 'water', amount: totalDemand.water * 0.9 }, // 90% of water need is urgent
    ];

    // Identify luxury wants
    const luxuryWants: ResourceCost[] = [
      { resource: 'art', amount: population.total * 0.1 },
      { resource: 'wine', amount: population.adults * 0.2 },
      { resource: 'jewelry', amount: population.total * 0.05 },
      { resource: 'silk', amount: population.adults * 0.1 },
    ];

    // Project growth based on population trends
    const projectedGrowth: Record<ResourceType, number> = {} as Record<
      ResourceType,
      number
    >;
    const growthRate = (population.birthRate - population.deathRate) / 1000; // Convert to decimal

    for (const [resource, amount] of Object.entries(totalDemand) as [
      ResourceType,
      number,
    ][]) {
      projectedGrowth[resource] = amount * growthRate;
    }

    return {
      totalDemand,
      demographicBreakdown,
      urgentNeeds,
      luxuryWants,
      projectedGrowth,
    };
  }

  /**
   * Apply seasonal effects to resource generation and consumption
   */
  public manageSeasonalEffects(
    resources: ResourceState,
    season: SeasonType,
    weather: WeatherState
  ): ResourceState {
    const updatedState = { ...resources };

    // Define seasonal modifiers
    const seasonalModifiers = this.getSeasonalModifiers(season);
    const weatherModifiers = this.getWeatherModifiers(weather);

    // Apply seasonal effects to production
    for (const [resourceType, baseProduction] of Object.entries(
      resources.dailyProduction
    ) as [ResourceType, number][]) {
      let modifier = 1.0;

      // Apply seasonal modifier
      if (seasonalModifiers[resourceType]) {
        modifier *= seasonalModifiers[resourceType];
      }

      // Apply weather modifier
      if (weatherModifiers[resourceType]) {
        modifier *= weatherModifiers[resourceType];
      }

      updatedState.dailyProduction[resourceType] = baseProduction * modifier;
    }

    // Apply seasonal effects to consumption (heating in winter, cooling in summer)
    if (season === 'winter') {
      updatedState.dailyConsumption.wood +=
        updatedState.dailyConsumption.wood * 0.5; // 50% more wood for heating
    } else if (season === 'summer') {
      updatedState.dailyConsumption.water +=
        updatedState.dailyConsumption.water * 0.3; // 30% more water
    }

    // Recalculate net flow
    for (const resourceType of ResourceManager.BASE_RESOURCE_TYPES) {
      updatedState.netFlow[resourceType] =
        updatedState.dailyProduction[resourceType] -
        updatedState.dailyConsumption[resourceType];
    }

    return updatedState;
  }

  /**
   * Optimize resource distribution throughout the village
   */
  public optimizeResourceDistribution(village: Village): OptimizationResult {
    const recommendations: OptimizationRecommendation[] = [];
    const potentialSavings: Record<ResourceType, number> = {} as Record<
      ResourceType,
      number
    >;
    const efficiencyGains: Record<string, number> = {};
    let totalImplementationCost: ResourceCost[] = [];

    // Analyze building efficiency
    for (const building of village.buildings) {
      const currentEfficiency = this.calculateBuildingEfficiency(
        building,
        village
      );
      const maxEfficiency = 100;

      if (currentEfficiency < 80) {
        // Building is underperforming
        const upgrade = this.suggestBuildingOptimization(building, village);
        if (upgrade) {
          recommendations.push(upgrade);
          efficiencyGains[building.id] = maxEfficiency - currentEfficiency;
        }
      }
    }

    // Analyze resource flows
    const flowAnalysis = this.analyzeResourceFlows(village);
    for (const bottleneck of flowAnalysis.bottlenecks) {
      const recommendation = this.suggestFlowOptimization(bottleneck, village);
      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    // Analyze storage efficiency
    const storageAnalysis = this.analyzeStorageEfficiency(village);
    if (storageAnalysis.utilization > 0.9) {
      // Storage is 90% full
      recommendations.push({
        type: 'build',
        target: 'warehouse',
        description: 'Build additional storage to prevent resource loss',
        cost: [
          { resource: 'wood', amount: 100 },
          { resource: 'stone', amount: 50 },
        ],
        benefits: [
          'Increase storage capacity',
          'Reduce spoilage',
          'Enable bulk production',
        ],
        timeToImplement: 7,
        confidence: 95,
      });
    }

    // Calculate potential savings
    for (const resourceType of ResourceManager.BASE_RESOURCE_TYPES) {
      const currentWaste = this.calculateResourceWaste(village, resourceType);
      potentialSavings[resourceType] = currentWaste * 0.7; // Assume 70% waste reduction possible
    }

    // Calculate total implementation cost
    totalImplementationCost = this.aggregateResourceCosts(
      recommendations.map(r => r.cost)
    );

    // Calculate ROI
    const totalSavings = Object.values(potentialSavings).reduce(
      (sum, saving) => sum + saving,
      0
    );
    const totalCost = totalImplementationCost.reduce(
      (sum, cost) => sum + cost.amount,
      0
    );
    const expectedROI = totalCost > 0 ? (totalSavings / totalCost) * 30 : 0; // Assume 30-day cycle

    // Determine priority
    let priority: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (expectedROI > 10) priority = 'high';
    else if (expectedROI > 5) priority = 'medium';

    // Check for critical resource shortages
    for (const [resource, stock] of Object.entries(
      village.resources.resources
    ) as [ResourceType, ResourceStock][]) {
      if (stock.current < village.resources.dailyConsumption[resource] * 3) {
        // Less than 3 days supply
        priority = 'critical';
        break;
      }
    }

    return {
      recommendations,
      potentialSavings,
      effiencyGains: efficiencyGains,
      implementationCost: totalImplementationCost,
      expectedROI,
      priority,
    };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private calculateInitialCapacity(
    resourceType: ResourceType,
    config: VillageConfig
  ): number {
    // Base capacity varies by resource type
    const baseCapacity = {
      food: 500,
      water: 1000,
      wood: 200,
      stone: 300,
      iron: 100,
      gold: 50,
      lumber: 150,
      tools: 50,
      weapons: 25,
      cloth: 100,
      pottery: 75,
      books: 30,
      spices: 20,
      jewelry: 10,
      art: 15,
      wine: 40,
      silk: 25,
      knowledge: 100,
      culture: 50,
      faith: 75,
      influence: 25,
    };

    const base = baseCapacity[resourceType] || 50;
    return Math.floor(base * (config.startingPopulation / 100)); // Scale with population
  }

  private calculateInitialProduction(
    config: VillageConfig
  ): Record<ResourceType, number> {
    const production: Record<ResourceType, number> = {} as Record<
      ResourceType,
      number
    >;

    // Initialize all to 0
    for (const resourceType of ResourceManager.BASE_RESOURCE_TYPES) {
      production[resourceType] = 0;
    }

    // Basic starting production based on village size and location
    const populationFactor = config.startingPopulation / 100;

    // Food production varies by location
    production.food = 5 + populationFactor * 2;
    production.water = 10 + populationFactor * 3;
    production.wood = 3 + populationFactor * 1.5;
    production.stone = 1 + populationFactor * 0.5;

    // Knowledge and culture grow slowly from population
    production.knowledge = 0.5 + populationFactor * 0.2;
    production.culture = 0.3 + populationFactor * 0.1;

    return production;
  }

  private calculateInitialConsumption(
    config: VillageConfig
  ): Record<ResourceType, number> {
    const consumption: Record<ResourceType, number> = {} as Record<
      ResourceType,
      number
    >;

    // Initialize all to 0
    for (const resourceType of ResourceManager.BASE_RESOURCE_TYPES) {
      consumption[resourceType] = 0;
    }

    // Basic consumption per person per day
    const population = config.startingPopulation;

    consumption.food = population * 2; // 2 food per person per day
    consumption.water = population * 3; // 3 water per person per day
    consumption.wood = population * 0.5; // For tools, construction, fuel

    return consumption;
  }

  private initializeEfficiency(): Record<ResourceType, number> {
    const efficiency: Record<ResourceType, number> = {} as Record<
      ResourceType,
      number
    >;

    // Start with decent efficiency for all resources
    for (const resourceType of ResourceManager.BASE_RESOURCE_TYPES) {
      efficiency[resourceType] = 0.8; // 80% efficiency initially
    }

    return efficiency;
  }

  private calculateBuildingEfficiency(
    building: Building,
    village: Village
  ): number {
    let efficiency = building.efficiency;

    // Factor in building condition
    const conditionModifier = this.getConditionModifier(building.condition);
    efficiency *= conditionModifier;

    // Factor in worker efficiency
    const workerEfficiency =
      building.workers.length > 0
        ? building.workers.reduce((sum, worker) => sum + worker.efficiency, 0) /
          building.workers.length
        : 50; // Default if no workers

    efficiency *= workerEfficiency / 100;

    // Factor in resource availability for consumption
    if (building.consumes && building.consumes.length > 0) {
      for (const consumption of building.consumes) {
        const available =
          village.resources.resources[consumption.resource].current;
        const needed = consumption.amountPerDay;

        if (available < needed) {
          const shortage = (needed - available) / needed;
          efficiency *= Math.max(0.1, 1 - shortage); // Minimum 10% efficiency
        }
      }
    }

    return Math.max(0, Math.min(100, efficiency));
  }

  private getConditionModifier(condition: string): number {
    switch (condition) {
      case 'perfect':
        return 1.1;
      case 'good':
        return 1.0;
      case 'fair':
        return 0.9;
      case 'poor':
        return 0.7;
      case 'dilapidated':
        return 0.4;
      case 'ruins':
        return 0.1;
      default:
        return 0.8;
    }
  }

  private processNaturalResourceExtraction(
    naturalResource: NaturalResource,
    village: Village
  ): ResourceUpdate[] {
    const updates: ResourceUpdate[] = [];

    // Check if there's a building to extract this resource
    const extractionBuilding = village.buildings.find(
      b => b.type === naturalResource.requiredBuilding
    );

    if (extractionBuilding) {
      const efficiency = this.calculateBuildingEfficiency(
        extractionBuilding,
        village
      );
      const extractionRate = naturalResource.currentYield * (efficiency / 100);

      const previousAmount =
        village.resources.resources[naturalResource.type].current;
      const newAmount = Math.min(
        previousAmount + extractionRate,
        village.resources.resources[naturalResource.type].maximum
      );

      updates.push({
        resource: naturalResource.type,
        previousAmount,
        newAmount,
        change: newAmount - previousAmount,
        reason: `Natural resource extraction from ${naturalResource.type} deposit`,
        efficiency: efficiency,
        timestamp: new Date(),
      });

      // Deplete the natural resource slightly
      naturalResource.currentYield *= 1 - naturalResource.depletionRate;
      naturalResource.currentYield = Math.max(0, naturalResource.currentYield);
    }

    return updates;
  }

  private calculateChildConsumption(
    childCount: number
  ): Record<ResourceType, number> {
    const consumption: Record<ResourceType, number> = {} as Record<
      ResourceType,
      number
    >;

    // Initialize all to 0
    for (const resourceType of ResourceManager.BASE_RESOURCE_TYPES) {
      consumption[resourceType] = 0;
    }

    // Children consume less than adults
    consumption.food = childCount * 1.5; // 1.5 food per child per day
    consumption.water = childCount * 2.5; // 2.5 water per child per day
    consumption.cloth = childCount * 0.1; // Growing children need more clothes

    return consumption;
  }

  private calculateAdultConsumption(
    adultCount: number
  ): Record<ResourceType, number> {
    const consumption: Record<ResourceType, number> = {} as Record<
      ResourceType,
      number
    >;

    // Initialize all to 0
    for (const resourceType of ResourceManager.BASE_RESOURCE_TYPES) {
      consumption[resourceType] = 0;
    }

    // Standard adult consumption
    consumption.food = adultCount * 2; // 2 food per adult per day
    consumption.water = adultCount * 3; // 3 water per adult per day
    consumption.wood = adultCount * 0.3; // Tools, fuel, construction
    consumption.tools = adultCount * 0.01; // Tool wear and replacement
    consumption.cloth = adultCount * 0.05; // Clothing replacement

    return consumption;
  }

  private calculateElderlyConsumption(
    elderlyCount: number
  ): Record<ResourceType, number> {
    const consumption: Record<ResourceType, number> = {} as Record<
      ResourceType,
      number
    >;

    // Initialize all to 0
    for (const resourceType of ResourceManager.BASE_RESOURCE_TYPES) {
      consumption[resourceType] = 0;
    }

    // Elderly have different consumption patterns
    consumption.food = elderlyCount * 1.8; // Slightly less food
    consumption.water = elderlyCount * 2.8; // Slightly less water
    consumption.wood = elderlyCount * 0.4; // More fuel for heating
    // TODO: Add medicine resource when available

    return consumption;
  }

  private getSeasonalModifiers(
    season: SeasonType
  ): Record<ResourceType, number> {
    const modifiers: Record<ResourceType, number> = {} as Record<
      ResourceType,
      number
    >;

    switch (season) {
      case 'spring':
        modifiers.food = 1.2; // Growing season begins
        modifiers.wood = 1.1; // Good weather for logging
        modifiers.water = 1.1; // Spring rains
        break;

      case 'summer':
        modifiers.food = 1.3; // Peak growing season
        modifiers.stone = 1.2; // Good weather for quarrying
        modifiers.water = 0.9; // Some evaporation
        break;

      case 'autumn':
        modifiers.food = 1.1; // Harvest season
        modifiers.wood = 1.2; // Preparation for winter
        modifiers.water = 1.0; // Normal
        break;

      case 'winter':
        modifiers.food = 0.7; // No growing
        modifiers.wood = 0.8; // Difficult logging
        modifiers.stone = 0.6; // Difficult quarrying
        modifiers.water = 0.8; // Frozen sources
        break;
    }

    return modifiers;
  }

  private getWeatherModifiers(
    weather: WeatherState
  ): Record<ResourceType, number> {
    const modifiers: Record<ResourceType, number> = {} as Record<
      ResourceType,
      number
    >;

    // Apply weather effects based on current weather
    for (const effect of weather.effects) {
      if (effect.type === 'production') {
        // Weather affects all outdoor production
        modifiers.food = (modifiers.food || 1) * (1 + effect.modifier / 100);
        modifiers.wood = (modifiers.wood || 1) * (1 + effect.modifier / 100);
        modifiers.stone = (modifiers.stone || 1) * (1 + effect.modifier / 100);
      }
    }

    return modifiers;
  }

  //TODO: Implement advanced optimization methods
  private suggestBuildingOptimization(
    building: Building,
    village: Village
  ): OptimizationRecommendation | null {
    // TODO: Implement building-specific optimization suggestions
    return null;
  }

  private analyzeResourceFlows(village: Village): { bottlenecks: any[] } {
    // TODO: Implement resource flow analysis
    return { bottlenecks: [] };
  }

  private suggestFlowOptimization(
    bottleneck: any,
    village: Village
  ): OptimizationRecommendation | null {
    // TODO: Implement flow optimization suggestions
    return null;
  }

  private analyzeStorageEfficiency(village: Village): { utilization: number } {
    const total = village.resources.totalCapacity;
    const used = village.resources.usedCapacity;
    return { utilization: used / total };
  }

  private calculateResourceWaste(
    village: Village,
    resourceType: ResourceType
  ): number {
    // TODO: Calculate actual waste from spoilage, inefficiency, etc.
    const stock = village.resources.resources[resourceType];
    return stock.current * stock.spoilageRate; // Simple spoilage calculation
  }

  private aggregateResourceCosts(costs: ResourceCost[][]): ResourceCost[] {
    const aggregated: Record<ResourceType, number> = {} as Record<
      ResourceType,
      number
    >;

    for (const costArray of costs) {
      for (const cost of costArray) {
        aggregated[cost.resource] =
          (aggregated[cost.resource] || 0) + cost.amount;
      }
    }

    return Object.entries(aggregated).map(([resource, amount]) => ({
      resource: resource as ResourceType,
      amount,
    }));
  }

  // ============================================================================
  // TRADE SYSTEM METHODS
  // ============================================================================

  /**
   * Calculate optimal trade routes and opportunities
   */
  public evaluateTradeOpportunities(village: Village): TradeOpportunity[] {
    const opportunities: TradeOpportunity[] = [];

    for (const route of village.resources.tradeRoutes) {
      if (!route.isActive) continue;

      // Analyze profitability of each export
      for (const exportGood of route.exports) {
        const profitability = this.calculateTradeProfitability(
          exportGood,
          route,
          village
        );

        if (profitability.profit > 0) {
          opportunities.push({
            routeId: route.id,
            type: 'export',
            resource: exportGood.resource,
            quantity: exportGood.quantity,
            expectedProfit: profitability.profit,
            riskLevel: route.riskLevel,
            timeToComplete: route.travelTime * 2, // Round trip
            requirements: profitability.requirements,
          });
        }
      }

      // Analyze value of imports
      for (const importGood of route.imports) {
        const value = this.calculateImportValue(importGood, village);

        if (value.benefit > value.cost) {
          opportunities.push({
            routeId: route.id,
            type: 'import',
            resource: importGood.resource,
            quantity: importGood.quantity,
            expectedProfit: value.benefit - value.cost,
            riskLevel: route.riskLevel,
            timeToComplete: route.travelTime * 2,
            requirements: [{ resource: 'gold', amount: value.cost }],
          });
        }
      }
    }

    // Sort by profitability and risk
    return opportunities.sort((a, b) => {
      const scoreA = a.expectedProfit / (1 + a.riskLevel / 100);
      const scoreB = b.expectedProfit / (1 + b.riskLevel / 100);
      return scoreB - scoreA;
    });
  }

  /**
   * Execute a trade transaction
   */
  public executeTrade(tradeId: string, village: Village): TradeResult {
    const route = village.resources.tradeRoutes.find(r => r.id === tradeId);
    if (!route) {
      return {
        success: false,
        error: 'Trade route not found',
        changes: [],
      };
    }

    // Validate we have the resources to trade
    for (const exportGood of route.exports) {
      const available =
        village.resources.resources[exportGood.resource].current;
      if (available < exportGood.quantity) {
        return {
          success: false,
          error: `Insufficient ${exportGood.resource} for trade`,
          changes: [],
        };
      }
    }

    // Calculate total import cost
    const totalCost = route.imports.reduce(
      (sum, good) => sum + good.price * good.quantity,
      0
    );
    if (village.economy.treasury < totalCost + route.cost) {
      return {
        success: false,
        error: 'Insufficient gold for trade',
        changes: [],
      };
    }

    const changes: ResourceUpdate[] = [];

    // Remove exported resources
    for (const exportGood of route.exports) {
      const currentAmount =
        village.resources.resources[exportGood.resource].current;
      const newAmount = currentAmount - exportGood.quantity;

      changes.push({
        resource: exportGood.resource,
        previousAmount: currentAmount,
        newAmount,
        change: -exportGood.quantity,
        reason: `Export to ${route.destination}`,
        efficiency: 1.0,
        timestamp: new Date(),
      });
    }

    // Add imported resources
    for (const importGood of route.imports) {
      const currentAmount =
        village.resources.resources[importGood.resource].current;
      const maxCapacity =
        village.resources.resources[importGood.resource].maximum;
      const newAmount = Math.min(
        currentAmount + importGood.quantity,
        maxCapacity
      );
      const actualImport = newAmount - currentAmount;

      changes.push({
        resource: importGood.resource,
        previousAmount: currentAmount,
        newAmount,
        change: actualImport,
        reason: `Import from ${route.destination}`,
        efficiency: 1.0,
        timestamp: new Date(),
      });
    }

    // Update trade route statistics
    route.lastTrade = new Date();
    route.tradesThisMonth++;

    return {
      success: true,
      error: null,
      changes,
      profit: this.calculateTradeProfit(route),
      duration: route.travelTime * 2,
    };
  }

  // ============================================================================
  // CRISIS MANAGEMENT METHODS
  // ============================================================================

  /**
   * Detect and assess resource crises
   */
  public detectResourceCrises(village: Village): ResourceCrisis[] {
    const crises: ResourceCrisis[] = [];

    // Check for immediate shortages
    for (const [resourceType, stock] of Object.entries(
      village.resources.resources
    ) as [ResourceType, ResourceStock][]) {
      const dailyConsumption = village.resources.dailyConsumption[resourceType];
      const daysRemaining =
        dailyConsumption > 0 ? stock.current / dailyConsumption : Infinity;

      if (daysRemaining < 7 && dailyConsumption > 0) {
        // Less than a week's supply
        let severity: 'minor' | 'moderate' | 'major' | 'catastrophic' = 'minor';

        if (daysRemaining < 1) severity = 'catastrophic';
        else if (daysRemaining < 2) severity = 'major';
        else if (daysRemaining < 4) severity = 'moderate';

        crises.push({
          type: 'shortage',
          resource: resourceType,
          severity,
          currentAmount: stock.current,
          dailyConsumption,
          daysUntilDepletion: daysRemaining,
          impact: this.assessCrisisImpact(resourceType, severity, village),
          suggestedActions: this.generateCrisisActions(
            resourceType,
            severity,
            village
          ),
          urgency:
            severity === 'catastrophic'
              ? 100
              : severity === 'major'
                ? 80
                : severity === 'moderate'
                  ? 60
                  : 40,
        });
      }
    }

    // Check for quality degradation crises
    for (const [resourceType, stock] of Object.entries(
      village.resources.resources
    ) as [ResourceType, ResourceStock][]) {
      if (stock.quality < 30) {
        // Very low quality
        crises.push({
          type: 'quality_degradation',
          resource: resourceType,
          severity: stock.quality < 10 ? 'major' : 'moderate',
          currentAmount: stock.current,
          dailyConsumption: village.resources.dailyConsumption[resourceType],
          daysUntilDepletion: Infinity,
          impact: this.assessQualityImpact(
            resourceType,
            stock.quality,
            village
          ),
          suggestedActions: this.generateQualityActions(
            resourceType,
            stock.quality,
            village
          ),
          urgency: stock.quality < 10 ? 70 : 40,
        });
      }
    }

    // Check for storage overflow
    for (const [resourceType, stock] of Object.entries(
      village.resources.resources
    ) as [ResourceType, ResourceStock][]) {
      const utilizationRate = stock.current / stock.maximum;

      if (utilizationRate > 0.95) {
        // 95% full
        crises.push({
          type: 'storage_overflow',
          resource: resourceType,
          severity: utilizationRate > 0.99 ? 'major' : 'moderate',
          currentAmount: stock.current,
          dailyConsumption: village.resources.dailyConsumption[resourceType],
          daysUntilDepletion: Infinity,
          impact: this.assessStorageImpact(
            resourceType,
            utilizationRate,
            village
          ),
          suggestedActions: this.generateStorageActions(resourceType, village),
          urgency: utilizationRate > 0.99 ? 80 : 50,
        });
      }
    }

    // Sort by urgency
    return crises.sort((a, b) => b.urgency - a.urgency);
  }

  /**
   * Implement emergency resource management protocols
   */
  public implementEmergencyProtocols(
    crisis: ResourceCrisis,
    village: Village
  ): EmergencyResponse {
    const actions: EmergencyAction[] = [];
    let effectiveness = 0;

    switch (crisis.type) {
      case 'shortage':
        actions.push(...this.implementShortageProtocols(crisis, village));
        effectiveness = this.calculateProtocolEffectiveness(actions, village);
        break;

      case 'quality_degradation':
        actions.push(...this.implementQualityProtocols(crisis, village));
        effectiveness = this.calculateProtocolEffectiveness(actions, village);
        break;

      case 'storage_overflow':
        actions.push(...this.implementStorageProtocols(crisis, village));
        effectiveness = this.calculateProtocolEffectiveness(actions, village);
        break;
    }

    return {
      crisisId: `${crisis.type}_${crisis.resource}`,
      actions,
      estimatedEffectiveness: effectiveness,
      implementationTime: Math.max(...actions.map(a => a.timeToImplement)),
      totalCost: this.aggregateResourceCosts(actions.map(a => a.cost)),
      expectedOutcome: this.predictEmergencyOutcome(crisis, actions, village),
    };
  }

  // ============================================================================
  // PRIVATE TRADE HELPER METHODS
  // ============================================================================

  private calculateTradeProfitability(
    exportGood: TradeGood,
    route: TradeRoute,
    village: Village
  ): TradeProfitability {
    const revenue = exportGood.price * exportGood.quantity;
    const productionCost = this.calculateProductionCost(
      exportGood.resource,
      exportGood.quantity,
      village
    );
    const transportCost = route.cost;
    const riskCost = revenue * (route.riskLevel / 100) * 0.1; // Risk penalty

    const totalCost = productionCost + transportCost + riskCost;
    const profit = revenue - totalCost;

    return {
      profit,
      revenue,
      costs: {
        production: productionCost,
        transport: transportCost,
        risk: riskCost,
      },
      requirements: [
        { resource: exportGood.resource, amount: exportGood.quantity },
      ],
      margin: revenue > 0 ? (profit / revenue) * 100 : 0,
    };
  }

  private calculateImportValue(
    importGood: TradeGood,
    village: Village
  ): ImportValue {
    const cost = importGood.price * importGood.quantity;
    const localValue = this.calculateLocalValue(
      importGood.resource,
      importGood.quantity,
      village
    );
    const scarcityBonus = this.calculateScarcityBonus(
      importGood.resource,
      village
    );

    return {
      cost,
      benefit: localValue + scarcityBonus,
      scarcityMultiplier: scarcityBonus / localValue,
    };
  }

  private calculateProductionCost(
    resource: ResourceType,
    quantity: number,
    village: Village
  ): number {
    // TODO: Implement detailed production cost calculation
    // For now, use a simple base cost
    const baseCost = {
      food: 1,
      wood: 2,
      stone: 3,
      iron: 5,
      gold: 10,
      lumber: 3,
      tools: 8,
      weapons: 15,
      cloth: 4,
      pottery: 6,
    };

    return (baseCost[resource as keyof typeof baseCost] || 5) * quantity;
  }

  private calculateTradeProfit(route: TradeRoute): number {
    const exportRevenue = route.exports.reduce(
      (sum, good) => sum + good.price * good.quantity,
      0
    );
    const importCost = route.imports.reduce(
      (sum, good) => sum + good.price * good.quantity,
      0
    );
    const operationalCost = route.cost;

    return exportRevenue - importCost - operationalCost;
  }

  private calculateLocalValue(
    resource: ResourceType,
    quantity: number,
    village: Village
  ): number {
    const stock = village.resources.resources[resource];
    const scarcity = 1 - stock.current / stock.maximum;
    const baseValue = village.resources.marketPrices[resource] || 5;

    return baseValue * quantity * (1 + scarcity);
  }

  private calculateScarcityBonus(
    resource: ResourceType,
    village: Village
  ): number {
    const stock = village.resources.resources[resource];
    const dailyConsumption = village.resources.dailyConsumption[resource];

    if (dailyConsumption === 0) return 0;

    const daysSupply = stock.current / dailyConsumption;

    if (daysSupply < 3) return stock.current * 2; // High scarcity bonus
    if (daysSupply < 7) return stock.current * 1.5; // Moderate scarcity bonus
    if (daysSupply < 14) return stock.current * 1.2; // Small scarcity bonus

    return 0; // No scarcity bonus
  }

  // ============================================================================
  // PRIVATE CRISIS MANAGEMENT HELPER METHODS
  // ============================================================================

  private assessCrisisImpact(
    resource: ResourceType,
    severity: string,
    village: Village
  ): CrisisImpact {
    const impact: CrisisImpact = {
      populationHappiness: 0,
      populationHealth: 0,
      economicDamage: 0,
      buildingEfficiency: 0,
      description: '',
    };

    const severityMultiplier =
      severity === 'catastrophic'
        ? 4
        : severity === 'major'
          ? 3
          : severity === 'moderate'
            ? 2
            : 1;

    // Essential resources have higher impact
    if (resource === 'food' || resource === 'water') {
      impact.populationHappiness = -20 * severityMultiplier;
      impact.populationHealth = -15 * severityMultiplier;
      impact.description = `${resource} shortage threatens population survival`;
    } else if (resource === 'wood' || resource === 'tools') {
      impact.buildingEfficiency = -10 * severityMultiplier;
      impact.economicDamage =
        village.economy.monthlyIncome * 0.1 * severityMultiplier;
      impact.description = `${resource} shortage reduces production capacity`;
    } else {
      impact.populationHappiness = -5 * severityMultiplier;
      impact.economicDamage =
        village.economy.monthlyIncome * 0.05 * severityMultiplier;
      impact.description = `${resource} shortage affects quality of life`;
    }

    return impact;
  }

  private generateCrisisActions(
    resource: ResourceType,
    severity: string,
    village: Village
  ): string[] {
    const actions: string[] = [];

    // Universal actions
    actions.push(`Initiate emergency procurement of ${resource}`);
    actions.push(`Ration ${resource} consumption`);
    actions.push(`Seek trade partnerships for ${resource}`);

    // Resource-specific actions
    switch (resource) {
      case 'food':
        actions.push('Implement emergency farming measures');
        actions.push('Organize hunting and foraging expeditions');
        actions.push('Open emergency food reserves');
        break;

      case 'water':
        actions.push('Dig emergency wells');
        actions.push('Implement water conservation measures');
        actions.push('Search for new water sources');
        break;

      case 'wood':
        actions.push('Organize logging expeditions');
        actions.push('Recycle wooden structures');
        actions.push('Explore alternative materials');
        break;
    }

    if (severity === 'catastrophic') {
      actions.push('Declare village emergency');
      actions.push('Implement martial law for resource distribution');
      actions.push('Consider population evacuation');
    }

    return actions;
  }

  private assessQualityImpact(
    resource: ResourceType,
    quality: number,
    village: Village
  ): CrisisImpact {
    const qualityPenalty = (100 - quality) / 100;

    return {
      populationHappiness: -10 * qualityPenalty,
      populationHealth:
        resource === 'food' || resource === 'water'
          ? -15 * qualityPenalty
          : -5 * qualityPenalty,
      economicDamage: village.economy.monthlyIncome * 0.05 * qualityPenalty,
      buildingEfficiency: -5 * qualityPenalty,
      description: `Poor quality ${resource} affecting village well-being`,
    };
  }

  private generateQualityActions(
    resource: ResourceType,
    quality: number,
    village: Village
  ): string[] {
    return [
      `Improve ${resource} storage conditions`,
      `Implement quality control measures`,
      `Replace degraded ${resource} stocks`,
      `Upgrade storage facilities`,
      `Train workers in proper handling`,
    ];
  }

  private assessStorageImpact(
    resource: ResourceType,
    utilization: number,
    village: Village
  ): CrisisImpact {
    const overflowRisk = utilization - 0.9; // Risk above 90% capacity

    return {
      populationHappiness: -5 * overflowRisk * 10,
      populationHealth: 0,
      economicDamage:
        village.resources.dailyProduction[resource] * overflowRisk * 10, // Lost production
      buildingEfficiency: -3 * overflowRisk * 10,
      description: `Storage overflow risk for ${resource} limiting production`,
    };
  }

  private generateStorageActions(
    resource: ResourceType,
    village: Village
  ): string[] {
    return [
      `Build additional ${resource} storage`,
      `Increase ${resource} consumption or trade`,
      `Implement inventory rotation system`,
      `Upgrade existing storage capacity`,
      `Establish overflow storage areas`,
    ];
  }

  private implementShortageProtocols(
    crisis: ResourceCrisis,
    village: Village
  ): EmergencyAction[] {
    const actions: EmergencyAction[] = [];

    // Rationing
    actions.push({
      type: 'rationing',
      description: `Implement emergency rationing of ${crisis.resource}`,
      cost: [],
      effectiveness: 30,
      timeToImplement: 1,
      requirements: ['Administrative capacity'],
    });

    // Emergency procurement
    if (village.economy.treasury >= 100) {
      actions.push({
        type: 'procurement',
        description: `Emergency purchase of ${crisis.resource} from traders`,
        cost: [{ resource: 'gold', amount: 100 }],
        effectiveness: 50,
        timeToImplement: 3,
        requirements: ['Active trade routes', 'Available funds'],
      });
    }

    // Boost production
    actions.push({
      type: 'production_boost',
      description: `Increase ${crisis.resource} production through overtime work`,
      cost: [{ resource: 'gold', amount: 50 }],
      effectiveness: 40,
      timeToImplement: 2,
      requirements: ['Available workers', 'Production facilities'],
    });

    return actions;
  }

  private implementQualityProtocols(
    crisis: ResourceCrisis,
    village: Village
  ): EmergencyAction[] {
    return [
      {
        type: 'quality_improvement',
        description: `Improve storage and handling of ${crisis.resource}`,
        cost: [
          { resource: 'wood', amount: 20 },
          { resource: 'tools', amount: 5 },
        ],
        effectiveness: 60,
        timeToImplement: 5,
        requirements: ['Storage facilities', 'Skilled workers'],
      },
    ];
  }

  private implementStorageProtocols(
    crisis: ResourceCrisis,
    village: Village
  ): EmergencyAction[] {
    return [
      {
        type: 'storage_expansion',
        description: `Build emergency storage for ${crisis.resource}`,
        cost: [
          { resource: 'wood', amount: 50 },
          { resource: 'stone', amount: 30 },
        ],
        effectiveness: 70,
        timeToImplement: 7,
        requirements: ['Construction workers', 'Available space'],
      },
    ];
  }

  private calculateProtocolEffectiveness(
    actions: EmergencyAction[],
    village: Village
  ): number {
    if (actions.length === 0) return 0;

    // Calculate average effectiveness, weighted by implementation feasibility
    let totalEffectiveness = 0;
    let totalWeight = 0;

    for (const action of actions) {
      const feasibility = this.assessActionFeasibility(action, village);
      const weight = feasibility / 100;

      totalEffectiveness += action.effectiveness * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? totalEffectiveness / totalWeight : 0;
  }

  private assessActionFeasibility(
    action: EmergencyAction,
    village: Village
  ): number {
    let feasibility = 100;

    // Check resource requirements
    for (const cost of action.cost) {
      const available = village.resources.resources[cost.resource].current;
      if (available < cost.amount) {
        feasibility -= 50; // Major penalty for missing resources
      } else if (available < cost.amount * 1.5) {
        feasibility -= 20; // Minor penalty for tight resources
      }
    }

    // Check requirement availability (simplified)
    if (
      action.requirements.includes('Available workers') &&
      village.population.unemployed < 5
    ) {
      feasibility -= 30;
    }

    if (
      action.requirements.includes('Available funds') &&
      village.economy.treasury < 50
    ) {
      feasibility -= 40;
    }

    return Math.max(0, feasibility);
  }

  private predictEmergencyOutcome(
    crisis: ResourceCrisis,
    actions: EmergencyAction[],
    village: Village
  ): EmergencyOutcome {
    const totalEffectiveness = this.calculateProtocolEffectiveness(
      actions,
      village
    );
    const timeToResolve = Math.max(...actions.map(a => a.timeToImplement));

    return {
      successProbability: Math.min(95, totalEffectiveness),
      timeToResolve,
      residualImpact: Math.max(0, crisis.urgency - totalEffectiveness),
      longTermEffects:
        totalEffectiveness > 70
          ? ['Improved crisis preparedness', 'Enhanced resource management']
          : ['Ongoing resource vulnerability', 'Reduced population confidence'],
    };
  }
}

// ============================================================================
// ADDITIONAL INTERFACES FOR TRADE AND CRISIS SYSTEMS
// ============================================================================

export interface TradeOpportunity {
  routeId: string;
  type: 'export' | 'import';
  resource: ResourceType;
  quantity: number;
  expectedProfit: number;
  riskLevel: number;
  timeToComplete: number;
  requirements: ResourceCost[];
}

export interface TradeResult {
  success: boolean;
  error: string | null;
  changes: ResourceUpdate[];
  profit?: number;
  duration?: number;
}

export interface TradeProfitability {
  profit: number;
  revenue: number;
  costs: {
    production: number;
    transport: number;
    risk: number;
  };
  requirements: ResourceCost[];
  margin: number;
}

export interface ImportValue {
  cost: number;
  benefit: number;
  scarcityMultiplier: number;
}

export interface ResourceCrisis {
  type: 'shortage' | 'quality_degradation' | 'storage_overflow';
  resource: ResourceType;
  severity: 'minor' | 'moderate' | 'major' | 'catastrophic';
  currentAmount: number;
  dailyConsumption: number;
  daysUntilDepletion: number;
  impact: CrisisImpact;
  suggestedActions: string[];
  urgency: number; // 0-100
}

export interface CrisisImpact {
  populationHappiness: number;
  populationHealth: number;
  economicDamage: number;
  buildingEfficiency: number;
  description: string;
}

export interface EmergencyResponse {
  crisisId: string;
  actions: EmergencyAction[];
  estimatedEffectiveness: number;
  implementationTime: number;
  totalCost: ResourceCost[];
  expectedOutcome: EmergencyOutcome;
}

export interface EmergencyAction {
  type:
    | 'rationing'
    | 'procurement'
    | 'production_boost'
    | 'quality_improvement'
    | 'storage_expansion';
  description: string;
  cost: ResourceCost[];
  effectiveness: number; // 0-100
  timeToImplement: number; // Days
  requirements: string[];
}

export interface EmergencyOutcome {
  successProbability: number; // 0-100
  timeToResolve: number; // Days
  residualImpact: number; // Remaining crisis severity
  longTermEffects: string[];
}
