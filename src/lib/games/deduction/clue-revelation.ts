/**
 * Progressive Clue Revelation System for RpgAInfinity Deduction Game
 *
 * This module provides advanced clue revelation mechanics including:
 * - Progressive revelation based on game state and conditions
 * - Investigation mechanics for detective/investigative roles
 * - Dynamic clue unlocking and timing optimization
 * - Player-triggered clue discoveries
 * - Automated atmospheric clue reveals
 * - Chain revelation mechanics for connected clues
 */

import { z } from 'zod';
import {
  Clue,
  ClueReveal,
  ClueImpact,
  GameContext,
  InvestigationClue,
  NarrativeClue,
} from './clues';
import { clueGenerator } from './clues';
import { clueValidator } from './clue-validation';
import {
  DeductionGameState,
  DeductionPlayer,
  ClueCard,
  ClueRevealCondition,
  GamePhaseEvent,
  UUID,
  Timestamp,
} from '../../../types/deduction';
import { GameError } from '../../../types/core';
import { kvService } from '../../database/kv-service';

// ============================================================================
// REVELATION SYSTEM INTERFACES
// ============================================================================

export interface RevelationManager {
  checkRevealConditions(
    clue: Clue,
    gameState: DeductionGameState
  ): Promise<boolean>;
  revealClue(
    clueId: UUID,
    gameId: UUID,
    triggeredBy?: UUID
  ): Promise<ClueReveal>;
  scheduleReveal(
    clue: Clue,
    gameId: UUID,
    conditions: ClueRevealCondition[]
  ): Promise<void>;
  processAutomaticReveals(gameState: DeductionGameState): Promise<ClueReveal[]>;
}

export interface InvestigationSystem {
  conductInvestigation(
    investigator: DeductionPlayer,
    target: DeductionPlayer,
    gameState: DeductionGameState
  ): Promise<InvestigationResult>;
  getAvailableInvestigations(
    player: DeductionPlayer,
    gameState: DeductionGameState
  ): Promise<InvestigationOption[]>;
  processInvestigationResult(
    result: InvestigationResult,
    gameId: UUID
  ): Promise<ClueReveal>;
}

export interface InvestigationResult {
  readonly investigatorId: UUID;
  readonly targetId: UUID;
  readonly method: InvestigationMethod;
  readonly findings: InvestigationFinding[];
  readonly reliability: number;
  readonly cost: InvestigationCost;
  readonly success: boolean;
  readonly timestamp: Timestamp;
  readonly generatedClue?: InvestigationClue;
}

export interface InvestigationOption {
  readonly method: InvestigationMethod;
  readonly targetId: UUID;
  readonly cost: InvestigationCost;
  readonly expectedReliability: number;
  readonly description: string;
  readonly requirements: string[];
  readonly cooldown: number; // rounds before can use again
}

export interface InvestigationFinding {
  readonly type:
    | 'role_information'
    | 'alignment_hint'
    | 'ability_evidence'
    | 'behavioral_pattern'
    | 'connection_revealed';
  readonly content: string;
  readonly confidence: number; // 0-1
  readonly verifiable: boolean;
  readonly implications: string[];
}

export interface InvestigationCost {
  readonly actionPoints?: number;
  readonly timeSlots?: number;
  readonly resources?: Record<string, number>;
  readonly risk?: InvestigationRisk;
}

export interface InvestigationRisk {
  readonly exposureChance: number; // 0-1 chance of being detected
  readonly consequences: string[];
  readonly mitigation: string[];
}

export type InvestigationMethod =
  | 'direct_questioning'
  | 'behavioral_observation'
  | 'alliance_analysis'
  | 'voting_pattern_analysis'
  | 'communication_monitoring'
  | 'role_ability_usage'
  | 'forensic_analysis'
  | 'psychological_profiling';

export interface RevealTrigger {
  readonly type:
    | 'automatic'
    | 'investigation'
    | 'vote_pattern'
    | 'elimination'
    | 'ability_usage'
    | 'time_based';
  readonly condition: string;
  readonly probability: number;
  readonly delay?: number; // rounds to delay after condition is met
}

export interface ClueChain {
  readonly chainId: UUID;
  readonly title: string;
  readonly description: string;
  readonly clues: UUID[];
  readonly revealOrder: 'sequential' | 'conditional' | 'simultaneous';
  readonly narrativeProgression: string[];
  readonly completionReward?: ChainCompletionReward;
}

export interface ChainCompletionReward {
  readonly type:
    | 'information'
    | 'ability'
    | 'narrative'
    | 'strategic_advantage';
  readonly description: string;
  readonly effect: Record<string, any>;
}

export interface AtmosphericReveal {
  readonly trigger:
    | 'phase_change'
    | 'tension_increase'
    | 'elimination'
    | 'stalemate';
  readonly conditions: string[];
  readonly clueTypes: string[];
  readonly frequency: number; // per game
  readonly narrativeWeight: number;
}

// ============================================================================
// CORE REVELATION ENGINE
// ============================================================================

/**
 * Comprehensive clue revelation system with dynamic mechanics
 */
export class ClueRevelationManager implements RevelationManager {
  private static instance: ClueRevelationManager;
  private readonly cachePrefix = 'revelation:';
  private readonly cacheTTL = 24 * 60 * 60; // 24 hours

  public static getInstance(): ClueRevelationManager {
    if (!ClueRevelationManager.instance) {
      ClueRevelationManager.instance = new ClueRevelationManager();
    }
    return ClueRevelationManager.instance;
  }

  /**
   * Check if clue reveal conditions are met
   */
  async checkRevealConditions(
    clue: Clue,
    gameState: DeductionGameState
  ): Promise<boolean> {
    try {
      if (clue.isRevealed) {
        return false; // Already revealed
      }

      if (clue.revealConditions.length === 0) {
        return true; // No conditions, can always reveal
      }

      for (const condition of clue.revealConditions) {
        const conditionMet = await this.evaluateRevealCondition(
          condition,
          gameState
        );
        if (conditionMet) {
          // Check probability if specified
          if (condition.probability && condition.probability < Math.random()) {
            continue;
          }
          return true;
        }
      }

      return false;
    } catch (error) {
      //TODO: Implement proper error logging service
      return false; // Default to not revealing on error
    }
  }

  /**
   * Reveal a specific clue with full narrative integration
   */
  async revealClue(
    clueId: UUID,
    gameId: UUID,
    triggeredBy?: UUID
  ): Promise<ClueReveal> {
    try {
      const clue = await this.getClueFromStorage(clueId);
      if (!clue) {
        throw new GameError('clue_not_found', `Clue ${clueId} not found`);
      }

      const gameState = await this.getGameState(gameId);

      // Validate reveal is allowed
      const canReveal = await this.checkRevealConditions(clue, gameState);
      if (!canReveal && !triggeredBy) {
        throw new GameError(
          'reveal_conditions_not_met',
          'Clue reveal conditions not met'
        );
      }

      // Generate contextual narrative
      const narrativeText = await this.generateRevealNarrative(
        clue,
        gameState,
        triggeredBy
      );

      // Calculate clue impact
      const impact = await this.calculateRevealImpact(clue, gameState);

      // Create reveal record
      const reveal: ClueReveal = {
        clueId,
        revealedTo: triggeredBy ? (triggeredBy as UUID) : 'all',
        revealedBy: triggeredBy,
        revealMethod: this.determineRevealMethod(clue, triggeredBy, gameState),
        timestamp: new Date().toISOString() as Timestamp,
        narrativeText,
        impact,
      };

      // Update clue state
      await this.markClueAsRevealed(clueId, reveal);

      // Update game state
      await this.updateGameStateWithReveal(gameId, reveal);

      // Process chain reveals if applicable
      await this.processChainReveals(clue, gameState, reveal);

      // Schedule follow-up reveals if needed
      await this.scheduleFollowUpReveals(clue, gameState);

      return reveal;
    } catch (error) {
      throw new GameError(
        'clue_reveal_failed',
        `Failed to reveal clue ${clueId}`,
        {
          clueId,
          gameId,
          triggeredBy,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );
    }
  }

  /**
   * Schedule a clue reveal based on conditions
   */
  async scheduleReveal(
    clue: Clue,
    gameId: UUID,
    conditions: ClueRevealCondition[]
  ): Promise<void> {
    try {
      const scheduledReveal = {
        clueId: clue.id,
        gameId,
        conditions,
        scheduledAt: new Date().toISOString(),
        priority: this.calculateRevealPriority(clue, conditions),
      };

      const cacheKey = this.buildScheduleCacheKey(gameId);
      const existingSchedule = (await kvService.get<any[]>(cacheKey)) || [];
      existingSchedule.push(scheduledReveal);

      await kvService.set(cacheKey, existingSchedule, this.cacheTTL);
    } catch (error) {
      //TODO: Add proper error handling and logging
    }
  }

  /**
   * Process all automatic reveals for current game state
   */
  async processAutomaticReveals(
    gameState: DeductionGameState
  ): Promise<ClueReveal[]> {
    try {
      const reveals: ClueReveal[] = [];
      const cacheKey = this.buildScheduleCacheKey(gameState.id);
      const scheduledReveals = (await kvService.get<any[]>(cacheKey)) || [];

      for (const scheduled of scheduledReveals) {
        const clue = await this.getClueFromStorage(scheduled.clueId);
        if (clue && !clue.isRevealed) {
          const canReveal = await this.checkRevealConditions(clue, gameState);
          if (canReveal) {
            const reveal = await this.revealClue(
              scheduled.clueId,
              gameState.id,
              undefined
            );
            reveals.push(reveal);
          }
        }
      }

      // Process atmospheric reveals
      const atmosphericReveals =
        await this.processAtmosphericReveals(gameState);
      reveals.push(...atmosphericReveals);

      return reveals;
    } catch (error) {
      //TODO: Implement proper error logging service
      return [];
    }
  }

  // ============================================================================
  // PRIVATE REVELATION METHODS
  // ============================================================================

  private async evaluateRevealCondition(
    condition: ClueRevealCondition,
    gameState: DeductionGameState
  ): Promise<boolean> {
    switch (condition.type) {
      case 'round_number':
        return this.evaluateRoundCondition(
          condition.condition,
          gameState.data.round
        );

      case 'player_eliminated':
        return this.evaluateEliminationCondition(
          condition.condition,
          gameState
        );

      case 'ability_used':
        return this.evaluateAbilityCondition(condition.condition, gameState);

      case 'vote_pattern':
        return this.evaluateVotingCondition(condition.condition, gameState);

      case 'random':
        return Math.random() < (condition.probability || 0.5);

      default:
        return false;
    }
  }

  private evaluateRoundCondition(
    condition: string,
    currentRound: number
  ): boolean {
    // Parse conditions like "round >= 3", "round = 5", etc.
    const match = condition.match(/round\s*([>=<]+)\s*(\d+)/);
    if (!match) return false;

    const operator = match[1];
    const targetRound = parseInt(match[2]);

    switch (operator) {
      case '>=':
        return currentRound >= targetRound;
      case '>':
        return currentRound > targetRound;
      case '<=':
        return currentRound <= targetRound;
      case '<':
        return currentRound < targetRound;
      case '=':
        return currentRound === targetRound;
      default:
        return false;
    }
  }

  private evaluateEliminationCondition(
    condition: string,
    gameState: DeductionGameState
  ): boolean {
    const eliminatedCount = gameState.data.eliminatedPlayers.length;

    // Parse conditions like "eliminated >= 1", "town_eliminated >= 2", etc.
    const match = condition.match(/([\w_]+)\s*([>=<]+)\s*(\d+)/);
    if (!match) return false;

    const target = match[1];
    const operator = match[2];
    const count = parseInt(match[3]);

    let actualCount = 0;
    if (target === 'eliminated') {
      actualCount = eliminatedCount;
    } else if (target === 'town_eliminated' || target === 'mafia_eliminated') {
      // Would need to track alignment of eliminated players
      actualCount = Math.floor(eliminatedCount / 2); // Simplified
    }

    switch (operator) {
      case '>=':
        return actualCount >= count;
      case '>':
        return actualCount > count;
      case '<=':
        return actualCount <= count;
      case '<':
        return actualCount < count;
      case '=':
        return actualCount === count;
      default:
        return false;
    }
  }

  private evaluateAbilityCondition(
    condition: string,
    gameState: DeductionGameState
  ): boolean {
    // Check if specific abilities have been used
    return gameState.data.events.some(
      event =>
        event.type === 'ability_used' &&
        event.description.toLowerCase().includes(condition.toLowerCase())
    );
  }

  private evaluateVotingCondition(
    condition: string,
    gameState: DeductionGameState
  ): boolean {
    // Evaluate voting pattern conditions
    if (!gameState.data.votingResults) return false;

    const votes = gameState.data.votingResults.votes;

    if (condition.includes('unanimous') && votes.length > 0) {
      const firstTarget = votes[0].targetId;
      return votes.every(vote => vote.targetId === firstTarget);
    }

    if (condition.includes('tie')) {
      return gameState.data.votingResults.tiebreaker !== undefined;
    }

    if (condition.includes('no_lynch')) {
      return gameState.data.votingResults.eliminated.length === 0;
    }

    return false;
  }

  private async generateRevealNarrative(
    clue: Clue,
    gameState: DeductionGameState,
    triggeredBy?: UUID
  ): Promise<string> {
    try {
      // Use AI to generate contextual narrative
      const narrativePrompt = {
        clueTitle: clue.title,
        clueContent: clue.content,
        clueType: clue.type,
        gamePhase: gameState.phase,
        currentRound: gameState.data.round,
        theme: gameState.data.scenario.theme,
        setting: gameState.data.scenario.setting,
        revealMethod: triggeredBy ? 'investigation' : 'discovery',
        tension: this.calculateGameTension(gameState),
      };

      // This would call the AI service to generate narrative
      // For now, using fallback templates
      return this.generateFallbackNarrative(clue, gameState, triggeredBy);
    } catch (error) {
      return this.generateFallbackNarrative(clue, gameState, triggeredBy);
    }
  }

  private generateFallbackNarrative(
    clue: Clue,
    gameState: DeductionGameState,
    triggeredBy?: UUID
  ): string {
    const templates = {
      investigation: [
        `Through careful investigation, you discover: ${clue.content}`,
        `Your investigation reveals important information: ${clue.content}`,
        `Diligent inquiry brings to light: ${clue.content}`,
      ],
      automatic: [
        `As events unfold, it becomes clear that: ${clue.content}`,
        `The situation reveals: ${clue.content}`,
        `Circumstances bring to light: ${clue.content}`,
      ],
      atmospheric: [
        `The atmosphere grows tense as you realize: ${clue.content}`,
        `A chill runs through the group as someone notices: ${clue.content}`,
        `The air becomes thick with suspicion when: ${clue.content}`,
      ],
    };

    const method = triggeredBy ? 'investigation' : 'automatic';
    const templateArray = templates[method] || templates.automatic;

    return templateArray[Math.floor(Math.random() * templateArray.length)];
  }

  private async calculateRevealImpact(
    clue: Clue,
    gameState: DeductionGameState
  ): Promise<ClueImpact> {
    const impact: ClueImpact = {
      suspicionChanges: {},
      newInvestigationTargets: clue.targetPlayers,
      strategicValue: this.determineStrategicValue(clue, gameState),
      narrativeProgressions: [`"${clue.title}" has been revealed`],
      followUpClues: clue.relatedClues,
    };

    // Calculate suspicion changes based on clue content and targets
    clue.targetPlayers.forEach(playerId => {
      const suspicionChange = this.calculateSuspicionChange(
        clue,
        playerId,
        gameState
      );
      if (suspicionChange !== 0) {
        impact.suspicionChanges[playerId] = suspicionChange;
      }
    });

    // Add narrative progressions based on clue type
    if (clue.type === 'environmental') {
      impact.narrativeProgressions.push(
        `The atmosphere becomes more ${this.getAtmosphericDescriptor(clue)}`
      );
    } else if (clue.type === 'action_evidence') {
      impact.narrativeProgressions.push(
        'New evidence shifts the investigation'
      );
    }

    return impact;
  }

  private determineStrategicValue(
    clue: Clue,
    gameState: DeductionGameState
  ): 'game_changing' | 'significant' | 'moderate' | 'minor' | 'negligible' {
    const alivePlayerCount = gameState.data.alivePlayers.length;
    const informationDensity = clue.informationValue / 10;
    const gameProgression = gameState.data.round / 10; // Assume max ~10 rounds

    if (clue.informationValue >= 9 && alivePlayerCount <= 4) {
      return 'game_changing';
    } else if (
      clue.informationValue >= 7 ||
      (clue.type === 'red_herring' && clue.misdirectionLevel >= 8)
    ) {
      return 'significant';
    } else if (clue.informationValue >= 5) {
      return 'moderate';
    } else if (clue.informationValue >= 3) {
      return 'minor';
    } else {
      return 'negligible';
    }
  }

  private calculateSuspicionChange(
    clue: Clue,
    playerId: UUID,
    gameState: DeductionGameState
  ): number {
    let suspicionChange = 0;

    // Base suspicion change on clue type and information value
    switch (clue.type) {
      case 'role_hint':
      case 'action_evidence':
        suspicionChange = clue.informationValue * 0.1;
        break;
      case 'behavioral':
        suspicionChange = clue.informationValue * 0.08;
        break;
      case 'red_herring':
        suspicionChange = clue.misdirectionLevel * 0.12;
        break;
      default:
        suspicionChange = clue.informationValue * 0.05;
    }

    // Adjust based on clue reliability
    if (clue.reliability === 'misleading') {
      suspicionChange *= -0.5; // Reduce suspicion for misleading clues
    } else if (clue.reliability === 'unreliable') {
      suspicionChange *= 0.7;
    }

    return Math.round(suspicionChange * 100) / 100; // Round to 2 decimal places
  }

  private getAtmosphericDescriptor(clue: Clue): string {
    const descriptors = [
      'tense',
      'mysterious',
      'suspicious',
      'ominous',
      'uncertain',
    ];
    return descriptors[Math.floor(Math.random() * descriptors.length)];
  }

  private determineRevealMethod(
    clue: Clue,
    triggeredBy?: UUID,
    gameState?: DeductionGameState
  ):
    | 'investigation'
    | 'automatic'
    | 'death'
    | 'vote_pattern'
    | 'special_ability' {
    if (triggeredBy) {
      return 'investigation';
    }

    // Determine based on clue properties and game state
    if (clue.revealConditions.some(c => c.type === 'player_eliminated')) {
      return 'death';
    } else if (clue.revealConditions.some(c => c.type === 'vote_pattern')) {
      return 'vote_pattern';
    } else if (clue.revealConditions.some(c => c.type === 'ability_used')) {
      return 'special_ability';
    } else {
      return 'automatic';
    }
  }

  private async markClueAsRevealed(
    clueId: UUID,
    reveal: ClueReveal
  ): Promise<void> {
    const cacheKey = this.buildClueCacheKey(clueId);
    const clue = await kvService.get<Clue>(cacheKey);

    if (clue) {
      const updatedClue = {
        ...clue,
        isRevealed: true,
        revealedAt: reveal.timestamp,
        revealedBy: reveal.revealedBy,
      };

      await kvService.set(cacheKey, updatedClue, this.cacheTTL);
    }
  }

  private async updateGameStateWithReveal(
    gameId: UUID,
    reveal: ClueReveal
  ): Promise<void> {
    // Update the game state to reflect the new revelation
    // This would integrate with the main game state management system
    //TODO: Implement game state update integration
  }

  private async processChainReveals(
    clue: Clue,
    gameState: DeductionGameState,
    reveal: ClueReveal
  ): Promise<void> {
    // Process any chained clue reveals triggered by this revelation
    for (const relatedClueId of clue.relatedClues) {
      const relatedClue = await this.getClueFromStorage(relatedClueId);
      if (relatedClue && !relatedClue.isRevealed) {
        // Check if this reveal triggers the related clue
        const shouldReveal = await this.checkChainRevealCondition(
          clue,
          relatedClue,
          gameState
        );
        if (shouldReveal) {
          // Schedule the related clue for revelation
          await this.scheduleReveal(relatedClue, gameState.id, [
            {
              type: 'round_number',
              condition: `round >= ${gameState.data.round}`,
              probability: 0.8,
            },
          ]);
        }
      }
    }
  }

  private async checkChainRevealCondition(
    triggerClue: Clue,
    targetClue: Clue,
    gameState: DeductionGameState
  ): Promise<boolean> {
    // Simple logic: reveal related clues if they're of complementary types
    const complementaryTypes = [
      ['role_hint', 'behavioral'],
      ['action_evidence', 'relationship'],
      ['environmental', 'red_herring'],
    ];

    return complementaryTypes.some(
      ([type1, type2]) =>
        (triggerClue.type === type1 && targetClue.type === type2) ||
        (triggerClue.type === type2 && targetClue.type === type1)
    );
  }

  private async scheduleFollowUpReveals(
    clue: Clue,
    gameState: DeductionGameState
  ): Promise<void> {
    // Schedule follow-up atmospheric or investigative clues based on this reveal
    if (clue.strategicValue === 'game_changing') {
      // Create a follow-up atmospheric clue
      const followUpClues = await clueGenerator.createNarrativeClues(gameState);

      for (const followUpClue of followUpClues) {
        await this.scheduleReveal(followUpClue, gameState.id, [
          {
            type: 'round_number',
            condition: `round >= ${gameState.data.round + 1}`,
            probability: 0.6,
          },
        ]);
      }
    }
  }

  private calculateRevealPriority(
    clue: Clue,
    conditions: ClueRevealCondition[]
  ): number {
    let priority = clue.informationValue;

    // Increase priority for high-value clues
    if (clue.informationValue > 7) priority += 3;

    // Increase priority for clues with restrictive conditions
    if (
      conditions.some(
        c => c.type === 'ability_used' || c.type === 'player_eliminated'
      )
    ) {
      priority += 2;
    }

    // Decrease priority for red herrings
    if (clue.type === 'red_herring') priority -= 2;

    return Math.max(1, priority);
  }

  private async processAtmosphericReveals(
    gameState: DeductionGameState
  ): Promise<ClueReveal[]> {
    const reveals: ClueReveal[] = [];

    // Generate atmospheric reveals based on game state
    const tension = this.calculateGameTension(gameState);

    if (tension > 0.7 && Math.random() < 0.3) {
      // High tension might trigger an atmospheric reveal
      const atmosphericClues =
        await clueGenerator.createNarrativeClues(gameState);

      for (const clue of atmosphericClues.slice(0, 1)) {
        // Limit to 1 atmospheric reveal
        const reveal = await this.revealClue(clue.id, gameState.id, undefined);
        reveals.push(reveal);
      }
    }

    return reveals;
  }

  private calculateGameTension(gameState: DeductionGameState): number {
    const totalPlayers =
      gameState.data.alivePlayers.length +
      gameState.data.eliminatedPlayers.length;
    const eliminationRatio =
      gameState.data.eliminatedPlayers.length / totalPlayers;
    const roundProgression = Math.min(1, gameState.data.round / 8); // Assume ~8 rounds max

    // Tension increases with eliminations and round progression
    return Math.min(1, eliminationRatio * 0.6 + roundProgression * 0.4);
  }

  // ============================================================================
  // INVESTIGATION SYSTEM IMPLEMENTATION
  // ============================================================================

  async conductInvestigation(
    investigator: DeductionPlayer,
    target: DeductionPlayer,
    gameState: DeductionGameState
  ): Promise<InvestigationResult> {
    try {
      // Get investigator's abilities
      const investigativeAbilities =
        investigator.gameSpecificData.role.abilities.filter(
          ability => ability.ability.type === 'investigate'
        );

      if (investigativeAbilities.length === 0) {
        throw new GameError(
          'no_investigation_ability',
          'Player lacks investigation abilities'
        );
      }

      const ability = investigativeAbilities[0]; // Use first available ability
      const method = this.mapAbilityToInvestigationMethod(ability.ability.name);

      // Calculate investigation reliability
      const reliability = this.calculateInvestigationReliability(
        ability,
        investigator,
        target,
        gameState
      );

      // Generate investigation findings
      const findings = await this.generateInvestigationFindings(
        investigator,
        target,
        method,
        reliability,
        gameState
      );

      // Calculate investigation cost
      const cost = this.calculateInvestigationCost(method, ability);

      // Create investigation result
      const result: InvestigationResult = {
        investigatorId: investigator.id as UUID,
        targetId: target.id as UUID,
        method,
        findings,
        reliability,
        cost,
        success: findings.length > 0,
        timestamp: new Date().toISOString() as Timestamp,
        generatedClue: await this.convertFindingsToClue(
          findings,
          investigator,
          target,
          gameState
        ),
      };

      return result;
    } catch (error) {
      throw new GameError(
        'investigation_failed',
        `Investigation by ${investigator.name} of ${target.name} failed`,
        {
          investigatorId: investigator.id,
          targetId: target.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );
    }
  }

  async getAvailableInvestigations(
    player: DeductionPlayer,
    gameState: DeductionGameState
  ): Promise<InvestigationOption[]> {
    const options: InvestigationOption[] = [];

    // Get player's investigative abilities
    const investigativeAbilities =
      player.gameSpecificData.role.abilities.filter(
        ability => ability.ability.type === 'investigate' && !ability.isBlocked
      );

    for (const ability of investigativeAbilities) {
      const method = this.mapAbilityToInvestigationMethod(ability.ability.name);

      // Get potential targets
      const potentialTargets = gameState.data.alivePlayers
        .filter(playerId => playerId !== player.id)
        .slice(0, 3); // Limit options to prevent overwhelming

      for (const targetId of potentialTargets) {
        const cost = this.calculateInvestigationCost(method, ability);

        options.push({
          method,
          targetId: targetId as UUID,
          cost,
          expectedReliability: this.estimateReliability(ability, method),
          description: this.generateInvestigationDescription(method, ability),
          requirements: this.getInvestigationRequirements(method, ability),
          cooldown: ability.lastUsedRound
            ? ability.lastUsedRound + 1 - gameState.data.round
            : 0,
        });
      }
    }

    return options;
  }

  async processInvestigationResult(
    result: InvestigationResult,
    gameId: UUID
  ): Promise<ClueReveal> {
    try {
      if (!result.generatedClue) {
        throw new GameError(
          'no_clue_generated',
          'Investigation did not generate a clue'
        );
      }

      // Reveal the investigation clue
      const reveal = await this.revealClue(
        result.generatedClue.id,
        gameId as UUID,
        result.investigatorId
      );

      return reveal;
    } catch (error) {
      throw new GameError(
        'investigation_processing_failed',
        'Failed to process investigation result',
        {
          resultId: `${result.investigatorId}-${result.targetId}`,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );
    }
  }

  // ============================================================================
  // PRIVATE INVESTIGATION METHODS
  // ============================================================================

  private mapAbilityToInvestigationMethod(
    abilityName: string
  ): InvestigationMethod {
    const methodMap: Record<string, InvestigationMethod> = {
      investigate: 'direct_questioning',
      observe: 'behavioral_observation',
      analyze: 'voting_pattern_analysis',
      probe: 'psychological_profiling',
      track: 'communication_monitoring',
      examine: 'forensic_analysis',
    };

    const normalizedName = abilityName.toLowerCase();
    for (const [key, method] of Object.entries(methodMap)) {
      if (normalizedName.includes(key)) {
        return method;
      }
    }

    return 'direct_questioning'; // Default method
  }

  private calculateInvestigationReliability(
    ability: any,
    investigator: DeductionPlayer,
    target: DeductionPlayer,
    gameState: DeductionGameState
  ): number {
    let baseReliability = 0.7; // Base reliability

    // Adjust based on investigator's role type
    if (
      investigator.gameSpecificData.role.definition.type === 'investigative'
    ) {
      baseReliability += 0.15;
    }

    // Adjust based on target's defensive abilities
    const targetDefensiveAbilities =
      target.gameSpecificData.role.abilities.filter(
        ability =>
          ability.ability.type === 'block' || ability.ability.type === 'protect'
      );

    if (targetDefensiveAbilities.length > 0) {
      baseReliability -= 0.1;
    }

    // Adjust based on game phase
    if (gameState.phase === 'night_actions') {
      baseReliability += 0.1; // Easier to investigate at night
    }

    // Adjust based on remaining uses
    if (ability.remainingUses <= 1) {
      baseReliability += 0.05; // Desperation bonus
    }

    return Math.max(0.1, Math.min(0.95, baseReliability));
  }

  private async generateInvestigationFindings(
    investigator: DeductionPlayer,
    target: DeductionPlayer,
    method: InvestigationMethod,
    reliability: number,
    gameState: DeductionGameState
  ): Promise<InvestigationFinding[]> {
    const findings: InvestigationFinding[] = [];

    // Generate findings based on investigation method
    switch (method) {
      case 'direct_questioning':
        findings.push(...this.generateQuestioningFindings(target, reliability));
        break;

      case 'behavioral_observation':
        findings.push(
          ...this.generateBehavioralFindings(target, reliability, gameState)
        );
        break;

      case 'voting_pattern_analysis':
        findings.push(
          ...this.generateVotingFindings(target, reliability, gameState)
        );
        break;

      case 'psychological_profiling':
        findings.push(...this.generateProfileFindings(target, reliability));
        break;

      default:
        findings.push(...this.generateGenericFindings(target, reliability));
    }

    return findings.filter(finding => finding.confidence >= 0.3); // Filter low-confidence findings
  }

  private generateQuestioningFindings(
    target: DeductionPlayer,
    reliability: number
  ): InvestigationFinding[] {
    const findings: InvestigationFinding[] = [];
    const targetRole = target.gameSpecificData.role.definition;

    // Role information finding
    if (reliability > 0.6) {
      const roleLeak = reliability > 0.8 ? 'strong' : 'weak';
      findings.push({
        type: 'role_information',
        content: `Target shows ${roleLeak} signs of being a ${targetRole.type} type role`,
        confidence: reliability * 0.9,
        verifiable: false,
        implications: [
          `Target may have ${targetRole.type} abilities`,
          'Consider cross-referencing with known roles',
        ],
      });
    }

    // Alignment hint
    if (reliability > 0.5) {
      const alignment =
        targetRole.alignment === 'town' ? 'trustworthy' : 'suspicious';
      findings.push({
        type: 'alignment_hint',
        content: `Target's responses suggest they are ${alignment}`,
        confidence: reliability * 0.8,
        verifiable: false,
        implications: [
          `Target likely aligned with ${alignment === 'trustworthy' ? 'town' : 'hostile'} faction`,
        ],
      });
    }

    return findings;
  }

  private generateBehavioralFindings(
    target: DeductionPlayer,
    reliability: number,
    gameState: DeductionGameState
  ): InvestigationFinding[] {
    const findings: InvestigationFinding[] = [];
    const actionHistory = target.gameSpecificData.actionHistory;

    if (actionHistory.length > 0 && reliability > 0.5) {
      const recentActions = actionHistory.slice(-3);
      findings.push({
        type: 'behavioral_pattern',
        content: `Target shows ${recentActions.length > 2 ? 'high' : 'low'} activity levels with ${Math.random() > 0.5 ? 'defensive' : 'aggressive'} tendencies`,
        confidence: reliability * 0.7,
        verifiable: true,
        implications: [
          'Pattern suggests specific role archetype',
          'Behavior may indicate alignment',
        ],
      });
    }

    return findings;
  }

  private generateVotingFindings(
    target: DeductionPlayer,
    reliability: number,
    gameState: DeductionGameState
  ): InvestigationFinding[] {
    const findings: InvestigationFinding[] = [];

    if (gameState.data.votingResults && reliability > 0.4) {
      const targetVotes = gameState.data.votingResults.votes.filter(
        vote => vote.voterId === target.id
      );

      if (targetVotes.length > 0) {
        findings.push({
          type: 'behavioral_pattern',
          content: `Target's voting pattern shows ${targetVotes.length > 1 ? 'consistent' : 'inconsistent'} decision-making`,
          confidence: reliability * 0.6,
          verifiable: true,
          implications: [
            'Voting pattern may reveal alliances',
            'Consider pressure tactics',
          ],
        });
      }
    }

    return findings;
  }

  private generateProfileFindings(
    target: DeductionPlayer,
    reliability: number
  ): InvestigationFinding[] {
    const findings: InvestigationFinding[] = [];
    const suspicionLevel =
      Object.values(target.gameSpecificData.suspicions).reduce(
        (sum, val) => sum + val,
        0
      ) / Object.keys(target.gameSpecificData.suspicions).length || 0;

    if (reliability > 0.5) {
      findings.push({
        type: 'behavioral_pattern',
        content: `Psychological profile suggests ${suspicionLevel > 0.6 ? 'high stress' : 'normal behavior'} patterns`,
        confidence: reliability * 0.75,
        verifiable: false,
        implications: [
          'Profile indicates potential deception',
          'Consider pressure-based strategies',
        ],
      });
    }

    return findings;
  }

  private generateGenericFindings(
    target: DeductionPlayer,
    reliability: number
  ): InvestigationFinding[] {
    return [
      {
        type: 'role_information',
        content: `Investigation yields ${reliability > 0.7 ? 'conclusive' : 'inconclusive'} information about target`,
        confidence: reliability,
        verifiable: false,
        implications: [
          'Further investigation recommended',
          'Consider alternative approaches',
        ],
      },
    ];
  }

  private calculateInvestigationCost(
    method: InvestigationMethod,
    ability: any
  ): InvestigationCost {
    const baseCosts: Record<InvestigationMethod, InvestigationCost> = {
      direct_questioning: {
        actionPoints: 1,
        timeSlots: 1,
        risk: {
          exposureChance: 0.3,
          consequences: ['Target becomes suspicious'],
          mitigation: ['Use during day phase'],
        },
      },
      behavioral_observation: {
        actionPoints: 1,
        timeSlots: 2,
        risk: {
          exposureChance: 0.1,
          consequences: ['Low exposure risk'],
          mitigation: ['Passive observation'],
        },
      },
      voting_pattern_analysis: {
        actionPoints: 2,
        timeSlots: 1,
        risk: { exposureChance: 0.0, consequences: [], mitigation: [] },
      },
      psychological_profiling: {
        actionPoints: 2,
        timeSlots: 2,
        risk: {
          exposureChance: 0.2,
          consequences: ['Requires expertise'],
          mitigation: ['Use investigative role abilities'],
        },
      },
      communication_monitoring: {
        actionPoints: 1,
        timeSlots: 3,
        risk: {
          exposureChance: 0.4,
          consequences: ['May be detected'],
          mitigation: ['Use during night phase'],
        },
      },
      forensic_analysis: {
        actionPoints: 3,
        timeSlots: 1,
        risk: {
          exposureChance: 0.1,
          consequences: ['Requires evidence'],
          mitigation: ['Thorough preparation'],
        },
      },
      alliance_analysis: {
        actionPoints: 2,
        timeSlots: 2,
        risk: {
          exposureChance: 0.2,
          consequences: ['May reveal alliances'],
          mitigation: ['Discrete observation'],
        },
      },
      role_ability_usage: {
        actionPoints: 1,
        timeSlots: 1,
        risk: {
          exposureChance: 0.5,
          consequences: ['Reveals investigative role'],
          mitigation: ['Use sparingly'],
        },
      },
    };

    return baseCosts[method] || baseCosts['direct_questioning'];
  }

  private estimateReliability(
    ability: any,
    method: InvestigationMethod
  ): number {
    const baseReliabilities: Record<InvestigationMethod, number> = {
      direct_questioning: 0.6,
      behavioral_observation: 0.7,
      voting_pattern_analysis: 0.8,
      psychological_profiling: 0.5,
      communication_monitoring: 0.6,
      forensic_analysis: 0.9,
      alliance_analysis: 0.7,
      role_ability_usage: 0.8,
    };

    return baseReliabilities[method] || 0.6;
  }

  private generateInvestigationDescription(
    method: InvestigationMethod,
    ability: any
  ): string {
    const descriptions: Record<InvestigationMethod, string> = {
      direct_questioning: 'Ask direct questions to gather information',
      behavioral_observation: 'Observe target behavior patterns for clues',
      voting_pattern_analysis: 'Analyze voting history for alignment hints',
      psychological_profiling: 'Create psychological profile of target',
      communication_monitoring:
        'Monitor communications for suspicious activity',
      forensic_analysis: 'Analyze evidence for conclusive proof',
      alliance_analysis: 'Study relationships and alliances',
      role_ability_usage: 'Use role-specific investigation abilities',
    };

    return descriptions[method] || 'Investigate target using available methods';
  }

  private getInvestigationRequirements(
    method: InvestigationMethod,
    ability: any
  ): string[] {
    const requirements: Record<InvestigationMethod, string[]> = {
      direct_questioning: ['Target must be alive', 'Day phase preferred'],
      behavioral_observation: ['At least 2 rounds of history'],
      voting_pattern_analysis: ['Previous voting records required'],
      psychological_profiling: ['Investigative role recommended'],
      communication_monitoring: [
        'Night phase required',
        'Special ability needed',
      ],
      forensic_analysis: ['Physical evidence required'],
      alliance_analysis: ['Multiple players data needed'],
      role_ability_usage: ['Role-specific ability available'],
    };

    return requirements[method] || ['No special requirements'];
  }

  private async convertFindingsToClue(
    findings: InvestigationFinding[],
    investigator: DeductionPlayer,
    target: DeductionPlayer,
    gameState: DeductionGameState
  ): Promise<InvestigationClue | undefined> {
    if (findings.length === 0) {
      return undefined;
    }

    // Combine findings into a coherent clue
    const combinedContent = findings.map(f => f.content).join('. ');
    const averageConfidence =
      findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length;
    const allImplications = findings.flatMap(f => f.implications);

    const clue: InvestigationClue = {
      id: crypto.randomUUID() as UUID,
      title: `Investigation Result: ${target.name}`,
      content: combinedContent,
      type: 'action_evidence',
      reliability:
        averageConfidence > 0.7
          ? 'reliable'
          : averageConfidence > 0.4
            ? 'unreliable'
            : 'misleading',
      revealConditions: [],
      isRevealed: false,
      targetPlayers: [target.id as UUID],
      verifiability: findings.some(f => f.verifiable)
        ? 'easily_verified'
        : 'hard_to_verify',
      informationValue: Math.round(averageConfidence * 10),
      misdirectionLevel: 0,
      narrativeWeight: 4,
      difficulty: averageConfidence > 0.8 ? 'easy' : 'medium',
      tags: ['investigation', 'evidence', target.name],
      relatedClues: [],
      gameContext: {
        scenario: gameState.data.scenario.name,
        theme: gameState.data.scenario.theme,
        playerCount:
          gameState.data.alivePlayers.length +
          gameState.data.eliminatedPlayers.length,
        round: gameState.data.round,
        phase: gameState.phase,
        alivePlayerCount: gameState.data.alivePlayers.length,
        eliminatedRoles: [],
        revealedInformation: [],
      },
      investigationDetails: {
        method:
          findings[0]?.type === 'role_information'
            ? 'interrogation'
            : 'observation',
        investigatorRole: investigator.gameSpecificData.role.definition.name,
        targetRole: target.gameSpecificData.role.definition.name,
        reliability: averageConfidence,
        limitations: [
          'Based on investigation method',
          'Subject to interpretation',
        ],
        followUpActions: allImplications.slice(0, 3),
      },
    };

    // Store the clue
    await kvService.set(this.buildClueCacheKey(clue.id), clue, this.cacheTTL);

    return clue;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private buildCacheKey(type: string, identifier: string): string {
    return `${this.cachePrefix}${type}:${identifier}`;
  }

  private buildClueCacheKey(clueId: UUID): string {
    return this.buildCacheKey('clue', clueId);
  }

  private buildScheduleCacheKey(gameId: UUID): string {
    return this.buildCacheKey('schedule', gameId);
  }

  private async getClueFromStorage(clueId: UUID): Promise<Clue | null> {
    return await kvService.get<Clue>(this.buildClueCacheKey(clueId));
  }

  private async getGameState(gameId: UUID): Promise<DeductionGameState> {
    // This would integrate with the main game state management system
    // For now, return a mock game state
    //TODO: Implement proper game state retrieval
    throw new GameError(
      'not_implemented',
      'Game state retrieval not implemented'
    );
  }
}

// Export singleton instance
export const clueRevelationManager = ClueRevelationManager.getInstance();
