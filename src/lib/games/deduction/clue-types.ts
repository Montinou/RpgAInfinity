/**
 * Specialized Clue Type Implementations for RpgAInfinity Deduction Game
 *
 * This module provides specialized implementations for different clue types:
 * - Direct Evidence: Clear indicators pointing to specific players
 * - Behavioral Clues: Based on voting patterns and interactions
 * - Narrative Clues: Story elements that provide context
 * - Investigation Results: From detective/investigative role abilities
 * - Social Clues: Based on alliance and discussion patterns
 * - Red Herrings: Misleading but logical false evidence
 */

import { z } from 'zod';
import {
  Clue,
  InvestigationClue,
  NarrativeClue,
  ClueGameContext,
  ClueImpact,
} from './clues';
import {
  DeductionPlayer,
  DeductionGameState,
  Vote,
  Communication,
  RoleDefinition,
  UUID,
  ClueType,
} from '../../../types/deduction';
import { generateDeductionContent } from '../../ai';
import { GameError } from '../../../types/core';

// ============================================================================
// SPECIALIZED CLUE TYPE INTERFACES
// ============================================================================

export interface DirectEvidenceClue extends Clue {
  readonly evidenceType:
    | 'physical'
    | 'digital'
    | 'testimonial'
    | 'circumstantial'
    | 'forensic';
  readonly evidenceStrength:
    | 'conclusive'
    | 'strong'
    | 'moderate'
    | 'weak'
    | 'circumstantial';
  readonly pointsToPlayer: UUID;
  readonly pointsAwayFrom?: UUID[];
  readonly verificationMethod: string;
  readonly timeline: {
    readonly whenOccurred: string;
    readonly whenDiscovered: string;
    readonly whoDiscovered?: UUID;
  };
}

export interface BehavioralClue extends Clue {
  readonly behaviorType:
    | 'voting'
    | 'communication'
    | 'reaction'
    | 'timing'
    | 'alliance'
    | 'defensive';
  readonly patternData: {
    readonly observations: BehaviorObservation[];
    readonly consistency: number; // 0-1 scale
    readonly deviation: number; // How much this deviates from baseline
    readonly context: string[];
  };
  readonly psychologicalProfile: {
    readonly stressIndicators: string[];
    readonly deceptionMarkers?: string[];
    readonly motivationHints: string[];
  };
}

export interface SocialClue extends Clue {
  readonly socialType:
    | 'alliance'
    | 'conflict'
    | 'influence'
    | 'isolation'
    | 'leadership'
    | 'followership';
  readonly networkAnalysis: {
    readonly connections: SocialConnection[];
    readonly influenceMap: Record<UUID, number>; // Player influence scores
    readonly clusterAnalysis: SocialCluster[];
    readonly anomalies: SocialAnomaly[];
  };
  readonly communicationPatterns: {
    readonly frequency: Record<UUID, number>;
    readonly sentiment: Record<UUID, 'positive' | 'neutral' | 'negative'>;
    readonly topics: string[];
  };
}

export interface RedHerringClue extends Clue {
  readonly herringType:
    | 'false_evidence'
    | 'misleading_behavior'
    | 'planted_information'
    | 'coincidence'
    | 'misinterpretation';
  readonly misdirectionTarget: UUID; // Who this is meant to implicate
  readonly actualSource?: UUID; // Who might have created this red herring
  readonly plausibilityScore: number; // 0-1 how believable this is
  readonly revealMechanism: {
    readonly howToDisprove: string[];
    readonly requiredEvidence: string[];
    readonly revealTriggers: string[];
  };
}

export interface BehaviorObservation {
  readonly timestamp: string;
  readonly observer?: UUID;
  readonly behavior: string;
  readonly context: string;
  readonly significance: 'high' | 'medium' | 'low';
  readonly reliability: number; // 0-1
}

export interface SocialConnection {
  readonly fromPlayer: UUID;
  readonly toPlayer: UUID;
  readonly connectionType:
    | 'ally'
    | 'enemy'
    | 'neutral'
    | 'suspicious'
    | 'protective';
  readonly strength: number; // 0-1
  readonly evidence: string[];
  readonly evolution: 'strengthening' | 'weakening' | 'stable';
}

export interface SocialCluster {
  readonly members: UUID[];
  readonly cohesion: number; // 0-1
  readonly purpose:
    | 'coordination'
    | 'protection'
    | 'information_sharing'
    | 'voting_bloc';
  readonly leadership: UUID[];
  readonly secrets?: string[];
}

export interface SocialAnomaly {
  readonly type:
    | 'unexpected_alliance'
    | 'sudden_hostility'
    | 'isolated_behavior'
    | 'influence_shift';
  readonly players: UUID[];
  readonly description: string;
  readonly significance: number; // 0-1
}

// ============================================================================
// CLUE TYPE GENERATOR IMPLEMENTATIONS
// ============================================================================

/**
 * Specialized generator for different types of clues
 */
export class ClueTypeGenerator {
  private static instance: ClueTypeGenerator;

  public static getInstance(): ClueTypeGenerator {
    if (!ClueTypeGenerator.instance) {
      ClueTypeGenerator.instance = new ClueTypeGenerator();
    }
    return ClueTypeGenerator.instance;
  }

  /**
   * Generate direct evidence clues pointing to specific players
   */
  async generateDirectEvidenceClues(
    players: DeductionPlayer[],
    gameState: DeductionGameState,
    count: number = 3
  ): Promise<DirectEvidenceClue[]> {
    try {
      const evidenceClues: DirectEvidenceClue[] = [];
      const suspiciousPlayers = this.identifySuspiciousPlayers(
        players,
        gameState
      );

      for (let i = 0; i < count && i < suspiciousPlayers.length; i++) {
        const player = suspiciousPlayers[i];

        const aiPrompt = {
          playerRole: player.gameSpecificData.role.definition.name,
          playerAlignment: player.gameSpecificData.role.definition.alignment,
          scenario: gameState.data.scenario.name,
          theme: gameState.data.scenario.theme,
          evidenceType: this.selectEvidenceType(player, gameState),
          gamePhase: gameState.phase,
          round: gameState.data.round,
        };

        const aiResult = await generateDeductionContent('clues', {
          ...aiPrompt,
          clueType: 'direct_evidence',
          requestType: 'evidence_generation',
        });

        if (aiResult.success && aiResult.response) {
          const baseClue = await this.parseEvidenceResponse(
            aiResult.response.content,
            player
          );
          const evidenceClue: DirectEvidenceClue = {
            ...baseClue,
            evidenceType: this.selectEvidenceType(player, gameState),
            evidenceStrength: this.calculateEvidenceStrength(player, gameState),
            pointsToPlayer: player.id as UUID,
            pointsAwayFrom: this.getAlternativeSuspects(player, players),
            verificationMethod: this.generateVerificationMethod(baseClue.type),
            timeline: {
              whenOccurred: this.estimateEvidenceTime(gameState),
              whenDiscovered: new Date().toISOString(),
              whoDiscovered: this.selectPotentialDiscoverer(players),
            },
          };

          evidenceClues.push(evidenceClue);
        }
      }

      return evidenceClues;
    } catch (error) {
      throw new GameError(
        'direct_evidence_generation_failed',
        'Failed to generate direct evidence clues',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Generate behavioral clues based on player actions and patterns
   */
  async generateBehavioralClues(
    players: DeductionPlayer[],
    gameState: DeductionGameState,
    votingHistory: Vote[],
    communications: Communication[]
  ): Promise<BehavioralClue[]> {
    try {
      const behavioralClues: BehavioralClue[] = [];

      for (const player of players) {
        const behaviorAnalysis = this.analyzeBehaviorPatterns(
          player,
          votingHistory,
          communications,
          gameState
        );

        if (behaviorAnalysis.significance > 0.6) {
          const aiPrompt = {
            playerName: player.name,
            behaviorType: behaviorAnalysis.primaryBehaviorType,
            observations: behaviorAnalysis.observations.slice(0, 3),
            context: gameState.phase,
            theme: gameState.data.scenario.theme,
          };

          const aiResult = await generateDeductionContent('clues', {
            ...aiPrompt,
            clueType: 'behavioral',
            requestType: 'behavior_analysis',
          });

          if (aiResult.success && aiResult.response) {
            const baseClue = await this.parseBehaviorResponse(
              aiResult.response.content,
              player
            );

            const behavioralClue: BehavioralClue = {
              ...baseClue,
              behaviorType: behaviorAnalysis.primaryBehaviorType,
              patternData: {
                observations: behaviorAnalysis.observations,
                consistency: behaviorAnalysis.consistency,
                deviation: behaviorAnalysis.deviation,
                context: behaviorAnalysis.contextFactors,
              },
              psychologicalProfile: {
                stressIndicators: behaviorAnalysis.stressMarkers,
                deceptionMarkers: behaviorAnalysis.deceptionIndicators,
                motivationHints: behaviorAnalysis.motivationClues,
              },
            };

            behavioralClues.push(behavioralClue);
          }
        }
      }

      return behavioralClues;
    } catch (error) {
      //TODO: Implement proper error logging service
      return this.generateFallbackBehavioralClues(players, gameState);
    }
  }

  /**
   * Generate social clues based on alliance and discussion patterns
   */
  async generateSocialClues(
    players: DeductionPlayer[],
    communications: Communication[],
    votingHistory: Vote[]
  ): Promise<SocialClue[]> {
    try {
      const socialAnalysis = this.performSocialNetworkAnalysis(
        players,
        communications,
        votingHistory
      );
      const socialClues: SocialClue[] = [];

      for (const anomaly of socialAnalysis.anomalies) {
        if (anomaly.significance > 0.7) {
          const aiPrompt = {
            anomalyType: anomaly.type,
            playersInvolved: anomaly.players.length,
            description: anomaly.description,
            socialContext: socialAnalysis.overallDynamics,
          };

          const aiResult = await generateDeductionContent('clues', {
            ...aiPrompt,
            clueType: 'social',
            requestType: 'social_analysis',
          });

          if (aiResult.success && aiResult.response) {
            const baseClue = await this.parseSocialResponse(
              aiResult.response.content,
              anomaly.players
            );

            const socialClue: SocialClue = {
              ...baseClue,
              socialType: this.mapAnomalyToSocialType(anomaly.type),
              networkAnalysis: {
                connections: socialAnalysis.connections,
                influenceMap: socialAnalysis.influenceScores,
                clusterAnalysis: socialAnalysis.clusters,
                anomalies: [anomaly],
              },
              communicationPatterns: socialAnalysis.communicationPatterns,
            };

            socialClues.push(socialClue);
          }
        }
      }

      return socialClues;
    } catch (error) {
      //TODO: Add proper error handling and logging
      return [];
    }
  }

  /**
   * Generate investigation result clues from detective abilities
   */
  async generateInvestigationResultClues(
    investigator: DeductionPlayer,
    targets: DeductionPlayer[],
    gameState: DeductionGameState
  ): Promise<InvestigationClue[]> {
    try {
      const investigationClues: InvestigationClue[] = [];
      const investigativeAbilities =
        investigator.gameSpecificData.role.abilities.filter(
          ability => ability.ability.type === 'investigate'
        );

      if (investigativeAbilities.length === 0) {
        return [];
      }

      for (const target of targets.slice(0, 2)) {
        // Limit to 2 investigations
        const investigation = this.conductInvestigation(
          investigator,
          target,
          gameState,
          investigativeAbilities[0]
        );

        const aiPrompt = {
          investigatorRole: investigator.gameSpecificData.role.definition.name,
          targetName: target.name,
          investigationMethod: investigation.method,
          findings: investigation.findings,
          reliability: investigation.reliability,
          theme: gameState.data.scenario.theme,
        };

        const aiResult = await generateDeductionContent('clues', {
          ...aiPrompt,
          clueType: 'investigation',
          requestType: 'investigation_result',
        });

        if (aiResult.success && aiResult.response) {
          const baseClue = await this.parseInvestigationResponse(
            aiResult.response.content,
            target
          );

          const investigationClue: InvestigationClue = {
            ...baseClue,
            investigationDetails: {
              method: investigation.method,
              investigatorRole:
                investigator.gameSpecificData.role.definition.name,
              targetRole: target.gameSpecificData.role.definition.name,
              reliability: investigation.reliability,
              limitations: investigation.limitations,
              followUpActions: investigation.followUpActions,
            },
          };

          investigationClues.push(investigationClue);
        }
      }

      return investigationClues;
    } catch (error) {
      throw new GameError(
        'investigation_clue_generation_failed',
        'Failed to generate investigation result clues',
        {
          investigatorId: investigator.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );
    }
  }

  /**
   * Generate narrative clues that advance the story
   */
  async generateNarrativeClues(
    gameState: DeductionGameState,
    count: number = 2
  ): Promise<NarrativeClue[]> {
    try {
      const narrativeClues: NarrativeClue[] = [];
      const storyElements = this.analyzeStoryProgression(gameState);

      for (let i = 0; i < count; i++) {
        const aiPrompt = {
          theme: gameState.data.scenario.theme,
          setting: gameState.data.scenario.setting,
          currentRound: gameState.data.round,
          phase: gameState.phase,
          storyTension: storyElements.tension,
          atmosphericElements: storyElements.atmosphere,
          recentEvents: gameState.data.events.slice(-2).map(e => e.description),
        };

        const aiResult = await generateDeductionContent('narrative', {
          ...aiPrompt,
          requestType: 'atmospheric_clue',
        });

        if (aiResult.success && aiResult.response) {
          const baseClue = await this.parseNarrativeResponse(
            aiResult.response.content
          );

          const narrativeClue: NarrativeClue = {
            ...baseClue,
            storyElements: {
              setting: gameState.data.scenario.setting,
              atmosphere: storyElements.atmosphere,
              characterMoments: storyElements.characterMoments,
              foreshadowing: storyElements.foreshadowing,
              symbolism: storyElements.symbolism,
            },
          };

          narrativeClues.push(narrativeClue);
        }
      }

      return narrativeClues;
    } catch (error) {
      //TODO: Implement proper error logging service
      return this.generateFallbackNarrativeClues(gameState);
    }
  }

  /**
   * Generate red herring clues to mislead players
   */
  async generateRedHerringClues(
    players: DeductionPlayer[],
    gameState: DeductionGameState,
    count: number = 2
  ): Promise<RedHerringClue[]> {
    try {
      const redHerringClues: RedHerringClue[] = [];
      const innocentPlayers = players.filter(
        p =>
          p.gameSpecificData.role.definition.alignment === 'town' ||
          p.gameSpecificData.role.definition.alignment === 'neutral'
      );

      for (let i = 0; i < Math.min(count, innocentPlayers.length); i++) {
        const targetPlayer = innocentPlayers[i];
        const herringType = this.selectHerringType(targetPlayer, gameState);

        const aiPrompt = {
          targetPlayerName: targetPlayer.name,
          herringType,
          plausibilityLevel: 'high',
          scenario: gameState.data.scenario.name,
          theme: gameState.data.scenario.theme,
          gamePhase: gameState.phase,
        };

        const aiResult = await generateDeductionContent('clues', {
          ...aiPrompt,
          clueType: 'red_herring',
          requestType: 'misdirection_clue',
        });

        if (aiResult.success && aiResult.response) {
          const baseClue = await this.parseRedHerringResponse(
            aiResult.response.content,
            targetPlayer
          );

          const redHerringClue: RedHerringClue = {
            ...baseClue,
            herringType,
            misdirectionTarget: targetPlayer.id as UUID,
            actualSource: this.identifyPossibleSource(players, targetPlayer),
            plausibilityScore: this.calculatePlausibilityScore(
              baseClue,
              targetPlayer,
              gameState
            ),
            revealMechanism: {
              howToDisprove: this.generateDisproofMethods(herringType),
              requiredEvidence: this.generateRequiredEvidence(herringType),
              revealTriggers: this.generateRevealTriggers(
                herringType,
                gameState
              ),
            },
          };

          redHerringClues.push(redHerringClue);
        }
      }

      return redHerringClues;
    } catch (error) {
      //TODO: Implement proper error logging service
      return [];
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private identifySuspiciousPlayers(
    players: DeductionPlayer[],
    gameState: DeductionGameState
  ): DeductionPlayer[] {
    return players
      .filter(player => player.gameSpecificData.status === 'alive')
      .sort((a, b) => {
        // Sort by suspicion level (higher first)
        const aAvgSuspicion =
          Object.values(a.gameSpecificData.suspicions).reduce(
            (sum, val) => sum + val,
            0
          ) / Object.keys(a.gameSpecificData.suspicions).length || 0;
        const bAvgSuspicion =
          Object.values(b.gameSpecificData.suspicions).reduce(
            (sum, val) => sum + val,
            0
          ) / Object.keys(b.gameSpecificData.suspicions).length || 0;
        return bAvgSuspicion - aAvgSuspicion;
      });
  }

  private selectEvidenceType(
    player: DeductionPlayer,
    gameState: DeductionGameState
  ): 'physical' | 'digital' | 'testimonial' | 'circumstantial' | 'forensic' {
    const theme = gameState.data.scenario.theme.toLowerCase();

    if (theme.includes('modern') || theme.includes('cyber')) return 'digital';
    if (theme.includes('medieval') || theme.includes('fantasy'))
      return 'physical';
    if (theme.includes('space') || theme.includes('sci-fi')) return 'forensic';

    return 'circumstantial'; // Default
  }

  private calculateEvidenceStrength(
    player: DeductionPlayer,
    gameState: DeductionGameState
  ): 'conclusive' | 'strong' | 'moderate' | 'weak' | 'circumstantial' {
    const avgSuspicion =
      Object.values(player.gameSpecificData.suspicions).reduce(
        (sum, val) => sum + val,
        0
      ) / Object.keys(player.gameSpecificData.suspicions).length || 0;

    if (avgSuspicion > 0.8) return 'strong';
    if (avgSuspicion > 0.6) return 'moderate';
    if (avgSuspicion > 0.4) return 'weak';
    return 'circumstantial';
  }

  private getAlternativeSuspects(
    excludePlayer: DeductionPlayer,
    players: DeductionPlayer[]
  ): UUID[] {
    return players
      .filter(
        p => p.id !== excludePlayer.id && p.gameSpecificData.status === 'alive'
      )
      .slice(0, 2)
      .map(p => p.id as UUID);
  }

  private generateVerificationMethod(clueType: ClueType): string {
    const methods: Record<ClueType, string[]> = {
      role_hint: [
        'Cross-reference with known role abilities',
        'Observe future actions',
      ],
      alignment_hint: ['Track voting patterns', 'Monitor alliance formation'],
      action_evidence: ['Verify timeline', 'Check with witnesses'],
      relationship: [
        'Analyze communication patterns',
        'Monitor behavioral changes',
      ],
      behavioral: ['Statistical analysis of past behavior', 'Peer observation'],
      environmental: ['Physical examination', 'Context analysis'],
      red_herring: ['Seek contradictory evidence', 'Alternative explanations'],
    };

    const methodsArray = methods[clueType] || [
      'Further investigation required',
    ];
    return methodsArray[Math.floor(Math.random() * methodsArray.length)];
  }

  private estimateEvidenceTime(gameState: DeductionGameState): string {
    const phases = ['night_actions', 'day_discussion', 'day_voting'];
    const randomPhase = phases[Math.floor(Math.random() * phases.length)];
    return `Round ${Math.max(1, gameState.data.round - 1)} during ${randomPhase}`;
  }

  private selectPotentialDiscoverer(
    players: DeductionPlayer[]
  ): UUID | undefined {
    const investigators = players.filter(
      p =>
        p.gameSpecificData.role.definition.type === 'investigative' &&
        p.gameSpecificData.status === 'alive'
    );

    return investigators.length > 0 ? (investigators[0].id as UUID) : undefined;
  }

  private analyzeBehaviorPatterns(
    player: DeductionPlayer,
    votingHistory: Vote[],
    communications: Communication[],
    gameState: DeductionGameState
  ) {
    // Analyze player behavior patterns from game history
    const playerVotes = votingHistory.filter(v => v.voterId === player.id);
    const playerMessages = communications.filter(c => c.from === player.id);

    const observations: BehaviorObservation[] = [];

    // Analyze voting patterns
    if (playerVotes.length > 1) {
      const voteChanges = this.analyzeVoteChanges(playerVotes);
      if (voteChanges > 0) {
        observations.push({
          timestamp: new Date().toISOString(),
          behavior: `Changed vote ${voteChanges} times`,
          context: 'voting_phase',
          significance: voteChanges > 2 ? 'high' : 'medium',
          reliability: 0.9,
        });
      }
    }

    // Analyze communication patterns
    const messageFrequency =
      playerMessages.length / Math.max(1, gameState.data.round);
    if (messageFrequency > 3 || messageFrequency < 0.5) {
      observations.push({
        timestamp: new Date().toISOString(),
        behavior: messageFrequency > 3 ? 'Very talkative' : 'Unusually quiet',
        context: 'discussion_phase',
        significance: 'medium',
        reliability: 0.8,
      });
    }

    return {
      observations,
      primaryBehaviorType: this.determinePrimaryBehaviorType(observations),
      significance:
        observations.reduce(
          (sum, obs) =>
            sum +
            (obs.significance === 'high'
              ? 1
              : obs.significance === 'medium'
                ? 0.6
                : 0.3),
          0
        ) / observations.length,
      consistency: this.calculateBehaviorConsistency(observations),
      deviation: this.calculateDeviationFromBaseline(
        player,
        playerVotes,
        playerMessages
      ),
      contextFactors: [`Round ${gameState.data.round}`, gameState.phase],
      stressMarkers: this.identifyStressMarkers(observations),
      deceptionIndicators: this.identifyDeceptionMarkers(observations),
      motivationClues: this.inferMotivationClues(player, observations),
    };
  }

  private analyzeVoteChanges(votes: Vote[]): number {
    // Count how many times player changed their vote
    let changes = 0;
    let lastTarget = null;

    for (const vote of votes.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )) {
      if (lastTarget && vote.targetId !== lastTarget) {
        changes++;
      }
      lastTarget = vote.targetId;
    }

    return changes;
  }

  private determinePrimaryBehaviorType(
    observations: BehaviorObservation[]
  ):
    | 'voting'
    | 'communication'
    | 'reaction'
    | 'timing'
    | 'alliance'
    | 'defensive' {
    const contextCounts = observations.reduce(
      (acc, obs) => {
        if (obs.context.includes('voting')) acc.voting++;
        else if (obs.context.includes('discussion')) acc.communication++;
        return acc;
      },
      { voting: 0, communication: 0 }
    );

    return contextCounts.voting > contextCounts.communication
      ? 'voting'
      : 'communication';
  }

  private calculateBehaviorConsistency(
    observations: BehaviorObservation[]
  ): number {
    if (observations.length < 2) return 1;

    // Calculate consistency based on reliability variance
    const reliabilities = observations.map(obs => obs.reliability);
    const variance =
      reliabilities.reduce((sum, rel) => sum + Math.pow(rel - 0.8, 2), 0) /
      reliabilities.length;

    return Math.max(0, 1 - variance * 2);
  }

  private calculateDeviationFromBaseline(
    player: DeductionPlayer,
    votes: Vote[],
    messages: Communication[]
  ): number {
    // Calculate how much this player's behavior deviates from expected baseline
    const expectedVotesPerRound = 1;
    const expectedMessagesPerRound = 2;

    const actualVoteRate = votes.length;
    const actualMessageRate = messages.length;

    const voteDeviation =
      Math.abs(actualVoteRate - expectedVotesPerRound) / expectedVotesPerRound;
    const messageDeviation =
      Math.abs(actualMessageRate - expectedMessagesPerRound) /
      expectedMessagesPerRound;

    return (voteDeviation + messageDeviation) / 2;
  }

  private identifyStressMarkers(observations: BehaviorObservation[]): string[] {
    const markers: string[] = [];

    observations.forEach(obs => {
      if (obs.behavior.includes('changed vote')) {
        markers.push('Indecisive voting behavior');
      }
      if (obs.behavior.includes('talkative')) {
        markers.push('Excessive communication');
      }
      if (obs.behavior.includes('quiet')) {
        markers.push('Withdrawn behavior');
      }
    });

    return markers;
  }

  private identifyDeceptionMarkers(
    observations: BehaviorObservation[]
  ): string[] {
    const markers: string[] = [];

    observations.forEach(obs => {
      if (obs.significance === 'high' && obs.reliability < 0.7) {
        markers.push('Inconsistent high-significance behavior');
      }
      if (obs.behavior.includes('changed')) {
        markers.push('Pattern inconsistency');
      }
    });

    return markers;
  }

  private inferMotivationClues(
    player: DeductionPlayer,
    observations: BehaviorObservation[]
  ): string[] {
    const clues: string[] = [];

    if (player.gameSpecificData.role.definition.alignment === 'mafia') {
      clues.push('May be working to protect allies');
      clues.push('Likely has hidden information');
    } else if (player.gameSpecificData.role.definition.alignment === 'town') {
      clues.push('Probably seeking to identify threats');
      clues.push('May be frustrated by lack of information');
    }

    return clues;
  }

  private performSocialNetworkAnalysis(
    players: DeductionPlayer[],
    communications: Communication[],
    votingHistory: Vote[]
  ) {
    // Perform comprehensive social network analysis
    const connections: SocialConnection[] = [];
    const influenceScores: Record<UUID, number> = {};
    const communicationPatterns = {
      frequency: {} as Record<UUID, number>,
      sentiment: {} as Record<UUID, 'positive' | 'neutral' | 'negative'>,
      topics: [] as string[],
    };

    // Initialize influence scores
    players.forEach(player => {
      influenceScores[player.id as UUID] = 0;
    });

    // Analyze communication patterns
    communications.forEach(comm => {
      const fromUUID = comm.from as UUID;
      communicationPatterns.frequency[fromUUID] =
        (communicationPatterns.frequency[fromUUID] || 0) + 1;

      // Increase influence for active communicators
      influenceScores[fromUUID] += 0.1;

      // Simple sentiment analysis (placeholder)
      communicationPatterns.sentiment[fromUUID] = comm.content.includes('!')
        ? 'negative'
        : comm.content.includes('?')
          ? 'neutral'
          : 'positive';
    });

    // Analyze voting patterns for alliances
    const voteMatrix: Record<string, Record<string, number>> = {};
    votingHistory.forEach(vote => {
      const voterKey = vote.voterId;
      const targetKey = vote.targetId.toString();

      if (!voteMatrix[voterKey]) voteMatrix[voterKey] = {};
      voteMatrix[voterKey][targetKey] =
        (voteMatrix[voterKey][targetKey] || 0) + 1;
    });

    // Generate connections based on voting patterns
    Object.keys(voteMatrix).forEach(voter => {
      Object.keys(voteMatrix[voter]).forEach(target => {
        const voteCount = voteMatrix[voter][target];
        if (voteCount > 1) {
          connections.push({
            fromPlayer: voter as UUID,
            toPlayer: target as UUID,
            connectionType: 'enemy',
            strength: Math.min(voteCount / 3, 1),
            evidence: [`Voted against ${voteCount} times`],
            evolution: 'stable',
          });
        }
      });
    });

    // Identify clusters
    const clusters = this.identifySocialClusters(
      players,
      connections,
      communications
    );

    // Identify anomalies
    const anomalies = this.identifySocialAnomalies(
      connections,
      communicationPatterns,
      clusters
    );

    return {
      connections,
      influenceScores,
      clusters,
      anomalies,
      communicationPatterns,
      overallDynamics: this.summarizeOverallDynamics(connections, clusters),
    };
  }

  private identifySocialClusters(
    players: DeductionPlayer[],
    connections: SocialConnection[],
    communications: Communication[]
  ): SocialCluster[] {
    const clusters: SocialCluster[] = [];

    // Simple clustering based on frequent communication
    const communicationGraph: Record<string, string[]> = {};

    communications.forEach(comm => {
      const from = comm.from;
      const to = comm.to.toString();

      if (!communicationGraph[from]) communicationGraph[from] = [];
      if (to !== 'all' && to !== 'team') {
        communicationGraph[from].push(to);
      }
    });

    // Find clusters of 2-3 players who communicate frequently
    const processedPlayers = new Set<string>();

    Object.keys(communicationGraph).forEach(playerId => {
      if (processedPlayers.has(playerId)) return;

      const frequentContacts = communicationGraph[playerId].filter(
        (contact, index, array) => array.indexOf(contact) !== index // Find repeated contacts
      );

      if (frequentContacts.length > 0) {
        const clusterMembers = [playerId, ...frequentContacts].slice(0, 3);

        clusters.push({
          members: clusterMembers as UUID[],
          cohesion: 0.7, // Placeholder
          purpose: 'information_sharing',
          leadership: [playerId as UUID],
        });

        clusterMembers.forEach(member => processedPlayers.add(member));
      }
    });

    return clusters;
  }

  private identifySocialAnomalies(
    connections: SocialConnection[],
    communicationPatterns: any,
    clusters: SocialCluster[]
  ): SocialAnomaly[] {
    const anomalies: SocialAnomaly[] = [];

    // Look for isolated players
    const activePlayers = new Set([
      ...connections.map(c => c.fromPlayer),
      ...connections.map(c => c.toPlayer),
      ...Object.keys(communicationPatterns.frequency),
    ]);

    const isolatedPlayers = Object.keys(communicationPatterns.frequency).filter(
      playerId => (communicationPatterns.frequency[playerId as UUID] || 0) < 1
    );

    if (isolatedPlayers.length > 0) {
      anomalies.push({
        type: 'isolated_behavior',
        players: isolatedPlayers as UUID[],
        description: `${isolatedPlayers.length} players showing unusually quiet behavior`,
        significance: 0.6,
      });
    }

    // Look for sudden alliance patterns
    const strongConnections = connections.filter(c => c.strength > 0.8);
    if (strongConnections.length > 0) {
      anomalies.push({
        type: 'unexpected_alliance',
        players: strongConnections.flatMap(c => [c.fromPlayer, c.toPlayer]),
        description: 'Strong alliance patterns detected',
        significance: 0.8,
      });
    }

    return anomalies;
  }

  private summarizeOverallDynamics(
    connections: SocialConnection[],
    clusters: SocialCluster[]
  ): string {
    const totalConnections = connections.length;
    const totalClusters = clusters.length;

    if (totalConnections > totalClusters * 2) {
      return 'High social activity with multiple competing factions';
    } else if (totalClusters > totalConnections) {
      return 'Fragmented social structure with isolated groups';
    } else {
      return 'Moderate social cohesion with emerging alliances';
    }
  }

  private mapAnomalyToSocialType(
    anomalyType: string
  ):
    | 'alliance'
    | 'conflict'
    | 'influence'
    | 'isolation'
    | 'leadership'
    | 'followership' {
    switch (anomalyType) {
      case 'unexpected_alliance':
        return 'alliance';
      case 'sudden_hostility':
        return 'conflict';
      case 'isolated_behavior':
        return 'isolation';
      case 'influence_shift':
        return 'influence';
      default:
        return 'alliance';
    }
  }

  private conductInvestigation(
    investigator: DeductionPlayer,
    target: DeductionPlayer,
    gameState: DeductionGameState,
    ability: any
  ) {
    const investigation = {
      method: 'interrogation' as const,
      findings: this.generateInvestigationFindings(
        investigator,
        target,
        ability
      ),
      reliability: this.calculateInvestigationReliability(ability),
      limitations: [
        'Information may be incomplete',
        'Subject to interpretation',
      ],
      followUpActions: [
        'Cross-reference with other evidence',
        'Monitor target behavior',
      ],
    };

    return investigation;
  }

  private generateInvestigationFindings(
    investigator: DeductionPlayer,
    target: DeductionPlayer,
    ability: any
  ): string[] {
    const findings: string[] = [];

    // Generate findings based on ability type and target role
    if (ability.ability.type === 'investigate') {
      findings.push(
        `Target shows signs of ${target.gameSpecificData.role.definition.alignment === 'town' ? 'honesty' : 'deception'}`
      );
      findings.push(
        `Behavioral patterns suggest ${target.gameSpecificData.role.definition.type} tendencies`
      );
    }

    return findings;
  }

  private calculateInvestigationReliability(ability: any): number {
    // Calculate reliability based on ability strength
    return 0.8; // Placeholder - should be based on ability configuration
  }

  private analyzeStoryProgression(gameState: DeductionGameState) {
    return {
      tension:
        gameState.data.eliminatedPlayers.length > 0 ? 'high' : 'moderate',
      atmosphere: gameState.data.scenario.theme.includes('dark')
        ? 'ominous'
        : 'mysterious',
      characterMoments: [],
      foreshadowing: [
        `The truth about ${gameState.data.scenario.name} draws closer`,
      ],
      symbolism: undefined,
    };
  }

  private selectHerringType(
    player: DeductionPlayer,
    gameState: DeductionGameState
  ):
    | 'false_evidence'
    | 'misleading_behavior'
    | 'planted_information'
    | 'coincidence'
    | 'misinterpretation' {
    const types: (
      | 'false_evidence'
      | 'misleading_behavior'
      | 'planted_information'
      | 'coincidence'
      | 'misinterpretation'
    )[] = [
      'false_evidence',
      'misleading_behavior',
      'planted_information',
      'coincidence',
      'misinterpretation',
    ];

    return types[Math.floor(Math.random() * types.length)];
  }

  private identifyPossibleSource(
    players: DeductionPlayer[],
    target: DeductionPlayer
  ): UUID | undefined {
    const mafiaPlayers = players.filter(
      p =>
        p.gameSpecificData.role.definition.alignment === 'mafia' &&
        p.id !== target.id
    );

    return mafiaPlayers.length > 0 ? (mafiaPlayers[0].id as UUID) : undefined;
  }

  private calculatePlausibilityScore(
    clue: Clue,
    target: DeductionPlayer,
    gameState: DeductionGameState
  ): number {
    // Calculate how plausible this red herring is
    let score = 0.7; // Base plausibility

    // Increase plausibility if target has been acting suspiciously
    const avgSuspicion =
      Object.values(target.gameSpecificData.suspicions).reduce(
        (sum, val) => sum + val,
        0
      ) / Object.keys(target.gameSpecificData.suspicions).length || 0;
    score += avgSuspicion * 0.3;

    return Math.min(score, 1);
  }

  private generateDisproofMethods(herringType: string): string[] {
    const methods: Record<string, string[]> = {
      false_evidence: ['Verify evidence authenticity', 'Check for tampering'],
      misleading_behavior: [
        'Analyze behavior context',
        'Look for alternative explanations',
      ],
      planted_information: [
        'Trace information source',
        'Check for inconsistencies',
      ],
      coincidence: ['Calculate probability', 'Look for patterns'],
      misinterpretation: [
        'Re-examine original evidence',
        'Consider different perspectives',
      ],
    };

    return methods[herringType] || ['Further investigation required'];
  }

  private generateRequiredEvidence(herringType: string): string[] {
    const evidence: Record<string, string[]> = {
      false_evidence: ['Authentication records', 'Chain of custody'],
      misleading_behavior: ['Behavioral baseline', 'Context information'],
      planted_information: ['Communication logs', 'Timing analysis'],
      coincidence: ['Statistical analysis', 'Pattern recognition'],
      misinterpretation: ['Original source material', 'Expert analysis'],
    };

    return evidence[herringType] || ['Additional investigation'];
  }

  private generateRevealTriggers(
    herringType: string,
    gameState: DeductionGameState
  ): string[] {
    return [
      'Contradictory evidence emerges',
      'Investigation reveals inconsistencies',
      'Alternative explanations become apparent',
    ];
  }

  private generateFallbackBehavioralClues(
    players: DeductionPlayer[],
    gameState: DeductionGameState
  ): BehavioralClue[] {
    // Generate simple behavioral clues if AI fails
    return [];
  }

  private generateFallbackNarrativeClues(
    gameState: DeductionGameState
  ): NarrativeClue[] {
    // Generate simple narrative clues if AI fails
    return [];
  }

  // Parsing methods for AI responses
  private async parseEvidenceResponse(
    content: string,
    player: DeductionPlayer
  ): Promise<Clue> {
    //TODO: Implement robust JSON extraction and fallback content generation
    return {
      id: crypto.randomUUID() as UUID,
      title: 'Evidence Found',
      content: content.substring(0, 200),
      type: 'action_evidence',
      reliability: 'reliable',
      revealConditions: [],
      isRevealed: false,
      targetPlayers: [player.id as UUID],
      verifiability: 'easily_verified',
      informationValue: 7,
      misdirectionLevel: 0,
      narrativeWeight: 5,
      difficulty: 'medium',
      tags: ['evidence', 'investigation'],
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

  private async parseBehaviorResponse(
    content: string,
    player: DeductionPlayer
  ): Promise<Clue> {
    //TODO: Implement robust JSON extraction and fallback content generation
    return {
      id: crypto.randomUUID() as UUID,
      title: 'Behavioral Pattern',
      content: content.substring(0, 200),
      type: 'behavioral',
      reliability: 'unreliable',
      revealConditions: [],
      isRevealed: false,
      targetPlayers: [player.id as UUID],
      verifiability: 'hard_to_verify',
      informationValue: 5,
      misdirectionLevel: 2,
      narrativeWeight: 3,
      difficulty: 'medium',
      tags: ['behavior', 'pattern'],
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

  private async parseSocialResponse(
    content: string,
    players: UUID[]
  ): Promise<Clue> {
    //TODO: Implement robust JSON extraction and fallback content generation
    return {
      id: crypto.randomUUID() as UUID,
      title: 'Social Dynamic',
      content: content.substring(0, 200),
      type: 'relationship',
      reliability: 'reliable',
      revealConditions: [],
      isRevealed: false,
      targetPlayers: players,
      verifiability: 'hard_to_verify',
      informationValue: 6,
      misdirectionLevel: 1,
      narrativeWeight: 4,
      difficulty: 'hard',
      tags: ['social', 'relationship'],
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

  private async parseInvestigationResponse(
    content: string,
    target: DeductionPlayer
  ): Promise<Clue> {
    //TODO: Implement robust JSON extraction and fallback content generation
    return {
      id: crypto.randomUUID() as UUID,
      title: 'Investigation Result',
      content: content.substring(0, 200),
      type: 'action_evidence',
      reliability: 'reliable',
      revealConditions: [],
      isRevealed: false,
      targetPlayers: [target.id as UUID],
      verifiability: 'easily_verified',
      informationValue: 8,
      misdirectionLevel: 0,
      narrativeWeight: 6,
      difficulty: 'easy',
      tags: ['investigation', 'evidence'],
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

  private async parseNarrativeResponse(content: string): Promise<Clue> {
    //TODO: Implement robust JSON extraction and fallback content generation
    return {
      id: crypto.randomUUID() as UUID,
      title: 'Story Element',
      content: content.substring(0, 200),
      type: 'environmental',
      reliability: 'reliable',
      revealConditions: [],
      isRevealed: true,
      targetPlayers: [],
      verifiability: 'unverifiable',
      informationValue: 4,
      misdirectionLevel: 0,
      narrativeWeight: 8,
      difficulty: 'easy',
      tags: ['narrative', 'story'],
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

  private async parseRedHerringResponse(
    content: string,
    target: DeductionPlayer
  ): Promise<Clue> {
    //TODO: Implement robust JSON extraction and fallback content generation
    return {
      id: crypto.randomUUID() as UUID,
      title: 'Suspicious Evidence',
      content: content.substring(0, 200),
      type: 'red_herring',
      reliability: 'misleading',
      revealConditions: [],
      isRevealed: false,
      targetPlayers: [target.id as UUID],
      verifiability: 'hard_to_verify',
      informationValue: 3,
      misdirectionLevel: 8,
      narrativeWeight: 3,
      difficulty: 'hard',
      tags: ['red_herring', 'misdirection'],
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
}

// Export singleton instance
export const clueTypeGenerator = ClueTypeGenerator.getInstance();
