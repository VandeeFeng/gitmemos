import { GitHubConfig, Issue, Label } from '@/types/github';
import { getConfig, saveConfig, getIssues as getIssuesFromApi, checkSyncStatus, recordSync, getLabels as getLabelsFromDb, saveLabel, saveIssue } from '@/lib/api';
import { cacheManager, CACHE_KEYS, CACHE_EXPIRY } from '@/lib/cache';
import { Octokit } from 'octokit';
import { toGitHubConfig, toDbConfig } from '@/types/config';

let config: GitHubConfig | null = null;

export async function setGitHubConfig(newConfig: GitHubConfig) {
  config = newConfig;
  // Save to database via API
  const dbConfig = toDbConfig(newConfig, process.env.GITHUB_TOKEN);
  await saveConfig(dbConfig);
  // Update cache
  cacheManager?.set(
    CACHE_KEYS.CONFIG(newConfig.owner, newConfig.repo),
    newConfig,
    { expiry: CACHE_EXPIRY.CONFIG }
  );
}

export async function getGitHubConfig(): Promise<GitHubConfig> {
  try {
    // 1. Use runtime config first
    if (config) {
      console.log('Using runtime config:', { 
        owner: config.owner, 
        repo: config.repo,
        issuesPerPage: config.issuesPerPage 
      });
      return config;
    }

    // 2. Get from cache/API
    const dbConfig = await getConfig();
    if (dbConfig) {
      const safeConfig = toGitHubConfig(dbConfig);
      console.log('Got config from API:', { 
        owner: safeConfig.owner, 
        repo: safeConfig.repo,
        issuesPerPage: safeConfig.issuesPerPage 
      });
    } else {
      console.log('Got config from API: null');
    }
    
    if (!dbConfig) {
      throw new Error('Failed to get GitHub configuration');
    }

    if (!dbConfig.owner || !dbConfig.repo) {
      throw new Error('Incomplete GitHub configuration. Please check your settings.');
    }

    const cacheKey = CACHE_KEYS.CONFIG(dbConfig.owner, dbConfig.repo);
    const cached = cacheManager?.get<GitHubConfig>(cacheKey);
    if (cached) {
      console.log('Using cached config:', { 
        owner: cached.owner, 
        repo: cached.repo,
        issuesPerPage: cached.issuesPerPage 
      });
      config = cached;
      return cached;
    }
    
    const githubConfig = toGitHubConfig(dbConfig);
    console.log('Created new GitHub config:', { 
      owner: githubConfig.owner, 
      repo: githubConfig.repo,
      issuesPerPage: githubConfig.issuesPerPage 
    });
    config = githubConfig;
    cacheManager?.set(cacheKey, githubConfig, { expiry: CACHE_EXPIRY.CONFIG });
    return githubConfig;
  } catch (error) {
    console.error('Error in getGitHubConfig:', error);
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

// Helper function to get GitHub token from environment or database
export async function getGitHubToken(): Promise<string> {
  try {
    const response = await fetch('/api/github/token');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to get GitHub token');
    }

    if (!data.token) {
      throw new Error('GitHub token not found');
    }

    return data.token;
  } catch {
    throw new Error('Failed to get GitHub token');
  }
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

  // Get token from environment or database
  const token = await getGitHubToken();

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
    const cached = cacheManager?.get<{ issues: Issue[] }>(cacheKey);
    
    console.log('Cache data:', cached);
    
    if (cached?.issues && Array.isArray(cached.issues)) {
      console.log('Using cached issues:', { count: cached.issues.length });
      return {
        issues: cached.issues,
        syncStatus: null
      };
    } else {
      console.log('Invalid cache data, fetching from database...');
    }

    // Only check database when cache is empty (first load or expired cache)
    console.log('Cache miss, checking database...');
    const response = await getIssuesFromApi(config.owner, config.repo, page, labels ? [labels] : undefined);
    const dbIssues = response?.issues || [];
    
    if (dbIssues.length > 0) {
      console.log('Found data in database:', { count: dbIssues.length });
      cacheManager?.set(cacheKey, { issues: dbIssues }, { expiry: CACHE_EXPIRY.ISSUES });
      return {
        issues: dbIssues,
        syncStatus: null
      };
    } else {
      console.log('No issues found in database');
    }
  }

  // Create new request
  const requestId = getNextRequestId();
  console.log(`Creating new request ${requestId} for page ${page}`);

  const promise = (async () => {
    try {
      // Check if GitHub API sync is needed
      const needsGitHubSync = await checkNeedsSync(config.owner, config.repo, forceSync);

      if (needsGitHubSync || forceSync) {
        console.log(`[${requestId}] Syncing with GitHub...`);
        try {
          const octokit = new Octokit({ auth: token });

          // 获取上次成功同步的时间
          const syncStatus = await checkSyncStatus(config.owner, config.repo);
          const lastSyncAt = syncStatus?.lastSyncAt;
          
          // 如果是增量同步且有上次同步时间，使用since参数
          const params: Parameters<typeof octokit.rest.issues.listForRepo>[0] = {
            owner: config.owner,
            repo: config.repo,
            state: 'all',
            per_page: 100,
            page,
            sort: 'updated',
            direction: 'desc'
          };
          
          if (!forceSync && lastSyncAt && !labels) {
            params.since = lastSyncAt;
            console.log(`[${requestId}] Performing incremental sync since ${lastSyncAt}`);
          } else {
            console.log(`[${requestId}] Performing full sync`);
          }

          if (labels) {
            params.labels = labels;
          }

          const { data: githubIssues } = await octokit.rest.issues.listForRepo(params);
          
          // 将GitHub API响应映射到我们的Issue类型
          const issues = githubIssues.map(issue => ({
            number: issue.number,
            title: issue.title,
            body: issue.body || '',
            created_at: issue.created_at,
            github_created_at: issue.created_at,
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
          
          // 增量同步时，如果没有更新的内容，直接返回
          const isIncrementalSync = !forceSync && lastSyncAt && !labels;
          if (isIncrementalSync && issues.length === 0) {
            console.log(`[${requestId}] No updates found since last sync`);
            await recordSync(
              config.owner,
              config.repo,
              'success',
              0,
              undefined,
              'add'
            );
            return {
              issues: [],
              syncStatus: {
                success: true,
                totalSynced: 0,
                lastSyncAt: new Date().toISOString()
              }
            };
          }
          
          // 更新缓存
          const cacheKey = CACHE_KEYS.ISSUES(config.owner, config.repo, page, labels || '');
          cacheManager?.set(cacheKey, { issues }, { expiry: CACHE_EXPIRY.ISSUES });

          // 记录同步状态
          await recordSync(
            config.owner, 
            config.repo, 
            'success', 
            issues.length,
            undefined,
            forceSync ? 'full' : 'add'
          );

          return {
            issues,
            syncStatus: {
              success: true,
              totalSynced: issues.length,
              lastSyncAt: new Date().toISOString()
            }
          };
        } catch (err) {
          console.error(`[${requestId}] Error syncing with GitHub:`, err);
          throw err;
        }
      }

      // Get data from database via API
      console.log(`[${requestId}] Loading data from database...`);
      const response = await getIssuesFromApi(config.owner, config.repo, page, labels ? [labels] : undefined);
      if (!response) {
        throw new Error('Failed to fetch issues from database');
      }
      const issues = response.issues || [];
      const syncStatus = await checkSyncStatus(config.owner, config.repo);
      
      // Update cache with database data
      if (issues.length > 0) {
        const cacheKey = CACHE_KEYS.ISSUES(config.owner, config.repo, page, labels || '');
        cacheManager?.set(cacheKey, { issues }, { expiry: CACHE_EXPIRY.ISSUES });
        console.log(`[${requestId}] Updated cache with database data`);
      }
      
      return { 
        issues,
        syncStatus: syncStatus ? {
          success: true,
          totalSynced: syncStatus.issuesSynced || 0,
          lastSyncAt: syncStatus.lastSyncAt || new Date().toISOString()
        } : null
      };
    } catch (err) {
      console.error(`[${requestId}] Error in getIssues:`, err);
      throw err;
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
  const config = await getGitHubConfig();
  const token = await getGitHubToken();

  try {
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.issues.create({
      owner: config.owner,
      repo: config.repo,
      title,
      body,
      labels
    });

    const issue: Issue = {
      number: data.number,
      title: data.title,
      body: data.body || '',
      created_at: data.created_at,
      github_created_at: data.created_at,
      state: data.state,
      labels: data.labels
        .filter((label): label is { id: number; name: string; color: string; description: string | null } => 
          typeof label === 'object' && label !== null)
        .map(label => ({
          id: label.id,
          name: label.name,
          color: label.color,
          description: label.description,
        }))
    };

    // Sync to database
    await saveIssue(config.owner, config.repo, issue);
    console.log('Issue created successfully:', { number: issue.number, title: issue.title });
    
    return issue;
  } catch (err) {
    console.error('Error creating issue:', err);
    throw err;
  }
}

export async function updateIssue(
  issueNumber: number,
  title: string,
  body: string,
  labels: string[]
): Promise<Issue> {
  const config = await getGitHubConfig();
  const token = await getGitHubToken();

  try {
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.issues.update({
      owner: config.owner,
      repo: config.repo,
      issue_number: issueNumber,
      title,
      body,
      labels
    });

    const issue: Issue = {
      number: data.number,
      title: data.title,
      body: data.body || '',
      created_at: data.created_at,
      github_created_at: data.created_at,
      state: data.state,
      labels: data.labels
        .filter((label): label is { id: number; name: string; color: string; description: string | null } => 
          typeof label === 'object' && label !== null)
        .map(label => ({
          id: label.id,
          name: label.name,
          color: label.color,
          description: label.description,
        }))
    };

    // Sync to database
    await saveIssue(config.owner, config.repo, issue);
    console.log('Issue updated successfully:', { number: issue.number, title: issue.title });
    
    return issue;
  } catch (err) {
    console.error('Error updating issue:', err);
    throw err;
  }
}

export async function getLabels(forceSync: boolean = false): Promise<Label[]> {
  const config = await getGitHubConfig();
  const token = await getGitHubToken();

  if (!config.owner || !config.repo) {
    throw new Error('Missing owner or repo in config');
  }

  if (!token) {
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
    } catch (err) {
      console.warn('Failed to check database for labels:', err);
    }
  }

  try {
    console.log('Fetching labels from GitHub API...');
    const octokit = new Octokit({ auth: token });
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
  } catch (err) {
    console.error('Error fetching labels:', err);
    throw err;
  }
}

export async function createLabel(name: string, color: string, description?: string): Promise<Label> {
  const config = await getGitHubConfig();
  const token = await getGitHubToken();

  try {
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.rest.issues.createLabel({
      owner: config.owner,
      repo: config.repo,
      name,
      color,
      description
    });

    return {
      id: data.id,
      name: data.name,
      color: data.color,
      description: data.description,
    };
  } catch (err) {
    console.error('Error creating label:', err);
    throw err;
  }
}