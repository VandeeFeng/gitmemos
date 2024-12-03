'use client';

import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { Issue, GitHubConfig } from '@/types/github';
import { getIssues, getGitHubConfig } from '@/lib/github';

interface IssueContextType {
  issues: Issue[];
  config: GitHubConfig | null;
  loading: boolean;
  initialized: boolean;
  isInitializing: boolean;
  syncIssues: () => Promise<void>;
  updateIssues: (newIssues: Issue[]) => void;
}

const IssueContext = createContext<IssueContextType>({
  issues: [],
  config: null,
  loading: true,
  initialized: false,
  isInitializing: false,
  syncIssues: async () => {},
  updateIssues: () => {}
});

// 使用 localStorage 来缓存数据
const CACHE_KEY = 'gitmemo_cache';
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

interface CacheData {
  issues: Issue[];
  config: GitHubConfig;
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
    isInitializing: false,
    syncIssues: async () => {},
    updateIssues: () => {}
  });

  const initializingRef = useRef(false);
  const initializePromiseRef = useRef<Promise<void>>();

  // Memoize these functions to prevent unnecessary re-renders
  const syncIssues = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      const result = await getIssues(1, undefined, true);
      if (!state.config) return;

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
  }, [state.config]);

  const updateIssues = useCallback((newIssues: Issue[]) => {
    if (!state.config) return;
    
    const newState = {
      issues: newIssues,
      config: state.config,
      timestamp: Date.now()
    };
    setState(prev => ({ ...prev, issues: newIssues }));
    setCache(newState);
    memoryCache = newState;
  }, [state.config]);

  useEffect(() => {
    let mounted = true;
    
    async function initializeData() {
      if (state.initialized || initializingRef.current) return;
      initializingRef.current = true;

      try {
        // First check memory cache
        if (memoryCache?.issues && memoryCache?.config) {
          if (mounted) {
            setState(prev => ({
              ...prev,
              issues: memoryCache!.issues,
              config: memoryCache!.config,
              loading: false,
              initialized: true,
              syncIssues,
              updateIssues
            }));
          }
          return;
        }

        // Then check localStorage cache
        const cached = getCache();
        if (cached?.issues && cached?.config) {
          if (mounted) {
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
          }
          return;
        }

        // Finally fetch from server
        const config = await getGitHubConfig();
        
        if (!config) {
          if (mounted) {
            setState(prev => ({ 
              ...prev, 
              loading: false, 
              initialized: true,
              syncIssues,
              updateIssues
            }));
          }
          return;
        }

        const issuesResult = await getIssues(1, undefined, false);
        
        if (mounted) {
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
        }
      } catch (error) {
        console.error('Error initializing data:', error);
        if (mounted) {
          setState(prev => ({ 
            ...prev, 
            loading: false, 
            initialized: true,
            syncIssues,
            updateIssues
          }));
        }
      } finally {
        initializingRef.current = false;
      }
    }

    // Create or reuse the initialization promise
    if (!initializePromiseRef.current) {
      initializePromiseRef.current = initializeData();
    }

    // Wait for initialization to complete
    initializePromiseRef.current.finally(() => {
      if (!mounted) return;
      initializePromiseRef.current = undefined;
    });

    return () => {
      mounted = false;
    };
  }, [state.initialized, syncIssues, updateIssues]);

  // Expose initialization status
  const value = {
    ...state,
    isInitializing: initializingRef.current,
    initializePromise: initializePromiseRef.current
  };

  return (
    <IssueContext.Provider value={value}>
      {children}
    </IssueContext.Provider>
  );
}

export function useIssues() {
  return useContext(IssueContext);
} 