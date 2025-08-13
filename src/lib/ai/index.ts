/**
 * AI Integration Module for RpgAInfinity
 *
 * This module exports all AI-related functionality including:
 * - Prompt engineering system with game-specific templates
 * - Claude API integration service
 * - A/B testing and optimization framework
 * - Performance analytics and monitoring
 * - Comprehensive testing utilities
 */

// ============================================================================
// CORE PROMPT ENGINEERING EXPORTS
// ============================================================================

export {
  // Prompt engine and utilities
  promptEngine,
  generatePrompt,
  validatePromptContext,
  PROMPTS,

  // Types and interfaces
  type PromptContext,
  type PromptGenerationOptions,
  type GeneratedPrompt,
  type PromptMetadata,
  type SafetyValidation,
} from './prompts';

// ============================================================================
// OPTIMIZATION AND A/B TESTING EXPORTS
// ============================================================================

export {
  // Optimization engine
  optimizationEngine,

  // Types and interfaces
  type ABTestConfig,
  type ABTestResult,
  type TokenOptimizationConfig,
  type OptimizationResult,
  type PerformanceAnalytics,
  type PromptImprovementRecommendation,
} from './optimization';

// ============================================================================
// GEMINI SERVICE EXPORTS (Backward compatible with Claude naming)
// ============================================================================

export {
  // Gemini service (exported as claudeService for backward compatibility)
  geminiService,
  claudeService,
  createSimplePrompt,
  formatAIResponse,

  // Service class exports
  GeminiService,
  GeminiService as ClaudeService, // Backward compatibility
} from './gemini';

// ============================================================================
// INTERNAL HELPER FUNCTIONS
// ============================================================================

/**
 * Generate game content using the Gemini service
 */
async function generateGameContent(
  templateId: string,
  gameType: 'rpg' | 'deduction' | 'village',
  variables: Record<string, any>,
  options?: { useCache?: boolean; priority?: string }
): Promise<string> {
  const prompt = `Generate ${templateId.replace(/_/g, ' ')} for ${gameType} game with parameters: ${JSON.stringify(variables)}`;
  return geminiService.generateContent(
    prompt,
    { gameType },
    { priority: options?.priority as any }
  );
}

/**
 * Generate streaming content using the Gemini service
 */
function generateStreamingContent(
  templateId: string,
  gameType: 'rpg' | 'deduction' | 'village',
  variables: Record<string, any>,
  options?: { streaming?: boolean; useCache?: boolean }
): AsyncGenerator<string, void, unknown> {
  const prompt = `Generate ${templateId.replace(/_/g, ' ')} for ${gameType} game with parameters: ${JSON.stringify(variables)}`;
  return geminiService.streamContent(prompt, { gameType });
}

// ============================================================================
// UTILITY FUNCTIONS AND HELPERS
// ============================================================================

/**
 * Quick generation function for RPG content
 */
export async function generateRPGContent(
  templateType: 'world' | 'character' | 'narrative' | 'combat' | 'npc_dialogue',
  variables: Record<string, any>,
  options?: { streaming?: boolean; optimize?: boolean }
) {
  const templateMap = {
    world: 'rpg_world_generation',
    character: 'rpg_character_creation',
    narrative: 'rpg_narrative_continuation',
    combat: 'rpg_combat_narration',
    npc_dialogue: 'rpg_npc_dialogue',
  };

  const templateId = templateMap[templateType];

  if (options?.streaming) {
    return generateStreamingContent(templateId, 'rpg', variables, {
      streaming: true,
      useCache: true,
    });
  } else {
    return generateGameContent(templateId, 'rpg', variables, {
      useCache: true,
      priority: 'normal',
    });
  }
}

/**
 * Quick generation function for Deduction content
 */
export async function generateDeductionContent(
  templateType: 'roles' | 'clues' | 'narrative',
  variables: Record<string, any>,
  options?: { streaming?: boolean; optimize?: boolean }
) {
  const templateMap = {
    roles: 'deduction_role_generation',
    clues: 'deduction_clue_generation',
    narrative: 'deduction_narrative_setup',
  };

  const templateId = templateMap[templateType];

  if (options?.streaming) {
    return generateStreamingContent(templateId, 'deduction', variables);
  } else {
    return generateGameContent(templateId, 'deduction', variables, {
      useCache: true,
      priority: 'normal',
    });
  }
}

/**
 * Quick generation function for Village content
 */
export async function generateVillageContent(
  templateType:
    | 'events'
    | 'npc_behavior'
    | 'advice'
    | 'npc_generation'
    | 'npc_dialogue'
    | 'npc_personality',
  variables: Record<string, any>,
  options?: { streaming?: boolean; optimize?: boolean }
) {
  const templateMap = {
    events: 'village_event_generation',
    npc_behavior: 'village_npc_behavior',
    advice: 'village_management_advice',
    npc_generation: 'village_npc_generation',
    npc_dialogue: 'village_npc_dialogue',
    npc_personality: 'village_npc_personality',
  };

  const templateId = templateMap[templateType];

  if (options?.streaming) {
    return generateStreamingContent(templateId, 'village', variables);
  } else {
    return generateGameContent(templateId, 'village', variables, {
      useCache: true,
      priority: 'normal',
    });
  }
}

/**
 * Batch generate content for multiple templates
 */
export async function batchGenerateContent(
  requests: Array<{
    templateId: string;
    gameType: 'rpg' | 'deduction' | 'village';
    variables: Record<string, any>;
    options?: ClaudeRequestOptions;
  }>
) {
  const contexts = requests.map(req => ({
    templateId: req.templateId,
    context: {
      gameType: req.gameType,
      variables: req.variables,
      culturalContext: {
        language: 'en',
        region: 'US',
        contentRating: 'general' as const,
      },
    },
    options: req.options,
  }));

  return claudeService.generateBatch(contexts);
}

/**
 * Analyze and improve a prompt template's performance
 */
export async function analyzePromptPerformance(
  templateId: string,
  timeWindowHours: number = 24
) {
  const analytics = await optimizationEngine.analyzePerformance(templateId, {
    start: new Date(Date.now() - timeWindowHours * 60 * 60 * 1000),
    end: new Date(),
    granularity: 'hour',
  });

  const recommendations =
    optimizationEngine.generateImprovementRecommendations(analytics);

  return {
    analytics,
    recommendations,
    summary: {
      totalGenerations: analytics.usageStats.totalGenerations,
      averageQuality: analytics.qualityMetrics.averageQualityScore,
      averageTokens: analytics.efficiencyMetrics.averageTokensUsed,
      userSatisfaction: analytics.userSatisfactionMetrics.averageRating,
      needsImprovement:
        recommendations.filter(r => r.priority === 'high').length > 0,
    },
  };
}

/**
 * Start an A/B test for prompt optimization
 */
export async function startPromptABTest(
  baseTemplateId: string,
  variantTemplates: string[],
  config?: {
    trafficSplit?: number[];
    duration?: number; // days
    successMetrics?: string[];
    sampleSize?: number;
  }
) {
  const baseTemplate = (PROMPTS as any)[baseTemplateId.toUpperCase()];
  if (!baseTemplate) {
    throw new Error(`Base template not found: ${baseTemplateId}`);
  }

  const variants = variantTemplates
    .map(id => (PROMPTS as any)[id.toUpperCase()])
    .filter(Boolean);
  if (variants.length === 0) {
    throw new Error('No valid variant templates found');
  }

  const testConfig: ABTestConfig = {
    testId: `${baseTemplateId}_${Date.now()}`,
    baseTemplate,
    variants,
    trafficSplit:
      config?.trafficSplit ||
      Array(variants.length + 1).fill(100 / (variants.length + 1)),
    successMetrics: [
      {
        name: 'user_satisfaction',
        type: 'user_satisfaction',
        weight: 0.6,
        direction: 'maximize',
        measurement: {
          source: 'user_feedback',
          calculation: 'average_rating',
          aggregation: 'mean',
        },
      },
      {
        name: 'quality_score',
        type: 'safety_score',
        weight: 0.4,
        direction: 'maximize',
        measurement: {
          source: 'ai_analysis',
          calculation: 'quality_assessment',
          aggregation: 'mean',
        },
      },
    ],
    sampleSize: config?.sampleSize || 200,
    significanceLevel: 0.05,
    duration: {
      startDate: new Date(),
      endDate: new Date(
        Date.now() + (config?.duration || 7) * 24 * 60 * 60 * 1000
      ),
      minimumSamples: Math.floor((config?.sampleSize || 200) * 0.5),
      earlyStoppingEnabled: true,
    },
    constraints: [],
  };

  return optimizationEngine.startABTest(testConfig);
}

/**
 * Get comprehensive system status and health metrics
 */
export async function getAISystemStatus() {
  const now = new Date();
  const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

  // Get analytics for all major templates
  const templateIds = [
    'rpg_world_generation',
    'rpg_character_creation',
    'deduction_role_generation',
    'village_event_generation',
  ];

  const templateAnalytics = await Promise.all(
    templateIds.map(async id => ({
      templateId: id,
      analytics: await optimizationEngine.analyzePerformance(id, {
        start: lastHour,
        end: now,
        granularity: 'hour',
      }),
    }))
  );

  return {
    timestamp: now,
    system: {
      status: 'healthy', // TODO: Implement actual health checking
      uptime: process.uptime(),
      version: '1.0.0',
    },
    performance: {
      totalRequests: templateAnalytics.reduce(
        (sum, t) => sum + t.analytics.usageStats.totalGenerations,
        0
      ),
      averageResponseTime:
        templateAnalytics.reduce(
          (sum, t) =>
            sum + t.analytics.efficiencyMetrics.generationTimeStats.average,
          0
        ) / templateAnalytics.length,
      successRate:
        templateAnalytics.reduce(
          (sum, t) =>
            sum +
            (1 - t.analytics.efficiencyMetrics.generationTimeStats.timeoutRate),
          0
        ) / templateAnalytics.length,
      cacheHitRate:
        templateAnalytics.reduce(
          (sum, t) =>
            sum +
            t.analytics.efficiencyMetrics.resourceUtilization.cacheHitRate,
          0
        ) / templateAnalytics.length,
    },
    templates: templateAnalytics.map(({ templateId, analytics }) => ({
      id: templateId,
      status: analytics.trendAnalysis.overallTrend,
      usage: analytics.usageStats.totalGenerations,
      quality: analytics.qualityMetrics.averageQualityScore,
      satisfaction: analytics.userSatisfactionMetrics.averageRating,
    })),
    recommendations: templateAnalytics.flatMap(({ templateId, analytics }) =>
      optimizationEngine
        .generateImprovementRecommendations(analytics)
        .filter(r => r.priority === 'high' || r.priority === 'critical')
        .map(r => ({ templateId, ...r }))
    ),
  };
}

// ============================================================================
// TYPE RE-EXPORTS FOR CONVENIENCE
// ============================================================================

export type {
  // AI types from types/ai.ts
  AIRequest,
  AIResponse,
  AIServiceConfig,
  PromptTemplate,
  PromptCategory,
  AIContext,

  // Game types for context
  GameType,
} from '../../types/ai';

export type {
  // Core game types
  UUID,
  GameState,
  Player,
  GameError,
} from '../../types/core';

// ============================================================================
// CONFIGURATION AND CONSTANTS
// ============================================================================

export const AI_CONFIG = {
  // Default models for different use cases (mapped to Gemini)
  MODELS: {
    CREATIVE: 'gemini-1.5-pro-latest', // For world building, narrative
    ANALYTICAL: 'gemini-1.5-flash', // For game logic, analysis
    BALANCED: 'gemini-1.5-pro-latest', // General purpose
  },

  // Token limits by content type
  TOKEN_LIMITS: {
    WORLD_GENERATION: 4000,
    CHARACTER_CREATION: 2000,
    NARRATIVE_CONTINUATION: 3000,
    ROLE_GENERATION: 2500,
    CLUE_GENERATION: 1500,
    EVENT_GENERATION: 2000,
    NPC_DIALOGUE: 1000,
    VILLAGE_ADVICE: 1500,
  },

  // Default safety levels by game type
  SAFETY_LEVELS: {
    RPG: 'moderate' as const,
    DEDUCTION: 'moderate' as const,
    VILLAGE: 'lenient' as const,
  },

  // Cache TTL by content type (minutes)
  CACHE_TTL: {
    STATIC_CONTENT: 1440, // 24 hours
    DYNAMIC_CONTENT: 240, // 4 hours
    PERSONALIZED: 60, // 1 hour
    TEMPORARY: 15, // 15 minutes
  },
};

/**
 * Validate AI system configuration
 */
export function validateAIConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!process.env.GOOGLE_AI_API_KEY) {
    errors.push('GOOGLE_AI_API_KEY environment variable is required');
  }

  // Model validation is handled by Gemini service internally
  // Models are automatically mapped from Claude to Gemini equivalents

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// DEVELOPMENT AND DEBUGGING UTILITIES
// ============================================================================

/**
 * Generate test content for development/debugging
 */
export async function generateTestContent() {
  const testScenarios = [
    {
      name: 'RPG World Generation',
      templateId: 'rpg_world_generation',
      gameType: 'rpg' as const,
      variables: {
        theme: 'steampunk fantasy',
        biome: 'floating islands',
        size: 'medium',
        complexity: 'moderate',
        tone: 'adventurous discovery',
        playerCount: 4,
      },
    },
    {
      name: 'Deduction Role Generation',
      templateId: 'deduction_role_generation',
      gameType: 'deduction' as const,
      variables: {
        theme: 'space station',
        playerCount: 8,
        complexity: 'moderate',
        scenario: 'system malfunction investigation',
        balancing: 'balanced',
      },
    },
    {
      name: 'Village Event Generation',
      templateId: 'village_event_generation',
      gameType: 'village' as const,
      variables: {
        villageState: {
          population: 180,
          happiness: 70,
          resources: { food: 85, wood: 60, stone: 45 },
        },
        season: 'spring',
        severity: 'moderate',
        previousEvents: ['market_day', 'new_arrivals'],
        populationMood: 'hopeful',
        resourceLevels: { food: 'good', wood: 'adequate', stone: 'low' },
      },
    },
  ];

  const results = [];
  for (const scenario of testScenarios) {
    try {
      const result = await generateGameContent(
        scenario.templateId,
        scenario.gameType,
        scenario.variables,
        { priority: 'low' }
      );

      results.push({
        scenario: scenario.name,
        success: true,
        content: `${result.substring(0, 200)}...`,
        tokenUsage: 0, // Token usage will be tracked internally by Gemini service
        processingTime: 0, // Processing time tracked internally
        cached: false,
      });
    } catch (error) {
      results.push({
        scenario: scenario.name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}
