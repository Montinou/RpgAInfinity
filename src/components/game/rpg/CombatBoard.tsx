/**
 * CombatBoard - Main Combat Display Component
 *
 * Provides the main visual interface for RPG combat, including character positions,
 * health displays, action animations, and combat environment visualization.
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CombatSession,
  CombatParticipant,
  CombatPosition,
  CombatEnvironment,
  Character,
  StatusEffect,
} from '@/types/rpg';
import { cn } from '@/lib/utils';

// ============================================================================
// COMPONENT INTERFACES
// ============================================================================

interface CombatBoardProps {
  session: CombatSession;
  onParticipantSelect: (participantId: string) => void;
  onPositionClick: (position: CombatPosition) => void;
  selectedParticipant?: string;
  availablePositions?: CombatPosition[];
  showGrid?: boolean;
  showRanges?: boolean;
  className?: string;
}

interface ParticipantDisplayProps {
  participant: CombatParticipant;
  isSelected: boolean;
  isCurrentTurn: boolean;
  isTargetable: boolean;
  onClick: () => void;
  showHealthBar?: boolean;
  showStatusEffects?: boolean;
}

interface EnvironmentProps {
  environment: CombatEnvironment;
  participants: CombatParticipant[];
}

// ============================================================================
// ANIMATION CONSTANTS
// ============================================================================

const ANIMATIONS = {
  participant: {
    idle: { scale: 1, rotate: 0 },
    selected: { scale: 1.1, rotate: 0 },
    attacking: { scale: 1.2, rotate: [0, -5, 5, 0] },
    damaged: { scale: 0.9, x: [0, -10, 10, 0] },
    healing: { scale: 1.1, y: [0, -5, 0] },
    dead: { scale: 0.8, opacity: 0.5, rotate: 90 },
  },
  healthBar: {
    damage: { scaleX: [1, 0.8, 1] },
    heal: { scaleX: [1, 1.2, 1] },
    critical: { backgroundColor: ['#ef4444', '#fecaca', '#ef4444'] },
  },
  statusEffect: {
    applied: { scale: [0, 1.2, 1], opacity: [0, 1] },
    removed: { scale: [1, 0], opacity: [1, 0] },
    tick: { scale: [1, 1.1, 1] },
  },
};

// ============================================================================
// MAIN COMBAT BOARD COMPONENT
// ============================================================================

export const CombatBoard: React.FC<CombatBoardProps> = ({
  session,
  onParticipantSelect,
  onPositionClick,
  selectedParticipant,
  availablePositions = [],
  showGrid = true,
  showRanges = false,
  className,
}) => {
  const [animatingParticipants, setAnimatingParticipants] = useState<
    Set<string>
  >(new Set());
  const [lastHealthValues, setLastHealthValues] = useState<Map<string, number>>(
    new Map()
  );

  // Grid dimensions based on environment
  const gridWidth = session.environment.size.width;
  const gridHeight = session.environment.size.height;

  // Calculate cell size based on container
  const cellSize = useMemo(() => {
    const maxWidth = Math.min(800, window?.innerWidth * 0.8 || 800);
    const maxHeight = Math.min(600, window?.innerHeight * 0.6 || 600);
    return Math.min(maxWidth / gridWidth, maxHeight / gridHeight, 60);
  }, [gridWidth, gridHeight]);

  // Track health changes for animations
  useEffect(() => {
    const newHealthValues = new Map<string, number>();
    const newAnimatingParticipants = new Set<string>();

    session.participants.forEach(participant => {
      const currentHealth = participant.character.currentHealth;
      const lastHealth = lastHealthValues.get(participant.id);

      newHealthValues.set(participant.id, currentHealth);

      if (lastHealth !== undefined && lastHealth !== currentHealth) {
        newAnimatingParticipants.add(participant.id);
        // Clear animation after duration
        setTimeout(() => {
          setAnimatingParticipants(prev => {
            const next = new Set(prev);
            next.delete(participant.id);
            return next;
          });
        }, 1000);
      }
    });

    setLastHealthValues(newHealthValues);
    setAnimatingParticipants(newAnimatingParticipants);
  }, [session.participants, lastHealthValues]);

  // Handle grid position clicks
  const handlePositionClick = (x: number, y: number) => {
    const position: CombatPosition = {
      x,
      y,
      zone:
        y < gridHeight / 3
          ? 'front'
          : y < (gridHeight * 2) / 3
            ? 'middle'
            : 'back',
    };
    onPositionClick(position);
  };

  return (
    <div className={cn('combat-board relative', className)}>
      {/* Environment Background */}
      <EnvironmentDisplay
        environment={session.environment}
        participants={session.participants}
      />

      {/* Combat Grid */}
      <div
        className='to-brown-100/20 relative overflow-hidden rounded-lg border-2 border-gray-400 bg-gradient-to-b from-green-100/20'
        style={{
          width: gridWidth * cellSize,
          height: gridHeight * cellSize,
        }}
      >
        {/* Grid Lines */}
        {showGrid && (
          <GridOverlay
            width={gridWidth}
            height={gridHeight}
            cellSize={cellSize}
            availablePositions={availablePositions}
            onPositionClick={handlePositionClick}
          />
        )}

        {/* Range Indicators */}
        {showRanges && selectedParticipant && (
          <RangeIndicators
            selectedParticipant={selectedParticipant}
            participants={session.participants}
            gridWidth={gridWidth}
            gridHeight={gridHeight}
            cellSize={cellSize}
          />
        )}

        {/* Combat Participants */}
        <AnimatePresence>
          {session.participants.map(participant => (
            <motion.div
              key={participant.id}
              className='absolute z-10'
              style={{
                left: participant.position.x * cellSize + cellSize / 2,
                top: participant.position.y * cellSize + cellSize / 2,
                transform: 'translate(-50%, -50%)',
              }}
              layout
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <ParticipantDisplay
                participant={participant}
                isSelected={selectedParticipant === participant.id}
                isCurrentTurn={session.currentParticipant === participant.id}
                isTargetable={participant.character.currentHealth > 0}
                onClick={() => onParticipantSelect(participant.id)}
                showHealthBar={true}
                showStatusEffects={true}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Combat Effects Overlay */}
        <CombatEffectsOverlay
          session={session}
          animatingParticipants={animatingParticipants}
        />
      </div>

      {/* Combat Information Panel */}
      <div className='mt-4 rounded-lg bg-gray-800/90 p-4 text-white'>
        <div className='flex items-center justify-between'>
          <div>
            <span className='text-sm text-gray-300'>Turn:</span>
            <span className='ml-2 text-lg font-bold'>
              {session.currentTurn}
            </span>
          </div>
          <div>
            <span className='text-sm text-gray-300'>Current:</span>
            <span className='ml-2 font-bold text-yellow-400'>
              {session.participants.find(
                p => p.id === session.currentParticipant
              )?.character.name || 'Unknown'}
            </span>
          </div>
          <div>
            <span className='text-sm text-gray-300'>Status:</span>
            <span
              className={cn(
                'ml-2 font-bold capitalize',
                session.status === 'active' ? 'text-green-400' : 'text-red-400'
              )}
            >
              {session.status}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PARTICIPANT DISPLAY COMPONENT
// ============================================================================

const ParticipantDisplay: React.FC<ParticipantDisplayProps> = ({
  participant,
  isSelected,
  isCurrentTurn,
  isTargetable,
  onClick,
  showHealthBar = true,
  showStatusEffects = true,
}) => {
  const character = participant.character;
  const healthPercent = (character.currentHealth / character.maxHealth) * 100;
  const isAlive = character.currentHealth > 0;

  // Determine participant appearance
  const getParticipantColor = () => {
    if (!isAlive) return 'bg-gray-500';
    switch (participant.type) {
      case 'player':
        return 'bg-blue-500';
      case 'npc':
        return character.currentHealth === character.maxHealth
          ? 'bg-green-500'
          : 'bg-yellow-500';
      case 'monster':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getBorderColor = () => {
    if (isCurrentTurn) return 'border-yellow-400 border-4';
    if (isSelected) return 'border-white border-3';
    return 'border-gray-600 border-2';
  };

  return (
    <motion.div
      className={cn(
        'relative cursor-pointer select-none',
        isTargetable ? 'hover:scale-110' : 'cursor-not-allowed'
      )}
      onClick={isTargetable ? onClick : undefined}
      animate={
        isAlive ? ANIMATIONS.participant.idle : ANIMATIONS.participant.dead
      }
      whileHover={isTargetable ? { scale: 1.1 } : {}}
      whileTap={isTargetable ? { scale: 0.95 } : {}}
    >
      {/* Character Avatar */}
      <div
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white shadow-lg',
          getParticipantColor(),
          getBorderColor(),
          isCurrentTurn && 'animate-pulse'
        )}
      >
        {character.name.charAt(0).toUpperCase()}
      </div>

      {/* Health Bar */}
      {showHealthBar && (
        <div className='absolute -bottom-2 left-1/2 -translate-x-1/2 transform'>
          <div className='h-2 w-16 overflow-hidden rounded-full border border-gray-600 bg-gray-700'>
            <motion.div
              className={cn(
                'h-full transition-colors duration-300',
                healthPercent > 60
                  ? 'bg-green-500'
                  : healthPercent > 30
                    ? 'bg-yellow-500'
                    : healthPercent > 0
                      ? 'bg-red-500'
                      : 'bg-gray-500'
              )}
              initial={{ width: '100%' }}
              animate={{ width: `${healthPercent}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <div className='mt-1 text-center text-xs text-gray-300'>
            {character.currentHealth}/{character.maxHealth}
          </div>
        </div>
      )}

      {/* Status Effects */}
      {showStatusEffects && character.statusEffects.length > 0 && (
        <div className='absolute -right-2 -top-2'>
          <StatusEffectsIndicator effects={character.statusEffects} />
        </div>
      )}

      {/* Character Name */}
      <div className='absolute -bottom-8 left-1/2 -translate-x-1/2 transform whitespace-nowrap'>
        <span className='rounded bg-white/80 px-2 py-1 text-xs font-medium text-gray-700'>
          {character.name}
        </span>
      </div>

      {/* Action Points Indicator */}
      <div className='absolute -left-2 -top-2 flex space-x-1'>
        {Array.from({ length: participant.maxActionPoints }, (_, i) => (
          <div
            key={i}
            className={cn(
              'h-2 w-2 rounded-full border border-gray-600',
              i < participant.actionPoints ? 'bg-blue-400' : 'bg-gray-300'
            )}
          />
        ))}
      </div>
    </motion.div>
  );
};

// ============================================================================
// SUPPORTING COMPONENTS
// ============================================================================

const GridOverlay: React.FC<{
  width: number;
  height: number;
  cellSize: number;
  availablePositions: CombatPosition[];
  onPositionClick: (x: number, y: number) => void;
}> = ({ width, height, cellSize, availablePositions, onPositionClick }) => {
  return (
    <div className='absolute inset-0 z-0'>
      {Array.from({ length: height }, (_, y) =>
        Array.from({ length: width }, (_, x) => {
          const isAvailable = availablePositions.some(
            pos => pos.x === x && pos.y === y
          );
          return (
            <div
              key={`${x}-${y}`}
              className={cn(
                'absolute border border-gray-300/30 transition-colors',
                isAvailable &&
                  'cursor-pointer border-blue-400/50 bg-blue-200/30 hover:bg-blue-300/40'
              )}
              style={{
                left: x * cellSize,
                top: y * cellSize,
                width: cellSize,
                height: cellSize,
              }}
              onClick={isAvailable ? () => onPositionClick(x, y) : undefined}
            />
          );
        })
      )}
    </div>
  );
};

const RangeIndicators: React.FC<{
  selectedParticipant: string;
  participants: CombatParticipant[];
  gridWidth: number;
  gridHeight: number;
  cellSize: number;
}> = ({
  selectedParticipant,
  participants,
  gridWidth,
  gridHeight,
  cellSize,
}) => {
  const participant = participants.find(p => p.id === selectedParticipant);
  if (!participant) return null;

  // TODO: Calculate actual weapon/spell ranges
  const attackRange = 2; // Default attack range
  const { x: centerX, y: centerY } = participant.position;

  const rangePositions: CombatPosition[] = [];
  for (
    let y = Math.max(0, centerY - attackRange);
    y <= Math.min(gridHeight - 1, centerY + attackRange);
    y++
  ) {
    for (
      let x = Math.max(0, centerX - attackRange);
      x <= Math.min(gridWidth - 1, centerX + attackRange);
      x++
    ) {
      const distance = Math.abs(x - centerX) + Math.abs(y - centerY);
      if (distance <= attackRange && (x !== centerX || y !== centerY)) {
        rangePositions.push({
          x,
          y,
          zone:
            y < gridHeight / 3
              ? 'front'
              : y < (gridHeight * 2) / 3
                ? 'middle'
                : 'back',
        });
      }
    }
  }

  return (
    <div className='z-5 pointer-events-none absolute inset-0'>
      {rangePositions.map((pos, index) => (
        <div
          key={index}
          className='absolute border border-red-400/60 bg-red-200/40'
          style={{
            left: pos.x * cellSize,
            top: pos.y * cellSize,
            width: cellSize,
            height: cellSize,
          }}
        />
      ))}
    </div>
  );
};

const StatusEffectsIndicator: React.FC<{ effects: StatusEffect[] }> = ({
  effects,
}) => {
  const visibleEffects = effects.slice(0, 3); // Show max 3 effects
  const remainingCount = effects.length - 3;

  return (
    <div className='flex items-center space-x-1'>
      {visibleEffects.map((effect, index) => (
        <motion.div
          key={effect.id}
          className={cn(
            'flex h-3 w-3 items-center justify-center rounded-full border border-gray-600 text-xs',
            effect.type === 'buff'
              ? 'bg-green-400'
              : effect.type === 'debuff'
                ? 'bg-red-400'
                : 'bg-yellow-400'
          )}
          title={`${effect.name}: ${effect.description} (${effect.duration} turns)`}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: index * 0.1 }}
        >
          {effect.type === 'buff' ? '↑' : effect.type === 'debuff' ? '↓' : '•'}
        </motion.div>
      ))}
      {remainingCount > 0 && (
        <div className='flex h-3 w-3 items-center justify-center rounded-full bg-gray-400 text-xs font-bold text-white'>
          +{remainingCount}
        </div>
      )}
    </div>
  );
};

const EnvironmentDisplay: React.FC<EnvironmentProps> = ({ environment }) => {
  // TODO: Add environment-specific visual effects and hazards
  return (
    <div className='absolute inset-0 z-0 opacity-30'>
      {/* Environment type background */}
      <div
        className={cn(
          'absolute inset-0',
          environment.type === 'forest'
            ? 'bg-green-200'
            : environment.type === 'dungeon'
              ? 'bg-gray-600'
              : environment.type === 'desert'
                ? 'bg-yellow-200'
                : 'bg-gray-200'
        )}
      />

      {/* Environmental hazards */}
      {environment.hazards.map((hazard, index) => (
        <div key={index} className='absolute'>
          {/* TODO: Render hazard areas visually */}
        </div>
      ))}
    </div>
  );
};

const CombatEffectsOverlay: React.FC<{
  session: CombatSession;
  animatingParticipants: Set<string>;
}> = ({ session, animatingParticipants }) => {
  // TODO: Add combat effect animations (attacks, spells, damage numbers, etc.)
  return (
    <div className='z-15 pointer-events-none absolute inset-0'>
      {/* Combat animations would go here */}
      <AnimatePresence>
        {Array.from(animatingParticipants).map(participantId => (
          <motion.div
            key={participantId}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            className='absolute rounded bg-yellow-400 px-2 py-1 text-sm font-bold text-black'
            // TODO: Position based on participant location
          >
            Action!
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default CombatBoard;
