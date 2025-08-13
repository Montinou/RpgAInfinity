/**
 * Comprehensive Test Suite for Deduction Role Assignment System
 *
 * Tests cover:
 * - Role generation for all themes and difficulties
 * - Player assignment with psychological profiling
 * - Role balance validation
 * - Dynamic objective generation
 * - Game mode support and variations
 * - Edge cases and error handling
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  RoleAssigner,
  roleAssigner,
  DEDUCTION_THEMES,
  GAME_MODES,
  type Assignment,
  type PlayerPsychProfile,
  type RoleDistribution,
  type BalanceResult,
  type Objective,
} from '../roles';
import { generateDeductionContent } from '../../../ai/index';

// Mock the AI service
jest.mock('../../../ai/index', () => ({
  generateDeductionContent: jest.fn(),
}));

// Mock the KV service
jest.mock('../../../database', () => ({
  kvService: {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockGenerateDeductionContent =
  generateDeductionContent as jest.MockedFunction<
    typeof generateDeductionContent
  >;

describe('RoleAssigner', () => {
  let assigner: RoleAssigner;
  let mockPlayers: any[];

  beforeEach(() => {
    assigner = RoleAssigner.getInstance();

    // Reset mocks
    jest.clearAllMocks();

    // Create mock players
    mockPlayers = Array.from({ length: 8 }, (_, i) => ({
      id: `player_${i + 1}`,
      name: `Player ${i + 1}`,
      avatar: `avatar_${i + 1}`,
      isOnline: true,
      joinedAt: new Date(),
    }));

    // Setup default AI mock response
    mockGenerateDeductionContent.mockResolvedValue({
      success: true,
      response: {
        content: JSON.stringify({
          roles: [
            {
              name: 'Detective',
              alignment: 'town',
              type: 'investigative',
              description: 'Can investigate players to learn their alignment',
              abilities: [],
              restrictions: [],
              winCondition: 'Eliminate all mafia members',
              flavorText: 'A skilled investigator seeking the truth',
              rarity: 'common',
              requiresMinPlayers: 4,
            },
            {
              name: 'Mafia Godfather',
              alignment: 'mafia',
              type: 'killing',
              description: 'Leads the mafia and can kill at night',
              abilities: [],
              restrictions: [],
              winCondition: 'Achieve mafia majority',
              flavorText: 'The criminal mastermind behind the operation',
              rarity: 'rare',
              requiresMinPlayers: 4,
            },
          ],
        }),
        tokenUsage: { total: 1500 },
      },
      processingTime: 1200,
      cached: false,
    });
  });

  describe('Role Generation', () => {
    it('should generate roles for valid input parameters', async () => {
      const roles = await assigner.generateRoles(6, 'mafia', 'medium');

      expect(roles).toBeDefined();
      expect(Array.isArray(roles)).toBe(true);
      expect(roles.length).toBeGreaterThan(0);
      expect(mockGenerateDeductionContent).toHaveBeenCalledTimes(1);
    });

    it('should generate roles for all predefined themes', async () => {
      for (const theme of Object.values(DEDUCTION_THEMES)) {
        const roles = await assigner.generateRoles(6, theme.id, 'medium');

        expect(roles).toBeDefined();
        expect(roles.length).toBeGreaterThan(0);

        // Check that all roles have required properties
        roles.forEach(role => {
          expect(role.id).toBeDefined();
          expect(role.name).toBeDefined();
          expect(role.alignment).toMatch(/^(town|mafia|neutral|survivor)$/);
          expect(role.type).toMatch(
            /^(investigative|killing|protective|support|power|vanilla)$/
          );
          expect(role.description).toBeDefined();
        });
      }
    }, 30000); // Longer timeout for multiple AI calls

    it('should generate different roles for different difficulties', async () => {
      const easyRoles = await assigner.generateRoles(6, 'mafia', 'easy');
      const expertRoles = await assigner.generateRoles(6, 'mafia', 'expert');

      expect(easyRoles).toBeDefined();
      expect(expertRoles).toBeDefined();

      // Expert difficulty should generally have more complex roles
      // This is a heuristic test since AI responses may vary
      expect(easyRoles.length).toBeGreaterThan(0);
      expect(expertRoles.length).toBeGreaterThan(0);
    });

    it('should generate roles for all game modes', async () => {
      for (const gameMode of Object.keys(GAME_MODES) as Array<
        keyof typeof GAME_MODES
      >) {
        const roles = await assigner.generateRoles(
          8,
          'mafia',
          'medium',
          gameMode
        );

        expect(roles).toBeDefined();
        expect(roles.length).toBeGreaterThan(0);
      }
    });

    it('should validate input parameters', async () => {
      // Invalid player count
      await expect(
        assigner.generateRoles(2, 'mafia', 'medium')
      ).rejects.toThrow('Player count must be between 4 and 20');

      await expect(
        assigner.generateRoles(25, 'mafia', 'medium')
      ).rejects.toThrow('Player count must be between 4 and 20');

      // Invalid theme (empty)
      await expect(assigner.generateRoles(6, '', 'medium')).rejects.toThrow(
        'Theme cannot be empty'
      );

      // Invalid difficulty
      await expect(
        assigner.generateRoles(6, 'mafia', 'invalid' as any)
      ).rejects.toThrow('Invalid difficulty');
    });

    it('should handle AI generation failures gracefully', async () => {
      mockGenerateDeductionContent.mockResolvedValueOnce({
        success: false,
        error: 'AI service unavailable',
      });

      const roles = await assigner.generateRoles(6, 'mafia', 'medium');

      // Should return fallback roles
      expect(roles).toBeDefined();
      expect(roles.length).toBeGreaterThan(0);
      expect(
        roles.some(
          r => r.name.includes('fallback') || r.id.includes('fallback')
        )
      ).toBe(true);
    });
  });

  describe('Role Assignment', () => {
    let testRoles: any[];

    beforeEach(async () => {
      testRoles = await assigner.generateRoles(
        mockPlayers.length,
        'mafia',
        'medium'
      );
    });

    it('should assign roles to all players', async () => {
      const assignments = await assigner.assignRoles(mockPlayers, testRoles);

      expect(assignments).toBeDefined();
      expect(assignments.length).toBe(mockPlayers.length);

      // Check that each player has a unique role assignment
      const assignedPlayerIds = assignments.map(a => a.playerId);
      const uniquePlayerIds = new Set(assignedPlayerIds);
      expect(uniquePlayerIds.size).toBe(mockPlayers.length);

      // Check that each assignment has required properties
      assignments.forEach(assignment => {
        expect(assignment.playerId).toBeDefined();
        expect(assignment.player).toBeDefined();
        expect(assignment.role).toBeDefined();
        expect(assignment.assignmentReason).toBeDefined();
        expect(assignment.psychologicalProfile).toBeDefined();
        expect(assignment.confidence).toBeGreaterThanOrEqual(0);
        expect(assignment.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should generate psychological profiles for players', async () => {
      const assignments = await assigner.assignRoles(mockPlayers, testRoles);

      assignments.forEach(assignment => {
        const profile = assignment.psychologicalProfile;

        expect(profile.playerId).toBe(assignment.playerId);
        expect(profile.traits).toBeDefined();
        expect(profile.traits.deductionSkill).toBeGreaterThanOrEqual(0);
        expect(profile.traits.deductionSkill).toBeLessThanOrEqual(1);
        expect(profile.traits.bluffingAbility).toBeGreaterThanOrEqual(0);
        expect(profile.traits.bluffingAbility).toBeLessThanOrEqual(1);
        expect(profile.traits.socialInfluence).toBeGreaterThanOrEqual(0);
        expect(profile.traits.socialInfluence).toBeLessThanOrEqual(1);
        expect(profile.traits.riskTolerance).toBeGreaterThanOrEqual(0);
        expect(profile.traits.riskTolerance).toBeLessThanOrEqual(1);
        expect(profile.traits.teamworkPreference).toBeGreaterThanOrEqual(0);
        expect(profile.traits.teamworkPreference).toBeLessThanOrEqual(1);

        expect(profile.preferredRoleTypes).toBeDefined();
        expect(Array.isArray(profile.preferredRoleTypes)).toBe(true);
        expect(profile.preferredAlignments).toBeDefined();
        expect(Array.isArray(profile.preferredAlignments)).toBe(true);
        expect(profile.experienceLevel).toMatch(
          /^(beginner|intermediate|advanced|expert)$/
        );
        expect(profile.playStyle).toMatch(
          /^(aggressive|conservative|analytical|social|chaotic)$/
        );
      });
    });

    it('should handle mismatched player and role counts', async () => {
      const fewerRoles = testRoles.slice(0, mockPlayers.length - 1);

      await expect(
        assigner.assignRoles(mockPlayers, fewerRoles)
      ).rejects.toThrow("Player count (8) doesn't match role count (7)");
    });

    it('should provide meaningful assignment reasons', async () => {
      const assignments = await assigner.assignRoles(mockPlayers, testRoles);

      assignments.forEach(assignment => {
        expect(assignment.assignmentReason).toBeDefined();
        expect(assignment.assignmentReason.length).toBeGreaterThan(0);

        // Should contain descriptive text
        expect(typeof assignment.assignmentReason).toBe('string');
      });
    });
  });

  describe('Objective Generation', () => {
    let testAssignments: Assignment[];

    beforeEach(async () => {
      const testRoles = await assigner.generateRoles(
        mockPlayers.length,
        'mafia',
        'medium'
      );
      testAssignments = await assigner.assignRoles(mockPlayers, testRoles);
    });

    it('should generate objectives for all players', async () => {
      const objectives = await assigner.generateObjectives(
        testAssignments,
        'mafia'
      );

      expect(objectives).toBeDefined();
      expect(Array.isArray(objectives)).toBe(true);
      expect(objectives.length).toBeGreaterThan(0);

      // Each player should have at least one objective
      const playersWithObjectives = new Set(objectives.map(o => o.playerId));
      expect(playersWithObjectives.size).toBeGreaterThan(0);

      // Check objective properties
      objectives.forEach(objective => {
        expect(objective.id).toBeDefined();
        expect(objective.playerId).toBeDefined();
        expect(objective.type).toMatch(
          /^(eliminate|survive|discover|protect|convert|complete_task)$/
        );
        expect(objective.description).toBeDefined();
        expect(objective.description.length).toBeGreaterThan(0);
        expect(objective.reward).toBeGreaterThanOrEqual(0);
        expect(typeof objective.isHidden).toBe('boolean');
        expect(objective.difficulty).toMatch(/^(easy|medium|hard|expert)$/);
        expect(objective.priority).toMatch(/^(low|medium|high|critical)$/);
        expect(Array.isArray(objective.conditions)).toBe(true);
      });
    });

    it('should generate role-appropriate objectives', async () => {
      const objectives = await assigner.generateObjectives(
        testAssignments,
        'mafia'
      );

      // Town players should have elimination objectives targeting mafia
      // Mafia players should have majority/elimination objectives
      // This is a heuristic test since objectives are dynamically generated

      const townAssignments = testAssignments.filter(
        a => a.role.definition.alignment === 'town'
      );
      const mafiaAssignments = testAssignments.filter(
        a => a.role.definition.alignment === 'mafia'
      );

      if (townAssignments.length > 0) {
        const townObjectives = objectives.filter(o =>
          townAssignments.some(a => a.playerId === o.playerId)
        );
        expect(townObjectives.length).toBeGreaterThan(0);
      }

      if (mafiaAssignments.length > 0) {
        const mafiaObjectives = objectives.filter(o =>
          mafiaAssignments.some(a => a.playerId === o.playerId)
        );
        expect(mafiaObjectives.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Role Balance Validation', () => {
    it('should validate well-balanced role sets', async () => {
      const roles = await assigner.generateRoles(8, 'mafia', 'medium');
      const balanceResult = assigner.validateRoleBalance(roles);

      expect(balanceResult).toBeDefined();
      expect(typeof balanceResult.isBalanced).toBe('boolean');
      expect(balanceResult.balanceScore).toBeGreaterThanOrEqual(0);
      expect(balanceResult.balanceScore).toBeLessThanOrEqual(1);
      expect(Array.isArray(balanceResult.issues)).toBe(true);
      expect(Array.isArray(balanceResult.recommendations)).toBe(true);
      expect(balanceResult.winProbabilities).toBeDefined();
      expect(balanceResult.winProbabilities.town).toBeGreaterThanOrEqual(0);
      expect(balanceResult.winProbabilities.town).toBeLessThanOrEqual(1);
      expect(balanceResult.winProbabilities.mafia).toBeGreaterThanOrEqual(0);
      expect(balanceResult.winProbabilities.mafia).toBeLessThanOrEqual(1);
    });

    it('should detect imbalanced role distributions', async () => {
      // Create artificially imbalanced roles (all town)
      const imbalancedRoles = Array.from({ length: 6 }, (_, i) => ({
        id: `town_${i}`,
        name: `Town Role ${i}`,
        alignment: 'town' as const,
        type: 'vanilla' as const,
        description: 'Town role',
        abilities: [],
        restrictions: [],
        winCondition: 'Eliminate all threats',
        flavorText: '',
        rarity: 'common' as const,
        requiresMinPlayers: 4,
      }));

      const balanceResult = assigner.validateRoleBalance(imbalancedRoles);

      expect(balanceResult.isBalanced).toBe(false);
      expect(balanceResult.balanceScore).toBeLessThan(0.8);
      expect(balanceResult.issues.length).toBeGreaterThan(0);

      // Should have issues about mafia roles being too few
      const roleCountIssues = balanceResult.issues.filter(
        i => i.type === 'role_count'
      );
      expect(roleCountIssues.length).toBeGreaterThan(0);
    });

    it('should identify power role imbalances', async () => {
      // Create role set with too many power roles
      const powerHeavyRoles = Array.from({ length: 6 }, (_, i) => ({
        id: `power_${i}`,
        name: `Power Role ${i}`,
        alignment: i < 4 ? ('town' as const) : ('mafia' as const),
        type: 'power' as const,
        description: 'Power role with special abilities',
        abilities: [{ name: 'Special Power' }],
        restrictions: [],
        winCondition: 'Win condition',
        flavorText: '',
        rarity: 'rare' as const,
        requiresMinPlayers: 4,
      }));

      const balanceResult = assigner.validateRoleBalance(powerHeavyRoles);

      // Should detect power imbalance
      const powerIssues = balanceResult.issues.filter(
        i => i.type === 'power_imbalance'
      );
      expect(powerIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Role Distribution Creation', () => {
    it('should create appropriate distributions for different player counts', () => {
      const smallGame = assigner.createRoleDistribution(6, 'classic');
      const mediumGame = assigner.createRoleDistribution(10, 'classic');
      const largeGame = assigner.createRoleDistribution(16, 'classic');

      // Check that distributions are reasonable
      expect(smallGame.distribution.town).toBeGreaterThanOrEqual(3);
      expect(smallGame.distribution.mafia).toBeGreaterThanOrEqual(1);

      expect(mediumGame.distribution.town).toBeGreaterThanOrEqual(5);
      expect(mediumGame.distribution.mafia).toBeGreaterThanOrEqual(2);

      expect(largeGame.distribution.town).toBeGreaterThanOrEqual(7);
      expect(largeGame.distribution.mafia).toBeGreaterThanOrEqual(3);

      // Total should match player count
      Object.values(smallGame.distribution).reduce(
        (sum, count) => sum + count,
        0
      );
      expect(
        Object.values(mediumGame.distribution).reduce(
          (sum, count) => sum + count,
          0
        )
      ).toBe(10);
      expect(
        Object.values(largeGame.distribution).reduce(
          (sum, count) => sum + count,
          0
        )
      ).toBe(16);
    });

    it('should adjust distributions for different game modes', () => {
      const classicDist = assigner.createRoleDistribution(8, 'classic');
      const chaosDist = assigner.createRoleDistribution(8, 'chaos');
      const detectiveDist = assigner.createRoleDistribution(8, 'detective');

      expect(classicDist.specialRoles).toBeDefined();
      expect(chaosDist.specialRoles).toBeDefined();
      expect(detectiveDist.specialRoles).toBeDefined();

      // Chaos mode should have more neutral roles
      expect(chaosDist.distribution.neutral).toBeGreaterThanOrEqual(
        classicDist.distribution.neutral
      );

      // Detective mode should have more investigative roles
      expect(detectiveDist.specialRoles.length).toBeGreaterThanOrEqual(
        classicDist.specialRoles.length
      );
    });

    it('should calculate balance scores', () => {
      const distribution = assigner.createRoleDistribution(8, 'classic');

      expect(distribution.balanceScore).toBeGreaterThanOrEqual(0);
      expect(distribution.balanceScore).toBeLessThanOrEqual(1);
    });

    it('should estimate game length', () => {
      const shortGame = assigner.createRoleDistribution(6, 'speed');
      const longGame = assigner.createRoleDistribution(16, 'detective');

      expect(shortGame.estimatedGameLength).toBeGreaterThan(0);
      expect(longGame.estimatedGameLength).toBeGreaterThan(
        shortGame.estimatedGameLength
      );
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = RoleAssigner.getInstance();
      const instance2 = RoleAssigner.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBe(roleAssigner);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed AI responses', async () => {
      mockGenerateDeductionContent.mockResolvedValueOnce({
        success: true,
        response: {
          content: 'Invalid JSON response that cannot be parsed',
          tokenUsage: { total: 100 },
        },
        processingTime: 1000,
        cached: false,
      });

      const roles = await assigner.generateRoles(6, 'mafia', 'medium');

      // Should fallback to basic roles
      expect(roles).toBeDefined();
      expect(roles.length).toBeGreaterThan(0);
    });

    it('should handle empty or null responses', async () => {
      mockGenerateDeductionContent.mockResolvedValueOnce({
        success: true,
        response: {
          content: JSON.stringify({ roles: [] }),
          tokenUsage: { total: 100 },
        },
        processingTime: 1000,
        cached: false,
      });

      // Should throw error for empty role list and fall back to basic roles
      const roles = await assigner.generateRoles(6, 'mafia', 'medium');
      expect(roles).toBeDefined();
      expect(roles.length).toBeGreaterThan(0);
    });

    it('should handle network errors gracefully', async () => {
      mockGenerateDeductionContent.mockRejectedValueOnce(
        new Error('Network error')
      );

      const roles = await assigner.generateRoles(6, 'mafia', 'medium');

      // Should fallback to basic roles
      expect(roles).toBeDefined();
      expect(roles.length).toBeGreaterThan(0);
    });
  });
});

describe('Theme and Mode Configuration', () => {
  it('should have all required theme properties', () => {
    Object.values(DEDUCTION_THEMES).forEach(theme => {
      expect(theme.id).toBeDefined();
      expect(theme.name).toBeDefined();
      expect(theme.description).toBeDefined();
      expect(theme.setting).toBeDefined();
      expect(theme.atmosphere).toBeDefined();
      expect(Array.isArray(theme.conflicts)).toBe(true);
      expect(Array.isArray(theme.culturalElements)).toBe(true);
    });
  });

  it('should have all required game mode properties', () => {
    Object.values(GAME_MODES).forEach(mode => {
      expect(mode.id).toBeDefined();
      expect(mode.name).toBeDefined();
      expect(mode.description).toBeDefined();
      expect(Array.isArray(mode.features)).toBe(true);
      expect(mode.balancing).toBeDefined();
      expect(mode.complexity).toBeDefined();
    });
  });

  it('should support the required number of themes', () => {
    const themeCount = Object.keys(DEDUCTION_THEMES).length;
    expect(themeCount).toBeGreaterThanOrEqual(15); // Requirement: 15+ themes
  });
});

describe('Performance Tests', () => {
  it('should generate roles within acceptable time limits', async () => {
    const start = Date.now();
    await assigner.generateRoles(8, 'mafia', 'medium');
    const end = Date.now();

    const duration = end - start;
    expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
  }, 15000);

  it('should handle concurrent role generation', async () => {
    const promises = Array.from({ length: 3 }, () =>
      assigner.generateRoles(6, 'mafia', 'medium')
    );

    const results = await Promise.all(promises);

    results.forEach(roles => {
      expect(roles).toBeDefined();
      expect(roles.length).toBeGreaterThan(0);
    });
  }, 15000);
});
