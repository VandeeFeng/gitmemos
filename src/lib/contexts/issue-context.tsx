'use client';

import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { Issue, GitHubConfig } from '@/types/github';
import { getIssues, getGitHubConfig } from '@/lib/github';
import { recordSyncHistory } from '@/lib/db';
import { cacheManager, CACHE_KEYS, CACHE_EXPIRY } from '@/lib/cache';

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

interface CacheData {
  issues: Issue[];
  config: GitHubConfig;
}

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
  const configRef = useRef<GitHubConfig | null>(null);

  // Memoize these functions to prevent unnecessary re-renders
  const syncIssues = useCallback(async () => {
    if (!configRef.current) return;

    setState(prev => ({ ...prev, loading: true }));
    try {
      const result = await getIssues(1, undefined, true, configRef.current);
      
      setState(prev => {
        if (!prev.config) return prev;

        const newState: CacheData = {
          issues: result.issues,
          config: prev.config,
        };
        
        cacheManager?.set(
          CACHE_KEYS.ISSUES(prev.config.owner, prev.config.repo, 1, ''),
          newState,
          { expiry: CACHE_EXPIRY.ISSUES }
        );

        // 记录同步历史
        recordSyncHistory(
          prev.config.owner,
          prev.config.repo,
          'success',
          result.issues.length
        ).catch(console.error);

        return { 
          ...prev, 
          issues: result.issues,
          loading: false 
        };
      });
    } catch (error) {
      console.error('Error syncing issues:', error);
      setState(prev => {
        if (prev.config) {
          recordSyncHistory(
            prev.config.owner,
            prev.config.repo,
            'failed',
            0,
            error instanceof Error ? error.message : 'Unknown error'
          ).catch(console.error);
        }
        return { ...prev, loading: false };
      });
    }
  }, []);

  const updateIssues = useCallback((newIssues: Issue[]) => {
    if (!configRef.current) return;
    
    const newState: CacheData = {
      issues: newIssues,
      config: configRef.current,
    };

    setState(prev => ({ ...prev, issues: newIssues }));
    cacheManager?.set(
      CACHE_KEYS.ISSUES(configRef.current.owner, configRef.current.repo, 1, ''),
      newState,
      { expiry: CACHE_EXPIRY.ISSUES }
    );
  }, []);

  useEffect(() => {
    let mounted = true;
    
    async function initializeData() {
      if (state.initialized || initializingRef.current) return;
      initializingRef.current = true;

      try {
        // 获取配置
        const config = await getGitHubConfig();
        configRef.current = config;
        
        if (!config || !config.owner || !config.repo) {
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

        // 检查缓存
        const cacheKey = CACHE_KEYS.ISSUES(config.owner, config.repo, 1, '');
        const cached = cacheManager?.get<CacheData>(cacheKey);

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
          }
          return;
        }

        // 从服务器获取数据
        const issuesResult = await getIssues(1, undefined, false, config);
        
        if (mounted) {
          const newState: CacheData = {
            issues: issuesResult.issues,
            config,
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

          cacheManager?.set(cacheKey, newState, { expiry: CACHE_EXPIRY.ISSUES });
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
  }, [syncIssues, updateIssues]);

  return (
    <IssueContext.Provider value={state}>
      {children}
    </IssueContext.Provider>
  );
}

export function useIssues() {
  return useContext(IssueContext);
} 