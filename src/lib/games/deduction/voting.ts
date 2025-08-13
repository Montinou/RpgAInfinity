/**
 * Voting System for RpgAInfinity Deduction Game
 *
 * Comprehensive voting mechanics supporting:
 * - Multiple voting phases (discussion, nomination, voting, results)
 * - Real-time vote tracking and consensus checking
 * - Role-based voting abilities and restrictions
 * - Tiebreaker resolution and result processing
 * - Time-limited voting with countdown management
 */

import { z } from 'zod';
import {
  DeductionGameState,
  DeductionPlayer,
  Vote,
  VotingResults,
  TiebreakResult,
  VotingAction,
  UUID,
  Timestamp,
  GameError,
} from '../../../types';
import { kvService } from '../../database';
import { EventSystem } from '../../game-engine/events';

// ============================================================================
// VOTING SYSTEM TYPES & INTERFACES
// ============================================================================

export type VotingPhase =
  | 'discussion'
  | 'nomination'
  | 'voting'
  | 'results'
  | 'completed';

export type VotingMode =
  | 'majority' // Requires >50% of votes
  | 'plurality' // Most votes wins
  | 'consensus' // Requires unanimous agreement
  | 'custom'; // Custom threshold defined by game

export interface VotingSession {
  readonly id: UUID;
  readonly gameId: UUID;
  readonly round: number;
  readonly phase: VotingPhase;
  readonly mode: VotingMode;
  readonly timeLimit: number; // seconds
  readonly timeRemaining: number; // seconds
  readonly startTime: Timestamp;
  readonly endTime?: Timestamp;
  readonly participants: UUID[];
  readonly eligibleVoters: UUID[]; // May be subset based on role abilities
  readonly votes: Vote[];
  readonly nominations: Nomination[];
  readonly abstentions: UUID[];
  readonly isAnonymous: boolean;
  readonly allowsVoteChanging: boolean;
  readonly customThreshold?: number; // For custom voting modes
  readonly results?: VotingResults;
  readonly status: VotingSessionStatus;
}

export interface Nomination {
  readonly nominatorId: UUID;
  readonly nomineeId: UUID;
  readonly timestamp: Timestamp;
  readonly reason?: string;
  readonly isAccepted: boolean; // If nominee accepts nomination
}

export type VotingSessionStatus =
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'extended';

export interface VoteOptions {
  readonly isSecret?: boolean;
  readonly votingPower?: number;
  readonly reason?: string;
  readonly canChange?: boolean;
}

export interface VoteResult {
  readonly success: boolean;
  readonly voteId: UUID;
  readonly timestamp: Timestamp;
  readonly previousVote?: UUID; // If changing vote
  readonly error?: string;
}

export interface ConsensusCheck {
  readonly achieved: boolean;
  readonly type: 'majority' | 'plurality' | 'unanimous' | 'threshold';
  readonly threshold: number;
  readonly currentCount: number;
  readonly requiredCount: number;
  readonly leader?: {
    readonly targetId: UUID;
    readonly voteCount: number;
    readonly percentage: number;
  };
  readonly tied: boolean;
  readonly tiedCandidates?: Array<{
    readonly targetId: UUID;
    readonly voteCount: number;
  }>;
}

export interface GameStateUpdate {
  readonly gameState: DeductionGameState;
  readonly events: GamePhaseEvent[];
  readonly playersAffected: UUID[];
  readonly phaseTransition?: DeductionPhase;
}

// Zod schemas for validation
export const VotingSessionSchema = z.object({
  id: z.string().uuid(),
  gameId: z.string().uuid(),
  round: z.number().int().min(1),
  phase: z.enum(['discussion', 'nomination', 'voting', 'results', 'completed']),
  mode: z.enum(['majority', 'plurality', 'consensus', 'custom']),
  timeLimit: z.number().int().min(30).max(1800), // 30 seconds to 30 minutes
  timeRemaining: z.number().int().min(0),
  startTime: z.number(),
  endTime: z.number().optional(),
  participants: z.array(z.string().uuid()),
  eligibleVoters: z.array(z.string().uuid()),
  votes: z.array(z.any()),
  nominations: z.array(z.any()),
  abstentions: z.array(z.string().uuid()),
  isAnonymous: z.boolean(),
  allowsVoteChanging: z.boolean(),
  customThreshold: z.number().min(1).optional(),
  results: z.any().optional(),
  status: z.enum(['active', 'completed', 'cancelled', 'extended']),
});

export const VoteOptionsSchema = z.object({
  isSecret: z.boolean().optional(),
  votingPower: z.number().int().min(1).max(10).optional(),
  reason: z.string().max(200).optional(),
  canChange: z.boolean().optional(),
});

// ============================================================================
// VOTING SYSTEM IMPLEMENTATION
// ============================================================================

export class VotingSystem {
  private static instance: VotingSystem | null = null;
  private readonly eventSystem: EventSystem;
  private readonly activeSessions: Map<string, VotingSession> = new Map();
  private readonly timers: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {
    this.eventSystem = EventSystem.getInstance();
    this.setupCleanup();
  }

  public static getInstance(): VotingSystem {
    if (!VotingSystem.instance) {
      VotingSystem.instance = new VotingSystem();
    }
    return VotingSystem.instance;
  }

  // ============================================================================
  // CORE VOTING PHASE MANAGEMENT
  // ============================================================================

  /**
   * Start a new voting phase for the game
   */
  public async startVotingPhase(
    game: DeductionGameState,
    phase: VotingPhase,
    options?: {
      timeLimit?: number;
      mode?: VotingMode;
      isAnonymous?: boolean;
      allowsVoteChanging?: boolean;
      customThreshold?: number;
    }
  ): Promise<VotingSession> {
    try {
      // Validate game state
      if (game.phase !== 'day_voting') {
        throw new GameError(
          'INVALID_PHASE',
          'Voting can only be started during day voting phase',
          { currentPhase: game.phase }
        );
      }

      // Get eligible voters (alive players with voting power)
      const eligibleVoters = game.data.alivePlayers.filter(playerId => {
        // TODO: Check for role-specific voting restrictions
        return true;
      });

      if (eligibleVoters.length === 0) {
        throw new GameError(
          'NO_ELIGIBLE_VOTERS',
          'No eligible voters found for voting phase',
          { alivePlayers: game.data.alivePlayers.length }
        );
      }

      const sessionId = crypto.randomUUID();
      const timeLimit = options?.timeLimit ?? 300; // Default 5 minutes
      const startTime = Date.now();

      const session: VotingSession = {
        id: sessionId,
        gameId: game.id,
        round: game.data.round,
        phase,
        mode: options?.mode ?? 'majority',
        timeLimit,
        timeRemaining: timeLimit,
        startTime,
        participants: game.data.alivePlayers,
        eligibleVoters,
        votes: [],
        nominations: [],
        abstentions: [],
        isAnonymous: options?.isAnonymous ?? false,
        allowsVoteChanging: options?.allowsVoteChanging ?? true,
        customThreshold: options?.customThreshold,
        status: 'active',
      };

      // Validate session
      const validatedSession = VotingSessionSchema.parse(session);

      // Store session
      this.activeSessions.set(sessionId, validatedSession as VotingSession);
      await kvService.set(
        `voting_session:${sessionId}`,
        validatedSession,
        24 * 60 * 60
      ); // 24 hour TTL

      // Start timer for voting phase
      this.startVotingTimer(sessionId, timeLimit);

      // Emit voting phase started event
      await this.eventSystem.emit({
        id: crypto.randomUUID(),
        type: 'phase_change',
        gameId: game.id,
        timestamp: Date.now(),
        data: {
          phase: `voting_${phase}`,
          sessionId,
          timeLimit,
          eligibleVoters: eligibleVoters.length,
        },
        playerId: null, // System event
        metadata: {
          votingMode: session.mode,
          isAnonymous: session.isAnonymous,
        },
      });

      return validatedSession as VotingSession;
    } catch (error) {
      //TODO: Implement proper error logging service
      console.error('Failed to start voting phase:', error);
      throw error instanceof GameError
        ? error
        : new GameError(
            'VOTING_START_FAILED',
            'Failed to initialize voting phase',
            { error: error instanceof Error ? error.message : 'Unknown error' }
          );
    }
  }

  /**
   * Cast or change a vote in the current voting session
   */
  public async castVote(
    sessionId: string,
    playerId: string,
    targetId: string,
    options?: VoteOptions
  ): Promise<VoteResult> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        const storedSession = await kvService.get(
          `voting_session:${sessionId}`
        );
        if (!storedSession) {
          throw new GameError('SESSION_NOT_FOUND', 'Voting session not found', {
            sessionId,
          });
        }
        // Restore session to memory
        this.activeSessions.set(sessionId, storedSession as VotingSession);
      }

      const currentSession = this.activeSessions.get(sessionId)!;

      // Validate voting eligibility
      await this.validateVoteEligibility(
        currentSession,
        playerId,
        targetId,
        options
      );

      // Check for existing vote
      const existingVoteIndex = currentSession.votes.findIndex(
        v => v.voterId === playerId
      );
      const previousVoteId =
        existingVoteIndex >= 0
          ? currentSession.votes[existingVoteIndex].voterId
          : undefined;

      // Handle vote changing
      if (existingVoteIndex >= 0) {
        if (!currentSession.allowsVoteChanging) {
          throw new GameError(
            'VOTE_CHANGE_NOT_ALLOWED',
            'Vote changing is not allowed in this session',
            { sessionId, playerId }
          );
        }
        // Remove existing vote
        currentSession.votes.splice(existingVoteIndex, 1);
      }

      // Create new vote
      const voteId = crypto.randomUUID();
      const timestamp = Date.now();
      const votingPower = options?.votingPower ?? 1;

      const newVote: Vote = {
        voterId: playerId,
        targetId:
          targetId === 'abstain'
            ? 'abstain'
            : targetId === 'no_lynch'
              ? 'no_lynch'
              : targetId,
        timestamp,
        votingPower,
        isSecret: options?.isSecret ?? currentSession.isAnonymous,
      };

      // Add vote to session
      currentSession.votes.push(newVote);

      // Handle abstentions
      if (targetId === 'abstain') {
        if (!currentSession.abstentions.includes(playerId)) {
          currentSession.abstentions.push(playerId);
        }
      } else {
        // Remove from abstentions if previously abstaining
        const abstentionIndex = currentSession.abstentions.indexOf(playerId);
        if (abstentionIndex >= 0) {
          currentSession.abstentions.splice(abstentionIndex, 1);
        }
      }

      // Update session in storage
      await kvService.set(
        `voting_session:${sessionId}`,
        currentSession,
        24 * 60 * 60
      );

      // Emit vote cast event
      await this.eventSystem.emit({
        id: crypto.randomUUID(),
        type: 'player_action',
        gameId: currentSession.gameId,
        playerId,
        timestamp,
        data: {
          action: 'cast_vote',
          targetId,
          votingPower,
          isSecret: newVote.isSecret,
          isVoteChange: existingVoteIndex >= 0,
        },
        metadata: {
          sessionId,
          round: currentSession.round,
          reason: options?.reason,
        },
      });

      return {
        success: true,
        voteId,
        timestamp,
        previousVote: previousVoteId,
      };
    } catch (error) {
      //TODO: Implement proper error logging service
      console.error('Failed to cast vote:', error);
      return {
        success: false,
        voteId: crypto.randomUUID(),
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Tally votes and determine current voting results
   */
  public async tallyVotes(sessionId: string): Promise<VotingResults> {
    try {
      const session =
        this.activeSessions.get(sessionId) ??
        ((await kvService.get(`voting_session:${sessionId}`)) as VotingSession);

      if (!session) {
        throw new GameError(
          'SESSION_NOT_FOUND',
          'Voting session not found for tallying',
          { sessionId }
        );
      }

      // Count votes by target
      const voteCounts = new Map<string, number>();
      const votersByTarget = new Map<string, UUID[]>();
      const votingPowerUsed: Record<UUID, number> = {};

      for (const vote of session.votes) {
        const targetId = vote.targetId;
        const currentCount = voteCounts.get(targetId) ?? 0;
        const currentVoters = votersByTarget.get(targetId) ?? [];

        voteCounts.set(targetId, currentCount + vote.votingPower);
        votersByTarget.set(targetId, [...currentVoters, vote.voterId]);
        votingPowerUsed[vote.voterId] = vote.votingPower;
      }

      // Determine winner(s)
      let maxVotes = 0;
      let winners: string[] = [];

      for (const [targetId, voteCount] of voteCounts.entries()) {
        if (targetId === 'abstain' || targetId === 'no_lynch') continue;

        if (voteCount > maxVotes) {
          maxVotes = voteCount;
          winners = [targetId];
        } else if (voteCount === maxVotes && maxVotes > 0) {
          winners.push(targetId);
        }
      }

      // Handle tiebreaker if needed
      let tiebreaker: TiebreakResult | undefined;
      let eliminated: UUID[] = [];

      if (winners.length > 1 && maxVotes > 0) {
        tiebreaker = await this.resolveTiebreaker(session, winners);
        eliminated = tiebreaker.eliminated ? [tiebreaker.eliminated] : [];
      } else if (winners.length === 1) {
        eliminated = [winners[0]];
      } else if (voteCounts.has('no_lynch')) {
        // No lynch wins if it has votes or no one else has votes
        eliminated = [];
      }

      const results: VotingResults = {
        round: session.round,
        votes: session.votes,
        eliminated,
        tiebreaker,
        abstentions: session.abstentions,
        votingPowerUsed,
      };

      // Update session with results
      const updatedSession = {
        ...session,
        results,
        status: 'completed' as VotingSessionStatus,
      };
      this.activeSessions.set(sessionId, updatedSession);
      await kvService.set(
        `voting_session:${sessionId}`,
        updatedSession,
        24 * 60 * 60
      );

      return results;
    } catch (error) {
      //TODO: Implement proper error logging service
      console.error('Failed to tally votes:', error);
      throw error instanceof GameError
        ? error
        : new GameError('VOTE_TALLY_FAILED', 'Failed to tally voting results', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
    }
  }

  /**
   * Process voting results and update game state
   */
  public async processVotingResult(
    result: VotingResults,
    gameId: string
  ): Promise<GameStateUpdate> {
    try {
      // Get current game state
      const gameState = (await kvService.get(
        `game:${gameId}`
      )) as DeductionGameState;
      if (!gameState) {
        throw new GameError('GAME_NOT_FOUND', 'Game state not found', {
          gameId,
        });
      }

      const events: GamePhaseEvent[] = [];
      const playersAffected: UUID[] = [];

      // Process eliminations
      if (result.eliminated.length > 0) {
        for (const playerId of result.eliminated) {
          // Remove from alive players
          const aliveIndex = gameState.data.alivePlayers.indexOf(playerId);
          if (aliveIndex >= 0) {
            gameState.data.alivePlayers.splice(aliveIndex, 1);
            gameState.data.eliminatedPlayers.push(playerId);
            playersAffected.push(playerId);
          }

          // Create elimination event
          events.push({
            id: crypto.randomUUID(),
            type: 'elimination',
            description: `${playerId} was eliminated by vote`,
            timestamp: Date.now(),
            affectedPlayers: [playerId],
            isPublic: true,
            flavorText: `The town has spoken. ${playerId} has been eliminated.`,
          });
        }
      } else {
        // No lynch event
        events.push({
          id: crypto.randomUUID(),
          type: 'phase_change',
          description: 'No player was eliminated this round',
          timestamp: Date.now(),
          affectedPlayers: [],
          isPublic: true,
          flavorText:
            'The town could not reach a decision. No one was eliminated today.',
        });
      }

      // Update voting results in game state
      const updatedGameState: DeductionGameState = {
        ...gameState,
        data: {
          ...gameState.data,
          votingResults: result,
          events: [...gameState.data.events, ...events],
        },
      };

      // Save updated game state
      await kvService.set(`game:${gameId}`, updatedGameState, 7 * 24 * 60 * 60); // 7 day TTL

      // Determine next phase
      let phaseTransition: DeductionPhase | undefined;

      // Check win conditions after elimination
      const winCondition = await this.checkWinConditions(updatedGameState);
      if (winCondition) {
        phaseTransition = 'game_over';
        updatedGameState.data.winCondition = winCondition.condition;
        updatedGameState.data.winner = winCondition.winner;
      } else {
        // Move to night phase
        phaseTransition = 'night_actions';
      }

      const stateUpdate: GameStateUpdate = {
        gameState: updatedGameState,
        events,
        playersAffected,
        phaseTransition,
      };

      // Emit voting complete event
      await this.eventSystem.emit({
        id: crypto.randomUUID(),
        type: 'phase_change',
        gameId,
        timestamp: Date.now(),
        data: {
          phase: 'voting_complete',
          eliminated: result.eliminated,
          nextPhase: phaseTransition,
        },
        playerId: null, // System event
        metadata: {
          totalVotes: result.votes.length,
          abstentions: result.abstentions.length,
        },
      });

      return stateUpdate;
    } catch (error) {
      //TODO: Implement proper error logging service
      console.error('Failed to process voting result:', error);
      throw error instanceof GameError
        ? error
        : new GameError(
            'VOTING_PROCESS_FAILED',
            'Failed to process voting results',
            { error: error instanceof Error ? error.message : 'Unknown error' }
          );
    }
  }

  /**
   * Handle player abstention from voting
   */
  public async handleVotingAbstention(
    sessionId: string,
    playerId: string
  ): Promise<void> {
    try {
      const session =
        this.activeSessions.get(sessionId) ??
        ((await kvService.get(`voting_session:${sessionId}`)) as VotingSession);

      if (!session) {
        throw new GameError('SESSION_NOT_FOUND', 'Voting session not found', {
          sessionId,
        });
      }

      // Check if player is eligible to vote
      if (!session.eligibleVoters.includes(playerId)) {
        throw new GameError(
          'NOT_ELIGIBLE_TO_VOTE',
          'Player is not eligible to vote in this session',
          { sessionId, playerId }
        );
      }

      // Remove any existing votes from this player
      const existingVoteIndex = session.votes.findIndex(
        v => v.voterId === playerId
      );
      if (existingVoteIndex >= 0) {
        session.votes.splice(existingVoteIndex, 1);
      }

      // Add to abstentions if not already there
      if (!session.abstentions.includes(playerId)) {
        session.abstentions.push(playerId);
      }

      // Update session
      await kvService.set(`voting_session:${sessionId}`, session, 24 * 60 * 60);
      this.activeSessions.set(sessionId, session);

      // Emit abstention event
      await this.eventSystem.emit({
        id: crypto.randomUUID(),
        type: 'player_action',
        gameId: session.gameId,
        playerId,
        timestamp: Date.now(),
        data: {
          action: 'abstain_vote',
          sessionId,
        },
        metadata: {
          round: session.round,
        },
      });
    } catch (error) {
      //TODO: Implement proper error logging service
      console.error('Failed to handle voting abstention:', error);
      throw error instanceof GameError
        ? error
        : new GameError(
            'ABSTENTION_FAILED',
            'Failed to process vote abstention',
            { error: error instanceof Error ? error.message : 'Unknown error' }
          );
    }
  }

  /**
   * Check if voting consensus has been reached
   */
  public async checkVotingConsensus(
    sessionId: string
  ): Promise<ConsensusCheck> {
    try {
      const session =
        this.activeSessions.get(sessionId) ??
        ((await kvService.get(`voting_session:${sessionId}`)) as VotingSession);

      if (!session) {
        throw new GameError('SESSION_NOT_FOUND', 'Voting session not found', {
          sessionId,
        });
      }

      const totalEligibleVoters = session.eligibleVoters.length;
      const totalVotes = session.votes.length;
      const totalAbstentions = session.abstentions.length;
      const votesNeeded = totalEligibleVoters - totalAbstentions;

      // Count votes by target
      const voteCounts = new Map<string, number>();
      for (const vote of session.votes) {
        const targetId = vote.targetId;
        const currentCount = voteCounts.get(targetId) ?? 0;
        voteCounts.set(targetId, currentCount + vote.votingPower);
      }

      // Find leader
      let maxVotes = 0;
      let leader:
        | { targetId: UUID; voteCount: number; percentage: number }
        | undefined;
      let tiedCandidates: Array<{ targetId: UUID; voteCount: number }> = [];

      for (const [targetId, voteCount] of voteCounts.entries()) {
        if (targetId === 'abstain') continue;

        const percentage =
          votesNeeded > 0 ? (voteCount / votesNeeded) * 100 : 0;

        if (voteCount > maxVotes) {
          maxVotes = voteCount;
          leader = { targetId, voteCount, percentage };
          tiedCandidates = [];
        } else if (voteCount === maxVotes && maxVotes > 0) {
          if (!tiedCandidates.length && leader) {
            tiedCandidates.push({
              targetId: leader.targetId,
              voteCount: leader.voteCount,
            });
          }
          tiedCandidates.push({ targetId, voteCount });
        }
      }

      // Determine consensus based on voting mode
      let achieved = false;
      let type: 'majority' | 'plurality' | 'unanimous' | 'threshold' =
        'majority';
      let threshold = 0;
      let requiredCount = 0;

      switch (session.mode) {
        case 'majority':
          type = 'majority';
          threshold = 0.5;
          requiredCount = Math.ceil(votesNeeded * threshold);
          achieved = leader !== undefined && leader.voteCount >= requiredCount;
          break;

        case 'plurality':
          type = 'plurality';
          // Plurality achieved when all eligible voters have voted or abstained
          achieved = totalVotes + totalAbstentions >= totalEligibleVoters;
          requiredCount = totalEligibleVoters;
          break;

        case 'consensus':
          type = 'unanimous';
          threshold = 1.0;
          requiredCount = votesNeeded;
          achieved = leader !== undefined && leader.voteCount >= requiredCount;
          break;

        case 'custom':
          type = 'threshold';
          threshold = (session.customThreshold ?? 0.5) / 100;
          requiredCount = Math.ceil(votesNeeded * threshold);
          achieved = leader !== undefined && leader.voteCount >= requiredCount;
          break;
      }

      return {
        achieved,
        type,
        threshold,
        currentCount: totalVotes,
        requiredCount,
        leader,
        tied: tiedCandidates.length > 1,
        tiedCandidates: tiedCandidates.length > 1 ? tiedCandidates : undefined,
      };
    } catch (error) {
      //TODO: Implement proper error logging service
      console.error('Failed to check voting consensus:', error);
      throw error instanceof GameError
        ? error
        : new GameError(
            'CONSENSUS_CHECK_FAILED',
            'Failed to check voting consensus',
            { error: error instanceof Error ? error.message : 'Unknown error' }
          );
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Validate if a player can cast a vote
   */
  private async validateVoteEligibility(
    session: VotingSession,
    playerId: string,
    targetId: string,
    options?: VoteOptions
  ): Promise<void> {
    // Check if session is active
    if (session.status !== 'active') {
      throw new GameError(
        'SESSION_NOT_ACTIVE',
        'Voting session is not currently active',
        { sessionId: session.id, status: session.status }
      );
    }

    // Check if player is eligible to vote
    if (!session.eligibleVoters.includes(playerId)) {
      throw new GameError(
        'NOT_ELIGIBLE_TO_VOTE',
        'Player is not eligible to vote in this session',
        { sessionId: session.id, playerId }
      );
    }

    // Check if voting phase allows voting
    if (session.phase !== 'voting') {
      throw new GameError(
        'INVALID_VOTING_PHASE',
        'Voting is not allowed in current phase',
        { sessionId: session.id, phase: session.phase }
      );
    }

    // Check time limit
    if (session.timeRemaining <= 0) {
      throw new GameError('VOTING_TIME_EXPIRED', 'Voting time has expired', {
        sessionId: session.id,
        timeRemaining: session.timeRemaining,
      });
    }

    // Validate target (if not abstain or no_lynch)
    if (targetId !== 'abstain' && targetId !== 'no_lynch') {
      if (!session.participants.includes(targetId)) {
        throw new GameError(
          'INVALID_VOTE_TARGET',
          'Vote target is not a valid participant',
          { sessionId: session.id, targetId }
        );
      }

      // Players cannot vote for themselves (unless specified by role)
      if (targetId === playerId) {
        // TODO: Check if role allows self-voting
        throw new GameError(
          'SELF_VOTE_NOT_ALLOWED',
          'Players cannot vote for themselves',
          { sessionId: session.id, playerId }
        );
      }
    }

    // Validate voting power
    const votingPower = options?.votingPower ?? 1;
    if (votingPower < 1 || votingPower > 10) {
      throw new GameError(
        'INVALID_VOTING_POWER',
        'Voting power must be between 1 and 10',
        { sessionId: session.id, votingPower }
      );
    }

    // TODO: Add role-specific voting restrictions validation
  }

  /**
   * Resolve tiebreaker between tied candidates
   */
  private async resolveTiebreaker(
    session: VotingSession,
    tiedCandidates: string[]
  ): Promise<TiebreakResult> {
    // Default tiebreaker method is random
    // TODO: Implement more sophisticated tiebreaker methods based on game rules

    const method: TiebreakResult['method'] = 'random';
    let eliminated: UUID | undefined;
    let explanation: string;

    switch (method) {
      case 'random':
        eliminated =
          tiedCandidates[Math.floor(Math.random() * tiedCandidates.length)];
        explanation = `Random selection from ${tiedCandidates.length} tied candidates`;
        break;

      case 'no_elimination':
        eliminated = undefined;
        explanation = 'No elimination due to tie';
        break;

      default:
        eliminated = undefined;
        explanation = 'Tiebreaker method not implemented';
    }

    return {
      method,
      eliminated,
      explanation,
    };
  }

  /**
   * Check win conditions after voting
   */
  private async checkWinConditions(
    gameState: DeductionGameState
  ): Promise<{ condition: WinCondition; winner: string } | null> {
    // TODO: Implement proper win condition checking based on roles and alignments
    // This is a placeholder implementation

    const alivePlayers = gameState.data.alivePlayers;

    // Check if game should end (too few players)
    if (alivePlayers.length <= 2) {
      return {
        condition: {
          id: 'minimum_players',
          alignment: 'town',
          type: 'majority_control',
          description: 'Game ended due to insufficient players',
          requirements: [],
          priority: 1,
        },
        winner: 'draw',
      };
    }

    return null;
  }

  /**
   * Start countdown timer for voting phase
   */
  private startVotingTimer(sessionId: string, timeLimit: number): void {
    // Clear existing timer if any
    const existingTimer = this.timers.get(sessionId);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    // Update time remaining every second
    const timer = setInterval(async () => {
      const session = this.activeSessions.get(sessionId);
      if (!session || session.status !== 'active') {
        clearInterval(timer);
        this.timers.delete(sessionId);
        return;
      }

      const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
      const timeRemaining = Math.max(0, timeLimit - elapsed);

      // Update session time
      session.timeRemaining = timeRemaining;
      this.activeSessions.set(sessionId, session);

      // Emit time update event
      await this.eventSystem.emit({
        id: crypto.randomUUID(),
        type: 'system_info',
        gameId: session.gameId,
        timestamp: Date.now(),
        data: {
          timeRemaining,
          sessionId,
        },
        playerId: null,
        metadata: {
          timerUpdate: true,
        },
      });

      // End voting when time expires
      if (timeRemaining <= 0) {
        clearInterval(timer);
        this.timers.delete(sessionId);

        // Auto-tally votes
        try {
          await this.tallyVotes(sessionId);

          // Emit voting ended event
          await this.eventSystem.emit({
            id: crypto.randomUUID(),
            type: 'phase_change',
            gameId: session.gameId,
            timestamp: Date.now(),
            data: {
              phase: 'voting_ended',
              reason: 'time_expired',
              sessionId,
            },
            playerId: null,
            metadata: {},
          });
        } catch (error) {
          //TODO: Implement proper error logging service
          console.error('Failed to auto-tally votes on timer expiry:', error);
        }
      }
    }, 1000); // Update every second

    this.timers.set(sessionId, timer);
  }

  /**
   * Setup cleanup for expired sessions and timers
   */
  private setupCleanup(): void {
    // Clean up expired sessions every 5 minutes
    setInterval(
      () => {
        const now = Date.now();

        for (const [sessionId, session] of this.activeSessions.entries()) {
          const sessionAge = now - session.startTime;
          const maxAge = 2 * 60 * 60 * 1000; // 2 hours

          if (sessionAge > maxAge || session.status === 'completed') {
            this.activeSessions.delete(sessionId);

            // Clear timer if exists
            const timer = this.timers.get(sessionId);
            if (timer) {
              clearInterval(timer);
              this.timers.delete(sessionId);
            }
          }
        }
      },
      5 * 60 * 1000
    ); // Every 5 minutes
  }

  // ============================================================================
  // PUBLIC UTILITY METHODS
  // ============================================================================

  /**
   * Get current voting session for a game
   */
  public async getActiveSession(gameId: string): Promise<VotingSession | null> {
    // Check in-memory sessions first
    for (const session of this.activeSessions.values()) {
      if (session.gameId === gameId && session.status === 'active') {
        return session;
      }
    }

    // Check KV storage for active sessions
    // TODO: Implement more efficient session lookup by gameId index
    return null;
  }

  /**
   * Get voting statistics for a session
   */
  public getSessionStatistics(sessionId: string): {
    totalVotes: number;
    participation: number;
    abstentions: number;
    timeUsed: number;
  } | null {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    const timeUsed = Math.floor((Date.now() - session.startTime) / 1000);
    const participation =
      (session.votes.length / session.eligibleVoters.length) * 100;

    return {
      totalVotes: session.votes.length,
      participation: Math.min(100, participation),
      abstentions: session.abstentions.length,
      timeUsed,
    };
  }

  /**
   * Extend voting time for a session
   */
  public async extendVotingTime(
    sessionId: string,
    additionalSeconds: number
  ): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== 'active') {
      return false;
    }

    // Extend time limit
    session.timeLimit += additionalSeconds;
    session.timeRemaining += additionalSeconds;
    session.status = 'extended';

    // Update session
    await kvService.set(`voting_session:${sessionId}`, session, 24 * 60 * 60);
    this.activeSessions.set(sessionId, session);

    // Emit extension event
    await this.eventSystem.emit({
      id: crypto.randomUUID(),
      type: 'system_info',
      gameId: session.gameId,
      timestamp: Date.now(),
      data: {
        votingTimeExtended: additionalSeconds,
        newTimeLimit: session.timeLimit,
        sessionId,
      },
      playerId: null,
      metadata: {},
    });

    return true;
  }
}

// Export singleton instance
export const votingSystem = VotingSystem.getInstance();
