'use client';

/**
 * PlayerGrid Component for RpgAInfinity Deduction Game
 *
 * Comprehensive player overview featuring:
 * - Player status indicators (alive, dead, voting, suspicious)
 * - Real-time vote tallies and suspicion tracking
 * - Player avatars with role-specific visual cues (when appropriate)
 * - Interactive selection for abilities and voting
 * - Accessibility support and keyboard navigation
 */

import { useState, useCallback, useMemo } from 'react';
import {
  DeductionPlayer,
  DeductionPhase,
  PlayerStatus,
  UUID,
} from '../../../types/deduction';

// ============================================================================
// COMPONENT TYPES & INTERFACES
// ============================================================================

export interface PlayerGridProps {
  readonly players: DeductionPlayer[];
  readonly currentPlayerId: UUID;
  readonly gamePhase: DeductionPhase;
  readonly alivePlayers: UUID[];
  readonly votingResults?: VotingGridData;
  readonly onPlayerSelect?: (playerId: UUID, action?: PlayerAction) => void;
  readonly className?: string;
}

interface VotingGridData {
  votes: Record<UUID, number>; // playerId -> vote count
  currentVoter?: UUID;
  voterTargets: Record<UUID, UUID | 'abstain' | 'no_lynch'>; // voterId -> targetId
}

interface PlayerAction {
  type: 'vote' | 'investigate' | 'protect' | 'target' | 'communicate';
  context?: any;
}

interface PlayerGridState {
  selectedPlayerId: UUID | null;
  hoveredPlayerId: UUID | null;
  showVoteDetails: boolean;
  sortBy: 'name' | 'status' | 'suspicion' | 'votes';
  filterBy: 'all' | 'alive' | 'dead' | 'suspicious';
}

interface PlayerCardData {
  player: DeductionPlayer;
  isAlive: boolean;
  isCurrentPlayer: boolean;
  voteCount: number;
  suspicionLevel: number;
  votedFor?: UUID | 'abstain' | 'no_lynch';
  canBeTargeted: boolean;
  statusIndicators: StatusIndicator[];
}

interface StatusIndicator {
  type:
    | 'voting'
    | 'protected'
    | 'blocked'
    | 'suspicious'
    | 'eliminated'
    | 'speaking';
  color: string;
  icon: string;
  tooltip: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function PlayerGrid({
  players,
  currentPlayerId,
  gamePhase,
  alivePlayers,
  votingResults,
  onPlayerSelect,
  className = '',
}: PlayerGridProps) {
  // State management
  const [gridState, setGridState] = useState<PlayerGridState>({
    selectedPlayerId: null,
    hoveredPlayerId: null,
    showVoteDetails: false,
    sortBy: 'name',
    filterBy: 'all',
  });

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const playerCardData = useMemo((): PlayerCardData[] => {
    return players.map((player): PlayerCardData => {
      const isAlive = alivePlayers.includes(player.id);
      const isCurrentPlayer = player.id === currentPlayerId;
      const voteCount = votingResults?.votes[player.id] || 0;
      const votedFor = votingResults?.voterTargets[player.id];
      const suspicionLevel = calculateSuspicionLevel(player);
      const statusIndicators = getPlayerStatusIndicators(
        player,
        isAlive,
        gamePhase
      );

      return {
        player,
        isAlive,
        isCurrentPlayer,
        voteCount,
        suspicionLevel,
        votedFor,
        canBeTargeted: isAlive && !isCurrentPlayer,
        statusIndicators,
      };
    });
  }, [players, currentPlayerId, alivePlayers, votingResults, gamePhase]);

  const filteredAndSortedPlayers = useMemo((): PlayerCardData[] => {
    let filtered = playerCardData;

    // Apply filters
    switch (gridState.filterBy) {
      case 'alive':
        filtered = filtered.filter(data => data.isAlive);
        break;
      case 'dead':
        filtered = filtered.filter(data => !data.isAlive);
        break;
      case 'suspicious':
        filtered = filtered.filter(data => data.suspicionLevel > 0.3);
        break;
    }

    // Apply sorting
    return filtered.sort((a, b) => {
      switch (gridState.sortBy) {
        case 'status':
          if (a.isAlive !== b.isAlive) return a.isAlive ? -1 : 1;
          return a.player.name.localeCompare(b.player.name);
        case 'suspicion':
          return b.suspicionLevel - a.suspicionLevel;
        case 'votes':
          return b.voteCount - a.voteCount;
        case 'name':
        default:
          return a.player.name.localeCompare(b.player.name);
      }
    });
  }, [playerCardData, gridState.sortBy, gridState.filterBy]);

  const voteLeader = useMemo(() => {
    if (!votingResults?.votes) return null;
    const maxVotes = Math.max(...Object.values(votingResults.votes));
    if (maxVotes === 0) return null;

    const leaderId = Object.entries(votingResults.votes).find(
      ([_, votes]) => votes === maxVotes
    )?.[0];

    return leaderId ? players.find(p => p.id === leaderId) : null;
  }, [votingResults, players]);

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const calculateSuspicionLevel = useCallback(
    (player: DeductionPlayer): number => {
      // Calculate suspicion based on player's behavior and votes received
      const suspicions = Object.values(player.gameSpecificData.suspicions);
      return suspicions.length > 0
        ? suspicions.reduce((sum, level) => sum + level, 0) / suspicions.length
        : 0;
    },
    []
  );

  const getPlayerStatusIndicators = useCallback(
    (
      player: DeductionPlayer,
      isAlive: boolean,
      phase: DeductionPhase
    ): StatusIndicator[] => {
      const indicators: StatusIndicator[] = [];

      if (!isAlive) {
        indicators.push({
          type: 'eliminated',
          color: 'gray',
          icon: '💀',
          tooltip: 'Eliminated from the game',
        });
        return indicators;
      }

      switch (player.gameSpecificData.status) {
        case 'protected':
          indicators.push({
            type: 'protected',
            color: 'green',
            icon: '🛡️',
            tooltip: 'Protected from elimination',
          });
          break;
        case 'blocked':
          indicators.push({
            type: 'blocked',
            color: 'red',
            icon: '🚫',
            tooltip: 'Abilities are blocked',
          });
          break;
        case 'suspicious':
          indicators.push({
            type: 'suspicious',
            color: 'orange',
            icon: '🔍',
            tooltip: 'Acting suspiciously',
          });
          break;
      }

      if (phase === 'day_voting' && votingResults?.voterTargets[player.id]) {
        indicators.push({
          type: 'voting',
          color: 'blue',
          icon: '🗳️',
          tooltip: 'Has cast their vote',
        });
      }

      return indicators;
    },
    [votingResults]
  );

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handlePlayerClick = useCallback(
    (playerId: UUID, event: React.MouseEvent) => {
      event.preventDefault();

      if (!onPlayerSelect) return;

      // Determine action based on game phase and modifier keys
      let action: PlayerAction = { type: 'target' };

      if (gamePhase === 'day_voting') {
        action = { type: 'vote' };
      } else if (event.ctrlKey || event.metaKey) {
        action = { type: 'investigate' };
      } else if (event.altKey) {
        action = { type: 'communicate' };
      }

      setGridState(prev => ({ ...prev, selectedPlayerId: playerId }));
      onPlayerSelect(playerId, action);
    },
    [onPlayerSelect, gamePhase]
  );

  const handlePlayerHover = useCallback((playerId: UUID | null) => {
    setGridState(prev => ({ ...prev, hoveredPlayerId: playerId }));
  }, []);

  const handleSortChange = useCallback((sortBy: typeof gridState.sortBy) => {
    setGridState(prev => ({ ...prev, sortBy }));
  }, []);

  const handleFilterChange = useCallback(
    (filterBy: typeof gridState.filterBy) => {
      setGridState(prev => ({ ...prev, filterBy }));
    },
    []
  );

  const toggleVoteDetails = useCallback(() => {
    setGridState(prev => ({ ...prev, showVoteDetails: !prev.showVoteDetails }));
  }, []);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderGridControls = () => (
    <div className='mb-4 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3'>
      <div className='flex items-center space-x-4'>
        <div className='flex items-center space-x-2'>
          <label className='text-sm font-medium text-gray-700'>Sort by:</label>
          <select
            value={gridState.sortBy}
            onChange={e =>
              handleSortChange(e.target.value as typeof gridState.sortBy)
            }
            className='rounded-md border border-gray-300 px-3 py-1 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500'
            //TODO: Add proper ARIA labels for accessibility
          >
            <option value='name'>Name</option>
            <option value='status'>Status</option>
            <option value='suspicion'>Suspicion</option>
            <option value='votes'>Vote Count</option>
          </select>
        </div>

        <div className='flex items-center space-x-2'>
          <label className='text-sm font-medium text-gray-700'>Filter:</label>
          <select
            value={gridState.filterBy}
            onChange={e =>
              handleFilterChange(e.target.value as typeof gridState.filterBy)
            }
            className='rounded-md border border-gray-300 px-3 py-1 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500'
          >
            <option value='all'>All Players</option>
            <option value='alive'>Alive</option>
            <option value='dead'>Eliminated</option>
            <option value='suspicious'>Suspicious</option>
          </select>
        </div>
      </div>

      <div className='flex items-center space-x-2'>
        <span className='text-sm text-gray-600'>
          {filteredAndSortedPlayers.length} players
        </span>

        {gamePhase === 'day_voting' && (
          <button
            onClick={toggleVoteDetails}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
              gridState.showVoteDetails
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Vote Details
          </button>
        )}
      </div>
    </div>
  );

  const renderPlayerCard = (cardData: PlayerCardData) => {
    const {
      player,
      isAlive,
      isCurrentPlayer,
      voteCount,
      suspicionLevel,
      votedFor,
      canBeTargeted,
      statusIndicators,
    } = cardData;

    const isSelected = gridState.selectedPlayerId === player.id;
    const isHovered = gridState.hoveredPlayerId === player.id;
    const hasVotes = voteCount > 0;

    return (
      <div
        key={player.id}
        onClick={e => canBeTargeted && handlePlayerClick(player.id, e)}
        onMouseEnter={() => handlePlayerHover(player.id)}
        onMouseLeave={() => handlePlayerHover(null)}
        className={`relative rounded-lg border-2 p-4 transition-all duration-200 ${
          isSelected
            ? 'border-blue-500 bg-blue-50 shadow-lg'
            : isHovered && canBeTargeted
              ? 'border-gray-400 bg-gray-50 shadow-md'
              : isCurrentPlayer
                ? 'border-green-500 bg-green-50'
                : hasVotes
                  ? 'border-orange-300 bg-orange-50'
                  : isAlive
                    ? 'border-gray-200 bg-white hover:border-gray-300'
                    : 'border-gray-200 bg-gray-100 opacity-75'
        } ${canBeTargeted ? 'cursor-pointer' : 'cursor-default'}`}
        role='button'
        tabIndex={canBeTargeted ? 0 : -1}
        aria-pressed={isSelected}
        aria-label={`Player ${player.name}${isCurrentPlayer ? ' (You)' : ''}${hasVotes ? `, ${voteCount} votes` : ''}`}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            canBeTargeted && handlePlayerClick(player.id, e as any);
          }
        }}
      >
        {/* Player Avatar and Name */}
        <div className='mb-2 flex items-center space-x-3'>
          <div
            className={`relative h-12 w-12 overflow-hidden rounded-full border-2 ${
              isAlive ? 'border-gray-300' : 'border-gray-500'
            }`}
          >
            {/* TODO: Add actual player avatar */}
            <div
              className={`flex h-full w-full items-center justify-center text-lg font-bold ${
                isAlive
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {player.name.charAt(0).toUpperCase()}
            </div>

            {/* Status Indicators */}
            {statusIndicators.length > 0 && (
              <div className='absolute -right-1 -top-1 flex space-x-1'>
                {statusIndicators.map((indicator, index) => (
                  <div
                    key={index}
                    className={`h-5 w-5 rounded-full border-2 border-white bg-${indicator.color}-500 flex items-center justify-center`}
                    title={indicator.tooltip}
                    role='img'
                    aria-label={indicator.tooltip}
                  >
                    <span className='text-xs'>{indicator.icon}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className='flex-1'>
            <h3
              className={`font-medium ${isAlive ? 'text-gray-900' : 'text-gray-500'}`}
            >
              {player.name}
              {isCurrentPlayer && (
                <span className='ml-2 rounded-full bg-green-100 px-2 py-1 text-xs text-green-800'>
                  You
                </span>
              )}
            </h3>

            {/* Vote Count */}
            {hasVotes && (
              <div className='mt-1 flex items-center space-x-1'>
                <span className='text-sm font-medium text-orange-600'>
                  {voteCount} vote{voteCount !== 1 ? 's' : ''}
                </span>
                {voteLeader?.id === player.id && (
                  <span className='rounded bg-orange-100 px-1 py-0.5 text-xs text-orange-800'>
                    Leading
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Suspicion Level */}
        {suspicionLevel > 0 && (
          <div className='mb-2'>
            <div className='mb-1 flex items-center justify-between text-xs text-gray-600'>
              <span>Suspicion</span>
              <span>{Math.round(suspicionLevel * 100)}%</span>
            </div>
            <div className='h-1 w-full rounded-full bg-gray-200'>
              <div
                className={`h-1 rounded-full transition-all ${
                  suspicionLevel > 0.7
                    ? 'bg-red-500'
                    : suspicionLevel > 0.4
                      ? 'bg-orange-500'
                      : 'bg-yellow-500'
                }`}
                style={{ width: `${suspicionLevel * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Voting Information */}
        {gamePhase === 'day_voting' && gridState.showVoteDetails && (
          <div className='border-t border-gray-200 pt-2 text-xs text-gray-600'>
            {votedFor ? (
              <p>
                Voted for:{' '}
                {votedFor === 'abstain'
                  ? 'Abstain'
                  : votedFor === 'no_lynch'
                    ? 'No Lynch'
                    : players.find(p => p.id === votedFor)?.name || 'Unknown'}
              </p>
            ) : (
              <p className='text-gray-400'>Not voted yet</p>
            )}
          </div>
        )}

        {/* Action Hints */}
        {isHovered && canBeTargeted && (
          <div className='absolute bottom-2 left-2 right-2 rounded bg-black bg-opacity-75 px-2 py-1 text-center text-xs text-white'>
            {gamePhase === 'day_voting'
              ? 'Click to vote'
              : 'Click to target • Ctrl+Click to investigate • Alt+Click to message'}
          </div>
        )}
      </div>
    );
  };

  const renderVotingSummary = () => {
    if (gamePhase !== 'day_voting' || !votingResults) return null;

    const totalVotes = Object.values(votingResults.votes).reduce(
      (sum, count) => sum + count,
      0
    );
    const votedPlayerCount = Object.keys(votingResults.voterTargets).length;
    const totalPlayers = alivePlayers.length;

    return (
      <div className='mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3'>
        <div className='flex items-center justify-between'>
          <h3 className='text-sm font-semibold text-blue-900'>
            Voting Summary
          </h3>
          <span className='text-sm text-blue-700'>
            {votedPlayerCount} / {totalPlayers} players voted
          </span>
        </div>

        <div className='mt-2 flex items-center space-x-4 text-sm text-blue-800'>
          <span>Total votes cast: {totalVotes}</span>
          {voteLeader && (
            <span>
              Leading: {voteLeader.name} ({votingResults.votes[voteLeader.id]}{' '}
              votes)
            </span>
          )}
        </div>

        {/* Vote Progress Bar */}
        <div className='mt-2'>
          <div className='h-2 w-full rounded-full bg-blue-200'>
            <div
              className='h-2 rounded-full bg-blue-600 transition-all duration-300'
              style={{ width: `${(votedPlayerCount / totalPlayers) * 100}%` }}
            />
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className={`${className}`}>
      {/* Voting Summary */}
      {renderVotingSummary()}

      {/* Grid Controls */}
      {renderGridControls()}

      {/* Players Grid */}
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
        {filteredAndSortedPlayers.map(renderPlayerCard)}
      </div>

      {/* Empty State */}
      {filteredAndSortedPlayers.length === 0 && (
        <div className='py-8 text-center text-gray-500'>
          <p>No players found matching the current filter.</p>
          <button
            onClick={() => handleFilterChange('all')}
            className='mt-2 text-sm text-blue-600 underline hover:text-blue-700'
          >
            Show all players
          </button>
        </div>
      )}

      {/* Accessibility Instructions */}
      <div
        className='sr-only'
        role='region'
        aria-label='Player grid instructions'
      >
        Use the grid controls to sort and filter players. Click on players to
        interact with them based on the current game phase. Use keyboard
        navigation with Tab and Enter keys to access players.
        {gamePhase === 'day_voting' &&
          ' During voting phase, click on a player to cast your vote.'}
        //TODO: Add more detailed accessibility instructions based on available
        actions
      </div>
    </div>
  );
}
