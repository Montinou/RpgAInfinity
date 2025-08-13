/**
 * Event System for RpgAInfinity Game Engine
 *
 * Provides type-safe event handling, persistence, and real-time updates
 * Implements the EventSystem interface with robust error handling and memory leak prevention
 */

import { v4 as uuidv4 } from 'uuid';
import {
  GameEvent,
  GameEventType,
  EventHandler,
  UUID,
  GameError,
  GameEventSchema,
  validateWith,
} from '@/types/core';
import { kvService } from '@/lib/database/kv-service';

// ============================================================================
// INTERFACES AND TYPES
// ============================================================================

/**
 * Core EventSystem interface for managing game events
 */
export interface EventSystem {
  /**
   * Emit a game event and persist it to storage
   */
  emit(event: GameEvent): Promise<void>;

  /**
   * Subscribe to events of a specific type
   */
  subscribe(eventType: string, handler: EventHandler): void;

  /**
   * Unsubscribe from events of a specific type
   */
  unsubscribe(eventType: string, handler: EventHandler): void;

  /**
   * Get event history for a game with pagination
   */
  getEventHistory(gameId: string, limit?: number): Promise<GameEvent[]>;

  /**
   * Process the event queue for a specific game
   */
  processEventQueue(gameId: string): Promise<void>;
}

/**
 * Event queue entry for ordered processing
 */
interface QueuedEvent {
  readonly event: GameEvent;
  readonly retryCount: number;
  readonly queuedAt: Date;
  processingStartedAt?: Date; // Mutable for tracking processing time
}

/**
 * Subscriber registration with metadata
 */
interface EventSubscription {
  readonly handler: EventHandler;
  readonly subscribedAt: Date;
  readonly gameId?: UUID; // Optional game-specific subscription
}

// ============================================================================
// EVENT SYSTEM IMPLEMENTATION
// ============================================================================

export class GameEventSystem implements EventSystem {
  private static instance: GameEventSystem;

  // Event subscribers organized by event type
  private subscribers: Map<GameEventType, Set<EventSubscription>> = new Map();

  // Event queues organized by game ID for ordered processing
  private eventQueues: Map<UUID, QueuedEvent[]> = new Map();

  // Processing locks to prevent concurrent queue processing
  private processingLocks: Set<UUID> = new Set();

  private constructor() {
    // TODO: Add periodic cleanup of inactive subscriptions and queues
    this.startPeriodicCleanup();
  }

  /**
   * Singleton instance getter
   */
  static getInstance(): GameEventSystem {
    if (!GameEventSystem.instance) {
      GameEventSystem.instance = new GameEventSystem();
    }
    return GameEventSystem.instance;
  }

  // ============================================================================
  // CORE EVENT SYSTEM METHODS
  // ============================================================================

  /**
   * Emit a game event with validation, persistence, and notification
   */
  async emit(event: GameEvent): Promise<void> {
    try {
      // Validate the event structure
      const validatedEvent = validateWith(GameEventSchema, event);

      // Add to event queue for ordered processing
      await this.addToQueue(validatedEvent);

      // Process the queue immediately for real-time events
      await this.processEventQueue(validatedEvent.gameId);
    } catch (error) {
      // TODO: Implement proper error logging service
      console.error('Failed to emit event:', error);

      // Create GameError object following the interface
      const gameError: GameError = {
        code: 'VALIDATION_ERROR',
        message: `Event emission failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
        gameId: event.gameId,
      };

      throw gameError;
    }
  }

  /**
   * Subscribe to events of a specific type
   */
  subscribe(eventType: GameEventType, handler: EventHandler): void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }

    const subscription: EventSubscription = {
      handler,
      subscribedAt: new Date(),
    };

    this.subscribers.get(eventType)!.add(subscription);
  }

  /**
   * Unsubscribe from events of a specific type
   */
  unsubscribe(eventType: GameEventType, handler: EventHandler): void {
    const subscriptions = this.subscribers.get(eventType);
    if (!subscriptions) return;

    // Find and remove the subscription with matching handler
    for (const subscription of subscriptions) {
      if (subscription.handler === handler) {
        subscriptions.delete(subscription);
        break;
      }
    }

    // Clean up empty subscription sets to prevent memory leaks
    if (subscriptions.size === 0) {
      this.subscribers.delete(eventType);
    }
  }

  /**
   * Get event history for a game with optional limit
   */
  async getEventHistory(gameId: string, limit = 100): Promise<GameEvent[]> {
    try {
      // TODO: Implement proper pagination with cursor-based pagination
      const historyKey = this.getEventHistoryKey(gameId);
      const result = await kvService.get<GameEvent[]>(historyKey);

      if (!result.success || !result.data) {
        return [];
      }

      // Return most recent events first, limited by the specified limit
      return result.data
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('Failed to get event history:', error);
      return [];
    }
  }

  /**
   * Process the event queue for a specific game
   */
  async processEventQueue(gameId: string): Promise<void> {
    // Prevent concurrent processing of the same game's queue
    if (this.processingLocks.has(gameId)) {
      return;
    }

    this.processingLocks.add(gameId);

    try {
      const queue = this.eventQueues.get(gameId);
      if (!queue || queue.length === 0) {
        return;
      }

      // Process events in order (FIFO)
      while (queue.length > 0) {
        const queuedEvent = queue.shift()!;

        try {
          // Mark processing start time
          queuedEvent.processingStartedAt = new Date();

          // Persist the event
          await this.persistEvent(queuedEvent.event);

          // Notify subscribers
          await this.notifySubscribers(queuedEvent.event);
        } catch (error) {
          console.error('Failed to process queued event:', error);

          // TODO: Implement retry logic with exponential backoff
          if (queuedEvent.retryCount < 3) {
            queue.unshift({
              ...queuedEvent,
              retryCount: queuedEvent.retryCount + 1,
            });
          }

          // Stop processing this queue on persistent failures
          break;
        }
      }

      // Clean up empty queues to prevent memory leaks
      if (queue.length === 0) {
        this.eventQueues.delete(gameId);
      }
    } finally {
      this.processingLocks.delete(gameId);
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Add an event to the processing queue
   */
  private async addToQueue(event: GameEvent): Promise<void> {
    if (!this.eventQueues.has(event.gameId)) {
      this.eventQueues.set(event.gameId, []);
    }

    const queuedEvent: QueuedEvent = {
      event,
      retryCount: 0,
      queuedAt: new Date(),
    };

    this.eventQueues.get(event.gameId)!.push(queuedEvent);
  }

  /**
   * Persist an event to storage
   */
  private async persistEvent(event: GameEvent): Promise<void> {
    try {
      // Store individual event
      const eventKey = this.getEventKey(event.id);
      await kvService.set(eventKey, event, 604800); // 7 days TTL

      // Add to game's event history
      const historyKey = this.getEventHistoryKey(event.gameId);
      const historyResult = await kvService.get<GameEvent[]>(historyKey);

      const currentHistory =
        historyResult.success && historyResult.data ? historyResult.data : [];

      currentHistory.push(event);

      // Keep only the most recent 1000 events to prevent unbounded growth
      // TODO: Implement archiving for older events
      if (currentHistory.length > 1000) {
        currentHistory.splice(0, currentHistory.length - 1000);
      }

      await kvService.set(historyKey, currentHistory, 604800); // 7 days TTL
    } catch (error) {
      console.error('Failed to persist event:', error);
      throw error;
    }
  }

  /**
   * Notify all subscribers of an event
   */
  private async notifySubscribers(event: GameEvent): Promise<void> {
    const subscriptions = this.subscribers.get(event.type);
    if (!subscriptions || subscriptions.size === 0) {
      return;
    }

    // Execute all handlers concurrently but catch individual failures
    const notifications = Array.from(subscriptions).map(async subscription => {
      try {
        await subscription.handler(event);
      } catch (error) {
        console.error('Event handler failed:', error);
        // TODO: Implement handler failure tracking and automatic unsubscription
      }
    });

    await Promise.allSettled(notifications);
  }

  /**
   * Generate KV key for storing individual events
   */
  private getEventKey(eventId: UUID): string {
    return `event:${eventId}`;
  }

  /**
   * Generate KV key for storing game event history
   */
  private getEventHistoryKey(gameId: UUID): string {
    return `game:${gameId}:events`;
  }

  /**
   * Start periodic cleanup of inactive data to prevent memory leaks
   */
  private startPeriodicCleanup(): void {
    // TODO: Implement proper cleanup interval based on system load
    setInterval(() => {
      this.cleanup();
    }, 300000); // 5 minutes
  }

  /**
   * Clean up inactive subscriptions and empty queues
   */
  private cleanup(): void {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Clean up old subscriptions
    for (const [eventType, subscriptions] of this.subscribers) {
      for (const subscription of subscriptions) {
        if (now.getTime() - subscription.subscribedAt.getTime() > maxAge) {
          // TODO: Implement proper cleanup logic for stale subscriptions
          subscriptions.delete(subscription);
        }
      }

      if (subscriptions.size === 0) {
        this.subscribers.delete(eventType);
      }
    }

    // Clean up empty event queues
    for (const [gameId, queue] of this.eventQueues) {
      if (queue.length === 0) {
        this.eventQueues.delete(gameId);
      }
    }
  }
}

// ============================================================================
// FACTORY FUNCTIONS AND UTILITIES
// ============================================================================

/**
 * Create a new GameEvent with validation
 */
export function createGameEvent({
  type,
  gameId,
  data,
  affectedPlayers,
  isPublic = true,
}: {
  type: GameEventType;
  gameId: UUID;
  data: Record<string, any>;
  affectedPlayers?: UUID[];
  isPublic?: boolean;
}): GameEvent {
  return {
    id: uuidv4(),
    type,
    gameId,
    timestamp: new Date(),
    data,
    affectedPlayers,
    isPublic,
  };
}

/**
 * Singleton instance export for easy access
 */
export const eventSystem = GameEventSystem.getInstance();

// Export the GameEventSystem class as EventSystem for backward compatibility
export { GameEventSystem as EventSystem };

// Export the interface type separately
export type { EventSystem as IEventSystem };
