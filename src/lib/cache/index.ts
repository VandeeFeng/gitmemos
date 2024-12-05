import { StorageCache } from './storage-cache';

// 缓存键常量
export const CACHE_KEYS = {
  ISSUES: (owner: string, repo: string, page: number, labels?: string) =>
    `issues:${owner}:${repo}:${page}:${labels || ''}`,
  
  LABELS: (owner: string, repo: string) =>
    `labels:${owner}:${repo}`,
  
  CONFIG: (owner: string, repo: string) =>
    `config:${owner}:${repo}`,
  
  SYNC_CHECK: (owner: string, repo: string) =>
    `sync:${owner}:${repo}`,
  
  PASSWORD_VERIFIED: 'password_verified'
} as const;

// 缓存过期时间常量
export const CACHE_EXPIRY = {
  ISSUES: 15 * 60 * 1000, // 15 minutes
  LABELS: 5 * 60 * 1000,  // 5 minutes
  CONFIG: 30 * 60 * 1000, // 30 minutes
  SYNC_CHECK: 15 * 60 * 1000, // 15 minutes
  PASSWORD: 24 * 60 * 60 * 1000, // 24 hours
} as const;

// 创建缓存管理器实例
export const cacheManager = typeof window !== 'undefined' 
  ? new StorageCache(window.localStorage)
  : null;

// 导出类型
export type { CacheManager, CacheOptions, CacheItem } from './types'; 