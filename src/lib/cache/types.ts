export interface CacheOptions {
  /** Cache expiration time (milliseconds) */
  expiry?: number;
  /** Cache version, used to handle cache updates */
  version?: string;
}

export interface CacheItem<T> {
  /** Cache data */
  data: T;
  /** Cache timestamp */
  timestamp: number;
  /** Cache version */
  version: string;
  /** Cache expiration time (milliseconds) */
  expiry: number;
}

export interface CacheManager {
  /** Set cache */
  set<T>(key: string, data: T, options?: Partial<CacheOptions>): void;
  
  /** Get cache */
  get<T>(key: string): T | null;
  
  /** Remove cache */
  remove(key: string): void;
  
  /** Clear all cache */
  clear(): void;
  
  /** Check if cache exists and is valid */
  has(key: string): boolean;
  
  /** Get cache stats */
  getStats(): {
    size: number;
    keys: string[];
  };
} 