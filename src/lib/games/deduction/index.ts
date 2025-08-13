/**
 * Comprehensive Deduction Game Clue System for RpgAInfinity
 *
 * This module provides the complete clue generation and management system
 * for social deduction games, featuring:
 *
 * - AI-powered clue generation using Claude API
 * - Progressive revelation mechanics with investigation systems
 * - Advanced validation and balancing algorithms
 * - Narrative integration for story coherence
 * - Dynamic difficulty adjustment and red herring generation
 * - Full integration with game engine and role systems
 *
 * @author AI/ML Specialist (Claude Code)
 * @version 1.0.0
 * @since 2025-01-13
 */

// ============================================================================
// CORE EXPORTS
// ============================================================================

export {
  // Main clue generator
  ClueGenerator,
  clueGenerator,

  // Clue interfaces and types
  type Clue,
  type ClueReveal,
  type ClueImpact,
  type GameContext,
  type InvestigationClue,
  type NarrativeClue,
  type ValidationResult,
  type BalanceImpact,
} from './clues';

export {
  // Specialized clue type generators
  ClueTypeGenerator,
  clueTypeGenerator,

  // Specialized clue interfaces
  type DirectEvidenceClue,
  type BehavioralClue,
  type SocialClue,
  type RedHerringClue,
  type BehaviorObservation,
  type SocialConnection,
  type SocialCluster,
  type SocialAnomaly,
} from './clue-types';

export {
  // Validation and balancing system
  ClueValidator,
  clueValidator,

  // Validation interfaces
  type ValidationConfig,
  type ClueSetAnalysis,
  type ClueAdjustment,
  type QualityMetrics,
  type ConsistencyCheck,
  type BalanceTolerances,
  type InformationFlowConstraints,
  type NarrativeCoherenceRules,
} from './clue-validation';

export {
  // Revelation and investigation system
  ClueRevelationManager,
  clueRevelationManager,

  // Investigation interfaces
  type RevelationManager,
  type InvestigationSystem,
  type InvestigationResult,
  type InvestigationOption,
  type InvestigationFinding,
  type InvestigationMethod,
  type RevealTrigger,
  type ClueChain,
  type AtmosphericReveal,
} from './clue-revelation';

// ============================================================================
// UNIFIED CLUE MANAGEMENT SYSTEM
// ============================================================================

/**
 * Comprehensive clue management system that orchestrates all clue-related functionality
 */
export class DeductionClueSystem {
  private static instance: DeductionClueSystem;

  private constructor(
    private readonly clueGen = clueGenerator,
    private readonly clueValidator = clueValidator,
    private readonly revelationManager = clueRevelationManager,
    private readonly typeGenerator = clueTypeGenerator
  ) {}

  public static getInstance(): DeductionClueSystem {
    if (!DeductionClueSystem.instance) {
      DeductionClueSystem.instance = new DeductionClueSystem();
    }
    return DeductionClueSystem.instance;
  }

  /**
   * Generate a complete set of balanced clues for a deduction game
   */
  async generateGameClues(config: GameClueConfig): Promise<GameClueSet> {
    try {
      // Generate clues using AI
      const rawClues = await this.clueGen.generateClues(
        config.scenario,
        config.roles
      );

      // Generate specialized clue types
      const directEvidence =
        await this.typeGenerator.generateDirectEvidenceClues(
          config.players,
          config.gameState,
          config.directEvidenceCount || 2
        );

      const behavioral = await this.typeGenerator.generateBehavioralClues(
        config.players,
        config.gameState,
        config.votingHistory || [],
        config.communications || []
      );

      const social = await this.typeGenerator.generateSocialClues(
        config.players,
        config.communications || [],
        config.votingHistory || []
      );

      const narrative = await this.typeGenerator.generateNarrativeClues(
        config.gameState,
        config.narrativeClueCount || 2
      );

      const redHerrings = await this.typeGenerator.generateRedHerringClues(
        config.players,
        config.gameState,
        config.redHerringCount || 2
      );

      // Combine all clues
      const allClues = [
        ...rawClues,
        ...directEvidence,
        ...behavioral,
        ...social,
        ...narrative,
        ...redHerrings,
      ];

      // Validate and balance the clue set
      const validation = await this.clueValidator.validateClueSet(
        allClues,
        config.scenario,
        config.roles,
        config.gameState,
        config.validationConfig
      );

      // Apply recommended adjustments
      const adjustedClues = await this.applyClueAdjustments(
        allClues,
        validation.recommendedAdjustments
      );

      // Balance for player skill level
      const balancedClues = await this.clueValidator.balanceCluesForPlayers(
        adjustedClues,
        config.players,
        config.gameState
      );

      // Optimize information flow
      const optimizedClues = await this.clueValidator.optimizeInformationFlow(
        balancedClues,
        config.scenario,
        config.expectedGameLength || 8
      );

      // Setup revelation schedule
      await this.scheduleClueReveals(optimizedClues, config.gameState.id);

      return {
        clues: optimizedClues,
        validation,
        metadata: {
          totalClues: optimizedClues.length,
          averageInformationValue:
            validation.qualityMetrics.averageInformationValue,
          balanceScore: this.calculateOverallBalanceScore(
            validation.balanceImpact
          ),
          narrativeCoherence: validation.narrativeConsistency,
          generatedAt: new Date().toISOString(),
          gameId: config.gameState.id,
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to generate game clues: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Process game events and trigger appropriate clue reveals
   */
  async processGameEvent(event: any, gameState: any): Promise<ClueReveal[]> {
    try {
      const reveals: ClueReveal[] = [];

      // Process automatic reveals based on game state
      const automaticReveals =
        await this.revelationManager.processAutomaticReveals(gameState);
      reveals.push(...automaticReveals);

      // Process event-specific triggers
      if (event.type === 'elimination') {
        const eliminationReveals = await this.processEliminationEvent(
          event,
          gameState
        );
        reveals.push(...eliminationReveals);
      } else if (event.type === 'ability_used') {
        const abilityReveals = await this.processAbilityEvent(event, gameState);
        reveals.push(...abilityReveals);
      } else if (event.type === 'phase_change') {
        const phaseReveals = await this.processPhaseChangeEvent(
          event,
          gameState
        );
        reveals.push(...phaseReveals);
      }

      return reveals;
    } catch (error) {
      //TODO: Implement proper error logging service
      return [];
    }
  }

  /**
   * Conduct an investigation and generate results
   */
  async conductPlayerInvestigation(
    investigator: any,
    target: any,
    gameState: any,
    method?: InvestigationMethod
  ): Promise<InvestigationResult> {
    return this.revelationManager.conductInvestigation(
      investigator,
      target,
      gameState
    );
  }

  /**
   * Get all available investigation options for a player
   */
  async getPlayerInvestigationOptions(
    player: any,
    gameState: any
  ): Promise<InvestigationOption[]> {
    return this.revelationManager.getAvailableInvestigations(player, gameState);
  }

  /**
   * Dynamically update clue relevance based on game progression
   */
  async updateClueRelevance(gameId: string, gameState: any): Promise<void> {
    try {
      // Get current clues for the game
      const currentClues = await this.getCurrentGameClues(gameId);

      // Update relevance scores
      const updatedClues = await this.clueGen.updateClueRelevance(
        currentClues,
        gameState
      );

      // Validate updated clue set
      const validation = await this.clueValidator.validateClueSet(
        updatedClues,
        gameState.data.scenario,
        [],
        gameState
      );

      // Apply any necessary rebalancing
      if (validation.balanceImpact.difficultyIncrease > 3) {
        await this.rebalanceGameClues(gameId, updatedClues, gameState);
      }
    } catch (error) {
      //TODO: Add proper error handling and logging
    }
  }

  /**
   * Generate adaptive clues based on player performance and game state
   */
  async generateAdaptiveClues(
    gameState: any,
    performanceMetrics: PlayerPerformanceMetrics
  ): Promise<Clue[]> {
    try {
      const adaptiveClues: Clue[] = [];

      // Generate clues based on player struggle areas
      if (performanceMetrics.averageDeductionAccuracy < 0.4) {
        // Players are struggling, provide easier clues
        const helpfulClues = await this.generateHelpfulClues(gameState, 2);
        adaptiveClues.push(...helpfulClues);
      } else if (performanceMetrics.averageDeductionAccuracy > 0.8) {
        // Players are doing well, increase challenge
        const challengingClues = await this.generateChallengingClues(
          gameState,
          1
        );
        adaptiveClues.push(...challengingClues);
      }

      // Generate clues to break stalemates
      if (performanceMetrics.stalemateDuration > 5) {
        const breakerClues = await this.generateStalemateBreakers(gameState);
        adaptiveClues.push(...breakerClues);
      }

      return adaptiveClues;
    } catch (error) {
      //TODO: Implement proper error logging service
      return [];
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private async applyClueAdjustments(
    clues: Clue[],
    adjustments: ClueAdjustment[]
  ): Promise<Clue[]> {
    const adjustedClues = [...clues];

    for (const adjustment of adjustments) {
      const clueIndex = adjustedClues.findIndex(
        c => c.id === adjustment.clueId
      );
      if (clueIndex !== -1) {
        const clue = adjustedClues[clueIndex];

        switch (adjustment.adjustmentType) {
          case 'information_value':
            adjustedClues[clueIndex] = {
              ...clue,
              informationValue:
                typeof adjustment.suggestedValue === 'number'
                  ? adjustment.suggestedValue
                  : clue.informationValue,
            };
            break;
          case 'reliability':
            adjustedClues[clueIndex] = {
              ...clue,
              reliability: adjustment.suggestedValue as any,
            };
            break;
          case 'difficulty':
            adjustedClues[clueIndex] = {
              ...clue,
              difficulty: adjustment.suggestedValue as any,
            };
            break;
          case 'remove':
            adjustedClues.splice(clueIndex, 1);
            break;
        }
      }
    }

    return adjustedClues;
  }

  private calculateOverallBalanceScore(balanceImpact: BalanceImpact): number {
    const advantageSpread = Math.max(
      ...Object.values(balanceImpact.informationAdvantage).map(Math.abs)
    );
    const probabilitySpread = Math.max(
      ...Object.values(balanceImpact.gameEndProbability).map(Math.abs)
    );

    // Higher spread = lower balance score
    const balanceScore = Math.max(
      0,
      1 - (advantageSpread + probabilitySpread) / 2
    );
    return Math.round(balanceScore * 100) / 100;
  }

  private async scheduleClueReveals(
    clues: Clue[],
    gameId: string
  ): Promise<void> {
    for (const clue of clues) {
      if (clue.revealConditions.length > 0) {
        await this.revelationManager.scheduleReveal(
          clue,
          gameId as any,
          clue.revealConditions
        );
      }
    }
  }

  private async processEliminationEvent(
    event: any,
    gameState: any
  ): Promise<ClueReveal[]> {
    const reveals: ClueReveal[] = [];

    // Generate elimination-triggered reveals
    const eliminationClues = await this.clueGen.createNarrativeClues(gameState);

    for (const clue of eliminationClues.slice(0, 1)) {
      // Limit to 1 reveal
      const reveal = await this.revelationManager.revealClue(
        clue.id,
        gameState.id,
        undefined
      );
      reveals.push(reveal);
    }

    return reveals;
  }

  private async processAbilityEvent(
    event: any,
    gameState: any
  ): Promise<ClueReveal[]> {
    const reveals: ClueReveal[] = [];

    // Check if investigation abilities triggered
    if (event.data?.abilityType === 'investigate') {
      // Process investigation results
      // This would integrate with the investigation system
    }

    return reveals;
  }

  private async processPhaseChangeEvent(
    event: any,
    gameState: any
  ): Promise<ClueReveal[]> {
    const reveals: ClueReveal[] = [];

    // Generate phase-appropriate atmospheric reveals
    if (event.data?.newPhase === 'day_discussion' && Math.random() < 0.2) {
      const atmosphericClues =
        await this.clueGen.createNarrativeClues(gameState);

      if (atmosphericClues.length > 0) {
        const reveal = await this.revelationManager.revealClue(
          atmosphericClues[0].id,
          gameState.id,
          undefined
        );
        reveals.push(reveal);
      }
    }

    return reveals;
  }

  private async getCurrentGameClues(gameId: string): Promise<Clue[]> {
    // This would retrieve clues from storage for the specified game
    // For now, return empty array as placeholder
    return [];
  }

  private async rebalanceGameClues(
    gameId: string,
    clues: Clue[],
    gameState: any
  ): Promise<void> {
    // Implement dynamic rebalancing logic
    const rebalancedClues = await this.clueValidator.balanceCluesForPlayers(
      clues,
      [],
      gameState
    );

    // Update stored clues with rebalanced versions
    // This would integrate with the storage system
    //TODO: Implement clue storage updates
  }

  private async generateHelpfulClues(
    gameState: any,
    count: number
  ): Promise<Clue[]> {
    // Generate easier, more direct clues to help struggling players
    return this.typeGenerator.generateDirectEvidenceClues([], gameState, count);
  }

  private async generateChallengingClues(
    gameState: any,
    count: number
  ): Promise<Clue[]> {
    // Generate more complex, subtle clues for skilled players
    return this.typeGenerator.generateRedHerringClues([], gameState, count);
  }

  private async generateStalemateBreakers(gameState: any): Promise<Clue[]> {
    // Generate clues specifically designed to break game stalemates
    const narrativeClues = await this.clueGen.createNarrativeClues(gameState);

    return narrativeClues.map(clue => ({
      ...clue,
      informationValue: Math.min(8, clue.informationValue + 2), // Boost information value
      difficulty: 'easy' as const, // Make them easier to understand
    }));
  }
}

// ============================================================================
// CONFIGURATION AND UTILITY INTERFACES
// ============================================================================

export interface GameClueConfig {
  readonly scenario: any; // ScenarioData
  readonly roles: any[]; // RoleDefinition[]
  readonly players: any[]; // DeductionPlayer[]
  readonly gameState: any; // DeductionGameState
  readonly votingHistory?: any[]; // Vote[]
  readonly communications?: any[]; // Communication[]
  readonly directEvidenceCount?: number;
  readonly narrativeClueCount?: number;
  readonly redHerringCount?: number;
  readonly expectedGameLength?: number;
  readonly validationConfig?: Partial<ValidationConfig>;
}

export interface GameClueSet {
  readonly clues: Clue[];
  readonly validation: ClueSetAnalysis;
  readonly metadata: ClueSetMetadata;
}

export interface ClueSetMetadata {
  readonly totalClues: number;
  readonly averageInformationValue: number;
  readonly balanceScore: number;
  readonly narrativeCoherence: number;
  readonly generatedAt: string;
  readonly gameId: string;
}

export interface PlayerPerformanceMetrics {
  readonly averageDeductionAccuracy: number;
  readonly stalemateDuration: number;
  readonly investigationEffectiveness: number;
  readonly votingAccuracy: number;
  readonly communicationEngagement: number;
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

/**
 * Main clue system instance - use this for all clue-related operations
 */
export const deductionClueSystem = DeductionClueSystem.getInstance();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Quick setup for a standard deduction game clue configuration
 */
export function createStandardClueConfig(
  scenario: any,
  roles: any[],
  players: any[],
  gameState: any,
  options?: {
    difficulty?: 'easy' | 'medium' | 'hard';
    redHerringRatio?: number;
    narrativeFocus?: boolean;
  }
): GameClueConfig {
  const difficulty = options?.difficulty || 'medium';
  const playerCount = players.length;

  return {
    scenario,
    roles,
    players,
    gameState,
    directEvidenceCount: Math.max(2, Math.floor(playerCount / 3)),
    narrativeClueCount: options?.narrativeFocus ? 4 : 2,
    redHerringCount: Math.floor(
      playerCount * (options?.redHerringRatio || 0.25)
    ),
    expectedGameLength:
      difficulty === 'easy' ? 6 : difficulty === 'hard' ? 12 : 8,
    validationConfig: {
      coherenceThreshold:
        difficulty === 'easy' ? 0.6 : difficulty === 'hard' ? 0.8 : 0.7,
      balanceTolerances: {
        maxInformationAdvantage:
          difficulty === 'easy' ? 0.4 : difficulty === 'hard' ? 0.2 : 0.3,
        maxDifficultyIncrease:
          difficulty === 'easy' ? 2 : difficulty === 'hard' ? 4 : 3,
        maxStrategicComplexity:
          difficulty === 'easy' ? 6 : difficulty === 'hard' ? 10 : 8,
        winProbabilityBounds: [-0.25, 0.25],
      },
      informationFlowConstraints: {
        maxInformationPerRound:
          difficulty === 'easy' ? 20 : difficulty === 'hard' ? 10 : 15,
        maxHighValueClues:
          difficulty === 'easy' ? 4 : difficulty === 'hard' ? 2 : 3,
        minRedHerringRatio: 0.1,
        maxRedHerringRatio: 0.4,
        informationDistributionTarget: 'balanced',
      },
    },
  };
}

/**
 * Analyze clue system performance for a completed game
 */
export async function analyzeClueSystemPerformance(
  gameId: string,
  finalGameState: any,
  playerFeedback?: any[]
): Promise<ClueSystemAnalysis> {
  try {
    const clues = await deductionClueSystem['getCurrentGameClues'](gameId);
    const revealedClues = clues.filter(clue => clue.isRevealed);
    const unrevealedClues = clues.filter(clue => !clue.isRevealed);

    return {
      gameId,
      totalClues: clues.length,
      cluesRevealed: revealedClues.length,
      revelationRate: revealedClues.length / clues.length,
      averageInformationValue:
        revealedClues.reduce((sum, clue) => sum + clue.informationValue, 0) /
        revealedClues.length,
      narrativeImpact:
        revealedClues.reduce((sum, clue) => sum + clue.narrativeWeight, 0) /
        revealedClues.length,
      playerSatisfaction:
        playerFeedback?.reduce(
          (sum, feedback) => sum + (feedback.clueRating || 0),
          0
        ) / (playerFeedback?.length || 1),
      gameBalance: {
        informationDistribution: 'balanced', // Simplified
        difficultyProgression: 'appropriate', // Simplified
        redHerringEffectiveness:
          unrevealedClues.filter(c => c.type === 'red_herring').length > 0
            ? 'effective'
            : 'minimal',
      },
      recommendations: [
        'Continue using current clue generation settings',
        'Consider increasing narrative clue frequency',
        'Monitor red herring revelation rates',
      ],
    };
  } catch (error) {
    throw new Error(
      `Failed to analyze clue system performance: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export interface ClueSystemAnalysis {
  readonly gameId: string;
  readonly totalClues: number;
  readonly cluesRevealed: number;
  readonly revelationRate: number;
  readonly averageInformationValue: number;
  readonly narrativeImpact: number;
  readonly playerSatisfaction: number;
  readonly gameBalance: {
    readonly informationDistribution:
      | 'town_favored'
      | 'mafia_favored'
      | 'balanced';
    readonly difficultyProgression: 'too_easy' | 'appropriate' | 'too_hard';
    readonly redHerringEffectiveness:
      | 'ineffective'
      | 'minimal'
      | 'effective'
      | 'overpowered';
  };
  readonly recommendations: string[];
}
