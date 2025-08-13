/**
 * Performance Monitoring System
 * Tracks response times, throughput, and performance metrics for production monitoring
 */

import { kv } from '@vercel/kv';
import { trackError, trackWarning } from './error-tracking';

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: string;
  success: boolean;
  context?: Record<string, any>;
}

interface PerformanceStats {
  avg_response_time: number;
  p95_response_time: number;
  p99_response_time: number;
  throughput_rpm: number;
  error_rate: number;
  slow_operations: Array<{
    operation: string;
    avg_duration: number;
    count: number;
  }>;
}

class PerformanceMonitor {
  private isProduction = process.env.NODE_ENV === 'production';
  private slowThreshold = 1000; // 1 second
  private verySlowThreshold = 5000; // 5 seconds

  /**
   * Start timing an operation
   */
  startTiming(
    operation: string,
    context?: Record<string, any>
  ): () => Promise<void> {
    const startTime = performance.now();
    const timestamp = new Date().toISOString();

    return async () => {
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      await this.recordMetric({
        operation,
        duration,
        timestamp,
        success: true,
        context,
      });
    };
  }

  /**
   * Record a performance metric
   */
  async recordMetric(metric: PerformanceMetric): Promise<void> {
    try {
      if (this.isProduction) {
        // Store individual metric
        await kv.setex(
          `perf:${metric.operation}:${Date.now()}:${Math.random().toString(36).substr(2, 5)}`,
          3600, // 1 hour TTL
          metric
        );

        // Update aggregated stats
        await this.updateAggregatedStats(metric);

        // Check for performance issues
        await this.checkPerformanceThresholds(metric);
      }

      // Log slow operations in development
      if (!this.isProduction && metric.duration > this.slowThreshold) {
        console.warn(
          `Slow operation detected: ${metric.operation} took ${metric.duration}ms`
        );
      }
    } catch (error) {
      await trackError(`Performance metric recording failed: ${error}`, {
        operation: metric.operation,
        duration: metric.duration,
      });
    }
  }

  /**
   * Get performance statistics
   */
  async getPerformanceStats(timeWindow = '1h'): Promise<PerformanceStats> {
    try {
      const windowMs = this.parseTimeWindow(timeWindow);
      const cutoff = Date.now() - windowMs;

      // Get all performance metrics within time window
      const perfKeys = await kv.scan(0, { match: 'perf:*', count: 1000 });
      const metrics: PerformanceMetric[] = [];

      for (const key of perfKeys[1]) {
        const timestamp = this.extractTimestampFromKey(key);
        if (timestamp && timestamp >= cutoff) {
          const metric = await kv.get(key);
          if (metric && typeof metric === 'object') {
            metrics.push(metric as PerformanceMetric);
          }
        }
      }

      if (metrics.length === 0) {
        return this.getEmptyStats();
      }

      // Calculate statistics
      const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
      const avgResponseTime = Math.round(
        durations.reduce((sum, d) => sum + d, 0) / durations.length
      );
      const p95Index = Math.floor(durations.length * 0.95);
      const p99Index = Math.floor(durations.length * 0.99);

      // Calculate throughput (requests per minute)
      const timeWindowMinutes = windowMs / (1000 * 60);
      const throughputRpm = Math.round(metrics.length / timeWindowMinutes);

      // Error rate
      const errorCount = metrics.filter(m => !m.success).length;
      const errorRate = Math.round((errorCount / metrics.length) * 10000) / 100; // 2 decimal places

      // Slow operations analysis
      const operationGroups = new Map<string, number[]>();
      for (const metric of metrics) {
        if (!operationGroups.has(metric.operation)) {
          operationGroups.set(metric.operation, []);
        }
        operationGroups.get(metric.operation)!.push(metric.duration);
      }

      const slowOperations = Array.from(operationGroups.entries())
        .map(([operation, durations]) => ({
          operation,
          avg_duration: Math.round(
            durations.reduce((sum, d) => sum + d, 0) / durations.length
          ),
          count: durations.length,
        }))
        .filter(op => op.avg_duration > this.slowThreshold)
        .sort((a, b) => b.avg_duration - a.avg_duration)
        .slice(0, 10);

      return {
        avg_response_time: avgResponseTime,
        p95_response_time: durations[p95Index] || 0,
        p99_response_time: durations[p99Index] || 0,
        throughput_rpm: throughputRpm,
        error_rate: errorRate,
        slow_operations: slowOperations,
      };
    } catch (error) {
      await trackError(`Failed to get performance stats: ${error}`);
      return this.getEmptyStats();
    }
  }

  /**
   * Monitor API response times
   */
  async monitorAPIResponse(
    path: string,
    method: string,
    statusCode: number,
    duration: number
  ): Promise<void> {
    const success = statusCode >= 200 && statusCode < 400;

    await this.recordMetric({
      operation: `api_${method.toLowerCase()}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
      duration,
      timestamp: new Date().toISOString(),
      success,
      context: {
        path,
        method,
        status_code: statusCode,
      },
    });

    // Track request count for throughput calculation
    if (this.isProduction) {
      const currentMinute = Math.floor(Date.now() / 60000);
      await kv.incr(`requests:${currentMinute}`);
      await kv.expire(`requests:${currentMinute}`, 3600); // 1 hour TTL
    }
  }

  /**
   * Monitor database operation performance
   */
  async monitorDatabaseOperation(
    operation: string,
    duration: number,
    success: boolean
  ): Promise<void> {
    await this.recordMetric({
      operation: `db_${operation}`,
      duration,
      timestamp: new Date().toISOString(),
      success,
      context: {
        type: 'database',
      },
    });
  }

  /**
   * Monitor AI service performance
   */
  async monitorAIOperation(
    operation: string,
    duration: number,
    tokenCount?: number
  ): Promise<void> {
    await this.recordMetric({
      operation: `ai_${operation}`,
      duration,
      timestamp: new Date().toISOString(),
      success: true,
      context: {
        type: 'ai_service',
        tokens: tokenCount,
      },
    });

    // Update AI service health
    if (this.isProduction) {
      await kv.hset('ai:health', {
        last_successful_request: new Date().toISOString(),
        last_duration: duration,
        recent_errors: 0, // Reset error count on successful request
      });
    }
  }

  /**
   * Record AI service error
   */
  async recordAIError(operation: string, error: string): Promise<void> {
    await this.recordMetric({
      operation: `ai_${operation}`,
      duration: 0,
      timestamp: new Date().toISOString(),
      success: false,
      context: {
        type: 'ai_service',
        error,
      },
    });

    // Update error count
    if (this.isProduction) {
      await kv.hincrby('ai:health', 'recent_errors', 1);
    }
  }

  /**
   * Update aggregated performance statistics
   */
  private async updateAggregatedStats(
    metric: PerformanceMetric
  ): Promise<void> {
    try {
      const hour = new Date().getHours();
      const day = new Date().toISOString().split('T')[0];

      // Hourly stats
      const hourlyKey = `perf:hourly:${day}:${hour}`;
      await kv.hincrby(hourlyKey, 'count', 1);
      await kv.hincrby(hourlyKey, 'total_duration', metric.duration);
      await kv.expire(hourlyKey, 86400 * 7); // Keep for 7 days

      // Track slow operations count
      if (metric.duration > this.slowThreshold) {
        await kv.hincrby(hourlyKey, 'slow_count', 1);
      }

      // Update operation-specific stats
      const opKey = `perf:op:${metric.operation}:${day}`;
      await kv.hincrby(opKey, 'count', 1);
      await kv.hincrby(opKey, 'total_duration', metric.duration);
      await kv.expire(opKey, 86400 * 3); // Keep for 3 days
    } catch (error) {
      console.error('Failed to update aggregated stats:', error);
    }
  }

  /**
   * Check performance thresholds and alert if exceeded
   */
  private async checkPerformanceThresholds(
    metric: PerformanceMetric
  ): Promise<void> {
    try {
      // Alert on very slow operations
      if (metric.duration > this.verySlowThreshold) {
        await trackWarning(
          `Very slow operation detected: ${metric.operation} took ${metric.duration}ms`,
          {
            operation: metric.operation,
            duration: metric.duration,
            threshold: this.verySlowThreshold,
          }
        );
      }

      // Check for sustained high response times
      const recentMetrics = await this.getRecentMetricsForOperation(
        metric.operation,
        5
      );
      if (recentMetrics.length >= 5) {
        const avgRecent =
          recentMetrics.reduce((sum, m) => sum + m.duration, 0) /
          recentMetrics.length;
        if (avgRecent > this.slowThreshold) {
          await trackWarning(
            `Sustained slow performance detected for ${metric.operation}`,
            {
              operation: metric.operation,
              avg_duration: Math.round(avgRecent),
              sample_size: recentMetrics.length,
            }
          );
        }
      }
    } catch (error) {
      console.error('Performance threshold check failed:', error);
    }
  }

  /**
   * Get recent metrics for a specific operation
   */
  private async getRecentMetricsForOperation(
    operation: string,
    limit: number
  ): Promise<PerformanceMetric[]> {
    try {
      const perfKeys = await kv.scan(0, {
        match: `perf:${operation}:*`,
        count: limit * 2,
      });
      const metrics: PerformanceMetric[] = [];

      for (const key of perfKeys[1]) {
        const metric = await kv.get(key);
        if (metric && typeof metric === 'object') {
          metrics.push(metric as PerformanceMetric);
        }
        if (metrics.length >= limit) break;
      }

      return metrics.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (error) {
      console.error('Failed to get recent metrics:', error);
      return [];
    }
  }

  /**
   * Parse time window string to milliseconds
   */
  private parseTimeWindow(timeWindow: string): number {
    const match = timeWindow.match(/^(\d+)([hdm])$/);
    if (!match) return 3600000; // Default 1 hour

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      case 'm':
        return value * 60 * 1000;
      default:
        return 3600000;
    }
  }

  /**
   * Extract timestamp from performance key
   */
  private extractTimestampFromKey(key: string): number | null {
    const match = key.match(/perf:.*?:(\d+):/);
    return match ? parseInt(match[1]) : null;
  }

  /**
   * Get empty stats object
   */
  private getEmptyStats(): PerformanceStats {
    return {
      avg_response_time: 0,
      p95_response_time: 0,
      p99_response_time: 0,
      throughput_rpm: 0,
      error_rate: 0,
      slow_operations: [],
    };
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Export convenience functions
export const startTiming = (operation: string, context?: Record<string, any>) =>
  performanceMonitor.startTiming(operation, context);

export const recordMetric = (metric: PerformanceMetric) =>
  performanceMonitor.recordMetric(metric);

export const monitorAPIResponse = (
  path: string,
  method: string,
  statusCode: number,
  duration: number
) => performanceMonitor.monitorAPIResponse(path, method, statusCode, duration);

export const monitorDatabaseOperation = (
  operation: string,
  duration: number,
  success: boolean
) => performanceMonitor.monitorDatabaseOperation(operation, duration, success);

export const monitorAIOperation = (
  operation: string,
  duration: number,
  tokenCount?: number
) => performanceMonitor.monitorAIOperation(operation, duration, tokenCount);

export const recordAIError = (operation: string, error: string) =>
  performanceMonitor.recordAIError(operation, error);

export const getPerformanceStats = (timeWindow = '1h') =>
  performanceMonitor.getPerformanceStats(timeWindow);

// Export types
export type { PerformanceMetric, PerformanceStats };
