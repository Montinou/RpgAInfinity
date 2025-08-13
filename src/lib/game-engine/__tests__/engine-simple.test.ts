/**
 * Simple Core Game Engine Tests
 *
 * Basic tests to validate the core game engine functionality
 * without complex type dependencies.
 */

import { describe, test, expect } from '@jest/globals';

describe('Core Game Engine - Basic Functionality', () => {
  test('should be able to import core engine modules', () => {
    // Test that we can import without errors
    expect(() => {
      const { gameEngine } = require('../core');
      const { validationService } = require('../validation');
      const { concurrencyManager } = require('../concurrency');
      const { performanceMonitor } = require('../performance');

      expect(gameEngine).toBeDefined();
      expect(validationService).toBeDefined();
      expect(concurrencyManager).toBeDefined();
      expect(performanceMonitor).toBeDefined();
    }).not.toThrow();
  });

  test('should create singleton instances', () => {
    const { CoreGameEngine } = require('../core');
    const { ValidationService } = require('../validation');
    const { ConcurrencyManager } = require('../concurrency');
    const { PerformanceMonitoringService } = require('../performance');

    const engine1 = CoreGameEngine.getInstance();
    const engine2 = CoreGameEngine.getInstance();
    expect(engine1).toBe(engine2);

    const validation1 = ValidationService.getInstance();
    const validation2 = ValidationService.getInstance();
    expect(validation1).toBe(validation2);

    const concurrency1 = ConcurrencyManager.getInstance();
    const concurrency2 = ConcurrencyManager.getInstance();
    expect(concurrency1).toBe(concurrency2);

    const performance1 = PerformanceMonitoringService.getInstance();
    const performance2 = PerformanceMonitoringService.getInstance();
    expect(performance1).toBe(performance2);
  });

  test('should have required methods on game engine', () => {
    const { gameEngine } = require('../core');

    expect(typeof gameEngine.createGame).toBe('function');
    expect(typeof gameEngine.processAction).toBe('function');
    expect(typeof gameEngine.saveState).toBe('function');
    expect(typeof gameEngine.loadState).toBe('function');
    expect(typeof gameEngine.validateAction).toBe('function');
    expect(typeof gameEngine.getPlayerActions).toBe('function');
    expect(typeof gameEngine.subscribe).toBe('function');
    expect(typeof gameEngine.unsubscribe).toBe('function');
  });

  test('should have required methods on validation service', () => {
    const { validationService } = require('../validation');

    expect(typeof validationService.validateAction).toBe('function');
    expect(typeof validationService.validateStateTransition).toBe('function');
    expect(typeof validationService.validatePlayerPermissions).toBe('function');
    expect(typeof validationService.registerValidationRule).toBe('function');
    expect(typeof validationService.removeValidationRule).toBe('function');
    expect(typeof validationService.getValidationRules).toBe('function');
  });

  test('should have required methods on concurrency manager', () => {
    const { concurrencyManager } = require('../concurrency');

    expect(typeof concurrencyManager.acquireLock).toBe('function');
    expect(typeof concurrencyManager.releaseLock).toBe('function');
    expect(typeof concurrencyManager.executeAtomic).toBe('function');
    expect(typeof concurrencyManager.executeBatch).toBe('function');
    expect(typeof concurrencyManager.queueOperation).toBe('function');
    expect(typeof concurrencyManager.getStats).toBe('function');
    expect(typeof concurrencyManager.cleanupExpiredLocks).toBe('function');
  });

  test('should have required methods on performance monitor', () => {
    const { performanceMonitor } = require('../performance');

    expect(typeof performanceMonitor.startTiming).toBe('function');
    expect(typeof performanceMonitor.recordMetric).toBe('function');
    expect(typeof performanceMonitor.measureOperation).toBe('function');
    expect(typeof performanceMonitor.collectSystemMetrics).toBe('function');
    expect(typeof performanceMonitor.getOperationStats).toBe('function');
    expect(typeof performanceMonitor.getCurrentSystemMetrics).toBe('function');
    expect(typeof performanceMonitor.getSystemMetricsHistory).toBe('function');
    expect(typeof performanceMonitor.addAlertThreshold).toBe('function');
    expect(typeof performanceMonitor.removeAlertThreshold).toBe('function');
    expect(typeof performanceMonitor.getActiveAlerts).toBe('function');
    expect(typeof performanceMonitor.clearAlert).toBe('function');
  });

  test('should return stats from concurrency manager', () => {
    const { concurrencyManager } = require('../concurrency');

    const stats = concurrencyManager.getStats();
    expect(stats).toHaveProperty('activeLocks');
    expect(stats).toHaveProperty('queuedOperations');
    expect(stats).toHaveProperty('gameQueues');
    expect(typeof stats.activeLocks).toBe('number');
    expect(typeof stats.queuedOperations).toBe('number');
    expect(typeof stats.gameQueues).toBe('number');
  });

  test('should collect system metrics', () => {
    const { performanceMonitor } = require('../performance');

    const metrics = performanceMonitor.collectSystemMetrics();
    expect(metrics).toHaveProperty('timestamp');
    expect(metrics).toHaveProperty('memoryUsage');
    expect(metrics).toHaveProperty('activeGames');
    expect(metrics).toHaveProperty('activePlayers');
    expect(metrics).toHaveProperty('operationsPerSecond');
    expect(metrics).toHaveProperty('averageResponseTime');
    expect(metrics).toHaveProperty('errorRate');

    expect(metrics.memoryUsage).toHaveProperty('used');
    expect(metrics.memoryUsage).toHaveProperty('total');
    expect(metrics.memoryUsage).toHaveProperty('percentage');
  });

  test('should manage validation rules', () => {
    const { validationService } = require('../validation');

    const testRule = {
      name: 'test-rule',
      description: 'A test rule',
      priority: 'medium',
      validate: () => ({ isValid: true, errors: [], warnings: [] }),
    };

    // Register rule
    validationService.registerValidationRule(['test-action'], testRule);

    // Get rules
    const rules = validationService.getValidationRules('test-action');
    expect(rules.some(rule => rule.name === 'test-rule')).toBe(true);

    // Remove rule
    validationService.removeValidationRule('test-action', 'test-rule');
    const rulesAfter = validationService.getValidationRules('test-action');
    expect(rulesAfter.some(rule => rule.name === 'test-rule')).toBe(false);
  });

  test('should start and end performance timing', () => {
    const { performanceMonitor } = require('../performance');

    const timer = performanceMonitor.startTiming('test-operation');
    expect(timer).toBeDefined();
    expect(typeof timer.end).toBe('function');

    const duration = timer.end(true);
    expect(typeof duration).toBe('number');
    expect(duration).toBeGreaterThanOrEqual(0);
  });

  test('should measure operations', async () => {
    const { performanceMonitor } = require('../performance');

    const result = await performanceMonitor.measureOperation(
      'test-async-operation',
      async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'test-result';
      }
    );

    expect(result).toBe('test-result');
  });

  test('should handle measurement operation errors', async () => {
    const { performanceMonitor } = require('../performance');

    await expect(
      performanceMonitor.measureOperation('test-error-operation', async () => {
        throw new Error('Test error');
      })
    ).rejects.toThrow('Test error');
  });
});
