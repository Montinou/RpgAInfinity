/**
 * Role Assignment System for RpgAInfinity Deduction Game
 *
 * Features:
 * - AI-powered role generation for different themes
 * - Role balance validation for fair gameplay
 * - Psychological profiling for player assignment
 * - Dynamic objective creation based on preferences
 * - Support for multiple game modes and variants
 * - 15+ deduction game themes with rich lore
 */

import { z } from 'zod';
import {
  RoleDefinition,
  RoleAlignment,
  RoleType,
  AssignedRole,
  RoleObjective,
  DeductionScenario,
  PlayerStatus,
  RoleAbility,
  AbilityType,
  AbilityTiming,
  TargetType,
  UsageLimit,
  DeductionPlayer,
} from '../../../types/deduction';
import { Player, UUID, GameError, Difficulty } from '../../../types/core';
import { generateDeductionContent } from '../../ai/index';
import { kvService } from '../../database';

// ============================================================================
// GAME THEME DEFINITIONS
// ============================================================================

export const DEDUCTION_THEMES = {
  // Classic social deduction
  MAFIA: {
    id: 'mafia',
    name: 'Classic Mafia',
    description: 'Traditional mafia vs town with investigation and elimination',
    setting: 'Modern city with organized crime',
    atmosphere: 'gritty urban noir',
    conflicts: ['law vs crime', 'loyalty vs survival'],
    culturalElements: ['family ties', 'code of honor', 'corruption'],
    suggestedPlayerRange: { min: 6, max: 16 },
  },

  WEREWOLF: {
    id: 'werewolf',
    name: 'Werewolf Village',
    description:
      'Lycanthropes hunt the innocent while villagers seek to survive',
    setting: 'Medieval village under siege by supernatural forces',
    atmosphere: 'gothic horror with supernatural dread',
    conflicts: ['human vs monster', 'superstition vs reason'],
    culturalElements: [
      'folklore',
      'medieval hierarchy',
      'supernatural beliefs',
    ],
    suggestedPlayerRange: { min: 8, max: 20 },
  },

  AMONG_US: {
    id: 'space_station',
    name: 'Space Station Crisis',
    description:
      'Saboteurs infiltrate a space mission while crew tries to maintain operations',
    setting: 'High-tech space station or colony ship',
    atmosphere: 'sci-fi thriller with claustrophobic tension',
    conflicts: ['order vs chaos', 'mission vs survival'],
    culturalElements: [
      'technology dependence',
      'isolation',
      'duty vs self-preservation',
    ],
    suggestedPlayerRange: { min: 4, max: 12 },
  },

  MEDIEVAL_COURT: {
    id: 'medieval_court',
    name: 'Medieval Court Intrigue',
    description: 'Nobles scheme for power while loyalists defend the crown',
    setting: 'Royal palace filled with political machinations',
    atmosphere: 'courtly intrigue with elegant danger',
    conflicts: ['loyalty vs ambition', 'tradition vs change'],
    culturalElements: ['nobility', 'honor codes', 'political alliances'],
    suggestedPlayerRange: { min: 6, max: 14 },
  },

  PIRATE_CREW: {
    id: 'pirate_crew',
    name: 'Mutinous Pirates',
    description:
      'Mutineers plot against the captain while loyal crew defend the ship',
    setting: 'Golden age pirate ship on the high seas',
    atmosphere: 'swashbuckling adventure with betrayal',
    conflicts: ['authority vs rebellion', 'greed vs loyalty'],
    culturalElements: [
      'maritime traditions',
      'treasure hunting',
      'crew democracy',
    ],
    suggestedPlayerRange: { min: 6, max: 16 },
  },

  CYBERPUNK: {
    id: 'cyberpunk_corporate',
    name: 'Corporate Espionage',
    description:
      'Corporate spies infiltrate a megacorp while security tries to identify threats',
    setting: 'Dystopian future megacorporation facility',
    atmosphere: 'high-tech noir with corporate paranoia',
    conflicts: ['corporate vs individual', 'technology vs humanity'],
    culturalElements: [
      'cybernetics',
      'corporate culture',
      'information warfare',
    ],
    suggestedPlayerRange: { min: 6, max: 12 },
  },

  FANTASY_VILLAGE: {
    id: 'fantasy_village',
    name: 'Enchanted Village',
    description:
      'Dark magic corrupts villagers while heroes seek to cleanse the evil',
    setting: 'Fantasy village under magical threat',
    atmosphere: 'magical realism with creeping darkness',
    conflicts: ['good vs evil', 'magic vs mundane'],
    culturalElements: ['fantasy races', 'magical systems', 'heroic traditions'],
    suggestedPlayerRange: { min: 8, max: 18 },
  },

  HORROR_MANSION: {
    id: 'horror_mansion',
    name: 'Haunted Mansion',
    description:
      'Possessed guests threaten survivors in a supernatural horror setting',
    setting: 'Victorian mansion with supernatural presence',
    atmosphere: 'psychological horror with supernatural elements',
    conflicts: ['sanity vs madness', 'living vs dead'],
    culturalElements: ['Victorian era', 'spiritualism', 'family secrets'],
    suggestedPlayerRange: { min: 6, max: 12 },
  },

  WILD_WEST: {
    id: 'wild_west',
    name: 'Frontier Town',
    description:
      'Outlaws infiltrate a frontier town while lawmen try to maintain order',
    setting: 'American Wild West frontier settlement',
    atmosphere: 'western drama with lawless tension',
    conflicts: ['law vs chaos', 'civilization vs wilderness'],
    culturalElements: ['frontier justice', 'gold rush', 'manifest destiny'],
    suggestedPlayerRange: { min: 6, max: 14 },
  },

  ZOMBIE_APOCALYPSE: {
    id: 'zombie_apocalypse',
    name: 'Zombie Survival',
    description:
      'Infected survivors hide among the living while others fight for humanity',
    setting: 'Post-apocalyptic world overrun by zombies',
    atmosphere: 'survival horror with desperate hope',
    conflicts: ['humanity vs infection', 'survival vs sacrifice'],
    culturalElements: [
      'apocalypse survival',
      'medical crisis',
      'social collapse',
    ],
    suggestedPlayerRange: { min: 8, max: 16 },
  },

  SECRET_AGENTS: {
    id: 'secret_agents',
    name: 'Spy Network',
    description: 'Double agents infiltrate an intelligence operation',
    setting: 'Cold War era intelligence headquarters',
    atmosphere: 'espionage thriller with paranoid tension',
    conflicts: ['loyalty vs ideology', 'truth vs deception'],
    culturalElements: [
      'spy tradecraft',
      'ideological warfare',
      'international intrigue',
    ],
    suggestedPlayerRange: { min: 6, max: 12 },
  },

  SCHOOL_SETTING: {
    id: 'school_mystery',
    name: 'Academy Mystery',
    description:
      'Troublemakers cause chaos while prefects try to maintain order',
    setting: 'Prestigious boarding school or magical academy',
    atmosphere: 'young adult mystery with academic pressure',
    conflicts: ['authority vs rebellion', 'conformity vs individuality'],
    culturalElements: ['academic hierarchy', 'peer pressure', 'coming of age'],
    suggestedPlayerRange: { min: 8, max: 20 },
  },

  ARCTIC_EXPEDITION: {
    id: 'arctic_expedition',
    name: 'Arctic Research Station',
    description:
      'Saboteurs threaten a polar research mission while scientists fight for survival',
    setting: 'Isolated Arctic research facility',
    atmosphere: 'survival thriller with environmental danger',
    conflicts: ['cooperation vs sabotage', 'science vs nature'],
    culturalElements: [
      'scientific research',
      'environmental crisis',
      'international cooperation',
    ],
    suggestedPlayerRange: { min: 6, max: 10 },
  },

  SUPERHERO: {
    id: 'superhero_team',
    name: 'Superhero Crisis',
    description:
      'Villains infiltrate a superhero team while heroes try to save the city',
    setting: 'Modern city with superhero headquarters',
    atmosphere: 'superhero drama with moral complexity',
    conflicts: ['heroism vs villainy', 'power vs responsibility'],
    culturalElements: [
      'superhero mythology',
      'moral codes',
      'secret identities',
    ],
    suggestedPlayerRange: { min: 6, max: 16 },
  },

  CUSTOM: {
    id: 'custom',
    name: 'Custom Theme',
    description: 'Player-defined theme with AI-generated elements',
    setting: 'Customizable based on player input',
    atmosphere: 'Adaptable to player preferences',
    conflicts: ['Generated based on theme'],
    culturalElements: ['AI-generated cultural context'],
    suggestedPlayerRange: { min: 4, max: 20 },
  },
} as const;

// ============================================================================
// GAME MODE DEFINITIONS
// ============================================================================

export const GAME_MODES = {
  CLASSIC: {
    id: 'classic',
    name: 'Classic Mode',
    description: 'Traditional social deduction with standard rules',
    features: ['standard_voting', 'night_actions', 'role_reveal_on_death'],
    balancing: 'traditional',
    complexity: 'moderate',
  },

  CHAOS: {
    id: 'chaos',
    name: 'Chaos Mode',
    description: 'Unpredictable roles and random events',
    features: ['random_role_assignments', 'surprise_events', 'role_swapping'],
    balancing: 'chaotic',
    complexity: 'high',
  },

  DETECTIVE: {
    id: 'detective',
    name: 'Detective Mode',
    description: 'Enhanced investigation with more clues and information roles',
    features: [
      'enhanced_investigation',
      'more_information_roles',
      'clue_system',
    ],
    balancing: 'investigative',
    complexity: 'high',
  },

  SPEED: {
    id: 'speed',
    name: 'Speed Mode',
    description: 'Fast-paced games with shorter discussion periods',
    features: ['short_discussions', 'quick_voting', 'simplified_roles'],
    balancing: 'simplified',
    complexity: 'low',
  },

  HARDCORE: {
    id: 'hardcore',
    name: 'Hardcore Mode',
    description:
      'No role reveals, limited information, maximum deduction challenge',
    features: ['no_role_reveal', 'limited_information', 'expert_balancing'],
    balancing: 'expert',
    complexity: 'very_high',
  },

  NEWBIE: {
    id: 'newbie',
    name: 'Beginner Mode',
    description: 'Simplified rules and helpful hints for new players',
    features: ['simplified_roles', 'helpful_hints', 'extended_discussions'],
    balancing: 'beginner',
    complexity: 'low',
  },
} as const;

// ============================================================================
// ROLE ASSIGNMENT INTERFACES
// ============================================================================

export interface Assignment {
  readonly playerId: UUID;
  readonly player: Player;
  readonly role: AssignedRole;
  readonly assignmentReason: string;
  readonly psychologicalProfile: PlayerPsychProfile;
  readonly confidence: number; // 0-1, how confident the assignment is
}

export interface PlayerPsychProfile {
  readonly playerId: UUID;
  readonly traits: {
    readonly deductionSkill: number; // 0-1
    readonly bluffingAbility: number; // 0-1
    readonly socialInfluence: number; // 0-1
    readonly riskTolerance: number; // 0-1
    readonly teamworkPreference: number; // 0-1
  };
  readonly preferredRoleTypes: RoleType[];
  readonly preferredAlignments: RoleAlignment[];
  readonly experienceLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  readonly playStyle:
    | 'aggressive'
    | 'conservative'
    | 'analytical'
    | 'social'
    | 'chaotic';
}

export interface RoleDistribution {
  readonly playerCount: number;
  readonly distribution: {
    readonly [key in RoleAlignment]: number;
  };
  readonly specialRoles: string[];
  readonly balanceScore: number; // 0-1, higher is more balanced
  readonly difficulty: Difficulty;
  readonly estimatedGameLength: number; // minutes
}

export interface BalanceResult {
  readonly isBalanced: boolean;
  readonly balanceScore: number; // 0-1
  readonly issues: BalanceIssue[];
  readonly recommendations: string[];
  readonly winProbabilities: Record<RoleAlignment, number>;
}

export interface BalanceIssue {
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly type:
    | 'role_count'
    | 'power_imbalance'
    | 'information_asymmetry'
    | 'win_condition_conflict';
  readonly description: string;
  readonly affectedRoles: string[];
  readonly suggestedFix: string;
}

export interface Objective {
  readonly id: UUID;
  readonly playerId: UUID;
  readonly type:
    | 'eliminate'
    | 'survive'
    | 'discover'
    | 'protect'
    | 'convert'
    | 'complete_task';
  readonly description: string;
  readonly targetRole?: string;
  readonly targetAlignment?: RoleAlignment;
  readonly targetPlayer?: UUID;
  readonly conditions: ObjectiveCondition[];
  readonly reward: number; // points for completion
  readonly isHidden: boolean; // whether objective is visible to player
  readonly difficulty: Difficulty;
  readonly priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface ObjectiveCondition {
  readonly type:
    | 'player_alive'
    | 'player_dead'
    | 'phase_reached'
    | 'action_performed'
    | 'information_learned';
  readonly target?: UUID | string;
  readonly value?: number | string | boolean;
  readonly operator?: '=' | '!=' | '>' | '<' | '>=' | '<=';
}

export type GameMode = keyof typeof GAME_MODES;

// ============================================================================
// CORE ROLE ASSIGNER CLASS
// ============================================================================

export class RoleAssigner {
  private static instance: RoleAssigner;
  private themeRoleCache = new Map<string, RoleDefinition[]>();
  private balanceCache = new Map<string, BalanceResult>();

  private constructor() {
    // Singleton pattern
  }

  public static getInstance(): RoleAssigner {
    if (!RoleAssigner.instance) {
      RoleAssigner.instance = new RoleAssigner();
    }
    return RoleAssigner.instance;
  }

  /**
   * Generate balanced roles for a specific theme and player count
   */
  async generateRoles(
    playerCount: number,
    theme: string,
    difficulty: Difficulty,
    gameMode: GameMode = 'classic'
  ): Promise<RoleDefinition[]> {
    try {
      // Validate input parameters
      this.validateRoleGenerationInput(playerCount, theme, difficulty);

      // Check cache first
      const cacheKey = `${theme}-${playerCount}-${difficulty}-${gameMode}`;
      if (this.themeRoleCache.has(cacheKey)) {
        console.log(`Using cached roles for ${cacheKey}`);
        return this.themeRoleCache.get(cacheKey)!;
      }

      // Get theme configuration
      const themeConfig = this.getThemeConfiguration(theme);
      const modeConfig = GAME_MODES[gameMode];

      // Generate role distribution
      const distribution = this.createRoleDistribution(playerCount, gameMode);

      console.log(
        `Generating ${playerCount} roles for theme: ${theme}, difficulty: ${difficulty}, mode: ${gameMode}`
      );

      // Generate roles using AI
      const aiResponse = await generateDeductionContent('roles', {
        theme: themeConfig.name,
        setting: themeConfig.setting,
        atmosphere: themeConfig.atmosphere,
        conflicts: themeConfig.conflicts,
        culturalElements: themeConfig.culturalElements,
        playerCount,
        difficulty,
        gameMode: modeConfig.name,
        gameModeFeatures: modeConfig.features,
        distribution,
        complexity: modeConfig.complexity,
        balancingStyle: modeConfig.balancing,
        roleRequirements: {
          townRoles: distribution.distribution.town,
          mafiaRoles: distribution.distribution.mafia,
          neutralRoles: distribution.distribution.neutral,
          survivorRoles: distribution.distribution.survivor,
          specialRoles: distribution.specialRoles,
        },
      });

      if (!aiResponse.success || !aiResponse.response) {
        throw new GameError(
          'AI_GENERATION_FAILED',
          'Failed to generate roles with AI'
        );
      }

      // Parse AI response and create role definitions
      const roles = this.parseAIRoleResponse(
        aiResponse.response.content,
        theme,
        difficulty
      );

      // Validate and balance the generated roles
      const balanceResult = this.validateRoleBalance(roles);
      if (!balanceResult.isBalanced) {
        // TODO: Implement automatic rebalancing or fallback roles
        console.warn(
          `Generated roles are not well balanced (score: ${balanceResult.balanceScore})`,
          balanceResult.issues
        );
      }

      // Cache the results
      this.themeRoleCache.set(cacheKey, roles);
      this.balanceCache.set(cacheKey, balanceResult);

      console.log(
        `Successfully generated ${roles.length} roles for ${theme} theme`
      );

      return roles;
    } catch (error) {
      console.error('Error generating roles:', error);
      // TODO: Implement proper error logging service
      return this.getFallbackRoles(playerCount, theme, difficulty);
    }
  }

  /**
   * Assign generated roles to specific players using psychological profiling
   */
  async assignRoles(
    players: Player[],
    roles: RoleDefinition[]
  ): Promise<Assignment[]> {
    try {
      if (players.length !== roles.length) {
        throw new GameError(
          'INVALID_ASSIGNMENT',
          `Player count (${players.length}) doesn't match role count (${roles.length})`
        );
      }

      console.log(
        `Assigning roles to ${players.length} players using psychological profiling`
      );

      // Generate or retrieve psychological profiles for players
      const psychProfiles = await this.generatePlayerPsychProfiles(players);

      // Perform intelligent role assignment
      const assignments = this.performIntelligentAssignment(
        players,
        roles,
        psychProfiles
      );

      // Create full Assignment objects
      const fullAssignments: Assignment[] = assignments.map(
        (assignment, index) => ({
          playerId: assignment.playerId,
          player: assignment.player,
          role: {
            definition: assignment.role,
            secretInfo: this.generateSecretInformation(
              assignment.role,
              assignments
            ),
            teammates: this.findTeammates(assignment.role, assignments),
            abilities: this.createActiveAbilities(assignment.role),
            objectives: [], // Will be populated by generateObjectives
          },
          assignmentReason: assignment.reason,
          psychologicalProfile: assignment.profile,
          confidence: assignment.confidence,
        })
      );

      console.log('Successfully assigned roles to all players');

      return fullAssignments;
    } catch (error) {
      console.error('Error assigning roles:', error);
      // TODO: Implement proper error logging service
      throw new GameError(
        'ASSIGNMENT_FAILED',
        `Failed to assign roles: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate dynamic objectives based on player assignments and preferences
   */
  async generateObjectives(
    assignments: Assignment[],
    theme: string
  ): Promise<Objective[]> {
    try {
      console.log(
        `Generating dynamic objectives for ${assignments.length} players in ${theme} theme`
      );

      const objectives: Objective[] = [];

      for (const assignment of assignments) {
        const playerObjectives = await this.generatePlayerObjectives(
          assignment,
          assignments,
          theme
        );
        objectives.push(...playerObjectives);
      }

      console.log(`Generated ${objectives.length} total objectives`);

      return objectives;
    } catch (error) {
      console.error('Error generating objectives:', error);
      // TODO: Implement proper error logging service
      return this.getFallbackObjectives(assignments);
    }
  }

  /**
   * Validate role balance for fair gameplay
   */
  validateRoleBalance(roles: RoleDefinition[]): BalanceResult {
    try {
      const issues: BalanceIssue[] = [];
      const alignmentCounts = this.countAlignments(roles);
      const playerCount = roles.length;

      // Check basic alignment balance
      const townRatio = alignmentCounts.town / playerCount;
      const mafiaRatio = alignmentCounts.mafia / playerCount;
      const neutralRatio = alignmentCounts.neutral / playerCount;
      const survivorRatio = alignmentCounts.survivor / playerCount;

      // Ideal ranges for different alignments
      const idealTownRange = { min: 0.45, max: 0.75 };
      const idealMafiaRange = { min: 0.15, max: 0.35 };
      const idealNeutralRange = { min: 0.0, max: 0.25 };
      const idealSurvivorRange = { min: 0.0, max: 0.15 };

      // Check town balance
      if (townRatio < idealTownRange.min || townRatio > idealTownRange.max) {
        issues.push({
          severity: townRatio < 0.3 || townRatio > 0.8 ? 'high' : 'medium',
          type: 'role_count',
          description: `Town roles ${townRatio < idealTownRange.min ? 'too few' : 'too many'} (${Math.round(townRatio * 100)}%)`,
          affectedRoles: roles
            .filter(r => r.alignment === 'town')
            .map(r => r.name),
          suggestedFix:
            townRatio < idealTownRange.min
              ? 'Add more town roles'
              : 'Replace some town roles with other alignments',
        });
      }

      // Check mafia balance
      if (
        mafiaRatio < idealMafiaRange.min ||
        mafiaRatio > idealMafiaRange.max
      ) {
        issues.push({
          severity: mafiaRatio < 0.1 || mafiaRatio > 0.4 ? 'high' : 'medium',
          type: 'role_count',
          description: `Mafia roles ${mafiaRatio < idealMafiaRange.min ? 'too few' : 'too many'} (${Math.round(mafiaRatio * 100)}%)`,
          affectedRoles: roles
            .filter(r => r.alignment === 'mafia')
            .map(r => r.name),
          suggestedFix:
            mafiaRatio < idealMafiaRange.min
              ? 'Add more mafia roles'
              : 'Replace some mafia roles with town/neutral',
        });
      }

      // Check for power role balance
      const powerRoleCount = roles.filter(r => r.type === 'power').length;
      const powerRoleRatio = powerRoleCount / playerCount;

      if (powerRoleRatio > 0.4) {
        issues.push({
          severity: powerRoleRatio > 0.5 ? 'high' : 'medium',
          type: 'power_imbalance',
          description: `Too many power roles (${Math.round(powerRoleRatio * 100)}%)`,
          affectedRoles: roles.filter(r => r.type === 'power').map(r => r.name),
          suggestedFix:
            'Replace some power roles with vanilla or support roles',
        });
      }

      // Check for information asymmetry
      const investigativeRoles = roles.filter(r => r.type === 'investigative');
      if (investigativeRoles.length === 0 && playerCount > 6) {
        issues.push({
          severity: 'medium',
          type: 'information_asymmetry',
          description: 'No investigative roles in larger game',
          affectedRoles: [],
          suggestedFix:
            'Add at least one investigative role for information gathering',
        });
      }

      // Calculate win probabilities (simplified model)
      const winProbabilities = this.calculateWinProbabilities(
        alignmentCounts,
        roles
      );

      // Calculate overall balance score
      const balanceScore = this.calculateBalanceScore(issues, winProbabilities);

      return {
        isBalanced:
          issues.filter(i => i.severity === 'high' || i.severity === 'critical')
            .length === 0,
        balanceScore,
        issues,
        recommendations: this.generateBalanceRecommendations(issues),
        winProbabilities,
      };
    } catch (error) {
      console.error('Error validating role balance:', error);
      return {
        isBalanced: false,
        balanceScore: 0,
        issues: [
          {
            severity: 'critical',
            type: 'role_count',
            description: 'Failed to validate role balance',
            affectedRoles: [],
            suggestedFix: 'Manual review required',
          },
        ],
        recommendations: ['Manual balance review needed'],
        winProbabilities: { town: 0.5, mafia: 0.5, neutral: 0, survivor: 0 },
      };
    }
  }

  /**
   * Create role distribution for given player count and game mode
   */
  createRoleDistribution(
    playerCount: number,
    gameMode: GameMode
  ): RoleDistribution {
    const mode = GAME_MODES[gameMode];

    // Base distributions by player count
    let distribution: { [key in RoleAlignment]: number };
    let specialRoles: string[] = [];

    if (playerCount <= 6) {
      // Small games: simple setup
      distribution = {
        town: Math.ceil(playerCount * 0.6),
        mafia: Math.ceil(playerCount * 0.3),
        neutral: playerCount >= 5 ? 1 : 0,
        survivor: 0,
      };
      specialRoles = ['investigator', 'doctor'];
    } else if (playerCount <= 12) {
      // Medium games: more complex roles
      distribution = {
        town: Math.ceil(playerCount * 0.55),
        mafia: Math.ceil(playerCount * 0.25),
        neutral: Math.ceil(playerCount * 0.15),
        survivor: Math.ceil(playerCount * 0.05),
      };
      specialRoles = ['investigator', 'doctor', 'vigilante', 'serial_killer'];
    } else {
      // Large games: full complexity
      distribution = {
        town: Math.ceil(playerCount * 0.5),
        mafia: Math.ceil(playerCount * 0.3),
        neutral: Math.ceil(playerCount * 0.15),
        survivor: Math.ceil(playerCount * 0.05),
      };
      specialRoles = [
        'investigator',
        'doctor',
        'vigilante',
        'serial_killer',
        'witch',
        'mayor',
      ];
    }

    // Adjust total if needed
    const total = Object.values(distribution).reduce(
      (sum, count) => sum + count,
      0
    );
    if (total !== playerCount) {
      const difference = playerCount - total;
      if (difference > 0) {
        distribution.town += difference;
      } else {
        distribution.town = Math.max(1, distribution.town + difference);
      }
    }

    // Game mode adjustments
    switch (gameMode) {
      case 'chaos':
        // Chaos mode: more neutral/survivor roles
        if (distribution.town > 2) {
          distribution.town -= 1;
          distribution.neutral += 1;
        }
        specialRoles.push('jester', 'executioner', 'amnesiac');
        break;

      case 'detective':
        // Detective mode: more investigative roles
        specialRoles.push('detective', 'psychic', 'tracker');
        break;

      case 'speed':
        // Speed mode: simpler roles
        specialRoles = specialRoles.slice(0, 2);
        break;

      case 'newbie':
        // Beginner mode: basic roles only
        specialRoles = ['investigator', 'doctor'];
        break;
    }

    const balanceScore = this.calculateDistributionBalance(
      distribution,
      playerCount
    );

    return {
      playerCount,
      distribution,
      specialRoles,
      balanceScore,
      difficulty: this.inferDifficulty(distribution, specialRoles),
      estimatedGameLength: this.estimateGameLength(playerCount, gameMode),
    };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private validateRoleGenerationInput(
    playerCount: number,
    theme: string,
    difficulty: Difficulty
  ): void {
    if (playerCount < 4 || playerCount > 20) {
      throw new GameError(
        'INVALID_PLAYER_COUNT',
        `Player count must be between 4 and 20, got ${playerCount}`
      );
    }

    if (!theme || theme.trim().length === 0) {
      throw new GameError('INVALID_THEME', 'Theme cannot be empty');
    }

    if (!['easy', 'medium', 'hard', 'expert'].includes(difficulty)) {
      throw new GameError(
        'INVALID_DIFFICULTY',
        `Invalid difficulty: ${difficulty}`
      );
    }
  }

  private getThemeConfiguration(theme: string) {
    // Find theme in predefined themes or use custom
    const themeKey = Object.keys(DEDUCTION_THEMES).find(
      key => DEDUCTION_THEMES[key as keyof typeof DEDUCTION_THEMES].id === theme
    ) as keyof typeof DEDUCTION_THEMES | undefined;

    if (themeKey) {
      return DEDUCTION_THEMES[themeKey];
    }

    // Return custom theme configuration
    return {
      ...DEDUCTION_THEMES.CUSTOM,
      name: theme,
      description: `Custom theme: ${theme}`,
      setting: `Custom setting based on ${theme}`,
      atmosphere: `Atmospheric elements of ${theme}`,
      conflicts: ['Custom conflict themes'],
      culturalElements: ['Custom cultural elements'],
    };
  }

  private parseAIRoleResponse(
    content: string,
    theme: string,
    difficulty: Difficulty
  ): RoleDefinition[] {
    try {
      // TODO: Implement robust JSON extraction and fallback content generation

      // Try to extract JSON from AI response
      let parsedData: any;
      try {
        // Look for JSON in the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedData = JSON.parse(jsonMatch[0]);
        } else {
          // Fallback: parse as structured text
          parsedData = this.parseStructuredRoleText(content);
        }
      } catch (parseError) {
        console.warn(
          'Failed to parse AI response as JSON, using fallback parser'
        );
        parsedData = this.parseStructuredRoleText(content);
      }

      // Convert parsed data to RoleDefinition objects
      const roles: RoleDefinition[] = [];

      if (parsedData.roles && Array.isArray(parsedData.roles)) {
        for (const roleData of parsedData.roles) {
          try {
            const role = this.createRoleDefinitionFromData(
              roleData,
              theme,
              difficulty
            );
            roles.push(role);
          } catch (roleError) {
            console.warn(
              `Failed to create role from data:`,
              roleData,
              roleError
            );
            // Continue with other roles
          }
        }
      }

      if (roles.length === 0) {
        throw new Error('No valid roles found in AI response');
      }

      return roles;
    } catch (error) {
      console.error('Error parsing AI role response:', error);
      throw new GameError(
        'AI_PARSE_ERROR',
        `Failed to parse AI role response: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private parseStructuredRoleText(content: string): any {
    // Fallback parser for structured text responses
    const roles: any[] = [];
    const lines = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    let currentRole: any = null;

    for (const line of lines) {
      if (line.toLowerCase().includes('role:') || line.match(/^\d+\./)) {
        if (currentRole) {
          roles.push(currentRole);
        }
        currentRole = {
          name: line
            .replace(/^\d+\./, '')
            .replace(/role:/i, '')
            .trim(),
          alignment: 'town', // default
          type: 'vanilla', // default
          description: '',
          abilities: [],
          restrictions: [],
          winCondition: 'Eliminate all threats to the town',
          flavorText: '',
          rarity: 'common',
          requiresMinPlayers: 4,
        };
      } else if (currentRole) {
        if (line.toLowerCase().includes('alignment:')) {
          const alignment = line
            .replace(/alignment:/i, '')
            .trim()
            .toLowerCase();
          if (['town', 'mafia', 'neutral', 'survivor'].includes(alignment)) {
            currentRole.alignment = alignment;
          }
        } else if (line.toLowerCase().includes('type:')) {
          const type = line.replace(/type:/i, '').trim().toLowerCase();
          if (
            [
              'investigative',
              'killing',
              'protective',
              'support',
              'power',
              'vanilla',
            ].includes(type)
          ) {
            currentRole.type = type;
          }
        } else if (line.toLowerCase().includes('description:')) {
          currentRole.description = line.replace(/description:/i, '').trim();
        } else if (line.toLowerCase().includes('win condition:')) {
          currentRole.winCondition = line.replace(/win condition:/i, '').trim();
        } else {
          // Add to description if not empty
          if (currentRole.description) {
            currentRole.description += ` ${line}`;
          } else {
            currentRole.description = line;
          }
        }
      }
    }

    if (currentRole) {
      roles.push(currentRole);
    }

    return { roles };
  }

  private createRoleDefinitionFromData(
    roleData: any,
    theme: string,
    difficulty: Difficulty
  ): RoleDefinition {
    return {
      id: `${theme}_${roleData.name?.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
      name: roleData.name || 'Unknown Role',
      alignment: roleData.alignment || 'town',
      type: roleData.type || 'vanilla',
      description: roleData.description || 'No description available',
      abilities: roleData.abilities || [],
      restrictions: roleData.restrictions || [],
      winCondition:
        roleData.winCondition || 'Eliminate all threats to your team',
      flavorText: roleData.flavorText || '',
      rarity: roleData.rarity || 'common',
      requiresMinPlayers: roleData.requiresMinPlayers || 4,
    };
  }

  private getFallbackRoles(
    playerCount: number,
    theme: string,
    difficulty: Difficulty
  ): RoleDefinition[] {
    // Provide basic fallback roles when AI generation fails
    const roles: RoleDefinition[] = [];

    // Calculate basic distribution
    const townCount = Math.ceil(playerCount * 0.6);
    const mafiaCount = Math.ceil(playerCount * 0.25);
    const neutralCount = playerCount - townCount - mafiaCount;

    // Add town roles
    for (let i = 0; i < townCount; i++) {
      if (i === 0) {
        roles.push(
          this.createBasicRole('Detective', 'town', 'investigative', theme)
        );
      } else if (i === 1 && townCount > 2) {
        roles.push(this.createBasicRole('Doctor', 'town', 'protective', theme));
      } else {
        roles.push(this.createBasicRole('Citizen', 'town', 'vanilla', theme));
      }
    }

    // Add mafia roles
    for (let i = 0; i < mafiaCount; i++) {
      if (i === 0) {
        roles.push(
          this.createBasicRole('Godfather', 'mafia', 'killing', theme)
        );
      } else {
        roles.push(
          this.createBasicRole('Mafia Member', 'mafia', 'vanilla', theme)
        );
      }
    }

    // Add neutral roles
    for (let i = 0; i < neutralCount; i++) {
      roles.push(
        this.createBasicRole('Serial Killer', 'neutral', 'killing', theme)
      );
    }

    return roles;
  }

  private createBasicRole(
    name: string,
    alignment: RoleAlignment,
    type: RoleType,
    theme: string
  ): RoleDefinition {
    return {
      id: `${theme}_${name.toLowerCase().replace(/\s+/g, '_')}_fallback`,
      name,
      alignment,
      type,
      description: `Basic ${name} role for ${theme} theme`,
      abilities: [],
      restrictions: [],
      winCondition:
        alignment === 'town'
          ? 'Eliminate all threats to the town'
          : alignment === 'mafia'
            ? 'Eliminate all town members and achieve majority'
            : 'Eliminate all other players',
      flavorText: `A ${name} in the ${theme} setting`,
      rarity: 'common',
      requiresMinPlayers: 4,
    };
  }

  private async generatePlayerPsychProfiles(
    players: Player[]
  ): Promise<Map<UUID, PlayerPsychProfile>> {
    const profiles = new Map<UUID, PlayerPsychProfile>();

    for (const player of players) {
      // Check if we have a cached profile
      const cachedProfile = await this.getCachedPlayerProfile(player.id);
      if (cachedProfile) {
        profiles.set(player.id, cachedProfile);
        continue;
      }

      // Generate new profile based on player history and preferences
      const profile: PlayerPsychProfile = {
        playerId: player.id,
        traits: {
          deductionSkill: Math.random(), // TODO: Calculate from game history
          bluffingAbility: Math.random(), // TODO: Calculate from game history
          socialInfluence: Math.random(), // TODO: Calculate from game history
          riskTolerance: Math.random(), // TODO: Calculate from game history
          teamworkPreference: Math.random(), // TODO: Calculate from game history
        },
        preferredRoleTypes: this.inferPreferredRoleTypes(player),
        preferredAlignments: this.inferPreferredAlignments(player),
        experienceLevel: this.inferExperienceLevel(player),
        playStyle: this.inferPlayStyle(player),
      };

      profiles.set(player.id, profile);

      // Cache the profile
      await this.cachePlayerProfile(profile);
    }

    return profiles;
  }

  private async getCachedPlayerProfile(
    playerId: UUID
  ): Promise<PlayerPsychProfile | null> {
    try {
      const cached = await kvService.get(`player_profile:${playerId}`);
      return cached || null;
    } catch (error) {
      console.warn('Failed to get cached player profile:', error);
      return null;
    }
  }

  private async cachePlayerProfile(profile: PlayerPsychProfile): Promise<void> {
    try {
      await kvService.set(`player_profile:${profile.playerId}`, profile, {
        ttlSeconds: 7 * 24 * 60 * 60, // 7 days
      });
    } catch (error) {
      console.warn('Failed to cache player profile:', error);
    }
  }

  private performIntelligentAssignment(
    players: Player[],
    roles: RoleDefinition[],
    psychProfiles: Map<UUID, PlayerPsychProfile>
  ): Array<{
    playerId: UUID;
    player: Player;
    role: RoleDefinition;
    reason: string;
    profile: PlayerPsychProfile;
    confidence: number;
  }> {
    const assignments: Array<{
      playerId: UUID;
      player: Player;
      role: RoleDefinition;
      reason: string;
      profile: PlayerPsychProfile;
      confidence: number;
    }> = [];
    const availableRoles = [...roles];
    const availablePlayers = [...players];

    // Sort roles by complexity/importance for better assignment
    availableRoles.sort((a, b) => {
      const aComplexity = this.getRoleComplexity(a);
      const bComplexity = this.getRoleComplexity(b);
      return bComplexity - aComplexity;
    });

    for (const role of availableRoles) {
      if (availablePlayers.length === 0) break;

      // Find the best player for this role
      let bestMatch: { player: Player; score: number; reason: string } | null =
        null;

      for (const player of availablePlayers) {
        const profile = psychProfiles.get(player.id);
        if (!profile) continue;

        const matchScore = this.calculateRolePlayerMatch(role, profile);
        const reason = this.generateAssignmentReason(role, profile, matchScore);

        if (!bestMatch || matchScore > bestMatch.score) {
          bestMatch = { player, score: matchScore, reason };
        }
      }

      if (bestMatch) {
        const profile = psychProfiles.get(bestMatch.player.id)!;
        assignments.push({
          playerId: bestMatch.player.id,
          player: bestMatch.player,
          role,
          reason: bestMatch.reason,
          profile,
          confidence: bestMatch.score,
        });

        // Remove assigned player from available list
        const playerIndex = availablePlayers.findIndex(
          p => p.id === bestMatch!.player.id
        );
        availablePlayers.splice(playerIndex, 1);
      }
    }

    return assignments;
  }

  private getRoleComplexity(role: RoleDefinition): number {
    let complexity = 0;

    // Base complexity by type
    switch (role.type) {
      case 'vanilla':
        complexity += 1;
        break;
      case 'support':
        complexity += 2;
        break;
      case 'protective':
        complexity += 3;
        break;
      case 'investigative':
        complexity += 4;
        break;
      case 'killing':
        complexity += 4;
        break;
      case 'power':
        complexity += 5;
        break;
    }

    // Add complexity for abilities
    complexity += role.abilities.length * 2;

    // Add complexity for restrictions
    complexity += role.restrictions.length;

    return complexity;
  }

  private calculateRolePlayerMatch(
    role: RoleDefinition,
    profile: PlayerPsychProfile
  ): number {
    let score = 0;

    // Check role type preference
    if (profile.preferredRoleTypes.includes(role.type)) {
      score += 0.3;
    }

    // Check alignment preference
    if (profile.preferredAlignments.includes(role.alignment)) {
      score += 0.2;
    }

    // Match traits to role requirements
    switch (role.type) {
      case 'investigative':
        score += profile.traits.deductionSkill * 0.4;
        break;
      case 'killing':
        score += profile.traits.bluffingAbility * 0.3;
        score += profile.traits.riskTolerance * 0.2;
        break;
      case 'protective':
        score += profile.traits.teamworkPreference * 0.3;
        break;
      case 'support':
        score += profile.traits.socialInfluence * 0.3;
        score += profile.traits.teamworkPreference * 0.2;
        break;
      case 'power':
        score += profile.traits.socialInfluence * 0.2;
        score += profile.traits.deductionSkill * 0.2;
        break;
    }

    // Experience level bonus for complex roles
    const roleComplexity = this.getRoleComplexity(role);
    if (
      roleComplexity > 5 &&
      ['expert', 'advanced'].includes(profile.experienceLevel)
    ) {
      score += 0.1;
    }
    if (roleComplexity <= 3 && profile.experienceLevel === 'beginner') {
      score += 0.1;
    }

    return Math.min(1.0, score);
  }

  private generateAssignmentReason(
    role: RoleDefinition,
    profile: PlayerPsychProfile,
    score: number
  ): string {
    const reasons: string[] = [];

    if (profile.preferredRoleTypes.includes(role.type)) {
      reasons.push(`enjoys ${role.type} roles`);
    }

    if (profile.preferredAlignments.includes(role.alignment)) {
      reasons.push(`prefers ${role.alignment} alignment`);
    }

    // Add trait-based reasons
    switch (role.type) {
      case 'investigative':
        if (profile.traits.deductionSkill > 0.6) {
          reasons.push('strong analytical skills');
        }
        break;
      case 'killing':
        if (profile.traits.bluffingAbility > 0.6) {
          reasons.push('good at deception');
        }
        break;
      case 'support':
        if (profile.traits.teamworkPreference > 0.6) {
          reasons.push('team-oriented player');
        }
        break;
    }

    if (reasons.length === 0) {
      reasons.push('balanced assignment for game balance');
    }

    return reasons.join(', ');
  }

  private generateSecretInformation(
    role: RoleDefinition,
    assignments: Array<{ role: RoleDefinition }>
  ): string[] {
    const secretInfo: string[] = [];

    // Add role-specific secret information
    switch (role.alignment) {
      case 'mafia':
        const mafiaMembers = assignments
          .filter(
            a => a.role.alignment === 'mafia' && a.role.name !== role.name
          )
          .map(a => a.role.name);
        if (mafiaMembers.length > 0) {
          secretInfo.push(
            `Your mafia partners are: ${mafiaMembers.join(', ')}`
          );
        }
        break;

      case 'town':
        if (role.type === 'investigative') {
          secretInfo.push(
            'You can investigate players to learn their alignment'
          );
        }
        break;
    }

    return secretInfo;
  }

  private findTeammates(
    role: RoleDefinition,
    assignments: Array<{ playerId: UUID; role: RoleDefinition }>
  ): UUID[] {
    if (role.alignment === 'mafia') {
      return assignments
        .filter(a => a.role.alignment === 'mafia' && a.role.id !== role.id)
        .map(a => a.playerId);
    }

    return [];
  }

  private createActiveAbilities(role: RoleDefinition): any[] {
    return role.abilities.map(ability => ({
      ability,
      remainingUses: this.calculateRemainingUses(ability),
      isBlocked: false,
      lastUsedRound: undefined,
    }));
  }

  private calculateRemainingUses(ability: RoleAbility): number {
    switch (ability.usageLimit.type) {
      case 'unlimited':
        return -1; // -1 indicates unlimited
      case 'per_game':
      case 'per_night':
      case 'per_day':
      case 'one_time':
        return ability.usageLimit.count || 1;
      default:
        return 1;
    }
  }

  private async generatePlayerObjectives(
    assignment: Assignment,
    allAssignments: Assignment[],
    theme: string
  ): Promise<Objective[]> {
    const objectives: Objective[] = [];
    const role = assignment.role.definition;

    // Generate basic objectives based on role
    const basicObjectives = this.generateBasicObjectives(
      assignment,
      allAssignments
    );
    objectives.push(...basicObjectives);

    // Generate advanced objectives using AI
    try {
      const advancedObjectives = await this.generateAIObjectives(
        assignment,
        allAssignments,
        theme
      );
      objectives.push(...advancedObjectives);
    } catch (error) {
      console.warn(
        'Failed to generate AI objectives, using basic objectives only'
      );
    }

    return objectives;
  }

  private generateBasicObjectives(
    assignment: Assignment,
    allAssignments: Assignment[]
  ): Objective[] {
    const objectives: Objective[] = [];
    const role = assignment.role.definition;

    // Primary objective based on alignment
    switch (role.alignment) {
      case 'town':
        objectives.push({
          id: `${assignment.playerId}_eliminate_mafia`,
          playerId: assignment.playerId,
          type: 'eliminate',
          description: 'Help eliminate all mafia members',
          targetAlignment: 'mafia',
          conditions: [
            {
              type: 'player_dead',
              target: 'mafia',
            },
          ],
          reward: 100,
          isHidden: false,
          difficulty: 'medium',
          priority: 'critical',
        });
        break;

      case 'mafia':
        objectives.push({
          id: `${assignment.playerId}_achieve_majority`,
          playerId: assignment.playerId,
          type: 'eliminate',
          description: 'Achieve mafia majority by eliminating town members',
          targetAlignment: 'town',
          conditions: [
            {
              type: 'player_alive',
              value: 'mafia_majority',
            },
          ],
          reward: 100,
          isHidden: false,
          difficulty: 'medium',
          priority: 'critical',
        });
        break;

      case 'neutral':
        objectives.push({
          id: `${assignment.playerId}_survive`,
          playerId: assignment.playerId,
          type: 'survive',
          description: 'Survive until the end of the game',
          conditions: [
            {
              type: 'player_alive',
              target: assignment.playerId,
            },
          ],
          reward: 80,
          isHidden: false,
          difficulty: 'hard',
          priority: 'high',
        });
        break;
    }

    return objectives;
  }

  private async generateAIObjectives(
    assignment: Assignment,
    allAssignments: Assignment[],
    theme: string
  ): Promise<Objective[]> {
    // TODO: Implement AI-generated dynamic objectives
    // This would use the AI service to create personalized objectives
    // based on the player's role, theme, and game state

    return [];
  }

  private getFallbackObjectives(assignments: Assignment[]): Objective[] {
    const objectives: Objective[] = [];

    for (const assignment of assignments) {
      const basicObjectives = this.generateBasicObjectives(
        assignment,
        assignments
      );
      objectives.push(...basicObjectives);
    }

    return objectives;
  }

  private countAlignments(
    roles: RoleDefinition[]
  ): Record<RoleAlignment, number> {
    return roles.reduce(
      (counts, role) => {
        counts[role.alignment] = (counts[role.alignment] || 0) + 1;
        return counts;
      },
      {} as Record<RoleAlignment, number>
    );
  }

  private calculateWinProbabilities(
    alignmentCounts: Record<RoleAlignment, number>,
    roles: RoleDefinition[]
  ): Record<RoleAlignment, number> {
    const total = Object.values(alignmentCounts).reduce(
      (sum, count) => sum + count,
      0
    );

    // Simplified win probability model
    // In practice, this would be much more sophisticated
    const townRatio = (alignmentCounts.town || 0) / total;
    const mafiaRatio = (alignmentCounts.mafia || 0) / total;

    // Base probabilities adjusted for typical game balance
    let townWinRate = 0.55; // Town typically has slight advantage
    let mafiaWinRate = 0.45;

    // Adjust based on ratio
    if (townRatio > 0.65) {
      townWinRate += (townRatio - 0.65) * 0.5;
      mafiaWinRate -= (townRatio - 0.65) * 0.5;
    } else if (mafiaRatio > 0.35) {
      mafiaWinRate += (mafiaRatio - 0.35) * 0.5;
      townWinRate -= (mafiaRatio - 0.35) * 0.5;
    }

    // Normalize to ensure sum is 1.0
    const totalWinRate = townWinRate + mafiaWinRate;
    townWinRate /= totalWinRate;
    mafiaWinRate /= totalWinRate;

    return {
      town: townWinRate,
      mafia: mafiaWinRate,
      neutral: (alignmentCounts.neutral || 0) > 0 ? 0.05 : 0,
      survivor: (alignmentCounts.survivor || 0) > 0 ? 0.03 : 0,
    };
  }

  private calculateBalanceScore(
    issues: BalanceIssue[],
    winProbabilities: Record<RoleAlignment, number>
  ): number {
    let score = 1.0;

    // Reduce score based on issues
    for (const issue of issues) {
      switch (issue.severity) {
        case 'low':
          score -= 0.05;
          break;
        case 'medium':
          score -= 0.15;
          break;
        case 'high':
          score -= 0.25;
          break;
        case 'critical':
          score -= 0.5;
          break;
      }
    }

    // Adjust score based on win probability balance
    const townWin = winProbabilities.town;
    const mafiaWin = winProbabilities.mafia;
    const imbalance = Math.abs(townWin - mafiaWin);

    if (imbalance > 0.2) {
      score -= imbalance * 0.5;
    }

    return Math.max(0, score);
  }

  private generateBalanceRecommendations(issues: BalanceIssue[]): string[] {
    const recommendations: string[] = [];

    for (const issue of issues) {
      if (issue.severity === 'high' || issue.severity === 'critical') {
        recommendations.push(issue.suggestedFix);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Role balance appears good');
    }

    return recommendations;
  }

  private calculateDistributionBalance(
    distribution: Record<RoleAlignment, number>,
    playerCount: number
  ): number {
    const townRatio = distribution.town / playerCount;
    const mafiaRatio = distribution.mafia / playerCount;

    // Ideal ratios
    const idealTownRatio = 0.6;
    const idealMafiaRatio = 0.25;

    const townDeviation = Math.abs(townRatio - idealTownRatio);
    const mafiaDeviation = Math.abs(mafiaRatio - idealMafiaRatio);

    // Score based on how close we are to ideal ratios
    const score = 1.0 - (townDeviation + mafiaDeviation);

    return Math.max(0, Math.min(1, score));
  }

  private inferDifficulty(
    distribution: Record<RoleAlignment, number>,
    specialRoles: string[]
  ): Difficulty {
    const complexityScore =
      specialRoles.length +
      (distribution.neutral || 0) +
      (distribution.survivor || 0);

    if (complexityScore <= 2) return 'easy';
    if (complexityScore <= 4) return 'medium';
    if (complexityScore <= 6) return 'hard';
    return 'expert';
  }

  private estimateGameLength(playerCount: number, gameMode: GameMode): number {
    // Base time estimates in minutes
    let baseTime = playerCount * 3; // 3 minutes per player base

    switch (gameMode) {
      case 'speed':
        baseTime *= 0.6;
        break;
      case 'newbie':
        baseTime *= 1.3;
        break;
      case 'detective':
        baseTime *= 1.4;
        break;
      case 'chaos':
        baseTime *= 1.2;
        break;
      case 'hardcore':
        baseTime *= 1.5;
        break;
    }

    return Math.round(baseTime);
  }

  private inferPreferredRoleTypes(player: Player): RoleType[] {
    // TODO: Analyze player's game history to determine preferences
    // For now, return a default mix
    return ['investigative', 'support'];
  }

  private inferPreferredAlignments(player: Player): RoleAlignment[] {
    // TODO: Analyze player's game history to determine preferences
    // For now, return a default mix
    return ['town', 'neutral'];
  }

  private inferExperienceLevel(
    player: Player
  ): PlayerPsychProfile['experienceLevel'] {
    // TODO: Calculate from actual game history
    return 'intermediate';
  }

  private inferPlayStyle(player: Player): PlayerPsychProfile['playStyle'] {
    // TODO: Calculate from actual game history and behavior patterns
    return 'analytical';
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const roleAssigner = RoleAssigner.getInstance();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

export const PlayerPsychProfileSchema = z.object({
  playerId: z.string(),
  traits: z.object({
    deductionSkill: z.number().min(0).max(1),
    bluffingAbility: z.number().min(0).max(1),
    socialInfluence: z.number().min(0).max(1),
    riskTolerance: z.number().min(0).max(1),
    teamworkPreference: z.number().min(0).max(1),
  }),
  preferredRoleTypes: z.array(
    z.enum([
      'investigative',
      'killing',
      'protective',
      'support',
      'power',
      'vanilla',
    ])
  ),
  preferredAlignments: z.array(
    z.enum(['town', 'mafia', 'neutral', 'survivor'])
  ),
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
  playStyle: z.enum([
    'aggressive',
    'conservative',
    'analytical',
    'social',
    'chaotic',
  ]),
});

export const AssignmentSchema = z.object({
  playerId: z.string(),
  player: z.any(), // Player schema would be imported
  role: z.any(), // AssignedRole schema would be imported
  assignmentReason: z.string(),
  psychologicalProfile: PlayerPsychProfileSchema,
  confidence: z.number().min(0).max(1),
});

export const ObjectiveSchema = z.object({
  id: z.string(),
  playerId: z.string(),
  type: z.enum([
    'eliminate',
    'survive',
    'discover',
    'protect',
    'convert',
    'complete_task',
  ]),
  description: z.string().min(1).max(500),
  targetRole: z.string().optional(),
  targetAlignment: z.enum(['town', 'mafia', 'neutral', 'survivor']).optional(),
  targetPlayer: z.string().optional(),
  conditions: z.array(z.any()),
  reward: z.number().int().min(0),
  isHidden: z.boolean(),
  difficulty: z.enum(['easy', 'medium', 'hard', 'expert']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
});
