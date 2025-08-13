/**
 * AI Response Processing System for RpgAInfinity
 * Handles parsing, validation, safety filtering, and quality scoring of AI-generated content
 *
 * @author AI/ML Specialist
 * @version 1.0.0
 */

import { z } from 'zod';
import type {
  AIResponse,
  StructuredAIResponse,
  SafetyAnalysis,
  ProcessingResult,
  ValidationError,
  ValidationWarning,
  ProcessingMetadata,
} from '../../types/ai';
import type {
  WorldData,
  Character,
  NarrativeData,
  DialogueData,
  CombatData,
  NarrativeDataSchema,
  DialogueDataSchema,
  CombatDataSchema,
  CharacterSchema,
} from '../../types/rpg';
import type {
  ClueData,
  RoleAssignment,
  VotingResult,
  ClueDataSchema,
  RoleAssignmentSchema,
  VotingResultSchema,
} from '../../types/deduction';
import type {
  VillageEvent,
  NPCBehavior,
  ResourceEvent,
  NPCBehaviorSchema,
  ResourceEventSchema,
  VillageEventSchema,
} from '../../types/village';

// ============================================================================
// CORE PROCESSOR INTERFACE
// ============================================================================

export interface AIProcessor {
  processWorldGeneration(
    response: string
  ): Promise<ProcessingResult<WorldData>>;
  processCharacterGeneration(
    response: string
  ): Promise<ProcessingResult<Character>>;
  processNarrative(response: string): Promise<ProcessingResult<NarrativeData>>;
  processDialogue(response: string): Promise<ProcessingResult<DialogueData>>;
  processCombatResult(response: string): Promise<ProcessingResult<CombatData>>;
  processDeductionClues(response: string): Promise<ProcessingResult<ClueData>>;
  processVillageEvent(
    response: string
  ): Promise<ProcessingResult<VillageEvent>>;
}

export interface ProcessingResult<T> {
  readonly success: boolean;
  readonly data: T | null;
  readonly fallbackUsed: boolean;
  readonly validationErrors: ValidationError[];
  readonly warnings: ValidationWarning[];
  readonly metadata: ProcessingMetadata;
  readonly qualityScore: number; // 0-100
  readonly confidence: number; // 0-1
}

// ============================================================================
// JSON EXTRACTION UTILITIES
// ============================================================================

interface ExtractedJSON {
  data: any;
  source: 'direct' | 'markdown' | 'mixed' | 'fallback';
  confidence: number;
}

class JSONExtractor {
  /**
   * Robust JSON extraction from AI responses with multiple fallback strategies
   */
  static extract(rawResponse: string): ExtractedJSON {
    const startTime = performance.now();

    // Strategy 1: Direct JSON parsing
    try {
      const data = JSON.parse(rawResponse.trim());
      return {
        data,
        source: 'direct',
        confidence: 1.0,
      };
    } catch {
      // Continue to other strategies
    }

    // Strategy 2: Extract JSON from markdown code blocks
    const markdownMatches = rawResponse.match(
      /```(?:json)?\s*(\{[\s\S]*?\})\s*```/gi
    );
    if (markdownMatches) {
      for (const match of markdownMatches) {
        try {
          const jsonStr = match
            .replace(/```(?:json)?\s*/, '')
            .replace(/\s*```$/, '');
          const data = JSON.parse(jsonStr);
          return {
            data,
            source: 'markdown',
            confidence: 0.9,
          };
        } catch {
          continue;
        }
      }
    }

    // Strategy 3: Find JSON-like objects in mixed content
    const jsonMatches = rawResponse.match(/\{(?:[^{}]|{[^{}]*})*\}/g);
    if (jsonMatches) {
      // Try parsing each potential JSON object, starting with the largest
      const sortedMatches = jsonMatches.sort((a, b) => b.length - a.length);
      for (const match of sortedMatches) {
        try {
          const data = JSON.parse(match);
          // Validate it looks like game data
          if (
            typeof data === 'object' &&
            data !== null &&
            Object.keys(data).length > 0
          ) {
            return {
              data,
              source: 'mixed',
              confidence: 0.7,
            };
          }
        } catch {
          continue;
        }
      }
    }

    // Strategy 4: Attempt to parse as single-line JSON with fixes
    try {
      const cleaned = this.cleanupMalformedJSON(rawResponse);
      const data = JSON.parse(cleaned);
      return {
        data,
        source: 'fallback',
        confidence: 0.5,
      };
    } catch {
      // Final fallback - return raw text
      return {
        data: { content: rawResponse.trim() },
        source: 'fallback',
        confidence: 0.1,
      };
    }
  }

  /**
   * Cleanup common JSON formatting issues
   */
  private static cleanupMalformedJSON(text: string): string {
    return (
      text
        .trim()
        // Remove markdown formatting
        .replace(/^\*\*.*?\*\*:?\s*/gm, '')
        .replace(/^#+\s.*$/gm, '')
        // Fix common quote issues
        .replace(/'/g, '"')
        .replace(/"/g, '"')
        .replace(/"/g, '"')
        // Fix trailing commas
        .replace(/,(\s*[}\]])/g, '$1')
        // Fix missing quotes on keys
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
        // Remove extra whitespace
        .replace(/\s+/g, ' ')
    );
  }
}

// ============================================================================
// CONTENT SAFETY FILTERING
// ============================================================================

class ContentSafetyFilter {
  private static readonly INAPPROPRIATE_PATTERNS = [
    // Violence (excessive)
    /\b(torture|murder|kill|death|blood|gore)\b/gi,
    // Sexual content
    /\b(sex|sexual|nude|naked|intimate)\b/gi,
    // Profanity - basic filter
    /\b(damn|hell|stupid|idiot)\b/gi,
    // Discrimination
    /\b(racist|sexist|homophobic|transphobic)\b/gi,
  ];

  private static readonly FAMILY_FRIENDLY_REPLACEMENTS: Record<string, string> =
    {
      kill: 'defeat',
      murder: 'defeat',
      death: 'defeat',
      blood: 'energy',
      torture: 'challenge',
      stupid: 'silly',
      idiot: 'silly',
      damn: 'darn',
      hell: 'heck',
    };

  static analyzeContent(content: string): SafetyAnalysis {
    const flagged = this.INAPPROPRIATE_PATTERNS.some(pattern =>
      pattern.test(content)
    );

    const categories = this.INAPPROPRIATE_PATTERNS.map((pattern, index) => ({
      name:
        ['violence', 'sexual', 'profanity', 'discrimination'][index] || 'other',
      score: pattern.test(content) ? 0.8 : 0.1,
      threshold: 0.5,
      triggered: pattern.test(content),
    }));

    const severity = flagged
      ? ((categories.some(c => c.score > 0.7) ? 'high' : 'medium') as const)
      : ('none' as const);

    return {
      flagged,
      categories,
      severity,
      action:
        severity === 'high'
          ? 'block'
          : severity === 'medium'
            ? 'warn'
            : 'allow',
    };
  }

  static sanitizeContent(content: string): string {
    let sanitized = content;

    for (const [inappropriate, replacement] of Object.entries(
      this.FAMILY_FRIENDLY_REPLACEMENTS
    )) {
      const regex = new RegExp(`\\b${inappropriate}\\b`, 'gi');
      sanitized = sanitized.replace(regex, replacement);
    }

    return sanitized;
  }
}

// ============================================================================
// QUALITY SCORING SYSTEM
// ============================================================================

class QualityScorer {
  /**
   * Score content quality based on multiple factors
   */
  static scoreContent(content: any, contentType: string): number {
    let score = 0;
    let maxScore = 0;

    // Completeness (30 points)
    maxScore += 30;
    score += this.scoreCompleteness(content, contentType);

    // Coherence (25 points)
    maxScore += 25;
    score += this.scoreCoherence(content);

    // Creativity (20 points)
    maxScore += 20;
    score += this.scoreCreativity(content);

    // Relevance (15 points)
    maxScore += 15;
    score += this.scoreRelevance(content, contentType);

    // Structure (10 points)
    maxScore += 10;
    score += this.scoreStructure(content);

    return Math.round((score / maxScore) * 100);
  }

  private static scoreCompleteness(content: any, contentType: string): number {
    const requiredFields = this.getRequiredFields(contentType);
    let completedFields = 0;

    for (const field of requiredFields) {
      if (this.hasCompleteField(content, field)) {
        completedFields++;
      }
    }

    return (completedFields / requiredFields.length) * 30;
  }

  private static scoreCoherence(content: any): number {
    if (typeof content === 'string') {
      // Basic coherence checks for text content
      const sentences = content
        .split(/[.!?]+/)
        .filter(s => s.trim().length > 0);
      if (sentences.length === 0) return 0;

      const avgSentenceLength = content.length / sentences.length;
      const coherenceScore =
        avgSentenceLength > 10 && avgSentenceLength < 200 ? 25 : 15;
      return coherenceScore;
    }

    // For objects, check if relationships make sense
    return 20; // TODO: Implement more sophisticated coherence checking
  }

  private static scoreCreativity(content: any): number {
    // TODO: Implement creativity scoring based on uniqueness, originality
    // For now, give a baseline score
    return 15;
  }

  private static scoreRelevance(content: any, contentType: string): number {
    // TODO: Implement relevance scoring based on context matching
    return 12;
  }

  private static scoreStructure(content: any): number {
    if (typeof content === 'object' && content !== null) {
      const hasValidStructure =
        Object.keys(content).length > 0 && !Array.isArray(content);
      return hasValidStructure ? 10 : 5;
    }
    return 8;
  }

  private static getRequiredFields(contentType: string): string[] {
    const fieldMap: Record<string, string[]> = {
      world: ['name', 'description', 'theme'],
      character: ['name', 'race', 'class'],
      narrative: ['content', 'type'],
      dialogue: ['speaker', 'content'],
      combat: ['outcome', 'description'],
      clue: ['content', 'type'],
      event: ['name', 'description', 'type'],
    };

    return fieldMap[contentType] || ['content'];
  }

  private static hasCompleteField(content: any, field: string): boolean {
    if (typeof content !== 'object' || content === null) return false;

    const value = content[field];
    return (
      value !== undefined &&
      value !== null &&
      (typeof value !== 'string' || value.trim().length > 0)
    );
  }
}

// ============================================================================
// FALLBACK CONTENT GENERATORS
// ============================================================================

class FallbackContentGenerator {
  static generateWorldFallback(): WorldData {
    return {
      id: crypto.randomUUID(),
      name: 'Mystic Realm',
      description:
        'A mysterious world filled with ancient magic and forgotten secrets.',
      theme: 'fantasy',
      lore: 'Long ago, this realm was shaped by powerful wizards who left behind magical artifacts and hidden knowledge.',
      locations: [
        {
          id: crypto.randomUUID(),
          name: 'Starting Village',
          description: 'A peaceful village where adventures begin.',
          type: 'town',
          connections: [],
          features: [],
          npcs: [],
          items: [],
          secrets: [],
          isDiscovered: true,
        },
      ],
      globalEvents: [],
      npcs: [],
      factions: [],
    } as WorldData;
  }

  static generateCharacterFallback(): Character {
    return {
      id: crypto.randomUUID(),
      name: 'Adventurer',
      race: {
        name: 'Human',
        description: 'Versatile and adaptable beings.',
        statModifiers: {},
        abilities: [],
        restrictions: [],
      },
      class: {
        name: 'Adventurer',
        description: 'A versatile explorer ready for any challenge.',
        primaryStat: 'strength',
        skillAffinities: ['combat', 'survival'],
        abilities: [],
        equipment: ['sword', 'backpack'],
      },
      level: 1,
      experience: 0,
      stats: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
        luck: 10,
      },
      skills: {
        combat: 5,
        magic: 3,
        stealth: 3,
        diplomacy: 4,
        survival: 6,
        investigation: 4,
        crafting: 3,
        lore: 3,
      },
      traits: [],
      background: {
        name: 'Traveler',
        description: "You've traveled far and wide, seeking adventure.",
        skills: ['survival'],
        equipment: ['travel gear'],
        connections: [],
      },
      currentHealth: 25,
      maxHealth: 25,
      statusEffects: [],
    } as Character;
  }

  static generateNarrativeFallback(): NarrativeData {
    return {
      content:
        'The adventure continues as you stand at a crossroads, wondering which path to take next.',
      type: 'continuation',
      mood: 'neutral',
      consequences: [],
      choices: [
        { id: '1', text: 'Continue forward', consequences: [] },
        { id: '2', text: 'Look around carefully', consequences: [] },
      ],
    } as NarrativeData;
  }

  static generateDialogueFallback(): DialogueData {
    return {
      speaker: 'Mysterious Voice',
      content: 'Welcome, traveler. Your journey has just begun.',
      emotion: 'neutral',
      context: 'greeting',
      choices: [],
    } as DialogueData;
  }

  static generateCombatFallback(): CombatData {
    return {
      outcome: 'ongoing',
      description:
        'The battle continues with both sides showing determination.',
      damageDealt: 0,
      damageReceived: 0,
      statusChanges: [],
      nextPossibleActions: ['attack', 'defend', 'use_item'],
    } as CombatData;
  }

  static generateClueFallback(): ClueData {
    return {
      content:
        'You notice something interesting that might be important later.',
      type: 'observation',
      reliability: 0.8,
      relatedEntities: [],
      isPublic: true,
    } as ClueData;
  }

  static generateEventFallback(): VillageEvent {
    return {
      id: crypto.randomUUID(),
      name: 'Peaceful Day',
      description: 'Nothing unusual happens in the village today.',
      type: 'daily',
      effects: [],
      duration: 1440, // 24 hours in minutes
      isActive: true,
      createdAt: Date.now(),
    } as VillageEvent;
  }
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

class ContentValidator {
  /**
   * Validate content using Zod schema
   */
  static validate(
    data: any,
    schema: z.ZodSchema,
    contentType: string
  ): {
    success: boolean;
    data?: any;
    errors: ValidationError[];
  } {
    try {
      const result = schema.parse(data);
      return {
        success: true,
        data: result,
        errors: [],
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors: ValidationError[] = error.errors.map(err => ({
          rule: 'schema_validation',
          field: err.path.join('.'),
          message: err.message,
          severity: 'error',
          suggestedFix: `Fix ${err.path.join('.')} field: ${err.message}`,
        }));

        return {
          success: false,
          errors: validationErrors,
        };
      }

      return {
        success: false,
        errors: [
          {
            rule: 'validation_error',
            field: 'unknown',
            message: `Validation failed: ${error}`,
            severity: 'error',
          },
        ],
      };
    }
  }

  /**
   * Get appropriate schema for content type
   */
  static getSchema(contentType: string): z.ZodSchema | null {
    const schemaMap: Record<string, z.ZodSchema> = {
      narrative: NarrativeDataSchema,
      dialogue: DialogueDataSchema,
      combat: CombatDataSchema,
      character: CharacterSchema,
      clue: ClueDataSchema,
      role: RoleAssignmentSchema,
      voting: VotingResultSchema,
      npc_behavior: NPCBehaviorSchema,
      resource_event: ResourceEventSchema,
      village_event: VillageEventSchema,
    };

    return schemaMap[contentType] || null;
  }
}

// ============================================================================
// MAIN AI PROCESSOR IMPLEMENTATION
// ============================================================================

export class AIResponseProcessor implements AIProcessor {
  private cacheEnabled = true;
  private responseCache = new Map<string, any>();

  async processWorldGeneration(
    response: string
  ): Promise<ProcessingResult<WorldData>> {
    return this.processContent(
      response,
      'world',
      data => {
        // TODO: Implement world data validation using Zod schema
        return data as WorldData;
      },
      FallbackContentGenerator.generateWorldFallback
    );
  }

  async processCharacterGeneration(
    response: string
  ): Promise<ProcessingResult<Character>> {
    return this.processContent(
      response,
      'character',
      data => {
        // TODO: Implement character data validation using Zod schema
        return data as Character;
      },
      FallbackContentGenerator.generateCharacterFallback
    );
  }

  async processNarrative(
    response: string
  ): Promise<ProcessingResult<NarrativeData>> {
    return this.processContent(
      response,
      'narrative',
      data => {
        // TODO: Implement narrative data validation using Zod schema
        return data as NarrativeData;
      },
      FallbackContentGenerator.generateNarrativeFallback
    );
  }

  async processDialogue(
    response: string
  ): Promise<ProcessingResult<DialogueData>> {
    return this.processContent(
      response,
      'dialogue',
      data => {
        // TODO: Implement dialogue data validation using Zod schema
        return data as DialogueData;
      },
      FallbackContentGenerator.generateDialogueFallback
    );
  }

  async processCombatResult(
    response: string
  ): Promise<ProcessingResult<CombatData>> {
    return this.processContent(
      response,
      'combat',
      data => {
        // TODO: Implement combat data validation using Zod schema
        return data as CombatData;
      },
      FallbackContentGenerator.generateCombatFallback
    );
  }

  async processDeductionClues(
    response: string
  ): Promise<ProcessingResult<ClueData>> {
    return this.processContent(
      response,
      'clue',
      data => {
        // TODO: Implement clue data validation using Zod schema
        return data as ClueData;
      },
      FallbackContentGenerator.generateClueFallback
    );
  }

  async processVillageEvent(
    response: string
  ): Promise<ProcessingResult<VillageEvent>> {
    return this.processContent(
      response,
      'event',
      data => {
        // TODO: Implement village event data validation using Zod schema
        return data as VillageEvent;
      },
      FallbackContentGenerator.generateEventFallback
    );
  }

  private async processContent<T>(
    response: string,
    contentType: string,
    validator: (data: any) => T,
    fallbackGenerator: () => T
  ): Promise<ProcessingResult<T>> {
    const startTime = performance.now();
    const validationErrors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let fallbackUsed = false;
    let processedData: T | null = null;
    let confidence = 0;

    try {
      // Step 1: Extract JSON from response
      const extraction = JSONExtractor.extract(response);
      confidence = extraction.confidence;

      // Step 2: Safety analysis
      const safetyAnalysis = ContentSafetyFilter.analyzeContent(
        JSON.stringify(extraction.data)
      );

      if (safetyAnalysis.action === 'block') {
        warnings.push({
          rule: 'content_safety',
          field: 'content',
          message: 'Content blocked due to safety concerns',
          impact: 'high',
        });

        // Use fallback content
        processedData = fallbackGenerator();
        fallbackUsed = true;
        confidence = 0.1;
      } else {
        // Step 3: Sanitize content if needed
        const sanitizedData = extraction.data;
        if (safetyAnalysis.action === 'warn') {
          if (typeof sanitizedData === 'object' && sanitizedData.content) {
            sanitizedData.content = ContentSafetyFilter.sanitizeContent(
              sanitizedData.content
            );
          }

          warnings.push({
            rule: 'content_safety',
            field: 'content',
            message: 'Content sanitized for safety',
            impact: 'low',
          });
        }

        // Step 4: Validate data structure using Zod schema
        const schema = ContentValidator.getSchema(contentType);
        if (schema) {
          const validation = ContentValidator.validate(
            sanitizedData,
            schema,
            contentType
          );

          if (validation.success && validation.data) {
            try {
              processedData = validator(validation.data);
            } catch (transformError) {
              validationErrors.push({
                rule: 'data_transformation',
                field: 'structure',
                message: `Transformation failed: ${transformError}`,
                severity: 'error',
                suggestedFix: 'Use fallback content',
              });

              processedData = fallbackGenerator();
              fallbackUsed = true;
              confidence = Math.min(confidence, 0.3);
            }
          } else {
            validationErrors.push(...validation.errors);

            processedData = fallbackGenerator();
            fallbackUsed = true;
            confidence = Math.min(confidence, 0.3);
          }
        } else {
          // No schema available, use basic validation
          try {
            processedData = validator(sanitizedData);

            warnings.push({
              rule: 'no_schema',
              field: 'validation',
              message: `No Zod schema available for content type: ${contentType}`,
              impact: 'medium',
            });
          } catch (validationError) {
            validationErrors.push({
              rule: 'basic_validation',
              field: 'structure',
              message: `Basic validation failed: ${validationError}`,
              severity: 'error',
              suggestedFix: 'Use fallback content',
            });

            processedData = fallbackGenerator();
            fallbackUsed = true;
            confidence = Math.min(confidence, 0.3);
          }
        }
      }
    } catch (error) {
      // Complete processing failure - use fallback
      validationErrors.push({
        rule: 'processing_failure',
        field: 'response',
        message: `Processing failed: ${error}`,
        severity: 'error',
        suggestedFix: 'Use fallback content',
      });

      processedData = fallbackGenerator();
      fallbackUsed = true;
      confidence = 0.1;
    }

    // Step 5: Calculate quality score
    const qualityScore = processedData
      ? QualityScorer.scoreContent(processedData, contentType)
      : 0;

    // Step 6: Cache result if successful
    // Cache successful processing results
    if (this.cacheEnabled && processedData && !fallbackUsed) {
      try {
        const { aiCache } = await import('./cache');
        const cacheKey = this.generateCacheKey(response, contentType);
        await aiCache.set(cacheKey, processedData, contentType);
      } catch (cacheError) {
        // Cache errors should not break processing
        console.warn('Cache operation failed:', cacheError);
      }
    }

    const processingTime = performance.now() - startTime;

    return {
      success: processedData !== null,
      data: processedData,
      fallbackUsed,
      validationErrors,
      warnings,
      metadata: {
        processingTime,
        rulesApplied: ['json_extraction', 'safety_analysis', 'validation'],
        transformationsPerformed: fallbackUsed ? 1 : 0,
        qualityScore,
        confidence,
      },
      qualityScore,
      confidence,
    };
  }

  private generateCacheKey(response: string, contentType: string): string {
    // TODO: Implement more sophisticated cache key generation
    const hash = this.simpleHash(response + contentType);
    return `ai_response_${contentType}_${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const aiProcessor = new AIResponseProcessor();

// Export utilities for testing and extension
export {
  JSONExtractor,
  ContentSafetyFilter,
  QualityScorer,
  FallbackContentGenerator,
};
