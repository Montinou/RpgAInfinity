/**
 * Production Error Tracking and Logging System
 * Provides comprehensive error tracking, logging, and alerting for production monitoring
 */

import { kv } from '@vercel/kv';

interface ErrorEvent {
  id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  stack?: string;
  context?: Record<string, any>;
  user?: {
    id?: string;
    session?: string;
  };
  request?: {
    method?: string;
    url?: string;
    userAgent?: string;
    ip?: string;
  };
  fingerprint?: string;
}

interface ErrorMetrics {
  total_errors: number;
  error_rate: number;
  last_error: string;
  common_errors: Array<{
    fingerprint: string;
    count: number;
    message: string;
    last_seen: string;
  }>;
}

class ErrorTracker {
  private isProduction = process.env.NODE_ENV === 'production';
  private enableConsoleLog = process.env.DEBUG === 'true';

  /**
   * Track an error event
   */
  async trackError(
    error: Error | string,
    context?: Record<string, any>
  ): Promise<void> {
    try {
      const errorEvent = this.createErrorEvent(error, 'error', context);
      await this.logError(errorEvent);

      // In production, also update error metrics
      if (this.isProduction) {
        await this.updateErrorMetrics(errorEvent);
        await this.checkAlertThresholds(errorEvent);
      }
    } catch (logError) {
      // Fallback to console if error tracking itself fails
      console.error('Error tracking failed:', logError);
      console.error('Original error:', error);
    }
  }

  /**
   * Track a warning event
   */
  async trackWarning(
    message: string,
    context?: Record<string, any>
  ): Promise<void> {
    try {
      const errorEvent = this.createErrorEvent(message, 'warn', context);
      await this.logError(errorEvent);
    } catch (logError) {
      console.warn('Warning tracking failed:', logError);
      console.warn('Original warning:', message);
    }
  }

  /**
   * Track an info event
   */
  async trackInfo(
    message: string,
    context?: Record<string, any>
  ): Promise<void> {
    try {
      const errorEvent = this.createErrorEvent(message, 'info', context);
      await this.logError(errorEvent);
    } catch (logError) {
      console.info('Info tracking failed:', logError);
      console.info('Original info:', message);
    }
  }

  /**
   * Get error metrics for monitoring
   */
  async getErrorMetrics(timeWindow = '24h'): Promise<ErrorMetrics> {
    try {
      const now = Date.now();
      const windowMs = this.parseTimeWindow(timeWindow);
      const cutoff = now - windowMs;

      // Get error events within the time window
      const errorKeys = await kv.scan(0, { match: 'error:*', count: 1000 });
      const recentErrors = [];

      for (const key of errorKeys[1]) {
        const errorData = await kv.get(key);
        if (errorData && typeof errorData === 'object') {
          const error = errorData as ErrorEvent;
          const errorTime = new Date(error.timestamp).getTime();
          if (errorTime >= cutoff) {
            recentErrors.push(error);
          }
        }
      }

      // Calculate metrics
      const totalErrors = recentErrors.length;
      const totalRequests = await this.getTotalRequests(timeWindow);
      const errorRate =
        totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

      // Group by fingerprint to find common errors
      const errorGroups = new Map<string, Array<ErrorEvent>>();
      for (const error of recentErrors) {
        const fingerprint = error.fingerprint || 'unknown';
        if (!errorGroups.has(fingerprint)) {
          errorGroups.set(fingerprint, []);
        }
        errorGroups.get(fingerprint)!.push(error);
      }

      const commonErrors = Array.from(errorGroups.entries())
        .map(([fingerprint, errors]) => ({
          fingerprint,
          count: errors.length,
          message: errors[0].message,
          last_seen: errors.sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )[0].timestamp,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        total_errors: totalErrors,
        error_rate: Math.round(errorRate * 100) / 100,
        last_error:
          recentErrors.length > 0
            ? recentErrors.sort(
                (a, b) =>
                  new Date(b.timestamp).getTime() -
                  new Date(a.timestamp).getTime()
              )[0].timestamp
            : 'none',
        common_errors: commonErrors,
      };
    } catch (error) {
      console.error('Failed to get error metrics:', error);
      return {
        total_errors: 0,
        error_rate: 0,
        last_error: 'none',
        common_errors: [],
      };
    }
  }

  /**
   * Create an error event object
   */
  private createErrorEvent(
    error: Error | string,
    level: ErrorEvent['level'],
    context?: Record<string, any>
  ): ErrorEvent {
    const timestamp = new Date().toISOString();
    const id = this.generateErrorId();

    let message: string;
    let stack: string | undefined;

    if (error instanceof Error) {
      message = error.message;
      stack = error.stack;
    } else {
      message = error;
    }

    const fingerprint = this.generateFingerprint(message, stack);

    return {
      id,
      timestamp,
      level,
      message,
      stack,
      context,
      fingerprint,
      // TODO: Add user context when authentication is implemented
      // TODO: Add request context from middleware
    };
  }

  /**
   * Log error event to storage and console
   */
  private async logError(errorEvent: ErrorEvent): Promise<void> {
    // Log to console in development or when debug is enabled
    if (!this.isProduction || this.enableConsoleLog) {
      this.consoleLog(errorEvent);
    }

    // Store in KV for production monitoring
    if (this.isProduction) {
      await kv.setex(`error:${errorEvent.id}`, 86400, errorEvent); // 24 hour TTL

      // Add to recent errors list
      await kv.lpush('errors:recent', errorEvent.id);
      await kv.ltrim('errors:recent', 0, 99); // Keep last 100 errors
    }
  }

  /**
   * Update error metrics
   */
  private async updateErrorMetrics(errorEvent: ErrorEvent): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    // Update daily error count
    await kv.incr(`errors:daily:${today}`);
    await kv.expire(`errors:daily:${today}`, 86400 * 7); // Keep for 7 days

    // Update error rate metrics
    await kv.hset('errors:rates', {
      last_error: errorEvent.timestamp,
      last_updated: new Date().toISOString(),
    });

    // Update fingerprint count
    if (errorEvent.fingerprint) {
      await kv.incr(`error:fingerprint:${errorEvent.fingerprint}`);
      await kv.expire(`error:fingerprint:${errorEvent.fingerprint}`, 86400 * 7);
    }
  }

  /**
   * Check if error thresholds are exceeded and send alerts
   */
  private async checkAlertThresholds(errorEvent: ErrorEvent): Promise<void> {
    try {
      // Get recent error count
      const recentErrors = await kv.llen('errors:recent');
      const errorThreshold = parseInt(
        process.env.ERROR_ALERT_THRESHOLD || '50'
      );

      if (recentErrors >= errorThreshold) {
        await this.sendAlert({
          type: 'error_threshold_exceeded',
          message: `Error threshold exceeded: ${recentErrors} recent errors`,
          severity: 'high',
          context: { error_count: recentErrors, threshold: errorThreshold },
        });
      }

      // Check for specific critical errors
      if (this.isCriticalError(errorEvent)) {
        await this.sendAlert({
          type: 'critical_error',
          message: `Critical error detected: ${errorEvent.message}`,
          severity: 'critical',
          context: errorEvent,
        });
      }
    } catch (error) {
      console.error('Alert threshold check failed:', error);
    }
  }

  /**
   * Send alert notification
   */
  private async sendAlert(alert: {
    type: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    context?: any;
  }): Promise<void> {
    try {
      // Store alert for dashboard viewing
      const alertEvent = {
        ...alert,
        id: this.generateErrorId(),
        timestamp: new Date().toISOString(),
      };

      await kv.setex(`alert:${alertEvent.id}`, 86400, alertEvent);
      await kv.lpush('alerts:recent', alertEvent.id);
      await kv.ltrim('alerts:recent', 0, 49); // Keep last 50 alerts

      // TODO: Implement external alerting (email, Slack, etc.)
      console.error('🚨 ALERT:', alert.message, alert.context);
    } catch (error) {
      console.error('Alert sending failed:', error);
    }
  }

  /**
   * Console logging with proper formatting
   */
  private consoleLog(errorEvent: ErrorEvent): void {
    const timestamp = new Date(errorEvent.timestamp).toISOString();
    const prefix = `[${timestamp}] ${errorEvent.level.toUpperCase()}:`;

    switch (errorEvent.level) {
      case 'error':
        console.error(prefix, errorEvent.message);
        if (errorEvent.stack) console.error(errorEvent.stack);
        break;
      case 'warn':
        console.warn(prefix, errorEvent.message);
        break;
      case 'info':
        console.info(prefix, errorEvent.message);
        break;
      case 'debug':
        console.debug(prefix, errorEvent.message);
        break;
    }

    if (errorEvent.context) {
      console.log('Context:', errorEvent.context);
    }
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate error fingerprint for grouping similar errors
   */
  private generateFingerprint(message: string, stack?: string): string {
    // Simple fingerprint based on error message and first stack frame
    let fingerprint = message.replace(/\d+/g, 'N').replace(/['"]/g, '');

    if (stack) {
      const firstFrame = stack.split('\n')[1];
      if (firstFrame) {
        fingerprint += `|${firstFrame.replace(/:\d+:\d+/g, ':N:N')}`;
      }
    }

    // Generate hash-like string
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return Math.abs(hash).toString(36);
  }

  /**
   * Parse time window string to milliseconds
   */
  private parseTimeWindow(timeWindow: string): number {
    const match = timeWindow.match(/^(\d+)([hdm])$/);
    if (!match) return 86400000; // Default 24 hours

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
        return 86400000;
    }
  }

  /**
   * Get total requests for error rate calculation
   */
  private async getTotalRequests(timeWindow: string): Promise<number> {
    try {
      const windowMs = this.parseTimeWindow(timeWindow);
      const minutesInWindow = Math.ceil(windowMs / 60000);
      const currentMinute = Math.floor(Date.now() / 60000);

      let totalRequests = 0;
      for (let i = 0; i < minutesInWindow; i++) {
        const minute = currentMinute - i;
        const requests = (await kv.get(`requests:${minute}`)) || 0;
        totalRequests +=
          typeof requests === 'number'
            ? requests
            : parseInt(requests as string) || 0;
      }

      return totalRequests;
    } catch (error) {
      console.error('Failed to get total requests:', error);
      return 0;
    }
  }

  /**
   * Check if error is critical and requires immediate attention
   */
  private isCriticalError(errorEvent: ErrorEvent): boolean {
    const criticalPatterns = [
      /database.*connection.*failed/i,
      /anthropic.*api.*error/i,
      /authentication.*failed/i,
      /out of memory/i,
      /cannot connect to/i,
    ];

    return criticalPatterns.some(
      pattern =>
        pattern.test(errorEvent.message) ||
        (errorEvent.stack && pattern.test(errorEvent.stack))
    );
  }
}

// Export singleton instance
export const errorTracker = new ErrorTracker();

// Export types
export type { ErrorEvent, ErrorMetrics };

// Convenience functions
export const trackError = (
  error: Error | string,
  context?: Record<string, any>
) => errorTracker.trackError(error, context);

export const trackWarning = (message: string, context?: Record<string, any>) =>
  errorTracker.trackWarning(message, context);

export const trackInfo = (message: string, context?: Record<string, any>) =>
  errorTracker.trackInfo(message, context);

export const getErrorMetrics = (timeWindow = '24h') =>
  errorTracker.getErrorMetrics(timeWindow);
