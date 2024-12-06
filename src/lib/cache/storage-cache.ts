import { CacheManager, CacheOptions, CacheItem } from './types';

const DEFAULT_EXPIRY = 15 * 60 * 1000; // 15 minutes
const DEFAULT_VERSION = '1.0';
const CACHE_PREFIX = 'gitmemo_cache:';

export class StorageCache implements CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private removalCounts: Map<string, number> = new Map();
  private logTimeout: NodeJS.Timeout | null = null;
  private readonly storage: Storage;

  constructor(storage: Storage = localStorage) {
    this.storage = storage;
    console.log('StorageCache initialized');
  }

  private getFullKey(key: string): string {
    return `${CACHE_PREFIX}${key}`;
  }

  private isExpired(timestamp: number, expiry: number): boolean {
    return Date.now() - timestamp > expiry;
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
      console.log(`Cache set successfully: ${key}`, {
        size: new Blob([serializedData]).size,
        version: cacheItem.version,
        expiry: cacheItem.expiry
      });
    } catch (error) {
      console.error(`Failed to set cache for key ${key}:`, {
        error,
        dataSize: new Blob([JSON.stringify(data)]).size,
        storageUsage: this.getStorageUsage()
      });

      // 如果存储失败（比如 localStorage 已满），尝试清理过期缓存后重试
      this.cleanup();
      try {
        const serializedData = JSON.stringify(cacheItem);
        this.storage.setItem(fullKey, serializedData);
        console.log(`Cache set successfully after cleanup: ${key}`, {
          size: new Blob([serializedData]).size,
          version: cacheItem.version,
          expiry: cacheItem.expiry
        });
      } catch (retryError) {
        console.error(`Failed to set cache after cleanup for key ${key}:`, {
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
      console.log(`Cache miss: ${key}`);
      return null;
    }

    try {
      const cacheItem = JSON.parse(item) as CacheItem<T>;
      const expiry = cacheItem.expiry || DEFAULT_EXPIRY;
      const age = Date.now() - cacheItem.timestamp;

      if (age > expiry) {
        console.log(`Cache expired: ${key}`, {
          timestamp: new Date(cacheItem.timestamp).toISOString(),
          expiry,
          age
        });
        this.remove(key);
        return null;
      }

      console.log(`Cache hit: ${key}`, {
        version: cacheItem.version,
        age,
        expiry,
        isExpired: age > expiry
      });
      return cacheItem.data;
    } catch (error) {
      console.error(`Failed to parse cache for key ${key}:`, {
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
      
      // Count removals by key pattern
      const keyPattern = key.split(':')[0]; // Get the type of cache (e.g., 'issues', 'labels')
      const count = (this.removalCounts.get(keyPattern) || 0) + 1;
      this.removalCounts.set(keyPattern, count);

      // Debounce log output
      if (this.logTimeout) {
        clearTimeout(this.logTimeout);
      }
      this.logTimeout = setTimeout(() => {
        this.logRemovals();
      }, 1000); // Wait 1 second before logging
    } catch (error) {
      console.error(`Failed to remove cache for key ${key}:`, error);
    }
  }

  private logRemovals() {
    this.removalCounts.forEach((count, keyPattern) => {
      console.log(`Cache removed: ${keyPattern} (${count} items)`);
    });
    this.removalCounts.clear();
    this.logTimeout = null;
  }

  clear(): void {
    const keys = this.getAllKeys();
    console.log(`Clearing all cache entries (${keys.length} items)`);
    keys.forEach(key => {
      try {
        this.storage.removeItem(key);
      } catch (error) {
        console.error(`Failed to remove cache entry: ${key}`, error);
      }
    });
  }

  has(key: string): boolean {
    const result = this.get(key) !== null;
    console.log(`Cache check (has): ${key} = ${result}`);
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
      console.error('Failed to calculate total cache size:', error);
    }

    console.log('Cache stats:', stats);
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
    console.log(`Starting cache cleanup (${keys.length} items)`);
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
            console.log(`Cleaned up expired cache: ${key.replace(CACHE_PREFIX, '')}`, {
              age: Date.now() - cacheItem.timestamp,
              expiry
            });
          }
        } catch {
          // 如果解析失，直接删除
          this.storage.removeItem(key);
          cleaned++;
          console.log(`Cleaned up invalid cache: ${key.replace(CACHE_PREFIX, '')}`);
        }
      }
    });

    console.log(`Cache cleanup completed: removed ${cleaned} items`);
  }

  private getStorageUsage(): { used: number; total: number; percentage: number } {
    let total = 0;
    let used = 0;

    try {
      // 估算总容量（通常是 5-10MB）
      total = 5 * 1024 * 1024; // 5MB

      // 计算已使用空间
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
      console.error('Failed to calculate storage usage:', error);
      return { used: 0, total: 0, percentage: 0 };
    }
  }
} 