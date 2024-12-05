import { GitHubConfig, Issue, Label } from '@/types/github';
import { 
  getConfig, 
  saveConfig,
  getIssuesFromDb, 
  shouldSync,
  getLastSyncHistory,
  recordSyncHistory
} from './db';
import { cacheManager, CACHE_KEYS, CACHE_EXPIRY } from '@/lib/cache';

let config: GitHubConfig | null = null;

export async function setGitHubConfig(newConfig: GitHubConfig) {
  config = newConfig;
  // 保存到数据库
  await saveConfig(newConfig);
  // 更新缓存
  cacheManager?.set(
    CACHE_KEYS.CONFIG(newConfig.owner, newConfig.repo),
    newConfig,
    { expiry: CACHE_EXPIRY.CONFIG }
  );
}

export async function getGitHubConfig(): Promise<GitHubConfig> {
  // 1. 优先使用运行时配置
  if (config) {
    return config;
  }

  // 2. 从缓存获取
  const dbConfig = await getConfig();
  if (dbConfig) {
    const cacheKey = CACHE_KEYS.CONFIG(dbConfig.owner, dbConfig.repo);
    const cached = cacheManager?.get<GitHubConfig>(cacheKey);
    if (cached) {
      config = cached;
      return cached;
    }
    
    config = dbConfig;
    cacheManager?.set(cacheKey, dbConfig, { expiry: CACHE_EXPIRY.CONFIG });
    return dbConfig;
  }

  // 3. 如果都没有，返回空配置
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
    const needsSync = await shouldSync(owner, repo);
    const data: SyncCheckData = {
      needsSync,
      isInitialLoad: false
    };
    cacheManager?.set(cacheKey, data, { expiry: CACHE_EXPIRY.SYNC_CHECK });
    return needsSync;
  }

  return cached.needsSync;
}

// 添加请求追踪
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

// 优化后的获取issues函数
export async function getIssues(
  page: number = 1, 
  labels?: string, 
  forceSync: boolean = false,
  existingConfig?: GitHubConfig // 添加可选的配置参数
) {
  const config = existingConfig || await getGitHubConfig();
  const lockKey = getRequestLockKey(config.owner, config.repo, page, labels);

  // 清理过期请求
  cleanupStaleRequests();

  // 检查是否有正在进行的有效请求
  const existingRequest = requestLocks[lockKey];
  if (existingRequest && Date.now() - existingRequest.timestamp < REQUEST_TIMEOUT) {
    if (!existingRequest.loggedReuse) {
      console.log(`Reusing request ${existingRequest.requestId} for page ${page}`);
      existingRequest.loggedReuse = true;
    }
    return existingRequest.promise;
  }

  // 如果不是强制同步，先检查缓存
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

  // 创建新的请求
  const requestId = getNextRequestId();
  console.log(`Creating new request ${requestId} for page ${page}`);

  const promise = (async () => {
    try {
      // 检查是否需要从 GitHub API 同步
      const needsGitHubSync = await shouldSync(config.owner, config.repo, forceSync);

      if (needsGitHubSync) {
        try {
          console.log(`[${requestId}] Starting GitHub API sync...`);
          
          // 使用新的 API 路由
          const response = await fetch(`/api/github/issues?page=${page}${labels ? `&labels=${labels}` : ''}`);
          if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
          }
          
          const issues = await response.json();

          // 更新缓存
          const cacheKey = CACHE_KEYS.ISSUES(config.owner, config.repo, page, labels || '');
          cacheManager?.set(cacheKey, issues, { expiry: CACHE_EXPIRY.ISSUES });

          return {
            issues,
            syncStatus: {
              success: true,
              totalSynced: issues.length,
              lastSyncAt: new Date().toISOString()
            }
          };
        } catch (error) {
          console.error(`[${requestId}] GitHub API sync failed:`, error);
          // 记录同步失败
          await recordSyncHistory(
            config.owner,
            config.repo,
            'failed',
            0,
            error instanceof Error ? error.message : 'Unknown error'
          );
          throw error;
        }
      }

      // 从数据库获取数据
      console.log(`[${requestId}] Loading data from database...`);
      const issues = await getIssuesFromDb(
        config.owner,
        config.repo,
        page,
        labels ? [labels] : undefined
      );

      const lastSync = await getLastSyncHistory(config.owner, config.repo);
      
      // 不再设置缓存，因为 getIssuesFromDb 已经设置了缓存
      return { 
        issues,
        syncStatus: lastSync ? {
          success: true,
          totalSynced: lastSync.issues_synced,
          lastSyncAt: lastSync.last_sync_at
        } : null
      };
    } finally {
      delete requestLocks[lockKey];
    }
  })();

  // 记录请求
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

export async function getIssue(issueNumber: number, forceSync: boolean = false): Promise<Issue> {
  const config = await getGitHubConfig();
  const lockKey = `issue:${config.owner}:${config.repo}:${issueNumber}`;
  
  // Clean up stale requests
  const now = Date.now();
  Object.entries(issueRequestLocks).forEach(([key, lock]) => {
    if (now - lock.timestamp > REQUEST_TIMEOUT) {
      delete issueRequestLocks[key];
    }
  });

  // Check for existing request
  const existingRequest = issueRequestLocks[lockKey];
  if (existingRequest && now - existingRequest.timestamp < REQUEST_TIMEOUT) {
    console.log(`Reusing request ${existingRequest.requestId} for issue ${issueNumber}`);
    return existingRequest.promise;
  }

  // If not force sync, first try to find the issue in the existing issues cache
  if (!forceSync) {
    // First check the issues list cache
    const issuesListCacheKey = CACHE_KEYS.ISSUES(config.owner, config.repo, 1, '');
    const cachedData = cacheManager?.get<{ issues: Issue[] }>(issuesListCacheKey);
    if (cachedData?.issues) {
      console.log('Checking issues list cache:', { cachedData });
      const issueFromList = cachedData.issues.find(issue => issue.number === issueNumber);
      if (issueFromList) {
        console.log('Found issue in issues list cache');
        return issueFromList;
      }
    }

    // Then check the individual issue cache
    const singleIssueCacheKey = `issue:${config.owner}:${config.repo}:${issueNumber}`;
    const cachedSingleIssue = cacheManager?.get<Issue>(singleIssueCacheKey);
    if (cachedSingleIssue) {
      console.log('Using cached single issue data');
      return cachedSingleIssue;
    }

    // Try to find in database
    try {
      console.log('Trying to find issue in database...');
      const issues = await getIssuesFromDb(config.owner, config.repo);
      const issueFromDb = issues.find(issue => issue.number === issueNumber);
      if (issueFromDb) {
        console.log('Found issue in database');
        // Update cache
        const cacheKey = `issue:${config.owner}:${config.repo}:${issueNumber}`;
        cacheManager?.set(cacheKey, issueFromDb, { expiry: CACHE_EXPIRY.ISSUES });
        return issueFromDb;
      }
    } catch (error) {
      console.warn('Failed to check database for issue:', error);
    }
  }

  const requestId = getNextRequestId();
  console.log(`Creating new request ${requestId} for issue ${issueNumber}`);

  const promise = (async () => {
    try {
      const response = await fetch(`/api/github/issues?number=${issueNumber}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch issue: ${response.statusText}`);
      }

      const data = await response.json();
      // API 返回的可能是数组，我们需要找到匹配的 issue
      const issue = Array.isArray(data) ? data.find(i => i.number === issueNumber) : data;
      
      if (!issue) {
        throw new Error(`Issue #${issueNumber} not found`);
      }

      // Update both caches
      const singleIssueCacheKey = `issue:${config.owner}:${config.repo}:${issueNumber}`;
      cacheManager?.set(singleIssueCacheKey, issue, { expiry: CACHE_EXPIRY.ISSUES });

      // Also update the issues list cache if it exists
      const issuesListCacheKey = CACHE_KEYS.ISSUES(config.owner, config.repo, 1, '');
      const existingIssuesList = cacheManager?.get<{ issues: Issue[] }>(issuesListCacheKey);
      if (existingIssuesList?.issues) {
        const updatedIssues = existingIssuesList.issues.map(i => 
          i.number === issue.number ? issue : i
        );
        cacheManager?.set(issuesListCacheKey, { issues: updatedIssues }, { expiry: CACHE_EXPIRY.ISSUES });
      }

      return issue;
    } finally {
      delete issueRequestLocks[lockKey];
    }
  })();

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

  // 如果强制同步，先���查缓存
  if (!forceSync) {
    const cacheKey = CACHE_KEYS.LABELS(config.owner, config.repo);
    const cached = cacheManager?.get<Label[]>(cacheKey);
    if (cached) {
      console.log('Using cached labels data');
      return cached;
    }
  }

  try {
    // 使用新的 API 路由获取标签
    const response = await fetch('/api/github/labels');
    if (!response.ok) {
      throw new Error(`Failed to fetch labels: ${response.statusText}`);
    }

    const labels = await response.json();

    // 更新缓存
    const cacheKey = CACHE_KEYS.LABELS(config.owner, config.repo);
    cacheManager?.set(cacheKey, labels, { expiry: CACHE_EXPIRY.LABELS });

    return labels;
  } catch (error) {
    console.error('Error fetching labels:', error);
    throw error;
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