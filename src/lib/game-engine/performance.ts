/**
 * Performance Monitoring Service for Game Engine
 *
 * Provides comprehensive performance monitoring, metrics collection,
 * and debugging capabilities for game engine operations. Tracks
 * response times, memory usage, and system health metrics.
 */

import { GameAction, GameState, UUID } from '@/types/core';

// ============================================================================
// PERFORMANCE METRICS TYPES
// ============================================================================

export interface PerformanceMetric {
  readonly operation: string;
  readonly startTime: number;
  readonly endTime: number;
  readonly duration: number;
  readonly gameId?: string;
  readonly playerId?: string;
  readonly success: boolean;
  readonly error?: string;
  readonly metadata?: Record<string, any>;
}

export interface SystemMetrics {
  readonly timestamp: Date;
  readonly memoryUsage: {
    readonly used: number;
    readonly total: number;
    readonly percentage: number;
  };
  readonly activeGames: number;
  readonly activePlayers: number;
  readonly operationsPerSecond: number;
  readonly averageResponseTime: number;
  readonly errorRate: number;
}

export interface AlertThreshold {
  readonly metric: string;
  readonly threshold: number;
  readonly comparison: 'greater' | 'less' | 'equal';
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly message: string;
}

export interface PerformanceAlert {
  readonly id: string;
  readonly threshold: AlertThreshold;
  readonly triggeredAt: Date;
  readonly currentValue: number;
  readonly context?: Record<string, any>;
}

// ============================================================================
// PERFORMANCE MONITORING SERVICE
// ============================================================================

export class PerformanceMonitoringService {
  private static instance: PerformanceMonitoringService;

  private metrics: PerformanceMetric[] = [];
  private systemMetrics: SystemMetrics[] = [];
  private alertThresholds: AlertThreshold[] = [];
  private activeAlerts: Map<string, PerformanceAlert> = new Map();

  private readonly MAX_METRICS_HISTORY = 10000;
  private readonly MAX_SYSTEM_METRICS_HISTORY = 1000;
  private readonly METRICS_CLEANUP_INTERVAL = 60000; // 1 minute
  private readonly SYSTEM_METRICS_INTERVAL = 5000; // 5 seconds

  private metricsCleanupTimer?: NodeJS.Timeout;
  private systemMetricsTimer?: NodeJS.Timeout;

  private constructor() {
    this.initializeDefaultThresholds();
    this.startMetricsCollection();
  }

  static getInstance(): PerformanceMonitoringService {
    if (!PerformanceMonitoringService.instance) {
      PerformanceMonitoringService.instance =
        new PerformanceMonitoringService();
    }
    return PerformanceMonitoringService.instance;
  }

  // ============================================================================
  // METRICS COLLECTION
  // ============================================================================

  /**
   * Start timing an operation
   */
  startTiming(
    operation: string,
    context?: Record<string, any>
  ): PerformanceTimer {
    return new PerformanceTimer(operation, this, context);
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Check for performance alerts
    this.checkPerformanceAlerts(metric);

    // Clean up old metrics to prevent memory bloat
    if (this.metrics.length > this.MAX_METRICS_HISTORY) {
      this.metrics.splice(0, this.metrics.length - this.MAX_METRICS_HISTORY);
    }
  }

  /**
   * Record operation with automatic timing
   */
  async measureOperation<T>(
    operation: string,
    fn: () => Promise<T> | T,
    context?: Record<string, any>
  ): Promise<T> {
    const timer = this.startTiming(operation, context);

    try {
      const result = await Promise.resolve(fn());
      timer.end(true);
      return result;
    } catch (error) {
      timer.end(false, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // ============================================================================
  // SYSTEM METRICS
  // ============================================================================

  /**
   * Collect current system metrics
   */
  collectSystemMetrics(): SystemMetrics {
    const now = new Date();
    const recentMetrics = this.getMetricsInTimeRange(
      now.getTime() - 60000,
      now.getTime()
    ); // Last minute

    // Memory usage (Node.js specific)
    const memoryUsage = process.memoryUsage();
    const totalMemory = memoryUsage.heapTotal;
    const usedMemory = memoryUsage.heapUsed;

    // Calculate operations per second
    const operationsPerSecond = recentMetrics.length / 60;

    // Calculate average response time
    const avgResponseTime =
      recentMetrics.length > 0
        ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) /
          recentMetrics.length
        : 0;

    // Calculate error rate
    const errorCount = recentMetrics.filter(m => !m.success).length;
    const errorRate =
      recentMetrics.length > 0 ? (errorCount / recentMetrics.length) * 100 : 0;

    // Count unique games and players
    const uniqueGames = new Set(
      recentMetrics.map(m => m.gameId).filter(Boolean)
    ).size;
    const uniquePlayers = new Set(
      recentMetrics.map(m => m.playerId).filter(Boolean)
    ).size;

    const systemMetric: SystemMetrics = {
      timestamp: now,
      memoryUsage: {
        used: usedMemory,
        total: totalMemory,
        percentage: (usedMemory / totalMemory) * 100,
      },
      activeGames: uniqueGames,
      activePlayers: uniquePlayers,
      operationsPerSecond,
      averageResponseTime: avgResponseTime,
      errorRate,
    };

    // Store system metrics
    this.systemMetrics.push(systemMetric);
    if (this.systemMetrics.length > this.MAX_SYSTEM_METRICS_HISTORY) {
      this.systemMetrics.splice(
        0,
        this.systemMetrics.length - this.MAX_SYSTEM_METRICS_HISTORY
      );
    }

    // Check system-level alerts
    this.checkSystemAlerts(systemMetric);

    return systemMetric;
  }

  // ============================================================================
  // METRICS QUERYING
  // ============================================================================

  /**
   * Get metrics for a specific operation
   */
  getMetricsForOperation(
    operation: string,
    limit: number = 100
  ): PerformanceMetric[] {
    return this.metrics.filter(m => m.operation === operation).slice(-limit);
  }

  /**
   * Get metrics for a specific game
   */
  getMetricsForGame(gameId: string, limit: number = 100): PerformanceMetric[] {
    return this.metrics.filter(m => m.gameId === gameId).slice(-limit);
  }

  /**
   * Get metrics within a time range
   */
  getMetricsInTimeRange(
    startTime: number,
    endTime: number
  ): PerformanceMetric[] {
    return this.metrics.filter(
      m => m.startTime >= startTime && m.endTime <= endTime
    );
  }

  /**
   * Get operation statistics
   */
  getOperationStats(operation: string): {
    totalCalls: number;
    successRate: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    p95Duration: number;
    p99Duration: number;
  } {
    const operationMetrics = this.getMetricsForOperation(operation);

    if (operationMetrics.length === 0) {
      return {
        totalCalls: 0,
        successRate: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        p95Duration: 0,
        p99Duration: 0,
      };
    }

    const durations = operationMetrics
      .map(m => m.duration)
      .sort((a, b) => a - b);
    const successCount = operationMetrics.filter(m => m.success).length;

    return {
      totalCalls: operationMetrics.length,
      successRate: (successCount / operationMetrics.length) * 100,
      averageDuration:
        durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minDuration: durations[0] || 0,
      maxDuration: durations[durations.length - 1] || 0,
      p95Duration: durations[Math.floor(durations.length * 0.95)] || 0,
      p99Duration: durations[Math.floor(durations.length * 0.99)] || 0,
    };
  }

  /**
   * Get current system metrics
   */
  getCurrentSystemMetrics(): SystemMetrics | null {
    return this.systemMetrics[this.systemMetrics.length - 1] || null;
  }

  /**
   * Get system metrics history
   */
  getSystemMetricsHistory(limit: number = 100): SystemMetrics[] {
    return this.systemMetrics.slice(-limit);
  }

  // ============================================================================
  // ALERTING SYSTEM
  // ============================================================================

  /**
   * Add performance alert threshold
   */
  addAlertThreshold(threshold: AlertThreshold): void {
    // Remove existing threshold with same metric
    this.alertThresholds = this.alertThresholds.filter(
      t => t.metric !== threshold.metric
    );
    this.alertThresholds.push(threshold);
  }

  /**
   * Remove alert threshold
   */
  removeAlertThreshold(metric: string): void {
    this.alertThresholds = this.alertThresholds.filter(
      t => t.metric !== metric
    );
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Clear an alert
   */
  clearAlert(alertId: string): void {
    this.activeAlerts.delete(alertId);
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Initialize default performance thresholds
   */
  private initializeDefaultThresholds(): void {
    const defaultThresholds: AlertThreshold[] = [
      {
        metric: 'response_time',
        threshold: 100, // 100ms
        comparison: 'greater',
        severity: 'medium',
        message: 'Operation response time exceeded 100ms',
      },
      {
        metric: 'response_time',
        threshold: 1000, // 1 second
        comparison: 'greater',
        severity: 'high',
        message: 'Operation response time exceeded 1 second',
      },
      {
        metric: 'error_rate',
        threshold: 5, // 5%
        comparison: 'greater',
        severity: 'medium',
        message: 'Error rate exceeded 5%',
      },
      {
        metric: 'memory_usage',
        threshold: 80, // 80%
        comparison: 'greater',
        severity: 'high',
        message: 'Memory usage exceeded 80%',
      },
      {
        metric: 'memory_usage',
        threshold: 95, // 95%
        comparison: 'greater',
        severity: 'critical',
        message: 'Memory usage exceeded 95%',
      },
    ];

    this.alertThresholds.push(...defaultThresholds);
  }

  /**
   * Check performance alerts for individual operations
   */
  private checkPerformanceAlerts(metric: PerformanceMetric): void {
    for (const threshold of this.alertThresholds) {
      let value: number;
      let shouldAlert = false;

      switch (threshold.metric) {
        case 'response_time':
          value = metric.duration;
          shouldAlert = this.compareValue(
            value,
            threshold.threshold,
            threshold.comparison
          );
          break;
        default:
          continue;
      }

      if (shouldAlert) {
        const alertId = `${threshold.metric}_${Date.now()}`;
        const alert: PerformanceAlert = {
          id: alertId,
          threshold,
          triggeredAt: new Date(),
          currentValue: value,
          context: {
            operation: metric.operation,
            gameId: metric.gameId,
            playerId: metric.playerId,
          },
        };

        this.activeAlerts.set(alertId, alert);
        this.handleAlert(alert);
      }
    }
  }

  /**
   * Check system-level performance alerts
   */
  private checkSystemAlerts(systemMetric: SystemMetrics): void {
    for (const threshold of this.alertThresholds) {
      let value: number;
      let shouldAlert = false;

      switch (threshold.metric) {
        case 'memory_usage':
          value = systemMetric.memoryUsage.percentage;
          shouldAlert = this.compareValue(
            value,
            threshold.threshold,
            threshold.comparison
          );
          break;
        case 'error_rate':
          value = systemMetric.errorRate;
          shouldAlert = this.compareValue(
            value,
            threshold.threshold,
            threshold.comparison
          );
          break;
        default:
          continue;
      }

      if (shouldAlert) {
        const alertId = `system_${threshold.metric}_${Date.now()}`;
        const alert: PerformanceAlert = {
          id: alertId,
          threshold,
          triggeredAt: new Date(),
          currentValue: value,
          context: {
            systemMetrics: systemMetric,
          },
        };

        this.activeAlerts.set(alertId, alert);
        this.handleAlert(alert);
      }
    }
  }

  /**
   * Compare value against threshold
   */
  private compareValue(
    value: number,
    threshold: number,
    comparison: string
  ): boolean {
    switch (comparison) {
      case 'greater':
        return value > threshold;
      case 'less':
        return value < threshold;
      case 'equal':
        return Math.abs(value - threshold) < 0.01; // Allow small floating point differences
      default:
        return false;
    }
  }

  /**
   * Handle performance alert
   */
  private handleAlert(alert: PerformanceAlert): void {
    // TODO: Integrate with alerting service (Slack, email, etc.)
    console.warn(
      `Performance Alert [${alert.threshold.severity.toUpperCase()}]:`,
      {
        message: alert.threshold.message,
        metric: alert.threshold.metric,
        currentValue: alert.currentValue,
        threshold: alert.threshold.threshold,
        context: alert.context,
      }
    );

    // Auto-clear alert after 5 minutes for non-critical alerts
    if (alert.threshold.severity !== 'critical') {
      setTimeout(
        () => {
          this.clearAlert(alert.id);
        },
        5 * 60 * 1000
      );
    }
  }

  /**
   * Start metrics collection timers
   */
  private startMetricsCollection(): void {
    // Collect system metrics regularly
    this.systemMetricsTimer = setInterval(() => {
      this.collectSystemMetrics();
    }, this.SYSTEM_METRICS_INTERVAL);

    // Clean up old metrics regularly
    this.metricsCleanupTimer = setInterval(() => {
      this.cleanupOldMetrics();
    }, this.METRICS_CLEANUP_INTERVAL);
  }

  /**
   * Clean up old metrics to prevent memory leaks
   */
  private cleanupOldMetrics(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Clean up performance metrics
    this.metrics = this.metrics.filter(m => now - m.endTime < maxAge);

    // Clean up system metrics
    const systemMaxAge = 60 * 60 * 1000; // 1 hour for system metrics
    this.systemMetrics = this.systemMetrics.filter(
      m => now - m.timestamp.getTime() < systemMaxAge
    );

    // Clear expired alerts
    const alertMaxAge = 60 * 60 * 1000; // 1 hour
    for (const [alertId, alert] of this.activeAlerts.entries()) {
      if (now - alert.triggeredAt.getTime() > alertMaxAge) {
        this.activeAlerts.delete(alertId);
      }
    }
  }

  /**
   * Stop metrics collection (cleanup)
   */
  stopMetricsCollection(): void {
    if (this.systemMetricsTimer) {
      clearInterval(this.systemMetricsTimer);
      this.systemMetricsTimer = undefined;
    }

    if (this.metricsCleanupTimer) {
      clearInterval(this.metricsCleanupTimer);
      this.metricsCleanupTimer = undefined;
    }
  }
}

// ============================================================================
// PERFORMANCE TIMER UTILITY
// ============================================================================

export class PerformanceTimer {
  private startTime: number;
  private operation: string;
  private monitoringService: PerformanceMonitoringService;
  private context: Record<string, any>;

  constructor(
    operation: string,
    monitoringService: PerformanceMonitoringService,
    context: Record<string, any> = {}
  ) {
    this.operation = operation;
    this.monitoringService = monitoringService;
    this.context = context;
    this.startTime = performance.now();
  }

  /**
   * End timing and record metric
   */
  end(success: boolean, error?: string): number {
    const endTime = performance.now();
    const duration = endTime - this.startTime;

    const metric: PerformanceMetric = {
      operation: this.operation,
      startTime: this.startTime,
      endTime,
      duration,
      success,
      error,
      gameId: this.context.gameId,
      playerId: this.context.playerId,
      metadata: this.context,
    };

    this.monitoringService.recordMetric(metric);
    return duration;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const performanceMonitor = PerformanceMonitoringService.getInstance();
export default performanceMonitor;
