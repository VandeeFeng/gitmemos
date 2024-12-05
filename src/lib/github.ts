import { GitHubConfig, Issue, Label, DbConfig, GitHubApiError } from '@/types/github';
import { getConfig, saveConfig, getIssues as getIssuesFromApi, checkSyncStatus, recordSync, getLabels as getLabelsFromDb, saveLabel } from '@/lib/api';
import { cacheManager, CACHE_KEYS, CACHE_EXPIRY } from '@/lib/cache';
import { Octokit } from 'octokit';

let config: GitHubConfig | null = null;

function convertDbConfigToGitHubConfig(dbConfig: DbConfig): GitHubConfig {
  return {
    owner: dbConfig.owner,
    repo: dbConfig.repo,
    token: dbConfig.token,
    issuesPerPage: dbConfig.issues_per_page
  };
}

function convertGitHubConfigToDbConfig(githubConfig: GitHubConfig): DbConfig {
  return {
    owner: githubConfig.owner,
    repo: githubConfig.repo,
    token: githubConfig.token,
    issues_per_page: githubConfig.issuesPerPage
  };
}

export async function setGitHubConfig(newConfig: GitHubConfig) {
  config = newConfig;
  // Save to database via API
  await saveConfig(convertGitHubConfigToDbConfig(newConfig));
  // Update cache
  cacheManager?.set(
    CACHE_KEYS.CONFIG(newConfig.owner, newConfig.repo),
    newConfig,
    { expiry: CACHE_EXPIRY.CONFIG }
  );
}

export async function getGitHubConfig(): Promise<GitHubConfig> {
  // 1. Use runtime config first
  if (config) {
    return config;
  }

  // 2. Get from cache/API
  const dbConfig = await getConfig();
  if (dbConfig) {
    const cacheKey = CACHE_KEYS.CONFIG(dbConfig.owner, dbConfig.repo);
    const cached = cacheManager?.get<GitHubConfig>(cacheKey);
    if (cached) {
      config = cached;
      return cached;
    }
    
    const githubConfig = convertDbConfigToGitHubConfig(dbConfig);
    config = githubConfig;
    cacheManager?.set(cacheKey, githubConfig, { expiry: CACHE_EXPIRY.CONFIG });
    return githubConfig;
  }

  // 3. Return empty config if none found
  return {
    owner: '',
    repo: '',
    token: '',
    issuesPerPage: 10
  };
}

interface SyncCheckData {
  needsSync: boolean;
  isInitialLoad: boolean;
}

export async function checkNeedsSync(owner: string, repo: string, forceSync: boolean): Promise<boolean> {
  // If force sync is requested, return true
  if (forceSync) return true;

  const cacheKey = CACHE_KEYS.SYNC_CHECK(owner, repo);
  const cached = cacheManager?.get<SyncCheckData>(cacheKey);

  // If this is the first load or no cache, check sync status
  if (!cached || cached.isInitialLoad) {
    const syncStatus = await checkSyncStatus(owner, repo);
    const needsSync = syncStatus?.needsSync ?? true;
    const data: SyncCheckData = {
      needsSync,
      isInitialLoad: false
    };
    cacheManager?.set(cacheKey, data, { expiry: CACHE_EXPIRY.SYNC_CHECK });
    return needsSync;
  }

  return cached.needsSync;
}

// Request tracking
interface RequestTracker {
  promise: Promise<{
    issues: Issue[];
    syncStatus: {
      success: boolean;
      totalSynced: number;
      lastSyncAt: string;
    } | null;
  }>;
  timestamp: number;
  requestId: string;
  loggedReuse?: boolean;
}

const requestLocks: Record<string, RequestTracker> = {};
const REQUEST_TIMEOUT = 10000; // 10 seconds

function getRequestLockKey(owner: string, repo: string, page: number, labels?: string) {
  return `${owner}:${repo}:${page}:${labels || ''}`;
}

function cleanupStaleRequests() {
  const now = Date.now();
  Object.entries(requestLocks).forEach(([key, tracker]) => {
    if (now - tracker.timestamp > REQUEST_TIMEOUT) {
      console.log(`Cleaning up stale request ${tracker.requestId}`);
      delete requestLocks[key];
    }
  });
}

let requestCounter = 0;
function getNextRequestId() {
  return `req_${++requestCounter}`;
}

// Optimized getIssues function
export async function getIssues(
  page: number = 1, 
  labels?: string, 
  forceSync: boolean = false,
  existingConfig?: GitHubConfig
) {
  const config = existingConfig || await getGitHubConfig();

  if (!config.owner || !config.repo) {
    throw new Error('Missing owner or repo in config');
  }

  if (!config.token) {
    throw new Error('GitHub token is missing');
  }

  const lockKey = getRequestLockKey(config.owner, config.repo, page, labels);

  // Clean up stale requests
  cleanupStaleRequests();

  // Check for existing valid request
  const existingRequest = requestLocks[lockKey];
  if (existingRequest && Date.now() - existingRequest.timestamp < REQUEST_TIMEOUT) {
    if (!existingRequest.loggedReuse) {
      console.log(`Reusing request ${existingRequest.requestId} for page ${page}`);
      existingRequest.loggedReuse = true;
    }
    return existingRequest.promise;
  }

  // If not force sync, check cache
  if (!forceSync) {
    const cacheKey = CACHE_KEYS.ISSUES(config.owner, config.repo, page, labels || '');
    const cached = cacheManager?.get<Issue[]>(cacheKey);
    if (cached) {
      return {
        issues: cached,
        syncStatus: null
      };
    }
  }

  // Create new request
  const requestId = getNextRequestId();
  console.log(`Creating new request ${requestId} for page ${page}`);

  const promise = (async () => {
    try {
      // Check if GitHub API sync is needed
      const needsGitHubSync = await checkNeedsSync(config.owner, config.repo, forceSync);

      if (needsGitHubSync) {
        try {
          console.log(`[${requestId}] Starting GitHub API sync...`);
          
          // Use Octokit for GitHub API calls
          const octokit = new Octokit({ auth: config.token });
          const { data } = await octokit.rest.issues.listForRepo({
            owner: config.owner,
            repo: config.repo,
            state: 'all',
            per_page: config.issuesPerPage || 50,
            page,
            sort: 'created',
            direction: 'desc',
            labels: labels || undefined
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

          // Update cache
          const cacheKey = CACHE_KEYS.ISSUES(config.owner, config.repo, page, labels || '');
          cacheManager?.set(cacheKey, issues, { expiry: CACHE_EXPIRY.ISSUES });

          // Record successful sync
          await recordSync(config.owner, config.repo, 'success', issues.length);

          return {
            issues,
            syncStatus: {
              success: true,
              totalSynced: issues.length,
              lastSyncAt: new Date().toISOString()
            }
          };
        } catch (error) {
          console.error(`[${requestId}] GitHub API sync failed:`, (error as GitHubApiError).response?.data || error);
          
          // Record failed sync
          await recordSync(
            config.owner, 
            config.repo, 
            'failed',
            0,
            (error as GitHubApiError).response?.data?.message || (error as Error).message
          );
          
          throw new Error(
            `GitHub API sync failed: ${(error as GitHubApiError).response?.data?.message || (error as Error).message}`
          );
        }
      }

      // Get data from database via API
      console.log(`[${requestId}] Loading data from database...`);
      const response = await getIssuesFromApi(config.owner, config.repo, page, labels ? [labels] : undefined);
      const issues = response?.issues || [];
      const syncStatus = await checkSyncStatus(config.owner, config.repo);
      
      return { 
        issues,
        syncStatus: syncStatus ? {
          success: true,
          totalSynced: syncStatus.issuesSynced || 0,
          lastSyncAt: syncStatus.lastSyncAt || new Date().toISOString()
        } : null
      };
    } finally {
      delete requestLocks[lockKey];
    }
  })();

  // Record request
  requestLocks[lockKey] = {
    promise,
    timestamp: Date.now(),
    requestId
  };

  return promise;
}

// Add this before getIssue function
const issueRequestLocks: Record<string, {
  promise: Promise<Issue>;
  timestamp: number;
  requestId: string;
}> = {};

function getSingleIssueCacheKey(owner: string, repo: string, issueNumber: number): string {
  return `issue:${owner}:${repo}:${issueNumber}`;
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
  console.log(`[${requestId}] Getting issue #${issueNumber}`);

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
      console.log('Trying to find issue in database...');
      const response = await getIssuesFromApi(config.owner, config.repo);
      const issues = response?.issues || [];
      const issueFromDb = issues.find((issue: Issue) => issue.number === issueNumber);
      
      if (issueFromDb) {
        console.log('Found issue in database');
        // Update cache
        cacheManager?.set(lockKey, issueFromDb, { expiry: CACHE_EXPIRY.ISSUES });
        return issueFromDb;
      }

      // If not in database or force sync, get from GitHub API
      console.log('Getting issue from GitHub API...');
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
      console.error(`[${requestId}] Failed to get issue:`, error);
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

export async function createIssue(title: string, body: string, labels: string[]): Promise<Issue> {
  const response = await fetch('/api/github/issues', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, body, labels }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create issue: ${response.statusText}`);
  }

  return response.json();
}

export async function updateIssue(
  issueNumber: number,
  title: string,
  body: string,
  labels: string[]
): Promise<Issue> {
  const response = await fetch('/api/github/issues', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ number: issueNumber, title, body, labels }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update issue: ${response.statusText}`);
  }

  return response.json();
}

export async function getLabels(forceSync: boolean = false): Promise<Label[]> {
  const config = await getGitHubConfig();

  if (!config.owner || !config.repo) {
    throw new Error('Missing owner or repo in config');
  }

  if (!config.token) {
    throw new Error('GitHub token is missing');
  }

  // If not force sync, check cache first
  if (!forceSync) {
    const cacheKey = CACHE_KEYS.LABELS(config.owner, config.repo);
    const cached = cacheManager?.get<Label[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Then check database
    try {
      console.log('Trying to find labels in database...');
      const dbLabels = await getLabelsFromDb(config.owner, config.repo);
      if (dbLabels && dbLabels.length > 0) {
        console.log('Found labels in database');
        // Update cache
        cacheManager?.set(cacheKey, dbLabels, { expiry: CACHE_EXPIRY.LABELS });
        return dbLabels;
      }
    } catch (error) {
      console.warn('Failed to check database for labels:', error);
    }
  }

  try {
    console.log('Fetching labels from GitHub API...');
    const octokit = new Octokit({ auth: config.token });
    const { data } = await octokit.rest.issues.listLabelsForRepo({
      owner: config.owner,
      repo: config.repo,
    });

    const labels = data.map(label => ({
      id: label.id,
      name: label.name,
      color: label.color,
      description: label.description,
    }));

    // Update cache
    const cacheKey = CACHE_KEYS.LABELS(config.owner, config.repo);
    cacheManager?.set(cacheKey, labels, { expiry: CACHE_EXPIRY.LABELS });

    // Save to database
    for (const label of labels) {
      await saveLabel(config.owner, config.repo, label);
    }

    return labels;
  } catch (error) {
    console.error('GitHub API error:', (error as GitHubApiError).response?.data || error);
    throw new Error(
      `Failed to fetch labels: ${(error as GitHubApiError).response?.data?.message || (error as Error).message}`
    );
  }
}

export async function createLabel(name: string, color: string, description?: string): Promise<Label> {
  const response = await fetch('/api/github/labels', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, color, description }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create label: ${response.statusText}`);
  }

  return response.json();
}