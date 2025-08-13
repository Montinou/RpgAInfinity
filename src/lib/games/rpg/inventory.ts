/**
 * RPG Equipment and Inventory Management System
 *
 * Comprehensive inventory and equipment system for RpgAInfinity RPG module.
 * Handles item management, equipment slots, weight calculations, and all
 * inventory-related operations with full validation and persistence.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Character,
  CharacterStats,
  CharacterSkills,
  Equipment,
  Item,
  ItemType,
  ItemRarity,
  ItemProperties,
  ItemRequirements,
  ItemEffect,
  Inventory,
  InventoryItem,
  UUID,
} from '@/types/rpg';
import { GameError, ErrorCode } from '@/types/core';
import { kvService } from '@/lib/database/kv-service';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const INVENTORY_CONSTANTS = {
  // Capacity and weight
  BASE_INVENTORY_CAPACITY: 20,
  CAPACITY_PER_STRENGTH: 2,
  MAX_WEIGHT_MULTIPLIER: 10,
  WEIGHT_PENALTY_THRESHOLD: 0.8, // 80% of max weight

  // Item limits
  MAX_STACK_SIZE: 99,
  MAX_ACCESSORIES: 3,

  // Currency
  MAX_CURRENCY: 999999,

  // Equipment slots
  EQUIPMENT_SLOTS: [
    'mainHand',
    'offHand',
    'armor',
    'helmet',
    'gloves',
    'boots',
    'accessories',
  ] as const,

  // Rarity modifiers
  RARITY_VALUE_MULTIPLIERS: {
    common: 1.0,
    uncommon: 2.5,
    rare: 5.0,
    epic: 10.0,
    legendary: 25.0,
    artifact: 50.0,
  },

  // Storage configuration
  INVENTORY_TTL: 7 * 24 * 3600, // 7 days
} as const;

// ============================================================================
// INTERFACES & TYPES
// ============================================================================

export interface InventoryOperation {
  readonly type:
    | 'add'
    | 'remove'
    | 'move'
    | 'equip'
    | 'unequip'
    | 'use'
    | 'drop';
  readonly itemId?: UUID;
  readonly targetSlot?: keyof Equipment | number;
  readonly quantity?: number;
  readonly source?: 'pickup' | 'craft' | 'purchase' | 'reward' | 'trade';
}

export interface InventoryValidationResult {
  readonly isValid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
  readonly maxCapacity: number;
  readonly currentWeight: number;
  readonly maxWeight: number;
  readonly encumbrance: 'none' | 'light' | 'heavy' | 'overloaded';
}

export interface EquipmentBonuses {
  readonly statBonuses: Partial<CharacterStats>;
  readonly skillBonuses: Partial<CharacterSkills>;
  readonly specialEffects: string[];
  readonly setBonuses: string[];
}

export interface ItemTransaction {
  readonly id: UUID;
  readonly timestamp: Date;
  readonly operation: InventoryOperation;
  readonly item: Item;
  readonly quantity: number;
  readonly result: 'success' | 'failed' | 'partial';
  readonly error?: string;
}

// ============================================================================
// INVENTORY MANAGER CLASS
// ============================================================================

export class InventoryManager {
  private static instance: InventoryManager;

  private constructor() {}

  static getInstance(): InventoryManager {
    if (!InventoryManager.instance) {
      InventoryManager.instance = new InventoryManager();
    }
    return InventoryManager.instance;
  }

  // ============================================================================
  // INVENTORY OPERATIONS
  // ============================================================================

  /**
   * Add an item to the inventory
   */
  addItem(inventory: Inventory, item: Item, quantity: number = 1): Inventory {
    try {
      if (quantity <= 0) {
        throw new GameError(
          'Quantity must be greater than 0',
          ErrorCode.VALIDATION_FAILED
        );
      }

      // Check if item can be stacked
      if (item.properties.stackable) {
        const existingItem = inventory.items.find(
          invItem => invItem.item.id === item.id
        );

        if (existingItem) {
          // Stack with existing item
          const newQuantity = Math.min(
            existingItem.quantity + quantity,
            INVENTORY_CONSTANTS.MAX_STACK_SIZE
          );
          const overflow = existingItem.quantity + quantity - newQuantity;

          const updatedItems = inventory.items.map(invItem =>
            invItem.item.id === item.id
              ? { ...invItem, quantity: newQuantity }
              : invItem
          );

          const newInventory = { ...inventory, items: updatedItems };

          // If there's overflow, try to add it to a new stack
          if (overflow > 0) {
            return this.addItem(newInventory, item, overflow);
          }

          return newInventory;
        }
      }

      // Check capacity
      if (!this.hasCapacityFor(inventory, quantity)) {
        throw new GameError(
          'Not enough inventory space',
          ErrorCode.VALIDATION_FAILED
        );
      }

      // Add as new inventory item
      const inventoryItem: InventoryItem = {
        item,
        quantity,
        condition: 'good', // Default condition
      };

      const newInventory: Inventory = {
        ...inventory,
        items: [...inventory.items, inventoryItem],
      };

      this.validateInventory(newInventory);
      return newInventory;
    } catch (error) {
      if (error instanceof GameError) {
        throw error;
      }
      throw new GameError(
        `Failed to add item: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.OPERATION_FAILED
      );
    }
  }

  /**
   * Remove an item from the inventory
   */
  removeItem(
    inventory: Inventory,
    itemId: UUID,
    quantity: number = 1
  ): Inventory {
    try {
      if (quantity <= 0) {
        throw new GameError(
          'Quantity must be greater than 0',
          ErrorCode.VALIDATION_FAILED
        );
      }

      const existingItemIndex = inventory.items.findIndex(
        invItem => invItem.item.id === itemId
      );

      if (existingItemIndex === -1) {
        throw new GameError(
          'Item not found in inventory',
          ErrorCode.VALIDATION_FAILED
        );
      }

      const existingItem = inventory.items[existingItemIndex];

      if (existingItem.quantity < quantity) {
        throw new GameError(
          'Not enough quantity to remove',
          ErrorCode.VALIDATION_FAILED
        );
      }

      const updatedItems = [...inventory.items];

      if (existingItem.quantity === quantity) {
        // Remove item completely
        updatedItems.splice(existingItemIndex, 1);
      } else {
        // Reduce quantity
        updatedItems[existingItemIndex] = {
          ...existingItem,
          quantity: existingItem.quantity - quantity,
        };
      }

      return {
        ...inventory,
        items: updatedItems,
      };
    } catch (error) {
      if (error instanceof GameError) {
        throw error;
      }
      throw new GameError(
        `Failed to remove item: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.OPERATION_FAILED
      );
    }
  }

  /**
   * Move an item within the inventory or to equipment
   */
  moveItem(
    inventory: Inventory,
    itemId: UUID,
    targetSlot: number | keyof Equipment,
    quantity: number = 1
  ): Inventory {
    // For this implementation, we'll focus on basic moving
    // More complex moving logic can be implemented as needed
    //TODO: Implement complex item moving and slot management
    return inventory;
  }

  // ============================================================================
  // EQUIPMENT OPERATIONS
  // ============================================================================

  /**
   * Equip an item from inventory
   */
  equipItem(
    inventory: Inventory,
    equipment: Equipment,
    itemId: UUID,
    character: Character
  ): {
    inventory: Inventory;
    equipment: Equipment;
  } {
    try {
      const inventoryItem = inventory.items.find(
        invItem => invItem.item.id === itemId
      );

      if (!inventoryItem) {
        throw new GameError(
          'Item not found in inventory',
          ErrorCode.VALIDATION_FAILED
        );
      }

      const item = inventoryItem.item;

      // Check if item can be equipped
      if (!item.properties.equipable) {
        throw new GameError(
          'Item cannot be equipped',
          ErrorCode.VALIDATION_FAILED
        );
      }

      // Check requirements
      if (!this.meetsRequirements(character, item.requirements)) {
        throw new GameError(
          'Character does not meet item requirements',
          ErrorCode.VALIDATION_FAILED
        );
      }

      // Determine equipment slot
      const slot = this.getEquipmentSlot(item);
      if (!slot) {
        throw new GameError(
          'Cannot determine equipment slot for item',
          ErrorCode.VALIDATION_FAILED
        );
      }

      // Handle different slot types
      const newEquipment = { ...equipment };
      let newInventory = inventory;

      if (slot === 'accessories') {
        // Handle accessories array
        if (
          equipment.accessories.length >= INVENTORY_CONSTANTS.MAX_ACCESSORIES
        ) {
          throw new GameError(
            'All accessory slots are occupied',
            ErrorCode.VALIDATION_FAILED
          );
        }
        newEquipment.accessories = [...equipment.accessories, item];
      } else {
        // Handle single-item slots
        const currentItem =
          equipment[slot as keyof Omit<Equipment, 'accessories'>];
        if (currentItem) {
          // Unequip current item first
          newInventory = this.addItem(newInventory, currentItem);
        }
        (newEquipment as any)[slot] = item;
      }

      // Remove item from inventory
      newInventory = this.removeItem(newInventory, itemId, 1);

      return {
        inventory: newInventory,
        equipment: newEquipment,
      };
    } catch (error) {
      if (error instanceof GameError) {
        throw error;
      }
      throw new GameError(
        `Failed to equip item: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.OPERATION_FAILED
      );
    }
  }

  /**
   * Unequip an item to inventory
   */
  unequipItem(
    inventory: Inventory,
    equipment: Equipment,
    slot: keyof Equipment,
    itemId?: UUID
  ): {
    inventory: Inventory;
    equipment: Equipment;
  } {
    try {
      const newEquipment = { ...equipment };
      let itemToUnequip: Item | null = null;

      if (slot === 'accessories') {
        if (!itemId) {
          throw new GameError(
            'Item ID required for accessories',
            ErrorCode.VALIDATION_FAILED
          );
        }

        const accessoryIndex = equipment.accessories.findIndex(
          item => item.id === itemId
        );
        if (accessoryIndex === -1) {
          throw new GameError(
            'Accessory not found',
            ErrorCode.VALIDATION_FAILED
          );
        }

        itemToUnequip = equipment.accessories[accessoryIndex];
        newEquipment.accessories = equipment.accessories.filter(
          (_, index) => index !== accessoryIndex
        );
      } else {
        const currentItem =
          equipment[slot as keyof Omit<Equipment, 'accessories'>];
        if (!currentItem) {
          throw new GameError(
            'No item equipped in this slot',
            ErrorCode.VALIDATION_FAILED
          );
        }

        itemToUnequip = currentItem;
        (newEquipment as any)[slot] = undefined;
      }

      if (!itemToUnequip) {
        throw new GameError('No item to unequip', ErrorCode.VALIDATION_FAILED);
      }

      // Add item back to inventory
      const newInventory = this.addItem(inventory, itemToUnequip);

      return {
        inventory: newInventory,
        equipment: newEquipment,
      };
    } catch (error) {
      if (error instanceof GameError) {
        throw error;
      }
      throw new GameError(
        `Failed to unequip item: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.OPERATION_FAILED
      );
    }
  }

  // ============================================================================
  // CALCULATION METHODS
  // ============================================================================

  /**
   * Calculate equipment bonuses
   */
  calculateEquipmentBonuses(equipment: Equipment): EquipmentBonuses {
    const statBonuses: Partial<CharacterStats> = {};
    const skillBonuses: Partial<CharacterSkills> = {};
    const specialEffects: string[] = [];
    const setBonuses: string[] = [];

    // Get all equipped items
    const equippedItems: Item[] = [
      equipment.mainHand,
      equipment.offHand,
      equipment.armor,
      equipment.helmet,
      equipment.gloves,
      equipment.boots,
      ...equipment.accessories,
    ].filter((item): item is Item => item !== undefined);

    // Process each item's effects
    for (const item of equippedItems) {
      if (!item.effects) continue;

      for (const effect of item.effects) {
        switch (effect.type) {
          case 'stat_modifier':
            const statName = effect.target as keyof CharacterStats;
            if (typeof effect.value === 'number') {
              statBonuses[statName] =
                (statBonuses[statName] || 0) + effect.value;
            }
            break;

          case 'skill_modifier':
            const skillName = effect.target as keyof CharacterSkills;
            if (typeof effect.value === 'number') {
              skillBonuses[skillName] =
                (skillBonuses[skillName] || 0) + effect.value;
            }
            break;

          case 'special_ability':
            if (typeof effect.value === 'string') {
              specialEffects.push(effect.value);
            }
            break;
        }
      }
    }

    //TODO: Implement set bonus detection when item sets are defined

    return {
      statBonuses,
      skillBonuses,
      specialEffects,
      setBonuses,
    };
  }

  /**
   * Calculate inventory weight and capacity
   */
  calculateInventoryStats(
    inventory: Inventory,
    character: Character
  ): {
    currentWeight: number;
    maxWeight: number;
    usedCapacity: number;
    maxCapacity: number;
    encumbrance: 'none' | 'light' | 'heavy' | 'overloaded';
  } {
    // Calculate current weight
    const currentWeight = inventory.items.reduce(
      (total, invItem) => total + invItem.item.weight * invItem.quantity,
      0
    );

    // Calculate max weight based on strength
    const maxWeight =
      character.stats.strength * INVENTORY_CONSTANTS.MAX_WEIGHT_MULTIPLIER;

    // Calculate capacity
    const maxCapacity =
      INVENTORY_CONSTANTS.BASE_INVENTORY_CAPACITY +
      character.stats.strength * INVENTORY_CONSTANTS.CAPACITY_PER_STRENGTH;
    const usedCapacity = inventory.items.length;

    // Determine encumbrance
    let encumbrance: 'none' | 'light' | 'heavy' | 'overloaded';
    const weightRatio = currentWeight / maxWeight;

    if (weightRatio >= 1.0) {
      encumbrance = 'overloaded';
    } else if (weightRatio >= 0.9) {
      encumbrance = 'heavy';
    } else if (weightRatio >= INVENTORY_CONSTANTS.WEIGHT_PENALTY_THRESHOLD) {
      encumbrance = 'light';
    } else {
      encumbrance = 'none';
    }

    return {
      currentWeight,
      maxWeight,
      usedCapacity,
      maxCapacity,
      encumbrance,
    };
  }

  /**
   * Calculate total inventory value
   */
  calculateInventoryValue(inventory: Inventory): number {
    let totalValue = inventory.currency;

    for (const invItem of inventory.items) {
      const baseValue = invItem.item.value;
      const rarityMultiplier =
        INVENTORY_CONSTANTS.RARITY_VALUE_MULTIPLIERS[invItem.item.rarity];
      const conditionMultiplier = this.getConditionMultiplier(
        invItem.condition || 'good'
      );

      totalValue +=
        baseValue * rarityMultiplier * conditionMultiplier * invItem.quantity;
    }

    return Math.floor(totalValue);
  }

  // ============================================================================
  // VALIDATION METHODS
  // ============================================================================

  /**
   * Validate entire inventory state
   */
  validateInventory(inventory: Inventory): InventoryValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check currency limits
    if (inventory.currency < 0) {
      errors.push('Currency cannot be negative');
    }
    if (inventory.currency > INVENTORY_CONSTANTS.MAX_CURRENCY) {
      errors.push(
        `Currency exceeds maximum (${INVENTORY_CONSTANTS.MAX_CURRENCY})`
      );
    }

    // Check item quantities
    for (const invItem of inventory.items) {
      if (invItem.quantity <= 0) {
        errors.push(
          `Invalid quantity for item ${invItem.item.name}: ${invItem.quantity}`
        );
      }
      if (
        invItem.item.properties.stackable &&
        invItem.quantity > INVENTORY_CONSTANTS.MAX_STACK_SIZE
      ) {
        errors.push(`Item ${invItem.item.name} exceeds max stack size`);
      }
    }

    // Check capacity (requires character for proper calculation)
    const maxCapacity = inventory.capacity;
    if (inventory.items.length > maxCapacity) {
      errors.push(
        `Inventory exceeds capacity: ${inventory.items.length}/${maxCapacity}`
      );
    }

    //TODO: Add weight validation when character context is available
    const currentWeight = 0; // Placeholder
    const maxWeight = 1000; // Placeholder

    if (currentWeight > maxWeight * 1.1) {
      warnings.push('Severely overloaded - movement greatly reduced');
    } else if (currentWeight > maxWeight) {
      warnings.push('Overloaded - movement reduced');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      maxCapacity,
      currentWeight,
      maxWeight,
      encumbrance: 'none', // Simplified for now
    };
  }

  /**
   * Check if character meets item requirements
   */
  meetsRequirements(
    character: Character,
    requirements?: ItemRequirements
  ): boolean {
    if (!requirements) return true;

    // Check level requirement
    if (requirements.level && character.level < requirements.level) {
      return false;
    }

    // Check stat requirements
    if (requirements.stats) {
      for (const [stat, required] of Object.entries(requirements.stats)) {
        const statName = stat as keyof CharacterStats;
        if (character.stats[statName] < (required || 0)) {
          return false;
        }
      }
    }

    // Check skill requirements
    if (requirements.skills) {
      for (const [skill, required] of Object.entries(requirements.skills)) {
        const skillName = skill as keyof CharacterSkills;
        if (character.skills[skillName] < (required || 0)) {
          return false;
        }
      }
    }

    // Check race requirements
    if (requirements.race && requirements.race.length > 0) {
      if (!requirements.race.includes(character.race.name)) {
        return false;
      }
    }

    // Check class requirements
    if (requirements.class && requirements.class.length > 0) {
      if (!requirements.class.includes(character.class.name)) {
        return false;
      }
    }

    return true;
  }

  // ============================================================================
  // PERSISTENCE METHODS
  // ============================================================================

  /**
   * Save inventory to storage
   */
  async saveInventory(
    playerId: UUID,
    characterId: UUID,
    inventory: Inventory
  ): Promise<void> {
    try {
      const key = `inventory:${playerId}:${characterId}`;
      const success = await kvService.set(
        key,
        inventory,
        INVENTORY_CONSTANTS.INVENTORY_TTL
      );

      if (!success) {
        throw new GameError(
          'Failed to save inventory to storage',
          ErrorCode.STORAGE_ERROR
        );
      }
    } catch (error) {
      if (error instanceof GameError) {
        throw error;
      }
      throw new GameError(
        `Failed to save inventory: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.STORAGE_ERROR
      );
    }
  }

  /**
   * Load inventory from storage
   */
  async loadInventory(
    playerId: UUID,
    characterId: UUID
  ): Promise<Inventory | null> {
    try {
      const key = `inventory:${playerId}:${characterId}`;
      return await kvService.get<Inventory>(key);
    } catch (error) {
      throw new GameError(
        `Failed to load inventory: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.STORAGE_ERROR
      );
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Check if inventory has capacity for additional items
   */
  private hasCapacityFor(inventory: Inventory, quantity: number): boolean {
    return inventory.items.length + quantity <= inventory.capacity;
  }

  /**
   * Determine the appropriate equipment slot for an item
   */
  private getEquipmentSlot(item: Item): keyof Equipment | null {
    switch (item.type) {
      case 'weapon':
        return 'mainHand'; // Could be more complex logic for off-hand weapons
      case 'armor':
        return 'armor';
      case 'accessory':
        return 'accessories';
      default:
        return null;
    }
  }

  /**
   * Get condition multiplier for item value calculation
   */
  private getConditionMultiplier(condition: string): number {
    switch (condition) {
      case 'broken':
        return 0.1;
      case 'damaged':
        return 0.5;
      case 'good':
        return 1.0;
      case 'excellent':
        return 1.2;
      case 'legendary':
        return 1.5;
      default:
        return 1.0;
    }
  }

  /**
   * Create a default inventory for new characters
   */
  createDefaultInventory(character: Character): Inventory {
    const maxCapacity =
      INVENTORY_CONSTANTS.BASE_INVENTORY_CAPACITY +
      character.stats.strength * INVENTORY_CONSTANTS.CAPACITY_PER_STRENGTH;

    return {
      capacity: maxCapacity,
      items: [],
      equipment: {
        accessories: [],
      },
      currency: 0,
    };
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const inventoryManager = InventoryManager.getInstance();
