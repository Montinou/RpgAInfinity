/**
 * Comprehensive Prompt Engineering System for RpgAInfinity
 *
 * This module provides:
 * - Context-aware prompt generation for all game types
 * - Dynamic variable injection with validation
 * - Prompt optimization for token efficiency
 * - A/B testing framework for prompt effectiveness
 * - Template inheritance for shared patterns
 * - Safety filters and content guidelines
 */

import { z } from 'zod';
import {
  PromptTemplate,
  PromptVariable,
  PromptCategory,
  AIContext,
  JSONValue,
  GameType,
} from '../../types/ai';
import { UUID, GameState, Player } from '../../types/core';
import { RPGWorld, RPGCharacter } from '../../types/rpg';
import { DeductionRole } from '../../types/deduction';
import { VillageState } from '../../types/village';

// ============================================================================
// PROMPT CONTEXT & VARIABLE INJECTION
// ============================================================================

export interface PromptContext {
  readonly gameType: GameType;
  readonly gameState?: GameState;
  readonly players?: Player[];
  readonly currentPlayer?: Player;
  readonly variables: Record<string, JSONValue>;
  readonly culturalContext?: {
    language: string;
    region: string;
    contentRating: 'general' | 'teen' | 'mature';
  };
  readonly systemFlags?: Record<string, boolean>;
}

export interface PromptGenerationOptions {
  readonly optimizeForTokens?: boolean;
  readonly maxLength?: number;
  readonly temperature?: number;
  readonly includeExamples?: boolean;
  readonly safetyLevel?: 'strict' | 'moderate' | 'lenient';
  readonly version?: string; // For A/B testing
}

export interface GeneratedPrompt {
  readonly content: string;
  readonly tokenEstimate: number;
  readonly variables: Record<string, JSONValue>;
  readonly metadata: PromptMetadata;
  readonly safety: SafetyValidation;
}

export interface PromptMetadata {
  readonly templateId: string;
  readonly version: string;
  readonly generatedAt: Date;
  readonly optimizationApplied: boolean;
  readonly contextHash: string;
}

export interface SafetyValidation {
  readonly passed: boolean;
  readonly flags: string[];
  readonly severity: 'none' | 'low' | 'medium' | 'high';
  readonly recommendations: string[];
}

// ============================================================================
// CORE PROMPT ENGINE
// ============================================================================

class PromptEngine {
  private templates = new Map<string, PromptTemplate>();
  private abTestVariants = new Map<string, string[]>();
  private performanceMetrics = new Map<string, PromptPerformanceMetrics>();

  constructor() {
    this.initializeTemplates();
  }

  /**
   * Generate a prompt from template with context injection
   */
  async generatePrompt(
    templateId: string,
    context: PromptContext,
    options: PromptGenerationOptions = {}
  ): Promise<GeneratedPrompt> {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Validate context against template requirements
    this.validateContext(template, context);

    // Select A/B test variant if applicable
    const selectedVariant = this.selectABTestVariant(
      templateId,
      options.version
    );
    const finalTemplate = selectedVariant || template;

    // Inject variables into template
    let content = this.injectVariables(finalTemplate.template, context);

    // Apply optimizations
    if (options.optimizeForTokens) {
      content = this.optimizeForTokens(content, options.maxLength);
    }

    // Validate safety
    const safety = this.validateSafety(content, options.safetyLevel);
    if (!safety.passed && options.safetyLevel === 'strict') {
      throw new Error(
        `Prompt failed safety validation: ${safety.flags.join(', ')}`
      );
    }

    // Generate metadata
    const metadata: PromptMetadata = {
      templateId,
      version: selectedVariant?.metadata?.version || template.metadata.version,
      generatedAt: new Date(),
      optimizationApplied: options.optimizeForTokens || false,
      contextHash: this.generateContextHash(context),
    };

    const result: GeneratedPrompt = {
      content,
      tokenEstimate: this.estimateTokens(content),
      variables: context.variables,
      metadata,
      safety,
    };

    // Track performance metrics
    this.trackPromptGeneration(templateId, result);

    return result;
  }

  /**
   * Register a new prompt template
   */
  registerTemplate(template: PromptTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Create A/B test variant for a template
   */
  createABTestVariant(
    baseTemplateId: string,
    variantTemplate: PromptTemplate
  ): void {
    if (!this.abTestVariants.has(baseTemplateId)) {
      this.abTestVariants.set(baseTemplateId, []);
    }
    this.abTestVariants.get(baseTemplateId)!.push(variantTemplate.id);
    this.registerTemplate(variantTemplate);
  }

  /**
   * Get template by ID
   */
  private getTemplate(templateId: string): PromptTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Validate context against template requirements
   */
  private validateContext(
    template: PromptTemplate,
    context: PromptContext
  ): void {
    for (const variable of template.variables) {
      if (variable.required && !(variable.name in context.variables)) {
        throw new Error(`Required variable missing: ${variable.name}`);
      }

      if (variable.name in context.variables && variable.validation) {
        this.validateVariableValue(variable, context.variables[variable.name]);
      }
    }
  }

  /**
   * Validate individual variable value
   */
  private validateVariableValue(
    variable: PromptVariable,
    value: JSONValue
  ): void {
    const validation = variable.validation!;

    if (typeof value === 'string') {
      if (validation.minLength && value.length < validation.minLength) {
        throw new Error(
          `Variable ${variable.name} too short. Minimum: ${validation.minLength}`
        );
      }
      if (validation.maxLength && value.length > validation.maxLength) {
        throw new Error(
          `Variable ${variable.name} too long. Maximum: ${validation.maxLength}`
        );
      }
      if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
        throw new Error(
          `Variable ${variable.name} doesn't match required pattern`
        );
      }
    }

    if (validation.allowedValues && !validation.allowedValues.includes(value)) {
      throw new Error(
        `Variable ${variable.name} has invalid value. Allowed: ${validation.allowedValues.join(', ')}`
      );
    }
  }

  /**
   * Select A/B test variant based on strategy
   */
  private selectABTestVariant(
    templateId: string,
    preferredVersion?: string
  ): PromptTemplate | null {
    if (preferredVersion) {
      return this.templates.get(preferredVersion) || null;
    }

    const variants = this.abTestVariants.get(templateId);
    if (!variants || variants.length === 0) {
      return null;
    }

    // Simple random selection for A/B testing
    // TODO: Implement more sophisticated selection based on performance metrics
    const randomIndex = Math.floor(Math.random() * variants.length);
    return this.templates.get(variants[randomIndex]) || null;
  }

  /**
   * Inject context variables into template
   */
  private injectVariables(template: string, context: PromptContext): string {
    let result = template;

    // Replace variable placeholders
    for (const [key, value] of Object.entries(context.variables)) {
      const placeholder = `{{${key}}}`;
      const stringValue =
        typeof value === 'string' ? value : JSON.stringify(value);
      result = result.replace(new RegExp(placeholder, 'g'), stringValue);
    }

    // Replace system variables
    if (context.gameType) {
      result = result.replace(/{{GAME_TYPE}}/g, context.gameType);
    }

    if (context.currentPlayer) {
      result = result.replace(/{{PLAYER_NAME}}/g, context.currentPlayer.name);
      result = result.replace(/{{PLAYER_ID}}/g, context.currentPlayer.id);
    }

    if (context.culturalContext) {
      result = result.replace(
        /{{LANGUAGE}}/g,
        context.culturalContext.language
      );
      result = result.replace(
        /{{CONTENT_RATING}}/g,
        context.culturalContext.contentRating
      );
    }

    return result;
  }

  /**
   * Optimize prompt for token efficiency
   */
  private optimizeForTokens(content: string, maxLength?: number): string {
    let optimized = content;

    // Remove excessive whitespace
    optimized = optimized.replace(/\s+/g, ' ').trim();

    // Remove redundant phrases (basic optimization)
    const redundantPhrases = [
      /please note that/gi,
      /it should be noted that/gi,
      /it is important to/gi,
      /in order to/gi,
    ];

    for (const phrase of redundantPhrases) {
      optimized = optimized.replace(phrase, '');
    }

    // Truncate if necessary
    if (maxLength && optimized.length > maxLength) {
      optimized = `${optimized.substring(0, maxLength - 3)}...`;
    }

    return optimized;
  }

  /**
   * Validate prompt safety
   */
  private validateSafety(
    content: string,
    level: 'strict' | 'moderate' | 'lenient' = 'moderate'
  ): SafetyValidation {
    const flags: string[] = [];
    const recommendations: string[] = [];

    // Basic content filters
    const prohibitedContent = [
      {
        pattern: /violence|kill|murder|death/gi,
        flag: 'violence',
        severity: 'medium',
      },
      {
        pattern: /sexual|explicit|adult/gi,
        flag: 'adult_content',
        severity: 'high',
      },
      {
        pattern: /hate|discriminat|racist/gi,
        flag: 'hate_speech',
        severity: 'high',
      },
      {
        pattern: /personal.*information|private.*data/gi,
        flag: 'privacy',
        severity: 'medium',
      },
    ];

    let maxSeverity: 'none' | 'low' | 'medium' | 'high' = 'none';

    for (const check of prohibitedContent) {
      if (check.pattern.test(content)) {
        flags.push(check.flag);
        if (check.severity === 'high') maxSeverity = 'high';
        else if (check.severity === 'medium' && maxSeverity !== 'high')
          maxSeverity = 'medium';

        switch (check.flag) {
          case 'violence':
            recommendations.push(
              'Consider using less violent language or fantasy alternatives'
            );
            break;
          case 'adult_content':
            recommendations.push(
              'Remove adult content or use age-appropriate alternatives'
            );
            break;
          case 'hate_speech':
            recommendations.push(
              'Remove discriminatory language and use inclusive alternatives'
            );
            break;
          case 'privacy':
            recommendations.push('Remove references to personal information');
            break;
        }
      }
    }

    const severityThresholds = {
      strict: ['high', 'medium', 'low'],
      moderate: ['high', 'medium'],
      lenient: ['high'],
    };

    const passed = !severityThresholds[level].includes(maxSeverity);

    return {
      passed,
      flags,
      severity: maxSeverity,
      recommendations,
    };
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(content: string): number {
    // Rough approximation: ~4 characters per token for English text
    return Math.ceil(content.length / 4);
  }

  /**
   * Generate context hash for caching
   */
  private generateContextHash(context: PromptContext): string {
    const hashData = {
      gameType: context.gameType,
      variables: context.variables,
      language: context.culturalContext?.language,
      contentRating: context.culturalContext?.contentRating,
    };

    // Simple hash function - in production, use a proper hashing library
    return btoa(JSON.stringify(hashData)).substring(0, 16);
  }

  /**
   * Track prompt generation metrics
   */
  private trackPromptGeneration(
    templateId: string,
    result: GeneratedPrompt
  ): void {
    if (!this.performanceMetrics.has(templateId)) {
      this.performanceMetrics.set(templateId, {
        totalGenerations: 0,
        averageTokens: 0,
        safetyFailures: 0,
        averageGenerationTime: 0,
      });
    }

    const metrics = this.performanceMetrics.get(templateId)!;
    metrics.totalGenerations++;
    metrics.averageTokens =
      (metrics.averageTokens + result.tokenEstimate) / metrics.totalGenerations;

    if (!result.safety.passed) {
      metrics.safetyFailures++;
    }

    // TODO: Track actual generation time
    this.performanceMetrics.set(templateId, metrics);
  }

  /**
   * Initialize default prompt templates
   */
  private initializeTemplates(): void {
    // Templates will be loaded from the PROMPTS constant below
    // This method can be extended to load from external sources
  }
}

interface PromptPerformanceMetrics {
  totalGenerations: number;
  averageTokens: number;
  safetyFailures: number;
  averageGenerationTime: number;
}

// ============================================================================
// GAME-SPECIFIC PROMPT TEMPLATES
// ============================================================================

export const PROMPTS = {
  // ========================================================================
  // RPG GAME PROMPTS
  // ========================================================================

  WORLD_GENERATION: {
    id: 'rpg_world_generation',
    name: 'RPG World Generation',
    category: 'world_generation' as PromptCategory,
    gameType: 'rpg' as GameType,
    template: `You are a master world-builder creating a unique fantasy realm for an RPG adventure.

**World Theme**: {{theme}}
**Biome**: {{biome}}
**World Size**: {{size}}
**Complexity Level**: {{complexity}}
**Tone**: {{tone}}
**Player Count**: {{playerCount}}

Create a detailed world description including:

1. **SETTING OVERVIEW**
   - World name and core concept
   - Primary geographical features
   - Dominant cultures and civilizations
   - Current political situation

2. **KEY LOCATIONS** (3-5 major areas)
   - Name, description, and significance
   - Notable NPCs or factions
   - Potential adventure hooks

3. **WORLD HISTORY** (brief)
   - Major historical events
   - Current conflicts or tensions
   - Mysteries or legends

4. **ADVENTURE SEEDS** (3 options)
   - Brief quest concepts suitable for {{playerCount}} players
   - Difficulty progression from easy to challenging

**Requirements**:
- Keep descriptions vivid but concise
- Ensure content is appropriate for {{CONTENT_RATING}} rating
- Include diverse cultures and inclusive representation
- Balance familiar fantasy elements with unique twists

Generate content in a structured format suitable for immediate gameplay use.`,

    variables: [
      {
        name: 'theme',
        type: 'string',
        description:
          'World theme (e.g., high fantasy, steampunk, dark fantasy)',
        required: true,
      },
      {
        name: 'biome',
        type: 'string',
        description: 'Primary biome or environment',
        required: false,
      },
      {
        name: 'size',
        type: 'string',
        description: 'World scope',
        required: true,
        validation: { allowedValues: ['small', 'medium', 'large'] },
      },
      {
        name: 'complexity',
        type: 'string',
        description: 'World complexity',
        required: true,
        validation: { allowedValues: ['simple', 'moderate', 'complex'] },
      },
      {
        name: 'tone',
        type: 'string',
        description: 'Narrative tone',
        required: true,
      },
      {
        name: 'playerCount',
        type: 'number',
        description: 'Number of players',
        required: true,
        validation: { minLength: 1, maxLength: 8 },
      },
    ],

    constraints: [
      {
        type: 'length',
        description: 'Optimal length for gameplay',
        parameters: { minWords: 300, maxWords: 800 },
      },
      {
        type: 'content',
        description: 'Family-friendly content',
        parameters: { rating: 'general' },
      },
      {
        type: 'format',
        description: 'Structured output',
        parameters: { sections: ['overview', 'locations', 'history', 'seeds'] },
      },
    ],

    metadata: {
      author: 'AI/ML Specialist',
      version: '1.0.0',
      createdAt: new Date(),
      lastModified: new Date(),
      tags: ['rpg', 'world-building', 'fantasy', 'adventure'],
      usage: {
        timesUsed: 0,
        avgResponseTime: 0,
        successRate: 0,
        avgTokensUsed: 0,
        userSatisfaction: 0,
      },
      rating: 0,
    },
  },

  CHARACTER_CREATION: {
    id: 'rpg_character_creation',
    name: 'RPG Character Generation',
    category: 'character_creation' as PromptCategory,
    gameType: 'rpg' as GameType,
    template: `Create a compelling RPG character for this world and context.

**World Context**: {{worldContext}}
**Character Race**: {{race}}
**Character Class**: {{class}}
**Level**: {{level}}
**Personality Type**: {{personality}}
**Background**: {{background}}

Generate a complete character profile:

1. **BASIC INFORMATION**
   - Full name with cultural significance
   - Age, appearance, and distinguishing features
   - Personality traits and quirks

2. **BACKSTORY**
   - Origin and upbringing (2-3 sentences)
   - Defining life events
   - Current motivations and goals

3. **ABILITIES & SKILLS**
   - Key strengths and specializations
   - Notable weaknesses or limitations
   - Unique abilities or talents

4. **RELATIONSHIPS**
   - Important connections (family, mentors, rivals)
   - Current allies or enemies
   - Social standing and reputation

5. **ROLEPLAY HOOKS**
   - 3 personality-driven interaction prompts
   - Potential character conflicts or growth arcs
   - Speech patterns or mannerisms

**Character Guidelines**:
- Make the character immediately playable
- Include both strengths and flaws for depth
- Ensure they fit the world's tone and setting
- Provide clear roleplay opportunities

Create a character that feels alive and ready for adventure!`,

    variables: [
      {
        name: 'worldContext',
        type: 'string',
        description: 'Brief world setting context',
        required: true,
      },
      {
        name: 'race',
        type: 'string',
        description: 'Character race/species',
        required: false,
      },
      {
        name: 'class',
        type: 'string',
        description: 'Character class/profession',
        required: false,
      },
      {
        name: 'level',
        type: 'number',
        description: 'Character level',
        required: true,
      },
      {
        name: 'personality',
        type: 'string',
        description: 'Personality archetype',
        required: false,
      },
      {
        name: 'background',
        type: 'string',
        description: 'Character background',
        required: false,
      },
    ],

    constraints: [
      {
        type: 'length',
        description: 'Detailed but manageable',
        parameters: { minWords: 250, maxWords: 600 },
      },
      {
        type: 'tone',
        description: 'Engaging and inspiring',
        parameters: { style: 'heroic' },
      },
      {
        type: 'content',
        description: 'Inclusive representation',
        parameters: { diversity: 'encouraged' },
      },
    ],

    metadata: {
      author: 'AI/ML Specialist',
      version: '1.0.0',
      createdAt: new Date(),
      lastModified: new Date(),
      tags: ['rpg', 'character', 'creation', 'backstory'],
      usage: {
        timesUsed: 0,
        avgResponseTime: 0,
        successRate: 0,
        avgTokensUsed: 0,
        userSatisfaction: 0,
      },
      rating: 0,
    },
  },

  NARRATIVE_CONTINUATION: {
    id: 'rpg_narrative_continuation',
    name: 'RPG Narrative Continuation',
    category: 'narrative_continuation' as PromptCategory,
    gameType: 'rpg' as GameType,
    template: `Continue this RPG adventure with compelling narrative development.

**Current Situation**: {{currentSituation}}
**Recent Player Actions**: {{playerActions}}
**World State**: {{worldState}}
**Narrative Tone**: {{tone}}
**Scene Length**: {{length}}
**Difficulty**: {{includeDifficulty}}

Based on the players' actions, advance the story with:

1. **IMMEDIATE CONSEQUENCES**
   - Direct results of player actions
   - Environmental or NPC reactions
   - Success/failure outcomes with interesting complications

2. **SCENE DEVELOPMENT**
   - Vivid sensory descriptions
   - Character interactions and dialogue
   - Tension and pacing appropriate to the moment

3. **NEW CHALLENGES**
   - Obstacles that arise naturally from the situation
   - Opportunities for different character types to shine
   - Moral dilemmas or interesting choices

4. **NARRATIVE HOOKS**
   - Clues about larger mysteries
   - Foreshadowing of future events
   - Character development opportunities

**Narrative Guidelines**:
- Build on player agency - their actions matter
- Maintain consistent tone and world logic
- Include opportunities for all players to engage
- Balance action, roleplay, and exploration
- End with a clear decision point or next action prompt

Show, don't tell - immerse the players in the experience!`,

    variables: [
      {
        name: 'currentSituation',
        type: 'string',
        description: 'Current game state and situation',
        required: true,
      },
      {
        name: 'playerActions',
        type: 'array',
        description: 'Recent player actions',
        required: true,
      },
      {
        name: 'worldState',
        type: 'object',
        description: 'Current world state information',
        required: true,
      },
      {
        name: 'tone',
        type: 'string',
        description: 'Desired narrative tone',
        required: true,
      },
      {
        name: 'length',
        type: 'string',
        description: 'Scene length preference',
        required: true,
        validation: { allowedValues: ['short', 'medium', 'long'] },
      },
      {
        name: 'includeDifficulty',
        type: 'string',
        description: 'Challenge difficulty',
        required: false,
        validation: { allowedValues: ['easy', 'medium', 'hard'] },
      },
    ],

    constraints: [
      {
        type: 'format',
        description: 'Immersive narrative style',
        parameters: { perspective: 'second_person' },
      },
      {
        type: 'tone',
        description: 'Match game tone',
        parameters: { consistency: 'required' },
      },
      {
        type: 'length',
        description: 'Appropriate scene length',
        parameters: { variable: 'based_on_length_param' },
      },
    ],

    metadata: {
      author: 'AI/ML Specialist',
      version: '1.0.0',
      createdAt: new Date(),
      lastModified: new Date(),
      tags: ['rpg', 'narrative', 'storytelling', 'scene'],
      usage: {
        timesUsed: 0,
        avgResponseTime: 0,
        successRate: 0,
        avgTokensUsed: 0,
        userSatisfaction: 0,
      },
      rating: 0,
    },
  },

  COMBAT_NARRATION: {
    id: 'rpg_combat_narration',
    name: 'RPG Combat Narration',
    category: 'narrative_continuation' as PromptCategory,
    gameType: 'rpg' as GameType,
    template: `Narrate this combat encounter with cinematic flair and tactical clarity.

**Combat Situation**: {{combatSituation}}
**Participants**: {{participants}}
**Environment**: {{environment}}
**Action Results**: {{actionResults}}
**Combat Phase**: {{phase}}

Create engaging combat narration that includes:

1. **ACTION DESCRIPTION**
   - Vivid, specific descriptions of attacks, movements, and tactics
   - Environmental interactions and positioning
   - Emotional reactions and character moments

2. **TACTICAL SITUATION**
   - Current positioning and advantages/disadvantages
   - Environmental factors affecting combat
   - Strategic opportunities and threats

3. **SENSORY DETAILS**
   - Sounds, sights, and atmosphere of battle
   - Impact and consequence of attacks
   - Tension and momentum shifts

4. **CHARACTER MOMENTS**
   - Heroic actions and clever tactics
   - Close calls and dramatic saves
   - Personality showing through combat style

**Combat Narration Guidelines**:
- Make every action feel impactful and meaningful
- Maintain clear tactical information while being cinematic
- Show personality and relationships through combat interactions
- Build tension and excitement without glorifying violence
- End with clear setup for the next action or phase

Transform mechanics into memorable moments!`,

    variables: [
      {
        name: 'combatSituation',
        type: 'string',
        description: 'Current combat state',
        required: true,
      },
      {
        name: 'participants',
        type: 'array',
        description: 'All combatants involved',
        required: true,
      },
      {
        name: 'environment',
        type: 'string',
        description: 'Combat environment and terrain',
        required: true,
      },
      {
        name: 'actionResults',
        type: 'array',
        description: 'Results of recent actions',
        required: true,
      },
      {
        name: 'phase',
        type: 'string',
        description: 'Current combat phase',
        required: true,
      },
    ],

    constraints: [
      {
        type: 'tone',
        description: 'Heroic but not graphic',
        parameters: { violence_level: 'fantasy' },
      },
      {
        type: 'length',
        description: 'Engaging but focused',
        parameters: { minWords: 150, maxWords: 400 },
      },
      {
        type: 'content',
        description: 'Age-appropriate action',
        parameters: { rating: 'teen' },
      },
    ],

    metadata: {
      author: 'AI/ML Specialist',
      version: '1.0.0',
      createdAt: new Date(),
      lastModified: new Date(),
      tags: ['rpg', 'combat', 'narration', 'action'],
      usage: {
        timesUsed: 0,
        avgResponseTime: 0,
        successRate: 0,
        avgTokensUsed: 0,
        userSatisfaction: 0,
      },
      rating: 0,
    },
  },

  NPC_DIALOGUE: {
    id: 'rpg_npc_dialogue',
    name: 'RPG NPC Dialogue Generation',
    category: 'dialogue_generation' as PromptCategory,
    gameType: 'rpg' as GameType,
    template: `Generate authentic dialogue for this NPC interaction.

**NPC Profile**: {{npcProfile}}
**Current Context**: {{context}}
**Player Approach**: {{playerApproach}}
**Relationship Level**: {{relationshipLevel}}
**Information Level**: {{informationLevel}}

Create natural, character-driven dialogue that includes:

1. **CHARACTER VOICE**
   - Speech patterns, vocabulary, and mannerisms
   - Personality coming through in word choice
   - Cultural or regional dialect/accent (if appropriate)

2. **CONTEXTUAL RESPONSE**
   - Reaction to player approach and past interactions
   - Information sharing based on relationship and context
   - Emotional state and motivations affecting responses

3. **INTERACTIVE ELEMENTS**
   - Questions that engage players
   - Opportunities for further conversation
   - Hints at deeper knowledge or connections

4. **WORLD INTEGRATION**
   - References to world events and locations
   - Connections to other NPCs and factions
   - Hooks for future interactions

**Dialogue Guidelines**:
- Make each NPC feel unique and memorable
- Balance information sharing with natural conversation
- Include subtext and personality depth
- Provide clear conversation paths and choices
- Show relationships and history through dialogue

Format as natural conversation with action descriptions in brackets.`,

    variables: [
      {
        name: 'npcProfile',
        type: 'object',
        description: 'NPC personality and background',
        required: true,
      },
      {
        name: 'context',
        type: 'string',
        description: 'Current situation and setting',
        required: true,
      },
      {
        name: 'playerApproach',
        type: 'string',
        description: 'How players approached the NPC',
        required: true,
      },
      {
        name: 'relationshipLevel',
        type: 'string',
        description: 'Relationship with players',
        required: true,
      },
      {
        name: 'informationLevel',
        type: 'string',
        description: 'How much NPC knows/shares',
        required: true,
      },
    ],

    constraints: [
      {
        type: 'tone',
        description: 'Natural conversation flow',
        parameters: { style: 'conversational' },
      },
      {
        type: 'format',
        description: 'Clear dialogue format',
        parameters: { brackets_for_actions: true },
      },
      {
        type: 'length',
        description: 'Engaging but not overwhelming',
        parameters: { minWords: 100, maxWords: 300 },
      },
    ],

    metadata: {
      author: 'AI/ML Specialist',
      version: '1.0.0',
      createdAt: new Date(),
      lastModified: new Date(),
      tags: ['rpg', 'npc', 'dialogue', 'character'],
      usage: {
        timesUsed: 0,
        avgResponseTime: 0,
        successRate: 0,
        avgTokensUsed: 0,
        userSatisfaction: 0,
      },
      rating: 0,
    },
  },

  // ========================================================================
  // DEDUCTION GAME PROMPTS
  // ========================================================================

  DEDUCTION_CLUES: {
    id: 'deduction_clue_generation',
    name: 'Deduction Game Clue Generation',
    category: 'clue_creation' as PromptCategory,
    gameType: 'deduction' as GameType,
    template: `Generate compelling clues for this social deduction game.

**Game Theme**: {{theme}}
**Player Count**: {{playerCount}}
**Scenario**: {{scenario}}
**Role Distribution**: {{roleDistribution}}
**Game Phase**: {{gamePhase}}
**Complexity Level**: {{complexity}}

Create a balanced set of clues that includes:

1. **DIRECT EVIDENCE** (1-2 clues)
   - Clear information about specific players or roles
   - Verifiable through game mechanics
   - Balanced to not immediately solve the game

2. **CIRCUMSTANTIAL EVIDENCE** (2-3 clues)
   - Suggestive information requiring interpretation
   - Multiple possible explanations
   - Encourages discussion and deduction

3. **RED HERRINGS** (1-2 clues)
   - Misleading but plausible information
   - Creates doubt and alternative theories
   - Balanced to create tension without frustration

4. **NARRATIVE FLAVOR**
   - Thematic elements that enhance immersion
   - Character backgrounds and motivations
   - Setting details that support the scenario

**Clue Design Guidelines**:
- Ensure each clue is meaningful and discussable
- Balance information revelation with mystery maintenance
- Create multiple viable theories and suspects
- Include social dynamics and player psychology elements
- Make clues discoverable through different play styles

Generate clues that reward both logical deduction and social reading!`,

    variables: [
      {
        name: 'theme',
        type: 'string',
        description: 'Game theme/setting',
        required: true,
      },
      {
        name: 'playerCount',
        type: 'number',
        description: 'Number of players',
        required: true,
      },
      {
        name: 'scenario',
        type: 'string',
        description: 'Specific game scenario',
        required: true,
      },
      {
        name: 'roleDistribution',
        type: 'object',
        description: 'How roles are distributed',
        required: true,
      },
      {
        name: 'gamePhase',
        type: 'string',
        description: 'Current game phase',
        required: true,
      },
      {
        name: 'complexity',
        type: 'string',
        description: 'Clue complexity level',
        required: true,
        validation: { allowedValues: ['simple', 'moderate', 'complex'] },
      },
    ],

    constraints: [
      {
        type: 'balance',
        description: 'Balanced information revelation',
        parameters: { fair_play: true },
      },
      {
        type: 'length',
        description: 'Digestible clue length',
        parameters: { maxWords: 200 },
      },
      {
        type: 'complexity',
        description: 'Appropriate challenge level',
        parameters: { scalable: true },
      },
    ],

    metadata: {
      author: 'AI/ML Specialist',
      version: '1.0.0',
      createdAt: new Date(),
      lastModified: new Date(),
      tags: ['deduction', 'clues', 'mystery', 'social'],
      usage: {
        timesUsed: 0,
        avgResponseTime: 0,
        successRate: 0,
        avgTokensUsed: 0,
        userSatisfaction: 0,
      },
      rating: 0,
    },
  },

  ROLE_GENERATION: {
    id: 'deduction_role_generation',
    name: 'Deduction Game Role Generation',
    category: 'role_generation' as PromptCategory,
    gameType: 'deduction' as GameType,
    template: `Create balanced roles for this social deduction game.

**Theme**: {{theme}}
**Player Count**: {{playerCount}}
**Complexity**: {{complexity}}
**Scenario**: {{scenario}}
**Balance Preference**: {{balancing}}

Design a complete role set that includes:

1. **TOWN ROLES** (Majority team)
   - **Core Investigative Roles**: Information gathering abilities
   - **Protective Roles**: Defense and support abilities  
   - **Power Roles**: Special abilities that impact game flow
   - **Vanilla Town**: Citizens with voting power only

2. **MAFIA ROLES** (Minority team)
   - **Mafia Members**: Core elimination abilities
   - **Support Roles**: Information or protection for mafia
   - **Deception Roles**: Abilities that confuse or misdirect

3. **NEUTRAL/THIRD PARTY** (If applicable)
   - Independent win conditions
   - Roles that can shift game balance
   - Wild card elements

**Role Design Requirements**:
- Each role should have clear, unique abilities
- Abilities should be thematic and intuitive
- Balance between information and action roles
- Consider counter-play and role interactions
- Include both simple and complex roles for variety

**Balance Guidelines**:
- Information roles balanced by deception/blocking
- Power roles have appropriate limitations
- Win conditions achievable for all factions
- No single role dominates the game

Provide role names, abilities, and brief flavor text for each role.`,

    variables: [
      {
        name: 'theme',
        type: 'string',
        description: 'Game theme/setting',
        required: true,
      },
      {
        name: 'playerCount',
        type: 'number',
        description: 'Total number of players',
        required: true,
      },
      {
        name: 'complexity',
        type: 'string',
        description: 'Role complexity level',
        required: true,
        validation: { allowedValues: ['simple', 'moderate', 'complex'] },
      },
      {
        name: 'scenario',
        type: 'string',
        description: 'Specific scenario context',
        required: true,
      },
      {
        name: 'balancing',
        type: 'string',
        description: 'Balance preference',
        required: true,
        validation: {
          allowedValues: ['favor_town', 'balanced', 'favor_mafia'],
        },
      },
    ],

    constraints: [
      {
        type: 'balance',
        description: 'Faction balance',
        parameters: { mathematical_balance: true },
      },
      {
        type: 'complexity',
        description: 'Appropriate role complexity',
        parameters: { scalable: true },
      },
      {
        type: 'theme',
        description: 'Thematic consistency',
        parameters: { flavor_important: true },
      },
    ],

    metadata: {
      author: 'AI/ML Specialist',
      version: '1.0.0',
      createdAt: new Date(),
      lastModified: new Date(),
      tags: ['deduction', 'roles', 'balance', 'game-design'],
      usage: {
        timesUsed: 0,
        avgResponseTime: 0,
        successRate: 0,
        avgTokensUsed: 0,
        userSatisfaction: 0,
      },
      rating: 0,
    },
  },

  DEDUCTION_NARRATIVE: {
    id: 'deduction_narrative_setup',
    name: 'Deduction Game Narrative Setup',
    category: 'narrative_continuation' as PromptCategory,
    gameType: 'deduction' as GameType,
    template: `Create an engaging narrative setup for this social deduction game.

**Theme**: {{theme}}
**Setting**: {{setting}}
**Player Count**: {{playerCount}}
**Scenario Type**: {{scenarioType}}
**Tone**: {{tone}}

Develop a compelling narrative framework:

1. **SETTING ESTABLISHMENT**
   - Vivid location description with atmosphere
   - Historical or contextual background
   - Why everyone is gathered in this place
   - Environmental factors that isolate the group

2. **INCITING INCIDENT**
   - The event that starts the game (murder, betrayal, etc.)
   - Initial evidence and circumstances
   - Immediate reactions and shock
   - Stakes and urgency

3. **CHARACTER MOTIVATIONS**
   - Why each character archetype is present
   - Potential motives for various actions
   - Relationships and tensions between characters
   - Secrets and hidden agendas

4. **GAME FRAMEWORK**
   - How information is discovered and shared
   - The process of discussion and accusation
   - Consequences of decisions
   - Victory conditions in narrative terms

**Narrative Guidelines**:
- Create immersive atmosphere appropriate to theme
- Establish clear stakes and urgency
- Balance realistic motivations with game mechanics
- Include hooks for roleplay and character development
- End with clear transition to game phase

Build a world where every accusation feels meaningful!`,

    variables: [
      {
        name: 'theme',
        type: 'string',
        description: 'Game theme/genre',
        required: true,
      },
      {
        name: 'setting',
        type: 'string',
        description: 'Specific location/setting',
        required: true,
      },
      {
        name: 'playerCount',
        type: 'number',
        description: 'Number of participants',
        required: true,
      },
      {
        name: 'scenarioType',
        type: 'string',
        description: 'Type of scenario',
        required: true,
      },
      {
        name: 'tone',
        type: 'string',
        description: 'Narrative tone',
        required: true,
      },
    ],

    constraints: [
      {
        type: 'atmosphere',
        description: 'Immersive setting',
        parameters: { mood_important: true },
      },
      {
        type: 'length',
        description: 'Comprehensive but focused',
        parameters: { minWords: 300, maxWords: 600 },
      },
      {
        type: 'clarity',
        description: 'Clear game setup',
        parameters: { rules_integration: true },
      },
    ],

    metadata: {
      author: 'AI/ML Specialist',
      version: '1.0.0',
      createdAt: new Date(),
      lastModified: new Date(),
      tags: ['deduction', 'narrative', 'setup', 'immersion'],
      usage: {
        timesUsed: 0,
        avgResponseTime: 0,
        successRate: 0,
        avgTokensUsed: 0,
        userSatisfaction: 0,
      },
      rating: 0,
    },
  },

  // ========================================================================
  // VILLAGE SIMULATION PROMPTS
  // ========================================================================

  VILLAGE_EVENTS: {
    id: 'village_event_generation',
    name: 'Village Event Generation',
    category: 'event_creation' as PromptCategory,
    gameType: 'village' as GameType,
    template: `Generate a dynamic village event based on current conditions.

**Current Village State**: {{villageState}}
**Season**: {{season}}
**Event Severity**: {{severity}}
**Previous Events**: {{previousEvents}}
**Population Mood**: {{populationMood}}
**Resource Levels**: {{resourceLevels}}

Create a comprehensive village event:

1. **EVENT DESCRIPTION**
   - Clear, engaging description of what happens
   - Immediate visible effects on the village
   - Atmospheric details and NPC reactions
   - Timeline and duration of the event

2. **MECHANICAL EFFECTS**
   - Resource impacts (positive/negative)
   - Population changes (health, happiness, skills)
   - Building or infrastructure effects
   - Environmental or seasonal interactions

3. **DECISION OPPORTUNITIES**
   - 2-3 meaningful response choices for players
   - Different approaches with distinct outcomes
   - Short-term vs long-term considerations
   - Resource investment vs acceptance options

4. **CONSEQUENCES & OUTCOMES**
   - Immediate results of each decision path
   - Long-term implications and follow-up events
   - Ripple effects on village systems
   - Character development opportunities

**Event Design Guidelines**:
- Events should feel natural to the world and season
- Multiple solutions encourage different playstyles
- Consequences should be meaningful but not game-ending
- Include both challenge and opportunity elements
- Connect to village's history and ongoing narratives

Create events that make the village feel alive and dynamic!`,

    variables: [
      {
        name: 'villageState',
        type: 'object',
        description: 'Current village statistics and status',
        required: true,
      },
      {
        name: 'season',
        type: 'string',
        description: 'Current season/time period',
        required: true,
      },
      {
        name: 'severity',
        type: 'string',
        description: 'Event impact level',
        required: true,
        validation: {
          allowedValues: ['minor', 'moderate', 'major', 'catastrophic'],
        },
      },
      {
        name: 'previousEvents',
        type: 'array',
        description: 'Recent events for context',
        required: true,
      },
      {
        name: 'populationMood',
        type: 'string',
        description: 'General villager sentiment',
        required: true,
      },
      {
        name: 'resourceLevels',
        type: 'object',
        description: 'Current resource availability',
        required: true,
      },
    ],

    constraints: [
      {
        type: 'balance',
        description: 'Appropriate challenge level',
        parameters: { severity_based: true },
      },
      {
        type: 'realism',
        description: 'Believable village dynamics',
        parameters: { simulation_logic: true },
      },
      {
        type: 'engagement',
        description: 'Meaningful player choices',
        parameters: { decision_quality: 'important' },
      },
    ],

    metadata: {
      author: 'AI/ML Specialist',
      version: '1.0.0',
      createdAt: new Date(),
      lastModified: new Date(),
      tags: ['village', 'events', 'simulation', 'decisions'],
      usage: {
        timesUsed: 0,
        avgResponseTime: 0,
        successRate: 0,
        avgTokensUsed: 0,
        userSatisfaction: 0,
      },
      rating: 0,
    },
  },

  NPC_BEHAVIOR: {
    id: 'village_npc_behavior',
    name: 'Village NPC Behavior Generation',
    category: 'npc_behavior' as PromptCategory,
    gameType: 'village' as GameType,
    template: `Generate authentic NPC behavior for this village context.

**NPC Profile**: {{npcProfile}}
**Village Context**: {{villageContext}}
**Current Situation**: {{currentSituation}}
**Player Interaction**: {{playerInteraction}}
**Time/Season**: {{timeSeason}}
**Relationship History**: {{relationshipHistory}}

Create realistic NPC responses and behaviors:

1. **PERSONALITY EXPRESSION**
   - Consistent character traits and quirks
   - Emotional reactions appropriate to situation
   - Personal goals and motivations
   - Cultural and social background influence

2. **CONTEXTUAL BEHAVIOR**
   - Response to current village state
   - Adaptation to seasonal or event changes
   - Professional role and responsibilities
   - Family and social obligations

3. **INTERACTION DYNAMICS**
   - Reaction to player approach and history
   - Information sharing based on trust level
   - Requests, offers, or bargaining opportunities
   - Gossip and social information

4. **DAILY LIFE SIMULATION**
   - Routine activities and schedules
   - Reactions to village events and changes
   - Relationships with other NPCs
   - Personal problems and concerns

**NPC Behavior Guidelines**:
- Make each NPC feel like a real person with agency
- Show the impact of village conditions on individuals
- Create opportunities for ongoing relationships
- Balance helpful information with realistic limitations
- Include both serious and light-hearted interactions

Generate NPCs that make the village feel lived-in and authentic!`,

    variables: [
      {
        name: 'npcProfile',
        type: 'object',
        description: 'NPC personality, profession, and background',
        required: true,
      },
      {
        name: 'villageContext',
        type: 'object',
        description: 'Current village state and conditions',
        required: true,
      },
      {
        name: 'currentSituation',
        type: 'string',
        description: 'Immediate context of interaction',
        required: true,
      },
      {
        name: 'playerInteraction',
        type: 'string',
        description: 'How player is approaching NPC',
        required: true,
      },
      {
        name: 'timeSeason',
        type: 'string',
        description: 'Time of day and season',
        required: true,
      },
      {
        name: 'relationshipHistory',
        type: 'string',
        description: 'Past interactions with player',
        required: true,
      },
    ],

    constraints: [
      {
        type: 'consistency',
        description: 'Character consistency',
        parameters: { personality_stable: true },
      },
      {
        type: 'realism',
        description: 'Believable human behavior',
        parameters: { psychology_based: true },
      },
      {
        type: 'engagement',
        description: 'Interesting interactions',
        parameters: { player_agency: 'important' },
      },
    ],

    metadata: {
      author: 'AI/ML Specialist',
      version: '1.0.0',
      createdAt: new Date(),
      lastModified: new Date(),
      tags: ['village', 'npc', 'behavior', 'simulation', 'character'],
      usage: {
        timesUsed: 0,
        avgResponseTime: 0,
        successRate: 0,
        avgTokensUsed: 0,
        userSatisfaction: 0,
      },
      rating: 0,
    },
  },

  VILLAGE_ADVICE: {
    id: 'village_management_advice',
    name: 'Village Management Advice',
    category: 'rule_interpretation' as PromptCategory,
    gameType: 'village' as GameType,
    template: `Provide strategic village management advice as a wise counselor.

**Village Status**: {{villageStatus}}
**Current Challenges**: {{currentChallenges}}
**Available Resources**: {{availableResources}}
**Upcoming Season**: {{upcomingSeason}}
**Player Goals**: {{playerGoals}}
**Risk Factors**: {{riskFactors}}

Offer thoughtful guidance covering:

1. **IMMEDIATE PRIORITIES**
   - Most urgent issues requiring attention
   - Resource allocation recommendations
   - Critical timing considerations
   - Risk mitigation strategies

2. **STRATEGIC PLANNING**
   - Medium-term development opportunities
   - Building and infrastructure priorities
   - Population growth and skill development
   - Trade and diplomatic considerations

3. **SEASONAL PREPARATION**
   - Upcoming seasonal challenges and opportunities
   - Resource stockpiling recommendations
   - Building projects to complete before season change
   - Population preparation activities

4. **ALTERNATIVE APPROACHES**
   - Multiple viable strategies for major decisions
   - Trade-offs and consequences of different paths
   - Creative solutions to complex problems
   - Emergency contingency plans

**Advice Guidelines**:
- Present multiple viable options, not single solutions
- Explain reasoning and potential consequences
- Consider both short-term and long-term impacts
- Account for available resources and constraints
- Maintain encouraging but realistic tone

Frame advice as suggestions from an experienced village elder!`,

    variables: [
      {
        name: 'villageStatus',
        type: 'object',
        description: 'Comprehensive village statistics',
        required: true,
      },
      {
        name: 'currentChallenges',
        type: 'array',
        description: 'Active problems and obstacles',
        required: true,
      },
      {
        name: 'availableResources',
        type: 'object',
        description: 'Current resource inventory',
        required: true,
      },
      {
        name: 'upcomingSeason',
        type: 'string',
        description: 'Next season/time period',
        required: true,
      },
      {
        name: 'playerGoals',
        type: 'array',
        description: 'Stated player objectives',
        required: true,
      },
      {
        name: 'riskFactors',
        type: 'array',
        description: 'Potential threats and risks',
        required: true,
      },
    ],

    constraints: [
      {
        type: 'helpfulness',
        description: 'Actionable advice',
        parameters: { specific_recommendations: true },
      },
      {
        type: 'balance',
        description: 'Multiple perspectives',
        parameters: { options_provided: true },
      },
      {
        type: 'tone',
        description: 'Encouraging mentor voice',
        parameters: { supportive_guidance: true },
      },
    ],

    metadata: {
      author: 'AI/ML Specialist',
      version: '1.0.0',
      createdAt: new Date(),
      lastModified: new Date(),
      tags: ['village', 'strategy', 'advice', 'management'],
      usage: {
        timesUsed: 0,
        avgResponseTime: 0,
        successRate: 0,
        avgTokensUsed: 0,
        userSatisfaction: 0,
      },
      rating: 0,
    },
  },

  NPC_GENERATION: {
    id: 'village_npc_generation',
    name: 'Village NPC Generation',
    category: 'content_generation' as PromptCategory,
    gameType: 'village' as GameType,
    template: `Generate a realistic and engaging NPC for a village simulation.

**Village Context**: {{village}}
**Demographics**: {{demographics}} 
**Current Situation**: {{context}}

Create a believable NPC with the following details:

1. **BASIC INFORMATION**
   - Name (culturally appropriate for village setting)
   - Age, gender, physical description
   - Profession and skill level
   - Social status and reputation

2. **PERSONALITY TRAITS**
   - Core personality dimensions (Big Five traits)
   - Unique quirks and habits
   - Speech patterns and mannerisms
   - Values and beliefs

3. **BACKGROUND & HISTORY**
   - Place of birth (local vs. newcomer)
   - Family connections within village
   - Previous life experiences
   - Significant events that shaped them

4. **CURRENT SITUATION**
   - Employment and economic status
   - Housing and living arrangements
   - Relationship status and social connections
   - Current goals and concerns

5. **BEHAVIOR PATTERNS**
   - Daily routine and work schedule
   - Social tendencies and preferred activities
   - How they handle stress and conflict
   - Decision-making style

6. **VILLAGE INTEGRATION**
   - Role in village community
   - Relationships with other residents
   - Contributions to village life
   - Future ambitions

**Generation Guidelines**:
- Create NPCs that feel authentic and three-dimensional
- Ensure profession matches village needs and economy
- Consider how NPC fits into existing social fabric
- Include potential for character growth and change
- Balance strengths and flaws for believability

Return as structured JSON with all details clearly organized.`,

    variables: [
      {
        name: 'village',
        type: 'object',
        description: 'Village characteristics and culture',
        required: true,
      },
      {
        name: 'demographics',
        type: 'object',
        description: 'Population statistics and skill distribution',
        required: true,
      },
      {
        name: 'context',
        type: 'object',
        description: 'Current events and village situation',
        required: true,
      },
    ],

    constraints: [
      {
        type: 'creativity',
        description: 'Unique character creation',
        parameters: { originality_required: true },
      },
      {
        type: 'consistency',
        description: 'Coherent background',
        parameters: { logical_history: true },
      },
      {
        type: 'depth',
        description: 'Multi-dimensional personality',
        parameters: { complex_character: true },
      },
    ],

    metadata: {
      author: 'AI/ML Specialist',
      version: '1.0.0',
      createdAt: new Date(),
      lastModified: new Date(),
      tags: ['village', 'npc', 'character', 'generation'],
      usage: {
        timesUsed: 0,
        avgResponseTime: 0,
        successRate: 0,
        avgTokensUsed: 0,
        userSatisfaction: 0,
      },
      rating: 0,
    },
  },

  NPC_DIALOGUE: {
    id: 'village_npc_dialogue',
    name: 'Village NPC Dialogue',
    category: 'content_generation' as PromptCategory,
    gameType: 'village' as GameType,
    template: `Generate contextual dialogue for an NPC in a village simulation.

**NPC Profile**: {{npc}}
**Player Information**: {{player}}
**Conversation Context**: {{context}}
**Village State**: {{village}}

Create authentic dialogue that reflects:

1. **PERSONALITY EXPRESSION**
   - NPC's speech patterns and vocabulary
   - Emotional state and current mood
   - Personal quirks and mannerisms
   - Educational background and intelligence level

2. **RELATIONSHIP DYNAMICS**
   - History between NPC and player
   - Current relationship status
   - Trust level and familiarity
   - Recent interactions and their outcomes

3. **CONTEXTUAL AWARENESS**
   - Current topic and conversation goal
   - Location and time of day
   - Recent village events and their impact
   - Ongoing crises or celebrations

4. **VILLAGE INTEGRATION**
   - Local knowledge and gossip
   - Community concerns and interests  
   - Cultural references and shared experiences
   - Professional expertise and insights

**Dialogue Requirements**:
- Natural, believable conversation flow
- Consistent with NPC's established personality
- Responsive to player's reputation and actions
- Includes emotional subtext and motivations
- Provides village lore and worldbuilding details
- Offers gameplay opportunities (quests, trades, information)

Generate 3-5 dialogue options showing different emotional tones or conversation directions.`,

    variables: [
      {
        name: 'npc',
        type: 'object',
        description: 'NPC personality and current state',
        required: true,
      },
      {
        name: 'player',
        type: 'object',
        description: 'Player reputation and relationship',
        required: true,
      },
      {
        name: 'context',
        type: 'object',
        description: 'Conversation context and topic',
        required: true,
      },
      {
        name: 'village',
        type: 'object',
        description: 'Current village state and events',
        required: true,
      },
    ],

    constraints: [
      {
        type: 'authenticity',
        description: 'Natural dialogue',
        parameters: { believable_speech: true },
      },
      {
        type: 'consistency',
        description: 'Character voice',
        parameters: { personality_match: true },
      },
      {
        type: 'engagement',
        description: 'Interactive conversation',
        parameters: { player_agency: true },
      },
    ],

    metadata: {
      author: 'AI/ML Specialist',
      version: '1.0.0',
      createdAt: new Date(),
      lastModified: new Date(),
      tags: ['village', 'npc', 'dialogue', 'conversation'],
      usage: {
        timesUsed: 0,
        avgResponseTime: 0,
        successRate: 0,
        avgTokensUsed: 0,
        userSatisfaction: 0,
      },
      rating: 0,
    },
  },

  NPC_PERSONALITY_ANALYSIS: {
    id: 'village_npc_personality',
    name: 'NPC Personality Analysis',
    category: 'analysis' as PromptCategory,
    gameType: 'village' as GameType,
    template: `Analyze and expand an NPC's personality profile for village simulation.

**Base NPC Data**: {{npcData}}
**Village Culture**: {{villageCulture}}
**Social Context**: {{socialContext}}

Provide a comprehensive personality analysis including:

1. **BIG FIVE PERSONALITY DIMENSIONS**
   - Extraversion (0-100): Social energy and assertiveness
   - Agreeableness (0-100): Cooperation and trust
   - Conscientiousness (0-100): Organization and discipline  
   - Neuroticism (0-100): Emotional stability and stress response
   - Openness (0-100): Creativity and openness to experience

2. **BEHAVIORAL TENDENCIES**
   - Decision-making style (impulsive, deliberate, group-oriented)
   - Risk tolerance and crisis response patterns
   - Social interaction preferences and energy levels
   - Work habits and professional approach
   - Conflict resolution style

3. **CULTURAL INTEGRATION**
   - How personality fits with village values
   - Potential sources of social friction
   - Leadership potential and community role
   - Adaptability to village changes

4. **PSYCHOLOGICAL DEPTH**
   - Core motivations and fears
   - Personal growth potential
   - Relationship attachment styles
   - Stress triggers and coping mechanisms

5. **PRACTICAL APPLICATIONS**
   - Predicted reactions to common village scenarios
   - Compatibility with different professions
   - Social network formation tendencies
   - Learning and skill development patterns

**Analysis Guidelines**:
- Base assessment on observable traits and background
- Consider cultural context and social environment
- Provide actionable insights for NPC behavior simulation
- Include both strengths and potential challenges
- Suggest character development opportunities

Return detailed personality profile with numerical scores and behavioral predictions.`,

    variables: [
      {
        name: 'npcData',
        type: 'object',
        description: 'Basic NPC information and traits',
        required: true,
      },
      {
        name: 'villageCulture',
        type: 'object',
        description: 'Village values and social norms',
        required: true,
      },
      {
        name: 'socialContext',
        type: 'object',
        description: 'Current social dynamics',
        required: true,
      },
    ],

    constraints: [
      {
        type: 'psychological_accuracy',
        description: 'Realistic personality model',
        parameters: { evidence_based: true },
      },
      {
        type: 'cultural_sensitivity',
        description: 'Appropriate for village setting',
        parameters: { contextually_appropriate: true },
      },
      {
        type: 'actionable_insights',
        description: 'Practical behavior predictions',
        parameters: { simulation_useful: true },
      },
    ],

    metadata: {
      author: 'AI/ML Specialist',
      version: '1.0.0',
      createdAt: new Date(),
      lastModified: new Date(),
      tags: ['village', 'npc', 'personality', 'psychology'],
      usage: {
        timesUsed: 0,
        avgResponseTime: 0,
        successRate: 0,
        avgTokensUsed: 0,
        userSatisfaction: 0,
      },
      rating: 0,
    },
  },
};

// ============================================================================
// PROMPT ENGINE INSTANCE & UTILITIES
// ============================================================================

// Create singleton instance
export const promptEngine = new PromptEngine();

// Initialize templates
Object.values(PROMPTS).forEach(template => {
  promptEngine.registerTemplate(template as PromptTemplate);
});

/**
 * Utility function to generate prompt with validation
 */
export async function generatePrompt(
  templateId: string,
  context: PromptContext,
  options?: PromptGenerationOptions
): Promise<GeneratedPrompt> {
  return promptEngine.generatePrompt(templateId, context, options);
}

/**
 * Utility function to validate prompt context
 */
export function validatePromptContext(
  templateId: string,
  context: PromptContext
): { valid: boolean; errors: string[] } {
  const template = (PROMPTS as any)[templateId.toUpperCase()];
  if (!template) {
    return { valid: false, errors: [`Template not found: ${templateId}`] };
  }

  const errors: string[] = [];

  for (const variable of template.variables) {
    if (variable.required && !(variable.name in context.variables)) {
      errors.push(`Required variable missing: ${variable.name}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// TODO: Implement prompt caching service for frequently used prompts
// TODO: Add prompt effectiveness analytics dashboard
// TODO: Implement machine learning for prompt optimization
// TODO: Add multi-language support for international players
// TODO: Create prompt versioning system for rollback capabilities
// TODO: Implement content rating system integration
// TODO: Add prompt generation API rate limiting
// TODO: Create prompt template editor interface for game designers
