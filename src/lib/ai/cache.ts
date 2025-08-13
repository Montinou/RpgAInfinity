/**
 * AI Response Caching System with Intelligent Invalidation
 *
 * @author AI/ML Specialist
 * @version 1.0.0
 */

import type { CacheEntry, CacheStrategy } from '../../types/ai';

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

interface CacheConfig {
  readonly maxSize: number; // bytes
  readonly maxEntries: number;
  readonly defaultTTL: number; // minutes
  readonly compressionEnabled: boolean;
  readonly cleanupInterval: number; // minutes
}

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxSize: 50 * 1024 * 1024, // 50MB
  maxEntries: 10000,
  defaultTTL: 240, // 4 hours
  compressionEnabled: true,
  cleanupInterval: 30, // 30 minutes
};

// ============================================================================
// CACHE KEY GENERATION
// ============================================================================

class CacheKeyGenerator {
  /**
   * Generate cache key for AI response based on content and parameters
   */
  static generate(
    contentType: string,
    rawContent: string,
    parameters?: Record<string, any>
  ): string {
    const baseContent = this.normalizeContent(rawContent);
    const paramString = parameters ? JSON.stringify(parameters) : '';

    // Create a deterministic hash
    const combined = `${contentType}:${baseContent}:${paramString}`;
    return `ai_cache_${this.hash(combined)}`;
  }

  /**
   * Generate semantic similarity key for similar content
   */
  static generateSemantic(
    contentType: string,
    semanticFeatures: string[]
  ): string {
    const features = semanticFeatures.sort().join('|');
    return `ai_semantic_${contentType}_${this.hash(features)}`;
  }

  private static normalizeContent(content: string): string {
    return content
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .slice(0, 1000); // Limit for key generation
  }

  private static hash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

// ============================================================================
// INTELLIGENT CACHING SYSTEM
// ============================================================================

export class AIResponseCache {
  private cache = new Map<string, CacheEntry>();
  private hitCounts = new Map<string, number>();
  private accessTimes = new Map<string, number>();
  private totalSize = 0;
  private config: CacheConfig;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config?: Partial<CacheConfig>) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.startCleanupTimer();
  }

  /**
   * Store processed AI response in cache
   */
  async set(
    key: string,
    data: any,
    contentType: string,
    ttlMinutes?: number
  ): Promise<boolean> {
    try {
      const ttl = ttlMinutes || this.getTTLForContentType(contentType);
      const expiresAt = Date.now() + ttl * 60 * 1000;
      const content = JSON.stringify(data);

      // Compress if enabled and beneficial
      const finalContent =
        this.config.compressionEnabled && content.length > 1000
          ? this.compress(content)
          : content;

      const entry: CacheEntry = {
        key,
        content: {
          id: crypto.randomUUID(),
          requestId: crypto.randomUUID(),
          content: finalContent,
          metadata: {
            model: 'claude-3-5-sonnet-20241022',
            temperature: 0.7,
            promptTokens: 0,
            completionTokens: 0,
            stopReason: 'end_turn',
            safety: {
              flagged: false,
              categories: [],
              severity: 'none',
              action: 'allow',
            },
          },
          timestamp: Date.now(),
          processingTime: 0,
          tokenUsage: { prompt: 0, completion: 0, total: 0 },
        },
        createdAt: Date.now(),
        expiresAt,
        hitCount: 0,
        lastAccessed: Date.now(),
        size: finalContent.length,
        tags: [contentType],
      };

      // Check if we need to evict entries
      if (this.shouldEvict(entry.size)) {
        this.evictEntries(entry.size);
      }

      this.cache.set(key, entry);
      this.hitCounts.set(key, 0);
      this.accessTimes.set(key, Date.now());
      this.totalSize += entry.size;

      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Retrieve cached AI response
   */
  async get(key: string): Promise<any | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return null;
    }

    // Update access statistics
    entry.hitCount++;
    entry.lastAccessed = Date.now();
    this.hitCounts.set(key, (this.hitCounts.get(key) || 0) + 1);
    this.accessTimes.set(key, Date.now());

    try {
      // Decompress if needed
      const content = this.isCompressed(entry.content.content)
        ? this.decompress(entry.content.content)
        : entry.content.content;

      return JSON.parse(content);
    } catch (error) {
      console.error('Cache get error:', error);
      this.delete(key);
      return null;
    }
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete cache entry
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.totalSize -= entry.size;
      this.cache.delete(key);
      this.hitCounts.delete(key);
      this.accessTimes.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.hitCounts.clear();
    this.accessTimes.clear();
    this.totalSize = 0;
  }

  /**
   * Invalidate cache entries by tags or pattern
   */
  invalidate(tags?: string[], pattern?: RegExp): number {
    let invalidated = 0;

    for (const [key, entry] of this.cache.entries()) {
      let shouldInvalidate = false;

      if (tags && entry.tags.some(tag => tags.includes(tag))) {
        shouldInvalidate = true;
      }

      if (pattern && pattern.test(key)) {
        shouldInvalidate = true;
      }

      if (shouldInvalidate) {
        this.delete(key);
        invalidated++;
      }
    }

    return invalidated;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let totalHits = 0;
    let expiredEntries = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        expiredEntries++;
      } else {
        totalHits += entry.hitCount;
      }
    }

    return {
      entries: this.cache.size,
      totalSize: this.totalSize,
      totalHits,
      expiredEntries,
      hitRate: totalHits / Math.max(1, this.cache.size),
      averageEntrySize: this.totalSize / Math.max(1, this.cache.size),
      memoryUsage: `${(this.totalSize / 1024 / 1024).toFixed(2)} MB`,
      config: this.config,
    };
  }

  /**
   * Get TTL based on content type
   */
  private getTTLForContentType(contentType: string): number {
    const ttlMap: Record<string, number> = {
      world: 480, // 8 hours - worlds don't change often
      character: 360, // 6 hours - characters are fairly stable
      narrative: 60, // 1 hour - narratives are contextual
      dialogue: 30, // 30 minutes - dialogue is very contextual
      combat: 15, // 15 minutes - combat results are immediate
      clue: 120, // 2 hours - clues have medium lifespan
      event: 240, // 4 hours - events have medium-long lifespan
      npc_behavior: 180, // 3 hours - NPC behavior changes moderately
    };

    return ttlMap[contentType] || this.config.defaultTTL;
  }

  /**
   * Check if eviction is needed
   */
  private shouldEvict(newEntrySize: number): boolean {
    return (
      this.cache.size >= this.config.maxEntries ||
      this.totalSize + newEntrySize > this.config.maxSize
    );
  }

  /**
   * Evict entries using LRU strategy
   */
  private evictEntries(spaceNeeded: number): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({
        key,
        entry,
        score: this.calculateEvictionScore(entry, now),
      }))
      .sort((a, b) => a.score - b.score); // Lower score = more likely to evict

    let freedSpace = 0;
    let evicted = 0;

    for (const { key, entry } of entries) {
      if (freedSpace >= spaceNeeded && evicted >= 100) break; // Don't evict too many at once

      this.delete(key);
      freedSpace += entry.size;
      evicted++;
    }

    console.log(
      `Evicted ${evicted} cache entries, freed ${(freedSpace / 1024 / 1024).toFixed(2)} MB`
    );
  }

  /**
   * Calculate eviction score (lower = more likely to evict)
   */
  private calculateEvictionScore(entry: CacheEntry, now: number): number {
    const age = now - entry.createdAt;
    const timeSinceAccess = now - entry.lastAccessed;
    const hitRate = entry.hitCount / Math.max(1, age / 60000); // hits per minute

    // Factors: recent access (high weight), hit rate (medium), age (low weight)
    return (
      (timeSinceAccess / 60000) * 0.5 + // Minutes since access
      (1 / Math.max(0.1, hitRate)) * 0.3 + // Inverse hit rate
      (age / 3600000) * 0.2 // Hours since creation
    );
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(
      () => {
        this.cleanup();
      },
      this.config.cleanupInterval * 60 * 1000
    );
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} expired cache entries`);
    }
  }

  /**
   * Basic compression (placeholder - in production, use a real compression library)
   */
  private compress(content: string): string {
    // TODO: Implement actual compression (e.g., using pako or similar)
    return `COMPRESSED:${content}`;
  }

  /**
   * Basic decompression (placeholder)
   */
  private decompress(content: string): string {
    // TODO: Implement actual decompression
    return content.startsWith('COMPRESSED:') ? content.slice(11) : content;
  }

  /**
   * Check if content is compressed
   */
  private isCompressed(content: string): boolean {
    return content.startsWith('COMPRESSED:');
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.clear();
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const aiCache = new AIResponseCache();

// Export utilities for testing and configuration
export { CacheKeyGenerator };
