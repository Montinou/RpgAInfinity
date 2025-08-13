/**
 * Example Usage of Claude AI Service
 *
 * Demonstrates how to integrate the ClaudeService with game components
 * and use all the major features including caching, streaming, and structured output
 */

import { claudeService, createSimplePrompt, formatAIResponse } from './claude';
import { z } from 'zod';

// ============================================================================
// EXAMPLE 1: BASIC CONTENT GENERATION
// ============================================================================

export async function generateBasicContent() {
  try {
    // Simple content generation
    const context = createSimplePrompt(
      'Generate a mystical forest description',
      'rpg'
    );

    const content = await claudeService.generateContent(
      'Create a detailed description of an ancient mystical forest where magic flows through the trees',
      context,
      {
        model: 'claude-3-5-sonnet-20241022',
        maxTokens: 500,
        temperature: 0.8,
        priority: 'normal',
      }
    );

    console.log('Generated Content:', content);
    return content;
  } catch (error) {
    console.error('Content generation failed:', error);
    throw error;
  }
}

// ============================================================================
// EXAMPLE 2: STREAMING CONTENT FOR REAL-TIME UI
// ============================================================================

export async function generateStreamingNarrative() {
  try {
    const context = createSimplePrompt('Continue the adventure story', 'rpg');
    let fullContent = '';

    // Stream content for real-time display
    for await (const chunk of claudeService.streamContent(
      'Continue this adventure: The party enters a dark cavern filled with ancient runes...',
      context,
      {
        model: 'claude-3-5-haiku-20241022', // Faster model for streaming
        maxTokens: 300,
        temperature: 0.7,
      }
    )) {
      fullContent += chunk;
      // Update UI in real-time
      console.log('Streaming chunk:', chunk);
    }

    console.log('Complete streamed content:', fullContent);
    return fullContent;
  } catch (error) {
    console.error('Streaming generation failed:', error);
    throw error;
  }
}

// ============================================================================
// EXAMPLE 3: STRUCTURED OUTPUT FOR RPG CHARACTERS
// ============================================================================

const CharacterSchema = z.object({
  name: z.string(),
  race: z.string(),
  class: z.string(),
  level: z.number().min(1).max(20),
  stats: z.object({
    strength: z.number().min(3).max(18),
    dexterity: z.number().min(3).max(18),
    constitution: z.number().min(3).max(18),
    intelligence: z.number().min(3).max(18),
    wisdom: z.number().min(3).max(18),
    charisma: z.number().min(3).max(18),
  }),
  background: z.string(),
  personality: z.string(),
  equipment: z.array(z.string()),
});

type Character = z.infer<typeof CharacterSchema>;

export async function generateRPGCharacter(): Promise<Character> {
  try {
    const context = createSimplePrompt('Generate RPG character', 'rpg');

    const character = await claudeService.generateStructured(
      `Generate a level 5 fantasy RPG character with the following requirements:
      - Choose a race from: Human, Elf, Dwarf, Halfling, Orc
      - Choose a class from: Warrior, Mage, Rogue, Cleric, Ranger
      - Generate realistic stats (3-18 range)
      - Include 3-5 pieces of starting equipment
      - Write a brief personality description
      - Include a background story element`,
      CharacterSchema,
      context,
      {
        model: 'claude-3-5-sonnet-20241022',
        maxRetries: 3,
      }
    );

    console.log('Generated Character:', character);
    return character;
  } catch (error) {
    console.error('Character generation failed:', error);
    throw error;
  }
}

// ============================================================================
// EXAMPLE 4: DEDUCTION GAME CONTENT GENERATION
// ============================================================================

const DeductionRoleSchema = z.object({
  roles: z.array(
    z.object({
      name: z.string(),
      team: z.enum(['town', 'mafia', 'neutral']),
      description: z.string(),
      abilities: z.array(z.string()),
      winCondition: z.string(),
    })
  ),
  scenario: z.string(),
  theme: z.string(),
  specialRules: z.array(z.string()),
});

type DeductionSetup = z.infer<typeof DeductionRoleSchema>;

export async function generateDeductionGame(
  playerCount: number
): Promise<DeductionSetup> {
  try {
    const context = {
      gameType: 'deduction' as const,
      gameState: { playerCount },
      playerHistory: [],
      recentEvents: [],
      systemFlags: {},
    };

    const gameSetup = await claudeService.generateStructured(
      `Create a social deduction game setup for ${playerCount} players with the following:
      - Balanced role distribution (approximately 70% town, 25% mafia, 5% neutral)
      - Unique and interesting role abilities
      - A cohesive theme (medieval, space, modern, etc.)
      - Special rules that make the game engaging
      - Clear win conditions for each team`,
      DeductionRoleSchema,
      context,
      {
        model: 'claude-3-5-sonnet-20241022',
        maxRetries: 2,
      }
    );

    console.log(`Generated ${playerCount}-player deduction game:`, gameSetup);
    return gameSetup;
  } catch (error) {
    console.error('Deduction game generation failed:', error);
    throw error;
  }
}

// ============================================================================
// EXAMPLE 5: VILLAGE SIMULATION EVENT GENERATION
// ============================================================================

const VillageEventSchema = z.object({
  title: z.string(),
  description: z.string(),
  type: z.enum(['economic', 'social', 'natural', 'political', 'mystical']),
  severity: z.enum(['minor', 'moderate', 'major', 'catastrophic']),
  effects: z.object({
    population: z.number().optional(),
    resources: z.record(z.number()).optional(),
    happiness: z.number().optional(),
    buildings: z.array(z.string()).optional(),
  }),
  duration: z.string(),
  choices: z
    .array(
      z.object({
        option: z.string(),
        consequences: z.string(),
        requirements: z.record(z.number()).optional(),
      })
    )
    .optional(),
});

type VillageEvent = z.infer<typeof VillageEventSchema>;

export async function generateVillageEvent(
  currentSeason: string,
  villageState: Record<string, any>
): Promise<VillageEvent> {
  try {
    const context = {
      gameType: 'village' as const,
      gameState: {
        season: currentSeason,
        population: villageState.population,
        resources: villageState.resources,
        buildings: villageState.buildings,
      },
      playerHistory: [],
      recentEvents: [],
      systemFlags: {},
    };

    const event = await claudeService.generateStructured(
      `Generate a village simulation event for ${currentSeason} season:
      - Current population: ${villageState.population}
      - Available resources: ${Object.entries(villageState.resources)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')}
      - Consider the seasonal context
      - Provide meaningful player choices
      - Include realistic consequences
      - Balance challenge with fairness`,
      VillageEventSchema,
      context
    );

    console.log(`Generated village event for ${currentSeason}:`, event);
    return event;
  } catch (error) {
    console.error('Village event generation failed:', error);
    throw error;
  }
}

// ============================================================================
// EXAMPLE 6: USING ANALYTICS AND MONITORING
// ============================================================================

export async function monitorAIUsage() {
  try {
    // Get current analytics
    const analytics = claudeService.getAnalytics();

    console.log('AI Usage Analytics:', {
      totalRequests: analytics.totalRequests,
      successRate: `${(analytics.successRate * 100).toFixed(2)}%`,
      averageResponseTime: `${analytics.averageResponseTime}ms`,
      estimatedCost: `$${analytics.estimatedCost.toFixed(4)}`,
      cacheHitRate: `${(analytics.cache.hitRate * 100).toFixed(2)}%`,
      memoryEntries: analytics.cache.memoryEntries,
    });

    // Get service health
    const health = await claudeService.healthCheck();

    console.log('Service Health:', {
      status: health.status,
      apiConnected: health.checks.apiKeyConfigured,
      kvServiceWorking: health.checks.kvServiceConnected,
      responseTime: `${health.metrics.response_time_ms}ms`,
    });

    return { analytics, health };
  } catch (error) {
    console.error('Monitoring check failed:', error);
    throw error;
  }
}

// ============================================================================
// EXAMPLE 7: ADVANCED CONTEXT WITH CULTURAL PREFERENCES
// ============================================================================

export async function generateCulturallyAwareContent(
  prompt: string,
  preferences: {
    language: string;
    region: string;
    contentRating: 'general' | 'teen' | 'mature';
    themes: string[];
    avoidances: string[];
  }
) {
  try {
    const context = {
      gameType: 'rpg' as const,
      gameState: {},
      playerHistory: [],
      recentEvents: [],
      systemFlags: {},
      culturalPreferences: preferences,
    };

    const content = await claudeService.generateContent(prompt, context, {
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.8,
      priority: 'normal',
    });

    console.log('Culturally aware content generated:', content);
    return content;
  } catch (error) {
    console.error('Cultural content generation failed:', error);
    throw error;
  }
}

// ============================================================================
// EXAMPLE 8: RESPONSE FORMATTING AND DISPLAY
// ============================================================================

export async function generateAndFormatResponse(prompt: string) {
  try {
    const context = createSimplePrompt(prompt, 'rpg');

    // Generate content
    const rawContent = await claudeService.generateContent(prompt, context);

    // Note: formatAIResponse requires AIResponse object, not just string
    // This is a simplified example - in real usage, you'd get the full response
    console.log('Raw content:', rawContent);

    // You could also get analytics for cost tracking
    const analytics = claudeService.getAnalytics();
    console.log(
      'Current cost estimate:',
      `$${analytics.estimatedCost.toFixed(4)}`
    );

    return rawContent;
  } catch (error) {
    console.error('Content generation and formatting failed:', error);
    throw error;
  }
}

// ============================================================================
// USAGE EXAMPLES RUNNER
// ============================================================================

export async function runAllExamples() {
  console.log('🤖 Running Claude AI Service Examples...\n');

  try {
    // Example 1: Basic content
    console.log('1️⃣ Basic Content Generation:');
    await generateBasicContent();

    // Example 2: Streaming (commented out to avoid long output)
    console.log('\n2️⃣ Streaming Content Generation:');
    // await generateStreamingNarrative();
    console.log('(Skipped for demo - uncomment to test streaming)');

    // Example 3: Structured RPG character
    console.log('\n3️⃣ Structured RPG Character:');
    await generateRPGCharacter();

    // Example 4: Deduction game
    console.log('\n4️⃣ Deduction Game Setup:');
    await generateDeductionGame(8);

    // Example 5: Village event
    console.log('\n5️⃣ Village Event:');
    await generateVillageEvent('winter', {
      population: 150,
      resources: { food: 80, wood: 45, stone: 20 },
      buildings: ['town hall', 'granary', 'blacksmith'],
    });

    // Example 6: Analytics
    console.log('\n6️⃣ AI Usage Monitoring:');
    await monitorAIUsage();

    // Example 7: Cultural content
    console.log('\n7️⃣ Culturally Aware Content:');
    await generateCulturallyAwareContent(
      'Generate a festival celebration description',
      {
        language: 'en',
        region: 'US',
        contentRating: 'general',
        themes: ['friendship', 'celebration', 'community'],
        avoidances: ['violence', 'alcohol'],
      }
    );

    console.log('\n✅ All examples completed successfully!');
  } catch (error) {
    console.error('❌ Example execution failed:', error);
  }
}

// Uncomment to run examples:
// runAllExamples().catch(console.error);
