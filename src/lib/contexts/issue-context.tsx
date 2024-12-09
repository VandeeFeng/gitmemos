'use client';

import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { Issue, GitHubConfig } from '@/types/github';
import { getIssues as getGitHubIssues, getGitHubConfig } from '@/lib/github';
import { checkSyncStatus, recordSync, saveIssue, saveLabel } from '@/lib/api';
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
      console.log(`Saving ${labels.length} labels to database...`);
      let savedLabels = 0;
      let failedLabels = 0;
      for (const label of labels) {
        try {
          const success = await saveLabel(configRef.current.owner, configRef.current.repo, label);
          if (success) {
            savedLabels++;
          } else {
            failedLabels++;
            console.error(`Failed to save label: ${label.name}`);
          }
        } catch (error) {
          failedLabels++;
          console.error(`Error saving label ${label.name}:`, error);
        }
      }

      console.log(`Synced ${labels.length} labels from GitHub to database (${savedLabels} saved, ${failedLabels} failed)`);

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

      // Save each issue to database
      for (const issue of issues) {
        await saveIssue(configRef.current.owner, configRef.current.repo, issue);
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

        // 如果需要同步（超24小时或从未同步），自动同步
        const needsSync = syncStatus?.needsSync ?? true;
        if (needsSync) {
          console.log('Auto syncing from GitHub API to database...');
          try {
            // 首先同步标签
            const octokit = new Octokit({ auth: config.token });
            console.log('Syncing labels from GitHub...');
            const labelsResponse = await octokit.rest.issues.listLabelsForRepo({
              owner: config.owner,
              repo: config.repo,
            });

            const labels = labelsResponse.data.map(label => ({
              id: label.id,
              name: label.name,
              color: label.color,
              description: label.description,
            }));

            // 保存标签到数据库
            console.log(`Saving ${labels.length} labels to database...`);
            let savedLabels = 0;
            let failedLabels = 0;
            for (const label of labels) {
              try {
                const success = await saveLabel(config.owner, config.repo, label);
                if (success) {
                  savedLabels++;
                } else {
                  failedLabels++;
                  console.error(`Failed to save label: ${label.name}`);
                }
              } catch (error) {
                failedLabels++;
                console.error(`Error saving label ${label.name}:`, error);
              }
            }

            console.log(`Synced ${labels.length} labels from GitHub to database (${savedLabels} saved, ${failedLabels} failed)`);

            // 清除标签缓存
            cacheManager?.remove(CACHE_KEYS.LABELS(config.owner, config.repo));

            // 然后同步 issues
            const result = await getGitHubIssues(1, undefined, true, config);
            console.log(`Synced ${result.issues.length} issues from GitHub to database`);
          } catch (error) {
            console.error('Error syncing from GitHub:', error);
            // Record sync failure but don't throw - this is initialization
            if (config) {
              await recordSync(
                config.owner,
                config.repo,
                'failed',
                0,
                error instanceof Error ? error.message : 'Unknown error'
              );
            }
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