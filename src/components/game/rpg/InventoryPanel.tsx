/**
 * InventoryPanel Component - Item and Equipment Management
 *
 * Comprehensive inventory system featuring:
 * - Multi-character inventory management
 * - Drag & drop item organization
 * - Equipment slot management
 * - Item sorting and filtering
 * - Encumbrance calculation
 * - Item usage and crafting
 * - Party inventory sharing
 * - Item comparison tooltips
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RPGGameState,
  Character,
  Inventory,
  InventoryItem,
  Item,
  Equipment,
  ItemType,
  ItemRarity,
  UUID,
} from '@/types/rpg';

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

interface InventoryPanelProps {
  gameState: RPGGameState;
  playerCharacters: Character[];
  onItemAction: (action: string, itemId: UUID, data?: any) => Promise<void>;
  className?: string;
}

interface InventoryViewState {
  activeCharacter: UUID | null;
  selectedItem: UUID | null;
  viewMode: 'grid' | 'list';
  sortBy: 'name' | 'type' | 'rarity' | 'value' | 'weight';
  filterBy: ItemType | 'all';
  showEquipment: boolean;
  showPartyInventory: boolean;
}

interface ItemCardProps {
  inventoryItem: InventoryItem;
  isSelected: boolean;
  onSelect: () => void;
  onAction: (action: string) => void;
  showDetails?: boolean;
}

interface EquipmentSlotProps {
  slot: keyof Equipment;
  item: Item | undefined;
  onEquip: (item: Item) => void;
  onUnequip: () => void;
  character: Character;
}

// ============================================================================
// MAIN INVENTORY PANEL COMPONENT
// ============================================================================

export default function InventoryPanel({
  gameState,
  playerCharacters,
  onItemAction,
  className = '',
}: InventoryPanelProps) {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [viewState, setViewState] = useState<InventoryViewState>({
    activeCharacter: playerCharacters[0]?.id || null,
    selectedItem: null,
    viewMode: 'grid',
    sortBy: 'name',
    filterBy: 'all',
    showEquipment: false,
    showPartyInventory: false,
  });

  const [draggedItem, setDraggedItem] = useState<InventoryItem | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastAction, setLastAction] = useState<string>('');

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const activeCharacter = useMemo(() => {
    return (
      playerCharacters.find(c => c.id === viewState.activeCharacter) ||
      playerCharacters[0]
    );
  }, [playerCharacters, viewState.activeCharacter]);

  const activeInventory = useMemo(() => {
    if (viewState.showPartyInventory) {
      return gameState.data.partyInventory;
    }

    const player = gameState.players?.find(
      p => p.gameSpecificData?.character.id === viewState.activeCharacter
    );
    return (
      player?.gameSpecificData?.inventory || {
        capacity: 50,
        items: [],
        equipment: { accessories: [] },
        currency: 0,
      }
    );
  }, [gameState, viewState.activeCharacter, viewState.showPartyInventory]);

  const filteredItems = useMemo(() => {
    let items = activeInventory.items;

    // Apply filters
    if (viewState.filterBy !== 'all') {
      items = items.filter(invItem => invItem.item.type === viewState.filterBy);
    }

    // Apply sorting
    items = [...items].sort((a, b) => {
      switch (viewState.sortBy) {
        case 'name':
          return a.item.name.localeCompare(b.item.name);
        case 'type':
          return a.item.type.localeCompare(b.item.type);
        case 'rarity':
          return getRarityOrder(a.item.rarity) - getRarityOrder(b.item.rarity);
        case 'value':
          return b.item.value - a.item.value;
        case 'weight':
          return b.item.weight - a.item.weight;
        default:
          return 0;
      }
    });

    return items;
  }, [activeInventory.items, viewState.filterBy, viewState.sortBy]);

  const inventoryStats = useMemo(() => {
    const totalWeight = activeInventory.items.reduce(
      (sum, item) => sum + item.item.weight * item.quantity,
      0
    );
    const maxWeight = activeCharacter
      ? activeCharacter.stats.strength * 10
      : 100;
    const encumbrance =
      totalWeight > maxWeight * 0.8
        ? 'heavy'
        : totalWeight > maxWeight * 0.6
          ? 'moderate'
          : totalWeight > maxWeight * 0.4
            ? 'light'
            : 'none';

    return {
      totalWeight,
      maxWeight,
      encumbrance,
      usedSlots: activeInventory.items.length,
      maxSlots: activeInventory.capacity,
      totalValue: activeInventory.items.reduce(
        (sum, item) => sum + item.item.value * item.quantity,
        0
      ),
    };
  }, [activeInventory, activeCharacter]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleCharacterSwitch = useCallback((characterId: UUID) => {
    setViewState(prev => ({ ...prev, activeCharacter: characterId }));
  }, []);

  const handleItemSelect = useCallback((itemId: UUID) => {
    setViewState(prev => ({
      ...prev,
      selectedItem: prev.selectedItem === itemId ? null : itemId,
    }));
  }, []);

  const handleItemAction = useCallback(
    async (action: string, itemId: UUID, additionalData?: any) => {
      setIsProcessing(true);
      setLastAction(`${action} item`);

      try {
        await onItemAction(action, itemId, {
          characterId: viewState.activeCharacter,
          ...additionalData,
        });

        // Clear selection after successful action
        if (['use', 'drop', 'sell'].includes(action)) {
          setViewState(prev => ({ ...prev, selectedItem: null }));
        }
      } catch (error) {
        console.error('Item action failed:', error);
        setLastAction(`Failed to ${action} item`);
      } finally {
        setIsProcessing(false);
        setTimeout(() => setLastAction(''), 3000);
      }
    },
    [onItemAction, viewState.activeCharacter]
  );

  const handleDragStart = useCallback((item: InventoryItem) => {
    setDraggedItem(item);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
  }, []);

  const handleDrop = useCallback(
    (targetSlot: keyof Equipment) => {
      if (!draggedItem || !activeCharacter) return;

      // Check if item can be equipped in this slot
      if (canEquipInSlot(draggedItem.item, targetSlot)) {
        handleItemAction('equip', draggedItem.item.id, { slot: targetSlot });
      }

      setDraggedItem(null);
    },
    [draggedItem, activeCharacter, handleItemAction]
  );

  const toggleViewMode = useCallback(() => {
    setViewState(prev => ({
      ...prev,
      viewMode: prev.viewMode === 'grid' ? 'list' : 'grid',
    }));
  }, []);

  const handleSortChange = useCallback(
    (sortBy: InventoryViewState['sortBy']) => {
      setViewState(prev => ({ ...prev, sortBy }));
    },
    []
  );

  const handleFilterChange = useCallback((filterBy: ItemType | 'all') => {
    setViewState(prev => ({ ...prev, filterBy }));
  }, []);

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div
      className={`h-full bg-gradient-to-br from-amber-900/20 via-yellow-900/20 to-orange-900/20 ${className}`}
    >
      {/* Header */}
      <div className='border-b border-yellow-500/30 bg-black/20 p-4 backdrop-blur-sm'>
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='flex items-center space-x-2 text-xl font-bold text-white'>
            <span>🎒</span>
            <span>Inventory</span>
          </h2>

          {/* Processing Indicator */}
          {isProcessing && (
            <div className='flex items-center space-x-2 text-yellow-300'>
              <div className='h-4 w-4 animate-spin rounded-full border-2 border-yellow-500 border-t-transparent'></div>
              <span className='text-sm'>{lastAction}</span>
            </div>
          )}
        </div>

        {/* Character/Inventory Selector */}
        <div className='mb-4 flex items-center space-x-2'>
          <div className='flex rounded-lg bg-white/10 p-1'>
            {playerCharacters.map(character => (
              <button
                key={character.id}
                onClick={() => handleCharacterSwitch(character.id)}
                className={`rounded px-3 py-1 text-sm transition-colors ${
                  viewState.activeCharacter === character.id
                    ? 'bg-yellow-600 text-white'
                    : 'text-yellow-200 hover:bg-white/10'
                }`}
              >
                {character.name}
              </button>
            ))}
            <button
              onClick={() =>
                setViewState(prev => ({
                  ...prev,
                  showPartyInventory: !prev.showPartyInventory,
                }))
              }
              className={`rounded px-3 py-1 text-sm transition-colors ${
                viewState.showPartyInventory
                  ? 'bg-purple-600 text-white'
                  : 'text-purple-200 hover:bg-white/10'
              }`}
            >
              Party Items
            </button>
          </div>
        </div>

        {/* Inventory Stats */}
        <div className='grid grid-cols-2 gap-4 text-sm md:grid-cols-4'>
          <div className='text-center'>
            <div className='font-semibold text-yellow-300'>
              {activeInventory.currency.toLocaleString()}
            </div>
            <div className='text-yellow-500'>Gold</div>
          </div>
          <div className='text-center'>
            <div className='font-semibold text-blue-300'>
              {inventoryStats.usedSlots} / {inventoryStats.maxSlots}
            </div>
            <div className='text-blue-500'>Slots</div>
          </div>
          <div className='text-center'>
            <div
              className={`font-semibold ${
                inventoryStats.encumbrance === 'none'
                  ? 'text-green-300'
                  : inventoryStats.encumbrance === 'light'
                    ? 'text-yellow-300'
                    : inventoryStats.encumbrance === 'moderate'
                      ? 'text-orange-300'
                      : 'text-red-300'
              }`}
            >
              {inventoryStats.totalWeight.toFixed(1)} /{' '}
              {inventoryStats.maxWeight}
            </div>
            <div className='text-gray-400'>Weight</div>
          </div>
          <div className='text-center'>
            <div className='font-semibold text-purple-300'>
              {inventoryStats.totalValue.toLocaleString()}
            </div>
            <div className='text-purple-500'>Value</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className='border-b border-yellow-500/20 bg-black/10 p-4'>
        <div className='flex items-center justify-between'>
          {/* View Controls */}
          <div className='flex items-center space-x-2'>
            <button
              onClick={toggleViewMode}
              className='rounded bg-white/10 p-2 transition-colors hover:bg-white/20'
              title={`Switch to ${viewState.viewMode === 'grid' ? 'list' : 'grid'} view`}
            >
              {viewState.viewMode === 'grid' ? '📋' : '⊞'}
            </button>

            <button
              onClick={() =>
                setViewState(prev => ({
                  ...prev,
                  showEquipment: !prev.showEquipment,
                }))
              }
              className={`rounded px-3 py-1 text-sm transition-colors ${
                viewState.showEquipment
                  ? 'bg-green-600 text-white'
                  : 'bg-white/10 text-green-200 hover:bg-white/20'
              }`}
            >
              Equipment
            </button>
          </div>

          {/* Sort and Filter */}
          <div className='flex items-center space-x-2'>
            <select
              value={viewState.sortBy}
              onChange={e =>
                handleSortChange(e.target.value as InventoryViewState['sortBy'])
              }
              className='rounded border border-white/20 bg-white/10 px-2 py-1 text-sm text-white'
            >
              <option value='name'>Name</option>
              <option value='type'>Type</option>
              <option value='rarity'>Rarity</option>
              <option value='value'>Value</option>
              <option value='weight'>Weight</option>
            </select>

            <select
              value={viewState.filterBy}
              onChange={e =>
                handleFilterChange(e.target.value as ItemType | 'all')
              }
              className='rounded border border-white/20 bg-white/10 px-2 py-1 text-sm text-white'
            >
              <option value='all'>All Items</option>
              <option value='weapon'>Weapons</option>
              <option value='armor'>Armor</option>
              <option value='consumable'>Consumables</option>
              <option value='tool'>Tools</option>
              <option value='quest'>Quest Items</option>
              <option value='misc'>Misc</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className='flex min-h-0 flex-1'>
        {/* Equipment Panel */}
        <AnimatePresence>
          {viewState.showEquipment && activeCharacter && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className='overflow-hidden border-r border-yellow-500/20 bg-black/10'
            >
              <EquipmentPanel
                character={activeCharacter}
                equipment={activeInventory.equipment}
                onEquip={(slot, item) =>
                  handleItemAction('equip', item.id, { slot })
                }
                onUnequip={slot => handleItemAction('unequip', '', { slot })}
                onDrop={handleDrop}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Inventory Items */}
        <div className='flex-1 overflow-auto p-4'>
          {filteredItems.length > 0 ? (
            <div
              className={`
              ${
                viewState.viewMode === 'grid'
                  ? 'grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                  : 'space-y-2'
              }
            `}
            >
              <AnimatePresence>
                {filteredItems.map((inventoryItem, index) => (
                  <ItemCard
                    key={inventoryItem.item.id}
                    inventoryItem={inventoryItem}
                    isSelected={
                      viewState.selectedItem === inventoryItem.item.id
                    }
                    onSelect={() => handleItemSelect(inventoryItem.item.id)}
                    onAction={action =>
                      handleItemAction(action, inventoryItem.item.id)
                    }
                    showDetails={viewState.viewMode === 'list'}
                    onDragStart={() => handleDragStart(inventoryItem)}
                    onDragEnd={handleDragEnd}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className='flex h-full items-center justify-center text-gray-400'>
              <div className='text-center'>
                <div className='mb-4 text-6xl'>📦</div>
                <p className='text-lg'>No items found</p>
                <p className='text-sm'>
                  {viewState.filterBy !== 'all'
                    ? `No ${viewState.filterBy} items in inventory`
                    : 'Your inventory is empty'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Item Details Modal */}
      <AnimatePresence>
        {viewState.selectedItem && (
          <ItemDetailsModal
            item={
              filteredItems.find(i => i.item.id === viewState.selectedItem)!
            }
            onClose={() =>
              setViewState(prev => ({ ...prev, selectedItem: null }))
            }
            onAction={action =>
              handleItemAction(action, viewState.selectedItem!)
            }
            character={activeCharacter}
          />
        )}
      </AnimatePresence>

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
// ITEM CARD COMPONENT
// ============================================================================

interface ItemCardProps {
  inventoryItem: InventoryItem;
  isSelected: boolean;
  onSelect: () => void;
  onAction: (action: string) => void;
  showDetails?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

const ItemCard: React.FC<ItemCardProps> = ({
  inventoryItem,
  isSelected,
  onSelect,
  onAction,
  showDetails = false,
  onDragStart,
  onDragEnd,
}) => {
  const { item, quantity, condition } = inventoryItem;

  const getRarityColor = (rarity: ItemRarity) => {
    switch (rarity) {
      case 'common':
        return 'border-gray-400 bg-gray-400/10';
      case 'uncommon':
        return 'border-green-400 bg-green-400/10';
      case 'rare':
        return 'border-blue-400 bg-blue-400/10';
      case 'epic':
        return 'border-purple-400 bg-purple-400/10';
      case 'legendary':
        return 'border-yellow-400 bg-yellow-400/10';
      case 'artifact':
        return 'border-red-400 bg-red-400/10';
      default:
        return 'border-gray-400 bg-gray-400/10';
    }
  };

  const getItemIcon = (type: ItemType) => {
    switch (type) {
      case 'weapon':
        return '⚔️';
      case 'armor':
        return '🛡️';
      case 'consumable':
        return '🧪';
      case 'tool':
        return '🔧';
      case 'quest':
        return '📜';
      case 'misc':
        return '📦';
      default:
        return '❓';
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      onClick={onSelect}
      draggable={item.properties.tradeable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`
        relative cursor-pointer rounded-lg border-2 transition-all duration-200
        ${getRarityColor(item.rarity)}
        ${isSelected ? 'scale-105 ring-2 ring-yellow-400' : 'hover:scale-105'}
        ${showDetails ? 'p-3' : 'aspect-square p-2'}
      `}
    >
      {/* Item Icon */}
      <div className='mb-2 text-center'>
        <div className='text-2xl'>{getItemIcon(item.type)}</div>
        {quantity > 1 && (
          <div className='absolute right-1 top-1 rounded-full bg-yellow-600 px-1 text-xs text-white'>
            {quantity}
          </div>
        )}
      </div>

      {/* Item Name */}
      <div className='text-center'>
        <h4
          className='truncate text-sm font-medium text-white'
          title={item.name}
        >
          {item.name}
        </h4>

        {/* Condition Indicator */}
        {condition && condition !== 'good' && (
          <div
            className={`mt-1 text-xs ${
              condition === 'excellent' || condition === 'legendary'
                ? 'text-green-300'
                : condition === 'good'
                  ? 'text-white'
                  : condition === 'damaged'
                    ? 'text-yellow-300'
                    : 'text-red-300'
            }`}
          >
            {condition}
          </div>
        )}
      </div>

      {/* Detailed View Additional Info */}
      {showDetails && (
        <div className='mt-2 space-y-1 text-xs text-gray-300'>
          <div className='flex justify-between'>
            <span>Type:</span>
            <span className='capitalize'>{item.type}</span>
          </div>
          <div className='flex justify-between'>
            <span>Value:</span>
            <span>{item.value}g</span>
          </div>
          <div className='flex justify-between'>
            <span>Weight:</span>
            <span>{item.weight}</span>
          </div>

          {/* Quick Actions */}
          <div className='mt-2 flex space-x-1'>
            {item.properties.consumable && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  onAction('use');
                }}
                className='flex-1 rounded bg-green-600/80 px-2 py-1 text-xs text-white transition-colors hover:bg-green-600'
              >
                Use
              </button>
            )}
            {item.properties.equipable && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  onAction('equip');
                }}
                className='flex-1 rounded bg-blue-600/80 px-2 py-1 text-xs text-white transition-colors hover:bg-blue-600'
              >
                Equip
              </button>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
};

// ============================================================================
// EQUIPMENT PANEL COMPONENT
// ============================================================================

interface EquipmentPanelProps {
  character: Character;
  equipment: Equipment;
  onEquip: (slot: keyof Equipment, item: Item) => void;
  onUnequip: (slot: keyof Equipment) => void;
  onDrop: (slot: keyof Equipment) => void;
}

const EquipmentPanel: React.FC<EquipmentPanelProps> = ({
  character,
  equipment,
  onEquip,
  onUnequip,
  onDrop,
}) => {
  const equipmentSlots: {
    key: keyof Equipment;
    label: string;
    icon: string;
  }[] = [
    { key: 'helmet', label: 'Helmet', icon: '🪖' },
    { key: 'armor', label: 'Armor', icon: '🛡️' },
    { key: 'gloves', label: 'Gloves', icon: '🧤' },
    { key: 'boots', label: 'Boots', icon: '👢' },
    { key: 'mainHand', label: 'Main Hand', icon: '⚔️' },
    { key: 'offHand', label: 'Off Hand', icon: '🛡️' },
  ];

  return (
    <div className='h-full overflow-auto p-4'>
      <h3 className='mb-4 flex items-center space-x-2 font-semibold text-white'>
        <span>⚔️</span>
        <span>Equipment</span>
      </h3>

      <div className='space-y-3'>
        {equipmentSlots.map(slot => (
          <EquipmentSlot
            key={slot.key}
            slot={slot.key}
            label={slot.label}
            icon={slot.icon}
            item={equipment[slot.key] as Item | undefined}
            onEquip={item => onEquip(slot.key, item)}
            onUnequip={() => onUnequip(slot.key)}
            onDrop={() => onDrop(slot.key)}
            character={character}
          />
        ))}

        {/* Accessories */}
        <div>
          <h4 className='mb-2 text-sm text-gray-300'>Accessories</h4>
          <div className='grid grid-cols-2 gap-2'>
            {[0, 1, 2].map(index => (
              <div
                key={index}
                className='aspect-square flex items-center justify-center rounded-lg border-2 border-dashed border-gray-600 text-xs text-gray-500'
                onDragOver={e => e.preventDefault()}
                onDrop={() => onDrop('accessories')}
              >
                {equipment.accessories[index]
                  ? equipment.accessories[index].name
                  : `Slot ${index + 1}`}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// EQUIPMENT SLOT COMPONENT
// ============================================================================

const EquipmentSlot: React.FC<{
  slot: keyof Equipment;
  label: string;
  icon: string;
  item: Item | undefined;
  onEquip: (item: Item) => void;
  onUnequip: () => void;
  onDrop: () => void;
  character: Character;
}> = ({ slot, label, icon, item, onEquip, onUnequip, onDrop, character }) => {
  return (
    <div
      className='flex min-h-[60px] items-center space-x-2 rounded-lg border border-gray-600 p-2 transition-colors hover:border-gray-500'
      onDragOver={e => e.preventDefault()}
      onDrop={onDrop}
    >
      <div className='text-xl'>{icon}</div>
      <div className='flex-1'>
        <div className='text-xs text-gray-400'>{label}</div>
        {item ? (
          <div>
            <div className='text-sm font-medium text-white'>{item.name}</div>
            <button
              onClick={onUnequip}
              className='text-xs text-red-400 transition-colors hover:text-red-300'
            >
              Unequip
            </button>
          </div>
        ) : (
          <div className='text-xs italic text-gray-500'>Empty</div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// ITEM DETAILS MODAL COMPONENT
// ============================================================================

interface ItemDetailsModalProps {
  item: InventoryItem;
  character: Character | undefined;
  onClose: () => void;
  onAction: (action: string) => void;
}

const ItemDetailsModal: React.FC<ItemDetailsModalProps> = ({
  item,
  character,
  onClose,
  onAction,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm'
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className='mx-4 max-w-md rounded-lg border border-yellow-500/30 bg-gradient-to-br from-gray-900 to-black p-6'
        onClick={e => e.stopPropagation()}
      >
        <div className='mb-4 flex items-center justify-between'>
          <h3 className='text-xl font-bold text-white'>{item.item.name}</h3>
          <button
            onClick={onClose}
            className='text-gray-400 transition-colors hover:text-white'
          >
            ✕
          </button>
        </div>

        <div className='space-y-4'>
          <p className='text-gray-300'>{item.item.description}</p>

          <div className='grid grid-cols-2 gap-4 text-sm'>
            <div>
              <span className='text-gray-400'>Type:</span>
              <span className='ml-2 capitalize text-white'>
                {item.item.type}
              </span>
            </div>
            <div>
              <span className='text-gray-400'>Rarity:</span>
              <span className='ml-2 capitalize text-white'>
                {item.item.rarity}
              </span>
            </div>
            <div>
              <span className='text-gray-400'>Value:</span>
              <span className='ml-2 text-yellow-300'>
                {item.item.value} gold
              </span>
            </div>
            <div>
              <span className='text-gray-400'>Weight:</span>
              <span className='ml-2 text-white'>{item.item.weight}</span>
            </div>
            {item.quantity > 1 && (
              <div>
                <span className='text-gray-400'>Quantity:</span>
                <span className='ml-2 text-white'>{item.quantity}</span>
              </div>
            )}
          </div>

          {/* Item Effects */}
          {item.item.effects && item.item.effects.length > 0 && (
            <div>
              <h4 className='mb-2 font-medium text-white'>Effects</h4>
              <div className='space-y-1'>
                {item.item.effects.map((effect, index) => (
                  <div key={index} className='text-sm text-blue-300'>
                    {effect.type}: {effect.value}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className='flex space-x-2 border-t border-gray-700 pt-4'>
            {item.item.properties.consumable && (
              <button
                onClick={() => {
                  onAction('use');
                  onClose();
                }}
                className='flex-1 rounded bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700'
              >
                Use
              </button>
            )}
            {item.item.properties.equipable && (
              <button
                onClick={() => {
                  onAction('equip');
                  onClose();
                }}
                className='flex-1 rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700'
              >
                Equip
              </button>
            )}
            <button
              onClick={() => {
                onAction('drop');
                onClose();
              }}
              className='rounded bg-red-600/80 px-4 py-2 text-white transition-colors hover:bg-red-600'
            >
              Drop
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getRarityOrder(rarity: ItemRarity): number {
  const order = {
    common: 1,
    uncommon: 2,
    rare: 3,
    epic: 4,
    legendary: 5,
    artifact: 6,
  };
  return order[rarity] || 0;
}

function canEquipInSlot(item: Item, slot: keyof Equipment): boolean {
  // TODO: Implement proper equipment slot validation
  if (slot === 'mainHand' || slot === 'offHand') return item.type === 'weapon';
  if (slot === 'armor') return item.type === 'armor';
  if (slot === 'accessories') return item.type === 'accessory';
  return false;
}
