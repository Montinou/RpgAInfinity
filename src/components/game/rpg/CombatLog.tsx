/**
 * CombatLog - Turn-by-turn Combat Narrative Component
 *
 * Displays a scrolling log of combat actions, outcomes, and narrative descriptions.
 * Provides both technical information for players and immersive story elements.
 */

'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CombatLogEntry,
  CombatActionType,
  CombatSession,
  StatusEffect,
} from '@/types/rpg';
import { cn } from '@/lib/utils';
import {
  Sword,
  Shield,
  Sparkles,
  Package,
  Move,
  Clock,
  ArrowRight,
  Heart,
  Zap,
  AlertTriangle,
  Info,
  Eye,
  Filter,
  Download,
  Search,
} from 'lucide-react';

// ============================================================================
// COMPONENT INTERFACES
// ============================================================================

interface CombatLogProps {
  session: CombatSession;
  entries: CombatLogEntry[];
  autoScroll?: boolean;
  showTimestamps?: boolean;
  showFilters?: boolean;
  showExport?: boolean;
  maxEntries?: number;
  className?: string;
}

interface LogEntryProps {
  entry: CombatLogEntry;
  participantName: string;
  showTimestamp: boolean;
  isNew: boolean;
}

interface LogFiltersProps {
  filters: LogFilter;
  onFiltersChange: (filters: LogFilter) => void;
}

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

interface LogFilter {
  actions: Set<CombatActionType>;
  participants: Set<string>;
  showDamage: boolean;
  showHealing: boolean;
  showStatusEffects: boolean;
  showSystemMessages: boolean;
  searchTerm: string;
}

const ACTION_ICONS: Record<
  CombatActionType,
  React.ComponentType<{ className?: string }>
> = {
  attack: Sword,
  defend: Shield,
  cast_spell: Sparkles,
  use_item: Package,
  move: Move,
  wait: Clock,
  flee: ArrowRight,
};

const ACTION_COLORS: Record<CombatActionType, string> = {
  attack: 'text-red-600 bg-red-50',
  defend: 'text-blue-600 bg-blue-50',
  cast_spell: 'text-purple-600 bg-purple-50',
  use_item: 'text-green-600 bg-green-50',
  move: 'text-yellow-600 bg-yellow-50',
  wait: 'text-gray-600 bg-gray-50',
  flee: 'text-orange-600 bg-orange-50',
};

const LOG_ENTRY_TYPES = {
  ACTION: 'action',
  DAMAGE: 'damage',
  HEALING: 'healing',
  STATUS_EFFECT: 'status_effect',
  SYSTEM: 'system',
  NARRATIVE: 'narrative',
} as const;

type LogEntryType = (typeof LOG_ENTRY_TYPES)[keyof typeof LOG_ENTRY_TYPES];

// ============================================================================
// MAIN COMBAT LOG COMPONENT
// ============================================================================

export const CombatLog: React.FC<CombatLogProps> = ({
  session,
  entries,
  autoScroll = true,
  showTimestamps = true,
  showFilters = true,
  showExport = false,
  maxEntries = 1000,
  className,
}) => {
  const [filters, setFilters] = useState<LogFilter>({
    actions: new Set(Object.keys(ACTION_ICONS) as CombatActionType[]),
    participants: new Set(session.participants.map(p => p.id)),
    showDamage: true,
    showHealing: true,
    showStatusEffects: true,
    showSystemMessages: true,
    searchTerm: '',
  });
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [newEntryIds, setNewEntryIds] = useState<Set<string>>(new Set());

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastEntryCountRef = useRef(entries.length);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (autoScroll && entries.length > lastEntryCountRef.current) {
      const newEntryCount = entries.length - lastEntryCountRef.current;
      const newIds = new Set(
        entries
          .slice(-newEntryCount)
          .map((_, index) => `entry-${entries.length - newEntryCount + index}`)
      );

      setNewEntryIds(newIds);

      // Clear "new" status after animation
      setTimeout(() => setNewEntryIds(new Set()), 2000);

      // Scroll to bottom
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop =
          scrollContainerRef.current.scrollHeight;
      }
    }

    lastEntryCountRef.current = entries.length;
  }, [entries.length, autoScroll]);

  // Get participant names for display
  const participantNames = useMemo(() => {
    const names = new Map<string, string>();
    session.participants.forEach(participant => {
      names.set(participant.id, participant.character.name);
    });
    return names;
  }, [session.participants]);

  // Filter entries based on current filters
  const filteredEntries = useMemo(() => {
    return entries
      .filter(entry => {
        // Action filter
        if (!filters.actions.has(entry.action)) return false;

        // Participant filter
        if (!filters.participants.has(entry.participantId)) return false;

        // Damage/healing filter
        if (entry.damage && !filters.showDamage) return false;
        if (entry.result.includes('heal') && !filters.showHealing) return false;

        // Status effects filter
        if (
          entry.effects &&
          entry.effects.length > 0 &&
          !filters.showStatusEffects
        )
          return false;

        // Search filter
        if (filters.searchTerm) {
          const searchTerm = filters.searchTerm.toLowerCase();
          const matchesSearch =
            entry.result.toLowerCase().includes(searchTerm) ||
            participantNames
              .get(entry.participantId)
              ?.toLowerCase()
              .includes(searchTerm) ||
            entry.effects?.some(effect =>
              effect.toLowerCase().includes(searchTerm)
            );
          if (!matchesSearch) return false;
        }

        return true;
      })
      .slice(-maxEntries); // Limit to max entries
  }, [entries, filters, participantNames, maxEntries]);

  // Export log functionality
  const handleExport = () => {
    const logText = filteredEntries
      .map(entry => {
        const timestamp = showTimestamps
          ? `[${entry.timestamp.toLocaleTimeString()}] `
          : '';
        const participant =
          participantNames.get(entry.participantId) || 'Unknown';
        const damage = entry.damage ? ` (${entry.damage} damage)` : '';
        const effects =
          entry.effects && entry.effects.length > 0
            ? ` [${entry.effects.join(', ')}]`
            : '';
        return `${timestamp}${participant}: ${entry.result}${damage}${effects}`;
      })
      .join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `combat-log-${session.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={cn(
        'combat-log flex flex-col rounded-lg border bg-white shadow-lg',
        className
      )}
    >
      {/* Header */}
      <div className='flex items-center justify-between border-b bg-gray-50 p-4'>
        <div className='flex items-center space-x-2'>
          <Eye className='h-5 w-5 text-gray-600' />
          <h3 className='text-lg font-bold'>Combat Log</h3>
          <span className='text-sm text-gray-500'>
            ({filteredEntries.length} entries)
          </span>
        </div>

        <div className='flex items-center space-x-2'>
          {showFilters && (
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={cn(
                'rounded-lg p-2 transition-colors',
                showFilterPanel
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
              title='Toggle filters'
            >
              <Filter className='h-4 w-4' />
            </button>
          )}

          {showExport && (
            <button
              onClick={handleExport}
              className='rounded-lg bg-gray-100 p-2 text-gray-600 transition-colors hover:bg-gray-200'
              title='Export log'
            >
              <Download className='h-4 w-4' />
            </button>
          )}
        </div>
      </div>

      {/* Filter Panel */}
      <AnimatePresence>
        {showFilterPanel && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className='border-b'
          >
            <LogFilters filters={filters} onFiltersChange={setFilters} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Log Entries */}
      <div
        ref={scrollContainerRef}
        className='max-h-96 min-h-0 flex-1 overflow-y-auto'
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className='space-y-2 p-4'>
          <AnimatePresence initial={false}>
            {filteredEntries.map((entry, index) => {
              const entryId = `entry-${index}`;
              const participantName =
                participantNames.get(entry.participantId) || 'Unknown';
              const isNew = newEntryIds.has(entryId);

              return (
                <motion.div
                  key={entryId}
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.9 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                >
                  <LogEntry
                    entry={entry}
                    participantName={participantName}
                    showTimestamp={showTimestamps}
                    isNew={isNew}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Empty state */}
          {filteredEntries.length === 0 && (
            <div className='py-8 text-center text-gray-500'>
              <Info className='mx-auto mb-2 h-8 w-8 text-gray-400' />
              <p>No combat actions to display</p>
              {filters.searchTerm && (
                <p className='mt-1 text-sm'>
                  Try adjusting your search or filters
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className='border-t bg-gray-50 px-4 py-2 text-xs text-gray-600'>
        <div className='flex items-center justify-between'>
          <span>
            Turn {session.currentTurn} • {session.status}
          </span>
          {autoScroll && (
            <span className='flex items-center space-x-1'>
              <div className='h-2 w-2 rounded-full bg-green-500'></div>
              <span>Auto-scroll enabled</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// LOG ENTRY COMPONENT
// ============================================================================

const LogEntry: React.FC<LogEntryProps> = ({
  entry,
  participantName,
  showTimestamp,
  isNew,
}) => {
  const ActionIcon = ACTION_ICONS[entry.action];
  const actionColorClass = ACTION_COLORS[entry.action];

  // Determine entry type for styling
  const getEntryType = (): LogEntryType => {
    if (entry.damage && entry.damage > 0) return LOG_ENTRY_TYPES.DAMAGE;
    if (entry.result.toLowerCase().includes('heal'))
      return LOG_ENTRY_TYPES.HEALING;
    if (entry.effects && entry.effects.length > 0)
      return LOG_ENTRY_TYPES.STATUS_EFFECT;
    if (entry.participantId === entry.participantId)
      return LOG_ENTRY_TYPES.SYSTEM; // System messages
    return LOG_ENTRY_TYPES.ACTION;
  };

  const entryType = getEntryType();

  // Get appropriate styling based on entry type
  const getEntryStyle = () => {
    switch (entryType) {
      case LOG_ENTRY_TYPES.DAMAGE:
        return 'border-l-4 border-red-400 bg-red-50';
      case LOG_ENTRY_TYPES.HEALING:
        return 'border-l-4 border-green-400 bg-green-50';
      case LOG_ENTRY_TYPES.STATUS_EFFECT:
        return 'border-l-4 border-purple-400 bg-purple-50';
      case LOG_ENTRY_TYPES.SYSTEM:
        return 'border-l-4 border-gray-400 bg-gray-50';
      default:
        return 'border-l-4 border-blue-400 bg-blue-50';
    }
  };

  return (
    <motion.div
      className={cn(
        'rounded-lg p-3 transition-all duration-200',
        getEntryStyle(),
        isNew && 'ring-2 ring-blue-400 ring-opacity-50'
      )}
      animate={isNew ? { scale: [1, 1.02, 1] } : {}}
      transition={{ duration: 0.5 }}
    >
      <div className='flex items-start space-x-3'>
        {/* Action Icon */}
        <div className={cn('rounded-lg p-1.5', actionColorClass)}>
          <ActionIcon className='h-4 w-4' />
        </div>

        {/* Content */}
        <div className='min-w-0 flex-1'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-2'>
              <span className='font-medium text-gray-900'>
                {participantName}
              </span>
              <span className='text-sm capitalize text-gray-500'>
                {entry.action.replace('_', ' ')}
              </span>
            </div>

            {showTimestamp && (
              <span className='text-xs text-gray-500'>
                {entry.timestamp.toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* Main description */}
          <p className='mt-1 text-sm text-gray-700'>{entry.result}</p>

          {/* Damage indicator */}
          {entry.damage && entry.damage > 0 && (
            <div className='mt-1 flex items-center space-x-1'>
              <AlertTriangle className='h-3 w-3 text-red-500' />
              <span className='text-xs font-medium text-red-600'>
                {entry.damage} damage dealt
              </span>
            </div>
          )}

          {/* Status effects */}
          {entry.effects && entry.effects.length > 0 && (
            <div className='mt-1 flex items-center space-x-1'>
              <Sparkles className='h-3 w-3 text-purple-500' />
              <div className='flex flex-wrap gap-1'>
                {entry.effects.map((effect, index) => (
                  <span
                    key={index}
                    className='rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-700'
                  >
                    {effect}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Target indicator */}
          {entry.target && (
            <div className='mt-1 text-xs text-gray-500'>
              → Target: <span className='font-medium'>Target</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ============================================================================
// LOG FILTERS COMPONENT
// ============================================================================

const LogFilters: React.FC<LogFiltersProps> = ({
  filters,
  onFiltersChange,
}) => {
  const handleActionToggle = (action: CombatActionType) => {
    const newActions = new Set(filters.actions);
    if (newActions.has(action)) {
      newActions.delete(action);
    } else {
      newActions.add(action);
    }
    onFiltersChange({ ...filters, actions: newActions });
  };

  const handleSearchChange = (searchTerm: string) => {
    onFiltersChange({ ...filters, searchTerm });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      actions: new Set(Object.keys(ACTION_ICONS) as CombatActionType[]),
      participants: filters.participants, // Keep participant filter
      showDamage: true,
      showHealing: true,
      showStatusEffects: true,
      showSystemMessages: true,
      searchTerm: '',
    });
  };

  return (
    <div className='space-y-4 bg-gray-50 p-4'>
      {/* Search */}
      <div className='relative'>
        <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400' />
        <input
          type='text'
          placeholder='Search combat log...'
          value={filters.searchTerm}
          onChange={e => handleSearchChange(e.target.value)}
          className='w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 focus:border-transparent focus:ring-2 focus:ring-blue-500'
        />
      </div>

      {/* Action Filters */}
      <div>
        <label className='mb-2 block text-sm font-medium text-gray-700'>
          Filter by Actions
        </label>
        <div className='flex flex-wrap gap-2'>
          {(Object.keys(ACTION_ICONS) as CombatActionType[]).map(action => {
            const ActionIcon = ACTION_ICONS[action];
            const isSelected = filters.actions.has(action);

            return (
              <button
                key={action}
                onClick={() => handleActionToggle(action)}
                className={cn(
                  'flex items-center space-x-1 rounded-lg px-2 py-1 text-sm transition-colors',
                  isSelected
                    ? 'border border-blue-200 bg-blue-100 text-blue-700'
                    : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                )}
              >
                <ActionIcon className='h-3 w-3' />
                <span className='capitalize'>{action.replace('_', ' ')}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Display Options */}
      <div>
        <label className='mb-2 block text-sm font-medium text-gray-700'>
          Display Options
        </label>
        <div className='space-y-2'>
          {[
            { key: 'showDamage', label: 'Show Damage', icon: AlertTriangle },
            { key: 'showHealing', label: 'Show Healing', icon: Heart },
            {
              key: 'showStatusEffects',
              label: 'Show Status Effects',
              icon: Sparkles,
            },
            {
              key: 'showSystemMessages',
              label: 'Show System Messages',
              icon: Info,
            },
          ].map(option => {
            const Icon = option.icon;
            const isChecked = filters[option.key as keyof LogFilter] as boolean;

            return (
              <label
                key={option.key}
                className='flex cursor-pointer items-center space-x-2'
              >
                <input
                  type='checkbox'
                  checked={isChecked}
                  onChange={e =>
                    onFiltersChange({
                      ...filters,
                      [option.key]: e.target.checked,
                    })
                  }
                  className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                />
                <Icon className='h-4 w-4 text-gray-500' />
                <span className='text-sm text-gray-700'>{option.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Clear Filters */}
      <div className='border-t border-gray-200 pt-2'>
        <button
          onClick={clearAllFilters}
          className='text-sm text-gray-600 transition-colors hover:text-gray-800'
        >
          Clear all filters
        </button>
      </div>
    </div>
  );
};

export default CombatLog;
