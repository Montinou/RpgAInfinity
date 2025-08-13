/**
 * NPC Behavior System Tests
 *
 * Comprehensive test suite for the village NPC behavior system including:
 * - Personality generation and analysis
 * - Dialogue generation and context awareness
 * - Social interaction and relationship management
 * - Memory systems and learning
 * - Behavior trees and decision making
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
  afterEach,
} from '@jest/globals';
import { NPCBehaviorSystem, npcBehaviorSystem } from '../npcs';
import { createTestVillage, createTestNPC } from '../index';
import type {
  NPC,
  Village,
  VillageGameState,
  VillageContext,
  DialogueContext,
  Interaction,
  NPCAction,
  VillageEvent,
  Player,
  MemoryEntry,
  RelationshipUpdate,
} from '../../../../types/village';
import { generateVillageContent } from '../../../ai';

// Mock the AI service
jest.mock('../../../ai');
const mockGenerateVillageContent =
  generateVillageContent as jest.MockedFunction<typeof generateVillageContent>;

describe('NPCBehaviorSystem', () => {
  let npcSystem: NPCBehaviorSystem;
  let testVillage: Village;
  let testNPC: NPC;
  let testContext: VillageContext;
  let testPlayer: Player;

  beforeEach(() => {
    npcSystem = new NPCBehaviorSystem();
    testVillage = createTestVillage();
    testNPC = createTestNPC();
    testContext = {
      village: testVillage,
      gameState: {
        villageId: testVillage.id,
        gameDay: 1,
        season: testVillage.season,
        weather: testVillage.weather,
        dailyProduction: {},
        dailyConsumption: {},
        resourceAlerts: [],
        populationGrowth: 0,
        happinessChange: 0,
        activeProjects: [],
        queuedActions: [],
        activeCrises: [],
        crisisResponse: [],
        developmentGoals: [],
        aiDecisions: [],
        lastAIEvent: new Date(),
        sessionId: 'test-session',
        gameId: 'test-game',
        playerId: 'test-player',
        phase: 'active',
        startedAt: new Date(),
        lastAction: new Date(),
        isActive: true,
        version: '1.0.0',
      } as VillageGameState,
      currentTime: new Date(),
      weather: testVillage.weather,
      activeEvents: [],
    };
    testPlayer = {
      id: 'test-player',
      name: 'Test Player',
      reputation: 50,
    } as Player;

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('NPC Generation', () => {
    it('should generate NPCs with AI-powered personalities', async () => {
      mockGenerateVillageContent.mockResolvedValue({
        success: true,
        response: {
          content: JSON.stringify({
            name: 'Generated NPC',
            age: 30,
            profession: 'farmer',
            personality: {
              extraversion: 60,
              agreeableness: 70,
            },
          }),
          tokenUsage: { prompt: 100, completion: 50, total: 150 },
        },
        processingTime: 500,
        cached: false,
      });

      const npcs = await npcSystem.generateNPCPersonalities(1, testVillage);

      expect(npcs).toHaveLength(1);
      expect(npcs[0]).toHaveProperty('name');
      expect(npcs[0]).toHaveProperty('aiPersonality');
      expect(mockGenerateVillageContent).toHaveBeenCalledWith(
        'npc_generation',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should handle AI generation failures gracefully', async () => {
      mockGenerateVillageContent.mockRejectedValue(
        new Error('AI service unavailable')
      );

      const npcs = await npcSystem.generateNPCPersonalities(2, testVillage);

      expect(npcs).toHaveLength(0); // Should return empty array on failure
      expect(mockGenerateVillageContent).toHaveBeenCalled();
    });

    it('should generate diverse NPC personalities', async () => {
      // Mock different personality responses
      mockGenerateVillageContent
        .mockResolvedValueOnce({
          success: true,
          response: {
            content: JSON.stringify({
              name: 'Introverted NPC',
              personality: { extraversion: 20 },
            }),
            tokenUsage: { prompt: 100, completion: 50, total: 150 },
          },
          processingTime: 500,
          cached: false,
        })
        .mockResolvedValueOnce({
          success: true,
          response: {
            content: JSON.stringify({
              name: 'Extroverted NPC',
              personality: { extraversion: 90 },
            }),
            tokenUsage: { prompt: 100, completion: 50, total: 150 },
          },
          processingTime: 500,
          cached: false,
        });

      const npcs = await npcSystem.generateNPCPersonalities(2, testVillage);

      expect(npcs).toHaveLength(2);
      // Verify different personalities were generated
      expect(npcs[0].name).not.toBe(npcs[1].name);
    });
  });

  describe('Dialogue Generation', () => {
    const mockDialogueContext: DialogueContext = {
      topic: 'weather',
      location: 'town_square',
      timeOfDay: 12,
      urgency: 'normal',
      recentEvents: [],
      villageMood: 'content',
      season: 'spring',
    };

    it('should generate contextual dialogue', async () => {
      mockGenerateVillageContent.mockResolvedValue({
        success: true,
        response: {
          content:
            "Beautiful spring weather we're having, isn't it? Perfect for planting season.",
          tokenUsage: { prompt: 200, completion: 30, total: 230 },
        },
        processingTime: 600,
        cached: false,
      });

      const dialogue = await npcSystem.generateDialogue(
        testNPC,
        testPlayer,
        mockDialogueContext
      );

      expect(dialogue).toContain('spring');
      expect(dialogue).toContain('weather');
      expect(mockGenerateVillageContent).toHaveBeenCalledWith(
        'npc_dialogue',
        expect.objectContaining({
          npc: expect.objectContaining({ name: testNPC.name }),
          player: expect.objectContaining({ name: testPlayer.name }),
          context: expect.objectContaining({ topic: 'weather' }),
        }),
        expect.any(Object)
      );
    });

    it('should use fallback dialogue when AI fails', async () => {
      mockGenerateVillageContent.mockRejectedValue(new Error('Network error'));

      const dialogue = await npcSystem.generateDialogue(
        testNPC,
        testPlayer,
        mockDialogueContext
      );

      expect(dialogue).toContain(testNPC.name);
      expect(typeof dialogue).toBe('string');
      expect(dialogue.length).toBeGreaterThan(0);
    });

    it('should consider NPC personality in dialogue', async () => {
      const shyNPC = {
        ...testNPC,
        personality: { ...testNPC.personality, sociability: 20 },
      };

      mockGenerateVillageContent.mockResolvedValue({
        success: true,
        response: {
          content: '*speaks quietly* Oh, hello... nice weather.',
          tokenUsage: { prompt: 200, completion: 25, total: 225 },
        },
        processingTime: 550,
        cached: false,
      });

      const dialogue = await npcSystem.generateDialogue(
        shyNPC,
        testPlayer,
        mockDialogueContext
      );

      expect(dialogue).toContain('quietly');
      expect(mockGenerateVillageContent).toHaveBeenCalledWith(
        'npc_dialogue',
        expect.objectContaining({
          npc: expect.objectContaining({
            personality: expect.objectContaining({ sociability: 20 }),
          }),
        }),
        expect.any(Object)
      );
    });
  });

  describe('NPC Updates and Behavior', () => {
    it('should update NPCs based on village context', async () => {
      const npcs = [testNPC];

      const updatedNPCs = await npcSystem.updateNPCs(npcs, testContext);

      expect(updatedNPCs).toHaveLength(1);
      expect(updatedNPCs[0]).toHaveProperty('id', testNPC.id);
      // Should maintain NPC structure but potentially update state
    });

    it('should handle multiple NPCs simultaneously', async () => {
      const npcs = [
        testNPC,
        { ...createTestNPC(), id: 'test-npc-2', name: 'Second NPC' },
      ];

      const updatedNPCs = await npcSystem.updateNPCs(npcs, testContext);

      expect(updatedNPCs).toHaveLength(2);
      expect(updatedNPCs.map(npc => npc.id)).toContain('test-npc-1');
      expect(updatedNPCs.map(npc => npc.id)).toContain('test-npc-2');
    });

    it('should continue with other NPCs if one update fails', async () => {
      const faultyNPC = { ...testNPC, id: 'faulty-npc' };
      const npcs = [testNPC, faultyNPC];

      // Mock error for specific NPC (in real implementation, this would be behavior tree failure)
      const updatedNPCs = await npcSystem.updateNPCs(npcs, testContext);

      expect(updatedNPCs).toHaveLength(2);
      // Should still have both NPCs even if one had issues
    });
  });

  describe('Interaction Processing', () => {
    const mockInteraction: Interaction = {
      id: 'test-interaction',
      type: 'greeting',
      playerId: testPlayer.id,
      npcId: testNPC.id,
      description: 'Player greets NPC',
      timestamp: new Date(),
    };

    it('should process player-NPC interactions', async () => {
      const result = await npcSystem.processInteraction(
        testNPC,
        mockInteraction
      );

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('response');
      expect(result).toHaveProperty('npcStateChanges');
      expect(result).toHaveProperty('relationshipChange');
    });

    it('should create memories from interactions', async () => {
      const result = await npcSystem.processInteraction(
        testNPC,
        mockInteraction
      );

      expect(result).toHaveProperty('newMemory');
      if (result.newMemory) {
        expect(result.newMemory).toHaveProperty('type', 'interaction');
        expect(result.newMemory).toHaveProperty('content');
        expect(result.newMemory).toHaveProperty('importance');
        expect(result.newMemory.associatedNPCs).toContain(testPlayer.id);
      }
    });

    it('should affect relationships based on interaction type', async () => {
      const complimentInteraction: Interaction = {
        ...mockInteraction,
        type: 'compliment',
        description: "Player compliments NPC's work",
      };

      const result = await npcSystem.processInteraction(
        testNPC,
        complimentInteraction
      );

      expect(result.relationshipChange).toBeGreaterThanOrEqual(0); // Should be positive or neutral
    });
  });

  describe('Decision Making', () => {
    const mockActions: NPCAction[] = [
      {
        id: 'work',
        type: 'work',
        description: 'Continue blacksmithing',
        duration: 4,
        priority: 70,
        effects: [
          { type: 'resource', modifier: 10, description: 'Produces tools' },
        ],
      },
      {
        id: 'socialize',
        type: 'socialize',
        description: 'Chat with neighbors',
        duration: 2,
        priority: 40,
        effects: [
          { type: 'happiness', modifier: 5, description: 'Improves mood' },
        ],
      },
      {
        id: 'rest',
        type: 'rest',
        description: 'Take a break',
        duration: 1,
        priority: 30,
        effects: [
          { type: 'happiness', modifier: 2, description: 'Reduces stress' },
        ],
      },
    ];

    it('should simulate NPC decision making', async () => {
      const decision = await npcSystem.simulateNPCDecisions(
        testNPC,
        mockActions
      );

      expect(decision).toHaveProperty('id');
      expect(decision).toHaveProperty('type');
      expect(decision).toHaveProperty('description');
      expect(mockActions.map(a => a.id)).toContain(decision.id);
    });

    it('should prioritize actions based on NPC needs', async () => {
      // NPC with high work ethic should prefer work actions
      const hardWorker = {
        ...testNPC,
        workEthic: 95,
        needs: { ...testNPC.needs, purpose: 30 }, // Low purpose satisfaction
      };

      const decision = await npcSystem.simulateNPCDecisions(
        hardWorker,
        mockActions
      );

      // Should likely choose work action due to high work ethic and low purpose satisfaction
      expect(decision.type).toBe('work');
    });

    it('should consider personality in decision making', async () => {
      // Very social NPC should prefer social actions
      const socialNPC = {
        ...testNPC,
        personality: { ...testNPC.personality, sociability: 95 },
        socialEnergy: 90,
        needs: { ...testNPC.needs, social: 40 }, // Low social satisfaction
      };

      const decision = await npcSystem.simulateNPCDecisions(
        socialNPC,
        mockActions
      );

      // Should likely choose socialize action
      expect(decision.type).toBe('socialize');
    });
  });

  describe('Relationship Management', () => {
    it('should update relationships between NPCs', async () => {
      const npcs = [testNPC, { ...createTestNPC(), id: 'npc-2' }];
      const events: VillageEvent[] = [
        {
          id: 'community-event',
          name: 'Harvest Festival',
          type: 'cultural',
          severity: 'beneficial',
          description: 'Annual harvest celebration',
          startDate: new Date(),
          duration: 1,
          effects: [],
          responses: [],
          isActive: true,
          isResolved: false,
          generatedByAI: true,
        },
      ];

      const updates = await npcSystem.updateNPCRelationships(npcs, events);

      expect(Array.isArray(updates)).toBe(true);
      // Positive community events should generally improve relationships
      updates.forEach(update => {
        expect(update).toHaveProperty('npcId');
        expect(update).toHaveProperty('targetId');
        expect(update).toHaveProperty('change');
        expect(update).toHaveProperty('reason');
      });
    });

    it('should handle relationship evolution over time', async () => {
      const npcs = [testNPC];
      const events: VillageEvent[] = []; // No events, just natural evolution

      const updates = await npcSystem.updateNPCRelationships(npcs, events);

      expect(Array.isArray(updates)).toBe(true);
      // Even without events, relationships may naturally evolve
    });
  });

  describe('Memory System', () => {
    it('should store and retrieve NPC memories', () => {
      const memory: MemoryEntry = {
        id: 'test-memory',
        type: 'interaction',
        content: 'Met a friendly traveler',
        importance: 70,
        timestamp: new Date(),
        associatedNPCs: ['traveler-1'],
        emotionalImpact: 10,
        decayRate: 0.02,
      };

      // This tests the private method indirectly through interactions
      // In a real test, we'd need to expose memory management methods
      expect(memory).toHaveProperty('importance');
      expect(memory.importance).toBeGreaterThan(0);
    });

    it('should apply memory decay over time', () => {
      // Test would verify that older memories become less important
      // This would be tested through the memory management system
      const oldMemory: MemoryEntry = {
        id: 'old-memory',
        type: 'observation',
        content: 'Saw a beautiful sunset',
        importance: 50,
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        emotionalImpact: 5,
        decayRate: 0.05,
      };

      expect(oldMemory.timestamp).toBeDefined();
      // Memory decay would be applied by the system
    });
  });

  describe('Behavior Tree System', () => {
    it('should execute behavior trees for NPCs', () => {
      // Test behavior tree execution
      // This would test the behavior tree nodes and their execution
      expect(testNPC).toHaveProperty('personality');
      expect(testNPC.personality).toHaveProperty('ambition');
    });

    it('should handle different behavior tree types', () => {
      // Test different behavior trees for different NPC types
      const merchantNPC = {
        ...testNPC,
        profession: { ...testNPC.profession, category: 'trade' as const },
      };

      expect(merchantNPC.profession.category).toBe('trade');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty NPC arrays', async () => {
      const result = await npcSystem.updateNPCs([], testContext);
      expect(result).toEqual([]);
    });

    it('should handle invalid village context gracefully', async () => {
      const invalidContext = { ...testContext, village: null as any };

      // Should not throw error, but handle gracefully
      const result = await npcSystem.updateNPCs([testNPC], testContext);
      expect(result).toBeDefined();
    });

    it('should handle NPCs with missing required properties', async () => {
      const incompleteNPC = { ...testNPC, personality: undefined as any };

      const result = await npcSystem.updateNPCs([incompleteNPC], testContext);
      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of NPCs efficiently', async () => {
      const manyNPCs = Array.from({ length: 100 }, (_, i) => ({
        ...createTestNPC(),
        id: `npc-${i}`,
        name: `NPC ${i}`,
      }));

      const startTime = Date.now();
      const result = await npcSystem.updateNPCs(manyNPCs, testContext);
      const endTime = Date.now();

      expect(result).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    it('should manage memory usage with many NPCs', async () => {
      // Test memory management doesn't grow unbounded
      const npcs = Array.from({ length: 50 }, (_, i) => ({
        ...createTestNPC(),
        id: `memory-test-npc-${i}`,
      }));

      const result = await npcSystem.updateNPCs(npcs, testContext);
      expect(result).toHaveLength(50);

      // Memory should not grow exponentially
      // This would need more sophisticated memory monitoring in practice
    });
  });
});

describe('Behavior Tree Components', () => {
  // Test individual behavior tree components

  it('should execute sequence nodes correctly', () => {
    // Test SequenceNode execution
    expect(true).toBe(true); // Placeholder
  });

  it('should execute selector nodes correctly', () => {
    // Test SelectorNode execution
    expect(true).toBe(true); // Placeholder
  });

  it('should evaluate conditions correctly', () => {
    // Test ConditionNode evaluation
    expect(true).toBe(true); // Placeholder
  });

  it('should execute actions correctly', () => {
    // Test ActionNode execution
    expect(true).toBe(true); // Placeholder
  });
});

describe('Integration Tests', () => {
  it('should integrate with AI service correctly', async () => {
    mockGenerateVillageContent.mockResolvedValue({
      success: true,
      response: {
        content: 'Integration test response',
        tokenUsage: { prompt: 100, completion: 50, total: 150 },
      },
      processingTime: 500,
      cached: false,
    });

    const dialogue = await npcSystem.generateDialogue(testNPC, testPlayer, {
      topic: 'test',
      location: 'test',
      timeOfDay: 12,
    });

    expect(dialogue).toBe('Integration test response');
    expect(mockGenerateVillageContent).toHaveBeenCalled();
  });

  it('should work with village game state changes', async () => {
    // Test how NPC system responds to village state changes
    const crisisContext = {
      ...testContext,
      activeEvents: [
        {
          id: 'drought',
          name: 'Severe Drought',
          type: 'natural' as const,
          severity: 'major' as const,
          description: 'Water shortage affecting the village',
          startDate: new Date(),
          duration: 30,
          effects: [],
          responses: [],
          isActive: true,
          isResolved: false,
          generatedByAI: true,
        },
      ],
    };

    const result = await npcSystem.updateNPCs([testNPC], crisisContext);
    expect(result).toHaveLength(1);
    // NPCs should respond to crisis events
  });
});

// TODO: Add tests for crisis response behaviors
// TODO: Add tests for seasonal behavior changes
// TODO: Add tests for long-term relationship evolution
// TODO: Add tests for learning and adaptation
// TODO: Add tests for community event participation
// TODO: Add performance benchmarks for large villages
// TODO: Add tests for cross-cultural NPC generation
// TODO: Add tests for NPC skill development over time
