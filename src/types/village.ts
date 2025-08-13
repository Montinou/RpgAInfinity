/**
 * Village Simulation Type Definitions
 *
 * Defines data structures for the village survival simulation game mode
 * Focuses on resource management, NPCs, and emergent gameplay
 */

import { z } from 'zod';
import { GameState, GameConfig } from './core';

// ============================================================================
// VILLAGE CORE TYPES
// ============================================================================

export type VillageSize = 'hamlet' | 'village' | 'town' | 'city';
export type SeasonType = 'spring' | 'summer' | 'autumn' | 'winter';
export type VillagePhase =
  | 'planning'
  | 'working'
  | 'rest'
  | 'crisis'
  | 'celebration';

export interface SeasonalModifier {
  readonly temperature: number;
  readonly precipitation: number;
  readonly growthRate: number;
  readonly eventChance: number;
}

/**
 * Village - main village entity
 * KV Key Pattern: village:{sessionId}
 */
export interface Village {
  id: string;
  sessionId: string;

  // Village identity
  name: string;
  size: VillageSize;
  founded: Date;
  age: number; // in game days

  // Physical layout
  layout: VillageLayout;
  buildings: Building[];
  infrastructure: Infrastructure[];

  // Population
  population: VillagePopulation;
  residents: Resident[];

  // Resources and economy
  resources: ResourceStore;
  economy: VillageEconomy;

  // Village state
  happiness: number; // 0-100
  stability: number; // 0-100
  prosperity: number; // 0-100
  defense: number; // 0-100

  // Environmental factors
  location: VillageLocation;
  season: SeasonInfo;
  weather: WeatherState;

  // Events and history
  currentEvents: VillageEvent[];
  eventHistory: HistoricalEvent[];

  // AI-driven elements
  aiPersonality: VillagePersonality;

  createdAt: Date;
  updatedAt: Date;
}

export interface VillageLayout {
  size: { width: number; height: number };
  centerX: number;
  centerY: number;

  // Zones
  residential: Zone[];
  commercial: Zone[];
  agricultural: Zone[];
  industrial: Zone[];
  recreational: Zone[];

  // Natural features
  terrain: TerrainFeature[];
  waterSources: WaterSource[];
  resources: NaturalResource[];
}

export interface Zone {
  id: string;
  type: ZoneType;
  area: Area;
  capacity: number;
  occupied: number;
  efficiency: number; // 0-100
  condition: BuildingCondition;
}

export type ZoneType =
  | 'residential'
  | 'commercial'
  | 'agricultural'
  | 'industrial'
  | 'recreational'
  | 'administrative'
  | 'religious'
  | 'military';

export interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TerrainFeature {
  id: string;
  type: TerrainType;
  position: { x: number; y: number };
  size: number;
  effects: TerrainEffect[];
}

export type TerrainType =
  | 'hill'
  | 'forest'
  | 'river'
  | 'lake'
  | 'mountain'
  | 'plain'
  | 'marsh'
  | 'desert';

export interface TerrainEffect {
  type:
    | 'resource_bonus'
    | 'building_restriction'
    | 'defense_bonus'
    | 'trade_route';
  resource?: ResourceType;
  modifier: number;
  description: string;
}

export interface WaterSource {
  id: string;
  type: 'well' | 'river' | 'lake' | 'spring';
  position: { x: number; y: number };
  quality: number; // 0-100
  capacity: number; // water units per day
  isRenewable: boolean;
}

// ============================================================================
// BUILDINGS AND INFRASTRUCTURE
// ============================================================================

export interface Building {
  id: string;
  name: string;
  type: BuildingType;
  category: BuildingCategory;

  // Physical properties
  position: { x: number; y: number };
  size: { width: number; height: number };
  level: number; // Building tier/upgrade level

  // Condition and maintenance
  condition: BuildingCondition;
  durability: number; // 0-100
  lastMaintained: Date;
  maintenanceCost: ResourceCost[];

  // Functionality
  capacity: number;
  efficiency: number; // 0-100, affected by condition/workers

  // Resource interaction
  produces: ResourceProduction[];
  consumes: ResourceConsumption[];
  stores: ResourceStorage[];

  // Staffing
  workers: Worker[];
  requiredWorkers: number;
  maxWorkers: number;

  // Upgrades and requirements
  prerequisites: BuildingPrerequisite[];
  availableUpgrades: BuildingUpgrade[];

  // Construction
  constructionCost: ResourceCost[];
  constructionTime: number; // in game days
  isUnderConstruction: boolean;
  constructionProgress: number; // 0-100

  // Special properties
  specialEffects: BuildingEffect[];
  connectedBuildings: string[]; // Building IDs

  createdAt: Date;
  updatedAt: Date;
}

export type BuildingType =
  // Residential
  | 'house'
  | 'apartment'
  | 'mansion'
  | 'inn'

  // Economic
  | 'farm'
  | 'mine'
  | 'lumber_mill'
  | 'workshop'
  | 'market'
  | 'bank'

  // Administrative
  | 'town_hall'
  | 'courthouse'
  | 'tax_office'

  // Military
  | 'barracks'
  | 'watchtower'
  | 'wall'
  | 'gate'

  // Religious/Cultural
  | 'temple'
  | 'library'
  | 'school'
  | 'theater'

  // Infrastructure
  | 'road'
  | 'bridge'
  | 'aqueduct'
  | 'sewer'
  | 'warehouse'

  // Special
  | 'monument'
  | 'wonder'
  | 'ruins';

export type BuildingCategory =
  | 'residential'
  | 'economic'
  | 'military'
  | 'cultural'
  | 'infrastructure'
  | 'administrative'
  | 'special';

export type BuildingCondition =
  | 'perfect'
  | 'good'
  | 'fair'
  | 'poor'
  | 'dilapidated'
  | 'ruins';

export interface ResourceProduction {
  resource: ResourceType;
  amountPerDay: number;
  efficiency: number; // Affected by workers, condition, etc.
  requiredWorkers?: number;
  seasonalModifier?: SeasonalModifier;
}

export interface ResourceConsumption {
  resource: ResourceType;
  amountPerDay: number;
  isRequired: boolean; // If false, building can operate without it (at reduced efficiency)
  efficiency: number;
}

export interface ResourceStorage {
  resource: ResourceType;
  capacity: number;
  currentAmount: number;
  preservationRate: number; // 0-100, how well it preserves resources
}

export interface Worker {
  residentId: string;
  skill: number; // 0-100 competency
  efficiency: number; // Current performance
  satisfaction: number; // 0-100
  salary: number;
  assignedAt: Date;
}

export interface BuildingPrerequisite {
  type: 'building' | 'population' | 'resource' | 'technology' | 'event';
  requirement: string;
  amount?: number;
}

export interface BuildingUpgrade {
  id: string;
  name: string;
  description: string;
  cost: ResourceCost[];
  benefits: BuildingEffect[];
  requirements: BuildingPrerequisite[];
}

export interface BuildingEffect {
  type: EffectType;
  target: EffectTarget;
  modifier: number;
  description: string;
  duration?: number; // days, undefined = permanent
  range?: number; // affects nearby buildings
}

export type EffectType =
  | 'production_bonus'
  | 'efficiency_bonus'
  | 'happiness_bonus'
  | 'defense_bonus'
  | 'cost_reduction'
  | 'capacity_increase'
  | 'unlock_building'
  | 'unlock_technology';

export type EffectTarget =
  | 'self'
  | 'adjacent'
  | 'zone'
  | 'village'
  | 'population'
  | 'specific_building';

export interface Infrastructure {
  id: string;
  type: InfrastructureType;
  level: number;
  coverage: number; // 0-100 percentage of village covered

  // Infrastructure stats
  capacity: number;
  usage: number;
  efficiency: number;
  maintenanceCost: ResourceCost[];

  // Network connections
  connections: string[]; // Connected infrastructure IDs

  // Effects on village
  effects: InfrastructureEffect[];

  condition: BuildingCondition;
  lastMaintained: Date;
}

export type InfrastructureType =
  | 'roads'
  | 'water_system'
  | 'sewage'
  | 'power'
  | 'communication'
  | 'trade_routes';

export interface InfrastructureEffect {
  type: 'efficiency' | 'happiness' | 'health' | 'trade' | 'movement';
  bonus: number;
  description: string;
}

// ============================================================================
// RESOURCES AND ECONOMY
// ============================================================================

export type ResourceType =
  // Basic resources
  | 'food'
  | 'wood'
  | 'stone'
  | 'iron'
  | 'gold'
  | 'water'

  // Processed materials
  | 'lumber'
  | 'tools'
  | 'weapons'
  | 'cloth'
  | 'pottery'
  | 'books'

  // Luxury goods
  | 'spices'
  | 'jewelry'
  | 'art'
  | 'wine'
  | 'silk'

  // Abstract resources
  | 'knowledge'
  | 'culture'
  | 'faith'
  | 'influence';

export interface ResourceStore {
  resources: Record<ResourceType, ResourceStock>;
  totalCapacity: number;
  usedCapacity: number;

  // Resource flows
  dailyProduction: Record<ResourceType, number>;
  dailyConsumption: Record<ResourceType, number>;
  netFlow: Record<ResourceType, number>;

  // Trading
  tradeRoutes: TradeRoute[];
  marketPrices: Record<ResourceType, number>;

  updatedAt: Date;
}

export interface ResourceStock {
  current: number;
  maximum: number;
  reserved: number; // Reserved for construction/projects
  quality: number; // 0-100

  // Storage info
  storageBuildings: string[];
  spoilageRate: number; // Per day for perishables
  lastUpdated: Date;
}

export interface ResourceCost {
  resource: ResourceType;
  amount: number;
  quality?: number; // Minimum quality required
}

export interface NaturalResource {
  id: string;
  type: ResourceType;
  position: { x: number; y: number };

  // Resource properties
  abundance: number; // 0-100
  quality: number; // 0-100
  accessibility: number; // 0-100, how easy to extract

  // Extraction
  currentYield: number;
  maxYield: number;
  depletionRate: number;
  regenerationRate: number;

  // Requirements
  requiredTechnology?: string;
  requiredBuilding?: BuildingType;
  requiredWorkers: number;

  // Environmental impact
  extractionDifficulty: number;
  environmentalCost: number;
}

export interface TradeRoute {
  id: string;
  destination: string; // Other village/city name
  distance: number;

  // Trade terms
  exports: TradeGood[];
  imports: TradeGood[];

  // Route properties
  safety: number; // 0-100
  reliability: number; // 0-100
  cost: number; // Gold per trip
  travelTime: number; // Days

  // Current state
  isActive: boolean;
  lastTrade: Date;
  tradesThisMonth: number;

  // Historical data
  profitability: number;
  riskLevel: number;
}

export interface TradeGood {
  resource: ResourceType;
  quantity: number;
  price: number; // Per unit
  demand: number; // 0-100
}

export interface VillageEconomy {
  // Financial state
  treasury: number; // Gold
  monthlyIncome: number;
  monthlyExpenses: number;
  netProfit: number;

  // Economic indicators
  economicHealth: number; // 0-100
  inflation: number; // Percentage
  unemployment: number; // Percentage

  // Taxes and fees
  taxRate: number; // Percentage
  tradeFees: number; // Percentage

  // Economic policies
  policies: EconomicPolicy[];

  // Market data
  supplyDemand: Record<ResourceType, SupplyDemandData>;
  priceHistory: PriceHistoryEntry[];
}

export interface EconomicPolicy {
  id: string;
  name: string;
  type: PolicyType;
  effects: PolicyEffect[];
  cost: number;
  duration: number; // Days
  popularity: number; // -100 to 100
  isActive: boolean;
}

export type PolicyType =
  | 'tax'
  | 'trade'
  | 'labor'
  | 'resource'
  | 'military'
  | 'social';

export interface PolicyEffect {
  target: 'happiness' | 'productivity' | 'trade' | 'defense' | 'growth';
  modifier: number;
  description: string;
}

export interface SupplyDemandData {
  supply: number;
  demand: number;
  basePrice: number;
  currentPrice: number;
  priceVolatility: number;
}

export interface PriceHistoryEntry {
  resource: ResourceType;
  price: number;
  date: Date;
  volume: number;
}

// ============================================================================
// POPULATION AND RESIDENTS
// ============================================================================

export interface VillagePopulation {
  total: number;

  // Demographics
  children: number; // 0-15
  adults: number; // 16-60
  elderly: number; // 60+

  // Employment
  employed: number;
  unemployed: number;
  skilled: number;
  unskilled: number;

  // Social stats
  averageHappiness: number; // 0-100
  averageHealth: number; // 0-100
  averageEducation: number; // 0-100

  // Population dynamics
  birthRate: number; // Per 1000 per year
  deathRate: number; // Per 1000 per year
  migrationRate: number; // Net migration per year

  // Housing
  housedPopulation: number;
  homelessPopulation: number;

  updatedAt: Date;
}

export interface Resident {
  id: string;
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';

  // Personal stats
  health: number; // 0-100
  happiness: number; // 0-100
  education: number; // 0-100

  // Skills and profession
  profession: Profession;
  skills: ResidentSkill[];
  experience: number;

  // Social connections
  family: FamilyRelation[];
  friends: SocialRelation[];
  reputation: number; // -100 to 100

  // Economic status
  wealth: number;
  income: number;
  expenses: number;

  // Living situation
  housing: Housing;
  employment: Employment;

  // Personal traits
  personality: PersonalityTraits;
  needs: ResidentNeeds;

  // Life events
  lifeEvents: LifeEvent[];

  // AI behavior
  aiPersonality?: AIPersonality;

  createdAt: Date;
  updatedAt: Date;
}

export interface Profession {
  id: string;
  name: string;
  category: ProfessionCategory;
  skillLevel: number; // 0-100
  income: number;
  prestige: number; // 0-100
  workloadStress: number; // 0-100
}

export type ProfessionCategory =
  | 'agriculture'
  | 'crafting'
  | 'trade'
  | 'military'
  | 'administration'
  | 'education'
  | 'religion'
  | 'entertainment';

export interface ResidentSkill {
  skill: SkillType;
  level: number; // 0-100
  experience: number;
  trainedBy?: string; // Resident ID of teacher
  lastUsed: Date;
}

export type SkillType =
  | 'farming'
  | 'crafting'
  | 'trading'
  | 'combat'
  | 'leadership'
  | 'education'
  | 'medicine'
  | 'construction'
  | 'artistry'
  | 'diplomacy';

export interface FamilyRelation {
  residentId: string;
  relation: FamilyRelationType;
  closeness: number; // 0-100
}

export type FamilyRelationType =
  | 'spouse'
  | 'parent'
  | 'child'
  | 'sibling'
  | 'grandparent'
  | 'grandchild'
  | 'aunt_uncle'
  | 'cousin';

export interface SocialRelation {
  residentId: string;
  relationship: SocialRelationType;
  strength: number; // 0-100
  history: string[];
}

export type SocialRelationType =
  | 'friend'
  | 'acquaintance'
  | 'rival'
  | 'enemy'
  | 'mentor'
  | 'student';

export interface Housing {
  buildingId?: string;
  type: HousingType;
  quality: number; // 0-100
  capacity: number;
  occupants: string[]; // Resident IDs
  rent: number; // If rented
  isOwned: boolean;
}

export type HousingType =
  | 'owned_house'
  | 'rented_room'
  | 'family_home'
  | 'shared_housing'
  | 'homeless';

export interface Employment {
  buildingId?: string;
  position: string;
  salary: number;
  satisfaction: number; // 0-100
  performance: number; // 0-100
  startDate: Date;
  workHours: number; // Per day
}

export interface PersonalityTraits {
  ambition: number; // 0-100
  sociability: number; // 0-100
  creativity: number; // 0-100
  loyalty: number; // 0-100
  courage: number; // 0-100
  intelligence: number; // 0-100
  compassion: number; // 0-100
  greed: number; // 0-100
}

export interface ResidentNeeds {
  food: number; // 0-100, how well fed
  shelter: number; // 0-100, housing quality
  safety: number; // 0-100, personal security
  social: number; // 0-100, social connections
  purpose: number; // 0-100, meaningful work/goals
  luxury: number; // 0-100, access to non-essentials

  // Urgent needs
  urgentNeeds: UrgentNeed[];
}

export interface UrgentNeed {
  type: 'food' | 'medical' | 'shelter' | 'safety' | 'employment';
  severity: number; // 0-100
  timeRemaining: number; // Days until crisis
  description: string;
}

export interface LifeEvent {
  id: string;
  type: LifeEventType;
  description: string;
  date: Date;
  impact: LifeEventImpact;
  consequences: string[];
}

export type LifeEventType =
  | 'birth'
  | 'death'
  | 'marriage'
  | 'divorce'
  | 'job_change'
  | 'accident'
  | 'illness'
  | 'achievement'
  | 'crime'
  | 'education';

export interface LifeEventImpact {
  happiness: number; // -50 to +50
  health: number; // -50 to +50
  wealth: number; // Change in wealth
  reputation: number; // -50 to +50
  skills?: Partial<Record<SkillType, number>>;
}

export interface AIPersonality {
  archetypeId: string;
  traits: Record<string, number>;
  quirks: string[];
  speechPatterns: string[];
  decisionTendencies: DecisionTendency[];
}

export interface DecisionTendency {
  situation: string;
  preference: 'conservative' | 'moderate' | 'aggressive';
  reasoning: string;
}

// ============================================================================
// EVENTS AND CRISES
// ============================================================================

export interface VillageEvent {
  id: string;
  name: string;
  type: EventType;
  severity: EventSeverity;

  // Event details
  description: string;
  cause?: string;

  // Timing
  startDate: Date;
  duration: number; // Days
  endDate?: Date;

  // Effects
  effects: EventEffect[];

  // Response options
  responses: EventResponse[];
  chosenResponse?: string;

  // State
  isActive: boolean;
  isResolved: boolean;

  // AI generation context
  generatedByAI: boolean;
  generationContext?: Record<string, any>;
}

export type EventType =
  | 'natural'
  | 'economic'
  | 'social'
  | 'military'
  | 'technological'
  | 'political'
  | 'cultural'
  | 'supernatural';

export type EventSeverity =
  | 'minor'
  | 'moderate'
  | 'major'
  | 'catastrophic'
  | 'beneficial';

export interface EventEffect {
  type: 'resource' | 'population' | 'building' | 'happiness' | 'stability';
  target?: string; // Specific target ID if applicable
  modifier: number;
  duration: number; // Days, -1 for permanent
  description: string;
}

export interface EventResponse {
  id: string;
  name: string;
  description: string;

  // Requirements
  cost: ResourceCost[];
  requirements: EventRequirement[];

  // Outcomes
  effects: EventEffect[];
  successChance: number; // 0-100

  // Time to implement
  implementationTime: number; // Days
}

export interface EventRequirement {
  type: 'resource' | 'building' | 'population' | 'skill' | 'technology';
  target: string;
  amount?: number;
  level?: number;
}

export interface HistoricalEvent {
  eventId: string;
  name: string;
  type: EventType;
  date: Date;
  duration: number;

  // Outcomes
  outcome: EventOutcome;
  consequences: string[];

  // Impact assessment
  shortTermImpact: ImpactAssessment;
  longTermImpact: ImpactAssessment;

  // Lessons learned
  lessonsLearned: string[];

  // Memory and commemoration
  commemorated: boolean;
  monument?: string; // Building ID if monument built
}

export interface EventOutcome {
  success: boolean;
  description: string;
  unexpectedConsequences: string[];

  // Quantified results
  resourceChanges: Record<ResourceType, number>;
  populationChange: number;
  happinessChange: number;
  stabilityChange: number;
}

export interface ImpactAssessment {
  economic: number; // -100 to 100
  social: number; // -100 to 100
  political: number; // -100 to 100
  cultural: number; // -100 to 100
  description: string;
}

// ============================================================================
// ENVIRONMENT AND SEASONS
// ============================================================================

export interface VillageLocation {
  region: string;
  climate: ClimateType;
  terrain: TerrainType[];

  // Geographic features
  elevation: number;
  waterAccess: WaterAccess;
  naturalResources: ResourceType[];

  // Strategic position
  tradeRouteAccess: number; // 0-100
  defensibility: number; // 0-100
  expansionPotential: number; // 0-100

  // Environmental factors
  naturalHazards: NaturalHazard[];
  wildlife: WildlifePresence[];
}

export type ClimateType =
  | 'tropical'
  | 'temperate'
  | 'arid'
  | 'continental'
  | 'polar'
  | 'mediterranean';

export type WaterAccess =
  | 'riverside'
  | 'lakeside'
  | 'coastal'
  | 'inland_spring'
  | 'dry'
  | 'oasis';

export interface NaturalHazard {
  type: HazardType;
  frequency: number; // Times per year on average
  severity: EventSeverity;
  seasonality?: SeasonType;
  warning: number; // Days of advance warning typically available
  mitigation: string[]; // Building types that help mitigate
}

export type HazardType =
  | 'flood'
  | 'drought'
  | 'earthquake'
  | 'wildfire'
  | 'storm'
  | 'volcanic'
  | 'plague'
  | 'famine'
  | 'invasion';

export interface WildlifePresence {
  species: string;
  population: WildlifePopulation;
  threat: number; // 0-100
  benefit?: WildlifeBenefit;
}

export type WildlifePopulation =
  | 'extinct'
  | 'rare'
  | 'uncommon'
  | 'common'
  | 'abundant'
  | 'overpopulated';

export interface WildlifeBenefit {
  type: 'food' | 'materials' | 'trade' | 'protection' | 'transportation';
  value: number;
  sustainability: number; // 0-100, how sustainable the exploitation is
}

export interface SeasonInfo {
  current: SeasonType;
  day: number; // Day within the season
  totalDays: number; // Total days in this season

  // Season characteristics
  temperature: TemperatureRange;
  rainfall: number; // 0-100
  growingConditions: number; // 0-100 for agriculture

  // Seasonal modifiers
  productionModifiers: Record<ResourceType, number>;
  happinessModifier: number;
  healthModifier: number;

  // Special events
  seasonalEvents: string[]; // Event IDs that can occur this season
}

export interface TemperatureRange {
  min: number; // Celsius
  max: number; // Celsius
  average: number; // Celsius
  comfort: number; // 0-100, how comfortable for humans
}

export interface WeatherState {
  current: WeatherType;
  forecast: WeatherForecast[];

  // Current conditions
  temperature: number; // Celsius
  humidity: number; // 0-100
  windSpeed: number; // km/h
  visibility: number; // 0-100

  // Weather effects
  effects: WeatherEffect[];
  duration: number; // Hours remaining
}

export type WeatherType =
  | 'sunny'
  | 'cloudy'
  | 'rainy'
  | 'stormy'
  | 'snowy'
  | 'foggy'
  | 'windy'
  | 'extreme';

export interface WeatherForecast {
  day: number; // Days from now
  weather: WeatherType;
  temperature: TemperatureRange;
  precipitation: number; // 0-100
  confidence: number; // 0-100
}

export interface WeatherEffect {
  type: 'production' | 'movement' | 'happiness' | 'health' | 'construction';
  modifier: number;
  description: string;
  affectedBuildings?: BuildingType[];
}

// ============================================================================
// AI PERSONALITY AND BEHAVIOR
// ============================================================================

export interface VillagePersonality {
  // Core traits
  conservatism: number; // 0-100, resistance to change
  cooperation: number; // 0-100, willingness to help others
  ambition: number; // 0-100, drive for growth and achievement
  caution: number; // 0-100, risk aversion
  creativity: number; // 0-100, openness to new ideas

  // Cultural aspects
  values: CulturalValue[];
  traditions: Tradition[];
  socialNorms: SocialNorm[];

  // Decision-making tendencies
  decisionStyle: DecisionStyle;
  priorityTypes: PriorityType[];

  // Adaptability
  adaptability: number; // 0-100
  memoryStrength: number; // 0-100, how well they remember past events
  learningRate: number; // 0-100, how quickly they adapt
}

export interface CulturalValue {
  name: string;
  importance: number; // 0-100
  description: string;
  manifestations: string[]; // How this value shows up in daily life
}

export interface Tradition {
  name: string;
  type: TraditionType;
  frequency: 'daily' | 'weekly' | 'monthly' | 'seasonal' | 'annual' | 'rare';
  participation: number; // 0-100, percentage of population that participates
  importance: number; // 0-100
  origins: string;
  effects: TraditionEffect[];
}

export type TraditionType =
  | 'religious'
  | 'cultural'
  | 'economic'
  | 'social'
  | 'historical';

export interface TraditionEffect {
  type: 'happiness' | 'unity' | 'productivity' | 'resources';
  modifier: number;
  duration: number; // Days
}

export interface SocialNorm {
  name: string;
  description: string;
  enforcement: number; // 0-100, how strictly enforced
  adherence: number; // 0-100, how well followed
  consequences: string[]; // What happens when violated
}

export type DecisionStyle =
  | 'democratic'
  | 'authoritarian'
  | 'council'
  | 'traditional'
  | 'chaotic';

export type PriorityType =
  | 'survival'
  | 'growth'
  | 'happiness'
  | 'defense'
  | 'prosperity'
  | 'culture'
  | 'tradition'
  | 'innovation';

// ============================================================================
// VILLAGE GAME STATE EXTENSION
// ============================================================================

/**
 * Village-specific game state extends base GameState
 */
export interface VillageGameState extends GameState {
  villageId: string;

  // Time progression
  gameDay: number;
  season: SeasonInfo;
  weather: WeatherState;

  // Resource flows
  dailyProduction: Record<ResourceType, number>;
  dailyConsumption: Record<ResourceType, number>;
  resourceAlerts: ResourceAlert[];

  // Population state
  populationGrowth: number; // This month
  happinessChange: number; // This month

  // Active management
  activeProjects: Project[];
  queuedActions: QueuedAction[];

  // Crisis management
  activeCrises: string[]; // Event IDs
  crisisResponse: CrisisResponse[];

  // Long-term planning
  developmentGoals: DevelopmentGoal[];

  // AI state
  aiDecisions: AIDecision[];
  lastAIEvent: Date;
}

export interface ResourceAlert {
  resource: ResourceType;
  type: 'shortage' | 'surplus' | 'quality_drop' | 'spoilage';
  severity: 'low' | 'medium' | 'high' | 'critical';
  estimatedTimeToImpact: number; // Days
  recommendedActions: string[];
}

export interface Project {
  id: string;
  name: string;
  type: ProjectType;

  // Project details
  description: string;
  objectives: ProjectObjective[];

  // Resource requirements
  totalCost: ResourceCost[];
  progressCost: ResourceCost[]; // Cost per day of work

  // Timeline
  estimatedDuration: number; // Days
  actualDuration?: number;
  startDate: Date;
  completionDate?: Date;

  // Progress
  progress: number; // 0-100
  currentPhase: string;

  // Management
  assignedWorkers: Worker[];
  priority: number; // 0-100

  // Results
  benefits: ProjectBenefit[];
  actualResults?: ProjectResult[];
}

export type ProjectType =
  | 'construction'
  | 'research'
  | 'infrastructure'
  | 'social'
  | 'economic'
  | 'military';

export interface ProjectObjective {
  description: string;
  completed: boolean;
  completionDate?: Date;
}

export interface ProjectBenefit {
  type: 'building' | 'technology' | 'bonus' | 'unlock';
  description: string;
  quantification?: number;
}

export interface ProjectResult {
  objective: string;
  achieved: boolean;
  variance: number; // -100 to 100, how much better/worse than expected
  unexpectedBenefits: string[];
  unexpectedCosts: string[];
}

export interface QueuedAction {
  id: string;
  type: ActionType;
  description: string;
  scheduledDate: Date;
  priority: number;
  cost: ResourceCost[];
  expectedResults: string[];
}

export type ActionType =
  | 'build'
  | 'upgrade'
  | 'demolish'
  | 'hire'
  | 'fire'
  | 'trade'
  | 'research'
  | 'celebrate';

export interface CrisisResponse {
  crisisEventId: string;
  responseId: string;
  implementedAt: Date;

  // Response tracking
  progress: number; // 0-100
  estimatedCompletion: Date;
  actualCompletion?: Date;

  // Effectiveness
  effectivenessRating?: number; // 0-100, assessed after completion
  lessons: string[];
}

export interface DevelopmentGoal {
  id: string;
  name: string;
  category: GoalCategory;

  // Goal definition
  description: string;
  targetMetrics: GoalMetric[];
  deadline?: Date;

  // Progress tracking
  progress: number; // 0-100
  currentStatus: string;

  // Requirements
  prerequisites: GoalPrerequisite[];
  requiredResources: ResourceCost[];

  // Benefits
  rewards: GoalReward[];

  // Management
  priority: number; // 0-100
  assignedLeader?: string; // Resident ID

  createdAt: Date;
  updatedAt: Date;
}

export type GoalCategory =
  | 'population'
  | 'economic'
  | 'infrastructure'
  | 'cultural'
  | 'military'
  | 'environmental';

export interface GoalMetric {
  name: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  progress: number; // 0-100
}

export interface GoalPrerequisite {
  type: 'building' | 'population' | 'resource' | 'technology' | 'event';
  requirement: string;
  completed: boolean;
}

export interface GoalReward {
  type: 'resource' | 'building' | 'technology' | 'bonus' | 'recognition';
  description: string;
  value: number | string;
}

export interface AIDecision {
  id: string;
  timestamp: Date;
  type: 'build' | 'hire' | 'trade' | 'respond_to_event' | 'set_policy';

  // Decision context
  situation: string;
  options: AIOption[];
  chosenOption: string;

  // Decision reasoning
  reasoning: string;
  confidence: number; // 0-100
  expectedOutcome: string;

  // Results
  actualOutcome?: string;
  success?: boolean;
  lessonsLearned?: string[];
}

export interface AIOption {
  id: string;
  description: string;
  estimatedCost: ResourceCost[];
  estimatedBenefits: string[];
  riskLevel: number; // 0-100
  aiScore: number; // AI's evaluation of this option
}

// ============================================================================
// VILLAGE CONFIGURATION
// ============================================================================

export interface VillageConfig extends GameConfig {
  // Initial setup
  startingSize: VillageSize;
  startingPopulation: number;
  startingResources: Record<ResourceType, number>;
  location: VillageLocation;

  // Gameplay settings
  realTimeProgression: boolean;
  dayLength: number; // Real minutes per game day
  seasonLength: number; // Game days per season

  // Difficulty settings
  resourceScarcity: number; // 0-100
  eventFrequency: number; // 0-100
  crisisIntensity: number; // 0-100

  // AI behavior
  aiPersonality: VillagePersonality;
  aiFrequency: number; // Actions per day
  aiCreativity: number; // 0-100

  // Features
  enableWeather: boolean;
  enableSeasons: boolean;
  enableEvents: boolean;
  enableTrading: boolean;
  enablePopulationGrowth: boolean;

  // Victory conditions
  victoryConditions: VictoryCondition[];
  gameLength?: number; // Days, undefined = endless
}

export interface VictoryCondition {
  type: 'population' | 'prosperity' | 'happiness' | 'stability' | 'custom';
  target: number;
  description: string;
  timeLimit?: number; // Days
}

// ============================================================================
// NPC BEHAVIOR SYSTEM TYPES
// ============================================================================

/**
 * Enhanced NPC type extending Resident with behavior-specific properties
 */
export interface NPC extends Resident {
  // Current behavioral state
  currentAction?: NPCAction;
  behaviorTree?: string; // ID of active behavior tree

  // Memory and learning
  memories?: MemoryEntry[];
  learningRate: number; // 0-100, how quickly NPC adapts

  // Social behavior
  socialEnergy: number; // 0-100, current desire to socialize
  workEthic: number; // 0-100, dedication to work

  // Crisis response
  stressLevel: number; // 0-100, current stress from events
  adaptability: number; // 0-100, how well NPC handles change
}

export interface NPCAction {
  id: string;
  type:
    | 'work'
    | 'socialize'
    | 'rest'
    | 'learn'
    | 'trade'
    | 'help'
    | 'celebrate'
    | 'respond_crisis';
  description: string;
  duration: number; // Hours
  location?: string; // Building ID or location name
  targetNPC?: string; // For social interactions
  priority: number; // 0-100
  requirements?: ActionRequirement[];
  effects?: ActionEffect[];
}

export interface ActionRequirement {
  type: 'skill' | 'resource' | 'location' | 'relationship' | 'time';
  target: string;
  value: number | string;
}

export interface ActionEffect {
  type: 'happiness' | 'skill' | 'relationship' | 'resource' | 'reputation';
  target?: string; // Specific target if applicable
  modifier: number;
  description: string;
}

export interface VillageContext {
  village: Village;
  gameState: VillageGameState;
  currentTime: Date;
  weather: WeatherState;
  activeEvents: VillageEvent[];
}

export interface DialogueContext {
  topic: string;
  location: string;
  timeOfDay: number;
  urgency?: 'low' | 'normal' | 'high' | 'critical';
  recentEvents?: VillageEvent[];
  villageMood?: string;
  season?: SeasonType;
  activeCrises?: VillageEvent[];
}

export interface Interaction {
  id: string;
  type:
    | 'greeting'
    | 'request'
    | 'trade'
    | 'gossip'
    | 'complaint'
    | 'compliment'
    | 'quest';
  playerId: string;
  npcId: string;
  description: string;
  timestamp: Date;
  context?: Record<string, any>;
}

export interface InteractionResult {
  success: boolean;
  response: string;
  npcStateChanges?: Record<string, any>;
  relationshipChange?: number;
  consequences?: string[];
  newMemory?: MemoryEntry;
}

export interface MemoryEntry {
  id: string;
  type: 'interaction' | 'event' | 'observation' | 'emotion';
  content: string;
  importance: number; // 0-100
  timestamp: Date;
  associatedNPCs?: string[];
  emotionalImpact: number; // -50 to +50
  decayRate: number; // How quickly this memory fades
}

export interface RelationshipUpdate {
  npcId: string;
  targetId: string; // Another NPC or player
  type: 'friendship' | 'rivalry' | 'romance' | 'professional' | 'family';
  change: number; // -10 to +10
  reason: string;
  timestamp: Date;
}

// ============================================================================
// AI RESPONSE DATA INTERFACES
// ============================================================================

export interface NPCBehavior {
  readonly npcId: string;
  readonly name: string;
  readonly action:
    | 'work'
    | 'rest'
    | 'socialize'
    | 'complain'
    | 'celebrate'
    | 'migrate';
  readonly description: string;
  readonly mood: 'happy' | 'neutral' | 'sad' | 'angry' | 'excited' | 'worried';
  readonly reasoning: string;
  readonly effects: NPCEffect[];
  readonly duration: number; // hours
}

export interface NPCEffect {
  readonly type: 'resource' | 'happiness' | 'productivity' | 'relationship';
  readonly target?: string; // specific target if applicable
  readonly modifier: number;
  readonly description: string;
}

export interface ResourceEvent {
  readonly id: string;
  readonly name: string;
  readonly type:
    | 'discovery'
    | 'depletion'
    | 'trade_opportunity'
    | 'price_change'
    | 'spoilage';
  readonly resourceType: ResourceType;
  readonly description: string;
  readonly effects: ResourceEventEffect[];
  readonly duration: number; // days
  readonly isPositive: boolean;
}

export interface ResourceEventEffect {
  readonly type: 'quantity' | 'quality' | 'price' | 'availability';
  readonly modifier: number;
  readonly description: string;
}

// Validation schemas for AI response data
export const NPCBehaviorSchema = z.object({
  npcId: z.string(),
  name: z.string().min(1).max(100),
  action: z.enum([
    'work',
    'rest',
    'socialize',
    'complain',
    'celebrate',
    'migrate',
  ]),
  description: z.string().min(10).max(500),
  mood: z.enum(['happy', 'neutral', 'sad', 'angry', 'excited', 'worried']),
  reasoning: z.string().min(5).max(300),
  effects: z.array(
    z.object({
      type: z.enum(['resource', 'happiness', 'productivity', 'relationship']),
      target: z.string().optional(),
      modifier: z.number(),
      description: z.string(),
    })
  ),
  duration: z.number().min(1).max(24),
});

export const ResourceEventSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  type: z.enum([
    'discovery',
    'depletion',
    'trade_opportunity',
    'price_change',
    'spoilage',
  ]),
  resourceType: z.enum([
    'food',
    'wood',
    'stone',
    'metal',
    'gold',
    'population',
    'happiness',
    'knowledge',
  ]),
  description: z.string().min(10).max(500),
  effects: z.array(
    z.object({
      type: z.enum(['quantity', 'quality', 'price', 'availability']),
      modifier: z.number(),
      description: z.string(),
    })
  ),
  duration: z.number().min(1),
  isPositive: z.boolean(),
});

export const VillageEventSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().min(10).max(1000),
  type: z.enum([
    'natural',
    'economic',
    'social',
    'military',
    'technological',
    'political',
    'cultural',
    'supernatural',
  ]),
  effects: z.array(z.any()),
  duration: z.number().min(1),
  isActive: z.boolean(),
  createdAt: z.number(),
});
