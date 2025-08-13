'use client';

/**
 * VotingInterface Component for RpgAInfinity Deduction Game
 *
 * Main voting UI component featuring:
 * - Interactive player selection and voting
 * - Real-time vote tracking and updates
 * - Countdown timers and phase management
 * - Vote confirmation and change handling
 * - Accessibility and keyboard navigation
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DeductionPlayer,
  VotingSession,
  VoteResult,
  ConsensusCheck,
  UUID,
} from '../../../types';
import { votingSystem } from '../../../lib/games/deduction/voting';
import { EventSystem } from '../../../lib/game-engine/events';

// ============================================================================
// COMPONENT TYPES & INTERFACES
// ============================================================================

export interface VotingInterfaceProps {
  readonly session: VotingSession;
  readonly players: DeductionPlayer[];
  readonly currentPlayerId: UUID;
  readonly onVotecast?: (result: VoteResult) => void;
  readonly onError?: (error: string) => void;
  readonly disabled?: boolean;
  readonly className?: string;
}

interface VotingState {
  selectedTarget: UUID | 'abstain' | 'no_lynch' | null;
  previousVote: UUID | 'abstain' | 'no_lynch' | null;
  isSubmitting: boolean;
  canChangeVote: boolean;
  votingReason: string;
  showConfirmation: boolean;
  consensus: ConsensusCheck | null;
  timeRemaining: number;
  lastUpdate: number;
}

interface PlayerVoteOption {
  id: UUID | 'abstain' | 'no_lynch';
  name: string;
  type: 'player' | 'system';
  isAlive: boolean;
  isEligible: boolean;
  currentVotes: number;
  isCurrentVote: boolean;
  suspicionLevel?: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function VotingInterface({
  session,
  players,
  currentPlayerId,
  onVotecast,
  onError,
  disabled = false,
  className = '',
}: VotingInterfaceProps) {
  // State management
  const [votingState, setVotingState] = useState<VotingState>({
    selectedTarget: null,
    previousVote: null,
    isSubmitting: false,
    canChangeVote: session.allowsVoteChanging,
    votingReason: '',
    showConfirmation: false,
    consensus: null,
    timeRemaining: session.timeRemaining,
    lastUpdate: Date.now(),
  });

  // Refs for timer and event system
  const eventSystemRef = useRef<EventSystem>(EventSystem.getInstance());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================================
  // EFFECT HOOKS
  // ============================================================================

  // Initialize component and existing vote
  useEffect(() => {
    const currentPlayerVote = session.votes.find(
      v => v.voterId === currentPlayerId
    );
    if (currentPlayerVote) {
      setVotingState(prev => ({
        ...prev,
        selectedTarget: currentPlayerVote.targetId,
        previousVote: currentPlayerVote.targetId,
      }));
    }

    // Check initial consensus
    updateConsensus();

    // Subscribe to voting events
    const unsubscribe = eventSystemRef.current.subscribe(
      'system_info',
      handleVotingEvents
    );

    // Start timer updates
    startTimerUpdates();

    return () => {
      unsubscribe();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [session.id, currentPlayerId]);

  // Update consensus when votes change
  useEffect(() => {
    updateConsensus();
  }, [session.votes]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleVotingEvents = useCallback(
    (event: any) => {
      if (event.data?.sessionId !== session.id) return;

      if (event.data?.timerUpdate) {
        setVotingState(prev => ({
          ...prev,
          timeRemaining: event.data.timeRemaining,
          lastUpdate: Date.now(),
        }));
      }

      if (event.data?.votingTimeExtended) {
        setVotingState(prev => ({
          ...prev,
          timeRemaining: prev.timeRemaining + event.data.votingTimeExtended,
        }));
      }
    },
    [session.id]
  );

  const handlePlayerSelect = useCallback(
    (targetId: UUID | 'abstain' | 'no_lynch') => {
      if (disabled || votingState.isSubmitting) return;

      setVotingState(prev => ({
        ...prev,
        selectedTarget: targetId,
      }));
    },
    [disabled, votingState.isSubmitting]
  );

  const handleReasonChange = useCallback((reason: string) => {
    setVotingState(prev => ({
      ...prev,
      votingReason: reason.slice(0, 200), // Limit to 200 characters
    }));
  }, []);

  const handleVoteSubmit = useCallback(async () => {
    if (!votingState.selectedTarget || votingState.isSubmitting || disabled)
      return;

    // Show confirmation if changing vote or voting for the first time
    if (!votingState.showConfirmation) {
      // Add selection sound effect
      playVoteSound('select');
      setVotingState(prev => ({ ...prev, showConfirmation: true }));
      return;
    }

    setVotingState(prev => ({ ...prev, isSubmitting: true }));

    try {
      const result = await votingSystem.castVote(
        session.id,
        currentPlayerId,
        votingState.selectedTarget,
        {
          reason: votingState.votingReason || undefined,
          isSecret: session.isAnonymous,
        }
      );

      if (result.success) {
        // Add success sound and haptic feedback
        playVoteSound('success');
        triggerHapticFeedback('success');

        setVotingState(prev => ({
          ...prev,
          previousVote: votingState.selectedTarget,
          isSubmitting: false,
          showConfirmation: false,
          votingReason: '',
        }));

        // Update session votes
        updateConsensus();

        onVotecast?.(result);
      } else {
        throw new Error(result.error || 'Failed to cast vote');
      }
    } catch (error) {
      // Add error sound and haptic feedback
      playVoteSound('error');
      triggerHapticFeedback('error');

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown voting error';
      onError?.(errorMessage);

      setVotingState(prev => ({
        ...prev,
        isSubmitting: false,
        showConfirmation: false,
      }));
    }
  }, [
    votingState.selectedTarget,
    votingState.isSubmitting,
    votingState.showConfirmation,
    votingState.votingReason,
    disabled,
    session.id,
    session.isAnonymous,
    currentPlayerId,
    onVotecast,
    onError,
  ]);

  const handleVoteCancel = useCallback(() => {
    setVotingState(prev => ({
      ...prev,
      selectedTarget: prev.previousVote,
      showConfirmation: false,
      votingReason: '',
    }));
  }, []);

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const playVoteSound = useCallback((type: 'select' | 'success' | 'error') => {
    // TODO: Implement actual audio playback with Web Audio API
    // For now, just log the sound effect
    if (typeof window !== 'undefined' && 'Audio' in window) {
      try {
        const soundMap = {
          select: '/sounds/vote-select.mp3',
          success: '/sounds/vote-success.mp3',
          error: '/sounds/vote-error.mp3',
        };

        const audio = new Audio(soundMap[type]);
        audio.volume = 0.3; // Keep sounds subtle
        audio.play().catch(() => {
          // Ignore audio play errors (user interaction required)
        });
      } catch (error) {
        // Audio not supported or failed
        console.debug('Vote sound not played:', type);
      }
    }
  }, []);

  const triggerHapticFeedback = useCallback((type: 'success' | 'error') => {
    if (
      typeof window !== 'undefined' &&
      'navigator' in window &&
      'vibrate' in navigator
    ) {
      try {
        const vibrationPatterns = {
          success: [50, 30, 50], // Short-pause-short
          error: [100, 50, 100, 50, 100], // Long-pause-long-pause-long
        };

        navigator.vibrate(vibrationPatterns[type]);
      } catch (error) {
        // Haptics not supported
        console.debug('Haptic feedback not available');
      }
    }
  }, []);

  const updateConsensus = useCallback(async () => {
    try {
      const consensus = await votingSystem.checkVotingConsensus(session.id);
      setVotingState(prev => ({ ...prev, consensus }));
    } catch (error) {
      console.error('Failed to update consensus:', error);
    }
  }, [session.id]);

  const startTimerUpdates = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      setVotingState(prev => {
        const now = Date.now();
        const elapsed = Math.floor((now - session.startTime) / 1000);
        const remaining = Math.max(0, session.timeLimit - elapsed);

        return {
          ...prev,
          timeRemaining: remaining,
          lastUpdate: now,
        };
      });
    }, 1000);
  }, [session.startTime, session.timeLimit]);

  const getPlayerVoteOptions = useCallback((): PlayerVoteOption[] => {
    const voteCounts = new Map<string, number>();

    // Count current votes
    for (const vote of session.votes) {
      const count = voteCounts.get(vote.targetId) || 0;
      voteCounts.set(vote.targetId, count + vote.votingPower);
    }

    const options: PlayerVoteOption[] = [];

    // Add player options
    for (const player of players) {
      if (!session.participants.includes(player.id)) continue;
      if (player.id === currentPlayerId) continue; // Can't vote for self

      const isAlive = session.participants.includes(player.id);
      const currentVotes = voteCounts.get(player.id) || 0;
      const isCurrentVote = votingState.previousVote === player.id;

      options.push({
        id: player.id,
        name: player.name,
        type: 'player',
        isAlive,
        isEligible: true,
        currentVotes,
        isCurrentVote,
        suspicionLevel:
          player.gameSpecificData?.suspicions?.[currentPlayerId] || 0,
      });
    }

    // Add system options
    options.push({
      id: 'no_lynch',
      name: 'No Lynch',
      type: 'system',
      isAlive: true,
      isEligible: true,
      currentVotes: voteCounts.get('no_lynch') || 0,
      isCurrentVote: votingState.previousVote === 'no_lynch',
    });

    options.push({
      id: 'abstain',
      name: 'Abstain',
      type: 'system',
      isAlive: true,
      isEligible: true,
      currentVotes: voteCounts.get('abstain') || 0,
      isCurrentVote: votingState.previousVote === 'abstain',
    });

    return options.sort((a, b) => {
      // Sort by: current vote first, then by vote count (desc), then alphabetically
      if (a.isCurrentVote && !b.isCurrentVote) return -1;
      if (!a.isCurrentVote && b.isCurrentVote) return 1;
      if (a.currentVotes !== b.currentVotes)
        return b.currentVotes - a.currentVotes;
      return a.name.localeCompare(b.name);
    });
  }, [players, session, currentPlayerId, votingState.previousVote]);

  const formatTimeRemaining = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const getVotingPowerForPlayer = useCallback(
    (playerId: UUID): number => {
      const player = players.find(p => p.id === playerId);
      return player?.gameSpecificData?.votingPower || 1;
    },
    [players]
  );

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderTimeIndicator = () => {
    const isUrgent = votingState.timeRemaining <= 30;
    const isWarning = votingState.timeRemaining <= 60;

    return (
      <div
        className={`flex items-center space-x-2 rounded-lg p-3 ${
          isUrgent
            ? 'border border-red-200 bg-red-50'
            : isWarning
              ? 'border border-yellow-200 bg-yellow-50'
              : 'border border-blue-200 bg-blue-50'
        }`}
      >
        <div
          className={`h-3 w-3 rounded-full ${
            isUrgent
              ? 'animate-pulse bg-red-500'
              : isWarning
                ? 'bg-yellow-500'
                : 'bg-blue-500'
          }`}
        />
        <span
          className={`font-mono text-lg font-semibold ${
            isUrgent
              ? 'text-red-700'
              : isWarning
                ? 'text-yellow-700'
                : 'text-blue-700'
          }`}
        >
          {formatTimeRemaining(votingState.timeRemaining)}
        </span>
        <span className='text-sm text-gray-600'>remaining</span>
      </div>
    );
  };

  const renderConsensusIndicator = () => {
    if (!votingState.consensus) return null;

    const { consensus } = votingState;
    const progress =
      consensus.requiredCount > 0
        ? (consensus.currentCount / consensus.requiredCount) * 100
        : 0;

    return (
      <div className='rounded-lg border border-gray-200 bg-gray-50 p-3'>
        <div className='mb-2 flex items-center justify-between'>
          <span className='text-sm font-medium text-gray-700'>
            Consensus Progress ({consensus.type})
          </span>
          <span className='text-sm text-gray-600'>
            {consensus.currentCount} / {consensus.requiredCount}
          </span>
        </div>
        <div className='mb-2 h-2 w-full rounded-full bg-gray-200'>
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              consensus.achieved ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
        {consensus.leader && (
          <div className='text-xs text-gray-600'>
            Leading: {consensus.leader.targetId} ({consensus.leader.voteCount}{' '}
            votes,
            {Math.round(consensus.leader.percentage)}%)
          </div>
        )}
        {consensus.tied && consensus.tiedCandidates && (
          <div className='text-xs text-amber-600'>
            Tied between {consensus.tiedCandidates.length} candidates
          </div>
        )}
      </div>
    );
  };

  const renderPlayerOption = (option: PlayerVoteOption) => {
    const isSelected = votingState.selectedTarget === option.id;
    const hasVotes = option.currentVotes > 0;
    const votingPower = getVotingPowerForPlayer(currentPlayerId);

    return (
      <button
        key={option.id}
        onClick={() => handlePlayerSelect(option.id)}
        disabled={disabled || votingState.isSubmitting || !option.isEligible}
        className={`w-full rounded-lg border-2 p-4 text-left transition-all duration-200 ${
          isSelected
            ? 'border-blue-500 bg-blue-50 shadow-md'
            : option.isCurrentVote
              ? 'border-green-500 bg-green-50'
              : hasVotes
                ? 'border-gray-300 bg-gray-50 hover:border-gray-400'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        } ${
          disabled || !option.isEligible
            ? 'cursor-not-allowed opacity-50'
            : 'cursor-pointer'
        }`}
        aria-pressed={isSelected}
        aria-label={`Vote for ${option.name}${hasVotes ? `, currently has ${option.currentVotes} votes` : ''}`}
      >
        <div className='flex items-center justify-between'>
          <div className='flex-1'>
            <div className='flex items-center space-x-3'>
              <span
                className={`font-medium ${
                  option.type === 'system' ? 'text-gray-700' : 'text-gray-900'
                }`}
              >
                {option.name}
              </span>
              {option.isCurrentVote && (
                <span className='rounded-full bg-green-100 px-2 py-1 text-xs text-green-800'>
                  Current Vote
                </span>
              )}
              {isSelected && !option.isCurrentVote && (
                <span className='rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800'>
                  Selected
                </span>
              )}
            </div>
            {option.type === 'player' &&
              option.suspicionLevel !== undefined && (
                <div className='mt-1 text-xs text-gray-500'>
                  Suspicion Level: {Math.round(option.suspicionLevel * 100)}%
                </div>
              )}
          </div>
          <div className='flex flex-col items-end space-y-1'>
            {hasVotes && (
              <div className='flex items-center space-x-1'>
                <span className='text-sm font-medium text-gray-900'>
                  {option.currentVotes}
                </span>
                <span className='text-xs text-gray-600'>votes</span>
              </div>
            )}
            {isSelected && votingPower > 1 && (
              <div className='text-xs text-blue-600'>
                Your vote: {votingPower} power
              </div>
            )}
          </div>
        </div>
      </button>
    );
  };

  const renderVoteConfirmation = () => {
    if (!votingState.showConfirmation || !votingState.selectedTarget)
      return null;

    const targetName =
      votingState.selectedTarget === 'abstain'
        ? 'Abstain'
        : votingState.selectedTarget === 'no_lynch'
          ? 'No Lynch'
          : players.find(p => p.id === votingState.selectedTarget)?.name ||
            'Unknown';

    const isVoteChange = votingState.previousVote !== null;
    const votingPower = getVotingPowerForPlayer(currentPlayerId);

    return (
      <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4'>
        <div className='w-full max-w-md rounded-lg bg-white p-6 shadow-xl'>
          <h3 className='mb-4 text-lg font-semibold text-gray-900'>
            Confirm Your Vote
          </h3>

          <div className='mb-4'>
            <p className='text-gray-700'>
              {isVoteChange ? 'Change your vote to:' : 'Cast your vote for:'}
            </p>
            <p className='mt-1 text-xl font-bold text-blue-600'>{targetName}</p>
            {votingPower > 1 && (
              <p className='mt-1 text-sm text-gray-600'>
                Voting Power: {votingPower}
              </p>
            )}
          </div>

          {session.isAnonymous && (
            <div className='mb-4 rounded border border-yellow-200 bg-yellow-50 p-3'>
              <p className='text-sm text-yellow-800'>
                <span className='font-medium'>Note:</span> This is an anonymous
                vote. Other players will not see who you voted for.
              </p>
            </div>
          )}

          <div className='mb-4'>
            <label
              htmlFor='vote-reason'
              className='mb-2 block text-sm font-medium text-gray-700'
            >
              Reason (optional):
            </label>
            <textarea
              id='vote-reason'
              value={votingState.votingReason}
              onChange={e => handleReasonChange(e.target.value)}
              placeholder='Explain your vote...'
              className='w-full rounded-md border border-gray-300 p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500'
              rows={3}
              maxLength={200}
            />
            <div className='mt-1 text-xs text-gray-500'>
              {votingState.votingReason.length}/200 characters
            </div>
          </div>

          <div className='flex space-x-3'>
            <button
              onClick={handleVoteCancel}
              disabled={votingState.isSubmitting}
              className='flex-1 rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50'
            >
              Cancel
            </button>
            <button
              onClick={handleVoteSubmit}
              disabled={votingState.isSubmitting}
              className='flex flex-1 items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50'
            >
              {votingState.isSubmitting ? (
                <>
                  <div className='mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white'></div>
                  Casting Vote...
                </>
              ) : (
                'Confirm Vote'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  const playerOptions = getPlayerVoteOptions();
  const hasSelectedTarget = votingState.selectedTarget !== null;
  const canSubmitVote =
    hasSelectedTarget &&
    !votingState.isSubmitting &&
    votingState.timeRemaining > 0 &&
    !disabled;

  if (session.phase !== 'voting') {
    return (
      <div
        className={`rounded-lg border border-gray-200 bg-gray-50 p-6 ${className}`}
      >
        <div className='text-center'>
          <h3 className='mb-2 text-lg font-semibold text-gray-900'>
            Voting Phase Not Active
          </h3>
          <p className='text-gray-600'>
            Current phase: <span className='font-medium'>{session.phase}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className='rounded-lg border border-gray-200 bg-white p-6'>
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='text-xl font-bold text-gray-900'>
            Voting - Round {session.round}
          </h2>
          <div className='text-sm text-gray-600'>
            Mode: <span className='font-medium capitalize'>{session.mode}</span>
          </div>
        </div>

        {/* Time and Consensus Indicators */}
        <div className='mb-4 grid grid-cols-1 gap-4 md:grid-cols-2'>
          {renderTimeIndicator()}
          {renderConsensusIndicator()}
        </div>

        {/* Voting Instructions */}
        <div className='rounded border border-blue-200 bg-blue-50 p-3'>
          <p className='text-sm text-blue-800'>
            <span className='font-medium'>Instructions:</span>
            Select a player to vote for elimination, choose "No Lynch" to skip
            elimination, or "Abstain" to not participate in this vote.
            {session.allowsVoteChanging &&
              ' You can change your vote before time expires.'}
          </p>
        </div>
      </div>

      {/* Voting Options */}
      <div className='rounded-lg border border-gray-200 bg-white p-6'>
        <div className='mb-4 flex items-center justify-between'>
          <h3 className='text-lg font-semibold text-gray-900'>
            Choose Your Vote
          </h3>
          <div className='flex items-center space-x-2 text-sm text-gray-600'>
            <div className='h-2 w-2 animate-pulse rounded-full bg-green-500'></div>
            <span>Live Updates</span>
          </div>
        </div>

        <div className='space-y-3'>{playerOptions.map(renderPlayerOption)}</div>

        {/* Vote Action Button */}
        {!votingState.showConfirmation && (
          <div className='mt-6 border-t border-gray-200 pt-4'>
            <div className='flex items-center justify-between'>
              <div className='text-sm text-gray-600'>
                {votingState.previousVote ? (
                  <>
                    Current vote:{' '}
                    <span className='font-medium'>
                      {votingState.previousVote === 'abstain'
                        ? 'Abstain'
                        : votingState.previousVote === 'no_lynch'
                          ? 'No Lynch'
                          : players.find(p => p.id === votingState.previousVote)
                              ?.name || 'Unknown'}
                    </span>
                  </>
                ) : (
                  'No vote cast yet'
                )}
              </div>

              <button
                onClick={() =>
                  setVotingState(prev => ({ ...prev, showConfirmation: true }))
                }
                disabled={!canSubmitVote}
                className={`rounded-md px-6 py-2 font-medium transition-colors ${
                  canSubmitVote
                    ? 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
                    : 'cursor-not-allowed bg-gray-300 text-gray-500'
                }`}
              >
                {votingState.previousVote ? 'Change Vote' : 'Cast Vote'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Vote Confirmation Modal */}
      {renderVoteConfirmation()}
    </div>
  );
}
