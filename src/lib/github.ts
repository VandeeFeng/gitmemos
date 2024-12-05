import { Octokit } from "octokit";
import { GitHubConfig, Issue, Label } from '@/types/github';
import { 
  getConfig, 
  saveConfig, 
  getIssuesFromDb, 
  getLabelsFromDb, 
  syncIssuesData,
  shouldSync,
  getLastSyncHistory,
  checkSyncStatus,
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

// 创建一个全局的 Octokit 实例
let octokit: Octokit;

export async function getOctokit(): Promise<Octokit> {
  if (!octokit) {
    const config = await getGitHubConfig();
    if (!config.token) {
      throw new Error('GitHub token is missing');
    }

    octokit = new Octokit({
      auth: config.token
    });
  }
  return octokit;
}

interface SyncCheckData {
  needsSync: boolean;
  isInitialLoad: boolean;
}

async function checkNeedsSync(owner: string, repo: string, forceSync: boolean): Promise<boolean> {
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

const PAGE_SIZE = 50;

// 优化后的获取issues函数
export async function getIssues(page: number = 1, labels?: string, forceSync: boolean = false) {
  const config = await getGitHubConfig();
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

  // 如果不是强制同步，先检查存
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
          const client = await getOctokit();
          
          // 从 GitHub API 获取数据
          const { data } = await client.rest.issues.listForRepo({
            owner: config.owner,
            repo: config.repo,
            state: 'all',
            per_page: PAGE_SIZE,
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
              })),
          }));

          // 同步到数据库
          if (issues.length > 0) {
            await syncIssuesData(config.owner, config.repo, issues);
            console.log(`[${requestId}] Synced ${issues.length} issues to database`);
          }

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

      // 从数据库获取数据（会自动处理缓存���
      console.log(`[${requestId}] Loading data from database...`);
      const issues = await getIssuesFromDb(
        config.owner,
        config.repo,
        page,
        labels ? [labels] : undefined
      );

      const lastSync = await getLastSyncHistory(config.owner, config.repo);
      
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

export async function getLabels(forceSync: boolean = false) {
  const config = await getGitHubConfig();
  
  // 如果不是强制同步，先检查缓存
  if (!forceSync) {
    const cacheKey = CACHE_KEYS.LABELS(config.owner, config.repo);
    const cached = cacheManager?.get<Label[]>(cacheKey);
    if (cached) {
      console.log('Using cached labels data');
      return cached;
    }
  }

  // 检查是否需要从 GitHub API 同步
  const needsGitHubSync = await shouldSync(config.owner, config.repo, forceSync);

  // 如果需要同步，从 GitHub API 获取并同步到数据库
  if (needsGitHubSync) {
    try {
      console.log('Starting GitHub API sync for labels...');
      const client = await getOctokit();

      const { data } = await client.rest.issues.listLabelsForRepo({
        owner: config.owner,
        repo: config.repo,
      });

      // 同步到数据库
      for (const label of data) {
        await saveLabel(config.owner, config.repo, label);
      }

      console.log(`Synced ${data.length} labels to database`);
      
      // 记录同步成功
      await recordSyncHistory(
        config.owner,
        config.repo,
        'success',
        data.length
      );

      return data;
    } catch (error) {
      console.error('GitHub API sync failed for labels:', error);
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

  // 从数据库获取（会自动处理缓存）
  return await getLabelsFromDb(config.owner, config.repo);
}

async function fetchAllIssues(config: GitHubConfig): Promise<Issue[]> {
  const cacheKey = CACHE_KEYS.ISSUES(config.owner, config.repo, 1, '');
  const cachedData = cacheManager?.get<Issue[]>(cacheKey);
  
  if (cachedData) {
    console.log('Using cached issues data');
    return cachedData;
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${config.owner}/${config.repo}/issues?state=all&per_page=${config.issuesPerPage}`,
      {
        headers: {
          Authorization: `token ${config.token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const data = await response.json();
    cacheManager?.set(cacheKey, data);
    return data;
  } catch (error) {
    console.error('Error fetching issues:', error);
    throw error;
  }
}

async function fetchAllLabels(config: GitHubConfig): Promise<Label[]> {
  const cacheKey = CACHE_KEYS.LABELS(config.owner, config.repo);
  const cachedData = cacheManager?.get<Label[]>(cacheKey);
  
  if (cachedData) {
    console.log('Using cached labels data');
    return cachedData;
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${config.owner}/${config.repo}/labels`,
      {
        headers: {
          Authorization: `token ${config.token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const data = await response.json();
    cacheManager?.set(cacheKey, data);
    return data;
  } catch (error) {
    console.error('Error fetching labels:', error);
    throw error;
  }
}

async function syncIssues(config: GitHubConfig) {
  try {
    const data = await fetchAllIssues(config);
    await recordSyncHistory(
      config.owner,
      config.repo,
      'success',
      data.length
    );
    return data;
  } catch (error) {
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

export async function syncLabels(config: GitHubConfig) {
  try {
    const data = await fetchAllLabels(config);
    await recordSyncHistory(
      config.owner,
      config.repo,
      'success',
      data.length
    );
    return data;
  } catch (error) {
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

export async function sync(config: GitHubConfig) {
  try {
    // 检查是否需要同步
    const syncStatus = await checkSyncStatus(config.owner, config.repo);
    console.log('Sync check:', syncStatus);

    if (!syncStatus.needsSync) {
      console.log('No sync needed');
      return;
    }

    // 同步数据
    const [issues, labels] = await Promise.all([
      syncIssues(config),
      syncLabels(config)
    ]);

    return {
      issues,
      labels
    };
  } catch (error) {
    console.error('Sync failed:', error);
    throw error;
  }
}

export async function getIssue(issueNumber: number, forceSync: boolean = false): Promise<Issue> {
  const config = await getGitHubConfig();
  const cacheKey = CACHE_KEYS.ISSUES(config.owner, config.repo, 1, '');

  // 如果不是强制同步，先检查缓存
  if (!forceSync) {
    const cached = cacheManager?.get<Issue[]>(cacheKey);
    if (cached) {
      const cachedIssue = cached.find(issue => issue.number === issueNumber);
      if (cachedIssue) {
        console.log('Using cached issue data');
        return cachedIssue;
      }
    }
  }
  
  // 从数据库获取数据
  const issues = await getIssuesFromDb(config.owner, config.repo);
  const issue = issues.find(i => i.number === issueNumber);
  
  if (!issue) {
    throw new Error(`Issue #${issueNumber} not found`);
  }

  // 更新缓存
  const cached = cacheManager?.get<Issue[]>(cacheKey) || [];
  const updatedCache = cached.map(i => i.number === issueNumber ? issue : i);
  if (!updatedCache.some(i => i.number === issueNumber)) {
    updatedCache.push(issue);
  }
  cacheManager?.set(cacheKey, updatedCache, { expiry: CACHE_EXPIRY.ISSUES });

  return issue;
}