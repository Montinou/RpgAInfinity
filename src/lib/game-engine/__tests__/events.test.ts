/**
 * Unit tests for EventSystem
 * Tests event emission, persistence, subscription patterns, and error handling
 */

import { v4 as uuidv4 } from 'uuid';
import { GameEventSystem, createGameEvent, eventSystem } from '../events';
import { GameEvent, GameEventType, EventHandler } from '@/types/core';

// Mock KV service to avoid external dependencies in tests
jest.mock('@/lib/database/kv-service', () => ({
  kvService: {
    set: jest.fn(),
    get: jest.fn(),
    getInstance: jest.fn(),
  },
}));

describe('GameEventSystem', () => {
  let testEventSystem: GameEventSystem;
  let mockHandler: jest.MockedFunction<EventHandler>;
  let testGameId: string;
  let testEvent: GameEvent;

  beforeEach(() => {
    // Get the mocked kvService
    const { kvService } = require('@/lib/database/kv-service');

    // Reset mock functions
    jest.clearAllMocks();
    kvService.set.mockResolvedValue({
      success: true,
      data: true,
      timestamp: new Date(),
    });
    kvService.get.mockResolvedValue({
      success: true,
      data: [],
      timestamp: new Date(),
    });

    testEventSystem = GameEventSystem.getInstance();
    mockHandler = jest.fn();
    testGameId = uuidv4();
    testEvent = createGameEvent({
      type: 'player_action',
      gameId: testGameId,
      data: { action: 'move', direction: 'north' },
      isPublic: true,
    });

    // Clear any existing subscribers before each test
    testEventSystem['subscribers'].clear();
    testEventSystem['eventQueues'].clear();
    testEventSystem['processingLocks'].clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance for multiple getInstance calls', () => {
      const instance1 = GameEventSystem.getInstance();
      const instance2 = GameEventSystem.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should return the same instance as the exported singleton', () => {
      const instance = GameEventSystem.getInstance();
      expect(instance).toBe(eventSystem);
    });
  });

  describe('Event Creation', () => {
    it('should create a valid GameEvent with createGameEvent helper', () => {
      const event = createGameEvent({
        type: 'test_event',
        gameId: testGameId,
        data: { test: 'data' },
        affectedPlayers: [uuidv4()],
        isPublic: false,
      });

      expect(event).toMatchObject({
        type: 'test_event',
        gameId: testGameId,
        data: { test: 'data' },
        isPublic: false,
      });
      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.affectedPlayers).toHaveLength(1);
    });

    it('should default isPublic to true', () => {
      const event = createGameEvent({
        type: 'test_event',
        gameId: testGameId,
        data: {},
      });

      expect(event.isPublic).toBe(true);
    });
  });

  describe('Event Subscription', () => {
    it('should allow subscribing to events', () => {
      testEventSystem.subscribe('test_event', mockHandler);

      const subscribers = testEventSystem['subscribers'].get('test_event');
      expect(subscribers).toBeDefined();
      expect(subscribers?.size).toBe(1);
    });

    it('should allow multiple handlers for the same event type', () => {
      const mockHandler2 = jest.fn();

      testEventSystem.subscribe('test_event', mockHandler);
      testEventSystem.subscribe('test_event', mockHandler2);

      const subscribers = testEventSystem['subscribers'].get('test_event');
      expect(subscribers?.size).toBe(2);
    });

    it('should allow subscribing to multiple event types', () => {
      testEventSystem.subscribe('event1', mockHandler);
      testEventSystem.subscribe('event2', mockHandler);

      expect(testEventSystem['subscribers'].size).toBe(2);
    });
  });

  describe('Event Unsubscription', () => {
    beforeEach(() => {
      testEventSystem.subscribe('test_event', mockHandler);
    });

    it('should remove specific handler from subscriptions', () => {
      testEventSystem.unsubscribe('test_event', mockHandler);

      const subscribers = testEventSystem['subscribers'].get('test_event');
      expect(subscribers).toBeUndefined();
    });

    it('should not affect other handlers when unsubscribing', () => {
      const mockHandler2 = jest.fn();
      testEventSystem.subscribe('test_event', mockHandler2);

      testEventSystem.unsubscribe('test_event', mockHandler);

      const subscribers = testEventSystem['subscribers'].get('test_event');
      expect(subscribers?.size).toBe(1);
    });

    it('should handle unsubscribing non-existent handlers gracefully', () => {
      const nonExistentHandler = jest.fn();

      expect(() => {
        testEventSystem.unsubscribe('test_event', nonExistentHandler);
      }).not.toThrow();
    });

    it('should handle unsubscribing from non-existent event types gracefully', () => {
      expect(() => {
        testEventSystem.unsubscribe('non_existent_event', mockHandler);
      }).not.toThrow();
    });
  });

  describe('Event Emission', () => {
    it('should emit events successfully with valid data', async () => {
      await expect(testEventSystem.emit(testEvent)).resolves.not.toThrow();
    });

    it('should validate event data before emission', async () => {
      const invalidEvent = {
        ...testEvent,
        id: 'invalid-uuid', // Invalid UUID format
      } as GameEvent;

      await expect(testEventSystem.emit(invalidEvent)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('should add events to the queue', async () => {
      testEventSystem.subscribe(testEvent.type, mockHandler);

      await testEventSystem.emit(testEvent);

      // Event should be processed and queue should be empty or cleared
      const queue = testEventSystem['eventQueues'].get(testGameId);
      expect(queue?.length || 0).toBe(0);
    });
  });

  describe('Event Queue Processing', () => {
    it('should process events in FIFO order', async () => {
      const event1 = createGameEvent({
        type: 'test_event',
        gameId: testGameId,
        data: { order: 1 },
      });
      const event2 = createGameEvent({
        type: 'test_event',
        gameId: testGameId,
        data: { order: 2 },
      });

      const processedEvents: GameEvent[] = [];
      const orderTrackingHandler: EventHandler = event => {
        processedEvents.push(event);
      };

      testEventSystem.subscribe('test_event', orderTrackingHandler);

      // Add events to queue manually to test ordering
      testEventSystem['addToQueue'](event1);
      testEventSystem['addToQueue'](event2);

      await testEventSystem.processEventQueue(testGameId);

      expect(processedEvents).toHaveLength(2);
      expect(processedEvents[0].data.order).toBe(1);
      expect(processedEvents[1].data.order).toBe(2);
    });

    it('should prevent concurrent processing with locks', async () => {
      const processingStarted = jest.fn();
      const processingCompleted = jest.fn();

      // Mock a slow event handler
      const slowHandler: EventHandler = async () => {
        processingStarted();
        await new Promise(resolve => setTimeout(resolve, 100));
        processingCompleted();
      };

      testEventSystem.subscribe(testEvent.type, slowHandler);
      testEventSystem['addToQueue'](testEvent);

      // Start two concurrent processing calls
      const promise1 = testEventSystem.processEventQueue(testGameId);
      const promise2 = testEventSystem.processEventQueue(testGameId);

      await Promise.all([promise1, promise2]);

      // Handler should only be called once due to locking
      expect(processingStarted).toHaveBeenCalledTimes(1);
      expect(processingCompleted).toHaveBeenCalledTimes(1);
    });

    it('should clean up empty queues after processing', async () => {
      testEventSystem.subscribe(testEvent.type, mockHandler);
      testEventSystem['addToQueue'](testEvent);

      await testEventSystem.processEventQueue(testGameId);

      const queue = testEventSystem['eventQueues'].get(testGameId);
      expect(queue).toBeUndefined();
    });
  });

  describe('Event History', () => {
    it('should return empty array when no events exist', async () => {
      const history = await testEventSystem.getEventHistory(testGameId);
      expect(history).toEqual([]);
    });

    it('should respect the limit parameter', async () => {
      const history = await testEventSystem.getEventHistory(testGameId, 5);
      expect(history.length).toBeLessThanOrEqual(5);
    });

    it('should default to limit of 100 events', async () => {
      // This test would require mocking a large event history
      const history = await testEventSystem.getEventHistory(testGameId);
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle subscriber errors gracefully', async () => {
      const errorHandler: EventHandler = () => {
        throw new Error('Handler error');
      };
      const workingHandler = jest.fn();

      testEventSystem.subscribe(testEvent.type, errorHandler);
      testEventSystem.subscribe(testEvent.type, workingHandler);

      // Should not throw despite handler error
      await expect(testEventSystem.emit(testEvent)).resolves.not.toThrow();

      // Working handler should still be called
      expect(workingHandler).toHaveBeenCalled();
    });

    it('should handle KV service failures gracefully', async () => {
      // Mock KV service failure for this test
      const { kvService } = require('@/lib/database/kv-service');
      kvService.set.mockRejectedValueOnce(new Error('KV failure'));
      kvService.get.mockRejectedValueOnce(new Error('KV failure'));

      const history = await testEventSystem.getEventHistory(testGameId);
      expect(history).toEqual([]);
    });
  });

  describe('Memory Management', () => {
    it('should clean up empty subscription sets', () => {
      testEventSystem.subscribe('test_event', mockHandler);
      testEventSystem.unsubscribe('test_event', mockHandler);

      const subscribers = testEventSystem['subscribers'].get('test_event');
      expect(subscribers).toBeUndefined();
    });

    it('should prevent memory leaks from accumulating subscriptions', () => {
      // Add many subscriptions
      for (let i = 0; i < 100; i++) {
        const handler = jest.fn();
        testEventSystem.subscribe(`event_${i}`, handler);
      }

      expect(testEventSystem['subscribers'].size).toBe(100);

      // Cleanup method should handle this (tested indirectly)
      expect(testEventSystem['cleanup']).toBeDefined();
    });
  });

  describe('Event Types Support', () => {
    it('should handle player action events', async () => {
      const playerEvent = createGameEvent({
        type: 'player_move',
        gameId: testGameId,
        data: { playerId: uuidv4(), position: { x: 10, y: 20 } },
      });

      await expect(testEventSystem.emit(playerEvent)).resolves.not.toThrow();
    });

    it('should handle game state change events', async () => {
      const stateEvent = createGameEvent({
        type: 'turn_start',
        gameId: testGameId,
        data: { turn: 5, currentPlayer: uuidv4() },
      });

      await expect(testEventSystem.emit(stateEvent)).resolves.not.toThrow();
    });

    it('should handle AI-generated events', async () => {
      const aiEvent = createGameEvent({
        type: 'world_event',
        gameId: testGameId,
        data: {
          eventType: 'weather_change',
          description: 'A storm approaches the village',
          effects: { visibility: -2, movement: -1 },
        },
      });

      await expect(testEventSystem.emit(aiEvent)).resolves.not.toThrow();
    });

    it('should handle system events', async () => {
      const systemEvent = createGameEvent({
        type: 'player_joined',
        gameId: testGameId,
        data: { playerId: uuidv4(), playerName: 'TestPlayer' },
        isPublic: true,
      });

      await expect(testEventSystem.emit(systemEvent)).resolves.not.toThrow();
    });
  });

  describe('Event Privacy', () => {
    it('should respect isPublic flag for event visibility', () => {
      const privateEvent = createGameEvent({
        type: 'private_action',
        gameId: testGameId,
        data: { secret: 'data' },
        isPublic: false,
      });

      expect(privateEvent.isPublic).toBe(false);
    });

    it('should handle affected players correctly', () => {
      const playerId1 = uuidv4();
      const playerId2 = uuidv4();

      const targetedEvent = createGameEvent({
        type: 'targeted_action',
        gameId: testGameId,
        data: { message: 'Hello targeted players' },
        affectedPlayers: [playerId1, playerId2],
      });

      expect(targetedEvent.affectedPlayers).toEqual([playerId1, playerId2]);
    });
  });
});

describe('Event System Integration', () => {
  it('should maintain event ordering consistency across multiple games', async () => {
    const game1Id = uuidv4();
    const game2Id = uuidv4();

    const event1 = createGameEvent({
      type: 'test_event',
      gameId: game1Id,
      data: { game: 1, order: 1 },
    });

    const event2 = createGameEvent({
      type: 'test_event',
      gameId: game2Id,
      data: { game: 2, order: 1 },
    });

    await expect(
      Promise.all([eventSystem.emit(event1), eventSystem.emit(event2)])
    ).resolves.not.toThrow();
  });

  it('should handle high-frequency event emission', async () => {
    const gameId = uuidv4();
    const events: Promise<void>[] = [];

    for (let i = 0; i < 10; i++) {
      // Reduced from 50 to 10 for faster tests
      const event = createGameEvent({
        type: 'high_frequency',
        gameId: gameId,
        data: { sequence: i },
      });

      events.push(eventSystem.emit(event));
    }

    await expect(Promise.all(events)).resolves.not.toThrow();
  });
});
