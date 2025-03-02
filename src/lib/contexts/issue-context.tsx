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

    // Check if sync is in progress
    if (syncInProgress) {
      throw new Error('Sync already in progress. Please wait for it to complete.');
    }

    // Check cooldown time
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

      // First sync labels
      infoLog('Syncing labels from GitHub...');
      const labelsResponse = await fetch('/api/github/labels');
      if (!labelsResponse.ok) {
        throw new Error('Failed to fetch labels from GitHub');
      }

      const labels = await labelsResponse.json();

      // Save labels to database
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

      // Get sync status
      const syncStatus = await checkSyncStatus(config.owner, config.repo);
      const isFullSync = !syncStatus?.lastSyncAt;

      // Sync issues
      infoLog(isFullSync ? 'Performing full sync...' : `Performing incremental sync since ${syncStatus.lastSyncAt}`);
      
      // Call API for sync
      const issuesResponse = await fetch(`/api/github/issues?owner=${config.owner}&repo=${config.repo}&forceSync=${isFullSync}`);
      if (!issuesResponse.ok) {
        throw new Error('Failed to fetch issues from GitHub');
      }

      const { issues, syncStatus: newSyncStatus } = await issuesResponse.json();

      // If incremental sync and no updates, return immediately
      if (!isFullSync && (!issues || issues.length === 0)) {
        infoLog('No updates found since last sync');
        // Record sync history
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

        // For incremental sync, merge existing and new issues
        let updatedIssues = issues || [];
        if (!isFullSync && prev.issues) {
          const existingIssues = new Map(prev.issues.map((issue: Issue) => [issue.number, issue]));
          issues.forEach((issue: Issue) => existingIssues.set(issue.number, issue));
          updatedIssues = Array.from(existingIssues.values());
        }

        // Clear all related caches
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

        // Set new cache
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
      
      // Record sync history
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
        // Get configuration
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

        // Check sync status
        const syncStatus = await checkSyncStatus(config.owner, config.repo);
        const needsSync = !syncStatus?.lastSyncAt;

        if (syncStatus?.lastSyncAt) {
          debugLog(`Last sync time: ${new Date(syncStatus.lastSyncAt).toLocaleString()}`);
        }

        // Get data from cache or database
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
          // If no cache, get from database
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

            // Update cache
            if (issues.length > 0) {
              debugLog('Updating cache with issues');
              cacheManager?.set(
                cacheKey,
                { issues },
                { expiry: CACHE_EXPIRY.ISSUES }
              );
            }
          }

          // If sync needed, trigger automatic sync
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