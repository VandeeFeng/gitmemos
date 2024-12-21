'use client';

import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { Issue, GitHubConfig } from '@/types/github';
import { getIssues as getGitHubIssues, getGitHubConfig } from '@/lib/github';
import { checkSyncStatus, recordSync, saveLabel, saveIssues } from '@/lib/api';
import { cacheManager, CACHE_KEYS, CACHE_EXPIRY } from '@/lib/cache';
import { getIssues as getIssuesFromApi } from '@/lib/api';
import { Octokit } from 'octokit';

interface IssueContextType {
  issues: Issue[];
  config: GitHubConfig | null;
  loading: boolean;
  initialized: boolean;
  isInitializing: boolean;
  syncIssues: () => Promise<{ success: boolean; totalSynced: number }>;
  updateIssues: (newIssues: Issue[]) => void;
  refreshIssues: () => Promise<void>;
}

const IssueContext = createContext<IssueContextType>({
  issues: [],
  config: null,
  loading: true,
  initialized: false,
  isInitializing: false,
  syncIssues: async () => ({ success: false, totalSynced: 0 }),
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
    syncIssues: async () => ({ success: false, totalSynced: 0 }),
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

    setState(prev => ({ ...prev, loading: true }));
    try {
      // Use Octokit for direct GitHub API calls
      const octokit = new Octokit({ auth: configRef.current.token });

      // 首先同步标签
      console.log('Syncing labels from GitHub...');
      const labelsResponse = await octokit.rest.issues.listLabelsForRepo({
        owner: configRef.current.owner,
        repo: configRef.current.repo,
      });

      const labels = labelsResponse.data.map(label => ({
        id: label.id,
        name: label.name,
        color: label.color,
        description: label.description,
      }));

      // 保存标签到数据库
      let savedLabels = 0;
      let failedLabels = 0;
      for (const label of labels) {
        try {
          const success = await saveLabel(configRef.current.owner, configRef.current.repo, label);
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
        console.log(`Synced ${labels.length} labels: ${savedLabels} succeeded, ${failedLabels} failed`);
      } else {
        console.log(`Successfully synced ${labels.length} labels`);
      }

      // 清除标签缓存
      if (configRef.current) {
        cacheManager?.remove(CACHE_KEYS.LABELS(configRef.current.owner, configRef.current.repo));
      }

      // 然后同步 issues
      const { data } = await octokit.rest.issues.listForRepo({
        owner: configRef.current.owner,
        repo: configRef.current.repo,
        state: 'all',
        per_page: configRef.current.issuesPerPage || 50,
        page: 1,
        sort: 'created',
        direction: 'desc'
      });

      const issues = data.map(issue => ({
        number: issue.number,
        title: issue.title,
        body: issue.body || '',
        created_at: issue.created_at,
        state: issue.state,
        labels: issue.labels
          .filter((label): label is { id: number; name: string; color: string; description: string | null } => 
            typeof label === 'object' && label !== null)
          .map(label => ({
            id: label.id,
            name: label.name,
            color: label.color,
            description: label.description,
          }))
      }));

      // 批量保存 issues 到数据库
      const saveResult = await saveIssues(configRef.current.owner, configRef.current.repo, issues);
      if (!saveResult) {
        throw new Error('Failed to save issues to database');
      }

      // Update state and cache
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

        return { 
          ...prev,
          issues,
          loading: false 
        };
      });

      // Record successful sync
      await recordSync(
        configRef.current.owner,
        configRef.current.repo,
        'success',
        issues.length
      );

      console.log(`Synced ${issues.length} issues from GitHub to database`);
      
      return {
        success: true,
        totalSynced: issues.length
      };
    } catch (error) {
      console.error('Error syncing from GitHub:', error);
      
      // Record sync failure
      if (configRef.current) {
        await recordSync(
          configRef.current.owner,
          configRef.current.repo,
          'failed',
          0,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
      
      setState(prev => ({ ...prev, loading: false }));
      
      // Re-throw with more descriptive error
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error('Failed to sync with GitHub');
      }
    }
  }, []);

  const updateIssues = useCallback((newIssues: Issue[]) => {
    if (!configRef.current) return;
    
    setState(prev => ({ ...prev, issues: newIssues }));
    cacheManager?.set(
      CACHE_KEYS.ISSUES(configRef.current.owner, configRef.current.repo, 1, ''),
      { issues: newIssues },
      { expiry: CACHE_EXPIRY.ISSUES }
    );
  }, []);

  const fetchIssues = useCallback(async () => {
    if (!configRef.current) return;
    
    setState(prev => ({ ...prev, loading: true }));
    try {
      const result = await getIssuesFromApi(configRef.current.owner, configRef.current.repo);
      if (result?.issues) {
        setState(prev => ({ ...prev, issues: result.issues }));
        cacheManager?.set(
          CACHE_KEYS.ISSUES(configRef.current.owner, configRef.current.repo, 1, ''),
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

        // 检查步状态
        const syncStatus = await checkSyncStatus(config.owner, config.repo);
        if (syncStatus?.lastSyncAt) {
          console.log(
            `Last sync time: ${new Date(syncStatus.lastSyncAt).toLocaleString()}`
          );
        }

        // 从服务器获取数据
        const issuesResult = await getGitHubIssues(1, undefined, false, config);
        
        if (mounted) {
          // 确保 issues 数组存在
          const issues = Array.isArray(issuesResult.issues) ? issuesResult.issues : [];
          console.log('Loaded issues:', { count: issues.length });

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
            console.log('Updating cache with issues');
            cacheManager?.set(
              CACHE_KEYS.ISSUES(config.owner, config.repo, 1, ''),
              { issues },
              { expiry: CACHE_EXPIRY.ISSUES }
            );
          }
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