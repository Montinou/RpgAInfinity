/**
 * InitiativeTracker - Turn Order Management Component
 *
 * Displays the initiative order for combat, shows whose turn it is,
 * tracks turn progression, and provides visual cues for combat flow.
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CombatSession, CombatParticipant, Character, UUID } from '@/types/rpg';
import { cn } from '@/lib/utils';
import {
  Users,
  Clock,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  ChevronRight,
  ChevronDown,
  Crown,
  Skull,
  Shield,
  Sword,
  Eye,
  EyeOff,
} from 'lucide-react';

// ============================================================================
// COMPONENT INTERFACES
// ============================================================================

interface InitiativeTrackerProps {
  session: CombatSession;
  onParticipantClick?: (participantId: string) => void;
  onSkipTurn?: () => void;
  onEndTurn?: () => void;
  showTurnControls?: boolean;
  showRoundInfo?: boolean;
  showUpcoming?: boolean;
  layout?: 'horizontal' | 'vertical' | 'compact';
  maxVisible?: number;
  className?: string;
}

interface InitiativeEntryProps {
  participant: CombatParticipant;
  position: number;
  isCurrentTurn: boolean;
  isUpcoming: boolean;
  isPast: boolean;
  turnNumber: number;
  onClick?: () => void;
  isCompact?: boolean;
}

interface TurnControlsProps {
  session: CombatSession;
  onSkipTurn?: () => void;
  onEndTurn?: () => void;
  canEndTurn: boolean;
}

interface RoundInfoProps {
  session: CombatSession;
  showDetailed?: boolean;
}

// ============================================================================
// ANIMATION CONSTANTS
// ============================================================================

const ANIMATIONS = {
  turnTransition: {
    current: {
      scale: [1, 1.1, 1],
      backgroundColor: ['#3b82f6', '#1d4ed8', '#3b82f6'],
    },
    upcoming: {
      opacity: [0.7, 1, 0.7],
    },
    past: {
      opacity: 0.5,
      scale: 0.95,
    },
  },
  roundTransition: {
    newRound: {
      scale: [1, 1.05, 1],
      borderColor: ['#10b981', '#059669', '#10b981'],
    },
  },
  participant: {
    enter: { opacity: 0, x: -20, scale: 0.9 },
    center: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: 20, scale: 0.9 },
  },
};

// ============================================================================
// MAIN INITIATIVE TRACKER COMPONENT
// ============================================================================

export const InitiativeTracker: React.FC<InitiativeTrackerProps> = ({
  session,
  onParticipantClick,
  onSkipTurn,
  onEndTurn,
  showTurnControls = true,
  showRoundInfo = true,
  showUpcoming = true,
  layout = 'vertical',
  maxVisible = 8,
  className,
}) => {
  const [lastTurnParticipant, setLastTurnParticipant] = useState<string | null>(
    null
  );
  const [isAnimating, setIsAnimating] = useState(false);
  const [showPastTurns, setShowPastTurns] = useState(false);

  // Current turn index in the turn order
  const currentTurnIndex = session.turnOrder.indexOf(
    session.currentParticipant
  );

  // Track turn changes for animations
  useEffect(() => {
    if (lastTurnParticipant !== session.currentParticipant) {
      setIsAnimating(true);
      setLastTurnParticipant(session.currentParticipant);

      const timer = setTimeout(() => setIsAnimating(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [session.currentParticipant, lastTurnParticipant]);

  // Generate ordered participants for display
  const orderedParticipants = useMemo(() => {
    const participants = session.participants.map(participant => {
      const turnOrderIndex = session.turnOrder.indexOf(participant.id);
      return { participant, turnOrderIndex };
    });

    // Sort by turn order
    participants.sort((a, b) => a.turnOrderIndex - b.turnOrderIndex);

    return participants.map((item, displayIndex) => {
      const isCurrent = item.participant.id === session.currentParticipant;
      const isUpcoming = displayIndex > currentTurnIndex;
      const isPast = displayIndex < currentTurnIndex;

      return {
        ...item.participant,
        position: displayIndex + 1,
        isCurrent,
        isUpcoming: isUpcoming && showUpcoming,
        isPast,
      };
    });
  }, [
    session.participants,
    session.turnOrder,
    session.currentParticipant,
    currentTurnIndex,
    showUpcoming,
  ]);

  // Visible participants (with option to show more)
  const visibleParticipants = useMemo(() => {
    if (!showPastTurns) {
      // Show current + upcoming only
      const currentAndUpcoming = orderedParticipants.filter(p => !p.isPast);
      return currentAndUpcoming.slice(0, maxVisible);
    }
    return orderedParticipants.slice(0, maxVisible);
  }, [orderedParticipants, showPastTurns, maxVisible]);

  const canEndTurn =
    session.status === 'active' &&
    session.participants.find(p => p.id === session.currentParticipant)
      ?.actionPoints === 0;

  const layoutClass = {
    horizontal: 'flex flex-row space-x-2 overflow-x-auto',
    vertical: 'flex flex-col space-y-2',
    compact: 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2',
  }[layout];

  return (
    <div
      className={cn(
        'initiative-tracker rounded-lg border bg-white shadow-lg',
        className
      )}
    >
      {/* Header */}
      <div className='border-b bg-gray-50 p-4'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center space-x-2'>
            <Clock className='h-5 w-5 text-gray-600' />
            <h3 className='text-lg font-bold'>Initiative Order</h3>
          </div>

          <div className='flex items-center space-x-2'>
            {showTurnControls && (
              <button
                onClick={() => setShowPastTurns(!showPastTurns)}
                className={cn(
                  'rounded p-1 text-xs transition-colors',
                  showPastTurns
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
                title={showPastTurns ? 'Hide past turns' : 'Show past turns'}
              >
                {showPastTurns ? (
                  <EyeOff className='h-4 w-4' />
                ) : (
                  <Eye className='h-4 w-4' />
                )}
              </button>
            )}

            <div className='text-sm text-gray-600'>
              {currentTurnIndex + 1} of {session.turnOrder.length}
            </div>
          </div>
        </div>
      </div>

      {/* Round Information */}
      {showRoundInfo && (
        <RoundInfo session={session} showDetailed={layout !== 'compact'} />
      )}

      {/* Initiative List */}
      <div className='p-4'>
        <div className={layoutClass}>
          <AnimatePresence mode='popLayout'>
            {visibleParticipants.map((participant, index) => {
              const participantData = session.participants.find(
                p => p.id === participant.id
              );
              if (!participantData) return null;

              return (
                <motion.div
                  key={participant.id}
                  layout
                  initial={ANIMATIONS.participant.enter}
                  animate={ANIMATIONS.participant.center}
                  exit={ANIMATIONS.participant.exit}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <InitiativeEntry
                    participant={participantData}
                    position={participant.position}
                    isCurrentTurn={participant.isCurrent}
                    isUpcoming={participant.isUpcoming}
                    isPast={participant.isPast}
                    turnNumber={session.currentTurn}
                    onClick={() => onParticipantClick?.(participant.id)}
                    isCompact={layout === 'compact'}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Show more indicator */}
        {orderedParticipants.length > visibleParticipants.length && (
          <div className='mt-3 text-center'>
            <button
              onClick={() => setShowPastTurns(!showPastTurns)}
              className='text-sm text-gray-500 transition-colors hover:text-gray-700'
            >
              {showPastTurns
                ? 'Show less'
                : `Show ${orderedParticipants.length - visibleParticipants.length} more`}
            </button>
          </div>
        )}
      </div>

      {/* Turn Controls */}
      {showTurnControls && (
        <TurnControls
          session={session}
          onSkipTurn={onSkipTurn}
          onEndTurn={onEndTurn}
          canEndTurn={canEndTurn}
        />
      )}
    </div>
  );
};

// ============================================================================
// INITIATIVE ENTRY COMPONENT
// ============================================================================

const InitiativeEntry: React.FC<InitiativeEntryProps> = ({
  participant,
  position,
  isCurrentTurn,
  isUpcoming,
  isPast,
  turnNumber,
  onClick,
  isCompact = false,
}) => {
  const character = participant.character;
  const isAlive = character.currentHealth > 0;
  const healthPercent = (character.currentHealth / character.maxHealth) * 100;

  // Get styling based on turn status
  const getEntryStyle = () => {
    if (isCurrentTurn) {
      return {
        border: 'border-blue-500 border-2',
        background: 'bg-blue-50',
        text: 'text-blue-900',
        indicator: 'bg-blue-500',
      };
    } else if (isUpcoming) {
      return {
        border: 'border-green-300',
        background: 'bg-green-50',
        text: 'text-green-800',
        indicator: 'bg-green-400',
      };
    } else if (isPast) {
      return {
        border: 'border-gray-300',
        background: 'bg-gray-50',
        text: 'text-gray-600',
        indicator: 'bg-gray-400',
      };
    } else {
      return {
        border: 'border-gray-200',
        background: 'bg-white',
        text: 'text-gray-700',
        indicator: 'bg-gray-300',
      };
    }
  };

  const style = getEntryStyle();

  // Get participant type icon
  const getTypeIcon = () => {
    switch (participant.type) {
      case 'player':
        return Crown;
      case 'npc':
        return Shield;
      case 'monster':
        return Sword;
      default:
        return Users;
    }
  };

  const TypeIcon = getTypeIcon();

  return (
    <motion.div
      className={cn(
        'relative cursor-pointer rounded-lg p-3 transition-all duration-200',
        style.border,
        style.background,
        'hover:shadow-md',
        onClick && 'hover:scale-102',
        !isAlive && 'opacity-60',
        isCompact && 'p-2'
      )}
      onClick={isAlive ? onClick : undefined}
      animate={
        isCurrentTurn
          ? ANIMATIONS.turnTransition.current
          : isUpcoming
            ? ANIMATIONS.turnTransition.upcoming
            : isPast
              ? ANIMATIONS.turnTransition.past
              : {}
      }
      whileHover={onClick && isAlive ? { scale: 1.02 } : {}}
      whileTap={onClick && isAlive ? { scale: 0.98 } : {}}
    >
      {/* Position Indicator */}
      <div
        className={cn(
          'absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white',
          style.indicator,
          isCurrentTurn && 'animate-pulse'
        )}
      >
        {position}
      </div>

      {/* Current Turn Arrow */}
      {isCurrentTurn && (
        <motion.div
          className='absolute -left-1 top-1/2 -translate-y-1/2 transform'
          animate={{ x: [0, 4, 0] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          <ChevronRight className='h-4 w-4 text-blue-500' />
        </motion.div>
      )}

      <div className='flex items-center space-x-3'>
        {/* Character Avatar */}
        <div className='relative'>
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full font-bold text-white shadow-lg',
              participant.type === 'player'
                ? 'bg-blue-500'
                : participant.type === 'npc'
                  ? 'bg-green-500'
                  : 'bg-red-500',
              !isAlive && 'bg-gray-500'
            )}
          >
            {isAlive ? (
              character.name.charAt(0).toUpperCase()
            ) : (
              <Skull className='h-5 w-5' />
            )}
          </div>

          {/* Type Badge */}
          <div
            className={cn(
              'absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full',
              'border-2 border-gray-300 bg-white'
            )}
          >
            <TypeIcon className='h-2.5 w-2.5 text-gray-600' />
          </div>
        </div>

        {/* Character Info */}
        <div className='min-w-0 flex-1'>
          <div className='flex items-center justify-between'>
            <span
              className={cn(
                'font-medium',
                style.text,
                !isAlive && 'line-through'
              )}
            >
              {character.name}
            </span>
            {!isCompact && (
              <span className='text-xs text-gray-500'>
                Lv.{character.level}
              </span>
            )}
          </div>

          {/* Health Bar */}
          <div className='mt-1 flex items-center space-x-2'>
            <div className='h-2 flex-1 overflow-hidden rounded-full bg-gray-200'>
              <motion.div
                className={cn(
                  'h-full transition-colors',
                  healthPercent > 60
                    ? 'bg-green-500'
                    : healthPercent > 30
                      ? 'bg-yellow-500'
                      : healthPercent > 0
                        ? 'bg-red-500'
                        : 'bg-gray-400'
                )}
                initial={{ width: '100%' }}
                animate={{ width: `${healthPercent}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            {!isCompact && (
              <span className='min-w-[3rem] text-right text-xs text-gray-500'>
                {character.currentHealth}/{character.maxHealth}
              </span>
            )}
          </div>

          {/* Action Points */}
          {!isCompact && (
            <div className='mt-1 flex items-center space-x-1'>
              <span className='text-xs text-gray-500'>AP:</span>
              <div className='flex space-x-1'>
                {Array.from({ length: participant.maxActionPoints }, (_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      i < participant.actionPoints
                        ? 'bg-blue-400'
                        : 'bg-gray-300'
                    )}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Status Indicators */}
          {character.statusEffects.length > 0 && (
            <div className='mt-1 flex space-x-1'>
              {character.statusEffects.slice(0, 3).map((effect, index) => (
                <div
                  key={index}
                  className={cn(
                    'h-2 w-2 rounded-full',
                    effect.type === 'buff'
                      ? 'bg-green-400'
                      : effect.type === 'debuff'
                        ? 'bg-red-400'
                        : 'bg-yellow-400'
                  )}
                  title={effect.name}
                />
              ))}
              {character.statusEffects.length > 3 && (
                <div className='text-xs text-gray-500'>
                  +{character.statusEffects.length - 3}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Turn Status */}
      {isCurrentTurn && (
        <motion.div
          className='absolute -right-1 -top-1 rounded bg-blue-500 px-1.5 py-0.5 text-xs text-white'
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          Active
        </motion.div>
      )}
    </motion.div>
  );
};

// ============================================================================
// ROUND INFO COMPONENT
// ============================================================================

const RoundInfo: React.FC<RoundInfoProps> = ({
  session,
  showDetailed = true,
}) => {
  const alivePlayers = session.participants.filter(
    p => p.type === 'player' && p.character.currentHealth > 0
  ).length;

  const aliveEnemies = session.participants.filter(
    p => p.type !== 'player' && p.character.currentHealth > 0
  ).length;

  return (
    <div className='border-b bg-gray-50 px-4 py-3'>
      <div className='flex items-center justify-between text-sm'>
        <div className='flex items-center space-x-4'>
          <div>
            <span className='text-gray-500'>Round:</span>
            <span className='ml-1 text-lg font-bold'>
              {session.currentTurn}
            </span>
          </div>

          {showDetailed && (
            <>
              <div className='text-green-600'>
                <span>Players:</span>
                <span className='ml-1 font-medium'>{alivePlayers}</span>
              </div>
              <div className='text-red-600'>
                <span>Enemies:</span>
                <span className='ml-1 font-medium'>{aliveEnemies}</span>
              </div>
            </>
          )}
        </div>

        <div className='flex items-center space-x-2'>
          <div
            className={cn(
              'h-2 w-2 rounded-full',
              session.status === 'active'
                ? 'animate-pulse bg-green-500'
                : 'bg-red-500'
            )}
          />
          <span className='capitalize text-gray-600'>{session.status}</span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// TURN CONTROLS COMPONENT
// ============================================================================

const TurnControls: React.FC<TurnControlsProps> = ({
  session,
  onSkipTurn,
  onEndTurn,
  canEndTurn,
}) => {
  const currentParticipant = session.participants.find(
    p => p.id === session.currentParticipant
  );
  const isPlayerTurn = currentParticipant?.type === 'player';

  return (
    <div className='border-t bg-gray-50 p-4'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center space-x-2'>
          <div
            className={cn(
              'h-3 w-3 rounded-full',
              session.status === 'active' ? 'bg-green-500' : 'bg-red-500'
            )}
          />
          <span className='text-sm text-gray-600'>
            {currentParticipant?.character.name}'s turn
          </span>
        </div>

        {isPlayerTurn && (
          <div className='flex space-x-2'>
            {onSkipTurn && (
              <button
                onClick={onSkipTurn}
                className='flex items-center space-x-1 rounded-lg bg-yellow-100 px-3 py-1 text-sm text-yellow-700 transition-colors hover:bg-yellow-200'
              >
                <SkipForward className='h-3 w-3' />
                <span>Skip</span>
              </button>
            )}

            {onEndTurn && (
              <button
                onClick={onEndTurn}
                disabled={!canEndTurn}
                className={cn(
                  'flex items-center space-x-1 rounded-lg px-3 py-1 text-sm transition-colors',
                  canEndTurn
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'cursor-not-allowed bg-gray-100 text-gray-400'
                )}
              >
                <Play className='h-3 w-3' />
                <span>End Turn</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Action Points Display */}
      {currentParticipant && (
        <div className='mt-2 text-xs text-gray-600'>
          Action Points: {currentParticipant.actionPoints}/
          {currentParticipant.maxActionPoints}
          {currentParticipant.actionPoints === 0 && (
            <span className='ml-2 text-yellow-600'>(Turn can be ended)</span>
          )}
        </div>
      )}
    </div>
  );
};

export default InitiativeTracker;
