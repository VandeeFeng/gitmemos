import { CacheManager, CacheOptions, CacheItem } from './types';
import { debugLog, errorLog } from '@/lib/debug';

const DEFAULT_EXPIRY = 15 * 60 * 1000; // 15 minutes
const DEFAULT_VERSION = '1.0';
const CACHE_PREFIX = 'gitmemo_cache:';

export class StorageCache implements CacheManager {
  private readonly storage: Storage;
  private removalCounts: Map<string, number>;
  private logTimeout: NodeJS.Timeout | null;

  constructor(storage: Storage = localStorage) {
    this.storage = storage;
    this.removalCounts = new Map();
    this.logTimeout = null;
    debugLog('StorageCache initialized');
  }

  private getFullKey(key: string): string {
    return `${CACHE_PREFIX}${key}`;
  }

  private isExpired(timestamp: number, expiry: number): boolean {
    return Date.now() - timestamp > expiry;
  }

  private logRemovals() {
    if (this.removalCounts.size > 0) {
      const logs = Array.from(this.removalCounts.entries()).map(([key, count]) => {
        const baseKey = key.split(':').slice(0, -1).join(':');
        return `${baseKey} (${count} items)`;
      });
      debugLog('Cache removals:', logs.join(', '));
      this.removalCounts.clear();
    }
  }

  private scheduleLogRemovals() {
    if (this.logTimeout) {
      clearTimeout(this.logTimeout);
    }
    this.logTimeout = setTimeout(() => {
      this.logRemovals();
      this.logTimeout = null;
    }, 1000);
  }

  set<T>(key: string, data: T, options: Partial<CacheOptions> = {}): void {
    const fullKey = this.getFullKey(key);
    const cacheItem: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      version: options.version || DEFAULT_VERSION,
      expiry: options.expiry || DEFAULT_EXPIRY,
    };

    try {
      const serializedData = JSON.stringify(cacheItem);
      this.storage.setItem(fullKey, serializedData);
      debugLog(`Cache set successfully: ${key}`, {
        size: new Blob([serializedData]).size,
        version: cacheItem.version,
        expiry: cacheItem.expiry
      });
    } catch (error) {
      errorLog(`Failed to set cache for key ${key}:`, {
        error,
        dataSize: new Blob([JSON.stringify(data)]).size,
        storageUsage: this.getStorageUsage()
      });

      // If storage fails (e.g., localStorage is full), try cleaning up expired cache and retry
      this.cleanup();
      try {
        const serializedData = JSON.stringify(cacheItem);
        this.storage.setItem(fullKey, serializedData);
        debugLog(`Cache set successfully after cleanup: ${key}`, {
          size: new Blob([serializedData]).size,
          version: cacheItem.version,
          expiry: cacheItem.expiry
        });
      } catch (retryError) {
        errorLog(`Failed to set cache after cleanup for key ${key}:`, {
          error: retryError,
          dataSize: new Blob([JSON.stringify(data)]).size,
          storageUsage: this.getStorageUsage()
        });
      }
    }
  }

  get<T>(key: string): T | null {
    const fullKey = this.getFullKey(key);
    const item = this.storage.getItem(fullKey);

    if (!item) {
      debugLog(`Cache miss: ${key}`);
      return null;
    }

    try {
      const cacheItem = JSON.parse(item) as CacheItem<T>;
      const expiry = cacheItem.expiry || DEFAULT_EXPIRY;
      const age = Date.now() - cacheItem.timestamp;

      if (age > expiry) {
        debugLog(`Cache expired: ${key}`, {
          timestamp: new Date(cacheItem.timestamp).toISOString(),
          expiry,
          age
        });
        this.remove(key);
        return null;
      }

      debugLog(`Cache hit: ${key}`, {
        version: cacheItem.version,
        age,
        expiry,
        isExpired: age > expiry
      });
      return cacheItem.data;
    } catch (error) {
      errorLog(`Failed to parse cache for key ${key}:`, {
        error,
        rawData: item
      });
      this.remove(key);
      return null;
    }
  }

  remove(key: string): void {
    const fullKey = this.getFullKey(key);
    try {
      this.storage.removeItem(fullKey);
      // Count removals by base key (without the last segment)
      const baseKey = key.split(':').slice(0, -1).join(':');
      this.removalCounts.set(baseKey, (this.removalCounts.get(baseKey) || 0) + 1);
      this.scheduleLogRemovals();
    } catch (error) {
      errorLog(`Failed to remove cache for key ${key}:`, error);
    }
  }

  clear(): void {
    const keys = this.getAllKeys();
    debugLog(`Clearing all cache entries (${keys.length} items)`);
    keys.forEach(key => {
      try {
        this.storage.removeItem(key);
      } catch (error) {
        errorLog(`Failed to remove cache entry: ${key}`, error);
      }
    });
  }

  has(key: string): boolean {
    const result = this.get(key) !== null;
    debugLog(`Cache check (has): ${key} = ${result}`);
    return result;
  }

  getStats(): { size: number; keys: string[] } {
    const keys = this.getAllKeys();
    const stats = {
      size: keys.length,
      keys: keys.map(key => key.replace(CACHE_PREFIX, '')),
      totalSize: 0,
      usage: this.getStorageUsage()
    };

    try {
      stats.totalSize = keys.reduce((total, key) => {
        const item = this.storage.getItem(key);
        return total + (item ? new Blob([item]).size : 0);
      }, 0);
    } catch (error) {
      errorLog('Failed to calculate total cache size:', error);
    }

    debugLog('Cache stats:', stats);
    return {
      size: stats.size,
      keys: stats.keys
    };
  }

  private getAllKeys(): string[] {
    return Object.keys(this.storage).filter(key => key.startsWith(CACHE_PREFIX));
  }

  private cleanup(): void {
    const keys = this.getAllKeys();
    debugLog(`Starting cache cleanup (${keys.length} items)`);
    let cleaned = 0;

    keys.forEach(key => {
      const item = this.storage.getItem(key);
      if (item) {
        try {
          const cacheItem = JSON.parse(item) as CacheItem<unknown>;
          const expiry = cacheItem.expiry || DEFAULT_EXPIRY;
          if (Date.now() - cacheItem.timestamp > expiry) {
            this.storage.removeItem(key);
            cleaned++;
            debugLog(`Cleaned up expired cache: ${key.replace(CACHE_PREFIX, '')}`, {
              age: Date.now() - cacheItem.timestamp,
              expiry
            });
          }
        } catch {
          // If parsing fails, remove directly
          this.storage.removeItem(key);
          cleaned++;
          debugLog(`Cleaned up invalid cache: ${key.replace(CACHE_PREFIX, '')}`);
        }
      }
    });

    debugLog(`Cache cleanup completed: removed ${cleaned} items`);
  }

  private getStorageUsage(): { used: number; total: number; percentage: number } {
    let total = 0;
    let used = 0;

    try {
      // Estimate total capacity (usually 5-10MB)
      total = 5 * 1024 * 1024; // 5MB

      // Calculate used space
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (key) {
          const value = this.storage.getItem(key);
          if (value) {
            used += new Blob([key, value]).size;
          }
        }
      }

      return {
        used,
        total,
        percentage: (used / total) * 100
      };
    } catch (error) {
      errorLog('Failed to calculate storage usage:', error);
      return { used: 0, total: 0, percentage: 0 };
    }
  }
} 