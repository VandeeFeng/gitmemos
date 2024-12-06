'use client';

import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { Issue, GitHubConfig } from '@/types/github';
import { getIssues as getGitHubIssues, getGitHubConfig } from '@/lib/github';
import { checkSyncStatus, recordSync } from '@/lib/api';
import { cacheManager, CACHE_KEYS, CACHE_EXPIRY } from '@/lib/cache';
import { getIssues as getIssuesFromApi } from '@/lib/api';

interface IssueContextType {
  issues: Issue[];
  config: GitHubConfig | null;
  loading: boolean;
  initialized: boolean;
  isInitializing: boolean;
  syncIssues: () => Promise<void>;
  updateIssues: (newIssues: Issue[]) => void;
  refreshIssues: () => Promise<void>;
}

const IssueContext = createContext<IssueContextType>({
  issues: [],
  config: null,
  loading: true,
  initialized: false,
  isInitializing: false,
  syncIssues: async () => {},
  updateIssues: () => {},
  refreshIssues: async () => {}
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
    updateIssues: () => {},
    refreshIssues: async () => {}
  });

  const initializingRef = useRef(false);
  const initializePromiseRef = useRef<Promise<void>>();
  const configRef = useRef<GitHubConfig | null>(null);

  // Memoize these functions to prevent unnecessary re-renders
  const syncIssues = useCallback(async () => {
    if (!configRef.current) return;

    setState(prev => ({ ...prev, loading: true }));
    try {
      // 从 GitHub API 获取数据并同步到数据库
      const response = await fetch('/api/github/issues', {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to sync with GitHub');
      }

      const issues = await response.json();
      console.log(`Synced ${issues.length} issues from GitHub to database`);
      
      setState(prev => {
        if (!prev.config) return prev;

        const newState: CacheData = {
          issues,
          config: prev.config,
        };
        
        cacheManager?.set(
          CACHE_KEYS.ISSUES(prev.config.owner, prev.config.repo, 1, ''),
          newState,
          { expiry: CACHE_EXPIRY.ISSUES }
        );

        // 记录同步历史
        recordSync(
          prev.config.owner,
          prev.config.repo,
          'success',
          issues.length
        ).catch(console.error);

        return { 
          ...prev,
          issues,
          loading: false 
        };
      });
    } catch (error) {
      console.error('Error syncing from GitHub:', error);
      setState(prev => {
        if (prev.config) {
          recordSync(
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

  const fetchIssues = useCallback(async () => {
    if (!configRef.current) return;
    
    setState(prev => ({ ...prev, loading: true }));
    try {
      const result = await getIssuesFromApi(configRef.current.owner, configRef.current.repo);
      if (result?.issues) {
        const newState: CacheData = {
          issues: result.issues,
          config: configRef.current,
        };
        setState(prev => ({ ...prev, issues: result.issues }));
        cacheManager?.set(
          CACHE_KEYS.ISSUES(configRef.current.owner, configRef.current.repo, 1, ''),
          newState,
          { expiry: CACHE_EXPIRY.ISSUES }
        );
      }
    } catch (error) {
      console.error('Error fetching issues:', error);
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const refreshIssues = useCallback(async () => {
    // Clear the cache first
    if (configRef.current) {
      cacheManager?.remove(CACHE_KEYS.ISSUES(configRef.current.owner, configRef.current.repo, 1, ''));
    }
    // Then fetch fresh data
    await fetchIssues();
  }, [fetchIssues]);

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
              updateIssues,
              refreshIssues
            }));
          }
          return;
        }

        // 检查同步状态
        const syncStatus = await checkSyncStatus(config.owner, config.repo);
        if (syncStatus?.lastSyncAt) {
          const lastSyncTime = new Date(syncStatus.lastSyncAt).getTime();
          const now = Date.now();
          const hoursSinceLastSync = Math.round((now - lastSyncTime) / (1000 * 60 * 60));
          console.log(
            `Last sync time: ${new Date(syncStatus.lastSyncAt).toLocaleString()} (${hoursSinceLastSync} hours ago)`
          );
        }

        // 如果需要同步（超过24小时或从未同步），自动同步
        const needsSync = syncStatus?.needsSync ?? true;
        if (needsSync) {
          console.log('Auto syncing from GitHub API to database...');
          try {
            // 从 GitHub API 获取数据并同步到数据库
            const response = await fetch('/api/github/issues', {
              headers: {
                'Content-Type': 'application/json',
              },
            });
            
            if (!response.ok) {
              throw new Error('Failed to sync with GitHub');
            }

            const issues = await response.json();
            console.log(`Synced ${issues.length} issues from GitHub to database`);
          } catch (error) {
            console.error('Error syncing from GitHub:', error);
          }
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
              updateIssues,
              refreshIssues
            }));
          }
          return;
        }

        // 从服务器获取数据
        const issuesResult = await getGitHubIssues(1, undefined, false, config);
        
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
            updateIssues,
            refreshIssues
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
            updateIssues,
            refreshIssues
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
  }, [syncIssues, updateIssues, refreshIssues]);

  return (
    <IssueContext.Provider value={state}>
      {children}
    </IssueContext.Provider>
  );
}

export function useIssues() {
  return useContext(IssueContext);
} 