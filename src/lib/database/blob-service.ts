/**
 * Vercel Blob Service - Asset storage and management layer
 *
 * Handles storage of generated images, audio files, and other game assets
 * Provides optimized upload/download patterns and CDN integration
 */

import { put, del, head, list } from '@vercel/blob';
import { AssetReference, KVResult, GameType } from '@/types';
import { kvService } from './kv-service';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// BLOB SERVICE CONFIGURATION
// ============================================================================

interface BlobUploadOptions {
  access?: 'public' | 'private';
  cacheControl?: string;
  contentType?: string;
  metadata?: Record<string, string>;
}

interface BlobListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

// ============================================================================
// BLOB SERVICE CLASS
// ============================================================================

export class BlobService {
  private static instance: BlobService;

  private constructor() {}

  static getInstance(): BlobService {
    if (!BlobService.instance) {
      BlobService.instance = new BlobService();
    }
    return BlobService.instance;
  }

  // ============================================================================
  // CORE BLOB OPERATIONS
  // ============================================================================

  /**
   * Upload a file to Vercel Blob storage
   */
  async uploadFile(
    filename: string,
    data: Blob | Buffer | ReadableStream | string,
    options: BlobUploadOptions = {}
  ): Promise<KVResult<AssetReference>> {
    try {
      const assetId = uuidv4();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      // Create a unique filename with timestamp and asset ID
      const uniqueFilename = `${timestamp}-${assetId}-${filename}`;

      const blob = await put(uniqueFilename, data, {
        access: options.access || 'public',
        addRandomSuffix: false, // We're already adding our own unique suffix
      });

      // Create asset reference
      const assetReference: AssetReference = {
        id: assetId,
        type: this.determineAssetType(filename, options.contentType),
        url: blob.url,
        filename: uniqueFilename,
        size: blob.size,
        contentType: options.contentType || this.inferContentType(filename),
        uploadedAt: new Date(),
        uploadedBy: 'system', // This could be enhanced to track actual user
        tags: [],
        blobToken: blob.pathname,
        downloadUrl: blob.downloadUrl,
      };

      // Store asset reference in KV for indexing
      await kvService.setAssetReference(assetReference);

      return {
        success: true,
        data: assetReference,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to upload file ${filename}: ${error}`,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Delete a file from Vercel Blob storage
   */
  async deleteFile(assetId: string): Promise<KVResult<boolean>> {
    try {
      // Get asset reference first
      const assetResult = await kvService.getAssetReference(assetId);
      if (!assetResult.success || !assetResult.data) {
        return {
          success: false,
          error: `Asset ${assetId} not found`,
          timestamp: new Date(),
        };
      }

      const asset = assetResult.data;

      // Delete from blob storage
      await del(asset.url);

      // Remove asset reference from KV
      await kvService.delete(`asset:${assetId}`);

      return {
        success: true,
        data: true,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete asset ${assetId}: ${error}`,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get file metadata from Vercel Blob storage
   */
  async getFileInfo(
    url: string
  ): Promise<
    KVResult<{ size: number; uploadedAt: Date; contentType: string }>
  > {
    try {
      const info = await head(url);

      return {
        success: true,
        data: {
          size: info.size,
          uploadedAt: info.uploadedAt,
          contentType: info.contentType,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get file info for ${url}: ${error}`,
        timestamp: new Date(),
      };
    }
  }

  /**
   * List files with optional filtering
   */
  async listFiles(
    options: BlobListOptions = {}
  ): Promise<KVResult<AssetReference[]>> {
    try {
      const blobs = await list({
        prefix: options.prefix,
        limit: options.limit || 100,
        cursor: options.cursor,
      });

      // Get asset references for each blob
      const assetReferences: AssetReference[] = [];

      for (const blob of blobs.blobs) {
        // Extract asset ID from filename (format: timestamp-assetId-originalname)
        const parts = blob.pathname.split('-');
        if (parts.length >= 3) {
          const assetId = parts[1];
          const assetResult = await kvService.getAssetReference(assetId);
          if (assetResult.success && assetResult.data) {
            assetReferences.push(assetResult.data);
          }
        }
      }

      return {
        success: true,
        data: assetReferences,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to list files: ${error}`,
        timestamp: new Date(),
      };
    }
  }

  // ============================================================================
  // GAME-SPECIFIC ASSET OPERATIONS
  // ============================================================================

  /**
   * Upload AI-generated image for a game session
   */
  async uploadGameImage(
    sessionId: string,
    gameType: GameType,
    imageData: Blob | Buffer,
    description: string,
    context?: Record<string, any>
  ): Promise<KVResult<AssetReference>> {
    const filename = `${gameType}-${sessionId}-${Date.now()}.png`;

    const uploadResult = await this.uploadFile(filename, imageData, {
      access: 'public',
      contentType: 'image/png',
      metadata: {
        sessionId,
        gameType,
        description,
        context: JSON.stringify(context || {}),
      },
    });

    if (uploadResult.success && uploadResult.data) {
      // Add game-specific metadata
      uploadResult.data.gameType = gameType;
      uploadResult.data.sessionId = sessionId;
      uploadResult.data.tags = ['ai-generated', 'game-image', gameType];

      // Update the asset reference in KV
      await kvService.setAssetReference(uploadResult.data);
    }

    return uploadResult;
  }

  /**
   * Upload audio file for a game session
   */
  async uploadGameAudio(
    sessionId: string,
    gameType: GameType,
    audioData: Blob | Buffer,
    audioType: 'music' | 'sfx' | 'voice' | 'ambient',
    duration?: number
  ): Promise<KVResult<AssetReference>> {
    const extension = audioType === 'voice' ? 'wav' : 'mp3';
    const filename = `${gameType}-${sessionId}-${audioType}-${Date.now()}.${extension}`;

    const uploadResult = await this.uploadFile(filename, audioData, {
      access: 'public',
      contentType: `audio/${extension}`,
      metadata: {
        sessionId,
        gameType,
        audioType,
        duration: duration?.toString() || '',
      },
    });

    if (uploadResult.success && uploadResult.data) {
      uploadResult.data.gameType = gameType;
      uploadResult.data.sessionId = sessionId;
      uploadResult.data.tags = [
        'ai-generated',
        'game-audio',
        gameType,
        audioType,
      ];

      await kvService.setAssetReference(uploadResult.data);
    }

    return uploadResult;
  }

  /**
   * Upload character portrait or avatar
   */
  async uploadCharacterAsset(
    sessionId: string,
    characterId: string,
    imageData: Blob | Buffer,
    assetType: 'portrait' | 'avatar' | 'sprite'
  ): Promise<KVResult<AssetReference>> {
    const filename = `character-${characterId}-${assetType}-${Date.now()}.png`;

    const uploadResult = await this.uploadFile(filename, imageData, {
      access: 'public',
      contentType: 'image/png',
      metadata: {
        sessionId,
        characterId,
        assetType,
      },
    });

    if (uploadResult.success && uploadResult.data) {
      uploadResult.data.sessionId = sessionId;
      uploadResult.data.tags = ['character-asset', assetType];

      await kvService.setAssetReference(uploadResult.data);
    }

    return uploadResult;
  }

  /**
   * Upload world/location map or background
   */
  async uploadWorldAsset(
    sessionId: string,
    worldId: string,
    imageData: Blob | Buffer,
    assetType: 'map' | 'background' | 'location' | 'battle-map'
  ): Promise<KVResult<AssetReference>> {
    const filename = `world-${worldId}-${assetType}-${Date.now()}.png`;

    const uploadResult = await this.uploadFile(filename, imageData, {
      access: 'public',
      contentType: 'image/png',
      metadata: {
        sessionId,
        worldId,
        assetType,
      },
    });

    if (uploadResult.success && uploadResult.data) {
      uploadResult.data.sessionId = sessionId;
      uploadResult.data.tags = ['world-asset', assetType];

      await kvService.setAssetReference(uploadResult.data);
    }

    return uploadResult;
  }

  // ============================================================================
  // ASSET MANAGEMENT UTILITIES
  // ============================================================================

  /**
   * Get all assets for a specific game session
   */
  async getSessionAssets(
    sessionId: string
  ): Promise<KVResult<AssetReference[]>> {
    try {
      const listResult = await this.listFiles({
        prefix: `session-${sessionId}`,
      });

      if (!listResult.success) {
        return listResult;
      }

      // Filter assets that belong to this session
      const sessionAssets =
        listResult.data?.filter(asset => asset.sessionId === sessionId) || [];

      return {
        success: true,
        data: sessionAssets,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get session assets: ${error}`,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Clean up assets older than specified days
   */
  async cleanupOldAssets(
    olderThanDays: number = 30
  ): Promise<KVResult<number>> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const listResult = await this.listFiles();
      if (!listResult.success || !listResult.data) {
        return {
          success: false,
          error: 'Failed to list assets for cleanup',
          timestamp: new Date(),
        };
      }

      let deletedCount = 0;

      for (const asset of listResult.data) {
        if (asset.uploadedAt < cutoffDate) {
          const deleteResult = await this.deleteFile(asset.id);
          if (deleteResult.success) {
            deletedCount++;
          }
        }
      }

      return {
        success: true,
        data: deletedCount,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Asset cleanup failed: ${error}`,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<
    KVResult<{
      totalAssets: number;
      totalSize: number;
      assetsByType: Record<string, number>;
      oldestAsset: Date | null;
      newestAsset: Date | null;
    }>
  > {
    try {
      const listResult = await this.listFiles();
      if (!listResult.success || !listResult.data) {
        return {
          success: false,
          error: 'Failed to get storage stats',
          timestamp: new Date(),
        };
      }

      const assets = listResult.data;
      const stats = {
        totalAssets: assets.length,
        totalSize: assets.reduce((sum, asset) => sum + asset.size, 0),
        assetsByType: {} as Record<string, number>,
        oldestAsset: null as Date | null,
        newestAsset: null as Date | null,
      };

      // Calculate statistics
      for (const asset of assets) {
        // Count by type
        stats.assetsByType[asset.type] =
          (stats.assetsByType[asset.type] || 0) + 1;

        // Track oldest and newest
        if (!stats.oldestAsset || asset.uploadedAt < stats.oldestAsset) {
          stats.oldestAsset = asset.uploadedAt;
        }
        if (!stats.newestAsset || asset.uploadedAt > stats.newestAsset) {
          stats.newestAsset = asset.uploadedAt;
        }
      }

      return {
        success: true,
        data: stats,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get storage stats: ${error}`,
        timestamp: new Date(),
      };
    }
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Determine asset type based on filename and content type
   */
  private determineAssetType(
    filename: string,
    contentType?: string
  ): 'image' | 'audio' | 'data' {
    if (contentType) {
      if (contentType.startsWith('image/')) return 'image';
      if (contentType.startsWith('audio/')) return 'audio';
    }

    const extension = filename.split('.').pop()?.toLowerCase();

    if (
      extension &&
      ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension)
    ) {
      return 'image';
    }

    if (extension && ['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(extension)) {
      return 'audio';
    }

    return 'data';
  }

  /**
   * Infer content type from filename
   */
  private inferContentType(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();

    const mimeTypes: Record<string, string> = {
      // Images
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',

      // Audio
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      m4a: 'audio/mp4',
      flac: 'audio/flac',

      // Data
      json: 'application/json',
      pdf: 'application/pdf',
      zip: 'application/zip',
    };

    return mimeTypes[extension || ''] || 'application/octet-stream';
  }

  /**
   * Generate optimized URLs for different use cases
   */
  generateOptimizedUrl(
    asset: AssetReference,
    options: {
      width?: number;
      height?: number;
      quality?: number;
      format?: 'webp' | 'png' | 'jpeg';
    } = {}
  ): string {
    if (asset.type !== 'image') {
      return asset.downloadUrl;
    }

    // For images, we could add query parameters for optimization
    // Vercel Blob doesn't have built-in image optimization like Vercel's Image API,
    // but this structure allows for future enhancement
    let url = asset.downloadUrl;
    const params = new URLSearchParams();

    if (options.width) params.set('w', options.width.toString());
    if (options.height) params.set('h', options.height.toString());
    if (options.quality) params.set('q', options.quality.toString());
    if (options.format) params.set('f', options.format);

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    return url;
  }
}

// ============================================================================
// SINGLETON INSTANCE EXPORT
// ============================================================================

export const blobService = BlobService.getInstance();

// ============================================================================
// UTILITY FUNCTIONS FOR ASSET PROCESSING
// ============================================================================

/**
 * Convert base64 string to Buffer for upload
 */
export function base64ToBuffer(base64: string): Buffer {
  // Remove data URL prefix if present
  const base64Data = base64.replace(/^data:image\/[a-z]+;base64,/, '');
  return Buffer.from(base64Data, 'base64');
}

/**
 * Create thumbnail from image buffer (simplified placeholder)
 */
export async function createThumbnail(
  imageBuffer: Buffer,
  maxWidth: number = 200,
  maxHeight: number = 200
): Promise<Buffer> {
  // This is a placeholder - in a real implementation you'd use a library like Sharp
  // For now, return the original buffer
  // TODO: Implement actual thumbnail generation with Sharp or similar
  return imageBuffer;
}

/**
 * Validate file size and type
 */
export function validateAsset(
  filename: string,
  size: number,
  allowedTypes: string[],
  maxSizeBytes: number = 10 * 1024 * 1024 // 10MB default
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check file size
  if (size > maxSizeBytes) {
    errors.push(
      `File size ${size} bytes exceeds maximum of ${maxSizeBytes} bytes`
    );
  }

  // Check file type
  const extension = filename.split('.').pop()?.toLowerCase();
  if (!extension || !allowedTypes.includes(extension)) {
    errors.push(
      `File type .${extension} is not allowed. Allowed types: ${allowedTypes.join(', ')}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
