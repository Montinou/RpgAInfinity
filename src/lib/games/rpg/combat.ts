/**
 * Combat System for RPG Game Module
 *
 * Implements turn-based tactical combat with initiative ordering, damage calculation,
 * status effects, and AI-driven combat narratives. Integrates with the core game engine
 * and character system to provide engaging tactical combat experiences.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  CombatSession,
  CombatParticipant,
  CombatAction,
  CombatActionType,
  Character,
  StatusEffect,
  CombatPosition,
  CombatEnvironment,
  CombatLogEntry,
  UUID,
  CharacterStats,
  CharacterSkills,
  Item,
  Equipment,
  EnvironmentModifier,
  CombatDataSchema,
  CombatData,
} from '@/types/rpg';
import { GameState, ActionResult, GameEvent } from '@/types/core';
import { kvService } from '@/lib/database/kv-service';
import { validateWith } from '@/lib/database/validation';
import { gameEngine } from '@/lib/game-engine/core';

// ============================================================================
// COMBAT CONFIGURATION & CONSTANTS
// ============================================================================

const COMBAT_CONFIG = {
  MAX_PARTICIPANTS: 16,
  MAX_COMBAT_ROUNDS: 100,
  ACTION_POINTS_PER_TURN: 3,
  INITIATIVE_DICE_SIDES: 20,
  BASE_ACCURACY: 60,
  CRITICAL_HIT_THRESHOLD: 95,
  FUMBLE_THRESHOLD: 5,
  MAX_DISTANCE: 10,
  STATUS_EFFECT_DURATION_CAP: 20,
} as const;

const DAMAGE_TYPES = {
  PHYSICAL: 'physical',
  MAGICAL: 'magical',
  FIRE: 'fire',
  ICE: 'ice',
  LIGHTNING: 'lightning',
  POISON: 'poison',
  HEALING: 'healing',
} as const;

type DamageType = (typeof DAMAGE_TYPES)[keyof typeof DAMAGE_TYPES];

// ============================================================================
// COMBAT RESULT INTERFACES
// ============================================================================

export interface CombatResult {
  readonly success: boolean;
  readonly updatedSession: CombatSession;
  readonly logEntries: CombatLogEntry[];
  readonly events: GameEvent[];
  readonly gameState?: GameState;
  readonly error?: string;
}

export interface CombatRoundResult {
  readonly roundNumber: number;
  readonly participantResults: CombatParticipantResult[];
  readonly environmentEffects: EnvironmentEffect[];
  readonly roundSummary: string;
  readonly isRoundComplete: boolean;
  readonly nextParticipant?: UUID;
}

export interface CombatParticipantResult {
  readonly participantId: UUID;
  readonly action: CombatAction;
  readonly result: CombatActionResult;
  readonly statusChanges: StatusEffect[];
  readonly position?: CombatPosition;
}

export interface CombatActionResult {
  readonly outcome:
    | 'hit'
    | 'miss'
    | 'critical'
    | 'fumble'
    | 'block'
    | 'parry'
    | 'dodge';
  readonly damage: number;
  readonly damageType: DamageType;
  readonly healing: number;
  readonly statusEffectsApplied: StatusEffect[];
  readonly description: string;
  readonly narrativeDescription: string;
}

export interface CombatEndResult {
  readonly victor: 'players' | 'enemies' | 'draw';
  readonly survivors: UUID[];
  readonly casualties: UUID[];
  readonly experienceGained: number;
  readonly lootDropped: Item[];
  readonly combatDuration: number;
  readonly summary: string;
}

export interface EnvironmentEffect {
  readonly name: string;
  readonly description: string;
  readonly affectedParticipants: UUID[];
  readonly damage: number;
  readonly statusEffects: StatusEffect[];
}

// ============================================================================
// COMBAT SYSTEM IMPLEMENTATION
// ============================================================================

export class CombatSystem {
  private static instance: CombatSystem;
  private activeSessions: Map<UUID, CombatSession> = new Map();

  private constructor() {
    // Initialize AI service connection for combat narratives
    this.setupCombatAI();
  }

  static getInstance(): CombatSystem {
    if (!CombatSystem.instance) {
      CombatSystem.instance = new CombatSystem();
    }
    return CombatSystem.instance;
  }

  // ============================================================================
  // CORE COMBAT METHODS
  // ============================================================================

  /**
   * Initiate a combat session between players and enemies
   */
  async initiateCombat(
    players: Character[],
    enemies: Character[],
    environment?: Partial<CombatEnvironment>
  ): Promise<CombatSession> {
    try {
      // Validate participants
      if (players.length === 0) {
        throw new Error('At least one player character is required');
      }
      if (enemies.length === 0) {
        throw new Error('At least one enemy character is required');
      }
      if (players.length + enemies.length > COMBAT_CONFIG.MAX_PARTICIPANTS) {
        throw new Error(
          `Too many participants. Maximum: ${COMBAT_CONFIG.MAX_PARTICIPANTS}`
        );
      }

      const combatId = uuidv4();

      // Create combat participants
      const participants = await this.createCombatParticipants(
        players,
        enemies
      );

      // Determine initiative order
      const turnOrder = this.checkInitiative(
        participants.map(p => p.character)
      );

      // Setup combat environment
      const combatEnvironment = this.createCombatEnvironment(environment);

      // Create combat session
      const session: CombatSession = {
        id: combatId,
        participants,
        currentTurn: 1,
        turnOrder,
        currentParticipant: turnOrder[0],
        environment: combatEnvironment,
        status: 'active',
        log: [
          {
            timestamp: new Date(),
            participantId: combatId,
            action: 'wait',
            result: `Combat begins! Initiative order: ${turnOrder
              .map(
                id =>
                  participants.find(p => p.id === id)?.character.name ||
                  'Unknown'
              )
              .join(', ')}`,
            effects: [],
          },
        ],
      };

      // Store session
      this.activeSessions.set(combatId, session);
      await this.saveCombatSession(session);

      // Generate opening narrative
      //TODO: Integrate AI service for combat narratives once AI service is connected

      return session;
    } catch (error) {
      throw new Error(`Failed to initiate combat: ${error}`);
    }
  }

  /**
   * Process a combat action and update the session
   */
  async processAction(action: CombatAction): Promise<CombatResult> {
    try {
      // Load combat session
      const session = await this.getCombatSession(action.gameId);
      if (!session) {
        return {
          success: false,
          updatedSession: {} as CombatSession,
          logEntries: [],
          events: [],
          error: 'Combat session not found',
        };
      }

      // Validate action
      const validationResult = this.validateCombatAction(action, session);
      if (!validationResult.isValid) {
        return {
          success: false,
          updatedSession: session,
          logEntries: [],
          events: [],
          error: validationResult.error,
        };
      }

      // Get participants
      const actor = session.participants.find(p => p.id === action.playerId);
      const target = action.data.targetId
        ? session.participants.find(p => p.id === action.data.targetId)
        : undefined;

      if (!actor) {
        return {
          success: false,
          updatedSession: session,
          logEntries: [],
          events: [],
          error: 'Actor not found in combat',
        };
      }

      // Execute the action
      const actionResult = await this.executeCombatAction(
        action,
        actor,
        target,
        session
      );

      // Update session with results
      const updatedSession = await this.updateSessionFromActionResult(
        session,
        actionResult,
        action
      );

      // Generate combat log entry
      const logEntry = this.createCombatLogEntry(
        action,
        actionResult,
        actor,
        target
      );
      updatedSession.log.push(logEntry);

      // Check for combat end conditions
      const combatEndResult = this.checkCombatEndConditions(updatedSession);
      if (combatEndResult) {
        updatedSession.status = 'ended';
        //TODO: Process combat end rewards and experience
      }

      // Save updated session
      await this.saveCombatSession(updatedSession);
      this.activeSessions.set(updatedSession.id, updatedSession);

      // Create events
      const events = this.createCombatEvents(
        updatedSession,
        actionResult,
        action
      );

      return {
        success: true,
        updatedSession,
        logEntries: [logEntry],
        events,
      };
    } catch (error) {
      return {
        success: false,
        updatedSession: {} as CombatSession,
        logEntries: [],
        events: [],
        error: `Failed to process combat action: ${error}`,
      };
    }
  }

  /**
   * Calculate damage based on attacker, target, and action
   */
  calculateDamage(
    attacker: Character,
    target: Character,
    action: CombatAction
  ): {
    damage: number;
    damageType: DamageType;
    isCritical: boolean;
    description: string;
  } {
    try {
      let baseDamage = 0;
      let damageType: DamageType = DAMAGE_TYPES.PHYSICAL;
      let description = '';

      // Get base damage from weapon or spell
      if (action.type === 'attack') {
        const weapon = this.getEquippedWeapon(attacker);
        baseDamage = this.getWeaponDamage(weapon, attacker);
        description = `attacks with ${weapon?.name || 'bare hands'}`;
      } else if (action.type === 'cast_spell') {
        //TODO: Implement spell damage calculation once spell system is available
        baseDamage = attacker.stats.intelligence * 2;
        damageType = DAMAGE_TYPES.MAGICAL;
        description = 'casts a spell';
      } else {
        // Non-damage actions
        return {
          damage: 0,
          damageType: DAMAGE_TYPES.PHYSICAL,
          isCritical: false,
          description: 'performs action',
        };
      }

      // Apply stat modifiers
      const statModifier = this.getStatModifier(attacker, action);
      baseDamage = Math.max(1, baseDamage + statModifier);

      // Calculate hit chance and critical hits
      const hitRoll = Math.floor(Math.random() * 100) + 1;
      const hitChance = this.calculateHitChance(attacker, target, action);
      const isCritical = hitRoll >= COMBAT_CONFIG.CRITICAL_HIT_THRESHOLD;

      if (hitRoll <= COMBAT_CONFIG.FUMBLE_THRESHOLD) {
        return {
          damage: 0,
          damageType,
          isCritical: false,
          description: `${description} but fumbles!`,
        };
      }

      if (hitRoll > hitChance && !isCritical) {
        return {
          damage: 0,
          damageType,
          isCritical: false,
          description: `${description} but misses!`,
        };
      }

      // Apply critical hit multiplier
      if (isCritical) {
        baseDamage *= 2;
        description += ' with a critical hit!';
      }

      // Apply armor and resistances
      const finalDamage = this.applyDefenses(baseDamage, target, damageType);

      return {
        damage: Math.max(0, finalDamage),
        damageType,
        isCritical,
        description,
      };
    } catch (error) {
      console.error('Error calculating damage:', error);
      return {
        damage: 1,
        damageType: DAMAGE_TYPES.PHYSICAL,
        isCritical: false,
        description: 'strikes',
      };
    }
  }

  /**
   * Check initiative and return turn order
   */
  checkInitiative(combatants: Character[]): UUID[] {
    const initiativeRolls = combatants.map(character => ({
      id: character.id,
      initiative: this.rollInitiative(character),
      name: character.name,
    }));

    // Sort by initiative (highest first), use dexterity as tiebreaker
    return initiativeRolls
      .sort((a, b) => {
        if (b.initiative !== a.initiative) {
          return b.initiative - a.initiative;
        }
        // Tiebreaker: higher dexterity goes first
        const charA = combatants.find(c => c.id === a.id)!;
        const charB = combatants.find(c => c.id === b.id)!;
        return charB.stats.dexterity - charA.stats.dexterity;
      })
      .map(result => result.id);
  }

  /**
   * Resolve a complete combat round
   */
  async resolveCombatRound(session: CombatSession): Promise<CombatRoundResult> {
    const participantResults: CombatParticipantResult[] = [];
    const environmentEffects: EnvironmentEffect[] = [];

    // Process each participant's turn in initiative order
    for (const participantId of session.turnOrder) {
      const participant = session.participants.find(
        p => p.id === participantId
      );
      if (!participant || participant.character.currentHealth <= 0) {
        continue; // Skip dead or missing participants
      }

      // For AI-controlled participants, generate their action
      if (participant.type !== 'player') {
        const aiAction = this.generateAIAction(participant, session);
        const actionResult = await this.processAction(aiAction);

        if (actionResult.success) {
          participantResults.push({
            participantId,
            action: aiAction,
            result: {
              outcome: 'hit', // Simplified for now
              damage: 0,
              damageType: DAMAGE_TYPES.PHYSICAL,
              healing: 0,
              statusEffectsApplied: [],
              description: 'AI action executed',
              narrativeDescription: 'The AI takes their turn',
            },
            statusChanges: [],
          });
        }
      }
    }

    // Process environment effects
    environmentEffects.push(...this.processEnvironmentEffects(session));

    // Update turn counter
    session.currentTurn++;

    const roundSummary = `Round ${session.currentTurn - 1} completed. ${participantResults.length} actions processed.`;

    return {
      roundNumber: session.currentTurn - 1,
      participantResults,
      environmentEffects,
      roundSummary,
      isRoundComplete: true,
      nextParticipant: session.turnOrder[0], // Reset to first participant for next round
    };
  }

  /**
   * End combat and return results
   */
  async endCombat(session: CombatSession): Promise<CombatEndResult> {
    try {
      // Determine victor
      const alivePlayers = session.participants.filter(
        p => p.type === 'player' && p.character.currentHealth > 0
      );
      const aliveEnemies = session.participants.filter(
        p => p.type !== 'player' && p.character.currentHealth > 0
      );

      let victor: 'players' | 'enemies' | 'draw';
      if (alivePlayers.length > 0 && aliveEnemies.length === 0) {
        victor = 'players';
      } else if (aliveEnemies.length > 0 && alivePlayers.length === 0) {
        victor = 'enemies';
      } else {
        victor = 'draw';
      }

      // Calculate rewards
      const experienceGained = this.calculateExperienceGained(session, victor);
      const lootDropped = this.generateLootDrops(session, victor);

      const survivors = session.participants
        .filter(p => p.character.currentHealth > 0)
        .map(p => p.id);

      const casualties = session.participants
        .filter(p => p.character.currentHealth <= 0)
        .map(p => p.id);

      const combatDuration = session.currentTurn;

      // Generate summary
      const summary = this.generateCombatSummary(
        session,
        victor,
        experienceGained,
        lootDropped
      );

      // Clean up session
      this.activeSessions.delete(session.id);
      await this.deleteCombatSession(session.id);

      return {
        victor,
        survivors,
        casualties,
        experienceGained,
        lootDropped,
        combatDuration,
        summary,
      };
    } catch (error) {
      throw new Error(`Failed to end combat: ${error}`);
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private async setupCombatAI(): Promise<void> {
    //TODO: Initialize AI service for combat narratives and descriptions
    console.log('Combat AI system initialized');
  }

  private async createCombatParticipants(
    players: Character[],
    enemies: Character[]
  ): Promise<CombatParticipant[]> {
    const participants: CombatParticipant[] = [];

    // Add players
    players.forEach((character, index) => {
      participants.push({
        id: character.id,
        type: 'player',
        character,
        position: { x: index, y: 0, zone: 'front' },
        actionPoints: COMBAT_CONFIG.ACTION_POINTS_PER_TURN,
        maxActionPoints: COMBAT_CONFIG.ACTION_POINTS_PER_TURN,
        hasActed: false,
      });
    });

    // Add enemies
    enemies.forEach((character, index) => {
      participants.push({
        id: character.id,
        type: 'npc',
        character,
        position: { x: index, y: 5, zone: 'front' },
        actionPoints: COMBAT_CONFIG.ACTION_POINTS_PER_TURN,
        maxActionPoints: COMBAT_CONFIG.ACTION_POINTS_PER_TURN,
        hasActed: false,
      });
    });

    return participants;
  }

  private createCombatEnvironment(
    environment?: Partial<CombatEnvironment>
  ): CombatEnvironment {
    return {
      type: environment?.type || 'battlefield',
      modifiers: environment?.modifiers || [],
      hazards: environment?.hazards || [],
      size: environment?.size || { width: 10, height: 10 },
    };
  }

  private rollInitiative(character: Character): number {
    const dexModifier = Math.floor((character.stats.dexterity - 10) / 2);
    const roll =
      Math.floor(Math.random() * COMBAT_CONFIG.INITIATIVE_DICE_SIDES) + 1;
    return roll + dexModifier;
  }

  private validateCombatAction(
    action: CombatAction,
    session: CombatSession
  ): { isValid: boolean; error?: string } {
    // Check if it's the participant's turn
    if (session.currentParticipant !== action.playerId) {
      return { isValid: false, error: 'Not your turn' };
    }

    // Check if participant exists and is alive
    const participant = session.participants.find(
      p => p.id === action.playerId
    );
    if (!participant) {
      return { isValid: false, error: 'Participant not found' };
    }
    if (participant.character.currentHealth <= 0) {
      return { isValid: false, error: 'Participant is unconscious' };
    }

    // Check action points
    if (participant.actionPoints <= 0) {
      return { isValid: false, error: 'No action points remaining' };
    }

    // Validate target if required
    if (
      action.data.targetId &&
      ['attack', 'cast_spell'].includes(action.type)
    ) {
      const target = session.participants.find(
        p => p.id === action.data.targetId
      );
      if (!target) {
        return { isValid: false, error: 'Target not found' };
      }
      if (target.character.currentHealth <= 0) {
        return {
          isValid: false,
          error: 'Cannot target unconscious participant',
        };
      }
    }

    return { isValid: true };
  }

  private async executeCombatAction(
    action: CombatAction,
    actor: CombatParticipant,
    target: CombatParticipant | undefined,
    session: CombatSession
  ): Promise<CombatActionResult> {
    switch (action.type) {
      case 'attack':
        return this.executeAttack(actor, target!, action);
      case 'defend':
        return this.executeDefend(actor);
      case 'move':
        return this.executeMove(actor, action.data.position!);
      case 'cast_spell':
        return this.executeCastSpell(actor, target, action);
      case 'use_item':
        return this.executeUseItem(actor, target, action);
      case 'flee':
        return this.executeFlee(actor, session);
      case 'wait':
        return this.executeWait(actor);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private executeAttack(
    actor: CombatParticipant,
    target: CombatParticipant,
    action: CombatAction
  ): CombatActionResult {
    const damageResult = this.calculateDamage(
      actor.character,
      target.character,
      action
    );

    return {
      outcome: damageResult.isCritical
        ? 'critical'
        : damageResult.damage > 0
          ? 'hit'
          : 'miss',
      damage: damageResult.damage,
      damageType: damageResult.damageType,
      healing: 0,
      statusEffectsApplied: [],
      description: damageResult.description,
      narrativeDescription: `${actor.character.name} ${damageResult.description} ${target.character.name}`,
    };
  }

  private executeDefend(actor: CombatParticipant): CombatActionResult {
    //TODO: Implement defensive bonus effects for next incoming attack
    return {
      outcome: 'ongoing',
      damage: 0,
      damageType: DAMAGE_TYPES.PHYSICAL,
      healing: 0,
      statusEffectsApplied: [],
      description: 'takes a defensive stance',
      narrativeDescription: `${actor.character.name} prepares to defend against incoming attacks`,
    };
  }

  private executeMove(
    actor: CombatParticipant,
    newPosition: CombatPosition
  ): CombatActionResult {
    //TODO: Validate movement distance and obstacles
    actor.position = newPosition;

    return {
      outcome: 'ongoing',
      damage: 0,
      damageType: DAMAGE_TYPES.PHYSICAL,
      healing: 0,
      statusEffectsApplied: [],
      description: `moves to position (${newPosition.x}, ${newPosition.y})`,
      narrativeDescription: `${actor.character.name} moves to a new position on the battlefield`,
    };
  }

  private executeCastSpell(
    actor: CombatParticipant,
    target: CombatParticipant | undefined,
    action: CombatAction
  ): CombatActionResult {
    //TODO: Implement full spell system with spell definitions and mana costs
    const spellDamage =
      actor.character.stats.intelligence + Math.floor(Math.random() * 10);

    return {
      outcome: 'hit',
      damage: spellDamage,
      damageType: DAMAGE_TYPES.MAGICAL,
      healing: 0,
      statusEffectsApplied: [],
      description: 'casts a spell',
      narrativeDescription: `${actor.character.name} weaves magical energy${target ? ` at ${target.character.name}` : ''}`,
    };
  }

  private executeUseItem(
    actor: CombatParticipant,
    target: CombatParticipant | undefined,
    action: CombatAction
  ): CombatActionResult {
    //TODO: Implement item effects based on item database
    return {
      outcome: 'ongoing',
      damage: 0,
      damageType: DAMAGE_TYPES.PHYSICAL,
      healing: 0,
      statusEffectsApplied: [],
      description: 'uses an item',
      narrativeDescription: `${actor.character.name} uses an item from their inventory`,
    };
  }

  private executeFlee(
    actor: CombatParticipant,
    session: CombatSession
  ): CombatActionResult {
    //TODO: Calculate flee success chance based on character stats and positioning
    const fleeSuccess = Math.random() > 0.5; // 50% base chance for now

    return {
      outcome: fleeSuccess ? 'ongoing' : 'miss',
      damage: 0,
      damageType: DAMAGE_TYPES.PHYSICAL,
      healing: 0,
      statusEffectsApplied: [],
      description: fleeSuccess
        ? 'successfully flees from combat'
        : 'attempts to flee but fails',
      narrativeDescription: `${actor.character.name} ${fleeSuccess ? 'escapes from the battle' : 'tries to escape but cannot break away'}`,
    };
  }

  private executeWait(actor: CombatParticipant): CombatActionResult {
    return {
      outcome: 'ongoing',
      damage: 0,
      damageType: DAMAGE_TYPES.PHYSICAL,
      healing: 0,
      statusEffectsApplied: [],
      description: 'waits and observes',
      narrativeDescription: `${actor.character.name} takes a moment to assess the situation`,
    };
  }

  private getEquippedWeapon(character: Character): Item | undefined {
    //TODO: Get equipped weapon from character's equipment when inventory system is connected
    return undefined;
  }

  private getWeaponDamage(
    weapon: Item | undefined,
    character: Character
  ): number {
    if (!weapon) {
      // Unarmed combat damage based on strength
      return Math.max(1, Math.floor(character.stats.strength / 10));
    }
    //TODO: Get actual weapon damage from item properties
    return 10; // Placeholder
  }

  private getStatModifier(character: Character, action: CombatAction): number {
    switch (action.type) {
      case 'attack':
        return Math.floor((character.stats.strength - 10) / 2);
      case 'cast_spell':
        return Math.floor((character.stats.intelligence - 10) / 2);
      default:
        return 0;
    }
  }

  private calculateHitChance(
    attacker: Character,
    target: Character,
    action: CombatAction
  ): number {
    let baseChance = COMBAT_CONFIG.BASE_ACCURACY;

    // Attacker bonuses
    baseChance += Math.floor((attacker.stats.dexterity - 10) / 2);
    if (action.type === 'attack') {
      baseChance += attacker.skills.combat;
    }

    // Target penalties
    baseChance -= Math.floor((target.stats.dexterity - 10) / 2);

    return Math.max(5, Math.min(95, baseChance));
  }

  private applyDefenses(
    damage: number,
    target: Character,
    damageType: DamageType
  ): number {
    let finalDamage = damage;

    // Apply armor reduction for physical damage
    if (damageType === DAMAGE_TYPES.PHYSICAL) {
      //TODO: Get actual armor value from equipped items
      const armorReduction = Math.floor(target.stats.constitution / 20);
      finalDamage -= armorReduction;
    }

    // Apply resistances from character traits
    //TODO: Check character traits for damage resistances

    return Math.max(0, finalDamage);
  }

  private async updateSessionFromActionResult(
    session: CombatSession,
    result: CombatActionResult,
    action: CombatAction
  ): Promise<CombatSession> {
    // Apply damage/healing
    if (action.data.targetId) {
      const targetParticipant = session.participants.find(
        p => p.id === action.data.targetId
      );
      if (targetParticipant) {
        if (result.damage > 0) {
          targetParticipant.character.currentHealth = Math.max(
            0,
            targetParticipant.character.currentHealth - result.damage
          );
        }
        if (result.healing > 0) {
          targetParticipant.character.currentHealth = Math.min(
            targetParticipant.character.maxHealth,
            targetParticipant.character.currentHealth + result.healing
          );
        }

        // Apply status effects
        targetParticipant.character.statusEffects.push(
          ...result.statusEffectsApplied
        );
      }
    }

    // Reduce actor's action points
    const actor = session.participants.find(p => p.id === action.playerId);
    if (actor) {
      actor.actionPoints = Math.max(0, actor.actionPoints - 1);
      actor.hasActed = true;
    }

    // Advance to next participant if current one is out of actions
    if (actor && actor.actionPoints <= 0) {
      const nextParticipantIndex =
        (session.turnOrder.indexOf(session.currentParticipant) + 1) %
        session.turnOrder.length;
      session.currentParticipant = session.turnOrder[nextParticipantIndex];

      // If we've cycled through all participants, start new round
      if (nextParticipantIndex === 0) {
        session.currentTurn++;
        // Reset action points for all participants
        session.participants.forEach(p => {
          p.actionPoints = p.maxActionPoints;
          p.hasActed = false;
        });
      }
    }

    return session;
  }

  private createCombatLogEntry(
    action: CombatAction,
    result: CombatActionResult,
    actor: CombatParticipant,
    target?: CombatParticipant
  ): CombatLogEntry {
    return {
      timestamp: new Date(),
      participantId: actor.id,
      action: action.type,
      target: target?.id,
      result: result.narrativeDescription,
      damage: result.damage > 0 ? result.damage : undefined,
      effects: result.statusEffectsApplied.map(effect => effect.name),
    };
  }

  private checkCombatEndConditions(session: CombatSession): boolean {
    const alivePlayers = session.participants.filter(
      p => p.type === 'player' && p.character.currentHealth > 0
    );
    const aliveEnemies = session.participants.filter(
      p => p.type !== 'player' && p.character.currentHealth > 0
    );

    // Combat ends if one side is completely defeated or max rounds reached
    return (
      alivePlayers.length === 0 ||
      aliveEnemies.length === 0 ||
      session.currentTurn >= COMBAT_CONFIG.MAX_COMBAT_ROUNDS
    );
  }

  private createCombatEvents(
    session: CombatSession,
    result: CombatActionResult,
    action: CombatAction
  ): GameEvent[] {
    return [
      {
        id: uuidv4(),
        type: 'combat_action',
        gameId: session.id,
        timestamp: new Date(),
        data: {
          participantId: action.playerId,
          actionType: action.type,
          outcome: result.outcome,
          damage: result.damage,
          healing: result.healing,
        },
        isPublic: true,
      },
    ];
  }

  private generateAIAction(
    participant: CombatParticipant,
    session: CombatSession
  ): CombatAction {
    // Simple AI: attack closest enemy with highest health
    const enemies = session.participants.filter(
      p => p.type !== participant.type && p.character.currentHealth > 0
    );

    if (enemies.length === 0) {
      // No valid targets, wait
      return {
        id: uuidv4(),
        type: 'wait',
        playerId: participant.id,
        gameId: session.id,
        timestamp: new Date(),
        data: {},
      };
    }

    // Pick target with highest health
    const target = enemies.reduce((prev, current) =>
      current.character.currentHealth > prev.character.currentHealth
        ? current
        : prev
    );

    return {
      id: uuidv4(),
      type: 'attack',
      playerId: participant.id,
      gameId: session.id,
      timestamp: new Date(),
      data: {
        targetId: target.id,
      },
    };
  }

  private processEnvironmentEffects(
    session: CombatSession
  ): EnvironmentEffect[] {
    const effects: EnvironmentEffect[] = [];

    // Process hazards
    session.environment.hazards.forEach(hazard => {
      if (Math.random() * 100 < hazard.frequency) {
        const affectedParticipants = session.participants
          .filter(p =>
            hazard.area.some(
              pos => p.position.x === pos.x && p.position.y === pos.y
            )
          )
          .map(p => p.id);

        if (affectedParticipants.length > 0) {
          effects.push({
            name: hazard.name,
            description: hazard.description,
            affectedParticipants,
            damage: hazard.damage,
            statusEffects: [], // TODO: Convert hazard effects to status effects
          });
        }
      }
    });

    return effects;
  }

  private calculateExperienceGained(
    session: CombatSession,
    victor: string
  ): number {
    if (victor !== 'players') return 0;

    const enemyLevels = session.participants
      .filter(p => p.type !== 'player')
      .reduce((sum, p) => sum + p.character.level, 0);

    return enemyLevels * 100; // Base XP per enemy level
  }

  private generateLootDrops(session: CombatSession, victor: string): Item[] {
    if (victor !== 'players') return [];

    //TODO: Implement proper loot generation system
    return [];
  }

  private generateCombatSummary(
    session: CombatSession,
    victor: string,
    experienceGained: number,
    lootDropped: Item[]
  ): string {
    let summary = `Combat lasted ${session.currentTurn} rounds. `;

    if (victor === 'players') {
      summary += `Victory! Players gained ${experienceGained} experience points.`;
    } else if (victor === 'enemies') {
      summary += 'Defeat! The enemies have won.';
    } else {
      summary += 'The battle ended in a draw.';
    }

    if (lootDropped.length > 0) {
      summary += ` Found ${lootDropped.length} items.`;
    }

    return summary;
  }

  private async getCombatSession(gameId: UUID): Promise<CombatSession | null> {
    // First check active sessions cache
    const activeSession = this.activeSessions.get(gameId);
    if (activeSession) {
      return activeSession;
    }

    // Load from storage
    const result = await kvService.get<CombatSession>(
      `combat_session:${gameId}`
    );
    if (result.success && result.data) {
      this.activeSessions.set(gameId, result.data);
      return result.data;
    }

    return null;
  }

  private async saveCombatSession(session: CombatSession): Promise<void> {
    const result = await kvService.set(
      `combat_session:${session.id}`,
      session,
      3600
    ); // 1 hour TTL
    if (!result.success) {
      throw new Error(`Failed to save combat session: ${result.error}`);
    }
  }

  private async deleteCombatSession(sessionId: UUID): Promise<void> {
    await kvService.delete(`combat_session:${sessionId}`);
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const combatSystem = CombatSystem.getInstance();
export default combatSystem;
