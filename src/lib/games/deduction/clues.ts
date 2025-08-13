/**
 * Comprehensive Clue Generation System for RpgAInfinity Deduction Game
 *
 * This module provides advanced clue generation capabilities including:
 * - AI-powered clue creation using Claude API
 * - Progressive revelation and investigation mechanics
 * - Clue validation and coherence checking
 * - Narrative integration and theme consistency
 * - Dynamic clue difficulty balancing
 * - Red herring generation for strategic misdirection
 */

import { z } from 'zod';
import {
  ClueCard,
  ClueType,
  ClueRevealCondition,
  DeductionGameState,
  DeductionPlayer,
  ScenarioData,
  RoleDefinition,
  GamePhaseEvent,
  UUID,
  ClueData,
  ClueDataSchema,
} from '../../../types/deduction';
import { Player, GameState, GameError, Timestamp } from '../../../types/core';
import { generateDeductionContent } from '../../ai';
import { kvService } from '../../database/kv-service';

// ============================================================================
// CORE CLUE INTERFACES
// ============================================================================

export interface Clue extends ClueCard {
  // Extended clue properties for advanced mechanics
  readonly targetPlayers: UUID[];
  readonly sourceRole?: string;
  readonly verifiability: 'easily_verified' | 'hard_to_verify' | 'unverifiable';
  readonly informationValue: number; // 1-10 scale of how valuable this clue is
  readonly misdirectionLevel: number; // 0-10 scale for red herrings
  readonly narrativeWeight: number; // Impact on story progression
  readonly difficulty: 'trivial' | 'easy' | 'medium' | 'hard' | 'expert';
  readonly tags: string[]; // For categorization and filtering
  readonly relatedClues: UUID[]; // Connected clues for narrative consistency
  readonly gameContext: ClueGameContext;
}

export interface ClueGameContext {
  readonly scenario: string;
  readonly theme: string;
  readonly playerCount: number;
  readonly round: number;
  readonly phase: string;
  readonly alivePlayerCount: number;
  readonly eliminatedRoles: string[];
  readonly revealedInformation: string[];
}

export interface ClueReveal {
  readonly clueId: UUID;
  readonly revealedTo: UUID | 'all' | UUID[];
  readonly revealedBy?: UUID;
  readonly revealMethod:
    | 'investigation'
    | 'automatic'
    | 'death'
    | 'vote_pattern'
    | 'special_ability';
  readonly timestamp: Timestamp;
  readonly narrativeText: string;
  readonly impact: ClueImpact;
}

export interface ClueImpact {
  readonly suspicionChanges: Record<UUID, number>; // Player ID -> suspicion delta
  readonly newInvestigationTargets: UUID[];
  readonly strategicValue:
    | 'game_changing'
    | 'significant'
    | 'moderate'
    | 'minor'
    | 'negligible';
  readonly narrativeProgressions: string[];
  readonly followUpClues?: UUID[];
}

export interface NarrativeClue extends Clue {
  readonly storyElements: {
    readonly setting: string;
    readonly atmosphere: string;
    readonly characterMoments: string[];
    readonly foreshadowing: string[];
    readonly symbolism?: string;
  };
}

export interface InvestigationClue extends Clue {
  readonly investigationDetails: {
    readonly method:
      | 'interrogation'
      | 'observation'
      | 'deduction'
      | 'evidence_analysis'
      | 'network_analysis';
    readonly investigatorRole: string;
    readonly targetRole?: string;
    readonly reliability: number; // 0-1 based on investigator's ability
    readonly limitations: string[];
    readonly followUpActions: string[];
  };
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly coherenceScore: number; // 0-1
  readonly consistencyIssues: string[];
  readonly recommendations: string[];
  readonly thematicAlignment: number; // 0-1
  readonly balanceImpact: BalanceImpact;
}

export interface BalanceImpact {
  readonly informationAdvantage: Record<string, number>; // Alignment -> advantage
  readonly gameEndProbability: Record<string, number>; // Alignment -> win probability change
  readonly difficultyIncrease: number; // -5 to +5
  readonly strategicComplexity: number; // 1-10
}

export interface GameContext {
  readonly gameId: UUID;
  readonly currentState: DeductionGameState;
  readonly players: DeductionPlayer[];
  readonly revealedClues: ClueCard[];
  readonly gameHistory: GamePhaseEvent[];
  readonly votingHistory: any[]; // TODO: Define proper voting history type
}

// ============================================================================
// CLUE GENERATION CONFIGURATION
// ============================================================================

export interface ClueGenerationConfig {
  readonly theme: string;
  readonly scenario: string;
  readonly playerCount: number;
  readonly difficultyTarget:
    | 'beginner'
    | 'intermediate'
    | 'advanced'
    | 'expert';
  readonly narrativeStyle:
    | 'realistic'
    | 'dramatic'
    | 'mysterious'
    | 'psychological';
  readonly redHerringRatio: number; // 0-1 ratio of misleading clues
  readonly informationDensity: 'sparse' | 'moderate' | 'rich';
  readonly clueInterconnectedness:
    | 'isolated'
    | 'loosely_connected'
    | 'highly_interconnected';
  readonly progressiveReveal: boolean;
  readonly allowPlayerInvestigation: boolean;
  readonly culturalContext: {
    readonly language: string;
    readonly region: string;
    readonly contentRating: 'general' | 'teen' | 'mature';
  };
}

// ============================================================================
// CORE CLUE GENERATOR CLASS
// ============================================================================

/**
 * Advanced clue generation system with AI integration and narrative coherence
 */
export class ClueGenerator {
  private static instance: ClueGenerator;
  private readonly cachePrefix = 'clue:';
  private readonly cacheTTL = 7 * 24 * 60 * 60; // 7 days in seconds

  public static getInstance(): ClueGenerator {
    if (!ClueGenerator.instance) {
      ClueGenerator.instance = new ClueGenerator();
    }
    return ClueGenerator.instance;
  }

  /**
   * Generate comprehensive clues for a deduction scenario
   */
  async generateClues(
    scenario: ScenarioData,
    roles: RoleDefinition[]
  ): Promise<Clue[]> {
    try {
      const cacheKey = this.buildCacheKey('scenario', scenario.id);
      const cached = await kvService.get<Clue[]>(cacheKey);

      if (cached) {
        return cached;
      }

      // Generate different types of clues
      const clueTypes: ClueType[] = [
        'role_hint',
        'alignment_hint',
        'action_evidence',
        'relationship',
        'behavioral',
        'environmental',
        'red_herring',
      ];

      const allClues: Clue[] = [];

      for (const clueType of clueTypes) {
        const cluesForType = await this.generateCluesForType(
          scenario,
          roles,
          clueType
        );
        allClues.push(...cluesForType);
      }

      // Validate clue coherence and balance
      const validatedClues = await this.validateClueSet(
        allClues,
        scenario,
        roles
      );

      // Add narrative interconnections
      const interconnectedClues = await this.createClueConnections(
        validatedClues,
        scenario
      );

      await kvService.set(cacheKey, interconnectedClues, this.cacheTTL);
      return interconnectedClues;
    } catch (error) {
      throw new GameError(
        'clue_generation_failed',
        `Failed to generate clues for scenario ${scenario.name}`,
        {
          scenario: scenario.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );
    }
  }

  /**
   * Reveal a specific clue to players with narrative integration
   */
  async revealClue(
    gameId: string,
    clueId: string,
    playerId?: string
  ): Promise<ClueReveal> {
    try {
      const gameState = await this.getGameContext(gameId);
      const clue = await this.getClue(clueId);

      if (!clue) {
        throw new GameError('clue_not_found', `Clue ${clueId} not found`);
      }

      // Check reveal conditions
      const canReveal = await this.checkRevealConditions(
        clue,
        gameState,
        playerId
      );
      if (!canReveal.allowed) {
        throw new GameError('clue_reveal_not_allowed', canReveal.reason);
      }

      // Generate narrative reveal text
      const narrativeText = await this.generateRevealNarrative(
        clue,
        gameState,
        playerId
      );

      // Calculate clue impact
      const impact = await this.calculateClueImpact(clue, gameState);

      const reveal: ClueReveal = {
        clueId: clueId as UUID,
        revealedTo: playerId ? (playerId as UUID) : 'all',
        revealedBy: playerId as UUID,
        revealMethod: playerId ? 'investigation' : 'automatic',
        timestamp: new Date().toISOString() as Timestamp,
        narrativeText,
        impact,
      };

      // Update game state
      await this.updateGameStateWithReveal(gameId, reveal);

      //TODO: Implement proper error logging service
      return reveal;
    } catch (error) {
      throw new GameError(
        'clue_reveal_failed',
        `Failed to reveal clue ${clueId}`,
        {
          gameId,
          clueId,
          playerId,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );
    }
  }

  /**
   * Validate clue against game context and narrative coherence
   */
  async validateClue(
    clue: Clue,
    context: GameContext
  ): Promise<ValidationResult> {
    try {
      const coherenceScore = await this.calculateCoherenceScore(clue, context);
      const consistencyIssues = await this.checkConsistencyIssues(
        clue,
        context
      );
      const thematicAlignment = await this.calculateThematicAlignment(
        clue,
        context
      );
      const balanceImpact = await this.calculateBalanceImpact(clue, context);

      const result: ValidationResult = {
        valid: coherenceScore > 0.7 && consistencyIssues.length === 0,
        coherenceScore,
        consistencyIssues,
        recommendations: await this.generateRecommendations(clue, context),
        thematicAlignment,
        balanceImpact,
      };

      return result;
    } catch (error) {
      return {
        valid: false,
        coherenceScore: 0,
        consistencyIssues: ['Validation failed due to technical error'],
        recommendations: ['Please regenerate this clue'],
        thematicAlignment: 0,
        balanceImpact: {
          informationAdvantage: {},
          gameEndProbability: {},
          difficultyIncrease: 0,
          strategicComplexity: 1,
        },
      };
    }
  }

  /**
   * Generate investigation results for detective/investigative roles
   */
  async generateInvestigationResult(
    investigator: Player,
    target: Player
  ): Promise<InvestigationClue> {
    try {
      const investigatorData = investigator as DeductionPlayer;
      const targetData = target as DeductionPlayer;

      // Get investigator's abilities and role
      const investigativeAbilities =
        investigatorData.gameSpecificData.role.abilities.filter(
          ability => ability.ability.type === 'investigate'
        );

      if (investigativeAbilities.length === 0) {
        throw new GameError(
          'no_investigation_ability',
          'Player does not have investigation abilities',
          { playerId: investigator.id }
        );
      }

      // Generate investigation clue using AI
      const investigationPrompt = {
        investigatorRole:
          investigatorData.gameSpecificData.role.definition.name,
        targetRole: targetData.gameSpecificData.role.definition.name,
        investigationType: investigativeAbilities[0].ability.name,
        gameContext: await this.buildGameContextForAI(investigator.id),
        narrativeStyle: 'mysterious',
      };

      const aiResult = await generateDeductionContent(
        'clues',
        investigationPrompt
      );

      if (!aiResult.success || !aiResult.response) {
        throw new GameError(
          'ai_investigation_failed',
          'AI investigation generation failed'
        );
      }

      // Parse and structure the investigation result
      const clueData = this.parseAIClueResponse(aiResult.response.content);

      const investigationClue: InvestigationClue = {
        ...(await this.createBaseClue(clueData, 'action_evidence')),
        investigationDetails: {
          method: 'interrogation', // TODO: Determine method from ability type
          investigatorRole:
            investigatorData.gameSpecificData.role.definition.name,
          targetRole: targetData.gameSpecificData.role.definition.name,
          reliability: this.calculateInvestigationReliability(
            investigativeAbilities[0]
          ),
          limitations: this.generateInvestigationLimitations(
            investigativeAbilities[0]
          ),
          followUpActions: this.generateFollowUpActions(
            investigativeAbilities[0]
          ),
        },
      };

      return investigationClue;
    } catch (error) {
      throw new GameError(
        'investigation_clue_generation_failed',
        `Failed to generate investigation result`,
        {
          investigatorId: investigator.id,
          targetId: target.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );
    }
  }

  /**
   * Create narrative clues that advance the story
   */
  async createNarrativeClues(gameState: GameState): Promise<NarrativeClue[]> {
    try {
      const deductionState = gameState as DeductionGameState;

      const narrativePrompt = {
        theme: deductionState.data.scenario.theme,
        currentRound: deductionState.data.round,
        phase: deductionState.phase,
        eliminatedPlayers: deductionState.data.eliminatedPlayers.length,
        recentEvents: deductionState.data.events.slice(-3),
        atmosphericElements: deductionState.data.scenario.setting,
      };

      const aiResult = await generateDeductionContent(
        'narrative',
        narrativePrompt
      );

      if (!aiResult.success || !aiResult.response) {
        return this.generateFallbackNarrativeClues(deductionState);
      }

      const narrativeElements = this.parseNarrativeResponse(
        aiResult.response.content
      );

      const narrativeClues = await Promise.all(
        narrativeElements.map(async (element: any) => {
          const baseClue = await this.createBaseClue(
            element.clueData,
            'environmental'
          );

          const narrativeClue: NarrativeClue = {
            ...baseClue,
            storyElements: {
              setting: element.setting || deductionState.data.scenario.setting,
              atmosphere: element.atmosphere || 'tense',
              characterMoments: element.characterMoments || [],
              foreshadowing: element.foreshadowing || [],
              symbolism: element.symbolism,
            },
          };

          return narrativeClue;
        })
      );

      return narrativeClues;
    } catch (error) {
      //TODO: Implement proper error logging service
      const deductionState = gameState as DeductionGameState;
      return this.generateFallbackNarrativeClues(deductionState);
    }
  }

  /**
   * Update clue relevance based on changing game state
   */
  async updateClueRelevance(
    clues: Clue[],
    gameState: GameState
  ): Promise<Clue[]> {
    try {
      const deductionState = gameState as DeductionGameState;

      const updatedClues = await Promise.all(
        clues.map(async clue => {
          const currentRelevance = await this.calculateCurrentRelevance(
            clue,
            deductionState
          );
          const adjustedInformationValue = this.adjustInformationValue(
            clue,
            deductionState
          );

          return {
            ...clue,
            informationValue: adjustedInformationValue,
            // Update reveal conditions based on current game state
            revealConditions: this.updateRevealConditions(
              clue.revealConditions,
              deductionState
            ),
          };
        })
      );

      return updatedClues;
    } catch (error) {
      //TODO: Add proper error handling and logging
      return clues; // Return original clues if update fails
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private async generateCluesForType(
    scenario: ScenarioData,
    roles: RoleDefinition[],
    clueType: ClueType
  ): Promise<Clue[]> {
    const cluePrompt = this.buildClueTypePrompt(scenario, roles, clueType);

    const aiResult = await generateDeductionContent('clues', cluePrompt, {
      streaming: false,
      optimize: true,
    });

    if (!aiResult.success || !aiResult.response) {
      return this.generateFallbackClues(clueType, scenario, roles);
    }

    return this.parseClueResponse(
      aiResult.response.content,
      clueType,
      scenario
    );
  }

  private buildClueTypePrompt(
    scenario: ScenarioData,
    roles: RoleDefinition[],
    clueType: ClueType
  ) {
    return {
      scenario: scenario.name,
      theme: scenario.theme,
      setting: scenario.setting,
      clueType,
      roles: roles.map(r => ({
        name: r.name,
        alignment: r.alignment,
        type: r.type,
      })),
      playerCount: roles.length,
      lore: scenario.lore,
      customRules: scenario.customRules.map(rule => rule.description),
    };
  }

  private async createBaseClue(
    clueData: ClueData,
    type: ClueType
  ): Promise<Clue> {
    const clueId = crypto.randomUUID() as UUID;

    return {
      id: clueId,
      title: this.generateClueTitle(clueData, type),
      content: clueData.content,
      type,
      reliability:
        clueData.reliability > 0.7
          ? 'reliable'
          : clueData.reliability > 0.4
            ? 'unreliable'
            : 'misleading',
      revealConditions: this.generateDefaultRevealConditions(),
      affectedPlayers: [],
      isRevealed: false,
      targetPlayers: clueData.relatedEntities.map(() =>
        crypto.randomUUID()
      ) as UUID[],
      verifiability: this.determineVerifiability(clueData),
      informationValue: Math.round(clueData.reliability * 10),
      misdirectionLevel:
        type === 'red_herring'
          ? Math.round((1 - clueData.reliability) * 10)
          : 0,
      narrativeWeight: clueData.consequences.length * 2,
      difficulty: this.determineDifficulty(clueData),
      tags: [type, ...clueData.relatedEntities],
      relatedClues: [],
      gameContext: {
        scenario: 'default',
        theme: 'mystery',
        playerCount: 6,
        round: 1,
        phase: 'day_discussion',
        alivePlayerCount: 6,
        eliminatedRoles: [],
        revealedInformation: [],
      },
    };
  }

  private parseAIClueResponse(content: string): ClueData {
    try {
      // Try to extract JSON from the AI response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return ClueDataSchema.parse(parsed);
      }

      // Fallback: create structured data from text
      return {
        content: content.substring(0, 500),
        type: 'observation',
        reliability: 0.7,
        relatedEntities: [],
        isPublic: true,
        consequences: [],
      };
    } catch (error) {
      //TODO: Implement proper error logging service
      return {
        content:
          'A mysterious detail catches your attention, but its significance remains unclear.',
        type: 'observation',
        reliability: 0.5,
        relatedEntities: [],
        isPublic: true,
        consequences: ['Further investigation may be warranted'],
      };
    }
  }

  private parseClueResponse(
    content: string,
    type: ClueType,
    scenario: ScenarioData
  ): Clue[] {
    try {
      // Parse AI response into structured clues
      const clueData = this.parseAIClueResponse(content);

      return [this.createBaseClue(clueData, type)];
    } catch (error) {
      //TODO: Add proper error handling
      return [];
    }
  }

  private generateFallbackClues(
    type: ClueType,
    scenario: ScenarioData,
    roles: RoleDefinition[]
  ): Clue[] {
    const fallbackClues: Record<ClueType, () => string> = {
      role_hint: () =>
        `Someone with unusual knowledge was noticed acting suspiciously around ${scenario.setting}.`,
      alignment_hint: () =>
        'Whispered conversations in the shadows suggest hidden alliances.',
      action_evidence: () =>
        'Physical evidence suggests recent secretive activity.',
      relationship: () =>
        'Certain individuals seem to share unspoken understanding.',
      behavioral: () =>
        'Nervous glances and changed behavior patterns have been observed.',
      environmental: () =>
        `The atmosphere in ${scenario.setting} feels charged with unspoken tensions.`,
      red_herring: () =>
        'Misleading evidence points toward an unlikely suspect.',
    };

    const clueData: ClueData = {
      content: fallbackClues[type]?.() || 'Something important remains hidden.',
      type: 'observation',
      reliability: 0.6,
      relatedEntities: [],
      isPublic: true,
      consequences: [],
    };

    return [this.createBaseClue(clueData, type)];
  }

  private generateFallbackNarrativeClues(
    gameState: DeductionGameState
  ): NarrativeClue[] {
    const fallbackClue: NarrativeClue = {
      id: crypto.randomUUID() as UUID,
      title: 'Atmospheric Tension',
      content: `The atmosphere in ${gameState.data.scenario.setting} grows increasingly tense as suspicions mount.`,
      type: 'environmental',
      reliability: 'reliable',
      revealConditions: [],
      isRevealed: true,
      targetPlayers: [],
      verifiability: 'unverifiable',
      informationValue: 3,
      misdirectionLevel: 0,
      narrativeWeight: 5,
      difficulty: 'easy',
      tags: ['narrative', 'atmosphere'],
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
      storyElements: {
        setting: gameState.data.scenario.setting,
        atmosphere: 'tense and mysterious',
        characterMoments: [],
        foreshadowing: ['The truth may be closer than it appears'],
      },
    };

    return [fallbackClue];
  }

  private buildCacheKey(type: string, identifier: string): string {
    return `${this.cachePrefix}${type}:${identifier}`;
  }

  private async getGameContext(gameId: string): Promise<GameContext> {
    // TODO: Implement proper game state retrieval
    throw new GameError(
      'not_implemented',
      'Game context retrieval not implemented'
    );
  }

  private async getClue(clueId: string): Promise<Clue | null> {
    const cacheKey = this.buildCacheKey('clue', clueId);
    return await kvService.get<Clue>(cacheKey);
  }

  private async checkRevealConditions(
    clue: Clue,
    gameState: GameContext,
    playerId?: string
  ): Promise<{ allowed: boolean; reason: string }> {
    // TODO: Implement comprehensive reveal condition checking
    return { allowed: true, reason: 'Conditions met' };
  }

  private async generateRevealNarrative(
    clue: Clue,
    gameState: GameContext,
    playerId?: string
  ): Promise<string> {
    // Generate contextual narrative for clue reveal
    const templates = [
      `As you investigate further, you discover: ${clue.content}`,
      `A careful observation reveals: ${clue.content}`,
      `Evidence comes to light: ${clue.content}`,
      `Investigation yields important information: ${clue.content}`,
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  private async calculateClueImpact(
    clue: Clue,
    gameState: GameContext
  ): Promise<ClueImpact> {
    return {
      suspicionChanges: {},
      newInvestigationTargets: clue.targetPlayers,
      strategicValue: clue.informationValue > 7 ? 'significant' : 'moderate',
      narrativeProgressions: [`Clue "${clue.title}" has been revealed`],
      followUpClues: clue.relatedClues,
    };
  }

  private async updateGameStateWithReveal(
    gameId: string,
    reveal: ClueReveal
  ): Promise<void> {
    // TODO: Implement game state updates
    //TODO: Add periodic cleanup of inactive subscriptions
  }

  private async calculateCoherenceScore(
    clue: Clue,
    context: GameContext
  ): Promise<number> {
    // Calculate how well this clue fits with existing narrative and game state
    return 0.8; // Placeholder
  }

  private async checkConsistencyIssues(
    clue: Clue,
    context: GameContext
  ): Promise<string[]> {
    const issues: string[] = [];

    // Check for logical inconsistencies
    if (clue.informationValue > 8 && clue.misdirectionLevel > 5) {
      issues.push(
        'High information value conflicts with high misdirection level'
      );
    }

    return issues;
  }

  private async calculateThematicAlignment(
    clue: Clue,
    context: GameContext
  ): Promise<number> {
    // Calculate how well the clue aligns with the game's theme and scenario
    return 0.85; // Placeholder
  }

  private async calculateBalanceImpact(
    clue: Clue,
    context: GameContext
  ): Promise<BalanceImpact> {
    return {
      informationAdvantage: {
        town: clue.informationValue / 10,
        mafia: -clue.informationValue / 20,
      },
      gameEndProbability: {},
      difficultyIncrease: clue.difficulty === 'expert' ? 2 : 0,
      strategicComplexity: Math.min(clue.informationValue, 10),
    };
  }

  private async generateRecommendations(
    clue: Clue,
    context: GameContext
  ): Promise<string[]> {
    const recommendations: string[] = [];

    if (clue.informationValue < 3) {
      recommendations.push(
        'Consider increasing information value to make clue more meaningful'
      );
    }

    if (
      clue.verifiability === 'unverifiable' &&
      clue.reliability === 'reliable'
    ) {
      recommendations.push(
        'Unverifiable clues should typically have lower reliability'
      );
    }

    return recommendations;
  }

  private buildGameContextForAI(playerId: string): Promise<any> {
    // TODO: Build comprehensive game context for AI generation
    return Promise.resolve({
      phase: 'day',
      round: 2,
      tensions: 'high',
    });
  }

  private calculateInvestigationReliability(ability: any): number {
    // Calculate reliability based on ability strength and game context
    return 0.8; // Placeholder
  }

  private generateInvestigationLimitations(ability: any): string[] {
    return ['Information may be partial or context-dependent'];
  }

  private generateFollowUpActions(ability: any): string[] {
    return [
      'Consider cross-referencing with other evidence',
      'Watch for contradictory behavior',
    ];
  }

  private parseNarrativeResponse(content: string): any[] {
    // Parse AI narrative response into structured elements
    return [
      {
        clueData: {
          content: content.substring(0, 200),
          type: 'observation',
          reliability: 0.7,
          relatedEntities: [],
          isPublic: true,
          consequences: [],
        },
        atmosphere: 'mysterious',
        characterMoments: [],
        foreshadowing: [],
      },
    ];
  }

  private async calculateCurrentRelevance(
    clue: Clue,
    gameState: DeductionGameState
  ): Promise<number> {
    // Calculate how relevant this clue is given current game state
    let relevance = clue.informationValue / 10;

    // Reduce relevance if information is already known
    if (gameState.data.revealedInformation?.includes(clue.content)) {
      relevance *= 0.3;
    }

    // Increase relevance based on game phase
    if (gameState.phase === 'day_voting' && clue.type === 'action_evidence') {
      relevance *= 1.5;
    }

    return Math.min(relevance, 1);
  }

  private adjustInformationValue(
    clue: Clue,
    gameState: DeductionGameState
  ): number {
    let value = clue.informationValue;

    // Reduce value if many players have been eliminated (less impact)
    const eliminationRatio =
      gameState.data.eliminatedPlayers.length /
      (gameState.data.alivePlayers.length +
        gameState.data.eliminatedPlayers.length);
    value *= 1 - eliminationRatio * 0.3;

    return Math.max(1, Math.round(value));
  }

  private updateRevealConditions(
    conditions: ClueRevealCondition[],
    gameState: DeductionGameState
  ): ClueRevealCondition[] {
    return conditions.map(condition => {
      if (condition.type === 'round_number' && gameState.data.round > 1) {
        // Adjust round conditions based on current round
        return {
          ...condition,
          condition: `round >= ${Math.max(1, gameState.data.round - 1)}`,
        };
      }
      return condition;
    });
  }

  private generateClueTitle(clueData: ClueData, type: ClueType): string {
    const titleTemplates: Record<ClueType, string[]> = {
      role_hint: ['Suspicious Behavior', 'Unusual Knowledge', 'Telltale Signs'],
      alignment_hint: ['Hidden Loyalties', 'Secret Allegiance', 'True Colors'],
      action_evidence: [
        'Physical Evidence',
        'Traces of Activity',
        'Proof of Action',
      ],
      relationship: ['Social Connection', 'Unexpected Bond', 'Hidden Link'],
      behavioral: ['Changed Patterns', 'Nervous Behavior', 'Odd Reactions'],
      environmental: [
        'Atmospheric Clue',
        'Setting Detail',
        'Environmental Evidence',
      ],
      red_herring: ['Misleading Evidence', 'False Lead', 'Deceptive Sign'],
    };

    const templates = titleTemplates[type];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  private generateDefaultRevealConditions(): ClueRevealCondition[] {
    return [
      {
        type: 'round_number',
        condition: 'round >= 2',
        probability: 0.7,
      },
    ];
  }

  private determineVerifiability(
    clueData: ClueData
  ): 'easily_verified' | 'hard_to_verify' | 'unverifiable' {
    if (clueData.type === 'evidence') return 'easily_verified';
    if (clueData.type === 'observation') return 'hard_to_verify';
    return 'unverifiable';
  }

  private determineDifficulty(
    clueData: ClueData
  ): 'trivial' | 'easy' | 'medium' | 'hard' | 'expert' {
    if (clueData.reliability > 0.9) return 'easy';
    if (clueData.reliability > 0.7) return 'medium';
    if (clueData.reliability > 0.5) return 'hard';
    return 'expert';
  }

  private async validateClueSet(
    clues: Clue[],
    scenario: ScenarioData,
    roles: RoleDefinition[]
  ): Promise<Clue[]> {
    // Validate and balance the entire clue set
    const validClues: Clue[] = [];

    for (const clue of clues) {
      // Basic validation
      if (clue.content.length < 5 || clue.content.length > 500) {
        continue; // Skip invalid clues
      }

      // Check information balance
      const totalInfoValue = validClues.reduce(
        (sum, c) => sum + c.informationValue,
        0
      );
      if (totalInfoValue > roles.length * 15) {
        // Too much information, skip this clue
        continue;
      }

      validClues.push(clue);
    }

    return validClues;
  }

  private async createClueConnections(
    clues: Clue[],
    scenario: ScenarioData
  ): Promise<Clue[]> {
    // Create narrative and logical connections between clues
    const connectedClues = clues.map(clue => ({
      ...clue,
      relatedClues: clues
        .filter(
          other => other.id !== clue.id && this.shouldConnectClues(clue, other)
        )
        .map(related => related.id)
        .slice(0, 3), // Limit to 3 connections per clue
    }));

    return connectedClues;
  }

  private shouldConnectClues(clue1: Clue, clue2: Clue): boolean {
    // Determine if two clues should be narratively connected
    return (
      clue1.tags.some(tag => clue2.tags.includes(tag)) ||
      clue1.type === clue2.type ||
      Math.abs(clue1.informationValue - clue2.informationValue) <= 2
    );
  }
}

// Export singleton instance
export const clueGenerator = ClueGenerator.getInstance();
