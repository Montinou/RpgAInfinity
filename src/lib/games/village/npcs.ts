/**
 * NPC Behavior System for RpgAInfinity Village Simulator
 *
 * This module provides sophisticated AI-powered NPC behavior including:
 * - Dynamic personality generation using Claude API
 * - Complex behavior trees for realistic decision making
 * - Social relationship networks and memory systems
 * - Context-aware dialogue generation
 * - Crisis response and community dynamics
 */

import { generateVillageContent } from '../../ai';
import {
  Village,
  Resident,
  VillageGameState,
  PersonalityTraits,
  AIPersonality,
  SocialRelation,
  VillageEvent,
  DecisionTendency,
  Employment,
  ResidentNeeds,
  LifeEvent,
  VillageContext,
  DialogueContext,
  Interaction,
  InteractionResult,
  NPCAction,
  RelationshipUpdate,
  NPC,
  Player,
} from '../../../types/village';

// ============================================================================
// BEHAVIOR TREE SYSTEM
// ============================================================================

export interface BehaviorNode {
  id: string;
  type: 'composite' | 'decorator' | 'action' | 'condition';
  name: string;
  execute(npc: NPC, context: BehaviorContext): Promise<BehaviorResult>;
}

export interface BehaviorContext {
  village: Village;
  gameState: VillageGameState;
  timeOfDay: number; // 0-23
  season: string;
  weather: string;
  availableActions: NPCAction[];
  nearbyNPCs: NPC[];
  recentEvents: VillageEvent[];
}

export interface BehaviorResult {
  status: 'success' | 'failure' | 'running';
  action?: NPCAction;
  nextNode?: string;
  memory?: MemoryEntry[];
  socialUpdates?: SocialInteraction[];
}

export interface MemoryEntry {
  id: string;
  type: 'interaction' | 'event' | 'observation' | 'emotion';
  content: string;
  importance: number; // 0-100
  timestamp: Date;
  associatedNPCs?: string[];
  emotionalImpact: number; // -50 to +50
  decayRate: number; // How quickly this memory fades
}

export interface SocialInteraction {
  npcId: string;
  otherNpcId: string;
  type: 'conversation' | 'cooperation' | 'conflict' | 'romantic' | 'business';
  outcome: 'positive' | 'negative' | 'neutral';
  relationshipChange: number; // -10 to +10
  description: string;
}

// ============================================================================
// NPC BEHAVIOR SYSTEM
// ============================================================================

export class NPCBehaviorSystem {
  private behaviorTrees = new Map<string, BehaviorTree>();
  private npcMemories = new Map<string, MemoryEntry[]>();
  private relationshipNetwork = new Map<string, Map<string, SocialRelation>>();
  private personalityCache = new Map<string, AIPersonality>();

  constructor() {
    this.initializeBehaviorTrees();
  }

  /**
   * Update all NPCs in the village based on current context
   */
  async updateNPCs(npcs: NPC[], context: VillageContext): Promise<NPC[]> {
    const updatedNPCs: NPC[] = [];

    for (const npc of npcs) {
      try {
        // Execute behavior tree to determine NPC actions
        const behaviorContext: BehaviorContext = {
          village: context.village,
          gameState: context.gameState,
          timeOfDay: new Date().getHours(),
          season: context.village.season.current,
          weather: context.village.weather.current,
          availableActions: this.getAvailableActions(npc, context),
          nearbyNPCs: this.getNearbyNPCs(npc, npcs),
          recentEvents: context.village.currentEvents,
        };

        const behaviorTree = this.getBehaviorTreeForNPC(npc);
        const result = await behaviorTree.execute(npc, behaviorContext);

        // Apply behavior result to NPC
        const updatedNPC = await this.applyBehaviorResult(npc, result, context);
        updatedNPCs.push(updatedNPC);

        // Update memories and relationships
        if (result.memory) {
          this.addMemories(npc.id, result.memory);
        }
        if (result.socialUpdates) {
          await this.processSocialUpdates(result.socialUpdates);
        }
      } catch (error) {
        console.error(`Error updating NPC ${npc.id}:`, error);
        // TODO: Add error recovery and logging
        updatedNPCs.push(npc); // Keep original if update fails
      }
    }

    return updatedNPCs;
  }

  /**
   * Generate contextual dialogue for an NPC interaction
   */
  async generateDialogue(
    npc: NPC,
    player: Player,
    context: DialogueContext
  ): Promise<string> {
    // Gather context for dialogue generation
    const npcPersonality = await this.getOrGeneratePersonality(npc);
    const memories = this.getRelevantMemories(npc.id, context.topic);
    const relationship = this.getRelationship(npc.id, player.id);
    const recentEvents = context.recentEvents || [];

    // Use AI to generate contextual dialogue
    const dialogueVariables = {
      npc: {
        name: npc.name,
        profession: npc.profession.name,
        personality: npcPersonality.traits,
        mood: this.calculateCurrentMood(npc),
        recentMemories: memories.slice(0, 3).map(m => m.content),
      },
      player: {
        name: player.name,
        reputation: player.reputation || 0,
        relationshipLevel: relationship?.strength || 0,
      },
      context: {
        topic: context.topic,
        location: context.location,
        timeOfDay: context.timeOfDay,
        urgency: context.urgency || 'normal',
        recentEvents: recentEvents.map(e => e.name),
      },
      village: {
        mood: context.villageMood,
        season: context.season,
        currentCrises: context.activeCrises || [],
      },
    };

    try {
      const response = await generateVillageContent(
        'npc_dialogue',
        dialogueVariables,
        { streaming: false, optimize: true }
      );

      if (response.success && response.response?.content) {
        // Store this interaction in NPC memory
        this.addMemories(npc.id, [
          {
            id: `dialogue_${Date.now()}`,
            type: 'interaction',
            content: `Spoke with ${player.name} about ${context.topic}`,
            importance: this.calculateInteractionImportance(context),
            timestamp: new Date(),
            associatedNPCs: [player.id],
            emotionalImpact: this.calculateEmotionalImpact(npc, context),
            decayRate: 0.02, // Memories of conversations fade slowly
          },
        ]);

        return response.response.content;
      } else {
        // TODO: Implement fallback dialogue system
        return this.generateFallbackDialogue(npc, context);
      }
    } catch (error) {
      console.error('Error generating NPC dialogue:', error);
      return this.generateFallbackDialogue(npc, context);
    }
  }

  /**
   * Process a player interaction with an NPC
   */
  async processInteraction(
    npc: NPC,
    interaction: Interaction
  ): Promise<InteractionResult> {
    const personality = await this.getOrGeneratePersonality(npc);
    const currentMood = this.calculateCurrentMood(npc);

    // Determine NPC response based on personality and current state
    const response = this.calculateInteractionResponse(
      npc,
      personality,
      currentMood,
      interaction
    );

    // Update NPC state based on interaction
    const stateChanges = this.calculateStateChanges(npc, interaction, response);

    // Create memory of this interaction
    const memory: MemoryEntry = {
      id: `interaction_${Date.now()}`,
      type: 'interaction',
      content: `${interaction.type} interaction: ${interaction.description}`,
      importance: this.calculateInteractionImportance(interaction),
      timestamp: new Date(),
      associatedNPCs: [interaction.playerId],
      emotionalImpact: response.emotionalImpact,
      decayRate: 0.03,
    };

    this.addMemories(npc.id, [memory]);

    // Update relationships if applicable
    if (interaction.playerId) {
      await this.updateRelationship(
        npc.id,
        interaction.playerId,
        response.relationshipChange
      );
    }

    return {
      success: true,
      response: response.message,
      npcStateChanges: stateChanges,
      relationshipChange: response.relationshipChange,
      consequences: response.consequences,
      newMemory: memory,
    };
  }

  /**
   * Simulate NPC decision making given available actions
   */
  async simulateNPCDecisions(
    npc: NPC,
    availableActions: NPCAction[]
  ): Promise<NPCAction> {
    const personality = await this.getOrGeneratePersonality(npc);
    const memories = this.getRecentMemories(npc.id, 24); // Last 24 hours
    const needs = this.calculateCurrentNeeds(npc);

    // Score each available action based on NPC personality and needs
    const scoredActions = availableActions.map(action => ({
      action,
      score: this.scoreAction(action, npc, personality, needs, memories),
    }));

    // Sort by score and add randomness based on personality
    scoredActions.sort((a, b) => b.score - a.score);

    // Apply personality-based decision making
    const selectedAction = this.applyDecisionPersonality(
      scoredActions,
      personality
    );

    return selectedAction.action;
  }

  /**
   * Update relationships between NPCs based on events
   */
  async updateNPCRelationships(
    npcs: NPC[],
    events: VillageEvent[]
  ): Promise<RelationshipUpdate[]> {
    const updates: RelationshipUpdate[] = [];

    // Process each event for relationship impacts
    for (const event of events) {
      const eventUpdates = await this.processEventRelationshipImpacts(
        event,
        npcs
      );
      updates.push(...eventUpdates);
    }

    // Process natural relationship evolution
    const naturalUpdates = await this.processNaturalRelationshipEvolution(npcs);
    updates.push(...naturalUpdates);

    // Apply all updates to the relationship network
    for (const update of updates) {
      await this.applyRelationshipUpdate(update);
    }

    return updates;
  }

  /**
   * Generate new NPCs with AI-powered personalities
   */
  async generateNPCPersonalities(
    count: number,
    village: Village
  ): Promise<NPC[]> {
    const newNPCs: NPC[] = [];

    for (let i = 0; i < count; i++) {
      try {
        // Generate NPC with AI
        const npcVariables = {
          village: {
            name: village.name,
            size: village.size,
            culture: village.aiPersonality.values.map(v => v.name),
            currentSeason: village.season.current,
            populationSize: village.population.total,
            mainIndustries: this.getMainIndustries(village),
          },
          demographics: {
            averageAge: this.calculateAverageAge(village.residents),
            skillDistribution: this.getSkillDistribution(village.residents),
            professionNeeds: this.calculateProfessionNeeds(village),
          },
          context: {
            currentEvents: village.currentEvents.map(e => e.name),
            villagePersonality: village.aiPersonality.values,
            economicSituation: village.economy.economicHealth,
          },
        };

        const response = await generateVillageContent(
          'npc_generation',
          npcVariables,
          { streaming: false, optimize: true }
        );

        if (response.success && response.response?.content) {
          const generatedNPC = this.parseGeneratedNPC(
            response.response.content,
            village
          );

          // Generate detailed personality
          const personality =
            await this.generateDetailedPersonality(generatedNPC);
          generatedNPC.aiPersonality = personality;

          // Initialize memory and relationships
          this.initializeNPCMemory(generatedNPC);
          await this.initializeNPCRelationships(
            generatedNPC,
            village.residents
          );

          newNPCs.push(generatedNPC);
        }
      } catch (error) {
        console.error(`Error generating NPC ${i}:`, error);
        // TODO: Generate fallback NPC
      }
    }

    return newNPCs;
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private initializeBehaviorTrees(): void {
    // Initialize default behavior trees for different NPC archetypes
    // TODO: Implement behavior tree system
    console.log('Initializing behavior trees...');
  }

  private getBehaviorTreeForNPC(npc: NPC): BehaviorTree {
    // TODO: Return appropriate behavior tree based on NPC profession and personality
    return new BehaviorTree('default');
  }

  private getAvailableActions(npc: NPC, context: VillageContext): NPCAction[] {
    // TODO: Generate available actions based on NPC's job, location, time of day, etc.
    return [];
  }

  private getNearbyNPCs(npc: NPC, allNPCs: NPC[]): NPC[] {
    // TODO: Implement spatial awareness system
    return allNPCs.filter(other => other.id !== npc.id).slice(0, 5);
  }

  private async applyBehaviorResult(
    npc: NPC,
    result: BehaviorResult,
    context: VillageContext
  ): Promise<NPC> {
    // TODO: Apply behavior result modifications to NPC
    return npc;
  }

  private addMemories(npcId: string, memories: MemoryEntry[]): void {
    if (!this.npcMemories.has(npcId)) {
      this.npcMemories.set(npcId, []);
    }

    const existingMemories = this.npcMemories.get(npcId)!;
    existingMemories.push(...memories);

    // Limit memory count and apply decay
    this.applyMemoryDecayAndLimits(npcId);
  }

  private async processSocialUpdates(
    updates: SocialInteraction[]
  ): Promise<void> {
    for (const update of updates) {
      await this.updateRelationship(
        update.npcId,
        update.otherNpcId,
        update.relationshipChange
      );
    }
  }

  private async getOrGeneratePersonality(npc: NPC): Promise<AIPersonality> {
    if (this.personalityCache.has(npc.id)) {
      return this.personalityCache.get(npc.id)!;
    }

    if (npc.aiPersonality) {
      this.personalityCache.set(npc.id, npc.aiPersonality);
      return npc.aiPersonality;
    }

    // Generate new personality
    const personality = await this.generateDetailedPersonality(npc);
    this.personalityCache.set(npc.id, personality);
    return personality;
  }

  private getRelevantMemories(npcId: string, topic?: string): MemoryEntry[] {
    const memories = this.npcMemories.get(npcId) || [];

    if (!topic) {
      return memories.sort((a, b) => b.importance - a.importance).slice(0, 10);
    }

    // TODO: Implement semantic search for topic-relevant memories
    return memories
      .filter(m => m.content.toLowerCase().includes(topic.toLowerCase()))
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 5);
  }

  private getRelationship(
    npcId: string,
    otherId: string
  ): SocialRelation | undefined {
    const relationships = this.relationshipNetwork.get(npcId);
    return relationships?.get(otherId);
  }

  private calculateCurrentMood(npc: NPC): string {
    // TODO: Calculate mood based on recent memories, needs fulfillment, etc.
    return 'neutral';
  }

  private calculateInteractionImportance(context: any): number {
    // TODO: Calculate importance based on context, relationship, topic urgency
    return 50;
  }

  private calculateEmotionalImpact(npc: NPC, context: any): number {
    // TODO: Calculate emotional impact based on NPC personality and interaction
    return 0;
  }

  private generateFallbackDialogue(npc: NPC, context: DialogueContext): string {
    // Simple fallback when AI generation fails
    const greetings = [
      `Hello there, I'm ${npc.name}.`,
      `Good day! ${npc.name} here.`,
      `Greetings, friend.`,
    ];

    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  private calculateInteractionResponse(
    npc: NPC,
    personality: AIPersonality,
    mood: string,
    interaction: Interaction
  ): any {
    // TODO: Complex response calculation based on personality traits
    return {
      message: 'I understand.',
      emotionalImpact: 0,
      relationshipChange: 0,
      consequences: [],
    };
  }

  private calculateStateChanges(
    npc: NPC,
    interaction: Interaction,
    response: any
  ): any {
    // TODO: Calculate how interaction affects NPC's internal state
    return {};
  }

  private async updateRelationship(
    npcId: string,
    otherId: string,
    change: number
  ): Promise<void> {
    if (!this.relationshipNetwork.has(npcId)) {
      this.relationshipNetwork.set(npcId, new Map());
    }

    const relationships = this.relationshipNetwork.get(npcId)!;
    const existing = relationships.get(otherId);

    if (existing) {
      existing.strength = Math.max(
        -100,
        Math.min(100, existing.strength + change)
      );
    } else {
      relationships.set(otherId, {
        residentId: otherId,
        relationship: 'acquaintance',
        strength: change,
        history: [`First interaction: ${new Date().toISOString()}`],
      });
    }
  }

  private getRecentMemories(npcId: string, hours: number): MemoryEntry[] {
    const memories = this.npcMemories.get(npcId) || [];
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    return memories
      .filter(m => m.timestamp > cutoff)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  private calculateCurrentNeeds(npc: NPC): ResidentNeeds {
    // TODO: Calculate current needs based on NPC state, time, season, etc.
    return npc.needs;
  }

  private scoreAction(
    action: NPCAction,
    npc: NPC,
    personality: AIPersonality,
    needs: ResidentNeeds,
    memories: MemoryEntry[]
  ): number {
    // TODO: Complex scoring algorithm based on personality, needs, and memories
    return Math.random() * 100; // Placeholder
  }

  private applyDecisionPersonality(
    scoredActions: Array<{ action: NPCAction; score: number }>,
    personality: AIPersonality
  ): { action: NPCAction; score: number } {
    // TODO: Apply personality-based decision making (risk aversion, creativity, etc.)
    return scoredActions[0]; // Placeholder
  }

  private async processEventRelationshipImpacts(
    event: VillageEvent,
    npcs: NPC[]
  ): Promise<RelationshipUpdate[]> {
    // TODO: Process how village events affect NPC relationships
    return [];
  }

  private async processNaturalRelationshipEvolution(
    npcs: NPC[]
  ): Promise<RelationshipUpdate[]> {
    // TODO: Process natural relationship changes over time
    return [];
  }

  private async applyRelationshipUpdate(
    update: RelationshipUpdate
  ): Promise<void> {
    // TODO: Apply relationship update to the network
  }

  private getMainIndustries(village: Village): string[] {
    // TODO: Extract main industries from village buildings and economy
    return ['farming', 'crafting'];
  }

  private calculateAverageAge(residents: Resident[]): number {
    return residents.reduce((sum, r) => sum + r.age, 0) / residents.length;
  }

  private getSkillDistribution(residents: Resident[]): Record<string, number> {
    // TODO: Calculate skill distribution across population
    return {};
  }

  private calculateProfessionNeeds(village: Village): string[] {
    // TODO: Calculate what professions the village needs
    return [];
  }

  private parseGeneratedNPC(content: string, village: Village): NPC {
    // TODO: Parse AI-generated content into NPC structure
    // This is a placeholder implementation
    return {
      id: `npc_${Date.now()}`,
      name: 'Generated NPC',
      age: 30,
      gender: 'other',
      health: 100,
      happiness: 75,
      education: 50,
      profession: {
        id: 'farmer',
        name: 'Farmer',
        category: 'agriculture',
        skillLevel: 50,
        income: 100,
        prestige: 40,
        workloadStress: 30,
      },
      skills: [],
      experience: 100,
      family: [],
      friends: [],
      reputation: 0,
      wealth: 500,
      income: 100,
      expenses: 80,
      housing: {
        type: 'owned_house',
        quality: 70,
        capacity: 4,
        occupants: [],
        rent: 0,
        isOwned: true,
      },
      employment: {
        position: 'Farmer',
        salary: 100,
        satisfaction: 75,
        performance: 80,
        startDate: new Date(),
        workHours: 8,
      },
      personality: {
        ambition: 60,
        sociability: 70,
        creativity: 50,
        loyalty: 80,
        courage: 60,
        intelligence: 65,
        compassion: 75,
        greed: 30,
      },
      needs: {
        food: 80,
        shelter: 85,
        safety: 90,
        social: 70,
        purpose: 75,
        luxury: 40,
        urgentNeeds: [],
      },
      lifeEvents: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private async generateDetailedPersonality(npc: NPC): Promise<AIPersonality> {
    // TODO: Use AI to generate detailed personality based on basic traits
    return {
      archetypeId: 'balanced',
      traits: {
        extraversion: 60,
        agreeableness: 70,
        conscientiousness: 65,
        neuroticism: 40,
        openness: 55,
      },
      quirks: ['loves morning walks', 'hums while working'],
      speechPatterns: ['speaks slowly', 'uses farming metaphors'],
      decisionTendencies: [],
    };
  }

  private initializeNPCMemory(npc: NPC): void {
    this.npcMemories.set(npc.id, []);
  }

  private async initializeNPCRelationships(
    npc: NPC,
    existingResidents: Resident[]
  ): Promise<void> {
    this.relationshipNetwork.set(npc.id, new Map());
    // TODO: Generate initial relationships based on profession, age, etc.
  }

  private applyMemoryDecayAndLimits(npcId: string): void {
    const memories = this.npcMemories.get(npcId);
    if (!memories) return;

    // Apply decay to memories
    const now = new Date();
    memories.forEach(memory => {
      const ageInDays =
        (now.getTime() - memory.timestamp.getTime()) / (1000 * 60 * 60 * 24);
      memory.importance = Math.max(
        0,
        memory.importance - ageInDays * memory.decayRate
      );
    });

    // Remove very old/unimportant memories and limit total count
    const filteredMemories = memories
      .filter(m => m.importance > 5) // Remove memories below threshold
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 500); // Keep top 500 memories

    this.npcMemories.set(npcId, filteredMemories);
  }
}

// ============================================================================
// BEHAVIOR TREE IMPLEMENTATION
// ============================================================================

class BehaviorTree {
  private rootNode: BehaviorNode | null = null;

  constructor(private treeType: string) {
    this.buildTree();
  }

  async execute(npc: NPC, context: BehaviorContext): Promise<BehaviorResult> {
    if (!this.rootNode) {
      return { status: 'failure' };
    }

    return await this.rootNode.execute(npc, context);
  }

  private buildTree(): void {
    // TODO: Build appropriate behavior tree based on treeType
    // For now, create a simple default tree
    this.rootNode = new SequenceNode('root', [
      new ConditionNode('is_awake', this.isAwakeCondition),
      new SelectorNode('daily_activities', [
        new ActionNode('work', this.workAction),
        new ActionNode('socialize', this.socializeAction),
        new ActionNode('rest', this.restAction),
      ]),
    ]);
  }

  private isAwakeCondition = async (
    npc: NPC,
    context: BehaviorContext
  ): Promise<boolean> => {
    // TODO: Implement sleep schedule logic
    return context.timeOfDay >= 6 && context.timeOfDay <= 22;
  };

  private workAction = async (
    npc: NPC,
    context: BehaviorContext
  ): Promise<BehaviorResult> => {
    // TODO: Implement work behavior
    return { status: 'success' };
  };

  private socializeAction = async (
    npc: NPC,
    context: BehaviorContext
  ): Promise<BehaviorResult> => {
    // TODO: Implement social behavior
    return { status: 'success' };
  };

  private restAction = async (
    npc: NPC,
    context: BehaviorContext
  ): Promise<BehaviorResult> => {
    // TODO: Implement rest behavior
    return { status: 'success' };
  };
}

// Behavior Tree Node Implementations
class SequenceNode implements BehaviorNode {
  id: string;
  type: 'composite' = 'composite';
  name: string;

  constructor(
    name: string,
    private children: BehaviorNode[]
  ) {
    this.id = `seq_${name}_${Date.now()}`;
    this.name = name;
  }

  async execute(npc: NPC, context: BehaviorContext): Promise<BehaviorResult> {
    for (const child of this.children) {
      const result = await child.execute(npc, context);
      if (result.status !== 'success') {
        return result;
      }
    }
    return { status: 'success' };
  }
}

class SelectorNode implements BehaviorNode {
  id: string;
  type: 'composite' = 'composite';
  name: string;

  constructor(
    name: string,
    private children: BehaviorNode[]
  ) {
    this.id = `sel_${name}_${Date.now()}`;
    this.name = name;
  }

  async execute(npc: NPC, context: BehaviorContext): Promise<BehaviorResult> {
    for (const child of this.children) {
      const result = await child.execute(npc, context);
      if (result.status === 'success') {
        return result;
      }
    }
    return { status: 'failure' };
  }
}

class ConditionNode implements BehaviorNode {
  id: string;
  type: 'condition' = 'condition';
  name: string;

  constructor(
    name: string,
    private condition: (npc: NPC, context: BehaviorContext) => Promise<boolean>
  ) {
    this.id = `cond_${name}_${Date.now()}`;
    this.name = name;
  }

  async execute(npc: NPC, context: BehaviorContext): Promise<BehaviorResult> {
    const result = await this.condition(npc, context);
    return { status: result ? 'success' : 'failure' };
  }
}

class ActionNode implements BehaviorNode {
  id: string;
  type: 'action' = 'action';
  name: string;

  constructor(
    name: string,
    private action: (
      npc: NPC,
      context: BehaviorContext
    ) => Promise<BehaviorResult>
  ) {
    this.id = `action_${name}_${Date.now()}`;
    this.name = name;
  }

  async execute(npc: NPC, context: BehaviorContext): Promise<BehaviorResult> {
    return await this.action(npc, context);
  }
}

// Export the main system
export const npcBehaviorSystem = new NPCBehaviorSystem();

export default NPCBehaviorSystem;
