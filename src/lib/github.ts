import { GitHubConfig, Issue, Label } from '@/types/github';
import { getConfig, getIssues as getIssuesFromApi, checkSyncStatus } from '@/lib/supabase-client';
import { cacheManager, CACHE_KEYS, CACHE_EXPIRY } from '@/lib/cache';
import { BaseGitHubConfig } from '@/types/config';
import { getApiUrl } from './utils';
import { getServerConfig } from '@/lib/supabase-client';
import { ensureServer } from '@/lib/encryption';
import { debugLog, errorLog } from '@/lib/debug';

let config: GitHubConfig | null = null;

export function setConfig(newConfig: BaseGitHubConfig) {
  config = {
    ...newConfig,
    issuesPerPage: newConfig.issuesPerPage || 10
  };
  
  // Cache the config
  cacheManager?.set(
    CACHE_KEYS.CONFIG(config.owner, config.repo),
    config,
    { expiry: CACHE_EXPIRY.CONFIG }
  );
  
  debugLog('Using runtime config:', config);
}

export async function getGitHubConfig(): Promise<GitHubConfig> {
  try {
    // 1. Use runtime config first
    if (config) {
      debugLog('Using runtime config:', { 
        owner: config.owner, 
        repo: config.repo,
        issuesPerPage: config.issuesPerPage 
      });
      return config;
    }

    // 2. Get from cache/API
    const dbConfig = await getConfig();
    if (!dbConfig) {
      throw new Error('Failed to get GitHub configuration');
    }

    if (!dbConfig.owner || !dbConfig.repo) {
      throw new Error('Incomplete GitHub configuration. Please check your settings.');
    }

    const cacheKey = CACHE_KEYS.CONFIG(dbConfig.owner, dbConfig.repo);
    const cached = cacheManager?.get<GitHubConfig>(cacheKey);
    if (cached) {
      debugLog('Using cached config:', { 
        owner: cached.owner, 
        repo: cached.repo,
        issuesPerPage: cached.issuesPerPage 
      });
      config = cached;
      return cached;
    }
    
    // Create safe config without token
    const githubConfig: GitHubConfig = {
      owner: dbConfig.owner,
      repo: dbConfig.repo,
      issuesPerPage: dbConfig.issuesPerPage
    };

    debugLog('Created new GitHub config:', { 
      owner: githubConfig.owner, 
      repo: githubConfig.repo,
      issuesPerPage: githubConfig.issuesPerPage 
    });
    config = githubConfig;
    cacheManager?.set(cacheKey, githubConfig, { expiry: CACHE_EXPIRY.CONFIG });
    return githubConfig;
  } catch (error) {
    errorLog('Error in getGitHubConfig:', error);
    throw error;
  }
}

export async function checkNeedsSync(owner: string, repo: string, forceSync: boolean): Promise<boolean> {
  // If force sync is requested, return true
  if (forceSync) return true;

  // Check sync status directly from the database
  const syncStatus = await checkSyncStatus(owner, repo);
  return syncStatus?.needsSync ?? true;
}

// Helper function to verify GitHub token validity
export async function getToken(): Promise<string | null> {
  ensureServer(); // Ensure this function only runs on the server
  try {
    const response = await fetch(getApiUrl('/api/github/token'));
    if (!response.ok) {
      throw new Error('Failed to validate token');
    }
    const data = await response.json();
    if (!data.isValid) {
      throw new Error('Invalid GitHub token');
    }
    
    // Get token from server config
    const config = await getServerConfig();
    return config?.token || null;
  } catch (error) {
    errorLog('Error validating token:', error);
    return null;
  }
}

export async function getIssues(owner: string, repo: string): Promise<Issue[] | null> {
  try {
    const params = new URLSearchParams({
      owner,
      repo
    });
    const response = await fetch(getApiUrl(`/api/github/issues?${params}`), {
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to fetch issues: ${response.statusText}${
          errorData.error ? ` - ${errorData.error}` : ''
        }`
      );
    }

    const data = await response.json();
    // API returns { issues: Issue[], syncStatus?: { success: boolean, totalSynced: number } }
    return data.issues || [];
  } catch (error) {
    errorLog('Error fetching issues:', error);
    return null;
  }
}

// Add this before getIssue function
const issueRequestLocks: Record<string, {
  promise: Promise<Issue>;
  timestamp: number;
  requestId: string;
}> = {};

const REQUEST_TIMEOUT = 10000; // 10 seconds

function getSingleIssueCacheKey(owner: string, repo: string, issueNumber: number): string {
  return `issue:${owner}:${repo}:${issueNumber}`;
}

let requestCounter = 0;
function getNextRequestId() {
  return `req_${++requestCounter}`;
}

export async function getIssue(issueNumber: number, forceSync: boolean = false): Promise<Issue> {
  const config = await getGitHubConfig();
  const lockKey = getSingleIssueCacheKey(config.owner, config.repo, issueNumber);
  
  // Clean up stale requests
  const now = Date.now();
  Object.entries(issueRequestLocks).forEach(([key, lock]) => {
    if (now - lock.timestamp > REQUEST_TIMEOUT) {
      delete issueRequestLocks[key];
    }
  });

  // Check for existing valid request
  const existingRequest = issueRequestLocks[lockKey];
  if (existingRequest && now - existingRequest.timestamp < REQUEST_TIMEOUT) {
    return existingRequest.promise;
  }

  const requestId = getNextRequestId();
  debugLog(`[${requestId}] Getting issue #${issueNumber}`);

  const promise = (async () => {
    try {
      // Check cache first if not forcing sync
      if (!forceSync) {
        const cached = cacheManager?.get<Issue>(lockKey);
        if (cached) {
          return cached;
        }
      }

      // Try to get from database first
      debugLog('Trying to find issue in database...');
      const response = await getIssuesFromApi(config.owner, config.repo);
      const issues = response?.issues || [];
      const issueFromDb = issues.find((issue: Issue) => issue.number === issueNumber);
      
      if (issueFromDb) {
        debugLog('Found issue in database');
        // Update cache
        cacheManager?.set(lockKey, issueFromDb, { expiry: CACHE_EXPIRY.ISSUES });
        return issueFromDb;
      }

      // If not in database or force sync, get from GitHub API
      debugLog('Getting issue from GitHub API...');
      const apiResponse = await fetch(`/api/github/issues/${issueNumber}`);
      if (!apiResponse.ok) {
        const errorData = await apiResponse.json().catch(() => ({}));
        throw new Error(
          `GitHub API request failed: ${apiResponse.statusText}${
            errorData.error ? ` - ${errorData.error}` : ''
          }`
        );
      }
      
      const issue = await apiResponse.json();
      
      // Update cache
      cacheManager?.set(lockKey, issue, { expiry: CACHE_EXPIRY.ISSUES });
      
      return issue;
    } catch (error) {
      errorLog(`[${requestId}] Failed to get issue:`, error);
      throw error;
    } finally {
      delete issueRequestLocks[lockKey];
    }
  })();

  // Record request
  issueRequestLocks[lockKey] = {
    promise,
    timestamp: now,
    requestId
  };

  return promise;
}

export async function createIssue(owner: string, repo: string, issue: Partial<Issue>): Promise<Issue | null> {
  try {
    const response = await fetch(getApiUrl('/api/github/issues'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ owner, repo, issue }),
    });

    if (!response.ok) {
      throw new Error('Failed to create issue');
    }

    return await response.json();
  } catch (error) {
    errorLog('Error creating issue:', error);
    return null;
  }
}

export async function updateIssue(
  issueNumber: number,
  title: string,
  body: string,
  labels: string[]
): Promise<Issue> {
  // Check if token is valid
  const isTokenValid = await getToken();
  if (!isTokenValid) {
    throw new Error('Invalid or missing GitHub token');
  }

  try {
    const response = await fetch('/api/github/issues', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: issueNumber,
        title,
        body,
        labels
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to update issue');
    }

    return await response.json();
  } catch (error) {
    errorLog('Error updating issue:', error);
    throw error;
  }
}

export async function getLabels(): Promise<Label[] | null> {
  try {
    const response = await fetch(getApiUrl('/api/github/labels'));
    if (!response.ok) {
      throw new Error('Failed to fetch labels');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    errorLog('Error fetching labels:', error);
    return null;
  }
}

export async function createLabel(owner: string, repo: string, label: Label): Promise<boolean> {
  try {
    const response = await fetch(getApiUrl('/api/github/labels'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ owner, repo, label }),
    });

    if (!response.ok) {
      throw new Error('Failed to create label');
    }

    return true;
  } catch (error) {
    errorLog('Error creating label:', error);
    return false;
  }
}