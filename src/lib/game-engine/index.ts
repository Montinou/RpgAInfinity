/**
 * Game Engine Module Exports
 *
 * Central export point for all game engine components.
 * Provides clean imports for other parts of the application.
 */

// Core engine
export { CoreGameEngine, gameEngine } from './core';

// Validation system
export { ValidationService, validationService } from './validation';
export type {
  ValidationResult,
  ActionValidationContext,
  ValidationRule,
} from './validation';

// Concurrency management
export { ConcurrencyManager, concurrencyManager } from './concurrency';
export type {
  LockInfo,
  AtomicOperation,
  ConcurrencyResult,
} from './concurrency';

// Performance monitoring
export {
  PerformanceMonitoringService,
  PerformanceTimer,
  performanceMonitor,
} from './performance';
export type {
  PerformanceMetric,
  SystemMetrics,
  AlertThreshold,
  PerformanceAlert,
} from './performance';

// Re-export core types for convenience
export type {
  GameEngine,
  GameConfig,
  Game,
  GameState,
  GameAction,
  ActionResult,
  GameEvent,
  GameError,
  Player,
  UUID,
  ErrorCode,
  GameEventType,
  EventHandler,
  SideEffect,
} from '@/types/core';
