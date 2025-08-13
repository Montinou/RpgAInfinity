/**
 * HealthBars - Visual Health and Status Display Component
 *
 * Provides animated health bars, mana bars, status effect indicators,
 * and other vital statistics for combat participants.
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CombatParticipant,
  Character,
  StatusEffect,
  CharacterStats,
  CharacterSkills,
} from '@/types/rpg';
import { cn } from '@/lib/utils';
import {
  Heart,
  Sparkles,
  Shield,
  Zap,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Clock,
  Eye,
  EyeOff,
} from 'lucide-react';

// ============================================================================
// COMPONENT INTERFACES
// ============================================================================

interface HealthBarsProps {
  participants: CombatParticipant[];
  showDetailed?: boolean;
  showStatusEffects?: boolean;
  showStats?: boolean;
  layout?: 'horizontal' | 'vertical' | 'grid';
  groupByTeam?: boolean;
  className?: string;
}

interface ParticipantHealthBarProps {
  participant: CombatParticipant;
  showDetailed: boolean;
  showStatusEffects: boolean;
  showStats: boolean;
  isCompact?: boolean;
}

interface StatusBarProps {
  label: string;
  current: number;
  max: number;
  color: string;
  bgColor?: string;
  icon?: React.ComponentType<{ className?: string }>;
  showNumbers?: boolean;
  animate?: boolean;
  className?: string;
}

interface StatusEffectDisplayProps {
  effects: StatusEffect[];
  isCompact?: boolean;
}

// ============================================================================
// ANIMATION CONSTANTS
// ============================================================================

const ANIMATIONS = {
  healthBar: {
    damage: {
      scale: [1, 1.05, 1],
      backgroundColor: ['#ef4444', '#dc2626', '#ef4444'],
    },
    heal: {
      scale: [1, 1.05, 1],
      backgroundColor: ['#22c55e', '#16a34a', '#22c55e'],
    },
    critical: {
      scale: [1, 1.1, 1],
      backgroundColor: ['#dc2626', '#fca5a5', '#dc2626'],
    },
  },
  statusEffect: {
    added: { scale: [0, 1.2, 1], opacity: [0, 1] },
    removed: { scale: [1, 0], opacity: [1, 0] },
    pulse: { scale: [1, 1.1, 1] },
  },
  participant: {
    turnStart: { scale: [1, 1.05, 1] },
    damaged: { x: [0, -5, 5, 0] },
    healed: { y: [0, -5, 0] },
  },
};

// ============================================================================
// MAIN HEALTH BARS COMPONENT
// ============================================================================

export const HealthBars: React.FC<HealthBarsProps> = ({
  participants,
  showDetailed = true,
  showStatusEffects = true,
  showStats = false,
  layout = 'vertical',
  groupByTeam = false,
  className,
}) => {
  const [collapsedParticipants, setCollapsedParticipants] = useState<
    Set<string>
  >(new Set());
  const [lastHealthValues, setLastHealthValues] = useState<Map<string, number>>(
    new Map()
  );

  // Group participants by team if requested
  const groupedParticipants = useMemo(() => {
    if (!groupByTeam) {
      return { all: participants };
    }

    const players = participants.filter(p => p.type === 'player');
    const enemies = participants.filter(p => p.type !== 'player');

    return { players, enemies };
  }, [participants, groupByTeam]);

  // Track health changes for animations
  useEffect(() => {
    const newHealthValues = new Map<string, number>();
    participants.forEach(participant => {
      newHealthValues.set(participant.id, participant.character.currentHealth);
    });
    setLastHealthValues(newHealthValues);
  }, [participants]);

  const toggleParticipantCollapse = (participantId: string) => {
    const newCollapsed = new Set(collapsedParticipants);
    if (newCollapsed.has(participantId)) {
      newCollapsed.delete(participantId);
    } else {
      newCollapsed.add(participantId);
    }
    setCollapsedParticipants(newCollapsed);
  };

  const renderParticipantGroup = (
    groupParticipants: CombatParticipant[],
    title?: string
  ) => {
    if (groupParticipants.length === 0) return null;

    return (
      <div className='space-y-2'>
        {title && (
          <h4 className='border-b px-2 pb-1 text-sm font-medium text-gray-600'>
            {title} ({groupParticipants.length})
          </h4>
        )}
        <div
          className={cn(
            'space-y-2',
            layout === 'grid' &&
              'grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3',
            layout === 'horizontal' && 'flex flex-wrap gap-2'
          )}
        >
          {groupParticipants.map(participant => (
            <motion.div
              key={participant.id}
              layout
              className='rounded-lg border bg-white shadow-sm'
            >
              <ParticipantHealthBar
                participant={participant}
                showDetailed={
                  showDetailed && !collapsedParticipants.has(participant.id)
                }
                showStatusEffects={showStatusEffects}
                showStats={showStats}
                isCompact={layout === 'grid'}
              />
            </motion.div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={cn('health-bars space-y-4', className)}>
      {groupByTeam ? (
        <>
          {renderParticipantGroup(groupedParticipants.players, 'Players')}
          {renderParticipantGroup(groupedParticipants.enemies, 'Enemies')}
        </>
      ) : (
        renderParticipantGroup(groupedParticipants.all)
      )}
    </div>
  );
};

// ============================================================================
// PARTICIPANT HEALTH BAR COMPONENT
// ============================================================================

const ParticipantHealthBar: React.FC<ParticipantHealthBarProps> = ({
  participant,
  showDetailed,
  showStatusEffects,
  showStats,
  isCompact = false,
}) => {
  const character = participant.character;
  const [isAnimating, setIsAnimating] = useState(false);

  // Calculate derived stats
  const healthPercent = (character.currentHealth / character.maxHealth) * 100;
  const isAlive = character.currentHealth > 0;
  const isCriticalHealth = healthPercent < 25;
  const isLowHealth = healthPercent < 50;

  // TODO: Calculate mana/magic points when magic system is implemented
  const currentMana = Math.floor(character.stats.intelligence * 2); // Placeholder
  const maxMana = Math.floor(character.stats.intelligence * 2);
  const manaPercent = maxMana > 0 ? (currentMana / maxMana) * 100 : 0;

  // TODO: Calculate stamina when stamina system is implemented
  const currentStamina = Math.floor(character.stats.constitution * 1.5); // Placeholder
  const maxStamina = Math.floor(character.stats.constitution * 1.5);
  const staminaPercent =
    maxStamina > 0 ? (currentStamina / maxStamina) * 100 : 0;

  // Trigger animation on health change
  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 1000);
    return () => clearTimeout(timer);
  }, [character.currentHealth]);

  // Get participant color based on type and status
  const getParticipantColor = () => {
    if (!isAlive) return 'text-gray-500';
    switch (participant.type) {
      case 'player':
        return 'text-blue-600';
      case 'npc':
        return 'text-green-600';
      case 'monster':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getBorderColor = () => {
    if (!isAlive) return 'border-gray-300';
    if (isCriticalHealth) return 'border-red-400';
    if (isLowHealth) return 'border-yellow-400';
    return 'border-gray-200';
  };

  return (
    <motion.div
      className={cn(
        'p-3 transition-all duration-200',
        getBorderColor(),
        isAnimating && 'ring-2 ring-blue-400 ring-opacity-30',
        isCompact && 'p-2'
      )}
      animate={isAnimating ? ANIMATIONS.participant.damaged : {}}
    >
      {/* Header */}
      <div className='mb-2 flex items-center justify-between'>
        <div className='flex items-center space-x-2'>
          <div
            className={cn(
              'h-3 w-3 rounded-full',
              isAlive ? 'bg-green-500' : 'bg-red-500'
            )}
          />
          <span className={cn('font-medium', getParticipantColor())}>
            {character.name}
          </span>
          <span className='text-xs capitalize text-gray-500'>
            {participant.type}
          </span>
        </div>

        <div className='flex items-center space-x-1'>
          {participant.actionPoints > 0 && (
            <div className='flex space-x-1'>
              {Array.from({ length: participant.maxActionPoints }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    i < participant.actionPoints ? 'bg-blue-400' : 'bg-gray-300'
                  )}
                />
              ))}
            </div>
          )}
          <span className='text-xs text-gray-500'>Lv.{character.level}</span>
        </div>
      </div>

      {/* Health Bar */}
      <StatusBar
        label='HP'
        current={character.currentHealth}
        max={character.maxHealth}
        color={
          isCriticalHealth
            ? 'bg-red-500'
            : isLowHealth
              ? 'bg-yellow-500'
              : 'bg-green-500'
        }
        bgColor='bg-gray-200'
        icon={Heart}
        showNumbers={true}
        animate={isAnimating}
        className='mb-1'
      />

      {/* Mana Bar (if character uses magic) */}
      {maxMana > 0 && (
        <StatusBar
          label='MP'
          current={currentMana}
          max={maxMana}
          color='bg-blue-500'
          bgColor='bg-gray-200'
          icon={Sparkles}
          showNumbers={showDetailed}
          className='mb-1'
        />
      )}

      {/* Stamina Bar (if showing detailed) */}
      {showDetailed && maxStamina > 0 && (
        <StatusBar
          label='SP'
          current={currentStamina}
          max={maxStamina}
          color='bg-yellow-500'
          bgColor='bg-gray-200'
          icon={Zap}
          showNumbers={false}
          className='mb-2'
        />
      )}

      {/* Status Effects */}
      {showStatusEffects && character.statusEffects.length > 0 && (
        <div className='mt-2'>
          <StatusEffectDisplay
            effects={character.statusEffects}
            isCompact={isCompact}
          />
        </div>
      )}

      {/* Detailed Stats */}
      {showDetailed && showStats && (
        <motion.div
          initial={false}
          animate={{ height: 'auto', opacity: 1 }}
          className='mt-3 border-t border-gray-100 pt-2'
        >
          <StatsDisplay character={character} isCompact={isCompact} />
        </motion.div>
      )}

      {/* Critical Health Warning */}
      {isAlive && isCriticalHealth && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className='mt-2 flex items-center space-x-1 rounded bg-red-50 px-2 py-1 text-xs text-red-600'
        >
          <AlertTriangle className='h-3 w-3' />
          <span>Critical Health</span>
        </motion.div>
      )}

      {/* Death Status */}
      {!isAlive && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className='mt-2 flex items-center space-x-1 rounded bg-gray-100 px-2 py-1 text-xs text-gray-600'
        >
          <EyeOff className='h-3 w-3' />
          <span>Unconscious</span>
        </motion.div>
      )}
    </motion.div>
  );
};

// ============================================================================
// STATUS BAR COMPONENT
// ============================================================================

const StatusBar: React.FC<StatusBarProps> = ({
  label,
  current,
  max,
  color,
  bgColor = 'bg-gray-200',
  icon: Icon,
  showNumbers = false,
  animate = false,
  className,
}) => {
  const percent = max > 0 ? (current / max) * 100 : 0;
  const isLow = percent < 25;
  const isCritical = percent < 10;

  return (
    <div className={cn('flex items-center space-x-2 text-sm', className)}>
      {Icon && <Icon className='h-3 w-3 text-gray-500' />}

      <div className='flex-1'>
        <div className='mb-1 flex items-center justify-between'>
          <span className='text-xs font-medium text-gray-600'>{label}</span>
          {showNumbers && (
            <span className='text-xs text-gray-500'>
              {current}/{max}
            </span>
          )}
        </div>

        <div className={cn('h-2 overflow-hidden rounded-full', bgColor)}>
          <motion.div
            className={cn(
              'h-full transition-colors duration-300',
              color,
              isCritical && 'animate-pulse'
            )}
            initial={{ width: '100%' }}
            animate={{
              width: `${Math.max(0, percent)}%`,
              ...(animate ? ANIMATIONS.healthBar.damage : {}),
            }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />
        </div>
      </div>

      <div className='min-w-[3rem] text-right text-xs text-gray-500'>
        {Math.round(percent)}%
      </div>
    </div>
  );
};

// ============================================================================
// STATUS EFFECT DISPLAY COMPONENT
// ============================================================================

const StatusEffectDisplay: React.FC<StatusEffectDisplayProps> = ({
  effects,
  isCompact = false,
}) => {
  const maxVisible = isCompact ? 6 : 12;
  const visibleEffects = effects.slice(0, maxVisible);
  const hiddenCount = Math.max(0, effects.length - maxVisible);

  // Group effects by type
  const groupedEffects = useMemo(() => {
    const groups = {
      buff: [] as StatusEffect[],
      debuff: [] as StatusEffect[],
      neutral: [] as StatusEffect[],
    };
    visibleEffects.forEach(effect => {
      groups[effect.type].push(effect);
    });
    return groups;
  }, [visibleEffects]);

  const renderEffectGroup = (
    effects: StatusEffect[],
    type: 'buff' | 'debuff' | 'neutral'
  ) => {
    if (effects.length === 0) return null;

    const groupColor = {
      buff: 'text-green-600 bg-green-100',
      debuff: 'text-red-600 bg-red-100',
      neutral: 'text-yellow-600 bg-yellow-100',
    }[type];

    return (
      <div className='flex flex-wrap gap-1'>
        {effects.map(effect => (
          <motion.div
            key={effect.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className={cn(
              'flex items-center space-x-1 rounded px-1.5 py-0.5 text-xs font-medium',
              groupColor
            )}
            title={`${effect.name}: ${effect.description} (${effect.duration} turns)`}
          >
            <span>{type === 'buff' ? '↑' : type === 'debuff' ? '↓' : '•'}</span>
            <span className='max-w-16 truncate'>{effect.name}</span>
            {effect.duration > 0 && (
              <span className='opacity-75'>{effect.duration}</span>
            )}
          </motion.div>
        ))}
      </div>
    );
  };

  if (effects.length === 0) {
    return (
      <div className='py-1 text-center text-xs text-gray-500'>
        No active effects
      </div>
    );
  }

  return (
    <div className='space-y-1'>
      <div className='flex items-center justify-between'>
        <span className='text-xs font-medium text-gray-600'>
          Status Effects
        </span>
        <span className='text-xs text-gray-500'>{effects.length} active</span>
      </div>

      <div className='space-y-1'>
        {renderEffectGroup(groupedEffects.buff, 'buff')}
        {renderEffectGroup(groupedEffects.debuff, 'debuff')}
        {renderEffectGroup(groupedEffects.neutral, 'neutral')}

        {hiddenCount > 0 && (
          <div className='rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500'>
            +{hiddenCount} more effects
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// STATS DISPLAY COMPONENT
// ============================================================================

const StatsDisplay: React.FC<{ character: Character; isCompact?: boolean }> = ({
  character,
  isCompact = false,
}) => {
  if (isCompact) {
    return (
      <div className='grid grid-cols-3 gap-2 text-xs'>
        <div>
          <span className='text-gray-500'>STR</span>
          <span className='ml-1 font-medium'>{character.stats.strength}</span>
        </div>
        <div>
          <span className='text-gray-500'>DEX</span>
          <span className='ml-1 font-medium'>{character.stats.dexterity}</span>
        </div>
        <div>
          <span className='text-gray-500'>INT</span>
          <span className='ml-1 font-medium'>
            {character.stats.intelligence}
          </span>
        </div>
      </div>
    );
  }

  const statEntries = Object.entries(character.stats) as [
    keyof CharacterStats,
    number,
  ][];
  const skillEntries = Object.entries(character.skills) as [
    keyof CharacterSkills,
    number,
  ][];

  return (
    <div className='grid grid-cols-2 gap-3 text-xs'>
      <div>
        <h5 className='mb-1 font-medium text-gray-600'>Stats</h5>
        <div className='space-y-0.5'>
          {statEntries.map(([stat, value]) => (
            <div key={stat} className='flex justify-between'>
              <span className='capitalize text-gray-500'>
                {stat.slice(0, 3)}
              </span>
              <span className='font-medium'>{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h5 className='mb-1 font-medium text-gray-600'>Skills</h5>
        <div className='space-y-0.5'>
          {skillEntries.slice(0, 4).map(([skill, value]) => (
            <div key={skill} className='flex justify-between'>
              <span className='capitalize text-gray-500'>
                {skill.slice(0, 6)}
              </span>
              <span className='font-medium'>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HealthBars;
