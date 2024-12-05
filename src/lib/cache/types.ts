export interface CacheOptions {
  /** 缓存过期时间（毫秒） */
  expiry: number;
  /** 缓存版本，用于处理缓存更新 */
  version?: string;
}

export interface CacheItem<T> {
  /** 缓存的数据 */
  data: T;
  /** 缓存时间戳 */
  timestamp: number;
  /** 缓存版本 */
  version: string;
}

export interface CacheManager {
  /** 设置缓存 */
  set<T>(key: string, data: T, options?: Partial<CacheOptions>): void;
  
  /** 获取缓存 */
  get<T>(key: string): T | null;
  
  /** 删除缓存 */
  remove(key: string): void;
  
  /** 清除所有缓存 */
  clear(): void;
  
  /** 检查缓存是否存在且有效 */
  has(key: string): boolean;
  
  /** 获取缓存状态 */
  getStats(): {
    size: number;
    keys: string[];
  };
} 