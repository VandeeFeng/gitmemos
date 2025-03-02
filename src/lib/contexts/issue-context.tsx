'use client';

import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { Issue, GitHubConfig } from '@/types/github';
import { getGitHubConfig} from '@/lib/github';
import { checkSyncStatus, recordSync, saveLabel} from '@/lib/supabase-client';
import { cacheManager, CACHE_KEYS, CACHE_EXPIRY } from '@/lib/cache';
import { getIssues as getIssuesFromApi } from '@/lib/supabase-client';
import { debugLog, infoLog, errorLog } from '@/lib/debug';

interface IssueContextType {
  issues: Issue[];
  config: GitHubConfig | null;
  loading: boolean;
  initialized: boolean;
  isInitializing: boolean;
  syncIssues: () => Promise<{ success: boolean; totalSynced: number; syncType: 'full' | 'add' }>;
  updateIssues: (newIssues: Issue[]) => void;
  refreshIssues: () => Promise<void>;
}

const IssueContext = createContext<IssueContextType>({
  issues: [],
  config: null,
  loading: true,
  initialized: false,
  isInitializing: false,
  syncIssues: async () => ({ success: false, totalSynced: 0, syncType: 'add' }),
  updateIssues: () => {},
  refreshIssues: async () => {}
});

const SYNC_COOLDOWN = 60000; // 60 seconds
let lastSyncAttempt = 0;
let syncInProgress = false;

export function IssueProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<IssueContextType>({
    issues: [],
    config: null,
    loading: true,
    initialized: false,
    isInitializing: false,
    syncIssues: async () => ({ success: false, totalSynced: 0, syncType: 'add' }),
    updateIssues: () => {},
    refreshIssues: async () => {}
  });

  const initializingRef = useRef(false);
  const initializePromiseRef = useRef<Promise<void>>();
  const configRef = useRef<GitHubConfig | null>(null);

  // Memoize these functions to prevent unnecessary re-renders
  const syncIssues = useCallback(async () => {
    if (!configRef.current) {
      throw new Error('GitHub configuration is missing. Please configure your settings first.');
    }

    // 检查是否正在同步
    if (syncInProgress) {
      throw new Error('Sync already in progress. Please wait for it to complete.');
    }

    // 检查冷却时间
    const now = Date.now();
    const timeSinceLastSync = now - lastSyncAttempt;
    if (timeSinceLastSync < SYNC_COOLDOWN) {
      throw new Error(`Please wait ${Math.ceil((SYNC_COOLDOWN - timeSinceLastSync) / 1000)} seconds before syncing again.`);
    }

    syncInProgress = true;
    lastSyncAttempt = now;

    setState(prev => ({ ...prev, loading: true }));
    try {
      const config = configRef.current;

      // 首先同步标签
      infoLog('Syncing labels from GitHub...');
      const labelsResponse = await fetch('/api/github/labels');
      if (!labelsResponse.ok) {
        throw new Error('Failed to fetch labels from GitHub');
      }

      const labels = await labelsResponse.json();

      // 保存标签到数据库
      let savedLabels = 0;
      let failedLabels = 0;
      for (const label of labels) {
        try {
          const success = await saveLabel(config.owner, config.repo, label);
          if (success) {
            savedLabels++;
          } else {
            failedLabels++;
          }
        } catch {
          failedLabels++;
        }
      }

      if (failedLabels > 0) {
        infoLog(`Synced ${labels.length} labels: ${savedLabels} succeeded, ${failedLabels} failed`);
      } else {
        infoLog(`Successfully synced ${labels.length} labels`);
      }

      // 获取同步状态
      const syncStatus = await checkSyncStatus(config.owner, config.repo);
      const isFullSync = !syncStatus?.lastSyncAt;

      // 同步 issues
      infoLog(isFullSync ? 'Performing full sync...' : `Performing incremental sync since ${syncStatus.lastSyncAt}`);
      
      // 调用 API 进行同步
      const issuesResponse = await fetch(`/api/github/issues?owner=${config.owner}&repo=${config.repo}&forceSync=${isFullSync}`);
      if (!issuesResponse.ok) {
        throw new Error('Failed to fetch issues from GitHub');
      }

      const { issues, syncStatus: newSyncStatus } = await issuesResponse.json();

      // 如果是增量同步且没有更新，直接返回
      if (!isFullSync && (!issues || issues.length === 0)) {
        infoLog('No updates found since last sync');
        // 记录同步历史
        await recordSync(
          config.owner,
          config.repo,
          'success',
          0,
          undefined,
          'add'
        );
        return {
          success: true,
          totalSynced: 0,
          syncType: 'add' as const
        };
      }

      // Update state and cache
      setState(prev => {
        if (!prev.config) return prev;

        // 如果是增量同步，合并现有issues和新issues
        let updatedIssues = issues || [];
        if (!isFullSync && prev.issues) {
          const existingIssues = new Map(prev.issues.map((issue: Issue) => [issue.number, issue]));
          issues.forEach((issue: Issue) => existingIssues.set(issue.number, issue));
          updatedIssues = Array.from(existingIssues.values());
        }

        // 清理所有相关缓存
        debugLog('Clearing all related caches after sync...');
        const currentConfig = configRef.current;
        if (currentConfig) {
          const stats = cacheManager?.getStats();
          if (stats) {
            stats.keys.forEach(key => {
              if (key.includes(`${currentConfig.owner}:${currentConfig.repo}`)) {
                cacheManager?.remove(key);
                debugLog(`Cleared cache: ${key}`);
              }
            });
          }
        }

        // 设置新的缓存
        const newState = {
          issues: updatedIssues,
          config: prev.config,
        };
        
        cacheManager?.set(
          CACHE_KEYS.ISSUES(prev.config.owner, prev.config.repo, 1, ''),
          newState,
          { expiry: CACHE_EXPIRY.ISSUES }
        );
        debugLog('New cache set successfully');

        return { 
          ...prev,
          issues: updatedIssues,
          loading: false 
        };
      });

      infoLog(`Synced ${issues?.length || 0} issues from GitHub to database`);
      
      // 记录同步历史
      await recordSync(
        config.owner,
        config.repo,
        'success',
        issues?.length || 0,
        undefined,
        isFullSync ? 'full' : 'add'
      );
      
      return {
        success: newSyncStatus?.success ?? true,
        totalSynced: newSyncStatus?.totalSynced ?? (issues?.length || 0),
        syncType: isFullSync ? 'full' as const : 'add' as const
      };
    } catch (error) {
      errorLog('Error syncing from GitHub:', error);
      throw error;
    } finally {
      setState(prev => ({ ...prev, loading: false }));
      syncInProgress = false;
    }
  }, []);

  const updateIssues = useCallback((newIssues: Issue[]) => {
    if (!configRef.current) return;
    const config = configRef.current;
    
    setState(prev => ({ ...prev, issues: newIssues }));
    cacheManager?.set(
      CACHE_KEYS.ISSUES(config.owner, config.repo, 1, ''),
      { issues: newIssues },
      { expiry: CACHE_EXPIRY.ISSUES }
    );
  }, []);

  const fetchIssues = useCallback(async () => {
    if (!configRef.current) return;
    const config = configRef.current;
    
    setState(prev => ({ ...prev, loading: true }));
    try {
      const result = await getIssuesFromApi(config.owner, config.repo);
      if (result?.issues) {
        setState(prev => ({ ...prev, issues: result.issues }));
        cacheManager?.set(
          CACHE_KEYS.ISSUES(config.owner, config.repo, 1, ''),
          { issues: result.issues },
          { expiry: CACHE_EXPIRY.ISSUES }
        );
      }
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const refreshIssues = useCallback(async () => {
    // Clear the cache first
    if (!configRef.current) return;
    const config = configRef.current;
    
    cacheManager?.remove(CACHE_KEYS.ISSUES(config.owner, config.repo, 1, ''));
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
        const needsSync = !syncStatus?.lastSyncAt;

        if (syncStatus?.lastSyncAt) {
          debugLog(`Last sync time: ${new Date(syncStatus.lastSyncAt).toLocaleString()}`);
        }

        // 从缓存或数据库获取数据
        const cacheKey = CACHE_KEYS.ISSUES(config.owner, config.repo, 1, '');
        const cached = cacheManager?.get<{ issues: Issue[] }>(cacheKey);

        if (cached?.issues) {
          debugLog('Using cached issues:', { count: cached.issues.length });
          if (mounted) {
            setState(prev => ({
              ...prev,
              issues: cached.issues,
              config,
              loading: false,
              initialized: true,
              syncIssues,
              updateIssues,
              refreshIssues
            }));
          }
        } else {
          // 如果没有缓存，从数据库获取
          const result = await getIssuesFromApi(config.owner, config.repo);
          const issues = result?.issues || [];
          debugLog('Loaded issues from database:', { count: issues.length });

          if (mounted) {
            setState(prev => ({
              ...prev,
              issues,
              config,
              loading: false,
              initialized: true,
              syncIssues,
              updateIssues,
              refreshIssues
            }));

            // 更新缓存
            if (issues.length > 0) {
              debugLog('Updating cache with issues');
              cacheManager?.set(
                cacheKey,
                { issues },
                { expiry: CACHE_EXPIRY.ISSUES }
              );
            }
          }

          // 如果需要同步，自动触发同步
          if (needsSync) {
            debugLog('No previous sync found, triggering initial sync...');
            try {
              await syncIssues();
            } catch (error) {
              errorLog('Initial sync failed:', error);
            }
          }
        }
      } catch (error) {
        errorLog('Error initializing data:', error);
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
  }, [syncIssues, updateIssues, refreshIssues, state.initialized]);

  return (
    <IssueContext.Provider value={state}>
      {children}
    </IssueContext.Provider>
  );
}

export function useIssues() {
  return useContext(IssueContext);
} 