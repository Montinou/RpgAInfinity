/**
 * Combat Narratives Service for RPG Combat
 *
 * Generates AI-powered combat descriptions, action narratives, and immersive
 * storytelling elements for tactical RPG combat encounters.
 */

import {
  CombatSession,
  CombatParticipant,
  CombatAction,
  CombatActionResult,
  Character,
  CombatLogEntry,
  CombatEnvironment,
  StatusEffect,
  CombatData,
} from '@/types/rpg';
import { ClaudeService, AIRequest, AIResponse } from '@/lib/ai/claude';
import { aiProcessor } from '@/lib/ai/processors';

// ============================================================================
// NARRATIVE GENERATION TYPES
// ============================================================================

interface CombatNarrativeContext {
  readonly session: CombatSession;
  readonly currentRound: number;
  readonly recentActions: CombatLogEntry[];
  readonly environmentDescription: string;
  readonly participantStates: ParticipantState[];
  readonly narrativeStyle:
    | 'epic'
    | 'dark'
    | 'humorous'
    | 'tactical'
    | 'cinematic';
  readonly detailLevel: 'minimal' | 'standard' | 'detailed' | 'verbose';
}

interface ParticipantState {
  readonly participant: CombatParticipant;
  readonly healthStatus: 'healthy' | 'wounded' | 'critical' | 'unconscious';
  readonly activeEffects: string[];
  readonly recentActions: string[];
  readonly threat: 'low' | 'medium' | 'high' | 'extreme';
}

interface CombatNarrative {
  readonly actionDescription: string;
  readonly consequenceDescription: string;
  readonly atmosphericDescription: string;
  readonly dialogueElements: string[];
  readonly soundEffects: string[];
  readonly visualEffects: string[];
  readonly emotionalTone:
    | 'triumphant'
    | 'tense'
    | 'desperate'
    | 'confident'
    | 'fearful'
    | 'determined';
  readonly pacing: 'slow' | 'moderate' | 'fast' | 'frantic';
}

interface NarrativePromptTemplate {
  readonly system: string;
  readonly context: string;
  readonly actionPrompt: string;
  readonly styleGuide: string;
  readonly constraints: string;
}

// ============================================================================
// COMBAT NARRATIVES SERVICE
// ============================================================================

export class CombatNarrativesService {
  private static instance: CombatNarrativesService;
  private claudeService: ClaudeService;

  // Cache recent narratives to maintain consistency
  private narrativeCache: Map<string, CombatNarrative> = new Map();
  private sessionContexts: Map<string, CombatNarrativeContext> = new Map();

  private constructor() {
    this.claudeService = ClaudeService.getInstance();
  }

  static getInstance(): CombatNarrativesService {
    if (!CombatNarrativesService.instance) {
      CombatNarrativesService.instance = new CombatNarrativesService();
    }
    return CombatNarrativesService.instance;
  }

  // ============================================================================
  // MAIN NARRATIVE GENERATION METHODS
  // ============================================================================

  /**
   * Generate narrative description for a combat action
   */
  async generateActionNarrative(
    action: CombatAction,
    result: CombatActionResult,
    actor: CombatParticipant,
    target: CombatParticipant | undefined,
    session: CombatSession
  ): Promise<CombatNarrative> {
    try {
      // Build narrative context
      const context = await this.buildNarrativeContext(session);

      // Generate narrative using AI
      const narrative = await this.generateNarrativeWithAI(
        action,
        result,
        actor,
        target,
        context
      );

      // Cache the narrative
      const cacheKey = `${session.id}-${action.id}`;
      this.narrativeCache.set(cacheKey, narrative);

      return narrative;
    } catch (error) {
      console.error('Failed to generate action narrative:', error);
      return this.createFallbackNarrative(action, result, actor, target);
    }
  }

  /**
   * Generate narrative for combat session start
   */
  async generateCombatStartNarrative(session: CombatSession): Promise<string> {
    try {
      const template = this.getCombatStartTemplate();
      const context = await this.buildNarrativeContext(session);

      const prompt = this.buildPrompt(template, {
        environment: this.describeEnvironment(session.environment),
        participants: this.describeParticipants(session.participants),
        atmosphere: this.generateAtmosphere(context),
        style: context.narrativeStyle,
      });

      const response = await this.claudeService.generateContent({
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: template.system,
        maxTokens: 300,
      });

      if (response.success && response.data.content) {
        return response.data.content;
      }

      return this.getFallbackCombatStart(session);
    } catch (error) {
      console.error('Failed to generate combat start narrative:', error);
      return this.getFallbackCombatStart(session);
    }
  }

  /**
   * Generate narrative for combat session end
   */
  async generateCombatEndNarrative(
    session: CombatSession,
    victor: 'players' | 'enemies' | 'draw'
  ): Promise<string> {
    try {
      const template = this.getCombatEndTemplate();
      const context = await this.buildNarrativeContext(session);

      const prompt = this.buildPrompt(template, {
        victor,
        survivors: this.getSurvivors(session),
        casualties: this.getCasualties(session),
        combatSummary: this.generateCombatSummary(session),
        style: context.narrativeStyle,
      });

      const response = await this.claudeService.generateContent({
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: template.system,
        maxTokens: 400,
      });

      if (response.success && response.data.content) {
        return response.data.content;
      }

      return this.getFallbackCombatEnd(victor);
    } catch (error) {
      console.error('Failed to generate combat end narrative:', error);
      return this.getFallbackCombatEnd(victor);
    }
  }

  /**
   * Generate environmental description updates
   */
  async generateEnvironmentalNarrative(
    session: CombatSession,
    environmentEvent: string
  ): Promise<string> {
    try {
      const context = await this.buildNarrativeContext(session);

      const prompt = `Describe how the combat environment changes: ${environmentEvent}. 
        Current environment: ${this.describeEnvironment(session.environment)}
        Style: ${context.narrativeStyle}
        Keep it to 1-2 sentences, focusing on atmospheric impact.`;

      const response = await this.claudeService.generateContent({
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 150,
      });

      return response.success && response.data.content
        ? response.data.content
        : `The battlefield shifts as ${environmentEvent}.`;
    } catch (error) {
      console.error('Failed to generate environmental narrative:', error);
      return `The battlefield shifts as ${environmentEvent}.`;
    }
  }

  // ============================================================================
  // PRIVATE NARRATIVE GENERATION METHODS
  // ============================================================================

  private async generateNarrativeWithAI(
    action: CombatAction,
    result: CombatActionResult,
    actor: CombatParticipant,
    target: CombatParticipant | undefined,
    context: CombatNarrativeContext
  ): Promise<CombatNarrative> {
    const template = this.getActionNarrativeTemplate(action.type);

    const prompt = this.buildPrompt(template, {
      actorName: actor.character.name,
      actorType: actor.type,
      targetName: target?.character.name || 'unknown',
      actionType: action.type,
      outcome: result.outcome,
      damage: result.damage,
      healing: result.healing,
      description: result.description,
      environment: this.describeEnvironment(context.session.environment),
      style: context.narrativeStyle,
      detailLevel: context.detailLevel,
      roundNumber: context.currentRound,
      recentActions: this.summarizeRecentActions(context.recentActions),
    });

    try {
      // Use AI processor for structured combat data generation
      const combatData = await aiProcessor.processCombatData(prompt, {
        outcome: result.outcome,
        description: result.description,
        damageDealt: result.damage,
        damageReceived: 0,
        statusChanges: result.statusEffectsApplied,
        nextPossibleActions: [
          'attack',
          'defend',
          'move',
          'cast_spell',
          'use_item',
          'wait',
        ],
      });

      if (combatData.success && combatData.data) {
        return this.convertCombatDataToNarrative(combatData.data, result);
      }

      // Fallback to direct narrative generation
      const response = await this.claudeService.generateContent({
        messages: [{ role: 'user', content: prompt }],
        systemPrompt: template.system,
        maxTokens: 200,
      });

      if (response.success && response.data.content) {
        return this.parseNarrativeResponse(response.data.content, result);
      }

      return this.createFallbackNarrative(action, result, actor, target);
    } catch (error) {
      console.error('AI narrative generation failed:', error);
      return this.createFallbackNarrative(action, result, actor, target);
    }
  }

  private convertCombatDataToNarrative(
    combatData: CombatData,
    result: CombatActionResult
  ): CombatNarrative {
    return {
      actionDescription: combatData.description,
      consequenceDescription: this.generateConsequenceText(combatData),
      atmosphericDescription: this.generateAtmosphericText(combatData),
      dialogueElements: this.extractDialogue(combatData.description),
      soundEffects: this.generateSoundEffects(combatData.outcome),
      visualEffects: this.generateVisualEffects(combatData.outcome),
      emotionalTone: this.determineEmotionalTone(combatData),
      pacing: this.determinePacing(combatData.outcome),
    };
  }

  private parseNarrativeResponse(
    content: string,
    result: CombatActionResult
  ): CombatNarrative {
    // Simple parsing of AI response into narrative structure
    const sentences = content
      .split('.')
      .map(s => s.trim())
      .filter(s => s);

    return {
      actionDescription: sentences[0] || result.description,
      consequenceDescription: sentences[1] || '',
      atmosphericDescription: sentences[2] || '',
      dialogueElements: this.extractDialogue(content),
      soundEffects: this.generateSoundEffects(result.outcome),
      visualEffects: this.generateVisualEffects(result.outcome),
      emotionalTone: this.determineEmotionalTone({
        outcome: result.outcome,
      } as CombatData),
      pacing: this.determinePacing(result.outcome),
    };
  }

  private createFallbackNarrative(
    action: CombatAction,
    result: CombatActionResult,
    actor: CombatParticipant,
    target?: CombatParticipant
  ): CombatNarrative {
    const actionDescriptions = {
      attack: `${actor.character.name} attacks${target ? ` ${target.character.name}` : ''}`,
      defend: `${actor.character.name} takes a defensive stance`,
      cast_spell: `${actor.character.name} casts a spell${target ? ` at ${target.character.name}` : ''}`,
      use_item: `${actor.character.name} uses an item`,
      move: `${actor.character.name} moves to a new position`,
      wait: `${actor.character.name} waits and observes`,
      flee: `${actor.character.name} attempts to flee`,
    };

    return {
      actionDescription: actionDescriptions[action.type] || result.description,
      consequenceDescription:
        result.damage > 0 ? `dealing ${result.damage} damage` : '',
      atmosphericDescription: 'The battle continues...',
      dialogueElements: [],
      soundEffects: this.generateSoundEffects(result.outcome),
      visualEffects: [],
      emotionalTone: 'determined',
      pacing: 'moderate',
    };
  }

  // ============================================================================
  // CONTEXT BUILDING METHODS
  // ============================================================================

  private async buildNarrativeContext(
    session: CombatSession
  ): Promise<CombatNarrativeContext> {
    // Check cache first
    const cached = this.sessionContexts.get(session.id);
    if (cached && cached.currentRound === session.currentTurn) {
      return cached;
    }

    const context: CombatNarrativeContext = {
      session,
      currentRound: session.currentTurn,
      recentActions: session.log.slice(-5), // Last 5 actions
      environmentDescription: this.describeEnvironment(session.environment),
      participantStates: this.analyzeParticipantStates(session.participants),
      narrativeStyle: this.determineNarrativeStyle(session),
      detailLevel: 'standard',
    };

    this.sessionContexts.set(session.id, context);
    return context;
  }

  private analyzeParticipantStates(
    participants: CombatParticipant[]
  ): ParticipantState[] {
    return participants.map(participant => {
      const character = participant.character;
      const healthPercent =
        (character.currentHealth / character.maxHealth) * 100;

      let healthStatus: ParticipantState['healthStatus'];
      if (character.currentHealth <= 0) {
        healthStatus = 'unconscious';
      } else if (healthPercent < 25) {
        healthStatus = 'critical';
      } else if (healthPercent < 60) {
        healthStatus = 'wounded';
      } else {
        healthStatus = 'healthy';
      }

      // Calculate threat level based on damage potential and status
      let threat: ParticipantState['threat'];
      const damageCapacity = character.stats.strength + character.level;
      if (healthStatus === 'unconscious') {
        threat = 'low';
      } else if (damageCapacity > 50) {
        threat = 'extreme';
      } else if (damageCapacity > 30) {
        threat = 'high';
      } else if (damageCapacity > 15) {
        threat = 'medium';
      } else {
        threat = 'low';
      }

      return {
        participant,
        healthStatus,
        activeEffects: character.statusEffects.map(e => e.name),
        recentActions: [], // TODO: Track recent actions per participant
        threat,
      };
    });
  }

  // ============================================================================
  // TEMPLATE AND PROMPT GENERATION
  // ============================================================================

  private getActionNarrativeTemplate(
    actionType: CombatAction['type']
  ): NarrativePromptTemplate {
    const baseSystem =
      'You are a master storyteller creating immersive combat narratives for a tactical RPG. Focus on vivid, engaging descriptions that enhance the player experience.';

    const templates: Record<CombatAction['type'], NarrativePromptTemplate> = {
      attack: {
        system: baseSystem,
        context: 'Generate a narrative description for a combat attack action.',
        actionPrompt:
          'Describe {actorName} performing an attack against {targetName}. Outcome: {outcome}. Damage: {damage}.',
        styleGuide:
          'Use dynamic action verbs and vivid combat imagery. Style: {style}',
        constraints:
          'Keep to 1-2 sentences maximum. Focus on the immediate action and its impact.',
      },
      defend: {
        system: baseSystem,
        context: 'Generate a narrative description for a defensive action.',
        actionPrompt:
          'Describe {actorName} taking a defensive stance. Show tactical awareness and preparation.',
        styleGuide:
          'Emphasize protective positioning and readiness. Style: {style}',
        constraints:
          'Keep to 1-2 sentences maximum. Focus on defensive positioning.',
      },
      cast_spell: {
        system: baseSystem,
        context: 'Generate a narrative description for spellcasting.',
        actionPrompt:
          "Describe {actorName} casting a spell{targetName ? ' at ' + targetName : ''}. Outcome: {outcome}. Damage/Effect: {damage}.",
        styleGuide:
          'Include magical elements, energy, and mystical atmosphere. Style: {style}',
        constraints:
          'Keep to 1-2 sentences maximum. Emphasize magical effects and power.',
      },
      use_item: {
        system: baseSystem,
        context: 'Generate a narrative description for item usage.',
        actionPrompt:
          'Describe {actorName} using an item during combat. Show quick, tactical usage.',
        styleGuide:
          "Focus on the item's practical application and immediate effects. Style: {style}",
        constraints:
          'Keep to 1-2 sentences maximum. Emphasize utility and tactical advantage.',
      },
      move: {
        system: baseSystem,
        context: 'Generate a narrative description for movement.',
        actionPrompt:
          'Describe {actorName} moving to a new position on the battlefield. Show tactical repositioning.',
        styleGuide:
          'Emphasize tactical movement and positioning. Style: {style}',
        constraints:
          'Keep to 1-2 sentences maximum. Focus on strategic positioning.',
      },
      wait: {
        system: baseSystem,
        context: 'Generate a narrative description for waiting/observing.',
        actionPrompt:
          'Describe {actorName} waiting and observing the battlefield. Show tactical awareness.',
        styleGuide:
          'Convey patience, calculation, and readiness. Style: {style}',
        constraints:
          'Keep to 1-2 sentences maximum. Emphasize tactical observation.',
      },
      flee: {
        system: baseSystem,
        context: 'Generate a narrative description for fleeing.',
        actionPrompt:
          'Describe {actorName} attempting to flee from combat. Outcome: {outcome}.',
        styleGuide:
          'Show desperation or tactical retreat based on context. Style: {style}',
        constraints:
          'Keep to 1-2 sentences maximum. Focus on escape attempt and outcome.',
      },
    };

    return templates[actionType];
  }

  private getCombatStartTemplate(): NarrativePromptTemplate {
    return {
      system:
        'You are a master storyteller setting the scene for an epic combat encounter.',
      context: 'Generate an atmospheric opening for a combat encounter.',
      actionPrompt:
        'Set the scene for combat beginning. Environment: {environment}. Participants: {participants}.',
      styleGuide:
        'Create tension and atmosphere. Build anticipation for the coming conflict. Style: {style}',
      constraints:
        '2-3 sentences maximum. Focus on atmosphere and initial tension.',
    };
  }

  private getCombatEndTemplate(): NarrativePromptTemplate {
    return {
      system:
        'You are a master storyteller concluding an epic combat encounter.',
      context: 'Generate a conclusive narrative for the end of combat.',
      actionPrompt:
        'Conclude the combat. Victor: {victor}. Summary: {combatSummary}.',
      styleGuide:
        'Provide closure and resolution. Acknowledge the victor and consequences. Style: {style}',
      constraints: '2-4 sentences maximum. Focus on resolution and aftermath.',
    };
  }

  private buildPrompt(
    template: NarrativePromptTemplate,
    variables: Record<string, any>
  ): string {
    let prompt = `${template.context}\n\n${template.actionPrompt}\n\n${template.styleGuide}\n\n${template.constraints}`;

    // Replace variables
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      prompt = prompt.replace(new RegExp(placeholder, 'g'), String(value));
    });

    return prompt;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private determineNarrativeStyle(
    session: CombatSession
  ): CombatNarrativeContext['narrativeStyle'] {
    // TODO: Get from session configuration when available
    // For now, default to 'epic'
    return 'epic';
  }

  private describeEnvironment(environment: CombatEnvironment): string {
    const descriptions = {
      battlefield: 'open battlefield with scattered debris',
      forest: 'dense forest clearing with towering trees',
      dungeon: 'dark stone chamber with flickering torchlight',
      desert: 'sandy wasteland under scorching sun',
      swamp: 'murky swampland with treacherous footing',
      mountain: 'rocky mountain ledge with treacherous drops',
      castle: 'grand castle hall with high vaulted ceilings',
    };

    return (
      descriptions[environment.type as keyof typeof descriptions] ||
      'mysterious battleground'
    );
  }

  private describeParticipants(participants: CombatParticipant[]): string {
    const players = participants.filter(p => p.type === 'player').length;
    const enemies = participants.filter(p => p.type !== 'player').length;
    return `${players} heroes face ${enemies} enemies`;
  }

  private generateAtmosphere(context: CombatNarrativeContext): string {
    const atmospheres = {
      epic: 'tension fills the air as destiny hangs in the balance',
      dark: 'shadows deepen as malevolent forces gather',
      humorous: 'chaos ensues in unexpectedly amusing fashion',
      tactical: 'calculated precision marks every movement',
      cinematic: 'dramatic tension builds to a crescendo',
    };

    return atmospheres[context.narrativeStyle] || atmospheres.epic;
  }

  private summarizeRecentActions(actions: CombatLogEntry[]): string {
    if (actions.length === 0) return 'combat has just begun';
    return `recent actions include ${actions
      .slice(-2)
      .map(a => a.action)
      .join(' and ')}`;
  }

  private getSurvivors(session: CombatSession): string {
    const survivors = session.participants.filter(
      p => p.character.currentHealth > 0
    );
    return survivors.map(s => s.character.name).join(', ');
  }

  private getCasualties(session: CombatSession): string {
    const casualties = session.participants.filter(
      p => p.character.currentHealth <= 0
    );
    return casualties.map(c => c.character.name).join(', ');
  }

  private generateCombatSummary(session: CombatSession): string {
    return `${session.currentTurn} rounds of intense combat`;
  }

  private extractDialogue(text: string): string[] {
    const dialogueRegex = /"([^"]+)"/g;
    const matches = [];
    let match;
    while ((match = dialogueRegex.exec(text)) !== null) {
      matches.push(match[1]);
    }
    return matches;
  }

  private generateSoundEffects(
    outcome: CombatActionResult['outcome']
  ): string[] {
    const soundEffects = {
      hit: ['clash', 'impact', 'strike'],
      critical: ['thunderous_blow', 'devastating_impact', 'crushing_strike'],
      miss: ['whoosh', 'swing_miss', 'dodge'],
      block: ['clang', 'deflect', 'shield_block'],
      ongoing: ['ambient_combat', 'breathing', 'footsteps'],
    };

    return soundEffects[outcome] || soundEffects.ongoing;
  }

  private generateVisualEffects(
    outcome: CombatActionResult['outcome']
  ): string[] {
    const visualEffects = {
      hit: ['impact_flash', 'damage_sparks'],
      critical: ['critical_burst', 'screen_shake', 'blood_splash'],
      miss: ['miss_blur', 'dodge_trail'],
      block: ['deflect_sparks', 'shield_glow'],
      ongoing: ['dust_particles', 'ambient_effects'],
    };

    return visualEffects[outcome] || visualEffects.ongoing;
  }

  private determineEmotionalTone(
    combatData: CombatData
  ): CombatNarrative['emotionalTone'] {
    if (combatData.outcome === 'critical') return 'triumphant';
    if (combatData.outcome === 'fumble') return 'desperate';
    if (combatData.damageDealt > 20) return 'confident';
    if (combatData.damageReceived > 15) return 'fearful';
    return 'determined';
  }

  private determinePacing(
    outcome: CombatActionResult['outcome']
  ): CombatNarrative['pacing'] {
    if (outcome === 'critical') return 'fast';
    if (outcome === 'fumble') return 'slow';
    if (outcome === 'ongoing') return 'moderate';
    return 'moderate';
  }

  private generateConsequenceText(combatData: CombatData): string {
    if (combatData.damageDealt > 0) {
      return `The attack lands, dealing significant damage.`;
    }
    if (combatData.damageReceived > 0) {
      return `The counterattack finds its mark.`;
    }
    return `The action has immediate tactical implications.`;
  }

  private generateAtmosphericText(combatData: CombatData): string {
    const atmospheres = [
      'Battle fury intensifies around the combatants.',
      'The air crackles with tension and energy.',
      'Dust and debris swirl in the wake of combat.',
      'The clash of steel echoes across the battlefield.',
    ];

    return atmospheres[Math.floor(Math.random() * atmospheres.length)];
  }

  private getFallbackCombatStart(session: CombatSession): string {
    const playerCount = session.participants.filter(
      p => p.type === 'player'
    ).length;
    const enemyCount = session.participants.filter(
      p => p.type !== 'player'
    ).length;
    return `Combat begins! ${playerCount} heroes face ${enemyCount} enemies in deadly battle. The clash of steel and magic fills the air as combatants prepare for war.`;
  }

  private getFallbackCombatEnd(victor: 'players' | 'enemies' | 'draw'): string {
    const endings = {
      players:
        'Victory is yours! The heroes stand triumphant over their fallen foes, breathing heavily but victorious.',
      enemies:
        'Defeat... The enemies prove too powerful, overwhelming the heroes in brutal combat.',
      draw: 'The battle ends in stalemate, with neither side able to claim decisive victory.',
    };

    return endings[victor];
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const combatNarratives = CombatNarrativesService.getInstance();
export default combatNarratives;
