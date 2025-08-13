'use client';

/**
 * RPG Character Sheet Component
 *
 * Comprehensive character sheet display for RpgAInfinity RPG module.
 * Shows character stats, skills, equipment, inventory, and progression with
 * real-time updates and interactive elements for character management.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Character,
  CharacterStats,
  CharacterSkills,
  Equipment,
  Inventory,
  Item,
  StatusEffect,
  UUID,
} from '@/types/rpg';
import { GameError, ErrorCode } from '@/types/core';
import { characterManager, ComputedStats } from '@/lib/games/rpg/character';
import {
  skillTreeManager,
  SkillProgression,
  SkillNode,
} from '@/lib/games/rpg/skills';
import { inventoryManager, EquipmentBonuses } from '@/lib/games/rpg/inventory';

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

interface CharacterSheetProps {
  readonly character: Character;
  readonly inventory: Inventory;
  readonly equipment: Equipment;
  readonly skillProgression: SkillProgression;
  readonly playerId: UUID;
  readonly onCharacterUpdate?: (character: Character) => void;
  readonly onInventoryUpdate?: (inventory: Inventory) => void;
  readonly onEquipmentUpdate?: (equipment: Equipment) => void;
  readonly onSkillUpdate?: (progression: SkillProgression) => void;
  readonly isEditable?: boolean;
}

interface SheetTab {
  readonly id: string;
  readonly title: string;
  readonly icon: string;
}

// ============================================================================
// CHARACTER SHEET COMPONENT
// ============================================================================

export default function CharacterSheet({
  character,
  inventory,
  equipment,
  skillProgression,
  playerId,
  onCharacterUpdate,
  onInventoryUpdate,
  onEquipmentUpdate,
  onSkillUpdate,
  isEditable = false,
}: CharacterSheetProps) {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const computedStats = useMemo<ComputedStats>(() => {
    try {
      return characterManager.calculateStats(character);
    } catch (error) {
      console.error('Error computing stats:', error);
      return {
        baseStats: character.stats,
        modifiedStats: character.stats,
        derivedStats: {
          maxHealth: character.maxHealth,
          currentHealth: character.currentHealth,
          armorClass: 10,
          initiative: 0,
          carryCapacity: character.stats.strength * 10,
          manaPoints: 0,
          skillModifiers: character.skills,
        },
      };
    }
  }, [character]);

  const equipmentBonuses = useMemo<EquipmentBonuses>(() => {
    try {
      return inventoryManager.calculateEquipmentBonuses(equipment);
    } catch (error) {
      console.error('Error computing equipment bonuses:', error);
      return {
        statBonuses: {},
        skillBonuses: {},
        specialEffects: [],
        setBonuses: [],
      };
    }
  }, [equipment]);

  const inventoryStats = useMemo(() => {
    try {
      return inventoryManager.calculateInventoryStats(inventory, character);
    } catch (error) {
      console.error('Error computing inventory stats:', error);
      return {
        currentWeight: 0,
        maxWeight: character.stats.strength * 10,
        usedCapacity: inventory.items.length,
        maxCapacity: inventory.capacity,
        encumbrance: 'none' as const,
      };
    }
  }, [inventory, character]);

  const availableSkills = useMemo<SkillNode[]>(() => {
    try {
      return skillTreeManager.getAvailableSkills(character, skillProgression);
    } catch (error) {
      console.error('Error getting available skills:', error);
      return [];
    }
  }, [character, skillProgression]);

  // ============================================================================
  // TAB CONFIGURATION
  // ============================================================================

  const tabs: SheetTab[] = [
    { id: 'overview', title: 'Overview', icon: '👤' },
    { id: 'stats', title: 'Statistics', icon: '📊' },
    { id: 'skills', title: 'Skills', icon: '🎯' },
    { id: 'equipment', title: 'Equipment', icon: '⚔️' },
    { id: 'inventory', title: 'Inventory', icon: '🎒' },
    { id: 'progression', title: 'Progression', icon: '⭐' },
  ];

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleStatModification = useCallback(
    async (stat: keyof CharacterStats, change: number) => {
      if (!isEditable || !onCharacterUpdate) return;

      setIsLoading(true);
      setError('');

      try {
        const newValue = Math.max(
          1,
          Math.min(100, character.stats[stat] + change)
        );
        const updatedCharacter: Character = {
          ...character,
          stats: {
            ...character.stats,
            [stat]: newValue,
          },
        };

        onCharacterUpdate(updatedCharacter);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : 'Failed to update stat'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [character, isEditable, onCharacterUpdate]
  );

  const handleSkillLearn = useCallback(
    async (skillId: UUID) => {
      if (!onSkillUpdate) return;

      setIsLoading(true);
      setError('');

      try {
        const newProgression = skillTreeManager.learnSkill(
          character,
          skillId,
          skillProgression
        );
        onSkillUpdate(newProgression);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : 'Failed to learn skill'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [character, skillProgression, onSkillUpdate]
  );

  const handleItemEquip = useCallback(
    async (itemId: UUID) => {
      if (!onInventoryUpdate || !onEquipmentUpdate) return;

      setIsLoading(true);
      setError('');

      try {
        const result = inventoryManager.equipItem(
          inventory,
          equipment,
          itemId,
          character
        );
        onInventoryUpdate(result.inventory);
        onEquipmentUpdate(result.equipment);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : 'Failed to equip item'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [inventory, equipment, character, onInventoryUpdate, onEquipmentUpdate]
  );

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderOverviewTab = () => (
    <div className='space-y-6'>
      {/* Character Header */}
      <div className='rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6'>
        <div className='mb-4 flex items-center justify-between'>
          <div>
            <h2 className='text-2xl font-bold text-gray-900'>
              {character.name}
            </h2>
            <p className='text-gray-600'>
              Level {character.level} {character.race.name}{' '}
              {character.class.name}
            </p>
          </div>
          <div className='text-right'>
            <div className='text-sm text-gray-500'>Experience</div>
            <div className='text-lg font-semibold'>
              {character.experience.toLocaleString()} XP
            </div>
          </div>
        </div>

        {/* Health Bar */}
        <div className='mb-4'>
          <div className='mb-1 flex justify-between text-sm text-gray-600'>
            <span>Health</span>
            <span>
              {computedStats.derivedStats.currentHealth} /{' '}
              {computedStats.derivedStats.maxHealth}
            </span>
          </div>
          <div className='h-3 w-full rounded-full bg-gray-200'>
            <div
              className='h-3 rounded-full bg-red-600 transition-all duration-300'
              style={{
                width: `${Math.max(0, (computedStats.derivedStats.currentHealth / computedStats.derivedStats.maxHealth) * 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Quick Stats */}
        <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
          <div className='text-center'>
            <div className='text-xs text-gray-500'>Armor Class</div>
            <div className='text-lg font-semibold'>
              {computedStats.derivedStats.armorClass}
            </div>
          </div>
          <div className='text-center'>
            <div className='text-xs text-gray-500'>Initiative</div>
            <div className='text-lg font-semibold'>
              {computedStats.derivedStats.initiative >= 0 ? '+' : ''}
              {computedStats.derivedStats.initiative}
            </div>
          </div>
          <div className='text-center'>
            <div className='text-xs text-gray-500'>Mana</div>
            <div className='text-lg font-semibold'>
              {computedStats.derivedStats.manaPoints}
            </div>
          </div>
          <div className='text-center'>
            <div className='text-xs text-gray-500'>Encumbrance</div>
            <div
              className={`text-lg font-semibold capitalize ${
                inventoryStats.encumbrance === 'none'
                  ? 'text-green-600'
                  : inventoryStats.encumbrance === 'light'
                    ? 'text-yellow-600'
                    : inventoryStats.encumbrance === 'heavy'
                      ? 'text-orange-600'
                      : 'text-red-600'
              }`}
            >
              {inventoryStats.encumbrance}
            </div>
          </div>
        </div>
      </div>

      {/* Status Effects */}
      {character.statusEffects.length > 0 && (
        <div className='rounded-lg border border-gray-200 bg-white p-4'>
          <h3 className='mb-3 font-semibold text-gray-900'>Status Effects</h3>
          <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
            {character.statusEffects.map(effect => (
              <div
                key={effect.id}
                className={`rounded border p-3 ${
                  effect.type === 'buff'
                    ? 'border-green-200 bg-green-50'
                    : effect.type === 'debuff'
                      ? 'border-red-200 bg-red-50'
                      : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className='font-medium'>{effect.name}</div>
                <div className='text-sm text-gray-600'>
                  {effect.description}
                </div>
                <div className='mt-1 text-xs text-gray-500'>
                  Duration: {effect.duration} turns
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Background & Traits */}
      <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
        <div className='rounded-lg border border-gray-200 bg-white p-4'>
          <h3 className='mb-3 font-semibold text-gray-900'>Background</h3>
          <div className='space-y-2'>
            <div>
              <span className='font-medium'>{character.background.name}</span>
            </div>
            <p className='text-sm text-gray-600'>
              {character.background.description}
            </p>
            <div className='text-sm'>
              <span className='font-medium text-gray-700'>Connections: </span>
              <span className='text-gray-600'>
                {character.background.connections.join(', ')}
              </span>
            </div>
          </div>
        </div>

        <div className='rounded-lg border border-gray-200 bg-white p-4'>
          <h3 className='mb-3 font-semibold text-gray-900'>Traits</h3>
          <div className='space-y-2'>
            {character.traits.length > 0 ? (
              character.traits.map((trait, index) => (
                <div key={index} className='rounded border border-gray-100 p-2'>
                  <div
                    className={`font-medium ${
                      trait.type === 'positive'
                        ? 'text-green-700'
                        : trait.type === 'negative'
                          ? 'text-red-700'
                          : 'text-gray-700'
                    }`}
                  >
                    {trait.name}
                  </div>
                  <p className='text-xs text-gray-600'>{trait.description}</p>
                </div>
              ))
            ) : (
              <p className='text-sm text-gray-500'>No special traits</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStatsTab = () => (
    <div className='space-y-6'>
      {/* Base Stats */}
      <div className='rounded-lg border border-gray-200 bg-white p-6'>
        <h3 className='mb-4 font-semibold text-gray-900'>Attributes</h3>
        <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
          {Object.entries(computedStats.baseStats).map(([stat, value]) => {
            const modifiedValue =
              computedStats.modifiedStats[stat as keyof CharacterStats];
            const modifier = Math.floor((modifiedValue - 10) / 2);
            const bonus =
              equipmentBonuses.statBonuses[stat as keyof CharacterStats] || 0;

            return (
              <div
                key={stat}
                className='flex items-center justify-between rounded bg-gray-50 p-3'
              >
                <div className='flex-1'>
                  <div className='font-medium capitalize text-gray-900'>
                    {stat}
                  </div>
                  <div className='text-sm text-gray-500'>
                    Modifier: {modifier >= 0 ? '+' : ''}
                    {modifier}
                  </div>
                </div>
                <div className='flex items-center space-x-3'>
                  {isEditable && (
                    <button
                      onClick={() =>
                        handleStatModification(stat as keyof CharacterStats, -1)
                      }
                      disabled={isLoading || value <= 1}
                      className='flex h-8 w-8 items-center justify-center rounded border border-gray-300 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50'
                    >
                      -
                    </button>
                  )}
                  <div className='min-w-[4rem] text-center'>
                    <div className='text-lg font-bold'>{value}</div>
                    {bonus > 0 && (
                      <div className='text-xs text-blue-600'>+{bonus} (eq)</div>
                    )}
                  </div>
                  {isEditable && (
                    <button
                      onClick={() =>
                        handleStatModification(stat as keyof CharacterStats, 1)
                      }
                      disabled={isLoading || value >= 100}
                      className='flex h-8 w-8 items-center justify-center rounded border border-gray-300 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50'
                    >
                      +
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Derived Stats */}
      <div className='rounded-lg border border-gray-200 bg-white p-6'>
        <h3 className='mb-4 font-semibold text-gray-900'>Derived Statistics</h3>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
          <div className='rounded bg-red-50 p-4 text-center'>
            <div className='text-2xl font-bold text-red-600'>
              {computedStats.derivedStats.currentHealth} /{' '}
              {computedStats.derivedStats.maxHealth}
            </div>
            <div className='text-sm text-gray-600'>Hit Points</div>
          </div>
          <div className='rounded bg-blue-50 p-4 text-center'>
            <div className='text-2xl font-bold text-blue-600'>
              {computedStats.derivedStats.manaPoints}
            </div>
            <div className='text-sm text-gray-600'>Mana Points</div>
          </div>
          <div className='rounded bg-green-50 p-4 text-center'>
            <div className='text-2xl font-bold text-green-600'>
              {computedStats.derivedStats.armorClass}
            </div>
            <div className='text-sm text-gray-600'>Armor Class</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSkillsTab = () => (
    <div className='space-y-6'>
      {/* Current Skills */}
      <div className='rounded-lg border border-gray-200 bg-white p-6'>
        <h3 className='mb-4 font-semibold text-gray-900'>Skills</h3>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          {Object.entries(character.skills).map(([skill, value]) => {
            const modifiedValue =
              computedStats.derivedStats.skillModifiers[
                skill as keyof CharacterSkills
              ];
            const bonus =
              equipmentBonuses.skillBonuses[skill as keyof CharacterSkills] ||
              0;

            return (
              <div
                key={skill}
                className='flex items-center justify-between rounded bg-gray-50 p-3'
              >
                <div className='flex-1'>
                  <div className='font-medium capitalize text-gray-900'>
                    {skill}
                  </div>
                  {bonus > 0 && (
                    <div className='text-xs text-blue-600'>
                      +{bonus} equipment bonus
                    </div>
                  )}
                </div>
                <div className='text-right'>
                  <div className='text-lg font-semibold'>{value}</div>
                  {modifiedValue !== value && (
                    <div className='text-xs text-gray-500'>
                      ({modifiedValue >= 0 ? '+' : ''}
                      {modifiedValue} total)
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Available Skills to Learn */}
      {isEditable && availableSkills.length > 0 && (
        <div className='rounded-lg border border-gray-200 bg-white p-6'>
          <h3 className='mb-4 font-semibold text-gray-900'>
            Available Skills
            <span className='ml-2 text-sm font-normal text-gray-500'>
              ({skillProgression.availablePoints} points available)
            </span>
          </h3>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            {availableSkills.slice(0, 8).map(skill => (
              <div
                key={skill.id}
                className='rounded border border-gray-200 p-4'
              >
                <div className='mb-2 flex items-start justify-between'>
                  <div>
                    <h4 className='font-medium text-gray-900'>{skill.name}</h4>
                    <div className='text-xs text-gray-500'>
                      Tier {skill.tier} • {skill.cost.skillPoints} points
                    </div>
                  </div>
                  <button
                    onClick={() => handleSkillLearn(skill.id)}
                    disabled={
                      isLoading ||
                      skillProgression.availablePoints < skill.cost.skillPoints
                    }
                    className='rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'
                  >
                    Learn
                  </button>
                </div>
                <p className='mb-2 text-sm text-gray-600'>
                  {skill.description}
                </p>
                {skill.prerequisites.length > 0 && (
                  <div className='text-xs text-gray-500'>
                    Prerequisites:{' '}
                    {skill.prerequisites.map(p => p.description).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderEquipmentTab = () => (
    <div className='space-y-6'>
      <div className='rounded-lg border border-gray-200 bg-white p-6'>
        <h3 className='mb-4 font-semibold text-gray-900'>Equipment Slots</h3>

        <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
          {/* Equipment Slots */}
          {Object.entries(equipment).map(([slot, item]) => {
            if (slot === 'accessories') return null; // Handle separately

            return (
              <div key={slot} className='rounded border border-gray-200 p-4'>
                <div className='mb-2 font-medium capitalize text-gray-700'>
                  {slot.replace(/([A-Z])/g, ' $1').toLowerCase()}
                </div>
                {item ? (
                  <div className='space-y-2'>
                    <div className='font-medium text-gray-900'>{item.name}</div>
                    <div className='text-sm text-gray-600'>
                      {item.description}
                    </div>
                    <div className='flex justify-between text-xs'>
                      <span
                        className={`rounded px-2 py-1 ${
                          item.rarity === 'common'
                            ? 'bg-gray-100 text-gray-700'
                            : item.rarity === 'uncommon'
                              ? 'bg-green-100 text-green-700'
                              : item.rarity === 'rare'
                                ? 'bg-blue-100 text-blue-700'
                                : item.rarity === 'epic'
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-orange-100 text-orange-700'
                        }`}
                      >
                        {item.rarity}
                      </span>
                      <span className='text-gray-500'>
                        Value: {item.value} gold
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className='italic text-gray-400'>No item equipped</div>
                )}
              </div>
            );
          })}

          {/* Accessories */}
          <div className='rounded border border-gray-200 p-4 md:col-span-2'>
            <div className='mb-2 font-medium text-gray-700'>Accessories</div>
            <div className='grid grid-cols-1 gap-3 md:grid-cols-3'>
              {[0, 1, 2].map(index => {
                const accessory = equipment.accessories[index];
                return (
                  <div
                    key={index}
                    className='min-h-[80px] rounded border border-gray-100 p-3'
                  >
                    {accessory ? (
                      <div>
                        <div className='text-sm font-medium text-gray-900'>
                          {accessory.name}
                        </div>
                        <div className='mt-1 text-xs text-gray-600'>
                          {accessory.description}
                        </div>
                      </div>
                    ) : (
                      <div className='text-sm italic text-gray-400'>
                        Empty slot
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Equipment Bonuses Summary */}
        {(Object.keys(equipmentBonuses.statBonuses).length > 0 ||
          Object.keys(equipmentBonuses.skillBonuses).length > 0 ||
          equipmentBonuses.specialEffects.length > 0) && (
          <div className='mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4'>
            <h4 className='mb-2 font-medium text-blue-900'>
              Equipment Bonuses
            </h4>
            <div className='grid grid-cols-1 gap-4 text-sm md:grid-cols-3'>
              {Object.keys(equipmentBonuses.statBonuses).length > 0 && (
                <div>
                  <div className='font-medium text-blue-800'>Stat Bonuses</div>
                  {Object.entries(equipmentBonuses.statBonuses).map(
                    ([stat, bonus]) => (
                      <div key={stat} className='capitalize text-blue-700'>
                        {stat}: +{bonus}
                      </div>
                    )
                  )}
                </div>
              )}

              {Object.keys(equipmentBonuses.skillBonuses).length > 0 && (
                <div>
                  <div className='font-medium text-blue-800'>Skill Bonuses</div>
                  {Object.entries(equipmentBonuses.skillBonuses).map(
                    ([skill, bonus]) => (
                      <div key={skill} className='capitalize text-blue-700'>
                        {skill}: +{bonus}
                      </div>
                    )
                  )}
                </div>
              )}

              {equipmentBonuses.specialEffects.length > 0 && (
                <div>
                  <div className='font-medium text-blue-800'>
                    Special Effects
                  </div>
                  {equipmentBonuses.specialEffects.map((effect, index) => (
                    <div key={index} className='text-blue-700'>
                      {effect}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderInventoryTab = () => (
    <div className='space-y-6'>
      {/* Inventory Stats */}
      <div className='rounded-lg border border-gray-200 bg-white p-4'>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-4'>
          <div className='text-center'>
            <div className='text-2xl font-bold text-gray-900'>
              {inventoryStats.usedCapacity}
            </div>
            <div className='text-sm text-gray-500'>
              Items ({inventoryStats.maxCapacity} max)
            </div>
          </div>
          <div className='text-center'>
            <div className='text-2xl font-bold text-gray-900'>
              {inventoryStats.currentWeight.toFixed(1)}
            </div>
            <div className='text-sm text-gray-500'>
              Weight ({inventoryStats.maxWeight} max)
            </div>
          </div>
          <div className='text-center'>
            <div className='text-2xl font-bold text-yellow-600'>
              {inventory.currency.toLocaleString()}
            </div>
            <div className='text-sm text-gray-500'>Gold</div>
          </div>
          <div className='text-center'>
            <div
              className={`text-2xl font-bold capitalize ${
                inventoryStats.encumbrance === 'none'
                  ? 'text-green-600'
                  : inventoryStats.encumbrance === 'light'
                    ? 'text-yellow-600'
                    : inventoryStats.encumbrance === 'heavy'
                      ? 'text-orange-600'
                      : 'text-red-600'
              }`}
            >
              {inventoryStats.encumbrance}
            </div>
            <div className='text-sm text-gray-500'>Encumbrance</div>
          </div>
        </div>
      </div>

      {/* Inventory Items */}
      <div className='rounded-lg border border-gray-200 bg-white p-6'>
        <h3 className='mb-4 font-semibold text-gray-900'>Inventory Items</h3>

        {inventory.items.length > 0 ? (
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
            {inventory.items.map((inventoryItem, index) => (
              <div
                key={`${inventoryItem.item.id}-${index}`}
                className='rounded border border-gray-200 p-3 hover:bg-gray-50'
              >
                <div className='mb-2 flex items-start justify-between'>
                  <div className='font-medium text-gray-900'>
                    {inventoryItem.item.name}
                  </div>
                  <div className='text-sm text-gray-500'>
                    x{inventoryItem.quantity}
                  </div>
                </div>

                <div className='mb-2 text-sm text-gray-600'>
                  {inventoryItem.item.description}
                </div>

                <div className='flex items-center justify-between text-xs'>
                  <span
                    className={`rounded px-2 py-1 ${
                      inventoryItem.item.rarity === 'common'
                        ? 'bg-gray-100 text-gray-700'
                        : inventoryItem.item.rarity === 'uncommon'
                          ? 'bg-green-100 text-green-700'
                          : inventoryItem.item.rarity === 'rare'
                            ? 'bg-blue-100 text-blue-700'
                            : inventoryItem.item.rarity === 'epic'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-orange-100 text-orange-700'
                    }`}
                  >
                    {inventoryItem.item.rarity}
                  </span>

                  <div className='space-x-2'>
                    {inventoryItem.item.properties.equipable && isEditable && (
                      <button
                        onClick={() => handleItemEquip(inventoryItem.item.id)}
                        disabled={isLoading}
                        className='rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50'
                      >
                        Equip
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className='py-8 text-center text-gray-500'>
            No items in inventory
          </div>
        )}
      </div>
    </div>
  );

  const renderProgressionTab = () => (
    <div className='space-y-6'>
      {/* Level Progress */}
      <div className='rounded-lg border border-gray-200 bg-white p-6'>
        <h3 className='mb-4 font-semibold text-gray-900'>Level Progress</h3>
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <span className='text-gray-700'>Current Level</span>
            <span className='text-xl font-bold'>{character.level}</span>
          </div>
          <div className='flex items-center justify-between'>
            <span className='text-gray-700'>Experience Points</span>
            <span className='font-medium'>
              {character.experience.toLocaleString()}
            </span>
          </div>

          {/* TODO: Add experience bar when level progression system is enhanced */}
          <div className='relative h-3 overflow-hidden rounded-full bg-gray-200'>
            <div
              className='h-3 rounded-full bg-blue-600 transition-all duration-300'
              style={{ width: '65%' }} // Placeholder percentage
            />
          </div>
          <div className='text-center text-sm text-gray-500'>
            Progress to next level (placeholder)
          </div>
        </div>
      </div>

      {/* Skill Progression */}
      <div className='rounded-lg border border-gray-200 bg-white p-6'>
        <h3 className='mb-4 font-semibold text-gray-900'>
          Skill Points
          <span className='ml-2 text-sm font-normal text-gray-500'>
            ({skillProgression.availablePoints} available)
          </span>
        </h3>

        <div className='space-y-3'>
          <div className='flex items-center justify-between'>
            <span className='text-gray-700'>Total Points Earned</span>
            <span className='font-medium'>
              {skillProgression.totalPointsSpent +
                skillProgression.availablePoints}
            </span>
          </div>
          <div className='flex items-center justify-between'>
            <span className='text-gray-700'>Points Spent</span>
            <span className='font-medium'>
              {skillProgression.totalPointsSpent}
            </span>
          </div>
          <div className='flex items-center justify-between'>
            <span className='text-gray-700'>Points Available</span>
            <span className='font-medium text-blue-600'>
              {skillProgression.availablePoints}
            </span>
          </div>
        </div>

        {/* Learned Skills Summary */}
        <div className='mt-6'>
          <h4 className='mb-3 font-medium text-gray-900'>Learned Skills</h4>
          {Array.from(skillProgression.learnedSkills.values()).length > 0 ? (
            <div className='space-y-2'>
              {Array.from(skillProgression.learnedSkills.values()).map(
                learnedSkill => {
                  const skillNode = skillTreeManager.getSkillNode(
                    learnedSkill.skillId
                  );
                  return (
                    <div
                      key={learnedSkill.skillId}
                      className='flex items-center justify-between rounded bg-gray-50 p-2'
                    >
                      <span className='font-medium'>
                        {skillNode?.name || 'Unknown Skill'}
                      </span>
                      <span className='text-sm text-gray-600'>
                        Rank {learnedSkill.currentRank}
                      </span>
                    </div>
                  );
                }
              )}
            </div>
          ) : (
            <p className='text-sm text-gray-500'>
              No special skills learned yet
            </p>
          )}
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className='mx-auto max-w-6xl p-6'>
      {/* Header */}
      <div className='mb-6'>
        <h1 className='text-3xl font-bold text-gray-900'>{character.name}</h1>
        <p className='text-gray-600'>
          Level {character.level} {character.race.name} {character.class.name}
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className='mb-6 rounded-lg border border-red-200 bg-red-50 p-4'>
          <div className='flex'>
            <div className='flex-shrink-0'>
              <svg
                className='h-5 w-5 text-red-400'
                viewBox='0 0 20 20'
                fill='currentColor'
              >
                <path
                  fillRule='evenodd'
                  d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                  clipRule='evenodd'
                />
              </svg>
            </div>
            <div className='ml-3'>
              <p className='text-red-800'>{error}</p>
            </div>
            <div className='ml-auto pl-3'>
              <button
                onClick={() => setError('')}
                className='text-red-400 hover:text-red-600'
              >
                <svg
                  className='h-5 w-5'
                  viewBox='0 0 20 20'
                  fill='currentColor'
                >
                  <path
                    fillRule='evenodd'
                    d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
                    clipRule='evenodd'
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className='mb-6'>
        <nav className='flex space-x-1 rounded-lg bg-gray-100 p-1'>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-700 hover:bg-gray-200 hover:text-gray-900'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.title}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div
        className={`transition-opacity duration-200 ${isLoading ? 'opacity-50' : 'opacity-100'}`}
      >
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'stats' && renderStatsTab()}
        {activeTab === 'skills' && renderSkillsTab()}
        {activeTab === 'equipment' && renderEquipmentTab()}
        {activeTab === 'inventory' && renderInventoryTab()}
        {activeTab === 'progression' && renderProgressionTab()}
      </div>
    </div>
  );
}
