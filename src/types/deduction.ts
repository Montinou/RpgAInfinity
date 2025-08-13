/**
 * Deduction game type definitions for RpgAInfinity
 * Social deduction game mechanics with dynamic roles and AI-generated scenarios
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
// DEDUCTION GAME CONFIGURATION
// ============================================================================

export interface DeductionConfig extends GameConfig {
  readonly type: 'deduction';
  readonly settings: {
    readonly theme: string; // e.g., "medieval", "space", "modern", "fantasy"
    readonly scenario: DeductionScenario;
    readonly duration: 'short' | 'medium' | 'long'; // 15min, 30min, 60min
    readonly discussionTimePerRound: number; // minutes
    readonly votingTimeLimit: number; // minutes
    readonly allowsWhispering: boolean;
    readonly revealRolesOnDeath: boolean;
    readonly allowsLastWords: boolean;
    readonly enableClues: boolean;
    readonly difficultyModifiers: DifficultyModifier[];
  };
}

export const DeductionConfigSchema = z.object({
  type: z.literal('deduction'),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  maxPlayers: z.number().int().min(4).max(20),
  minPlayers: z.number().int().min(4).max(20),
  estimatedDurationMinutes: z.number().int().min(15).max(120),
  isPrivate: z.boolean(),
  settings: z.object({
    theme: z.string().min(1).max(100),
    scenario: z.enum([
      'mafia',
      'werewolf',
      'space_station',
      'medieval_court',
      'custom',
    ]),
    duration: z.enum(['short', 'medium', 'long']),
    discussionTimePerRound: z.number().int().min(3).max(30),
    votingTimeLimit: z.number().int().min(1).max(10),
    allowsWhispering: z.boolean(),
    revealRolesOnDeath: z.boolean(),
    allowsLastWords: z.boolean(),
    enableClues: z.boolean(),
    difficultyModifiers: z.array(z.any()),
  }),
});

// ============================================================================
// SCENARIO & THEME SYSTEM
// ============================================================================

export type DeductionScenario =
  | 'mafia'
  | 'werewolf'
  | 'space_station'
  | 'medieval_court'
  | 'custom';

export interface ScenarioData {
  readonly id: UUID;
  readonly name: string;
  readonly theme: string;
  readonly description: string;
  readonly setting: string;
  readonly lore: string;
  readonly availableRoles: RoleDefinition[];
  readonly winConditions: WinCondition[];
  readonly customRules: CustomRule[];
  readonly flavorText: FlavorText;
}

export interface FlavorText {
  readonly introduction: string;
  readonly dayPhaseStart: string;
  readonly nightPhaseStart: string;
  readonly eliminationText: string;
  readonly victoryTexts: Record<RoleAlignment, string>;
  readonly roleRevealTexts: Record<string, string>; // Role name -> reveal text
}

export interface CustomRule {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly affects:
    | 'voting'
    | 'night_actions'
    | 'discussion'
    | 'win_conditions';
  readonly parameters: Record<string, JSONValue>;
}

export interface DifficultyModifier {
  readonly type: 'information' | 'time' | 'actions' | 'roles';
  readonly name: string;
  readonly description: string;
  readonly effect: Record<string, JSONValue>;
}

// ============================================================================
// ROLE SYSTEM
// ============================================================================

export type RoleAlignment = 'town' | 'mafia' | 'neutral' | 'survivor';
export type RoleType =
  | 'investigative'
  | 'killing'
  | 'protective'
  | 'support'
  | 'power'
  | 'vanilla';

export interface RoleDefinition {
  readonly id: string;
  readonly name: string;
  readonly alignment: RoleAlignment;
  readonly type: RoleType;
  readonly description: string;
  readonly abilities: RoleAbility[];
  readonly restrictions: RoleRestriction[];
  readonly winCondition: string;
  readonly flavorText: string;
  readonly rarity: 'common' | 'uncommon' | 'rare' | 'unique';
  readonly requiresMinPlayers: number;
}

export interface RoleAbility {
  readonly name: string;
  readonly type: AbilityType;
  readonly description: string;
  readonly usageLimit: UsageLimit;
  readonly timing: AbilityTiming;
  readonly target: TargetType;
  readonly effects: AbilityEffect[];
  readonly conditions?: AbilityCondition[];
}

export type AbilityType =
  | 'investigate'
  | 'kill'
  | 'protect'
  | 'block'
  | 'redirect'
  | 'communicate'
  | 'vote_modify'
  | 'information'
  | 'passive';

export type AbilityTiming =
  | 'day'
  | 'night'
  | 'voting'
  | 'passive'
  | 'death'
  | 'anytime';
export type TargetType =
  | 'self'
  | 'other_player'
  | 'any_player'
  | 'dead_player'
  | 'alive_player'
  | 'none';

export interface UsageLimit {
  readonly type:
    | 'unlimited'
    | 'per_game'
    | 'per_night'
    | 'per_day'
    | 'one_time';
  readonly count?: number;
}

export interface AbilityEffect {
  readonly type:
    | 'learn_alignment'
    | 'learn_role'
    | 'kill'
    | 'protect'
    | 'block'
    | 'redirect'
    | 'modify_vote';
  readonly value?: JSONValue;
  readonly duration?: 'immediate' | 'next_phase' | 'permanent';
}

export interface AbilityCondition {
  readonly type:
    | 'player_count'
    | 'day_number'
    | 'alive_players'
    | 'alignment_count';
  readonly operator: '>' | '<' | '=' | '>=' | '<=';
  readonly value: number | string;
}

export interface RoleRestriction {
  readonly type:
    | 'cannot_target'
    | 'cannot_use_consecutive'
    | 'requires_alive'
    | 'custom';
  readonly description: string;
  readonly parameters: Record<string, JSONValue>;
}

// ============================================================================
// PLAYER ASSIGNMENT & STATUS
// ============================================================================

export interface DeductionPlayer extends Player {
  readonly gameSpecificData: {
    readonly role: AssignedRole;
    readonly status: PlayerStatus;
    readonly votingPower: number;
    readonly clues: ClueCard[];
    readonly suspicions: Record<UUID, number>; // Player ID -> suspicion level
    readonly communications: Communication[];
    readonly actionHistory: DeductionAction[];
    readonly isRevealed: boolean;
  };
}

export interface AssignedRole {
  readonly definition: RoleDefinition;
  readonly secretInfo: string[]; // Information only this role knows
  readonly teammates?: UUID[]; // For mafia/cultist type roles
  readonly abilities: ActiveAbility[];
  readonly objectives: RoleObjective[];
}

export interface ActiveAbility {
  readonly ability: RoleAbility;
  readonly remainingUses: number;
  readonly isBlocked: boolean;
  readonly lastUsedRound?: number;
}

export interface RoleObjective {
  readonly id: string;
  readonly description: string;
  readonly type: 'eliminate' | 'survive' | 'discover' | 'protect' | 'convert';
  readonly target?: string; // Role name, alignment, or specific condition
  readonly isCompleted: boolean;
  readonly points: number; // For scoring
}

export type PlayerStatus =
  | 'alive'
  | 'eliminated'
  | 'protected'
  | 'blocked'
  | 'suspicious';

// ============================================================================
// GAME PHASES & ROUNDS
// ============================================================================

export type DeductionPhase =
  | 'role_assignment'
  | 'day_discussion'
  | 'day_voting'
  | 'night_actions'
  | 'game_over';

export interface DeductionGameState extends GameState {
  readonly phase: DeductionPhase;
  readonly data: {
    readonly scenario: ScenarioData;
    readonly round: number;
    readonly timeRemaining: number; // seconds
    readonly alivePlayers: UUID[];
    readonly eliminatedPlayers: UUID[];
    readonly votingResults?: VotingResults;
    readonly nightActions: NightAction[];
    readonly cluesAvailable: ClueCard[];
    readonly events: GamePhaseEvent[];
    readonly winCondition?: WinCondition;
    readonly winner?: RoleAlignment | UUID;
  };
}

export interface GamePhaseEvent {
  readonly id: UUID;
  readonly type:
    | 'elimination'
    | 'ability_used'
    | 'clue_revealed'
    | 'phase_change'
    | 'victory';
  readonly description: string;
  readonly timestamp: Timestamp;
  readonly affectedPlayers: UUID[];
  readonly isPublic: boolean;
  readonly flavorText?: string;
}

// ============================================================================
// VOTING SYSTEM
// ============================================================================

export interface VotingResults {
  readonly round: number;
  readonly votes: Vote[];
  readonly eliminated: UUID[];
  readonly tiebreaker?: TiebreakResult;
  readonly abstentions: UUID[];
  readonly votingPowerUsed: Record<UUID, number>;
}

export interface Vote {
  readonly voterId: UUID;
  readonly targetId: UUID | 'abstain' | 'no_lynch';
  readonly timestamp: Timestamp;
  readonly votingPower: number;
  readonly isSecret: boolean;
}

export interface TiebreakResult {
  readonly method:
    | 'random'
    | 'previous_votes'
    | 'special_ability'
    | 'no_elimination';
  readonly eliminated?: UUID;
  readonly explanation: string;
}

export interface VotingAction extends GameAction {
  readonly type: 'vote' | 'unvote' | 'abstain';
  readonly data: {
    readonly targetId: UUID | 'abstain' | 'no_lynch';
    readonly reason?: string;
    readonly isSecret?: boolean;
  };
}

// ============================================================================
// NIGHT ACTIONS & ABILITIES
// ============================================================================

export interface NightAction {
  readonly id: UUID;
  readonly actorId: UUID;
  readonly ability: string; // Ability name
  readonly targetId?: UUID;
  readonly parameters?: Record<string, JSONValue>;
  readonly result?: NightActionResult;
  readonly isResolved: boolean;
  readonly priority: number; // Lower number = higher priority
}

export interface NightActionResult {
  readonly success: boolean;
  readonly information?: string; // For investigative abilities
  readonly effects: string[]; // What happened
  readonly blockedBy?: UUID; // Player who blocked this action
  readonly redirectedTo?: UUID; // If action was redirected
}

export interface NightActionSchema extends GameAction {
  readonly type: 'use_ability';
  readonly data: {
    readonly abilityName: string;
    readonly targetId?: UUID;
    readonly parameters?: Record<string, JSONValue>;
  };
}

// ============================================================================
// CLUE SYSTEM
// ============================================================================

export interface ClueCard {
  readonly id: UUID;
  readonly title: string;
  readonly content: string;
  readonly type: ClueType;
  readonly reliability: 'reliable' | 'unreliable' | 'misleading';
  readonly revealConditions: ClueRevealCondition[];
  readonly affectedPlayers?: UUID[];
  readonly isRevealed: boolean;
  readonly revealedAt?: Timestamp;
  readonly revealedBy?: UUID;
}

export type ClueType =
  | 'role_hint'
  | 'alignment_hint'
  | 'action_evidence'
  | 'relationship'
  | 'behavioral'
  | 'environmental'
  | 'red_herring';

export interface ClueRevealCondition {
  readonly type:
    | 'round_number'
    | 'player_eliminated'
    | 'ability_used'
    | 'vote_pattern'
    | 'random';
  readonly condition: string;
  readonly probability?: number; // For random reveals
}

// ============================================================================
// COMMUNICATION SYSTEM
// ============================================================================

export interface Communication {
  readonly id: UUID;
  readonly from: UUID;
  readonly to: UUID | 'all' | 'team';
  readonly type: CommunicationType;
  readonly content: string;
  readonly timestamp: Timestamp;
  readonly isPublic: boolean;
  readonly phase: DeductionPhase;
  readonly round: number;
}

export type CommunicationType =
  | 'public_message'
  | 'whisper'
  | 'team_chat'
  | 'last_words'
  | 'vote_declaration';

export interface CommunicationAction extends GameAction {
  readonly type: 'send_message' | 'whisper';
  readonly data: {
    readonly recipient: UUID | 'all' | 'team';
    readonly message: string;
    readonly communicationType: CommunicationType;
  };
}

// ============================================================================
// WIN CONDITIONS
// ============================================================================

export interface WinCondition {
  readonly id: string;
  readonly alignment: RoleAlignment;
  readonly type:
    | 'eliminate_all'
    | 'survive_to_end'
    | 'complete_objectives'
    | 'majority_control';
  readonly description: string;
  readonly requirements: WinRequirement[];
  readonly priority: number; // For resolving conflicting wins
}

export interface WinRequirement {
  readonly type:
    | 'player_count'
    | 'alignment_count'
    | 'role_alive'
    | 'objectives_complete'
    | 'rounds_survived';
  readonly operator: '>' | '<' | '=' | '>=' | '<=';
  readonly value: number | string;
  readonly alignment?: RoleAlignment;
  readonly role?: string;
}

// ============================================================================
// DEDUCTION ACTION TYPES
// ============================================================================

export interface DeductionAction extends GameAction {
  readonly type: DeductionActionType;
}

export type DeductionActionType =
  | 'vote'
  | 'unvote'
  | 'abstain'
  | 'use_ability'
  | 'send_message'
  | 'whisper'
  | 'reveal_clue'
  | 'make_accusation'
  | 'request_vote_count';

export interface AccusationAction extends GameAction {
  readonly type: 'make_accusation';
  readonly data: {
    readonly accusedId: UUID;
    readonly suspectedRole?: string;
    readonly reasoning: string;
    readonly confidence: 1 | 2 | 3 | 4 | 5; // Confidence level
  };
}

// ============================================================================
// GAME STATISTICS & ANALYTICS
// ============================================================================

export interface GameStatistics {
  readonly gameId: UUID;
  readonly duration: number; // minutes
  readonly totalRounds: number;
  readonly winner: RoleAlignment | 'draw';
  readonly playerStats: PlayerGameStats[];
  readonly roleBalance: RoleBalanceStats[];
  readonly votingPatterns: VotingPattern[];
  readonly abilityUsage: AbilityUsageStats[];
  readonly communicationStats: CommunicationStats;
}

export interface PlayerGameStats {
  readonly playerId: UUID;
  readonly role: string;
  readonly alignment: RoleAlignment;
  readonly survived: boolean;
  readonly correctVotes: number;
  readonly incorrectVotes: number;
  readonly abilitiesUsed: number;
  readonly messagessSent: number;
  readonly suspicionAccuracy: number; // 0-1
  readonly influence: number; // How much they influenced the game
  readonly performance: 'excellent' | 'good' | 'average' | 'poor';
}

export interface RoleBalanceStats {
  readonly role: string;
  readonly timesAssigned: number;
  readonly winRate: number;
  readonly averageSurvivalTime: number;
  readonly abilityEffectiveness: number;
}

export interface VotingPattern {
  readonly round: number;
  readonly bandwagonEffect: boolean; // Did votes cluster quickly?
  readonly splitVotes: number; // How many different targets received votes
  readonly lastMinuteChanges: number;
  readonly abstentionRate: number;
}

export interface AbilityUsageStats {
  readonly ability: string;
  readonly timesUsed: number;
  readonly successRate: number;
  readonly gameImpact: 'high' | 'medium' | 'low';
  readonly blockRate: number; // How often this ability was blocked
}

export interface CommunicationStats {
  readonly totalMessages: number;
  readonly averageMessageLength: number;
  readonly whispersCount: number;
  readonly teamChatCount: number;
  readonly toxicityDetected: boolean;
  readonly participationRate: number; // Percentage of players who sent messages
}

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

export const RoleDefinitionSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(50),
  alignment: z.enum(['town', 'mafia', 'neutral', 'survivor']),
  type: z.enum([
    'investigative',
    'killing',
    'protective',
    'support',
    'power',
    'vanilla',
  ]),
  description: z.string().max(500),
  abilities: z.array(z.any()),
  restrictions: z.array(z.any()),
  winCondition: z.string().max(200),
  flavorText: z.string().max(500),
  rarity: z.enum(['common', 'uncommon', 'rare', 'unique']),
  requiresMinPlayers: z.number().int().min(4).max(20),
});

export const VotingActionSchema = z.object({
  id: UUIDSchema,
  type: z.enum(['vote', 'unvote', 'abstain']),
  playerId: UUIDSchema,
  gameId: UUIDSchema,
  timestamp: TimestampSchema,
  data: z.object({
    targetId: z.union([
      UUIDSchema,
      z.literal('abstain'),
      z.literal('no_lynch'),
    ]),
    reason: z.string().max(200).optional(),
    isSecret: z.boolean().optional(),
  }),
  metadata: z.record(JSONValueSchema).optional(),
});

export const CommunicationActionSchema = z.object({
  id: UUIDSchema,
  type: z.enum(['send_message', 'whisper']),
  playerId: UUIDSchema,
  gameId: UUIDSchema,
  timestamp: TimestampSchema,
  data: z.object({
    recipient: z.union([UUIDSchema, z.literal('all'), z.literal('team')]),
    message: z.string().min(1).max(1000),
    communicationType: z.enum([
      'public_message',
      'whisper',
      'team_chat',
      'last_words',
      'vote_declaration',
    ]),
  }),
  metadata: z.record(JSONValueSchema).optional(),
});

export const AccusationActionSchema = z.object({
  id: UUIDSchema,
  type: z.literal('make_accusation'),
  playerId: UUIDSchema,
  gameId: UUIDSchema,
  timestamp: TimestampSchema,
  data: z.object({
    accusedId: UUIDSchema,
    suspectedRole: z.string().max(50).optional(),
    reasoning: z.string().min(10).max(500),
    confidence: z.number().int().min(1).max(5),
  }),
  metadata: z.record(JSONValueSchema).optional(),
});

// ============================================================================
// AI RESPONSE DATA INTERFACES
// ============================================================================

export interface ClueData {
  readonly content: string;
  readonly type:
    | 'observation'
    | 'deduction'
    | 'evidence'
    | 'rumor'
    | 'confession';
  readonly reliability: number; // 0-1, how reliable this clue is
  readonly relatedEntities: string[]; // Players or roles this clue relates to
  readonly isPublic: boolean; // Whether this clue is visible to all players
  readonly source?: string; // Who or what provided this clue
  readonly consequences: string[]; // What might happen if this clue is acted upon
}

export interface RoleAssignment {
  readonly playerId: string;
  readonly roleName: string;
  readonly alignment: RoleAlignment;
  readonly description: string;
  readonly abilities: string[];
  readonly winCondition: string;
  readonly secretInformation?: string;
}

export interface VotingResult {
  readonly targetId: string;
  readonly targetName: string;
  readonly voteCount: number;
  readonly outcome: 'eliminated' | 'saved' | 'tied' | 'no_lynch';
  readonly reasoning: string;
  readonly finalVotes: Record<string, string>; // playerId -> targetId
}

// Validation schemas for AI response data
export const ClueDataSchema = z.object({
  content: z.string().min(5).max(500),
  type: z.enum(['observation', 'deduction', 'evidence', 'rumor', 'confession']),
  reliability: z.number().min(0).max(1),
  relatedEntities: z.array(z.string()),
  isPublic: z.boolean(),
  source: z.string().optional(),
  consequences: z.array(z.string()),
});

export const RoleAssignmentSchema = z.object({
  playerId: z.string(),
  roleName: z.string().min(1).max(50),
  alignment: z.enum(['town', 'mafia', 'neutral', 'survivor']),
  description: z.string().min(10).max(500),
  abilities: z.array(z.string()),
  winCondition: z.string().min(10).max(200),
  secretInformation: z.string().optional(),
});

export const VotingResultSchema = z.object({
  targetId: z.string(),
  targetName: z.string(),
  voteCount: z.number().min(0),
  outcome: z.enum(['eliminated', 'saved', 'tied', 'no_lynch']),
  reasoning: z.string().min(10).max(500),
  finalVotes: z.record(z.string()),
});
