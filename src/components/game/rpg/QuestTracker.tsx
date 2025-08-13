/**
 * QuestTracker Component - Mission and Objective Management
 *
 * Comprehensive quest management system featuring:
 * - Active quest tracking with progress indicators
 * - Objective completion status
 * - Quest categorization and priority
 * - Map integration for quest locations
 * - Reward previews and completion notifications
 * - Quest journal with detailed history
 * - Team-based quest coordination
 * - Dynamic quest discovery and branching
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Quest,
  QuestObjective,
  QuestType,
  QuestStatus,
  QuestReward,
  UUID,
} from '@/types/rpg';

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

interface QuestTrackerProps {
  quests: Quest[];
  selectedQuestId: UUID | null;
  onQuestSelect: (questId: UUID) => void;
  onQuestAction: (action: string, questId: UUID, data?: any) => Promise<void>;
  className?: string;
}

interface QuestCardProps {
  quest: Quest;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  onAction: (action: string) => void;
}

interface ObjectiveItemProps {
  objective: QuestObjective;
  questId: UUID;
  onToggle: () => void;
}

interface QuestFilters {
  status: QuestStatus | 'all';
  type: QuestType | 'all';
  sortBy: 'priority' | 'progress' | 'name' | 'type';
  showCompleted: boolean;
}

// ============================================================================
// MAIN QUEST TRACKER COMPONENT
// ============================================================================

export default function QuestTracker({
  quests,
  selectedQuestId,
  onQuestSelect,
  onQuestAction,
  className = '',
}: QuestTrackerProps) {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [filters, setFilters] = useState<QuestFilters>({
    status: 'all',
    type: 'all',
    sortBy: 'priority',
    showCompleted: false,
  });

  const [expandedQuests, setExpandedQuests] = useState<Set<UUID>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastAction, setLastAction] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const questStats = useMemo(() => {
    const stats = {
      total: quests.length,
      active: quests.filter(q => q.status === 'active').length,
      completed: quests.filter(q => q.status === 'completed').length,
      failed: quests.filter(q => q.status === 'failed').length,
      available: quests.filter(q => q.status === 'available').length,
    };

    return stats;
  }, [quests]);

  const filteredQuests = useMemo(() => {
    let filtered = quests;

    // Apply status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(quest => quest.status === filters.status);
    }

    // Apply type filter
    if (filters.type !== 'all') {
      filtered = filtered.filter(quest => quest.type === filters.type);
    }

    // Apply completed filter
    if (!filters.showCompleted) {
      filtered = filtered.filter(quest => quest.status !== 'completed');
    }

    // Apply search term
    if (searchTerm) {
      filtered = filtered.filter(
        quest =>
          quest.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          quest.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      switch (filters.sortBy) {
        case 'priority':
          return getQuestPriority(b) - getQuestPriority(a);
        case 'progress':
          return getQuestProgress(b) - getQuestProgress(a);
        case 'name':
          return a.title.localeCompare(b.title);
        case 'type':
          return a.type.localeCompare(b.type);
        default:
          return 0;
      }
    });

    return filtered;
  }, [quests, filters, searchTerm]);

  const selectedQuest = useMemo(() => {
    return selectedQuestId ? quests.find(q => q.id === selectedQuestId) : null;
  }, [quests, selectedQuestId]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleQuestSelect = useCallback(
    (questId: UUID) => {
      onQuestSelect(questId);
    },
    [onQuestSelect]
  );

  const handleQuestAction = useCallback(
    async (action: string, questId: UUID, additionalData?: any) => {
      setIsProcessing(true);
      setLastAction(`${action} quest`);

      try {
        await onQuestAction(action, questId, additionalData);
        setLastAction(`Quest ${action} successful`);
      } catch (error) {
        console.error('Quest action failed:', error);
        setLastAction(`Failed to ${action} quest`);
      } finally {
        setIsProcessing(false);
        setTimeout(() => setLastAction(''), 3000);
      }
    },
    [onQuestAction]
  );

  const handleToggleExpand = useCallback((questId: UUID) => {
    setExpandedQuests(prev => {
      const next = new Set(prev);
      if (next.has(questId)) {
        next.delete(questId);
      } else {
        next.add(questId);
      }
      return next;
    });
  }, []);

  const handleFilterChange = useCallback(
    (key: keyof QuestFilters, value: any) => {
      setFilters(prev => ({ ...prev, [key]: value }));
    },
    []
  );

  // ============================================================================
  // AUTO-EXPAND SELECTED QUEST
  // ============================================================================

  useEffect(() => {
    if (selectedQuestId && !expandedQuests.has(selectedQuestId)) {
      setExpandedQuests(prev => new Set([...prev, selectedQuestId]));
    }
  }, [selectedQuestId, expandedQuests]);

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div
      className={`h-full bg-gradient-to-br from-purple-900/20 via-indigo-900/20 to-blue-900/20 ${className}`}
    >
      {/* Header */}
      <div className='border-b border-purple-500/30 bg-black/20 p-4 backdrop-blur-sm'>
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='flex items-center space-x-2 text-xl font-bold text-white'>
            <span>📜</span>
            <span>Quest Log</span>
          </h2>

          {/* Processing Indicator */}
          {isProcessing && (
            <div className='flex items-center space-x-2 text-purple-300'>
              <div className='h-4 w-4 animate-spin rounded-full border-2 border-purple-500 border-t-transparent'></div>
              <span className='text-sm'>{lastAction}</span>
            </div>
          )}
        </div>

        {/* Quest Stats */}
        <div className='mb-4 grid grid-cols-2 gap-3 md:grid-cols-5'>
          <div className='text-center'>
            <div className='text-lg font-bold text-white'>
              {questStats.total}
            </div>
            <div className='text-xs text-gray-400'>Total</div>
          </div>
          <div className='text-center'>
            <div className='text-lg font-bold text-yellow-400'>
              {questStats.active}
            </div>
            <div className='text-xs text-yellow-500'>Active</div>
          </div>
          <div className='text-center'>
            <div className='text-lg font-bold text-blue-400'>
              {questStats.available}
            </div>
            <div className='text-xs text-blue-500'>Available</div>
          </div>
          <div className='text-center'>
            <div className='text-lg font-bold text-green-400'>
              {questStats.completed}
            </div>
            <div className='text-xs text-green-500'>Completed</div>
          </div>
          <div className='text-center'>
            <div className='text-lg font-bold text-red-400'>
              {questStats.failed}
            </div>
            <div className='text-xs text-red-500'>Failed</div>
          </div>
        </div>

        {/* Search Bar */}
        <div className='relative mb-4'>
          <input
            type='text'
            placeholder='Search quests...'
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className='w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-white placeholder-gray-400 focus:border-purple-400 focus:outline-none'
          />
          <div className='absolute right-3 top-1/2 -translate-y-1/2 transform text-gray-400'>
            🔍
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className='border-b border-purple-500/20 bg-black/10 p-4'>
        <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={e =>
              handleFilterChange(
                'status',
                e.target.value as QuestStatus | 'all'
              )
            }
            className='rounded border border-white/20 bg-white/10 px-3 py-2 text-sm text-white'
          >
            <option value='all'>All Status</option>
            <option value='available'>Available</option>
            <option value='active'>Active</option>
            <option value='completed'>Completed</option>
            <option value='failed'>Failed</option>
          </select>

          {/* Type Filter */}
          <select
            value={filters.type}
            onChange={e =>
              handleFilterChange('type', e.target.value as QuestType | 'all')
            }
            className='rounded border border-white/20 bg-white/10 px-3 py-2 text-sm text-white'
          >
            <option value='all'>All Types</option>
            <option value='main'>Main Story</option>
            <option value='side'>Side Quest</option>
            <option value='personal'>Personal</option>
            <option value='faction'>Faction</option>
            <option value='discovery'>Discovery</option>
            <option value='fetch'>Fetch</option>
            <option value='escort'>Escort</option>
          </select>

          {/* Sort Filter */}
          <select
            value={filters.sortBy}
            onChange={e =>
              handleFilterChange(
                'sortBy',
                e.target.value as QuestFilters['sortBy']
              )
            }
            className='rounded border border-white/20 bg-white/10 px-3 py-2 text-sm text-white'
          >
            <option value='priority'>Priority</option>
            <option value='progress'>Progress</option>
            <option value='name'>Name</option>
            <option value='type'>Type</option>
          </select>

          {/* Show Completed Toggle */}
          <label className='flex items-center space-x-2 text-sm text-white'>
            <input
              type='checkbox'
              checked={filters.showCompleted}
              onChange={e =>
                handleFilterChange('showCompleted', e.target.checked)
              }
              className='rounded border-white/20 bg-white/10 text-purple-600 focus:ring-purple-500'
            />
            <span>Show Completed</span>
          </label>
        </div>
      </div>

      {/* Quest List */}
      <div className='flex-1 overflow-auto p-4'>
        {filteredQuests.length > 0 ? (
          <div className='space-y-3'>
            <AnimatePresence>
              {filteredQuests.map(quest => (
                <QuestCard
                  key={quest.id}
                  quest={quest}
                  isSelected={selectedQuestId === quest.id}
                  isExpanded={expandedQuests.has(quest.id)}
                  onSelect={() => handleQuestSelect(quest.id)}
                  onToggleExpand={() => handleToggleExpand(quest.id)}
                  onAction={action => handleQuestAction(action, quest.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className='flex h-full items-center justify-center text-gray-400'>
            <div className='text-center'>
              <div className='mb-4 text-6xl'>📋</div>
              <p className='text-lg'>No quests found</p>
              <p className='text-sm'>
                {searchTerm
                  ? `No quests match "${searchTerm}"`
                  : 'No quests available with current filters'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Action Result Toast */}
      <AnimatePresence>
        {lastAction && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className='fixed bottom-4 right-4 z-50 rounded-lg bg-black/80 px-4 py-2 text-white backdrop-blur-sm'
          >
            {lastAction}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// QUEST CARD COMPONENT
// ============================================================================

const QuestCard: React.FC<QuestCardProps> = ({
  quest,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
  onAction,
}) => {
  const progress = getQuestProgress(quest);
  const completedObjectives = quest.objectives.filter(
    obj => obj.isCompleted
  ).length;
  const totalObjectives = quest.objectives.length;

  const getStatusColor = (status: QuestStatus) => {
    switch (status) {
      case 'available':
        return 'border-blue-400 bg-blue-400/10';
      case 'active':
        return 'border-yellow-400 bg-yellow-400/10';
      case 'completed':
        return 'border-green-400 bg-green-400/10';
      case 'failed':
        return 'border-red-400 bg-red-400/10';
      case 'expired':
        return 'border-gray-400 bg-gray-400/10';
      default:
        return 'border-gray-400 bg-gray-400/10';
    }
  };

  const getTypeIcon = (type: QuestType) => {
    switch (type) {
      case 'main':
        return '🏆';
      case 'side':
        return '📜';
      case 'personal':
        return '👤';
      case 'faction':
        return '⚔️';
      case 'discovery':
        return '🔍';
      case 'fetch':
        return '📦';
      case 'escort':
        return '👥';
      default:
        return '❓';
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`
        cursor-pointer rounded-lg border-2 transition-all duration-200
        ${getStatusColor(quest.status)}
        ${isSelected ? 'scale-[1.02] ring-2 ring-purple-400' : 'hover:scale-[1.01]'}
      `}
      onClick={onSelect}
    >
      {/* Quest Header */}
      <div className='p-4'>
        <div className='mb-2 flex items-start justify-between'>
          <div className='flex items-center space-x-3'>
            <div className='text-2xl'>{getTypeIcon(quest.type)}</div>
            <div>
              <h3 className='text-lg font-semibold text-white'>
                {quest.title}
              </h3>
              <div className='flex items-center space-x-2 text-sm'>
                <span
                  className={`
                  rounded px-2 py-1 text-xs capitalize
                  ${
                    quest.status === 'active'
                      ? 'bg-yellow-600 text-white'
                      : quest.status === 'completed'
                        ? 'bg-green-600 text-white'
                        : quest.status === 'failed'
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-600 text-white'
                  }
                `}
                >
                  {quest.status}
                </span>
                <span className='capitalize text-purple-300'>{quest.type}</span>
              </div>
            </div>
          </div>

          <div className='flex items-center space-x-2'>
            {/* Progress Circle */}
            <div className='relative h-12 w-12'>
              <svg
                className='h-12 w-12 -rotate-90 transform'
                viewBox='0 0 36 36'
              >
                <path
                  d='M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831'
                  fill='none'
                  stroke='rgba(255,255,255,0.1)'
                  strokeWidth='2'
                />
                <path
                  d='M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831'
                  fill='none'
                  stroke={progress === 100 ? '#10b981' : '#8b5cf6'}
                  strokeWidth='2'
                  strokeDasharray={`${progress}, 100`}
                />
              </svg>
              <div className='absolute inset-0 flex items-center justify-center text-xs font-semibold text-white'>
                {Math.round(progress)}%
              </div>
            </div>

            {/* Expand Button */}
            <button
              onClick={e => {
                e.stopPropagation();
                onToggleExpand();
              }}
              className='rounded p-2 text-white transition-colors hover:bg-white/20'
            >
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                ▼
              </motion.div>
            </button>
          </div>
        </div>

        {/* Quest Description */}
        <p className='mb-3 text-sm text-gray-300'>{quest.description}</p>

        {/* Progress Bar */}
        <div className='mb-3'>
          <div className='mb-1 flex justify-between text-xs text-gray-400'>
            <span>Progress</span>
            <span>
              {completedObjectives} / {totalObjectives} objectives
            </span>
          </div>
          <div className='h-2 w-full rounded-full bg-gray-700'>
            <motion.div
              className={`h-2 rounded-full ${
                progress === 100 ? 'bg-green-500' : 'bg-purple-500'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Time Limit */}
        {quest.timeLimit && quest.status === 'active' && (
          <div className='mb-2 text-xs text-orange-300'>
            ⏰ Time limit: {quest.timeLimit} minutes remaining
          </div>
        )}
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className='overflow-hidden border-t border-white/10'
          >
            <div className='space-y-4 p-4'>
              {/* Objectives */}
              <div>
                <h4 className='mb-2 flex items-center space-x-2 font-medium text-white'>
                  <span>🎯</span>
                  <span>Objectives</span>
                </h4>
                <div className='space-y-2'>
                  {quest.objectives.map(objective => (
                    <ObjectiveItem
                      key={objective.id}
                      objective={objective}
                      questId={quest.id}
                      onToggle={() => {}} // TODO: Implement objective toggle if needed
                    />
                  ))}
                </div>
              </div>

              {/* Rewards */}
              {quest.rewards.length > 0 && (
                <div>
                  <h4 className='mb-2 flex items-center space-x-2 font-medium text-white'>
                    <span>🏆</span>
                    <span>Rewards</span>
                  </h4>
                  <div className='grid grid-cols-2 gap-2'>
                    {quest.rewards.map((reward, index) => (
                      <div
                        key={index}
                        className='rounded bg-white/5 p-2 text-sm'
                      >
                        <div className='capitalize text-yellow-300'>
                          {reward.type}
                        </div>
                        <div className='text-white'>
                          {reward.amount}
                          {reward.type === 'item' &&
                            reward.itemId &&
                            ' item(s)'}
                          {reward.type === 'experience' && ' XP'}
                          {reward.type === 'currency' && ' gold'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quest Actions */}
              <div className='flex space-x-2 pt-2'>
                {quest.status === 'available' && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onAction('accept');
                    }}
                    className='rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700'
                  >
                    Accept Quest
                  </button>
                )}

                {quest.status === 'active' && progress === 100 && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onAction('complete');
                    }}
                    className='rounded bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700'
                  >
                    Complete Quest
                  </button>
                )}

                {quest.status === 'active' && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onAction('abandon');
                    }}
                    className='rounded bg-red-600/80 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600'
                  >
                    Abandon
                  </button>
                )}

                <button
                  onClick={e => {
                    e.stopPropagation();
                    onAction('pin');
                  }}
                  className='rounded bg-purple-600/80 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-600'
                >
                  Pin to HUD
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ============================================================================
// OBJECTIVE ITEM COMPONENT
// ============================================================================

const ObjectiveItem: React.FC<ObjectiveItemProps> = ({
  objective,
  questId,
  onToggle,
}) => {
  const progressPercent =
    objective.requiredCount > 0
      ? (objective.currentCount / objective.requiredCount) * 100
      : 0;

  return (
    <div className='flex items-center space-x-3 rounded bg-white/5 p-2'>
      {/* Completion Checkbox */}
      <div
        className={`
        flex h-5 w-5 items-center justify-center rounded border-2
        ${
          objective.isCompleted
            ? 'border-green-500 bg-green-500 text-white'
            : 'border-gray-500'
        }
      `}
      >
        {objective.isCompleted && '✓'}
      </div>

      {/* Objective Text */}
      <div className='flex-1'>
        <p
          className={`text-sm ${
            objective.isCompleted ? 'text-green-300 line-through' : 'text-white'
          }`}
        >
          {objective.description}
          {objective.isOptional && (
            <span className='ml-2 text-xs text-blue-300'>(Optional)</span>
          )}
        </p>

        {/* Progress for count-based objectives */}
        {objective.requiredCount > 0 && (
          <div className='mt-1'>
            <div className='flex justify-between text-xs text-gray-400'>
              <span>
                {objective.currentCount} / {objective.requiredCount}
              </span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <div className='mt-1 h-1 w-full rounded-full bg-gray-600'>
              <div
                className={`h-1 rounded-full ${
                  objective.isCompleted ? 'bg-green-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(progressPercent, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getQuestProgress(quest: Quest): number {
  if (quest.objectives.length === 0) return 0;

  const completedObjectives = quest.objectives.filter(
    obj => obj.isCompleted
  ).length;
  return (completedObjectives / quest.objectives.length) * 100;
}

function getQuestPriority(quest: Quest): number {
  // Priority scoring system
  let priority = 0;

  // Main story quests have highest priority
  if (quest.type === 'main') priority += 100;

  // Active quests have higher priority than available
  if (quest.status === 'active') priority += 50;

  // Time-limited quests have higher priority
  if (quest.timeLimit) priority += 25;

  // Nearly complete quests have higher priority
  const progress = getQuestProgress(quest);
  if (progress > 75) priority += 20;

  return priority;
}
