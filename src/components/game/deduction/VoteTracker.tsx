'use client';

/**
 * VoteTracker Component for RpgAInfinity Deduction Game
 *
 * Real-time vote tracking and display featuring:
 * - Live vote tallies and visual indicators
 * - Player vote history and patterns
 * - Consensus progress and winning conditions
 * - Interactive vote distribution charts
 * - Anonymous vs public vote handling
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  VotingSession,
  Vote,
  DeductionPlayer,
  ConsensusCheck,
  UUID,
} from '../../../types';
import { votingSystem } from '../../../lib/games/deduction/voting';
import { EventSystem } from '../../../lib/game-engine/events';

// ============================================================================
// COMPONENT TYPES & INTERFACES
// ============================================================================

export interface VoteTrackerProps {
  readonly session: VotingSession;
  readonly players: DeductionPlayer[];
  readonly currentPlayerId: UUID;
  readonly showVoterNames?: boolean;
  readonly showRealTimeUpdates?: boolean;
  readonly compact?: boolean;
  readonly className?: string;
}

interface VoteCount {
  readonly targetId: UUID | 'abstain' | 'no_lynch';
  readonly targetName: string;
  readonly votes: number;
  readonly voters: UUID[];
  readonly percentage: number;
  readonly isLeading: boolean;
  readonly isTied: boolean;
}

interface VotingStats {
  readonly totalVotes: number;
  readonly totalEligibleVoters: number;
  readonly participation: number;
  readonly abstentions: number;
  readonly timeElapsed: number;
  readonly consensus: ConsensusCheck | null;
}

interface VoteAnimation {
  readonly type: 'new_vote' | 'vote_change' | 'vote_removed';
  readonly targetId: UUID | 'abstain' | 'no_lynch';
  readonly timestamp: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function VoteTracker({
  session,
  players,
  currentPlayerId,
  showVoterNames = false,
  showRealTimeUpdates = true,
  compact = false,
  className = '',
}: VoteTrackerProps) {
  // State management
  const [votingStats, setVotingStats] = useState<VotingStats>({
    totalVotes: session.votes.length,
    totalEligibleVoters: session.eligibleVoters.length,
    participation: 0,
    abstentions: session.abstentions.length,
    timeElapsed: 0,
    consensus: null,
  });

  const [animations, setAnimations] = useState<VoteAnimation[]>([]);
  const [lastVoteCount, setLastVoteCount] = useState(session.votes.length);

  // Event system for real-time updates
  const eventSystem = EventSystem.getInstance();

  // ============================================================================
  // EFFECT HOOKS
  // ============================================================================

  // Initialize and subscribe to events
  useEffect(() => {
    updateStats();

    if (showRealTimeUpdates) {
      const unsubscribe = eventSystem.subscribe(
        'player_action',
        handleVotingEvent
      );
      return unsubscribe;
    }
  }, [session.id, showRealTimeUpdates]);

  // Update stats when session changes
  useEffect(() => {
    updateStats();

    // Detect vote changes for animations
    if (session.votes.length !== lastVoteCount) {
      if (session.votes.length > lastVoteCount) {
        // New vote
        const newVote = session.votes[session.votes.length - 1];
        addAnimation('new_vote', newVote.targetId);
      }
      setLastVoteCount(session.votes.length);
    }
  }, [session.votes, lastVoteCount]);

  // ============================================================================
  // EVENT HANDLERS & UPDATES
  // ============================================================================

  const handleVotingEvent = useCallback(
    (event: any) => {
      if (event.gameId !== session.gameId || !event.data) return;

      const { action, targetId, isVoteChange } = event.data;

      if (action === 'cast_vote') {
        const animationType = isVoteChange ? 'vote_change' : 'new_vote';
        addAnimation(animationType, targetId);

        // Update stats after a brief delay to allow for state updates
        setTimeout(updateStats, 100);
      }
    },
    [session.gameId]
  );

  const updateStats = useCallback(async () => {
    try {
      const participation =
        session.eligibleVoters.length > 0
          ? (session.votes.length / session.eligibleVoters.length) * 100
          : 0;

      const timeElapsed = Math.floor((Date.now() - session.startTime) / 1000);

      // Get current consensus
      const consensus = await votingSystem.checkVotingConsensus(session.id);

      setVotingStats({
        totalVotes: session.votes.length,
        totalEligibleVoters: session.eligibleVoters.length,
        participation: Math.min(100, participation),
        abstentions: session.abstentions.length,
        timeElapsed,
        consensus,
      });
    } catch (error) {
      console.error('Failed to update voting stats:', error);
    }
  }, [session]);

  const addAnimation = useCallback(
    (type: VoteAnimation['type'], targetId: UUID | 'abstain' | 'no_lynch') => {
      const animation: VoteAnimation = {
        type,
        targetId,
        timestamp: Date.now(),
      };

      setAnimations(prev => [...prev, animation]);

      // Remove animation after 3 seconds
      setTimeout(() => {
        setAnimations(prev =>
          prev.filter(a => a.timestamp !== animation.timestamp)
        );
      }, 3000);
    },
    []
  );

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const voteCounts = useMemo((): VoteCount[] => {
    const counts = new Map<string, { votes: number; voters: UUID[] }>();

    // Count votes
    for (const vote of session.votes) {
      const targetId = vote.targetId;
      const current = counts.get(targetId) || { votes: 0, voters: [] };
      counts.set(targetId, {
        votes: current.votes + vote.votingPower,
        voters: [...current.voters, vote.voterId],
      });
    }

    const totalVotes = session.votes.reduce(
      (sum, vote) => sum + vote.votingPower,
      0
    );
    const results: VoteCount[] = [];

    // Find max votes for leading calculation
    let maxVotes = 0;
    for (const { votes } of counts.values()) {
      maxVotes = Math.max(maxVotes, votes);
    }

    // Count how many candidates have max votes (for tie detection)
    const leadersCount = Array.from(counts.values()).filter(
      ({ votes }) => votes === maxVotes
    ).length;

    // Process each vote target
    for (const [targetId, { votes, voters }] of counts.entries()) {
      const targetName = getTargetName(targetId);
      const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
      const isLeading = votes === maxVotes && votes > 0;
      const isTied = isLeading && leadersCount > 1;

      results.push({
        targetId,
        targetName,
        votes,
        voters,
        percentage,
        isLeading,
        isTied,
      });
    }

    // Sort by votes (descending), then by name
    return results.sort((a, b) => {
      if (a.votes !== b.votes) return b.votes - a.votes;
      return a.targetName.localeCompare(b.targetName);
    });
  }, [session.votes]);

  const getTargetName = useCallback(
    (targetId: string): string => {
      if (targetId === 'abstain') return 'Abstain';
      if (targetId === 'no_lynch') return 'No Lynch';

      const player = players.find(p => p.id === targetId);
      return player ? player.name : 'Unknown Player';
    },
    [players]
  );

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderVoteBar = (voteCount: VoteCount) => {
    const hasAnimation = animations.some(
      a => a.targetId === voteCount.targetId
    );
    const maxBarWidth = Math.max(...voteCounts.map(v => v.votes));
    const barWidth =
      maxBarWidth > 0 ? (voteCount.votes / maxBarWidth) * 100 : 0;

    return (
      <div
        key={voteCount.targetId}
        className={`mb-3 rounded-lg p-3 transition-all duration-500 ${
          voteCount.isLeading
            ? voteCount.isTied
              ? 'border-2 border-yellow-300 bg-yellow-50'
              : 'border-2 border-green-300 bg-green-50'
            : 'border border-gray-200 bg-gray-50'
        } ${hasAnimation ? 'ring-2 ring-blue-400 ring-opacity-75' : ''}`}
      >
        <div className='mb-2 flex items-center justify-between'>
          <div className='flex items-center space-x-3'>
            <span
              className={`font-medium ${
                voteCount.isLeading ? 'text-gray-900' : 'text-gray-700'
              }`}
            >
              {voteCount.targetName}
            </span>

            {voteCount.isLeading && (
              <span
                className={`rounded-full px-2 py-1 text-xs ${
                  voteCount.isTied
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-green-100 text-green-800'
                }`}
              >
                {voteCount.isTied ? 'Tied' : 'Leading'}
              </span>
            )}

            {hasAnimation && (
              <span className='animate-pulse rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800'>
                New Vote!
              </span>
            )}
          </div>

          <div className='flex items-center space-x-3'>
            <span className='text-sm text-gray-600'>
              {voteCount.percentage.toFixed(1)}%
            </span>
            <span
              className={`font-bold ${
                voteCount.isLeading ? 'text-gray-900' : 'text-gray-700'
              }`}
            >
              {voteCount.votes}
            </span>
          </div>
        </div>

        {/* Vote Progress Bar */}
        <div className='mb-2 h-2 w-full rounded-full bg-gray-200'>
          <div
            className={`h-2 rounded-full transition-all duration-700 ${
              voteCount.isLeading
                ? voteCount.isTied
                  ? 'bg-yellow-400'
                  : 'bg-green-400'
                : 'bg-blue-400'
            }`}
            style={{ width: `${barWidth}%` }}
          />
        </div>

        {/* Voter Names (if enabled and not anonymous) */}
        {showVoterNames &&
          !session.isAnonymous &&
          voteCount.voters.length > 0 && (
            <div className='text-xs text-gray-600'>
              <span className='font-medium'>Voters:</span>{' '}
              {voteCount.voters
                .map(voterId => {
                  const voter = players.find(p => p.id === voterId);
                  return voter ? voter.name : 'Unknown';
                })
                .join(', ')}
            </div>
          )}
      </div>
    );
  };

  const renderConsensusIndicator = () => {
    if (!votingStats.consensus) return null;

    const { consensus } = votingStats;
    const progress =
      consensus.requiredCount > 0
        ? (consensus.currentCount / consensus.requiredCount) * 100
        : 0;

    return (
      <div
        className={`rounded-lg p-4 ${
          consensus.achieved
            ? 'border border-green-200 bg-green-50'
            : 'border border-blue-200 bg-blue-50'
        }`}
      >
        <div className='mb-3 flex items-center justify-between'>
          <h4 className='font-medium text-gray-900'>Consensus Progress</h4>
          <span
            className={`rounded-full px-2 py-1 text-xs ${
              consensus.achieved
                ? 'bg-green-100 text-green-800'
                : 'bg-blue-100 text-blue-800'
            }`}
          >
            {consensus.type.charAt(0).toUpperCase() + consensus.type.slice(1)}
          </span>
        </div>

        <div className='space-y-2'>
          <div className='flex justify-between text-sm text-gray-600'>
            <span>Progress</span>
            <span>
              {consensus.currentCount} / {consensus.requiredCount}
            </span>
          </div>

          <div className='h-2 w-full rounded-full bg-gray-200'>
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                consensus.achieved ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>

          {consensus.leader && (
            <div className='mt-2 text-xs text-gray-600'>
              Current leader:{' '}
              <span className='font-medium'>
                {getTargetName(consensus.leader.targetId)}
              </span>{' '}
              ({consensus.leader.voteCount} votes)
            </div>
          )}

          {consensus.tied && (
            <div className='mt-2 text-xs text-amber-600'>
              ⚠️ Multiple candidates tied for the lead
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderStatsSummary = () => {
    return (
      <div className='mb-6 grid grid-cols-2 gap-4 md:grid-cols-4'>
        <div className='rounded-lg bg-gray-50 p-3 text-center'>
          <div className='text-2xl font-bold text-gray-900'>
            {votingStats.totalVotes}
          </div>
          <div className='text-sm text-gray-600'>Total Votes</div>
        </div>

        <div className='rounded-lg bg-gray-50 p-3 text-center'>
          <div className='text-2xl font-bold text-blue-600'>
            {votingStats.participation.toFixed(0)}%
          </div>
          <div className='text-sm text-gray-600'>Participation</div>
        </div>

        <div className='rounded-lg bg-gray-50 p-3 text-center'>
          <div className='text-2xl font-bold text-gray-700'>
            {votingStats.abstentions}
          </div>
          <div className='text-sm text-gray-600'>Abstentions</div>
        </div>

        <div className='rounded-lg bg-gray-50 p-3 text-center'>
          <div className='text-2xl font-bold text-green-600'>
            {Math.floor(votingStats.timeElapsed / 60)}:
            {(votingStats.timeElapsed % 60).toString().padStart(2, '0')}
          </div>
          <div className='text-sm text-gray-600'>Elapsed</div>
        </div>
      </div>
    );
  };

  const renderCompactView = () => {
    const topVotes = voteCounts.slice(0, 3);

    return (
      <div
        className={`rounded-lg border border-gray-200 bg-white p-4 ${className}`}
      >
        <div className='mb-3 flex items-center justify-between'>
          <h3 className='font-medium text-gray-900'>Vote Tracker</h3>
          <span className='text-sm text-gray-600'>
            {votingStats.totalVotes}/{votingStats.totalEligibleVoters} votes
          </span>
        </div>

        <div className='space-y-2'>
          {topVotes.map(voteCount => (
            <div
              key={voteCount.targetId}
              className='flex items-center justify-between'
            >
              <span
                className={`text-sm ${
                  voteCount.isLeading
                    ? 'font-medium text-gray-900'
                    : 'text-gray-700'
                }`}
              >
                {voteCount.targetName}
                {voteCount.isLeading && (
                  <span className='ml-1 text-xs text-green-600'>
                    {voteCount.isTied ? '(tied)' : '(leading)'}
                  </span>
                )}
              </span>
              <span className='font-medium text-gray-900'>
                {voteCount.votes}
              </span>
            </div>
          ))}
        </div>

        {votingStats.consensus?.achieved && (
          <div className='mt-3 border-t border-gray-200 pt-3'>
            <span className='text-xs font-medium text-green-600'>
              ✓ Consensus reached
            </span>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  if (compact) {
    return renderCompactView();
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className='rounded-lg border border-gray-200 bg-white p-6'>
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='text-xl font-bold text-gray-900'>Vote Tracker</h2>
          <div className='flex items-center space-x-2 text-sm text-gray-600'>
            {session.isAnonymous && (
              <span className='rounded-full bg-yellow-100 px-2 py-1 text-yellow-800'>
                Anonymous Voting
              </span>
            )}
            <span>Round {session.round}</span>
          </div>
        </div>

        {/* Statistics Summary */}
        {renderStatsSummary()}

        {/* Consensus Indicator */}
        {renderConsensusIndicator()}
      </div>

      {/* Vote Distribution */}
      <div className='rounded-lg border border-gray-200 bg-white p-6'>
        <h3 className='mb-4 text-lg font-semibold text-gray-900'>
          Current Votes
        </h3>

        {voteCounts.length === 0 ? (
          <div className='py-8 text-center text-gray-500'>
            No votes cast yet
          </div>
        ) : (
          <div className='space-y-1'>{voteCounts.map(renderVoteBar)}</div>
        )}

        {/* Voting Progress */}
        {votingStats.totalEligibleVoters > 0 && (
          <div className='mt-6 border-t border-gray-200 pt-4'>
            <div className='mb-2 flex items-center justify-between'>
              <span className='text-sm text-gray-600'>Voting Progress</span>
              <span className='text-sm font-medium text-gray-900'>
                {votingStats.totalVotes} / {votingStats.totalEligibleVoters}{' '}
                players voted
              </span>
            </div>
            <div className='h-2 w-full rounded-full bg-gray-200'>
              <div
                className='h-2 rounded-full bg-blue-500 transition-all duration-300'
                style={{ width: `${votingStats.participation}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Voting Session Info */}
      <div className='rounded-lg border border-gray-200 bg-gray-50 p-4'>
        <div className='grid grid-cols-2 gap-4 text-sm md:grid-cols-4'>
          <div>
            <span className='text-gray-600'>Voting Mode:</span>
            <div className='font-medium capitalize'>{session.mode}</div>
          </div>
          <div>
            <span className='text-gray-600'>Vote Changes:</span>
            <div className='font-medium'>
              {session.allowsVoteChanging ? 'Allowed' : 'Not Allowed'}
            </div>
          </div>
          <div>
            <span className='text-gray-600'>Eligible Voters:</span>
            <div className='font-medium'>{session.eligibleVoters.length}</div>
          </div>
          <div>
            <span className='text-gray-600'>Session Status:</span>
            <div
              className={`font-medium capitalize ${
                session.status === 'active' ? 'text-green-600' : 'text-gray-600'
              }`}
            >
              {session.status}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
