/**
 * RPG Skill Tree System
 *
 * Comprehensive skill tree implementation with prerequisites, branching paths,
 * and progression validation for the RpgAInfinity RPG character system.
 */

import { v4 as uuidv4 } from 'uuid';
import { Character, CharacterSkills, CharacterStats, UUID } from '@/types/rpg';
import { GameError, ErrorCode } from '@/types/core';

// ============================================================================
// SKILL TREE INTERFACES & TYPES
// ============================================================================

export interface SkillNode {
  readonly id: UUID;
  readonly name: string;
  readonly description: string;
  readonly category: keyof CharacterSkills;
  readonly tier: number; // 1-5, higher tiers require more investment
  readonly maxRank: number;
  readonly prerequisites: SkillPrerequisite[];
  readonly effects: SkillEffect[];
  readonly cost: SkillCost;
  readonly isPassive: boolean;
  readonly iconPath?: string;
}

export interface SkillPrerequisite {
  readonly type: 'skill' | 'stat' | 'level' | 'trait' | 'item';
  readonly target: string; // Skill name, stat name, etc.
  readonly value: number;
  readonly description: string;
}

export interface SkillEffect {
  readonly type:
    | 'stat_bonus'
    | 'skill_bonus'
    | 'special_ability'
    | 'unlock_action';
  readonly target: string;
  readonly value: number | string;
  readonly description: string;
}

export interface SkillCost {
  readonly skillPoints: number;
  readonly prerequisites: SkillPrerequisite[];
}

export interface LearnedSkill {
  readonly skillId: UUID;
  readonly currentRank: number;
  readonly learnedAt: Date;
  readonly bonusesApplied: SkillEffect[];
}

export interface SkillTree {
  readonly category: keyof CharacterSkills;
  readonly name: string;
  readonly description: string;
  readonly nodes: SkillNode[];
  readonly connections: SkillConnection[];
}

export interface SkillConnection {
  readonly from: UUID; // Prerequisite skill node ID
  readonly to: UUID; // Target skill node ID
  readonly type: 'required' | 'recommended' | 'synergy';
}

export interface SkillProgression {
  readonly learnedSkills: Map<UUID, LearnedSkill>;
  readonly availablePoints: number;
  readonly totalPointsSpent: number;
}

// ============================================================================
// SKILL TREE MANAGER CLASS
// ============================================================================

export class SkillTreeManager {
  private static instance: SkillTreeManager;
  private skillTrees: Map<keyof CharacterSkills, SkillTree> = new Map();
  private allSkillNodes: Map<UUID, SkillNode> = new Map();

  private constructor() {
    this.initializeSkillTrees();
  }

  static getInstance(): SkillTreeManager {
    if (!SkillTreeManager.instance) {
      SkillTreeManager.instance = new SkillTreeManager();
    }
    return SkillTreeManager.instance;
  }

  // ============================================================================
  // SKILL TREE QUERIES
  // ============================================================================

  /**
   * Get all available skill trees
   */
  getSkillTrees(): SkillTree[] {
    return Array.from(this.skillTrees.values());
  }

  /**
   * Get a specific skill tree by category
   */
  getSkillTree(category: keyof CharacterSkills): SkillTree | null {
    return this.skillTrees.get(category) || null;
  }

  /**
   * Get a specific skill node by ID
   */
  getSkillNode(skillId: UUID): SkillNode | null {
    return this.allSkillNodes.get(skillId) || null;
  }

  /**
   * Get all skills available to a character based on their current progression
   */
  getAvailableSkills(
    character: Character,
    progression: SkillProgression
  ): SkillNode[] {
    const availableSkills: SkillNode[] = [];

    for (const skillNode of this.allSkillNodes.values()) {
      if (this.canLearnSkill(character, skillNode, progression)) {
        availableSkills.push(skillNode);
      }
    }

    return availableSkills;
  }

  /**
   * Get skill recommendations based on character build and current progression
   */
  getSkillRecommendations(
    character: Character,
    progression: SkillProgression
  ): SkillNode[] {
    const recommendations: SkillNode[] = [];
    const primarySkills = this.getPrimarySkillsForClass(character.class);

    for (const skillCategory of primarySkills) {
      const tree = this.skillTrees.get(skillCategory);
      if (!tree) continue;

      // Recommend tier 1 skills in primary categories that aren't learned
      const tier1Skills = tree.nodes.filter(
        node =>
          node.tier === 1 &&
          !progression.learnedSkills.has(node.id) &&
          this.canLearnSkill(character, node, progression)
      );

      recommendations.push(...tier1Skills);
    }

    return recommendations.slice(0, 5); // Limit to top 5 recommendations
  }

  // ============================================================================
  // SKILL LEARNING & PROGRESSION
  // ============================================================================

  /**
   * Learn a skill and update character progression
   */
  learnSkill(
    character: Character,
    skillId: UUID,
    progression: SkillProgression
  ): SkillProgression {
    const skillNode = this.getSkillNode(skillId);
    if (!skillNode) {
      throw new GameError(
        `Skill not found: ${skillId}`,
        ErrorCode.VALIDATION_FAILED
      );
    }

    // Check if skill can be learned
    if (!this.canLearnSkill(character, skillNode, progression)) {
      throw new GameError(
        'Prerequisites not met for this skill',
        ErrorCode.VALIDATION_FAILED
      );
    }

    // Check if player has enough skill points
    if (progression.availablePoints < skillNode.cost.skillPoints) {
      throw new GameError(
        'Insufficient skill points',
        ErrorCode.VALIDATION_FAILED
      );
    }

    // Create learned skill entry
    const learnedSkill: LearnedSkill = {
      skillId: skillNode.id,
      currentRank: 1,
      learnedAt: new Date(),
      bonusesApplied: skillNode.effects,
    };

    // Update progression
    const newLearnedSkills = new Map(progression.learnedSkills);
    newLearnedSkills.set(skillId, learnedSkill);

    const newProgression: SkillProgression = {
      learnedSkills: newLearnedSkills,
      availablePoints: progression.availablePoints - skillNode.cost.skillPoints,
      totalPointsSpent:
        progression.totalPointsSpent + skillNode.cost.skillPoints,
    };

    return newProgression;
  }

  /**
   * Upgrade an existing skill to the next rank
   */
  upgradeSkill(skillId: UUID, progression: SkillProgression): SkillProgression {
    const skillNode = this.getSkillNode(skillId);
    if (!skillNode) {
      throw new GameError(
        `Skill not found: ${skillId}`,
        ErrorCode.VALIDATION_FAILED
      );
    }

    const learnedSkill = progression.learnedSkills.get(skillId);
    if (!learnedSkill) {
      throw new GameError('Skill not learned yet', ErrorCode.VALIDATION_FAILED);
    }

    if (learnedSkill.currentRank >= skillNode.maxRank) {
      throw new GameError(
        'Skill already at maximum rank',
        ErrorCode.VALIDATION_FAILED
      );
    }

    const upgradeCost = skillNode.cost.skillPoints * learnedSkill.currentRank; // Increasing cost per rank
    if (progression.availablePoints < upgradeCost) {
      throw new GameError(
        'Insufficient skill points for upgrade',
        ErrorCode.VALIDATION_FAILED
      );
    }

    // Update the learned skill
    const upgradedSkill: LearnedSkill = {
      ...learnedSkill,
      currentRank: learnedSkill.currentRank + 1,
    };

    const newLearnedSkills = new Map(progression.learnedSkills);
    newLearnedSkills.set(skillId, upgradedSkill);

    const newProgression: SkillProgression = {
      learnedSkills: newLearnedSkills,
      availablePoints: progression.availablePoints - upgradeCost,
      totalPointsSpent: progression.totalPointsSpent + upgradeCost,
    };

    return newProgression;
  }

  /**
   * Check if a character can learn a specific skill
   */
  canLearnSkill(
    character: Character,
    skillNode: SkillNode,
    progression: SkillProgression
  ): boolean {
    // Check if already learned
    if (progression.learnedSkills.has(skillNode.id)) {
      return false; // Already learned (use upgradeSkill instead)
    }

    // Check skill points
    if (progression.availablePoints < skillNode.cost.skillPoints) {
      return false;
    }

    // Check all prerequisites
    for (const prerequisite of skillNode.prerequisites) {
      if (!this.checkPrerequisite(character, prerequisite, progression)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate total skill bonuses applied to a character
   */
  calculateAppliedBonuses(
    character: Character,
    progression: SkillProgression
  ): {
    statBonuses: Partial<CharacterStats>;
    skillBonuses: Partial<CharacterSkills>;
    specialAbilities: string[];
  } {
    const statBonuses: Partial<CharacterStats> = {};
    const skillBonuses: Partial<CharacterSkills> = {};
    const specialAbilities: string[] = [];

    for (const learnedSkill of progression.learnedSkills.values()) {
      const skillNode = this.getSkillNode(learnedSkill.skillId);
      if (!skillNode) continue;

      for (const effect of learnedSkill.bonusesApplied) {
        switch (effect.type) {
          case 'stat_bonus':
            const statName = effect.target as keyof CharacterStats;
            if (statName in character.stats) {
              statBonuses[statName] =
                (statBonuses[statName] || 0) +
                (typeof effect.value === 'number' ? effect.value : 0);
            }
            break;

          case 'skill_bonus':
            const skillName = effect.target as keyof CharacterSkills;
            if (skillName in character.skills) {
              skillBonuses[skillName] =
                (skillBonuses[skillName] || 0) +
                (typeof effect.value === 'number' ? effect.value : 0);
            }
            break;

          case 'special_ability':
            if (typeof effect.value === 'string') {
              specialAbilities.push(effect.value);
            }
            break;

          case 'unlock_action':
            if (typeof effect.value === 'string') {
              specialAbilities.push(`Action: ${effect.value}`);
            }
            break;
        }
      }
    }

    return {
      statBonuses,
      skillBonuses,
      specialAbilities,
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Check if a character meets a specific prerequisite
   */
  private checkPrerequisite(
    character: Character,
    prerequisite: SkillPrerequisite,
    progression: SkillProgression
  ): boolean {
    switch (prerequisite.type) {
      case 'level':
        return character.level >= prerequisite.value;

      case 'stat':
        const statName = prerequisite.target as keyof CharacterStats;
        return character.stats[statName] >= prerequisite.value;

      case 'skill':
        const skillName = prerequisite.target as keyof CharacterSkills;
        return character.skills[skillName] >= prerequisite.value;

      case 'trait':
        return character.traits.some(
          trait =>
            trait.name.toLowerCase() === prerequisite.target.toLowerCase()
        );

      case 'item':
        //TODO: Implement item prerequisite check when inventory system is integrated
        return true;

      default:
        return false;
    }
  }

  /**
   * Get primary skills for a character class
   */
  private getPrimarySkillsForClass(characterClass: {
    skillAffinities: (keyof CharacterSkills)[];
  }): (keyof CharacterSkills)[] {
    return characterClass.skillAffinities || [];
  }

  /**
   * Initialize all skill trees with predefined data
   */
  private initializeSkillTrees(): void {
    // Combat Skill Tree
    const combatTree = this.createCombatSkillTree();
    this.skillTrees.set('combat', combatTree);
    this.addSkillNodesToGlobalMap(combatTree.nodes);

    // Magic Skill Tree
    const magicTree = this.createMagicSkillTree();
    this.skillTrees.set('magic', magicTree);
    this.addSkillNodesToGlobalMap(magicTree.nodes);

    // Stealth Skill Tree
    const stealthTree = this.createStealthSkillTree();
    this.skillTrees.set('stealth', stealthTree);
    this.addSkillNodesToGlobalMap(stealthTree.nodes);

    // Diplomacy Skill Tree
    const diplomacyTree = this.createDiplomacySkillTree();
    this.skillTrees.set('diplomacy', diplomacyTree);
    this.addSkillNodesToGlobalMap(diplomacyTree.nodes);

    // Survival Skill Tree
    const survivalTree = this.createSurvivalSkillTree();
    this.skillTrees.set('survival', survivalTree);
    this.addSkillNodesToGlobalMap(survivalTree.nodes);

    // Investigation Skill Tree
    const investigationTree = this.createInvestigationSkillTree();
    this.skillTrees.set('investigation', investigationTree);
    this.addSkillNodesToGlobalMap(investigationTree.nodes);

    // Crafting Skill Tree
    const craftingTree = this.createCraftingSkillTree();
    this.skillTrees.set('crafting', craftingTree);
    this.addSkillNodesToGlobalMap(craftingTree.nodes);

    // Lore Skill Tree
    const loreTree = this.createLoreSkillTree();
    this.skillTrees.set('lore', loreTree);
    this.addSkillNodesToGlobalMap(loreTree.nodes);
  }

  /**
   * Add skill nodes to the global map for easy lookup
   */
  private addSkillNodesToGlobalMap(nodes: SkillNode[]): void {
    for (const node of nodes) {
      this.allSkillNodes.set(node.id, node);
    }
  }

  // ============================================================================
  // SKILL TREE CREATION METHODS
  // ============================================================================

  private createCombatSkillTree(): SkillTree {
    const nodes: SkillNode[] = [
      // Tier 1 - Basic Combat
      {
        id: uuidv4(),
        name: 'Weapon Proficiency',
        description: 'Increases accuracy and damage with all weapons',
        category: 'combat',
        tier: 1,
        maxRank: 5,
        prerequisites: [],
        effects: [
          {
            type: 'skill_bonus',
            target: 'combat',
            value: 2,
            description: '+2 Combat skill per rank',
          },
        ],
        cost: { skillPoints: 1, prerequisites: [] },
        isPassive: true,
      },
      {
        id: uuidv4(),
        name: 'Defensive Stance',
        description: 'Improves defensive capabilities and damage reduction',
        category: 'combat',
        tier: 1,
        maxRank: 3,
        prerequisites: [],
        effects: [
          {
            type: 'special_ability',
            target: 'defense',
            value: 'defensive_stance',
            description: 'Can enter defensive stance for +2 AC',
          },
        ],
        cost: { skillPoints: 1, prerequisites: [] },
        isPassive: false,
      },

      // Tier 2 - Specialized Combat
      {
        id: uuidv4(),
        name: 'Power Attack',
        description: 'Trade accuracy for increased damage',
        category: 'combat',
        tier: 2,
        maxRank: 3,
        prerequisites: [
          {
            type: 'skill',
            target: 'combat',
            value: 10,
            description: 'Combat skill 10+',
          },
          {
            type: 'stat',
            target: 'strength',
            value: 15,
            description: 'Strength 15+',
          },
        ],
        effects: [
          {
            type: 'unlock_action',
            target: 'power_attack',
            value: 'power_attack',
            description: 'Unlocks Power Attack combat action',
          },
        ],
        cost: { skillPoints: 2, prerequisites: [] },
        isPassive: false,
      },

      // Tier 3 - Master Combat
      {
        id: uuidv4(),
        name: 'Combat Reflexes',
        description: 'Allows multiple attacks of opportunity',
        category: 'combat',
        tier: 3,
        maxRank: 2,
        prerequisites: [
          {
            type: 'skill',
            target: 'combat',
            value: 25,
            description: 'Combat skill 25+',
          },
          {
            type: 'stat',
            target: 'dexterity',
            value: 18,
            description: 'Dexterity 18+',
          },
        ],
        effects: [
          {
            type: 'special_ability',
            target: 'attacks',
            value: 'extra_aoo',
            description: 'Additional attacks of opportunity',
          },
        ],
        cost: { skillPoints: 3, prerequisites: [] },
        isPassive: true,
      },
    ];

    return {
      category: 'combat',
      name: 'Combat Mastery',
      description: 'Master the art of warfare and physical combat',
      nodes,
      connections: [
        // Add connections between related skills
        //TODO: Add proper skill connections when UI system is integrated
      ],
    };
  }

  private createMagicSkillTree(): SkillTree {
    const nodes: SkillNode[] = [
      // Tier 1 - Basic Magic
      {
        id: uuidv4(),
        name: 'Mana Control',
        description: 'Increases mana pool and regeneration',
        category: 'magic',
        tier: 1,
        maxRank: 5,
        prerequisites: [],
        effects: [
          {
            type: 'stat_bonus',
            target: 'intelligence',
            value: 1,
            description: '+1 Intelligence per rank',
          },
        ],
        cost: { skillPoints: 1, prerequisites: [] },
        isPassive: true,
      },
      {
        id: uuidv4(),
        name: 'Elemental Affinity',
        description: 'Specialization in elemental magic schools',
        category: 'magic',
        tier: 1,
        maxRank: 3,
        prerequisites: [
          {
            type: 'stat',
            target: 'intelligence',
            value: 12,
            description: 'Intelligence 12+',
          },
        ],
        effects: [
          {
            type: 'skill_bonus',
            target: 'magic',
            value: 3,
            description: '+3 Magic skill per rank',
          },
        ],
        cost: { skillPoints: 1, prerequisites: [] },
        isPassive: true,
      },

      // Tier 2 - Advanced Magic
      {
        id: uuidv4(),
        name: 'Spell Focus',
        description: 'Increases spell accuracy and power',
        category: 'magic',
        tier: 2,
        maxRank: 4,
        prerequisites: [
          {
            type: 'skill',
            target: 'magic',
            value: 15,
            description: 'Magic skill 15+',
          },
          {
            type: 'stat',
            target: 'intelligence',
            value: 16,
            description: 'Intelligence 16+',
          },
        ],
        effects: [
          {
            type: 'special_ability',
            target: 'spells',
            value: 'spell_focus',
            description: '+2 to spell attack rolls and DC',
          },
        ],
        cost: { skillPoints: 2, prerequisites: [] },
        isPassive: true,
      },

      // Tier 3 - Master Magic
      {
        id: uuidv4(),
        name: 'Arcane Mastery',
        description: 'Access to the most powerful magical abilities',
        category: 'magic',
        tier: 3,
        maxRank: 2,
        prerequisites: [
          {
            type: 'skill',
            target: 'magic',
            value: 30,
            description: 'Magic skill 30+',
          },
          {
            type: 'stat',
            target: 'intelligence',
            value: 20,
            description: 'Intelligence 20+',
          },
          {
            type: 'level',
            target: 'level',
            value: 10,
            description: 'Level 10+',
          },
        ],
        effects: [
          {
            type: 'unlock_action',
            target: 'metamagic',
            value: 'metamagic',
            description: 'Unlocks metamagic abilities',
          },
        ],
        cost: { skillPoints: 4, prerequisites: [] },
        isPassive: false,
      },
    ];

    return {
      category: 'magic',
      name: 'Arcane Arts',
      description: 'Harness the power of magic and the arcane',
      nodes,
      connections: [],
    };
  }

  private createStealthSkillTree(): SkillTree {
    const nodes: SkillNode[] = [
      // Tier 1
      {
        id: uuidv4(),
        name: 'Light Footed',
        description: 'Move more quietly and avoid detection',
        category: 'stealth',
        tier: 1,
        maxRank: 5,
        prerequisites: [],
        effects: [
          {
            type: 'skill_bonus',
            target: 'stealth',
            value: 2,
            description: '+2 Stealth skill per rank',
          },
        ],
        cost: { skillPoints: 1, prerequisites: [] },
        isPassive: true,
      },

      // Tier 2
      {
        id: uuidv4(),
        name: 'Sneak Attack',
        description: 'Deal extra damage when attacking from stealth',
        category: 'stealth',
        tier: 2,
        maxRank: 3,
        prerequisites: [
          {
            type: 'skill',
            target: 'stealth',
            value: 15,
            description: 'Stealth skill 15+',
          },
          {
            type: 'stat',
            target: 'dexterity',
            value: 14,
            description: 'Dexterity 14+',
          },
        ],
        effects: [
          {
            type: 'unlock_action',
            target: 'sneak_attack',
            value: 'sneak_attack',
            description: 'Unlocks sneak attack ability',
          },
        ],
        cost: { skillPoints: 2, prerequisites: [] },
        isPassive: false,
      },
    ];

    return {
      category: 'stealth',
      name: 'Shadow Arts',
      description: 'Master the art of stealth and subterfuge',
      nodes,
      connections: [],
    };
  }

  // Simplified implementations for remaining skill trees
  private createDiplomacySkillTree(): SkillTree {
    return {
      category: 'diplomacy',
      name: 'Social Influence',
      description: 'Master social interactions and persuasion',
      nodes: [
        {
          id: uuidv4(),
          name: 'Persuasive',
          description: 'More effective at convincing others',
          category: 'diplomacy',
          tier: 1,
          maxRank: 5,
          prerequisites: [],
          effects: [
            {
              type: 'skill_bonus',
              target: 'diplomacy',
              value: 2,
              description: '+2 Diplomacy skill per rank',
            },
          ],
          cost: { skillPoints: 1, prerequisites: [] },
          isPassive: true,
        },
      ],
      connections: [],
    };
  }

  private createSurvivalSkillTree(): SkillTree {
    return {
      category: 'survival',
      name: 'Wilderness Mastery',
      description: 'Thrive in the wild and harsh environments',
      nodes: [
        {
          id: uuidv4(),
          name: 'Tracker',
          description: 'Better at following trails and finding resources',
          category: 'survival',
          tier: 1,
          maxRank: 5,
          prerequisites: [],
          effects: [
            {
              type: 'skill_bonus',
              target: 'survival',
              value: 2,
              description: '+2 Survival skill per rank',
            },
          ],
          cost: { skillPoints: 1, prerequisites: [] },
          isPassive: true,
        },
      ],
      connections: [],
    };
  }

  private createInvestigationSkillTree(): SkillTree {
    return {
      category: 'investigation',
      name: 'Detective Work',
      description: 'Excel at finding clues and solving mysteries',
      nodes: [
        {
          id: uuidv4(),
          name: 'Keen Eye',
          description: 'Notice details others miss',
          category: 'investigation',
          tier: 1,
          maxRank: 5,
          prerequisites: [],
          effects: [
            {
              type: 'skill_bonus',
              target: 'investigation',
              value: 2,
              description: '+2 Investigation skill per rank',
            },
          ],
          cost: { skillPoints: 1, prerequisites: [] },
          isPassive: true,
        },
      ],
      connections: [],
    };
  }

  private createCraftingSkillTree(): SkillTree {
    return {
      category: 'crafting',
      name: 'Artisan Skills',
      description: 'Create and improve items and equipment',
      nodes: [
        {
          id: uuidv4(),
          name: 'Skilled Hands',
          description: 'Improved crafting abilities and efficiency',
          category: 'crafting',
          tier: 1,
          maxRank: 5,
          prerequisites: [],
          effects: [
            {
              type: 'skill_bonus',
              target: 'crafting',
              value: 2,
              description: '+2 Crafting skill per rank',
            },
          ],
          cost: { skillPoints: 1, prerequisites: [] },
          isPassive: true,
        },
      ],
      connections: [],
    };
  }

  private createLoreSkillTree(): SkillTree {
    return {
      category: 'lore',
      name: 'Ancient Knowledge',
      description: 'Understand history, cultures, and ancient secrets',
      nodes: [
        {
          id: uuidv4(),
          name: 'Scholar',
          description: 'Extensive knowledge of history and lore',
          category: 'lore',
          tier: 1,
          maxRank: 5,
          prerequisites: [],
          effects: [
            {
              type: 'skill_bonus',
              target: 'lore',
              value: 2,
              description: '+2 Lore skill per rank',
            },
          ],
          cost: { skillPoints: 1, prerequisites: [] },
          isPassive: true,
        },
      ],
      connections: [],
    };
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const skillTreeManager = SkillTreeManager.getInstance();
