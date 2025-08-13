'use client';

/**
 * ClueTracker Component for RpgAInfinity Deduction Game
 *
 * Information management system featuring:
 * - Personal and revealed clues with reliability indicators
 * - Clue revelation system with confirmation dialogs
 * - Information categorization and filtering
 * - Evidence linking and relationship mapping
 * - Keyboard navigation and accessibility support
 */

import { useState, useCallback, useMemo } from 'react';
import { ClueCard, ClueType, UUID } from '../../../types/deduction';

// ============================================================================
// COMPONENT TYPES & INTERFACES
// ============================================================================

export interface ClueTrackerProps {
  readonly availableClues: ClueCard[];
  readonly playerClues: ClueCard[];
  readonly canRevealClues?: boolean;
  readonly onClueReveal?: (clueId: UUID) => void;
  readonly className?: string;
}

interface ClueTrackerState {
  selectedClue: ClueCard | null;
  filterBy: ClueType | 'all';
  sortBy: 'chronological' | 'reliability' | 'type' | 'relevance';
  showRevealed: boolean;
  showUnrevealed: boolean;
  expandedClues: Set<UUID>;
  revealConfirmation: ClueCard | null;
}

interface ClueCardDisplay {
  clue: ClueCard;
  isRevealed: boolean;
  isPinned: boolean;
  relevanceScore: number;
  connectedClues: UUID[];
  category: 'personal' | 'shared' | 'public';
}

// ============================================================================
// CLUE CONFIGURATION
// ============================================================================

const CLUE_TYPE_CONFIG: Record<
  ClueType,
  {
    name: string;
    icon: string;
    color: string;
    bgColor: string;
    description: string;
  }
> = {
  role_hint: {
    name: 'Role Hint',
    icon: '🎭',
    color: 'purple',
    bgColor: 'bg-purple-50',
    description: 'Information about player roles',
  },
  alignment_hint: {
    name: 'Alignment',
    icon: '⚖️',
    color: 'blue',
    bgColor: 'bg-blue-50',
    description: 'Town vs Mafia alignment clues',
  },
  action_evidence: {
    name: 'Action Evidence',
    icon: '🔍',
    color: 'green',
    bgColor: 'bg-green-50',
    description: 'Evidence of night actions',
  },
  relationship: {
    name: 'Relationship',
    icon: '🔗',
    color: 'orange',
    bgColor: 'bg-orange-50',
    description: 'Player connections and alliances',
  },
  behavioral: {
    name: 'Behavioral',
    icon: '👤',
    color: 'indigo',
    bgColor: 'bg-indigo-50',
    description: 'Suspicious or notable behavior',
  },
  environmental: {
    name: 'Environmental',
    icon: '🌍',
    color: 'teal',
    bgColor: 'bg-teal-50',
    description: 'Setting and context clues',
  },
  red_herring: {
    name: 'Red Herring',
    icon: '🐟',
    color: 'red',
    bgColor: 'bg-red-50',
    description: 'Misleading or false information',
  },
};

const RELIABILITY_CONFIG: Record<
  string,
  {
    name: string;
    color: string;
    icon: string;
    description: string;
  }
> = {
  reliable: {
    name: 'Reliable',
    color: 'green',
    icon: '✅',
    description: 'Trustworthy information',
  },
  unreliable: {
    name: 'Unreliable',
    color: 'yellow',
    icon: '⚠️',
    description: 'Information may be incorrect',
  },
  misleading: {
    name: 'Misleading',
    color: 'red',
    icon: '❌',
    description: 'Deliberately false information',
  },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ClueTracker({
  availableClues,
  playerClues,
  canRevealClues = false,
  onClueReveal,
  className = '',
}: ClueTrackerProps) {
  // State management
  const [trackerState, setTrackerState] = useState<ClueTrackerState>({
    selectedClue: null,
    filterBy: 'all',
    sortBy: 'chronological',
    showRevealed: true,
    showUnrevealed: true,
    expandedClues: new Set(),
    revealConfirmation: null,
  });

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const allClues = useMemo((): ClueCardDisplay[] => {
    const processClue = (
      clue: ClueCard,
      category: 'personal' | 'shared' | 'public'
    ): ClueCardDisplay => ({
      clue,
      isRevealed: clue.isRevealed,
      isPinned: false, // TODO: Implement pinning system
      relevanceScore: calculateRelevanceScore(clue),
      connectedClues: findConnectedClues(clue, [
        ...availableClues,
        ...playerClues,
      ]),
      category,
    });

    return [
      ...playerClues.map(clue => processClue(clue, 'personal')),
      ...availableClues
        .filter(clue => clue.isRevealed)
        .map(clue => processClue(clue, 'public')),
    ];
  }, [availableClues, playerClues]);

  const filteredAndSortedClues = useMemo((): ClueCardDisplay[] => {
    let filtered = allClues;

    // Apply visibility filters
    if (!trackerState.showRevealed) {
      filtered = filtered.filter(display => !display.isRevealed);
    }
    if (!trackerState.showUnrevealed) {
      filtered = filtered.filter(display => display.isRevealed);
    }

    // Apply type filter
    if (trackerState.filterBy !== 'all') {
      filtered = filtered.filter(
        display => display.clue.type === trackerState.filterBy
      );
    }

    // Apply sorting
    return filtered.sort((a, b) => {
      switch (trackerState.sortBy) {
        case 'reliability':
          const reliabilityOrder = {
            reliable: 3,
            unreliable: 2,
            misleading: 1,
          };
          return (
            reliabilityOrder[b.clue.reliability] -
            reliabilityOrder[a.clue.reliability]
          );
        case 'type':
          return a.clue.type.localeCompare(b.clue.type);
        case 'relevance':
          return b.relevanceScore - a.relevanceScore;
        case 'chronological':
        default:
          const aTime = a.clue.revealedAt
            ? new Date(a.clue.revealedAt).getTime()
            : 0;
          const bTime = b.clue.revealedAt
            ? new Date(b.clue.revealedAt).getTime()
            : 0;
          return bTime - aTime;
      }
    });
  }, [allClues, trackerState]);

  const clueStats = useMemo(() => {
    const total = allClues.length;
    const revealed = allClues.filter(d => d.isRevealed).length;
    const personal = allClues.filter(d => d.category === 'personal').length;
    const reliable = allClues.filter(
      d => d.clue.reliability === 'reliable'
    ).length;

    return { total, revealed, personal, reliable };
  }, [allClues]);

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const calculateRelevanceScore = useCallback((clue: ClueCard): number => {
    // Calculate relevance based on clue properties and current game state
    let score = 0;

    // Base reliability score
    switch (clue.reliability) {
      case 'reliable':
        score += 3;
        break;
      case 'unreliable':
        score += 1;
        break;
      case 'misleading':
        score -= 1;
        break;
    }

    // Type importance (role and alignment clues are more important)
    switch (clue.type) {
      case 'role_hint':
      case 'alignment_hint':
        score += 3;
        break;
      case 'action_evidence':
        score += 2;
        break;
      case 'relationship':
      case 'behavioral':
        score += 1;
        break;
      case 'red_herring':
        score -= 2;
        break;
      default:
        break;
    }

    // Recent clues are more relevant
    if (clue.revealedAt) {
      const hoursAgo =
        (Date.now() - new Date(clue.revealedAt).getTime()) / (1000 * 60 * 60);
      if (hoursAgo < 1) score += 2;
      else if (hoursAgo < 6) score += 1;
    }

    return Math.max(0, score);
  }, []);

  const findConnectedClues = useCallback(
    (targetClue: ClueCard, allClues: ClueCard[]): UUID[] => {
      // Find clues that reference the same players or themes
      return allClues
        .filter(clue => clue.id !== targetClue.id)
        .filter(clue => {
          // Simple connection detection based on shared affected players
          if (targetClue.affectedPlayers && clue.affectedPlayers) {
            return targetClue.affectedPlayers.some(playerId =>
              clue.affectedPlayers?.includes(playerId)
            );
          }
          return false;
        })
        .map(clue => clue.id);
    },
    []
  );

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleClueSelect = useCallback((clue: ClueCard) => {
    setTrackerState(prev => ({
      ...prev,
      selectedClue: prev.selectedClue?.id === clue.id ? null : clue,
    }));
  }, []);

  const handleClueExpand = useCallback((clueId: UUID) => {
    setTrackerState(prev => {
      const newExpanded = new Set(prev.expandedClues);
      if (newExpanded.has(clueId)) {
        newExpanded.delete(clueId);
      } else {
        newExpanded.add(clueId);
      }
      return { ...prev, expandedClues: newExpanded };
    });
  }, []);

  const handleClueRevealRequest = useCallback(
    (clue: ClueCard) => {
      if (!canRevealClues || clue.isRevealed) return;

      setTrackerState(prev => ({
        ...prev,
        revealConfirmation: clue,
      }));
    },
    [canRevealClues]
  );

  const handleClueRevealConfirm = useCallback(() => {
    const clue = trackerState.revealConfirmation;
    if (!clue || !onClueReveal) return;

    onClueReveal(clue.id);
    setTrackerState(prev => ({
      ...prev,
      revealConfirmation: null,
    }));
  }, [trackerState.revealConfirmation, onClueReveal]);

  const handleClueRevealCancel = useCallback(() => {
    setTrackerState(prev => ({ ...prev, revealConfirmation: null }));
  }, []);

  const handleFilterChange = useCallback((filterBy: ClueType | 'all') => {
    setTrackerState(prev => ({ ...prev, filterBy }));
  }, []);

  const handleSortChange = useCallback((sortBy: typeof trackerState.sortBy) => {
    setTrackerState(prev => ({ ...prev, sortBy }));
  }, []);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderTrackerControls = () => (
    <div className='mb-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50 p-3'>
      <div className='flex items-center space-x-4'>
        {/* Filter Controls */}
        <div className='flex items-center space-x-2'>
          <label className='text-sm font-medium text-gray-700'>Filter:</label>
          <select
            value={trackerState.filterBy}
            onChange={e =>
              handleFilterChange(e.target.value as ClueType | 'all')
            }
            className='rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500'
            //TODO: Add proper accessibility labels
          >
            <option value='all'>All Types</option>
            {Object.entries(CLUE_TYPE_CONFIG).map(([type, config]) => (
              <option key={type} value={type}>
                {config.icon} {config.name}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Controls */}
        <div className='flex items-center space-x-2'>
          <label className='text-sm font-medium text-gray-700'>Sort:</label>
          <select
            value={trackerState.sortBy}
            onChange={e =>
              handleSortChange(e.target.value as typeof trackerState.sortBy)
            }
            className='rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500'
          >
            <option value='chronological'>Recent First</option>
            <option value='reliability'>Most Reliable</option>
            <option value='relevance'>Most Relevant</option>
            <option value='type'>By Type</option>
          </select>
        </div>

        {/* Visibility Toggles */}
        <div className='flex items-center space-x-2'>
          <label className='flex items-center space-x-1 text-sm'>
            <input
              type='checkbox'
              checked={trackerState.showRevealed}
              onChange={e =>
                setTrackerState(prev => ({
                  ...prev,
                  showRevealed: e.target.checked,
                }))
              }
              className='rounded border-gray-300'
            />
            <span>Revealed</span>
          </label>
          <label className='flex items-center space-x-1 text-sm'>
            <input
              type='checkbox'
              checked={trackerState.showUnrevealed}
              onChange={e =>
                setTrackerState(prev => ({
                  ...prev,
                  showUnrevealed: e.target.checked,
                }))
              }
              className='rounded border-gray-300'
            />
            <span>Unrevealed</span>
          </label>
        </div>
      </div>

      {/* Statistics */}
      <div className='text-sm text-gray-600'>
        {clueStats.revealed}/{clueStats.total} revealed • {clueStats.personal}{' '}
        personal • {clueStats.reliable} reliable
      </div>
    </div>
  );

  const renderClueCard = (display: ClueCardDisplay) => {
    const { clue, isRevealed, category, relevanceScore, connectedClues } =
      display;
    const isExpanded = trackerState.expandedClues.has(clue.id);
    const isSelected = trackerState.selectedClue?.id === clue.id;
    const typeConfig = CLUE_TYPE_CONFIG[clue.type];
    const reliabilityConfig = RELIABILITY_CONFIG[clue.reliability];

    return (
      <div
        key={clue.id}
        className={`rounded-lg border transition-all duration-200 ${
          isSelected
            ? `border-${typeConfig.color}-400 bg-${typeConfig.color}-50 shadow-lg`
            : isRevealed
              ? `border-${typeConfig.color}-200 ${typeConfig.bgColor}`
              : 'border-gray-200 bg-gray-50'
        }`}
      >
        {/* Clue Header */}
        <div
          className={`cursor-pointer p-3 hover:bg-opacity-75 ${
            isRevealed ? typeConfig.bgColor : 'hover:bg-gray-100'
          }`}
          onClick={() => handleClueSelect(clue)}
        >
          <div className='flex items-start justify-between'>
            <div className='flex items-start space-x-3'>
              <div className='text-xl' role='img' aria-label={typeConfig.name}>
                {typeConfig.icon}
              </div>
              <div className='flex-1'>
                <div className='flex items-center space-x-2'>
                  <h4 className='font-medium text-gray-900'>{clue.title}</h4>

                  {/* Category Badge */}
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${
                      category === 'personal'
                        ? 'bg-blue-100 text-blue-800'
                        : category === 'public'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {category}
                  </span>

                  {/* Reliability Badge */}
                  <span
                    className={`rounded-full px-2 py-1 text-xs bg-${reliabilityConfig.color}-100 text-${reliabilityConfig.color}-800`}
                  >
                    {reliabilityConfig.icon} {reliabilityConfig.name}
                  </span>
                </div>

                {/* Clue Content Preview */}
                {isRevealed && (
                  <p className='mt-1 line-clamp-2 text-sm text-gray-700'>
                    {clue.content}
                  </p>
                )}

                {/* Metadata */}
                <div className='mt-2 flex items-center space-x-4 text-xs text-gray-500'>
                  <span>Type: {typeConfig.name}</span>
                  <span>Relevance: {relevanceScore}/10</span>
                  {connectedClues.length > 0 && (
                    <span>Connected: {connectedClues.length}</span>
                  )}
                  {clue.revealedAt && (
                    <span>
                      {new Date(clue.revealedAt).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className='flex items-center space-x-2'>
              {/* Reveal Button */}
              {!isRevealed && canRevealClues && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleClueRevealRequest(clue);
                  }}
                  className='rounded bg-blue-600 px-2 py-1 text-xs text-white transition-colors hover:bg-blue-700'
                  //TODO: Add confirmation dialog for clue revelation
                >
                  Reveal
                </button>
              )}

              {/* Expand Toggle */}
              <button
                onClick={e => {
                  e.stopPropagation();
                  handleClueExpand(clue.id);
                }}
                className='p-1 text-gray-400 transition-colors hover:text-gray-600'
                aria-label={
                  isExpanded ? 'Collapse clue details' : 'Expand clue details'
                }
              >
                <svg
                  className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M19 9l-7 7-7-7'
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && isRevealed && (
          <div className='border-t border-gray-200 p-4'>
            <div className='space-y-3'>
              {/* Full Content */}
              <div>
                <h5 className='mb-1 text-sm font-medium text-gray-900'>
                  Content:
                </h5>
                <p className='text-sm text-gray-700'>{clue.content}</p>
              </div>

              {/* Affected Players */}
              {clue.affectedPlayers && clue.affectedPlayers.length > 0 && (
                <div>
                  <h5 className='mb-1 text-sm font-medium text-gray-900'>
                    Related Players:
                  </h5>
                  <div className='flex flex-wrap gap-1'>
                    {clue.affectedPlayers.map(playerId => (
                      <span
                        key={playerId}
                        className='rounded bg-gray-100 px-2 py-1 text-xs text-gray-800'
                      >
                        Player {playerId}
                        {/* TODO: Replace with actual player names */}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Connected Clues */}
              {connectedClues.length > 0 && (
                <div>
                  <h5 className='mb-1 text-sm font-medium text-gray-900'>
                    Connected Clues:
                  </h5>
                  <div className='text-xs text-gray-600'>
                    {connectedClues.length} related clue
                    {connectedClues.length !== 1 ? 's' : ''} found
                    {/* TODO: Add clickable links to connected clues */}
                  </div>
                </div>
              )}

              {/* Reveal Information */}
              {clue.revealedBy && (
                <div className='border-t border-gray-100 pt-2 text-xs text-gray-500'>
                  Revealed by: Player {clue.revealedBy} at{' '}
                  {new Date(clue.revealedAt!).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderRevealConfirmation = () => {
    const clue = trackerState.revealConfirmation;
    if (!clue) return null;

    const typeConfig = CLUE_TYPE_CONFIG[clue.type];

    return (
      <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4'>
        <div className='w-full max-w-md rounded-lg bg-white p-6 shadow-xl'>
          <h3 className='mb-4 text-lg font-semibold text-gray-900'>
            Reveal Clue to Everyone?
          </h3>

          <div className='mb-4'>
            <div className='mb-2 flex items-center space-x-2'>
              <span className='text-xl'>{typeConfig.icon}</span>
              <span className='font-medium'>{clue.title}</span>
            </div>
            <p className='rounded bg-gray-50 p-3 text-sm text-gray-600'>
              {clue.content}
            </p>
          </div>

          <div className='mb-4 rounded border border-yellow-200 bg-yellow-50 p-3'>
            <p className='text-sm text-yellow-800'>
              <span className='font-medium'>Warning:</span> Once revealed, this
              clue will be visible to all players and cannot be hidden again.
            </p>
          </div>

          <div className='flex space-x-3'>
            <button
              onClick={handleClueRevealCancel}
              className='flex-1 rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500'
            >
              Cancel
            </button>
            <button
              onClick={handleClueRevealConfirm}
              className='flex-1 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              Reveal Clue
            </button>
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
      {/* Header */}
      <div className='mb-4 flex items-center justify-between'>
        <h3 className='text-lg font-semibold text-gray-900'>Clue Tracker</h3>
        <div className='text-sm text-gray-600'>
          {filteredAndSortedClues.length} clues
        </div>
      </div>

      {/* Controls */}
      {renderTrackerControls()}

      {/* Clue List */}
      <div className='max-h-96 space-y-3 overflow-y-auto'>
        {filteredAndSortedClues.map(renderClueCard)}
      </div>

      {/* Empty State */}
      {filteredAndSortedClues.length === 0 && (
        <div className='py-8 text-center text-gray-500'>
          <div className='mb-2 text-4xl'>🕵️</div>
          <p className='font-medium'>No clues found</p>
          <p className='text-sm'>
            {allClues.length === 0
              ? 'No clues have been discovered yet'
              : 'Try adjusting your filters'}
          </p>
        </div>
      )}

      {/* Reveal Confirmation Modal */}
      {renderRevealConfirmation()}

      {/* Keyboard Instructions */}
      <div className='sr-only'>
        Use the filter and sort controls to organize clues. Click on clue cards
        to view details. Use the reveal button to share clues with other
        players. //TODO: Add proper keyboard navigation instructions
      </div>
    </div>
  );
}
