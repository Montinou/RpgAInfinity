/**
 * CombatInterface Component - Turn-Based Combat System
 *
 * Comprehensive combat interface featuring:
 * - Turn order management with initiative tracking
 * - Action selection with context-sensitive options
 * - Real-time combat board with positioning
 * - Damage calculation and status effect management
 * - Spell casting and item usage
 * - Victory/defeat condition handling
 * - Combat log with detailed action history
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CombatSession,
  CombatParticipant,
  CombatAction,
  CombatActionType,
  Character,
  StatusEffect,
  Item,
  UUID,
} from '@/types/rpg';

// Import existing combat components
import { CombatBoard } from './CombatBoard';
import { CombatLog } from './CombatLog';
import { InitiativeTracker } from './InitiativeTracker';
import { HealthBars } from './HealthBars';
import { ActionSelector } from './ActionSelector';

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

interface CombatInterfaceProps {
  session: CombatSession;
  playerCharacters: Character[];
  onCombatAction: (actionType: string, actionData: any) => Promise<void>;
  onExitCombat: () => void;
  className?: string;
}

interface ActionMenuState {
  isOpen: boolean;
  selectedAction: CombatActionType | null;
  targetingMode: boolean;
  selectedTarget: UUID | null;
  availableTargets: UUID[];
}

interface CombatUIState {
  showTargeting: boolean;
  showSpells: boolean;
  showItems: boolean;
  showTactics: boolean;
  selectedParticipant: UUID | null;
}

// ============================================================================
// MAIN COMBAT INTERFACE COMPONENT
// ============================================================================

export default function CombatInterface({
  session,
  playerCharacters,
  onCombatAction,
  onExitCombat,
  className = '',
}: CombatInterfaceProps) {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [actionMenu, setActionMenu] = useState<ActionMenuState>({
    isOpen: false,
    selectedAction: null,
    targetingMode: false,
    selectedTarget: null,
    availableTargets: [],
  });

  const [uiState, setUIState] = useState<CombatUIState>({
    showTargeting: false,
    showSpells: false,
    showItems: false,
    showTactics: false,
    selectedParticipant: null,
  });

  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [combatPhase, setCombatPhase] = useState<
    'setup' | 'active' | 'resolution' | 'ended'
  >('active');
  const [turnTimer, setTurnTimer] = useState<number>(0);
  const [lastActionResult, setLastActionResult] = useState<string>('');

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const currentParticipant = useMemo(() => {
    return session.participants.find(p => p.id === session.currentParticipant);
  }, [session.participants, session.currentParticipant]);

  const isPlayerTurn = useMemo(() => {
    return currentParticipant?.type === 'player';
  }, [currentParticipant]);

  const playerParticipants = useMemo(() => {
    return session.participants.filter(p => p.type === 'player');
  }, [session.participants]);

  const enemyParticipants = useMemo(() => {
    return session.participants.filter(
      p => p.type === 'monster' || p.type === 'npc'
    );
  }, [session.participants]);

  const aliveParticipants = useMemo(() => {
    return session.participants.filter(p => p.character.currentHealth > 0);
  }, [session.participants]);

  const availableActions = useMemo(() => {
    if (!currentParticipant || !isPlayerTurn) return [];

    const actions: CombatActionType[] = ['attack', 'defend', 'wait'];

    // Add conditional actions based on character state
    if (currentParticipant.actionPoints > 0) {
      actions.push('move');
    }

    if (hasUsableSpells(currentParticipant.character)) {
      actions.push('cast_spell');
    }

    if (hasUsableItems(currentParticipant.character)) {
      actions.push('use_item');
    }

    // Add flee if combat is escapable
    if (canFlee(session)) {
      actions.push('flee');
    }

    return actions;
  }, [currentParticipant, isPlayerTurn, session]);

  // ============================================================================
  // TURN TIMER EFFECT
  // ============================================================================

  useEffect(() => {
    if (!isPlayerTurn || combatPhase !== 'active') return;

    const timer = setInterval(() => {
      setTurnTimer(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isPlayerTurn, combatPhase, session.currentTurn]);

  // Reset timer on turn change
  useEffect(() => {
    setTurnTimer(0);
  }, [session.currentParticipant]);

  // ============================================================================
  // ACTION HANDLERS
  // ============================================================================

  const handleActionSelect = useCallback(
    (actionType: CombatActionType) => {
      if (isProcessingAction) return;

      setActionMenu(prev => ({
        ...prev,
        selectedAction: actionType,
        isOpen: false,
      }));

      // Handle actions that require targeting
      if (['attack', 'cast_spell'].includes(actionType)) {
        const targets = getValidTargets(
          actionType,
          currentParticipant!,
          session.participants
        );
        setActionMenu(prev => ({
          ...prev,
          targetingMode: true,
          availableTargets: targets,
        }));
        setUIState(prev => ({ ...prev, showTargeting: true }));
      }
      // Handle actions that require additional selection
      else if (actionType === 'cast_spell') {
        setUIState(prev => ({ ...prev, showSpells: true }));
      } else if (actionType === 'use_item') {
        setUIState(prev => ({ ...prev, showItems: true }));
      }
      // Handle immediate actions
      else {
        executeAction(actionType, {});
      }
    },
    [isProcessingAction, currentParticipant, session.participants]
  );

  const handleTargetSelect = useCallback(
    (targetId: UUID) => {
      if (
        !actionMenu.selectedAction ||
        !actionMenu.availableTargets.includes(targetId)
      )
        return;

      setActionMenu(prev => ({
        ...prev,
        selectedTarget: targetId,
        targetingMode: false,
      }));
      setUIState(prev => ({ ...prev, showTargeting: false }));

      // Execute the action with the selected target
      executeAction(actionMenu.selectedAction, { targetId });
    },
    [actionMenu.selectedAction, actionMenu.availableTargets]
  );

  const handleSpellSelect = useCallback(
    (spellId: UUID) => {
      setUIState(prev => ({ ...prev, showSpells: false }));
      executeAction('cast_spell', {
        spellId,
        targetId: actionMenu.selectedTarget,
      });
    },
    [actionMenu.selectedTarget]
  );

  const handleItemSelect = useCallback(
    (itemId: UUID) => {
      setUIState(prev => ({ ...prev, showItems: false }));
      executeAction('use_item', {
        itemId,
        targetId: actionMenu.selectedTarget,
      });
    },
    [actionMenu.selectedTarget]
  );

  const executeAction = useCallback(
    async (actionType: CombatActionType, actionData: any) => {
      if (isProcessingAction) return;

      setIsProcessingAction(true);

      try {
        await onCombatAction(actionType, {
          participantId: currentParticipant?.id,
          ...actionData,
        });

        setLastActionResult(`${actionType} executed successfully`);

        // Reset action menu
        setActionMenu({
          isOpen: false,
          selectedAction: null,
          targetingMode: false,
          selectedTarget: null,
          availableTargets: [],
        });
      } catch (error) {
        console.error('Combat action failed:', error);
        setLastActionResult(`${actionType} failed`);
      } finally {
        setIsProcessingAction(false);
      }
    },
    [isProcessingAction, currentParticipant, onCombatAction]
  );

  const handleParticipantSelect = useCallback(
    (participantId: UUID) => {
      if (actionMenu.targetingMode) {
        handleTargetSelect(participantId);
      } else {
        setUIState(prev => ({ ...prev, selectedParticipant: participantId }));
      }
    },
    [actionMenu.targetingMode, handleTargetSelect]
  );

  const handlePositionClick = useCallback(
    (position: any) => {
      if (actionMenu.selectedAction === 'move') {
        executeAction('move', { position });
      }
    },
    [actionMenu.selectedAction, executeAction]
  );

  // ============================================================================
  // COMBAT STATE EFFECTS
  // ============================================================================

  useEffect(() => {
    // Determine combat phase
    const alivePlayers = playerParticipants.filter(
      p => p.character.currentHealth > 0
    );
    const aliveEnemies = enemyParticipants.filter(
      p => p.character.currentHealth > 0
    );

    if (alivePlayers.length === 0) {
      setCombatPhase('ended');
      // TODO: Handle defeat
    } else if (aliveEnemies.length === 0) {
      setCombatPhase('ended');
      // TODO: Handle victory
    } else if (session.status === 'ended') {
      setCombatPhase('ended');
    } else {
      setCombatPhase('active');
    }
  }, [playerParticipants, enemyParticipants, session.status]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderActionButton = (actionType: CombatActionType) => {
    const actionConfig = getActionConfig(actionType);
    const isAvailable = availableActions.includes(actionType);
    const isSelected = actionMenu.selectedAction === actionType;

    return (
      <motion.button
        key={actionType}
        onClick={() => handleActionSelect(actionType)}
        disabled={!isAvailable || isProcessingAction}
        className={`
          min-w-[100px] rounded-lg border p-3 text-center transition-all duration-200
          ${
            isSelected
              ? 'border-purple-400 bg-purple-600 text-white shadow-lg'
              : isAvailable
                ? 'border-white/20 bg-white/10 text-white hover:border-purple-400 hover:bg-white/20'
                : 'cursor-not-allowed border-gray-600 bg-gray-700/50 text-gray-400'
          }
        `}
        whileHover={isAvailable ? { scale: 1.05 } : {}}
        whileTap={isAvailable ? { scale: 0.95 } : {}}
      >
        <div className='mb-1 text-2xl'>{actionConfig.icon}</div>
        <div className='text-sm font-medium'>{actionConfig.label}</div>
        {actionConfig.cost && (
          <div className='text-xs opacity-75'>Cost: {actionConfig.cost}</div>
        )}
      </motion.button>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div
      className={`relative h-full w-full bg-gradient-to-br from-red-900/20 via-purple-900/20 to-gray-900/20 ${className}`}
    >
      {/* Combat Header */}
      <div className='absolute left-0 right-0 top-0 z-30 border-b border-red-500/30 bg-black/40 p-4 backdrop-blur-sm'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center space-x-4'>
            <h2 className='text-xl font-bold text-white'>Combat</h2>
            <div className='flex items-center space-x-2 text-sm text-red-300'>
              <span>Turn {session.currentTurn}</span>
              <span>•</span>
              <span
                className={`${isPlayerTurn ? 'text-green-400' : 'text-yellow-400'}`}
              >
                {currentParticipant?.character.name || 'Unknown'}'s Turn
              </span>
              {isPlayerTurn && (
                <>
                  <span>•</span>
                  <span>
                    Timer: {Math.floor(turnTimer / 60)}:
                    {(turnTimer % 60).toString().padStart(2, '0')}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className='flex items-center space-x-2'>
            <button
              onClick={onExitCombat}
              className='rounded bg-red-600/80 px-3 py-1 text-sm text-white transition-colors hover:bg-red-600'
              disabled={combatPhase === 'active'}
              title={
                combatPhase === 'active'
                  ? 'Cannot exit during active combat'
                  : 'Exit combat'
              }
            >
              Exit
            </button>
          </div>
        </div>
      </div>

      {/* Main Combat Area */}
      <div className='flex h-full pt-20'>
        {/* Combat Board - Left Side */}
        <div className='relative flex-1'>
          <CombatBoard
            session={session}
            onParticipantSelect={handleParticipantSelect}
            onPositionClick={handlePositionClick}
            selectedParticipant={uiState.selectedParticipant}
            availablePositions={
              actionMenu.selectedAction === 'move' ? [] : undefined
            } // TODO: Calculate valid positions
            showGrid={true}
            showRanges={actionMenu.targetingMode}
            className='h-full'
          />

          {/* Targeting Overlay */}
          {uiState.showTargeting && (
            <div className='absolute inset-0 z-20 flex items-center justify-center bg-red-500/20 backdrop-blur-sm'>
              <div className='rounded-lg bg-black/60 p-6'>
                <h3 className='mb-4 text-lg font-bold text-white'>
                  Select Target
                </h3>
                <p className='mb-4 text-red-200'>
                  Click on a valid target to execute your{' '}
                  {actionMenu.selectedAction}
                </p>
                <button
                  onClick={() => {
                    setUIState(prev => ({ ...prev, showTargeting: false }));
                    setActionMenu(prev => ({
                      ...prev,
                      targetingMode: false,
                      selectedAction: null,
                    }));
                  }}
                  className='rounded bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700'
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Side Panel */}
        <div className='flex w-80 flex-col border-l border-white/10 bg-black/20 backdrop-blur-sm'>
          {/* Initiative Tracker */}
          <div className='border-b border-white/10 p-4'>
            <InitiativeTracker
              participants={session.participants}
              currentParticipant={session.currentParticipant}
              turnOrder={session.turnOrder}
            />
          </div>

          {/* Current Turn Actions */}
          {isPlayerTurn && combatPhase === 'active' && (
            <div className='border-b border-white/10 p-4'>
              <h3 className='mb-3 font-semibold text-white'>Your Actions</h3>
              <div className='grid grid-cols-2 gap-2'>
                {availableActions.map(renderActionButton)}
              </div>
            </div>
          )}

          {/* Action Processing */}
          {isProcessingAction && (
            <div className='border-b border-white/10 p-4'>
              <div className='flex items-center space-x-3 text-white'>
                <div className='h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent'></div>
                <span>Processing action...</span>
              </div>
            </div>
          )}

          {/* Health Status */}
          <div className='flex-1 border-b border-white/10 p-4'>
            <HealthBars
              participants={session.participants}
              selectedParticipant={uiState.selectedParticipant}
              onParticipantSelect={handleParticipantSelect}
            />
          </div>

          {/* Combat Log */}
          <div className='min-h-0 flex-1'>
            <CombatLog
              logEntries={session.log}
              maxEntries={20}
              className='h-full'
            />
          </div>
        </div>
      </div>

      {/* Combat End Modal */}
      <AnimatePresence>
        {combatPhase === 'ended' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm'
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className='mx-4 max-w-md rounded-lg border border-purple-500/30 bg-gradient-to-br from-purple-900 to-gray-900 p-8'
            >
              <div className='text-center'>
                <div className='mb-4 text-6xl'>
                  {playerParticipants.filter(p => p.character.currentHealth > 0)
                    .length > 0
                    ? '🏆'
                    : '💀'}
                </div>
                <h2 className='mb-2 text-2xl font-bold text-white'>
                  {playerParticipants.filter(p => p.character.currentHealth > 0)
                    .length > 0
                    ? 'Victory!'
                    : 'Defeat!'}
                </h2>
                <p className='mb-6 text-purple-200'>
                  {playerParticipants.filter(p => p.character.currentHealth > 0)
                    .length > 0
                    ? 'You have emerged victorious from combat!'
                    : 'Your party has been defeated...'}
                </p>
                <button
                  onClick={onExitCombat}
                  className='rounded-lg bg-purple-600 px-6 py-3 font-medium text-white transition-colors hover:bg-purple-700'
                >
                  Continue
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Last Action Result */}
      <AnimatePresence>
        {lastActionResult && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className='absolute right-4 top-24 z-40 rounded-lg bg-black/60 px-4 py-2 text-white backdrop-blur-sm'
          >
            {lastActionResult}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getActionConfig(actionType: CombatActionType) {
  const configs = {
    attack: { icon: '⚔️', label: 'Attack', cost: '1 AP' },
    defend: { icon: '🛡️', label: 'Defend', cost: '0 AP' },
    move: { icon: '👣', label: 'Move', cost: '1 AP' },
    cast_spell: { icon: '✨', label: 'Cast Spell', cost: 'Varies' },
    use_item: { icon: '🧪', label: 'Use Item', cost: '1 AP' },
    flee: { icon: '💨', label: 'Flee', cost: '1 AP' },
    wait: { icon: '⏳', label: 'Wait', cost: '0 AP' },
  };

  return configs[actionType] || { icon: '❓', label: 'Unknown', cost: '' };
}

function getValidTargets(
  actionType: CombatActionType,
  participant: CombatParticipant,
  allParticipants: CombatParticipant[]
): UUID[] {
  switch (actionType) {
    case 'attack':
      // Can target enemies within range
      return allParticipants
        .filter(
          p =>
            p.id !== participant.id &&
            p.character.currentHealth > 0 &&
            (p.type === 'monster' ||
              (participant.type === 'monster' && p.type === 'player'))
        )
        .map(p => p.id);

    case 'cast_spell':
      // TODO: Determine based on spell type
      return allParticipants
        .filter(p => p.character.currentHealth > 0)
        .map(p => p.id);

    default:
      return [];
  }
}

function hasUsableSpells(character: Character): boolean {
  // TODO: Check character spells/abilities
  return character.skills.magic > 0;
}

function hasUsableItems(character: Character): boolean {
  // TODO: Check inventory for usable items
  return true; // Placeholder
}

function canFlee(session: CombatSession): boolean {
  // TODO: Check if combat allows fleeing
  return session.environment.type !== 'enclosed';
}
