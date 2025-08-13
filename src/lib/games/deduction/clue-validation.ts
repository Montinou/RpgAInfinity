/**
 * Comprehensive Clue Validation and Balancing System for RpgAInfinity Deduction Game
 *
 * This module provides advanced validation and balancing capabilities including:
 * - Logical consistency checking across clues
 * - Game balance validation and impact assessment
 * - Clue relevance scoring and dynamic adjustment
 * - Narrative coherence validation
 * - Information flow optimization
 * - Red herring plausibility validation
 */

import { z } from 'zod';
import {
  Clue,
  ValidationResult,
  BalanceImpact,
  GameContext,
  ClueImpact,
  InvestigationClue,
  NarrativeClue,
  DirectEvidenceClue,
  BehavioralClue,
  SocialClue,
  RedHerringClue,
} from './clues';
import {
  DeductionGameState,
  DeductionPlayer,
  RoleDefinition,
  ScenarioData,
  ClueCard,
  UUID,
} from '../../../types/deduction';
import { GameError } from '../../../types/core';

// ============================================================================
// VALIDATION CONFIGURATION AND INTERFACES
// ============================================================================

export interface ValidationConfig {
  readonly coherenceThreshold: number; // 0-1, minimum coherence score
  readonly consistencyRequired: boolean;
  readonly thematicAlignmentThreshold: number; // 0-1
  readonly balanceTolerances: BalanceTolerances;
  readonly informationFlowConstraints: InformationFlowConstraints;
  readonly narrativeCoherenceRules: NarrativeCoherenceRules;
}

export interface BalanceTolerances {
  readonly maxInformationAdvantage: number; // Maximum advantage any alignment can have
  readonly maxDifficultyIncrease: number; // Maximum difficulty increase allowed
  readonly maxStrategicComplexity: number; // Maximum strategy complexity
  readonly winProbabilityBounds: [number, number]; // [min, max] win probability changes
}

export interface InformationFlowConstraints {
  readonly maxInformationPerRound: number;
  readonly maxHighValueClues: number;
  readonly minRedHerringRatio: number; // Minimum ratio of misleading clues
  readonly maxRedHerringRatio: number; // Maximum ratio of misleading clues
  readonly informationDistributionTarget:
    | 'balanced'
    | 'town_favored'
    | 'mafia_favored';
}

export interface NarrativeCoherenceRules {
  readonly requireThematicAlignment: boolean;
  readonly allowContradictoryClues: boolean;
  readonly enforceTemporalConsistency: boolean;
  readonly maintainCharacterConsistency: boolean;
  readonly preserveAtmosphere: boolean;
}

export interface ClueSetAnalysis {
  readonly totalInformationValue: number;
  readonly informationDistribution: Record<string, number>; // alignment -> information value
  readonly coherenceScore: number;
  readonly balanceImpact: BalanceImpact;
  readonly narrativeConsistency: number;
  readonly recommendedAdjustments: ClueAdjustment[];
  readonly qualityMetrics: QualityMetrics;
}

export interface ClueAdjustment {
  readonly clueId: UUID;
  readonly adjustmentType:
    | 'information_value'
    | 'reliability'
    | 'difficulty'
    | 'reveal_conditions'
    | 'remove';
  readonly currentValue: any;
  readonly suggestedValue: any;
  readonly reason: string;
  readonly priority: 'high' | 'medium' | 'low';
}

export interface QualityMetrics {
  readonly averageInformationValue: number;
  readonly informationVariance: number;
  readonly redHerringEffectiveness: number;
  readonly investigativeValue: number; // How much value investigation provides
  readonly narrativeImmersion: number;
  readonly strategicDepth: number;
}

export interface ConsistencyCheck {
  readonly checkType:
    | 'logical'
    | 'temporal'
    | 'character'
    | 'thematic'
    | 'mechanical';
  readonly description: string;
  readonly severity: 'critical' | 'major' | 'minor';
  readonly conflictingClues: UUID[];
  readonly suggestedResolution: string;
}

// ============================================================================
// CORE CLUE VALIDATION AND BALANCING ENGINE
// ============================================================================

/**
 * Advanced clue validation system with comprehensive balance analysis
 */
export class ClueValidator {
  private static instance: ClueValidator;
  private readonly defaultConfig: ValidationConfig = {
    coherenceThreshold: 0.7,
    consistencyRequired: true,
    thematicAlignmentThreshold: 0.8,
    balanceTolerances: {
      maxInformationAdvantage: 0.3,
      maxDifficultyIncrease: 3,
      maxStrategicComplexity: 8,
      winProbabilityBounds: [-0.2, 0.2],
    },
    informationFlowConstraints: {
      maxInformationPerRound: 15,
      maxHighValueClues: 3,
      minRedHerringRatio: 0.15,
      maxRedHerringRatio: 0.35,
      informationDistributionTarget: 'balanced',
    },
    narrativeCoherenceRules: {
      requireThematicAlignment: true,
      allowContradictoryClues: false,
      enforceTemporalConsistency: true,
      maintainCharacterConsistency: true,
      preserveAtmosphere: true,
    },
  };

  public static getInstance(): ClueValidator {
    if (!ClueValidator.instance) {
      ClueValidator.instance = new ClueValidator();
    }
    return ClueValidator.instance;
  }

  /**
   * Comprehensive validation of a single clue against game context
   */
  async validateClue(
    clue: Clue,
    context: GameContext,
    config?: Partial<ValidationConfig>
  ): Promise<ValidationResult> {
    try {
      const validationConfig = { ...this.defaultConfig, ...config };

      // Calculate coherence score
      const coherenceScore = await this.calculateCoherenceScore(
        clue,
        context,
        validationConfig
      );

      // Check for consistency issues
      const consistencyIssues = await this.checkConsistencyIssues(
        clue,
        context,
        validationConfig
      );

      // Calculate thematic alignment
      const thematicAlignment = await this.calculateThematicAlignment(
        clue,
        context,
        validationConfig
      );

      // Assess balance impact
      const balanceImpact = await this.calculateBalanceImpact(
        clue,
        context,
        validationConfig
      );

      // Generate recommendations
      const recommendations = await this.generateClueRecommendations(
        clue,
        context,
        coherenceScore,
        consistencyIssues,
        thematicAlignment
      );

      const isValid =
        coherenceScore >= validationConfig.coherenceThreshold &&
        (!validationConfig.consistencyRequired ||
          consistencyIssues.length === 0) &&
        thematicAlignment >= validationConfig.thematicAlignmentThreshold &&
        this.isBalanceAcceptable(
          balanceImpact,
          validationConfig.balanceTolerances
        );

      return {
        valid: isValid,
        coherenceScore,
        consistencyIssues: consistencyIssues.map(issue => issue.description),
        recommendations: recommendations.map(rec => rec.reason),
        thematicAlignment,
        balanceImpact,
      };
    } catch (error) {
      throw new GameError('clue_validation_failed', 'Failed to validate clue', {
        clueId: clue.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Validate and balance an entire set of clues
   */
  async validateClueSet(
    clues: Clue[],
    scenario: ScenarioData,
    roles: RoleDefinition[],
    gameState?: DeductionGameState,
    config?: Partial<ValidationConfig>
  ): Promise<ClueSetAnalysis> {
    try {
      const validationConfig = { ...this.defaultConfig, ...config };

      // Analyze information distribution
      const informationAnalysis = this.analyzeInformationDistribution(
        clues,
        roles
      );

      // Calculate overall coherence
      const overallCoherence = await this.calculateSetCoherence(
        clues,
        scenario
      );

      // Assess collective balance impact
      const collectiveBalance = await this.calculateCollectiveBalance(
        clues,
        roles,
        scenario
      );

      // Check narrative consistency
      const narrativeConsistency = await this.validateNarrativeConsistency(
        clues,
        scenario,
        validationConfig
      );

      // Generate quality metrics
      const qualityMetrics = this.calculateQualityMetrics(clues, roles);

      // Generate recommended adjustments
      const recommendedAdjustments = await this.generateSetAdjustments(
        clues,
        informationAnalysis,
        overallCoherence,
        collectiveBalance,
        validationConfig
      );

      return {
        totalInformationValue: informationAnalysis.total,
        informationDistribution: informationAnalysis.distribution,
        coherenceScore: overallCoherence,
        balanceImpact: collectiveBalance,
        narrativeConsistency,
        recommendedAdjustments,
        qualityMetrics,
      };
    } catch (error) {
      throw new GameError(
        'clue_set_validation_failed',
        'Failed to validate clue set',
        {
          clueCount: clues.length,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );
    }
  }

  /**
   * Dynamic clue relevance scoring based on game state
   */
  async calculateClueRelevance(
    clue: Clue,
    gameState: DeductionGameState
  ): Promise<number> {
    try {
      let relevanceScore = clue.informationValue / 10; // Base relevance

      // Adjust based on game phase
      relevanceScore *= this.getPhaseMultiplier(clue.type, gameState.phase);

      // Adjust based on revealed information
      if (this.isInformationAlreadyKnown(clue, gameState)) {
        relevanceScore *= 0.3;
      }

      // Adjust based on player eliminations
      const eliminationImpact = this.calculateEliminationImpact(
        clue,
        gameState
      );
      relevanceScore *= eliminationImpact;

      // Adjust based on voting patterns
      const votingRelevance = this.calculateVotingRelevance(clue, gameState);
      relevanceScore *= votingRelevance;

      return Math.max(0, Math.min(1, relevanceScore));
    } catch (error) {
      //TODO: Implement proper error logging service
      return 0.5; // Default relevance if calculation fails
    }
  }

  /**
   * Balance clue difficulty dynamically based on player performance
   */
  async balanceCluesForPlayers(
    clues: Clue[],
    players: DeductionPlayer[],
    gameState: DeductionGameState
  ): Promise<Clue[]> {
    try {
      const playerPerformance = this.analyzePlayerPerformance(
        players,
        gameState
      );
      const adjustmentFactor =
        this.calculateDifficultyAdjustment(playerPerformance);

      const balancedClues = clues.map(clue => {
        const adjustedInformationValue = Math.round(
          clue.informationValue * adjustmentFactor
        );
        const adjustedDifficulty = this.adjustDifficulty(
          clue.difficulty,
          adjustmentFactor
        );

        return {
          ...clue,
          informationValue: Math.max(1, Math.min(10, adjustedInformationValue)),
          difficulty: adjustedDifficulty,
          // Adjust red herring effectiveness based on player skill
          misdirectionLevel:
            clue.type === 'red_herring'
              ? Math.round(clue.misdirectionLevel * (2 - adjustmentFactor))
              : clue.misdirectionLevel,
        };
      });

      return balancedClues;
    } catch (error) {
      //TODO: Add proper error handling and logging
      return clues; // Return original clues if balancing fails
    }
  }

  /**
   * Validate red herring plausibility and effectiveness
   */
  async validateRedHerring(
    redHerring: RedHerringClue,
    context: GameContext
  ): Promise<{ valid: boolean; issues: string[] }> {
    try {
      const issues: string[] = [];

      // Check plausibility score
      if (redHerring.plausibilityScore < 0.4) {
        issues.push('Red herring is too implausible to be effective');
      }
      if (redHerring.plausibilityScore > 0.9) {
        issues.push('Red herring may be too convincing, making it unfair');
      }

      // Check misdirection level
      if (redHerring.misdirectionLevel < 5) {
        issues.push(
          'Red herring misdirection level is too low to be effective'
        );
      }

      // Check reveal mechanism
      if (redHerring.revealMechanism.howToDisprove.length === 0) {
        issues.push('No clear method provided to disprove this red herring');
      }

      // Check target validity
      const deductionContext = context as any; // TODO: Proper type casting
      if (deductionContext.players) {
        const targetPlayer = deductionContext.players.find(
          (p: any) => p.id === redHerring.misdirectionTarget
        );
        if (
          targetPlayer?.gameSpecificData?.role?.definition?.alignment ===
          'mafia'
        ) {
          issues.push('Red herring should not target actual mafia members');
        }
      }

      return {
        valid: issues.length === 0,
        issues,
      };
    } catch (error) {
      return {
        valid: false,
        issues: ['Failed to validate red herring due to technical error'],
      };
    }
  }

  /**
   * Optimize information flow across game phases
   */
  async optimizeInformationFlow(
    clues: Clue[],
    scenario: ScenarioData,
    expectedGameLength: number
  ): Promise<Clue[]> {
    try {
      // Sort clues by optimal reveal timing
      const sortedClues = clues.sort((a, b) => {
        const aOptimalTiming = this.calculateOptimalRevealTiming(
          a,
          expectedGameLength
        );
        const bOptimalTiming = this.calculateOptimalRevealTiming(
          b,
          expectedGameLength
        );
        return aOptimalTiming - bOptimalTiming;
      });

      // Adjust reveal conditions for optimal pacing
      const optimizedClues = sortedClues.map((clue, index) => {
        const optimalRound = Math.ceil(
          (index + 1) / Math.ceil(clues.length / expectedGameLength)
        );

        return {
          ...clue,
          revealConditions: this.generateOptimalRevealConditions(
            clue,
            optimalRound,
            expectedGameLength
          ),
        };
      });

      return optimizedClues;
    } catch (error) {
      //TODO: Add proper error handling
      return clues; // Return original clues if optimization fails
    }
  }

  // ============================================================================
  // PRIVATE VALIDATION METHODS
  // ============================================================================

  private async calculateCoherenceScore(
    clue: Clue,
    context: GameContext,
    config: ValidationConfig
  ): Promise<number> {
    let score = 1.0;

    // Check logical coherence
    score *= await this.checkLogicalCoherence(clue, context);

    // Check information value appropriateness
    score *= this.validateInformationValue(clue);

    // Check difficulty appropriateness
    score *= this.validateDifficulty(clue, context);

    // Check reveal condition appropriateness
    score *= this.validateRevealConditions(clue, context);

    return Math.max(0, Math.min(1, score));
  }

  private async checkLogicalCoherence(
    clue: Clue,
    context: GameContext
  ): Promise<number> {
    let coherence = 1.0;

    // Check if clue makes logical sense in game context
    if (clue.informationValue > 8 && clue.reliability === 'misleading') {
      coherence *= 0.5; // High value misleading clues should be rare
    }

    if (
      clue.verifiability === 'easily_verified' &&
      clue.reliability === 'unreliable'
    ) {
      coherence *= 0.3; // Easily verified clues shouldn't be unreliable
    }

    if (clue.misdirectionLevel > 7 && clue.type !== 'red_herring') {
      coherence *= 0.4; // High misdirection should be limited to red herrings
    }

    return coherence;
  }

  private validateInformationValue(clue: Clue): number {
    // Information value should match clue characteristics
    if (clue.type === 'red_herring' && clue.informationValue > 3) {
      return 0.6; // Red herrings shouldn't have high information value
    }

    if (clue.difficulty === 'expert' && clue.informationValue < 6) {
      return 0.7; // Expert difficulty should provide substantial information
    }

    if (clue.reliability === 'reliable' && clue.informationValue < 3) {
      return 0.8; // Reliable clues should provide meaningful information
    }

    return 1.0;
  }

  private validateDifficulty(clue: Clue, context: GameContext): number {
    // Difficulty should match information value and reliability
    const expectedDifficulty = this.calculateExpectedDifficulty(clue);

    const difficultyMapping = {
      trivial: 1,
      easy: 2,
      medium: 3,
      hard: 4,
      expert: 5,
    };

    const actualDifficulty = difficultyMapping[clue.difficulty];
    const deviation = Math.abs(actualDifficulty - expectedDifficulty) / 5;

    return Math.max(0.5, 1 - deviation);
  }

  private calculateExpectedDifficulty(clue: Clue): number {
    let expectedDifficulty = 3; // Medium baseline

    // Adjust based on information value
    expectedDifficulty += (clue.informationValue - 5) * 0.3;

    // Adjust based on reliability
    if (clue.reliability === 'reliable') expectedDifficulty -= 0.5;
    if (clue.reliability === 'misleading') expectedDifficulty += 1;

    // Adjust based on verifiability
    if (clue.verifiability === 'easily_verified') expectedDifficulty -= 0.5;
    if (clue.verifiability === 'unverifiable') expectedDifficulty += 0.5;

    return Math.max(1, Math.min(5, expectedDifficulty));
  }

  private validateRevealConditions(clue: Clue, context: GameContext): number {
    if (clue.revealConditions.length === 0) {
      return clue.informationValue > 7 ? 0.5 : 0.9; // High value clues should have reveal conditions
    }

    // Check if reveal conditions are appropriate for clue value
    const hasRestrictiveConditions = clue.revealConditions.some(
      condition =>
        condition.type === 'ability_used' ||
        condition.type === 'player_eliminated'
    );

    if (clue.informationValue > 8 && !hasRestrictiveConditions) {
      return 0.7; // Very high value clues should have restrictive conditions
    }

    return 1.0;
  }

  private async checkConsistencyIssues(
    clue: Clue,
    context: GameContext,
    config: ValidationConfig
  ): Promise<ConsistencyCheck[]> {
    const issues: ConsistencyCheck[] = [];

    // Check for logical inconsistencies
    if (clue.informationValue > 8 && clue.misdirectionLevel > 5) {
      issues.push({
        checkType: 'logical',
        description:
          'High information value conflicts with high misdirection level',
        severity: 'major',
        conflictingClues: [clue.id],
        suggestedResolution: 'Reduce misdirection level or information value',
      });
    }

    // Check for temporal inconsistencies
    if (config.narrativeCoherenceRules.enforceTemporalConsistency) {
      const temporalIssues = await this.checkTemporalConsistency(clue, context);
      issues.push(...temporalIssues);
    }

    // Check for character consistency
    if (config.narrativeCoherenceRules.maintainCharacterConsistency) {
      const characterIssues = await this.checkCharacterConsistency(
        clue,
        context
      );
      issues.push(...characterIssues);
    }

    return issues;
  }

  private async checkTemporalConsistency(
    clue: Clue,
    context: GameContext
  ): Promise<ConsistencyCheck[]> {
    const issues: ConsistencyCheck[] = [];

    // Check if clue timing makes sense
    if (clue.gameContext.round > context.currentState.data.round + 2) {
      issues.push({
        checkType: 'temporal',
        description:
          'Clue references future events beyond reasonable prediction',
        severity: 'minor',
        conflictingClues: [clue.id],
        suggestedResolution: 'Adjust clue context to current or recent events',
      });
    }

    return issues;
  }

  private async checkCharacterConsistency(
    clue: Clue,
    context: GameContext
  ): Promise<ConsistencyCheck[]> {
    const issues: ConsistencyCheck[] = [];

    // Check if clue is consistent with character behavior
    // This would require more detailed character tracking
    // TODO: Implement comprehensive character consistency checking

    return issues;
  }

  private async calculateThematicAlignment(
    clue: Clue,
    context: GameContext,
    config: ValidationConfig
  ): Promise<number> {
    let alignment = 1.0;

    const scenario = context.currentState.data.scenario;

    // Check theme consistency
    if (!this.isThemeConsistent(clue, scenario.theme)) {
      alignment *= 0.6;
    }

    // Check setting consistency
    if (!this.isSettingConsistent(clue, scenario.setting)) {
      alignment *= 0.7;
    }

    // Check tone consistency
    if (!this.isToneConsistent(clue, scenario)) {
      alignment *= 0.8;
    }

    return alignment;
  }

  private isThemeConsistent(clue: Clue, theme: string): boolean {
    const themeKeywords = theme.toLowerCase().split(' ');
    const clueContent = clue.content.toLowerCase();

    // Check if clue content contains theme-appropriate elements
    return themeKeywords.some(
      keyword =>
        clueContent.includes(keyword) ||
        this.getThemeRelatedTerms(keyword).some(term =>
          clueContent.includes(term)
        )
    );
  }

  private getThemeRelatedTerms(theme: string): string[] {
    const themeTerms: Record<string, string[]> = {
      medieval: ['castle', 'knight', 'sword', 'tavern', 'lord', 'peasant'],
      space: ['ship', 'station', 'alien', 'planet', 'cosmic', 'void'],
      modern: ['phone', 'computer', 'car', 'office', 'city', 'technology'],
      fantasy: ['magic', 'wizard', 'dragon', 'spell', 'enchanted', 'mystical'],
    };

    return themeTerms[theme] || [];
  }

  private isSettingConsistent(clue: Clue, setting: string): boolean {
    // Check if clue references appropriate setting elements
    return (
      clue.content.toLowerCase().includes(setting.toLowerCase()) ||
      clue.gameContext.scenario.toLowerCase().includes(setting.toLowerCase())
    );
  }

  private isToneConsistent(clue: Clue, scenario: ScenarioData): boolean {
    // Check if clue tone matches scenario tone
    // This is a simplified check - could be enhanced with sentiment analysis
    if (scenario.theme.includes('horror') || scenario.theme.includes('dark')) {
      return (
        clue.content.includes('shadow') ||
        clue.content.includes('dark') ||
        clue.content.includes('ominous')
      );
    }

    return true; // Default to consistent
  }

  private async calculateBalanceImpact(
    clue: Clue,
    context: GameContext,
    config: ValidationConfig
  ): Promise<BalanceImpact> {
    const informationAdvantage: Record<string, number> = {};
    const gameEndProbability: Record<string, number> = {};

    // Calculate information advantage by alignment
    if (clue.type === 'role_hint' || clue.type === 'alignment_hint') {
      informationAdvantage['town'] = clue.informationValue / 20;
      informationAdvantage['mafia'] = -clue.informationValue / 40;
    } else if (clue.type === 'red_herring') {
      informationAdvantage['town'] = -clue.misdirectionLevel / 20;
      informationAdvantage['mafia'] = clue.misdirectionLevel / 30;
    }

    // Calculate game end probability impact
    const totalPlayers =
      context.currentState.data.alivePlayers.length +
      context.currentState.data.eliminatedPlayers.length;
    const informationRatio = clue.informationValue / (totalPlayers * 5); // Normalize by expected total information

    gameEndProbability['town'] = informationRatio * 0.1;
    gameEndProbability['mafia'] = -informationRatio * 0.05;

    return {
      informationAdvantage,
      gameEndProbability,
      difficultyIncrease: this.calculateDifficultyIncrease(clue),
      strategicComplexity: Math.min(
        10,
        clue.informationValue + clue.narrativeWeight
      ),
    };
  }

  private calculateDifficultyIncrease(clue: Clue): number {
    const difficultyValues = {
      trivial: -1,
      easy: 0,
      medium: 1,
      hard: 2,
      expert: 3,
    };

    return difficultyValues[clue.difficulty] || 0;
  }

  private isBalanceAcceptable(
    balanceImpact: BalanceImpact,
    tolerances: BalanceTolerances
  ): boolean {
    // Check information advantage
    const maxAdvantage = Math.max(
      ...Object.values(balanceImpact.informationAdvantage).map(Math.abs)
    );
    if (maxAdvantage > tolerances.maxInformationAdvantage) {
      return false;
    }

    // Check difficulty increase
    if (balanceImpact.difficultyIncrease > tolerances.maxDifficultyIncrease) {
      return false;
    }

    // Check strategic complexity
    if (balanceImpact.strategicComplexity > tolerances.maxStrategicComplexity) {
      return false;
    }

    // Check win probability changes
    const probabilities = Object.values(balanceImpact.gameEndProbability);
    const [minBound, maxBound] = tolerances.winProbabilityBounds;

    return probabilities.every(prob => prob >= minBound && prob <= maxBound);
  }

  private async generateClueRecommendations(
    clue: Clue,
    context: GameContext,
    coherenceScore: number,
    consistencyIssues: ConsistencyCheck[],
    thematicAlignment: number
  ): Promise<ClueAdjustment[]> {
    const recommendations: ClueAdjustment[] = [];

    // Coherence-based recommendations
    if (coherenceScore < 0.7) {
      if (clue.informationValue > 8 && clue.reliability === 'misleading') {
        recommendations.push({
          clueId: clue.id,
          adjustmentType: 'information_value',
          currentValue: clue.informationValue,
          suggestedValue: Math.min(5, clue.informationValue),
          reason: 'Reduce information value for misleading clues',
          priority: 'high',
        });
      }

      if (
        clue.verifiability === 'easily_verified' &&
        clue.reliability === 'unreliable'
      ) {
        recommendations.push({
          clueId: clue.id,
          adjustmentType: 'reliability',
          currentValue: clue.reliability,
          suggestedValue: 'reliable',
          reason: 'Easily verified clues should be reliable',
          priority: 'medium',
        });
      }
    }

    // Consistency-based recommendations
    consistencyIssues.forEach(issue => {
      if (issue.severity === 'critical' || issue.severity === 'major') {
        recommendations.push({
          clueId: clue.id,
          adjustmentType: 'information_value',
          currentValue: 'current_state',
          suggestedValue: 'adjusted_state',
          reason: issue.suggestedResolution,
          priority: issue.severity === 'critical' ? 'high' : 'medium',
        });
      }
    });

    // Thematic alignment recommendations
    if (thematicAlignment < 0.8) {
      recommendations.push({
        clueId: clue.id,
        adjustmentType: 'information_value',
        currentValue: clue.content,
        suggestedValue: 'enhanced_thematic_content',
        reason: 'Improve thematic alignment with scenario',
        priority: 'medium',
      });
    }

    return recommendations;
  }

  // ============================================================================
  // CLUE SET ANALYSIS METHODS
  // ============================================================================

  private analyzeInformationDistribution(
    clues: Clue[],
    roles: RoleDefinition[]
  ) {
    const distribution: Record<string, number> = {};
    let total = 0;

    // Initialize distribution for each alignment
    const alignments = [...new Set(roles.map(role => role.alignment))];
    alignments.forEach(alignment => {
      distribution[alignment] = 0;
    });

    // Calculate information distribution
    clues.forEach(clue => {
      total += clue.informationValue;

      // Assign information value to alignments based on clue type
      if (
        clue.type === 'role_hint' ||
        clue.type === 'alignment_hint' ||
        clue.type === 'action_evidence'
      ) {
        distribution['town'] += clue.informationValue;
      } else if (clue.type === 'red_herring') {
        distribution['mafia'] += clue.misdirectionLevel / 2; // Red herrings help mafia indirectly
      } else {
        // Neutral information
        alignments.forEach(alignment => {
          distribution[alignment] += clue.informationValue / alignments.length;
        });
      }
    });

    return { total, distribution };
  }

  private async calculateSetCoherence(
    clues: Clue[],
    scenario: ScenarioData
  ): Promise<number> {
    if (clues.length === 0) return 1.0;

    let totalCoherence = 0;
    let pairCount = 0;

    // Check coherence between all pairs of clues
    for (let i = 0; i < clues.length; i++) {
      for (let j = i + 1; j < clues.length; j++) {
        const pairCoherence = await this.calculatePairCoherence(
          clues[i],
          clues[j],
          scenario
        );
        totalCoherence += pairCoherence;
        pairCount++;
      }
    }

    return pairCount > 0 ? totalCoherence / pairCount : 1.0;
  }

  private async calculatePairCoherence(
    clue1: Clue,
    clue2: Clue,
    scenario: ScenarioData
  ): Promise<number> {
    let coherence = 1.0;

    // Check for contradictory information
    if (this.areContradictory(clue1, clue2)) {
      coherence *= 0.3;
    }

    // Check for redundant information
    if (this.areRedundant(clue1, clue2)) {
      coherence *= 0.7;
    }

    // Check for complementary information
    if (this.areComplementary(clue1, clue2)) {
      coherence *= 1.2;
    }

    // Check thematic consistency
    if (!this.areThematicallyConsistent(clue1, clue2, scenario)) {
      coherence *= 0.8;
    }

    return Math.max(0, Math.min(2, coherence));
  }

  private areContradictory(clue1: Clue, clue2: Clue): boolean {
    // Check if clues provide contradictory information about the same target
    const sharedTargets = clue1.targetPlayers.filter(target =>
      clue2.targetPlayers.includes(target)
    );

    if (sharedTargets.length > 0) {
      // If one clue points to guilt and another to innocence for the same player
      const clue1ImpliesGuilt =
        clue1.type === 'role_hint' && clue1.informationValue > 6;
      const clue2ImpliesInnocence =
        clue2.type === 'red_herring' && clue2.misdirectionLevel > 7;

      return clue1ImpliesGuilt && clue2ImpliesInnocence;
    }

    return false;
  }

  private areRedundant(clue1: Clue, clue2: Clue): boolean {
    // Check if clues provide essentially the same information
    return (
      clue1.type === clue2.type &&
      clue1.targetPlayers.some(target =>
        clue2.targetPlayers.includes(target)
      ) &&
      Math.abs(clue1.informationValue - clue2.informationValue) < 2
    );
  }

  private areComplementary(clue1: Clue, clue2: Clue): boolean {
    // Check if clues work well together to provide a complete picture
    const complementaryPairs = [
      ['role_hint', 'behavioral'],
      ['action_evidence', 'relationship'],
      ['investigation', 'environmental'],
    ];

    return complementaryPairs.some(
      ([type1, type2]) =>
        (clue1.type === type1 && clue2.type === type2) ||
        (clue1.type === type2 && clue2.type === type1)
    );
  }

  private areThematicallyConsistent(
    clue1: Clue,
    clue2: Clue,
    scenario: ScenarioData
  ): boolean {
    // Check if clues maintain consistent theme and tone
    const theme1Elements = this.extractThemeElements(
      clue1.content,
      scenario.theme
    );
    const theme2Elements = this.extractThemeElements(
      clue2.content,
      scenario.theme
    );

    return theme1Elements.some(element => theme2Elements.includes(element));
  }

  private extractThemeElements(content: string, theme: string): string[] {
    const themeKeywords = this.getThemeRelatedTerms(theme.toLowerCase());
    return themeKeywords.filter(keyword =>
      content.toLowerCase().includes(keyword)
    );
  }

  private async calculateCollectiveBalance(
    clues: Clue[],
    roles: RoleDefinition[],
    scenario: ScenarioData
  ): Promise<BalanceImpact> {
    const combinedAdvantage: Record<string, number> = {};
    const combinedProbability: Record<string, number> = {};
    let totalDifficultyIncrease = 0;
    let maxComplexity = 0;

    // Combine individual clue impacts
    for (const clue of clues) {
      const mockContext: GameContext = {
        gameId: crypto.randomUUID() as UUID,
        currentState: {
          data: {
            scenario,
            alivePlayers: roles.map(() => crypto.randomUUID() as UUID),
            eliminatedPlayers: [],
            round: 1,
          },
        } as DeductionGameState,
        players: [],
        revealedClues: [],
        gameHistory: [],
        votingHistory: [],
      };

      const impact = await this.calculateBalanceImpact(
        clue,
        mockContext,
        this.defaultConfig
      );

      // Combine advantages
      Object.keys(impact.informationAdvantage).forEach(alignment => {
        combinedAdvantage[alignment] =
          (combinedAdvantage[alignment] || 0) +
          impact.informationAdvantage[alignment];
      });

      // Combine probabilities
      Object.keys(impact.gameEndProbability).forEach(alignment => {
        combinedProbability[alignment] =
          (combinedProbability[alignment] || 0) +
          impact.gameEndProbability[alignment];
      });

      totalDifficultyIncrease += impact.difficultyIncrease;
      maxComplexity = Math.max(maxComplexity, impact.strategicComplexity);
    }

    return {
      informationAdvantage: combinedAdvantage,
      gameEndProbability: combinedProbability,
      difficultyIncrease: totalDifficultyIncrease,
      strategicComplexity: maxComplexity,
    };
  }

  private async validateNarrativeConsistency(
    clues: Clue[],
    scenario: ScenarioData,
    config: ValidationConfig
  ): Promise<number> {
    let consistency = 1.0;

    // Check thematic consistency
    if (config.narrativeCoherenceRules.requireThematicAlignment) {
      const themeConsistency = this.checkThemeConsistency(clues, scenario);
      consistency *= themeConsistency;
    }

    // Check temporal consistency
    if (config.narrativeCoherenceRules.enforceTemporalConsistency) {
      const temporalConsistency = this.checkTemporalConsistencySet(clues);
      consistency *= temporalConsistency;
    }

    // Check atmospheric consistency
    if (config.narrativeCoherenceRules.preserveAtmosphere) {
      const atmosphericConsistency = this.checkAtmosphericConsistency(
        clues,
        scenario
      );
      consistency *= atmosphericConsistency;
    }

    return consistency;
  }

  private checkThemeConsistency(clues: Clue[], scenario: ScenarioData): number {
    const themeAlignments = clues.map(clue =>
      this.isThemeConsistent(clue, scenario.theme) ? 1 : 0
    );

    return (
      themeAlignments.reduce((sum, alignment) => sum + alignment, 0) /
      clues.length
    );
  }

  private checkTemporalConsistencySet(clues: Clue[]): number {
    // Check for temporal ordering issues across clues
    const sortedByRound = clues.sort(
      (a, b) => a.gameContext.round - b.gameContext.round
    );

    let consistentPairs = 0;
    let totalPairs = 0;

    for (let i = 0; i < sortedByRound.length - 1; i++) {
      const current = sortedByRound[i];
      const next = sortedByRound[i + 1];

      totalPairs++;

      // Check if the progression makes temporal sense
      if (next.gameContext.round >= current.gameContext.round) {
        consistentPairs++;
      }
    }

    return totalPairs > 0 ? consistentPairs / totalPairs : 1;
  }

  private checkAtmosphericConsistency(
    clues: Clue[],
    scenario: ScenarioData
  ): number {
    // Check if clues maintain consistent atmosphere
    const expectedTone = this.determineExpectedTone(scenario);

    const toneConsistency = clues.map(clue =>
      this.checkToneConsistency(clue, expectedTone)
    );

    return (
      toneConsistency.reduce((sum, consistency) => sum + consistency, 0) /
      clues.length
    );
  }

  private determineExpectedTone(scenario: ScenarioData): string {
    if (scenario.theme.includes('horror') || scenario.theme.includes('dark')) {
      return 'ominous';
    } else if (
      scenario.theme.includes('comedy') ||
      scenario.theme.includes('light')
    ) {
      return 'playful';
    } else {
      return 'mysterious';
    }
  }

  private checkToneConsistency(clue: Clue, expectedTone: string): number {
    const toneIndicators: Record<string, string[]> = {
      ominous: ['dark', 'shadow', 'sinister', 'foreboding', 'ominous'],
      mysterious: ['mystery', 'hidden', 'secret', 'unknown', 'puzzling'],
      playful: ['amusing', 'quirky', 'unusual', 'interesting', 'surprising'],
    };

    const indicators = toneIndicators[expectedTone] || [];
    const hasConsistentTone = indicators.some(indicator =>
      clue.content.toLowerCase().includes(indicator)
    );

    return hasConsistentTone ? 1 : 0.7; // Partial credit for neutral tone
  }

  private calculateQualityMetrics(
    clues: Clue[],
    roles: RoleDefinition[]
  ): QualityMetrics {
    const informationValues = clues.map(clue => clue.informationValue);
    const redHerringCount = clues.filter(
      clue => clue.type === 'red_herring'
    ).length;
    const investigativeClues = clues.filter(
      clue => clue.type === 'role_hint' || clue.type === 'action_evidence'
    ).length;

    return {
      averageInformationValue:
        informationValues.reduce((sum, val) => sum + val, 0) /
        informationValues.length,
      informationVariance: this.calculateVariance(informationValues),
      redHerringEffectiveness:
        redHerringCount > 0
          ? clues
              .filter(clue => clue.type === 'red_herring')
              .reduce((sum, clue) => sum + clue.misdirectionLevel, 0) /
            (redHerringCount * 10)
          : 0,
      investigativeValue: investigativeClues / clues.length,
      narrativeImmersion:
        clues.reduce((sum, clue) => sum + clue.narrativeWeight, 0) /
        (clues.length * 10),
      strategicDepth: Math.min(
        10,
        clues.reduce((sum, clue) => sum + clue.informationValue, 0) /
          roles.length
      ),
    };
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDifferences = values.map(val => Math.pow(val - mean, 2));

    return (
      squaredDifferences.reduce((sum, val) => sum + val, 0) / values.length
    );
  }

  private async generateSetAdjustments(
    clues: Clue[],
    informationAnalysis: {
      total: number;
      distribution: Record<string, number>;
    },
    coherenceScore: number,
    balanceImpact: BalanceImpact,
    config: ValidationConfig
  ): Promise<ClueAdjustment[]> {
    const adjustments: ClueAdjustment[] = [];

    // Information distribution adjustments
    const maxAdvantage = Math.max(
      ...Object.values(balanceImpact.informationAdvantage).map(Math.abs)
    );
    if (maxAdvantage > config.balanceTolerances.maxInformationAdvantage) {
      adjustments.push({
        clueId: crypto.randomUUID() as UUID,
        adjustmentType: 'information_value',
        currentValue: 'imbalanced_set',
        suggestedValue: 'balanced_set',
        reason: 'Rebalance information distribution across alignments',
        priority: 'high',
      });
    }

    // Coherence adjustments
    if (coherenceScore < config.coherenceThreshold) {
      adjustments.push({
        clueId: crypto.randomUUID() as UUID,
        adjustmentType: 'information_value',
        currentValue: 'low_coherence',
        suggestedValue: 'improved_coherence',
        reason: 'Improve overall clue set coherence',
        priority: 'medium',
      });
    }

    // Red herring ratio adjustments
    const redHerringRatio =
      clues.filter(c => c.type === 'red_herring').length / clues.length;
    if (
      redHerringRatio < config.informationFlowConstraints.minRedHerringRatio
    ) {
      adjustments.push({
        clueId: crypto.randomUUID() as UUID,
        adjustmentType: 'information_value',
        currentValue: redHerringRatio,
        suggestedValue: config.informationFlowConstraints.minRedHerringRatio,
        reason: 'Increase red herring ratio for better balance',
        priority: 'medium',
      });
    }

    return adjustments;
  }

  // ============================================================================
  // DYNAMIC BALANCING METHODS
  // ============================================================================

  private getPhaseMultiplier(clueType: string, phase: string): number {
    const multipliers: Record<string, Record<string, number>> = {
      day_discussion: {
        behavioral: 1.3,
        relationship: 1.2,
        environmental: 1.1,
        default: 1.0,
      },
      day_voting: {
        action_evidence: 1.4,
        role_hint: 1.3,
        alignment_hint: 1.2,
        default: 1.0,
      },
      night_actions: {
        investigation: 1.5,
        environmental: 0.8,
        default: 1.0,
      },
    };

    return (
      multipliers[phase]?.[clueType] || multipliers[phase]?.['default'] || 1.0
    );
  }

  private isInformationAlreadyKnown(
    clue: Clue,
    gameState: DeductionGameState
  ): boolean {
    return (
      gameState.data.revealedInformation?.some(info =>
        clue.content.toLowerCase().includes(info.toLowerCase())
      ) || false
    );
  }

  private calculateEliminationImpact(
    clue: Clue,
    gameState: DeductionGameState
  ): number {
    const eliminatedCount = gameState.data.eliminatedPlayers.length;
    const totalPlayers = gameState.data.alivePlayers.length + eliminatedCount;
    const eliminationRatio = eliminatedCount / totalPlayers;

    // Reduce relevance as more players are eliminated
    return Math.max(0.3, 1 - eliminationRatio * 0.4);
  }

  private calculateVotingRelevance(
    clue: Clue,
    gameState: DeductionGameState
  ): number {
    // Check if clue targets align with recent voting patterns
    if (gameState.data.votingResults && clue.targetPlayers.length > 0) {
      const recentVotes = gameState.data.votingResults.votes || [];
      const clueTargetVoted = recentVotes.some(
        vote =>
          typeof vote.targetId === 'string' &&
          clue.targetPlayers.includes(vote.targetId as UUID)
      );

      return clueTargetVoted ? 1.3 : 0.9; // Increase relevance if targets were recently voted for
    }

    return 1.0;
  }

  private analyzePlayerPerformance(
    players: DeductionPlayer[],
    gameState: DeductionGameState
  ): number {
    // Analyze overall player performance to adjust difficulty
    let totalPerformance = 0;
    let playerCount = 0;

    players.forEach(player => {
      if (player.gameSpecificData.actionHistory.length > 0) {
        // Calculate performance based on action history, voting accuracy, etc.
        const actionCount = player.gameSpecificData.actionHistory.length;
        const communicationCount =
          player.gameSpecificData.communications.length;

        // Higher activity suggests better engagement/skill
        const performanceScore = Math.min(
          1,
          (actionCount * 0.3 + communicationCount * 0.7) / 5
        );
        totalPerformance += performanceScore;
        playerCount++;
      }
    });

    return playerCount > 0 ? totalPerformance / playerCount : 0.5; // Default to medium performance
  }

  private calculateDifficultyAdjustment(playerPerformance: number): number {
    // Adjust difficulty multiplier based on player performance
    if (playerPerformance > 0.7) {
      return 1.2; // Increase difficulty for skilled players
    } else if (playerPerformance < 0.3) {
      return 0.8; // Decrease difficulty for struggling players
    }

    return 1.0; // No adjustment for average performance
  }

  private adjustDifficulty(
    currentDifficulty: 'trivial' | 'easy' | 'medium' | 'hard' | 'expert',
    adjustmentFactor: number
  ): 'trivial' | 'easy' | 'medium' | 'hard' | 'expert' {
    const difficulties = ['trivial', 'easy', 'medium', 'hard', 'expert'];
    const currentIndex = difficulties.indexOf(currentDifficulty);

    let newIndex = currentIndex;
    if (adjustmentFactor > 1.1) {
      newIndex = Math.min(difficulties.length - 1, currentIndex + 1);
    } else if (adjustmentFactor < 0.9) {
      newIndex = Math.max(0, currentIndex - 1);
    }

    return difficulties[newIndex] as typeof currentDifficulty;
  }

  private calculateOptimalRevealTiming(
    clue: Clue,
    expectedGameLength: number
  ): number {
    // Calculate when this clue should optimally be revealed
    let optimalTiming = expectedGameLength / 2; // Default to middle of game

    // High value clues should be revealed later
    if (clue.informationValue > 7) {
      optimalTiming += expectedGameLength * 0.2;
    }

    // Red herrings should be revealed earlier to be effective
    if (clue.type === 'red_herring') {
      optimalTiming -= expectedGameLength * 0.2;
    }

    // Investigation clues should be available when investigative abilities are used
    if (clue.type === 'action_evidence') {
      optimalTiming = Math.max(2, optimalTiming - 1);
    }

    return Math.max(1, Math.min(expectedGameLength, Math.round(optimalTiming)));
  }

  private generateOptimalRevealConditions(
    clue: Clue,
    optimalRound: number,
    expectedGameLength: number
  ) {
    const conditions = [];

    // Round-based condition
    conditions.push({
      type: 'round_number' as const,
      condition: `round >= ${optimalRound}`,
      probability: 0.8,
    });

    // Add additional conditions based on clue type
    if (clue.informationValue > 8) {
      conditions.push({
        type: 'player_eliminated' as const,
        condition: 'player_eliminated_count >= 1',
        probability: 0.6,
      });
    }

    if (clue.type === 'action_evidence') {
      conditions.push({
        type: 'ability_used' as const,
        condition: 'investigative_ability_used',
        probability: 0.9,
      });
    }

    return conditions;
  }
}

// Export singleton instance
export const clueValidator = ClueValidator.getInstance();
