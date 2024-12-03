'use client';

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Issue, GitHubConfig } from '@/types/github';
import { getIssues, getGitHubConfig } from '@/lib/github';

interface IssueContextType {
  issues: Issue[];
  config: GitHubConfig | null;
  loading: boolean;
  initialized: boolean;
  syncIssues: () => Promise<void>;
  updateIssues: (newIssues: Issue[]) => void;
}

const IssueContext = createContext<IssueContextType>({
  issues: [],
  config: null,
  loading: true,
  initialized: false,
  syncIssues: async () => {},
  updateIssues: () => {}
});

// 使用 localStorage 来缓存数据
const CACHE_KEY = 'gitmemo_cache';
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

interface CacheData {
  issues: Issue[];
  config: GitHubConfig | null;
  timestamp: number;
}

function getCache(): CacheData | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const data: CacheData = JSON.parse(cached);
    if (Date.now() - data.timestamp > CACHE_EXPIRY) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

function setCache(data: CacheData) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, timestamp: Date.now() }));
}

// 全局内存缓存
let memoryCache: CacheData | null = null;

export function IssueProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<IssueContextType>({
    issues: [],
    config: null,
    loading: true,
    initialized: false,
    syncIssues: async () => {},
    updateIssues: () => {}
  });

  const initializingRef = useRef(false);

  const syncIssues = async () => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      const result = await getIssues(1, undefined, true);
      const newState = {
        issues: result.issues,
        config: state.config,
        timestamp: Date.now()
      };
      setState(prev => ({ 
        ...prev, 
        issues: result.issues,
        loading: false 
      }));
      setCache(newState);
      memoryCache = newState;
    } catch (error) {
      console.error('Error syncing issues:', error);
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  const updateIssues = (newIssues: Issue[]) => {
    const newState = {
      issues: newIssues,
      config: state.config,
      timestamp: Date.now()
    };
    setState(prev => ({ ...prev, issues: newIssues }));
    setCache(newState);
    memoryCache = newState;
  };

  useEffect(() => {
    async function initializeData() {
      if (state.initialized || initializingRef.current) return;
      initializingRef.current = true;

      // 首先检查内存缓存
      if (memoryCache?.issues && memoryCache?.config) {
        setState(prev => ({
          ...prev,
          issues: memoryCache.issues,
          config: memoryCache.config,
          loading: false,
          initialized: true,
          syncIssues,
          updateIssues
        }));
        return;
      }

      // 然后检查 localStorage 缓存
      const cached = getCache();
      if (cached) {
        setState(prev => ({
          ...prev,
          issues: cached.issues,
          config: cached.config,
          loading: false,
          initialized: true,
          syncIssues,
          updateIssues
        }));
        memoryCache = cached;
        return;
      }

      // 最后从服务器获取
      try {
        const [config, issuesResult] = await Promise.all([
          getGitHubConfig(),
          getIssues(1, undefined, false)
        ]);

        const newState = {
          issues: issuesResult.issues,
          config,
          timestamp: Date.now()
        };

        setState(prev => ({
          ...prev,
          issues: issuesResult.issues,
          config,
          loading: false,
          initialized: true,
          syncIssues,
          updateIssues
        }));

        setCache(newState);
        memoryCache = newState;
      } catch (error) {
        console.error('Error initializing data:', error);
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          initialized: true,
          syncIssues,
          updateIssues
        }));
      }
    }

    initializeData();
  }, [state.initialized]);

  return (
    <IssueContext.Provider value={state}>
      {children}
    </IssueContext.Provider>
  );
}

export function useIssues() {
  return useContext(IssueContext);
} 