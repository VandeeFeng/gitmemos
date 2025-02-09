import { StorageCache } from './storage-cache';

// Memory store for auth state
class AuthStore {
  private static instance: AuthStore;
  private passwordVerified: boolean = false;
  private expiryTime: number | null = null;

  private constructor() {}

  static getInstance(): AuthStore {
    if (!AuthStore.instance) {
      AuthStore.instance = new AuthStore();
    }
    return AuthStore.instance;
  }

  setPasswordVerified(verified: boolean, expiryInMs?: number): void {
    this.passwordVerified = verified;
    this.expiryTime = verified ? (expiryInMs ? Date.now() + expiryInMs : null) : null;
  }

  isPasswordVerified(): boolean {
    if (!this.passwordVerified) return false;
    if (this.expiryTime && Date.now() > this.expiryTime) {
      this.setPasswordVerified(false);
      return false;
    }
    return true;
  }
}

export const authStore = AuthStore.getInstance();

// 缓存键常量
export const CACHE_KEYS = {
  ISSUES: (owner: string, repo: string, page: number, labels?: string) =>
    `issues:${owner}:${repo}:${page}:${labels || ''}`,
  
  LABELS: (owner: string, repo: string) =>
    `labels:${owner}:${repo}`,
  
  CONFIG: (owner: string, repo: string) =>
    `config:${owner}:${repo}`
} as const;

// 缓存过期时间常量
export const CACHE_EXPIRY = {
  ISSUES: 15 * 60 * 1000, // 15 minutes
  LABELS: 15 * 60 * 1000, // 15 minutes
  CONFIG: 15 * 60 * 1000, // 15 minutes
  PASSWORD: 24 * 60 * 60 * 1000, // 24 hours
} as const;

// 创建缓存管理器实例
export const cacheManager = typeof window !== 'undefined' 
  ? new StorageCache(window.localStorage)
  : null;

// 导出类型
export type { CacheManager, CacheOptions, CacheItem } from './types'; 