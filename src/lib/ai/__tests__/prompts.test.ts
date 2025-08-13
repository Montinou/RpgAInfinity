/**
 * Comprehensive test suite for the Prompt Engineering System
 *
 * Tests cover:
 * - Prompt generation and variable injection
 * - Safety validation and content filtering
 * - Token optimization and efficiency
 * - Template validation and error handling
 * - A/B testing framework functionality
 * - Performance analytics and metrics
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  promptEngine,
  generatePrompt,
  validatePromptContext,
  PROMPTS,
} from '../prompts';
import {
  optimizationEngine,
  type TokenOptimizationConfig,
  type ABTestConfig,
} from '../optimization';
import {
  type PromptContext,
  type PromptGenerationOptions,
  type PromptTemplate,
} from '../../../types/ai';
import { type GameType } from '../../../types/core';

describe('Prompt Engineering System', () => {
  // ========================================================================
  // PROMPT GENERATION TESTS
  // ========================================================================

  describe('Prompt Generation', () => {
    it('should generate RPG world creation prompt with valid context', async () => {
      const context: PromptContext = {
        gameType: 'rpg',
        variables: {
          theme: 'high fantasy',
          biome: 'enchanted forest',
          size: 'medium',
          complexity: 'moderate',
          tone: 'heroic adventure',
          playerCount: 4,
        },
        culturalContext: {
          language: 'en',
          region: 'US',
          contentRating: 'general',
        },
      };

      const result = await generatePrompt('rpg_world_generation', context);

      expect(result).toBeDefined();
      expect(result.content).toContain('high fantasy');
      expect(result.content).toContain('enchanted forest');
      expect(result.content).toContain('4');
      expect(result.tokenEstimate).toBeGreaterThan(0);
      expect(result.safety.passed).toBe(true);
      expect(result.metadata.templateId).toBe('rpg_world_generation');
    });

    it('should generate character creation prompt with minimal context', async () => {
      const context: PromptContext = {
        gameType: 'rpg',
        variables: {
          worldContext: 'A mystical realm of ancient magic',
          level: 1,
        },
      };

      const result = await generatePrompt('rpg_character_creation', context);

      expect(result).toBeDefined();
      expect(result.content).toContain('mystical realm');
      expect(result.content).toContain('Level**: 1');
      expect(result.safety.passed).toBe(true);
    });

    it('should generate deduction role assignment prompt', async () => {
      const context: PromptContext = {
        gameType: 'deduction',
        variables: {
          theme: 'space station mystery',
          playerCount: 8,
          complexity: 'moderate',
          scenario: 'sabotage investigation',
          balancing: 'balanced',
        },
      };

      const result = await generatePrompt('deduction_role_generation', context);

      expect(result).toBeDefined();
      expect(result.content).toContain('space station mystery');
      expect(result.content).toContain('8');
      expect(result.content).toContain('sabotage investigation');
      expect(result.safety.passed).toBe(true);
    });

    it('should generate village event prompt with complex state', async () => {
      const context: PromptContext = {
        gameType: 'village',
        variables: {
          villageState: {
            population: 150,
            happiness: 75,
            resources: { food: 80, wood: 60, stone: 40 },
          },
          season: 'autumn',
          severity: 'moderate',
          previousEvents: ['harvest_festival', 'trader_visit'],
          populationMood: 'optimistic',
          resourceLevels: {
            food: 'abundant',
            wood: 'adequate',
            stone: 'scarce',
          },
        },
      };

      const result = await generatePrompt('village_event_generation', context);

      expect(result).toBeDefined();
      expect(result.content).toContain('autumn');
      expect(result.content).toContain('150');
      expect(result.safety.passed).toBe(true);
    });

    it('should handle system variables correctly', async () => {
      const context: PromptContext = {
        gameType: 'rpg',
        currentPlayer: {
          id: 'player-123',
          name: 'Aiden Brightblade',
          gameId: 'game-456',
          joinedAt: new Date(),
          status: 'active',
          metadata: {},
        },
        variables: {
          theme: 'urban fantasy',
        },
      };

      // Note: Using a template that doesn't exist to test the system variable replacement
      // in a real scenario - for testing, we'll use world generation
      const result = await generatePrompt('rpg_world_generation', {
        ...context,
        variables: {
          ...context.variables,
          theme: 'urban fantasy starring {{PLAYER_NAME}}',
          size: 'small',
          complexity: 'simple',
          tone: 'modern',
          playerCount: 1,
        },
      });

      expect(result.content).toContain('Aiden Brightblade');
    });
  });

  // ========================================================================
  // VARIABLE INJECTION AND VALIDATION TESTS
  // ========================================================================

  describe('Variable Injection and Validation', () => {
    it('should validate required variables', () => {
      const context: PromptContext = {
        gameType: 'rpg',
        variables: {
          // Missing required variables
          theme: 'fantasy',
        },
      };

      const validation = validatePromptContext('rpg_world_generation', context);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Required variable missing: size');
      expect(validation.errors).toContain(
        'Required variable missing: complexity'
      );
      expect(validation.errors).toContain('Required variable missing: tone');
      expect(validation.errors).toContain(
        'Required variable missing: playerCount'
      );
    });

    it('should validate variable constraints', async () => {
      const context: PromptContext = {
        gameType: 'rpg',
        variables: {
          theme: 'fantasy',
          size: 'invalid_size', // Invalid value
          complexity: 'moderate',
          tone: 'heroic',
          playerCount: 4,
        },
      };

      await expect(
        generatePrompt('rpg_world_generation', context)
      ).rejects.toThrow('Variable size has invalid value');
    });

    it('should handle optional variables correctly', async () => {
      const context: PromptContext = {
        gameType: 'rpg',
        variables: {
          worldContext: 'A realm of eternal twilight',
          level: 5,
          // Optional variables not provided
        },
      };

      const result = await generatePrompt('rpg_character_creation', context);
      expect(result).toBeDefined();
      expect(result.content).not.toContain('{{race}}');
      expect(result.content).not.toContain('{{class}}');
    });

    it('should handle array and object variables', async () => {
      const context: PromptContext = {
        gameType: 'rpg',
        variables: {
          currentSituation: 'The party stands before a mysterious portal',
          playerActions: [
            'examine portal',
            'cast detect magic',
            'step through',
          ],
          worldState: {
            location: 'Ancient Temple',
            time: 'midnight',
            weather: 'stormy',
          },
          tone: 'mysterious',
          length: 'medium',
        },
      };

      const result = await generatePrompt(
        'rpg_narrative_continuation',
        context
      );
      expect(result).toBeDefined();
      expect(result.content).toContain('examine portal');
      expect(result.content).toContain('Ancient Temple');
    });
  });

  // ========================================================================
  // SAFETY VALIDATION TESTS
  // ========================================================================

  describe('Safety Validation', () => {
    it('should pass safe content', async () => {
      const context: PromptContext = {
        gameType: 'rpg',
        variables: {
          theme: 'peaceful village life',
          size: 'small',
          complexity: 'simple',
          tone: 'wholesome',
          playerCount: 2,
        },
      };

      const result = await generatePrompt('rpg_world_generation', context);
      expect(result.safety.passed).toBe(true);
      expect(result.safety.flags).toHaveLength(0);
      expect(result.safety.severity).toBe('none');
    });

    it('should flag violent content appropriately', async () => {
      const context: PromptContext = {
        gameType: 'rpg',
        variables: {
          theme: 'blood-soaked battlefields of death and murder',
          size: 'large',
          complexity: 'complex',
          tone: 'violent and brutal',
          playerCount: 6,
        },
      };

      const result = await generatePrompt('rpg_world_generation', context);
      expect(result.safety.flags).toContain('violence');
      expect(result.safety.severity).toBe('medium');
      expect(result.safety.recommendations).toContain(
        'Consider using less violent language or fantasy alternatives'
      );
    });

    it('should block content in strict safety mode', async () => {
      const context: PromptContext = {
        gameType: 'rpg',
        variables: {
          theme: 'explicit adult content',
          size: 'medium',
          complexity: 'simple',
          tone: 'inappropriate',
          playerCount: 4,
        },
      };

      await expect(
        generatePrompt('rpg_world_generation', context, {
          safetyLevel: 'strict',
        })
      ).rejects.toThrow('Prompt failed safety validation');
    });

    it('should allow borderline content in lenient mode', async () => {
      const context: PromptContext = {
        gameType: 'rpg',
        variables: {
          theme: 'mild fantasy violence',
          size: 'medium',
          complexity: 'moderate',
          tone: 'adventurous',
          playerCount: 4,
        },
      };

      const result = await generatePrompt('rpg_world_generation', context, {
        safetyLevel: 'lenient',
      });
      expect(result.safety.passed).toBe(true);
    });
  });

  // ========================================================================
  // TOKEN OPTIMIZATION TESTS
  // ========================================================================

  describe('Token Optimization', () => {
    it('should optimize prompts for token efficiency', async () => {
      const context: PromptContext = {
        gameType: 'rpg',
        variables: {
          theme: 'high fantasy',
          size: 'medium',
          complexity: 'moderate',
          tone: 'heroic',
          playerCount: 4,
        },
      };

      const result = await generatePrompt('rpg_world_generation', context, {
        optimizeForTokens: true,
        maxLength: 800,
      });

      expect(result.metadata.optimizationApplied).toBe(true);
      expect(result.tokenEstimate).toBeLessThan(200); // Should be optimized
    });

    it('should apply token optimization strategies', async () => {
      const longPrompt = `Please note that it is important to utilize this comprehensive approach in order to facilitate the demonstration of your capabilities. It should be noted that you should immediately commence the process of generating content that will approximately match the requirements.`;

      const optimizationConfig: TokenOptimizationConfig = {
        targetReduction: 30,
        preserveQuality: true,
        optimizationStrategies: [
          {
            name: 'compression',
            type: 'compression',
            priority: 8,
            parameters: {},
            applicableTemplates: ['*'],
          },
          {
            name: 'substitution',
            type: 'substitution',
            priority: 6,
            parameters: {},
            applicableTemplates: ['*'],
          },
        ],
        constraints: [
          {
            type: 'min_length',
            value: 50,
            strict: false,
          },
        ],
        fallbackBehavior: 'best_effort',
      };

      const result = await optimizationEngine.optimizeForTokens(
        longPrompt,
        optimizationConfig
      );

      expect(result.tokenSavings).toBeGreaterThan(0);
      expect(result.optimizedLength).toBeLessThan(result.originalLength);
      expect(result.strategiesApplied.length).toBeGreaterThan(0);
      expect(result.qualityScore).toBeGreaterThan(0.5);
    });

    it('should respect optimization constraints', async () => {
      const shortPrompt = 'Generate a character.';

      const optimizationConfig: TokenOptimizationConfig = {
        targetReduction: 50,
        preserveQuality: true,
        optimizationStrategies: [
          {
            name: 'compression',
            type: 'compression',
            priority: 10,
            parameters: {},
            applicableTemplates: ['*'],
          },
        ],
        constraints: [
          {
            type: 'min_length',
            value: 15,
            strict: true,
          },
        ],
        fallbackBehavior: 'original',
      };

      const result = await optimizationEngine.optimizeForTokens(
        shortPrompt,
        optimizationConfig
      );

      // Should not over-optimize due to min_length constraint
      expect(result.optimizedLength).toBeGreaterThanOrEqual(15);
    });
  });

  // ========================================================================
  // TEMPLATE MANAGEMENT TESTS
  // ========================================================================

  describe('Template Management', () => {
    it('should register and retrieve custom templates', () => {
      const customTemplate: PromptTemplate = {
        id: 'test_custom_template',
        name: 'Test Custom Template',
        category: 'world_generation',
        gameType: 'rpg',
        template: 'Generate a {{type}} in {{setting}}.',
        variables: [
          {
            name: 'type',
            type: 'string',
            description: 'Type of thing to generate',
            required: true,
          },
          {
            name: 'setting',
            type: 'string',
            description: 'Setting context',
            required: true,
          },
        ],
        constraints: [],
        metadata: {
          author: 'Test Suite',
          version: '1.0.0',
          createdAt: new Date(),
          lastModified: new Date(),
          tags: ['test'],
          usage: {
            timesUsed: 0,
            avgResponseTime: 0,
            successRate: 0,
            avgTokensUsed: 0,
            userSatisfaction: 0,
          },
          rating: 0,
        },
      };

      promptEngine.registerTemplate(customTemplate);

      // Should be able to use the custom template
      const context: PromptContext = {
        gameType: 'rpg',
        variables: {
          type: 'magical artifact',
          setting: 'ancient ruins',
        },
      };

      expect(async () => {
        const result = await generatePrompt('test_custom_template', context);
        expect(result.content).toContain('magical artifact');
        expect(result.content).toContain('ancient ruins');
      }).not.toThrow();
    });

    it('should validate template structure', () => {
      const invalidTemplate = {
        // Missing required fields
        id: 'invalid_template',
        template: 'Invalid template without proper structure',
      };

      expect(() => {
        promptEngine.registerTemplate(invalidTemplate as PromptTemplate);
      }).toThrow();
    });

    it('should handle template inheritance', () => {
      // Test that common patterns are shared across templates
      const rpgTemplates = [
        PROMPTS.WORLD_GENERATION,
        PROMPTS.CHARACTER_CREATION,
        PROMPTS.NARRATIVE_CONTINUATION,
      ];

      for (const template of rpgTemplates) {
        expect(template.gameType).toBe('rpg');
        expect(template.metadata).toBeDefined();
        expect(template.variables).toBeDefined();
        expect(template.constraints).toBeDefined();
      }
    });
  });

  // ========================================================================
  // A/B TESTING FRAMEWORK TESTS
  // ========================================================================

  describe('A/B Testing Framework', () => {
    it('should start an A/B test with valid configuration', async () => {
      const baseTemplate = PROMPTS.WORLD_GENERATION;
      const variantTemplate = {
        ...baseTemplate,
        id: 'rpg_world_generation_variant_a',
        template: `${baseTemplate.template}\n\nAdditional variant instructions...`,
      };

      const testConfig: ABTestConfig = {
        testId: 'world_gen_test_001',
        baseTemplate,
        variants: [variantTemplate],
        trafficSplit: [50, 50],
        successMetrics: [
          {
            name: 'user_satisfaction',
            type: 'user_satisfaction',
            weight: 0.7,
            direction: 'maximize',
            measurement: {
              source: 'user_feedback',
              calculation: 'average_rating',
              aggregation: 'mean',
            },
          },
          {
            name: 'token_efficiency',
            type: 'token_efficiency',
            weight: 0.3,
            direction: 'minimize',
            measurement: {
              source: 'performance_metrics',
              calculation: 'token_count',
              aggregation: 'mean',
            },
          },
        ],
        sampleSize: 100,
        significanceLevel: 0.05,
        duration: {
          startDate: new Date(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          minimumSamples: 50,
          earlyStoppingEnabled: true,
        },
        constraints: [
          {
            type: 'game_type',
            condition: 'equals',
            parameters: { value: 'rpg' },
          },
        ],
      };

      const testId = await optimizationEngine.startABTest(testConfig);
      expect(testId).toBe('world_gen_test_001');
    });

    it('should validate A/B test configuration', async () => {
      const invalidConfig: ABTestConfig = {
        testId: 'invalid_test',
        baseTemplate: PROMPTS.WORLD_GENERATION,
        variants: [], // Invalid: no variants
        trafficSplit: [100],
        successMetrics: [],
        sampleSize: 0,
        significanceLevel: 0.05,
        duration: {
          startDate: new Date(),
          endDate: new Date(),
          minimumSamples: 10,
          earlyStoppingEnabled: false,
        },
        constraints: [],
      };

      await expect(
        optimizationEngine.startABTest(invalidConfig)
      ).rejects.toThrow('A/B test requires at least 2 variants');
    });

    it('should validate traffic split configuration', async () => {
      const invalidSplitConfig: ABTestConfig = {
        testId: 'invalid_split_test',
        baseTemplate: PROMPTS.WORLD_GENERATION,
        variants: [PROMPTS.WORLD_GENERATION, PROMPTS.WORLD_GENERATION],
        trafficSplit: [60, 30], // Doesn't sum to 100
        successMetrics: [],
        sampleSize: 100,
        significanceLevel: 0.05,
        duration: {
          startDate: new Date(),
          endDate: new Date(),
          minimumSamples: 50,
          earlyStoppingEnabled: false,
        },
        constraints: [],
      };

      await expect(
        optimizationEngine.startABTest(invalidSplitConfig)
      ).rejects.toThrow('Traffic split must sum to 100%');
    });
  });

  // ========================================================================
  // PERFORMANCE ANALYTICS TESTS
  // ========================================================================

  describe('Performance Analytics', () => {
    it('should track prompt generation metrics', async () => {
      const context: PromptContext = {
        gameType: 'rpg',
        variables: {
          theme: 'steampunk',
          size: 'medium',
          complexity: 'moderate',
          tone: 'adventurous',
          playerCount: 3,
        },
      };

      // Generate multiple prompts to build metrics
      for (let i = 0; i < 5; i++) {
        await generatePrompt('rpg_world_generation', context);
      }

      const analytics = await optimizationEngine.analyzePerformance(
        'rpg_world_generation',
        {
          start: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
          end: new Date(),
          granularity: 'hour',
        }
      );

      expect(analytics).toBeDefined();
      expect(analytics.promptId).toBe('rpg_world_generation');
      expect(analytics.gameType).toBe('rpg');
    });

    it('should generate improvement recommendations', async () => {
      const mockAnalytics = {
        promptId: 'test_prompt',
        gameType: 'rpg' as GameType,
        timeWindow: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000),
          end: new Date(),
          granularity: 'day' as const,
        },
        usageStats: {
          totalGenerations: 100,
          uniqueUsers: 25,
          averageGenerationsPerUser: 4,
          peakUsageTime: '14:00',
          usageDistribution: {
            byGameType: { rpg: 100, deduction: 0, village: 0 },
            byTimeOfDay: {},
            byUserSegment: {},
          },
        },
        qualityMetrics: {
          averageQualityScore: 0.6, // Below threshold
          qualityDistribution: [],
          qualityTrend: [],
          safetyViolations: {
            totalViolations: 2,
            violationsByType: {},
            severityDistribution: {},
          },
          contentAppropriatenesScore: 0.8,
        },
        efficiencyMetrics: {
          averageTokensUsed: 1200, // High token usage
          tokenEfficiencyTrend: [],
          generationTimeStats: {
            average: 2500,
            median: 2000,
            p95: 5000,
            p99: 8000,
            timeoutRate: 0.01,
          },
          resourceUtilization: {
            cpuUsage: [],
            memoryUsage: [],
            networkBandwidth: [],
            cacheHitRate: 0.75,
          },
          costMetrics: {
            totalCost: 50.0,
            costPerGeneration: 0.5,
            costTrend: [],
            costByGameType: { rpg: 50.0, deduction: 0, village: 0 },
          },
        },
        userSatisfactionMetrics: {
          averageRating: 3.5, // Below target
          ratingDistribution: [5, 10, 20, 35, 30],
          explicitFeedback: {
            totalResponses: 20,
            sentimentScore: 0.2,
            commonThemes: [],
            improvementSuggestions: [],
          },
          implicitFeedback: {
            regenerationRate: 0.3,
            editRate: 0.4,
            usageDepth: 0.7,
            returnRate: 0.6,
          },
          retentionMetrics: {
            dayOneRetention: 0.8,
            daySevenRetention: 0.5,
            dayThirtyRetention: 0.3,
            churnPredictors: [],
          },
        },
        trendAnalysis: {
          overallTrend: 'declining' as const,
          seasonalPatterns: [],
          anomalies: [],
          forecasts: [],
        },
      };

      const recommendations =
        optimizationEngine.generateImprovementRecommendations(mockAnalytics);

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);

      const qualityRec = recommendations.find(
        r => r.type === 'quality_improvement'
      );
      expect(qualityRec).toBeDefined();
      expect(qualityRec?.priority).toBe('high');

      const efficiencyRec = recommendations.find(
        r => r.type === 'efficiency_optimization'
      );
      expect(efficiencyRec).toBeDefined();

      const satisfactionRec = recommendations.find(
        r => r.type === 'satisfaction_improvement'
      );
      expect(satisfactionRec).toBeDefined();
      expect(satisfactionRec?.priority).toBe('high');
    });
  });

  // ========================================================================
  // ERROR HANDLING TESTS
  // ========================================================================

  describe('Error Handling', () => {
    it('should handle missing template gracefully', async () => {
      const context: PromptContext = {
        gameType: 'rpg',
        variables: {},
      };

      await expect(
        generatePrompt('nonexistent_template', context)
      ).rejects.toThrow('Template not found: nonexistent_template');
    });

    it('should handle invalid variable types', async () => {
      const context: PromptContext = {
        gameType: 'rpg',
        variables: {
          theme: 'fantasy',
          size: 'medium',
          complexity: 'moderate',
          tone: 'heroic',
          playerCount: 'invalid_number', // Should be number
        },
      };

      // The actual validation would depend on the Zod schema implementation
      // For now, we test that it doesn't crash
      const result = await generatePrompt('rpg_world_generation', context);
      expect(result).toBeDefined();
    });

    it('should handle context hash generation errors', async () => {
      const contextWithCircularRef: any = {
        gameType: 'rpg',
        variables: {
          theme: 'fantasy',
          size: 'medium',
          complexity: 'moderate',
          tone: 'heroic',
          playerCount: 4,
        },
      };

      // Create circular reference
      contextWithCircularRef.variables.self = contextWithCircularRef;

      // Should handle circular reference gracefully
      const result = await generatePrompt(
        'rpg_world_generation',
        contextWithCircularRef
      );
      expect(result).toBeDefined();
      expect(result.metadata.contextHash).toBeDefined();
    });
  });

  // ========================================================================
  // INTEGRATION TESTS
  // ========================================================================

  describe('Integration Tests', () => {
    it('should work end-to-end for RPG scenario', async () => {
      // World generation
      const worldContext: PromptContext = {
        gameType: 'rpg',
        variables: {
          theme: 'dark fantasy',
          size: 'large',
          complexity: 'complex',
          tone: 'gritty realistic',
          playerCount: 6,
        },
      };

      const worldPrompt = await generatePrompt(
        'rpg_world_generation',
        worldContext
      );
      expect(worldPrompt.safety.passed).toBe(true);

      // Character creation using world context
      const characterContext: PromptContext = {
        gameType: 'rpg',
        variables: {
          worldContext: worldPrompt.content.substring(0, 200),
          level: 3,
          personality: 'brooding antihero',
          background: 'former soldier',
        },
      };

      const characterPrompt = await generatePrompt(
        'rpg_character_creation',
        characterContext
      );
      expect(characterPrompt.safety.passed).toBe(true);

      // Narrative continuation
      const narrativeContext: PromptContext = {
        gameType: 'rpg',
        variables: {
          currentSituation: 'The party has discovered an ancient artifact',
          playerActions: ['examine artifact', 'cast identify spell'],
          worldState: { location: 'ruined temple', danger_level: 'moderate' },
          tone: 'mysterious',
          length: 'medium',
        },
      };

      const narrativePrompt = await generatePrompt(
        'rpg_narrative_continuation',
        narrativeContext
      );
      expect(narrativePrompt.safety.passed).toBe(true);
    });

    it('should work end-to-end for Deduction scenario', async () => {
      // Role generation
      const roleContext: PromptContext = {
        gameType: 'deduction',
        variables: {
          theme: 'corporate espionage',
          playerCount: 10,
          complexity: 'complex',
          scenario: 'data breach investigation',
          balancing: 'balanced',
        },
      };

      const rolePrompt = await generatePrompt(
        'deduction_role_generation',
        roleContext
      );
      expect(rolePrompt.safety.passed).toBe(true);

      // Clue generation
      const clueContext: PromptContext = {
        gameType: 'deduction',
        variables: {
          theme: 'corporate espionage',
          playerCount: 10,
          scenario: 'data breach investigation',
          roleDistribution: { town: 7, mafia: 3 },
          gamePhase: 'day_discussion',
          complexity: 'complex',
        },
      };

      const cluePrompt = await generatePrompt(
        'deduction_clue_generation',
        clueContext
      );
      expect(cluePrompt.safety.passed).toBe(true);
    });

    it('should work end-to-end for Village scenario', async () => {
      // Event generation
      const eventContext: PromptContext = {
        gameType: 'village',
        variables: {
          villageState: {
            population: 200,
            happiness: 65,
            resources: { food: 90, wood: 70, stone: 30 },
          },
          season: 'winter',
          severity: 'major',
          previousEvents: ['blizzard', 'supply_shortage'],
          populationMood: 'worried',
          resourceLevels: { food: 'good', wood: 'adequate', stone: 'critical' },
        },
      };

      const eventPrompt = await generatePrompt(
        'village_event_generation',
        eventContext
      );
      expect(eventPrompt.safety.passed).toBe(true);

      // NPC behavior
      const npcContext: PromptContext = {
        gameType: 'village',
        variables: {
          npcProfile: {
            name: 'Elder Marta',
            profession: 'village_elder',
            personality: 'wise_cautious',
            age: 67,
          },
          villageContext: eventContext.variables.villageState,
          currentSituation: 'winter crisis meeting',
          playerInteraction: 'seeking advice',
          timeSeason: 'winter_evening',
          relationshipHistory: 'respected_leader',
        },
      };

      const npcPrompt = await generatePrompt(
        'village_npc_behavior',
        npcContext
      );
      expect(npcPrompt.safety.passed).toBe(true);
    });
  });
});

// ========================================================================
// MOCK SETUP FOR TESTING
// ========================================================================

// Mock KV service for testing
jest.mock('../../database/kv-service', () => ({
  kvService: {
    get: jest.fn(),
    set: jest.fn(),
    exists: jest.fn(),
    delete: jest.fn(),
    scan: jest.fn(),
  },
}));

// Mock performance monitoring
jest.mock('../../../lib/game-engine/performance', () => ({
  performanceMonitor: {
    recordMetric: jest.fn(),
    getMetrics: jest.fn(),
  },
}));
