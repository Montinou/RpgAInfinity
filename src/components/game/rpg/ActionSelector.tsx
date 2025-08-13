/**
 * ActionSelector - Player Action Selection Component
 *
 * Provides an interface for players to select and configure their combat actions.
 * Displays available actions based on character abilities, items, and current situation.
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CombatAction,
  CombatActionType,
  CombatParticipant,
  CombatSession,
  Character,
  Item,
  CombatPosition,
  UUID,
} from '@/types/rpg';
import { cn } from '@/lib/utils';
import {
  Sword,
  Shield,
  Zap,
  Package,
  Move,
  Clock,
  ArrowRight,
  Target,
  Users,
  Sparkles,
} from 'lucide-react';

// ============================================================================
// COMPONENT INTERFACES
// ============================================================================

interface ActionSelectorProps {
  session: CombatSession;
  currentParticipant: CombatParticipant;
  onActionSelect: (action: CombatAction) => void;
  onTargetRequired: (actionType: CombatActionType) => void;
  selectedTarget?: UUID;
  availableTargets: CombatParticipant[];
  className?: string;
}

interface ActionButtonProps {
  actionType: CombatActionType;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  isAvailable: boolean;
  isSelected: boolean;
  requiresTarget: boolean;
  actionPointCost: number;
  onClick: () => void;
  shortcut?: string;
}

interface ActionDetailsProps {
  actionType: CombatActionType;
  character: Character;
  selectedTarget?: CombatParticipant;
  onConfirm: () => void;
  onCancel: () => void;
}

interface SpellSelectorProps {
  character: Character;
  onSpellSelect: (spellId: string) => void;
  selectedSpell?: string;
}

interface ItemSelectorProps {
  character: Character;
  onItemSelect: (itemId: string) => void;
  selectedItem?: string;
}

// ============================================================================
// ACTION DEFINITIONS
// ============================================================================

const ACTION_DEFINITIONS = {
  attack: {
    icon: Sword,
    label: 'Attack',
    description: 'Make a physical attack against an enemy',
    requiresTarget: true,
    actionPointCost: 1,
    shortcut: 'A',
    color: 'text-red-500',
    bgColor: 'bg-red-50 hover:bg-red-100',
  },
  defend: {
    icon: Shield,
    label: 'Defend',
    description: 'Take a defensive stance, reducing incoming damage',
    requiresTarget: false,
    actionPointCost: 1,
    shortcut: 'D',
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 hover:bg-blue-100',
  },
  cast_spell: {
    icon: Sparkles,
    label: 'Cast Spell',
    description: 'Cast a magical spell',
    requiresTarget: true,
    actionPointCost: 2,
    shortcut: 'S',
    color: 'text-purple-500',
    bgColor: 'bg-purple-50 hover:bg-purple-100',
  },
  use_item: {
    icon: Package,
    label: 'Use Item',
    description: 'Use an item from inventory',
    requiresTarget: false,
    actionPointCost: 1,
    shortcut: 'I',
    color: 'text-green-500',
    bgColor: 'bg-green-50 hover:bg-green-100',
  },
  move: {
    icon: Move,
    label: 'Move',
    description: 'Change position on the battlefield',
    requiresTarget: false,
    actionPointCost: 1,
    shortcut: 'M',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50 hover:bg-yellow-100',
  },
  wait: {
    icon: Clock,
    label: 'Wait',
    description: 'Skip turn and restore action points',
    requiresTarget: false,
    actionPointCost: 0,
    shortcut: 'W',
    color: 'text-gray-500',
    bgColor: 'bg-gray-50 hover:bg-gray-100',
  },
  flee: {
    icon: ArrowRight,
    label: 'Flee',
    description: 'Attempt to escape from combat',
    requiresTarget: false,
    actionPointCost: 2,
    shortcut: 'F',
    color: 'text-orange-500',
    bgColor: 'bg-orange-50 hover:bg-orange-100',
  },
} as const;

// ============================================================================
// MAIN ACTION SELECTOR COMPONENT
// ============================================================================

export const ActionSelector: React.FC<ActionSelectorProps> = ({
  session,
  currentParticipant,
  onActionSelect,
  onTargetRequired,
  selectedTarget,
  availableTargets,
  className,
}) => {
  const [selectedAction, setSelectedAction] = useState<CombatActionType | null>(
    null
  );
  const [showDetails, setShowDetails] = useState(false);
  const [selectedSpell, setSelectedSpell] = useState<string>();
  const [selectedItem, setSelectedItem] = useState<string>();
  const [selectedPosition, setSelectedPosition] = useState<CombatPosition>();

  const character = currentParticipant.character;

  // Reset selection when participant changes
  useEffect(() => {
    setSelectedAction(null);
    setShowDetails(false);
    setSelectedSpell(undefined);
    setSelectedItem(undefined);
    setSelectedPosition(undefined);
  }, [currentParticipant.id]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (showDetails) return; // Don't handle shortcuts when in detail view

      const key = event.key.toLowerCase();
      const actionEntry = Object.entries(ACTION_DEFINITIONS).find(
        ([_, def]) => def.shortcut.toLowerCase() === key
      );

      if (actionEntry) {
        event.preventDefault();
        handleActionClick(actionEntry[0] as CombatActionType);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showDetails, currentParticipant]);

  // Available actions based on character and situation
  const availableActions = useMemo(() => {
    const actions: CombatActionType[] = [];

    // Basic actions always available
    actions.push('attack', 'defend', 'wait');

    // Movement (if not at edge or blocked)
    actions.push('move');

    // Spells (if character has mana/spell slots)
    //TODO: Check for actual spells and mana when spell system is implemented
    if (character.stats.intelligence > 10) {
      actions.push('cast_spell');
    }

    // Items (if character has useable items)
    //TODO: Check actual inventory when inventory system is connected
    actions.push('use_item');

    // Flee (if not surrounded or in special conditions)
    actions.push('flee');

    return actions;
  }, [character, session]);

  const handleActionClick = (actionType: CombatActionType) => {
    const actionDef = ACTION_DEFINITIONS[actionType];

    // Check if player has enough action points
    if (currentParticipant.actionPoints < actionDef.actionPointCost) {
      return; // Not enough action points
    }

    setSelectedAction(actionType);

    if (actionDef.requiresTarget) {
      onTargetRequired(actionType);
    } else if (actionType === 'cast_spell' || actionType === 'use_item') {
      setShowDetails(true);
    } else {
      // Simple action, execute immediately
      executeAction(actionType);
    }
  };

  const executeAction = (actionType: CombatActionType) => {
    const action: CombatAction = {
      id: crypto.randomUUID(),
      type: actionType,
      playerId: currentParticipant.id,
      gameId: session.id,
      timestamp: new Date(),
      data: {
        targetId: selectedTarget,
        spellId: selectedSpell,
        itemId: selectedItem,
        position: selectedPosition,
      },
    };

    onActionSelect(action);

    // Reset selection
    setSelectedAction(null);
    setShowDetails(false);
    setSelectedSpell(undefined);
    setSelectedItem(undefined);
    setSelectedPosition(undefined);
  };

  const handleConfirmAction = () => {
    if (selectedAction) {
      executeAction(selectedAction);
    }
  };

  const handleCancelAction = () => {
    setSelectedAction(null);
    setShowDetails(false);
    setSelectedSpell(undefined);
    setSelectedItem(undefined);
    setSelectedPosition(undefined);
  };

  // Get the current target participant
  const selectedTargetParticipant = selectedTarget
    ? availableTargets.find(t => t.id === selectedTarget)
    : undefined;

  return (
    <div
      className={cn(
        'action-selector rounded-lg border bg-white shadow-lg',
        className
      )}
    >
      {/* Header */}
      <div className='border-b bg-gray-50 p-4'>
        <div className='flex items-center justify-between'>
          <div>
            <h3 className='text-lg font-bold'>{character.name}'s Turn</h3>
            <p className='text-sm text-gray-600'>
              Action Points: {currentParticipant.actionPoints}/
              {currentParticipant.maxActionPoints}
            </p>
          </div>
          <div className='text-right'>
            <div className='text-sm text-gray-600'>Health</div>
            <div className='text-lg font-bold'>
              {character.currentHealth}/{character.maxHealth}
            </div>
          </div>
        </div>
      </div>

      {/* Action Details Modal */}
      <AnimatePresence>
        {showDetails && selectedAction && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className='absolute inset-0 z-50 rounded-lg bg-white shadow-xl'
          >
            <ActionDetails
              actionType={selectedAction}
              character={character}
              selectedTarget={selectedTargetParticipant}
              onConfirm={handleConfirmAction}
              onCancel={handleCancelAction}
            />

            {selectedAction === 'cast_spell' && (
              <SpellSelector
                character={character}
                onSpellSelect={setSelectedSpell}
                selectedSpell={selectedSpell}
              />
            )}

            {selectedAction === 'use_item' && (
              <ItemSelector
                character={character}
                onItemSelect={setSelectedItem}
                selectedItem={selectedItem}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Buttons */}
      <div className='p-4'>
        <div className='grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4'>
          {availableActions.map(actionType => {
            const actionDef = ACTION_DEFINITIONS[actionType];
            const isAvailable =
              currentParticipant.actionPoints >= actionDef.actionPointCost;
            const isSelected = selectedAction === actionType;

            return (
              <ActionButton
                key={actionType}
                actionType={actionType}
                icon={actionDef.icon}
                label={actionDef.label}
                description={actionDef.description}
                isAvailable={isAvailable}
                isSelected={isSelected}
                requiresTarget={actionDef.requiresTarget}
                actionPointCost={actionDef.actionPointCost}
                onClick={() => handleActionClick(actionType)}
                shortcut={actionDef.shortcut}
              />
            );
          })}
        </div>

        {/* Target Selection Info */}
        {selectedAction &&
          ACTION_DEFINITIONS[selectedAction].requiresTarget && (
            <div className='mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3'>
              <div className='flex items-center space-x-2'>
                <Target className='h-5 w-5 text-yellow-600' />
                <span className='text-sm text-yellow-800'>
                  {selectedTarget
                    ? `Target: ${selectedTargetParticipant?.character.name}`
                    : 'Please select a target on the battlefield'}
                </span>
              </div>
            </div>
          )}

        {/* Action Confirmation */}
        {selectedAction &&
          selectedTarget &&
          ACTION_DEFINITIONS[selectedAction].requiresTarget && (
            <div className='mt-4 flex space-x-2'>
              <button
                onClick={handleConfirmAction}
                className='flex-1 rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700'
              >
                Confirm {ACTION_DEFINITIONS[selectedAction].label}
              </button>
              <button
                onClick={handleCancelAction}
                className='rounded-lg bg-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-300'
              >
                Cancel
              </button>
            </div>
          )}
      </div>

      {/* Quick Info */}
      <div className='border-t bg-gray-50 p-4 text-xs text-gray-600'>
        <p>
          Use keyboard shortcuts or click actions above. Actions consume Action
          Points (AP).
        </p>
      </div>
    </div>
  );
};

// ============================================================================
// ACTION BUTTON COMPONENT
// ============================================================================

const ActionButton: React.FC<ActionButtonProps> = ({
  actionType,
  icon: Icon,
  label,
  description,
  isAvailable,
  isSelected,
  requiresTarget,
  actionPointCost,
  onClick,
  shortcut,
}) => {
  const actionDef = ACTION_DEFINITIONS[actionType];

  return (
    <motion.button
      onClick={isAvailable ? onClick : undefined}
      disabled={!isAvailable}
      className={cn(
        'relative rounded-lg border-2 p-3 text-left transition-all duration-200',
        isAvailable
          ? `${actionDef.bgColor} cursor-pointer border-transparent hover:border-gray-300`
          : 'cursor-not-allowed border-gray-200 bg-gray-100 opacity-50',
        isSelected && 'border-blue-500 ring-2 ring-blue-500'
      )}
      whileHover={isAvailable ? { scale: 1.02 } : {}}
      whileTap={isAvailable ? { scale: 0.98 } : {}}
    >
      <div className='flex items-center space-x-2'>
        <Icon className={cn('h-5 w-5', actionDef.color)} />
        <div className='min-w-0 flex-1'>
          <div className='text-sm font-medium'>{label}</div>
          <div className='truncate text-xs text-gray-600'>{description}</div>
        </div>
      </div>

      <div className='mt-2 flex items-center justify-between'>
        <div className='flex items-center space-x-2'>
          {requiresTarget && <Target className='h-3 w-3 text-gray-400' />}
          <span className='text-xs text-gray-500'>{actionPointCost} AP</span>
        </div>
        <div className='rounded bg-gray-200 px-1 text-xs text-gray-400'>
          {shortcut}
        </div>
      </div>
    </motion.button>
  );
};

// ============================================================================
// ACTION DETAILS COMPONENT
// ============================================================================

const ActionDetails: React.FC<ActionDetailsProps> = ({
  actionType,
  character,
  selectedTarget,
  onConfirm,
  onCancel,
}) => {
  const actionDef = ACTION_DEFINITIONS[actionType];

  return (
    <div className='p-6'>
      <div className='mb-4 flex items-center space-x-3'>
        <actionDef.icon className={cn('h-8 w-8', actionDef.color)} />
        <div>
          <h3 className='text-xl font-bold'>{actionDef.label}</h3>
          <p className='text-gray-600'>{actionDef.description}</p>
        </div>
      </div>

      {/* Action Preview */}
      <div className='mb-4 rounded-lg bg-gray-50 p-4'>
        <h4 className='mb-2 font-medium'>Action Preview</h4>
        <div className='text-sm text-gray-700'>
          <p>
            <strong>User:</strong> {character.name}
          </p>
          <p>
            <strong>Cost:</strong> {actionDef.actionPointCost} Action Points
          </p>
          {selectedTarget && (
            <p>
              <strong>Target:</strong> {selectedTarget.character.name}
            </p>
          )}
          {actionType === 'attack' && (
            <>
              <p>
                <strong>Expected Damage:</strong>{' '}
                {Math.floor(character.stats.strength / 2)}-
                {character.stats.strength}
              </p>
              <p>
                <strong>Hit Chance:</strong> ~
                {Math.max(
                  50,
                  70 + Math.floor((character.stats.dexterity - 10) / 2)
                )}
                %
              </p>
            </>
          )}
        </div>
      </div>

      {/* Confirm/Cancel Buttons */}
      <div className='flex space-x-3'>
        <button
          onClick={onConfirm}
          className='flex-1 rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700'
        >
          Confirm Action
        </button>
        <button
          onClick={onCancel}
          className='rounded-lg bg-gray-200 px-6 py-2 text-gray-700 transition-colors hover:bg-gray-300'
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// SPELL SELECTOR COMPONENT
// ============================================================================

const SpellSelector: React.FC<SpellSelectorProps> = ({
  character,
  onSpellSelect,
  selectedSpell,
}) => {
  // TODO: Get actual spells from character when spell system is implemented
  const availableSpells = [
    {
      id: 'fireball',
      name: 'Fireball',
      cost: 10,
      damage: '2d6+INT',
      description: 'Hurls a fiery ball at target',
    },
    {
      id: 'heal',
      name: 'Heal',
      cost: 8,
      damage: '1d8+WIS',
      description: 'Restores health to target',
    },
    {
      id: 'lightning',
      name: 'Lightning Bolt',
      cost: 12,
      damage: '3d4+INT',
      description: 'Strikes with lightning',
    },
  ];

  return (
    <div className='border-t p-4'>
      <h4 className='mb-3 font-medium'>Select Spell</h4>
      <div className='space-y-2'>
        {availableSpells.map(spell => (
          <button
            key={spell.id}
            onClick={() => onSpellSelect(spell.id)}
            className={cn(
              'w-full rounded-lg border p-3 text-left transition-colors',
              selectedSpell === spell.id
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 hover:bg-gray-50'
            )}
          >
            <div className='flex items-start justify-between'>
              <div>
                <div className='font-medium'>{spell.name}</div>
                <div className='text-sm text-gray-600'>{spell.description}</div>
              </div>
              <div className='text-right text-sm'>
                <div className='font-medium text-purple-600'>
                  {spell.cost} MP
                </div>
                <div className='text-gray-500'>{spell.damage}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// ITEM SELECTOR COMPONENT
// ============================================================================

const ItemSelector: React.FC<ItemSelectorProps> = ({
  character,
  onItemSelect,
  selectedItem,
}) => {
  // TODO: Get actual items from character inventory when inventory system is implemented
  const availableItems = [
    {
      id: 'health_potion',
      name: 'Health Potion',
      quantity: 3,
      effect: 'Restores 50 HP',
      description: 'A red potion that heals wounds',
    },
    {
      id: 'mana_potion',
      name: 'Mana Potion',
      quantity: 2,
      effect: 'Restores 30 MP',
      description: 'A blue potion that restores magical energy',
    },
    {
      id: 'smoke_bomb',
      name: 'Smoke Bomb',
      quantity: 1,
      effect: 'Blinds enemies',
      description: 'Creates a cloud of concealing smoke',
    },
  ];

  return (
    <div className='border-t p-4'>
      <h4 className='mb-3 font-medium'>Select Item</h4>
      <div className='space-y-2'>
        {availableItems.map(item => (
          <button
            key={item.id}
            onClick={() => onItemSelect(item.id)}
            className={cn(
              'w-full rounded-lg border p-3 text-left transition-colors',
              selectedItem === item.id
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:bg-gray-50'
            )}
            disabled={item.quantity <= 0}
          >
            <div className='flex items-start justify-between'>
              <div className='flex-1'>
                <div className='flex items-center space-x-2'>
                  <span className='font-medium'>{item.name}</span>
                  <span className='text-sm text-gray-500'>
                    x{item.quantity}
                  </span>
                </div>
                <div className='text-sm text-gray-600'>{item.description}</div>
              </div>
              <div className='text-right text-sm'>
                <div className='font-medium text-green-600'>{item.effect}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ActionSelector;
