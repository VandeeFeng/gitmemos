import { Octokit } from "octokit";
import { GitHubConfig, Issue, Label } from '@/types/github';
import { 
  getConfig, 
  saveConfig, 
  getIssuesFromDb, 
  saveIssue, 
  getLabelsFromDb, 
  saveLabel, 
  syncIssuesData,
  shouldSync,
  getLastSyncHistory
} from './db';

let config: GitHubConfig | null = null;

export async function setGitHubConfig(newConfig: GitHubConfig) {
  config = newConfig;
  // 保存到数据库
  await saveConfig(newConfig);
}

export async function getGitHubConfig(): Promise<GitHubConfig> {
  // 1. 优先使用运行时配置
  if (config) {
    return config;
  }

  // 2. 从数据库获取（数据库会自动处理环境变量配置）
  const dbConfig = await getConfig();
  if (dbConfig) {
    config = dbConfig;
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

// 添加内存缓存来存储上次同步检查的结果
let lastSyncCheck: {
  timestamp: number;
  needsSync: boolean;
  isInitialLoad: boolean;
} | null = null;

const SYNC_CHECK_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function checkNeedsSync(owner: string, repo: string, forceSync: boolean): Promise<boolean> {
  // If force sync is requested, return true
  if (forceSync) return true;

  // If this is the first load, always check sync status
  if (!lastSyncCheck || lastSyncCheck.isInitialLoad) {
    const needsSync = await shouldSync(owner, repo);
    lastSyncCheck = {
      timestamp: Date.now(),
      needsSync,
      isInitialLoad: false
    };
    return needsSync;
  }

  // For subsequent checks, use cache if available and fresh
  if (Date.now() - lastSyncCheck.timestamp < SYNC_CHECK_CACHE_DURATION) {
    return lastSyncCheck.needsSync;
  }

  // Cache expired, perform actual sync check
  const needsSync = await shouldSync(owner, repo);
  lastSyncCheck = {
    timestamp: Date.now(),
    needsSync,
    isInitialLoad: false
  };

  return needsSync;
}

// 添加内存缓存
interface IssuesCache {
  timestamp: number;
  data: {
    issues: Issue[];
    syncStatus: {
      success: boolean;
      totalSynced: number;
      lastSyncAt: string;
    } | null;
  };
}

const ISSUES_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const issuesCache: Record<string, IssuesCache> = {};

function getIssuesCacheKey(owner: string, repo: string, page: number, labels?: string) {
  return `${owner}:${repo}:${page}:${labels || ''}`;
}

function getIssuesFromCache(owner: string, repo: string, page: number, labels?: string) {
  const key = getIssuesCacheKey(owner, repo, page, labels);
  const cached = issuesCache[key];
  
  if (cached && Date.now() - cached.timestamp < ISSUES_CACHE_DURATION) {
    console.log('Using cached issues data');
    return cached.data;
  }
  
  return null;
}

function setIssuesCache(owner: string, repo: string, page: number, labels: string | undefined, data: IssuesCache['data']) {
  const key = getIssuesCacheKey(owner, repo, page, labels);
  issuesCache[key] = {
    timestamp: Date.now(),
    data
  };
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

// 添加标签筛选缓存
interface LabelFilterCache {
  issues: Issue[];
  timestamp: number;
  owner: string;
  repo: string;
}

const labelFilterCache: Record<string, LabelFilterCache> = {};
const LABEL_FILTER_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getLabelFilterCacheKey(owner: string, repo: string, label: string | undefined) {
  return `label_filter:${owner}:${repo}:${label || ''}`;
}

function getFromLabelFilterCache(owner: string, repo: string, label: string | undefined): Issue[] | null {
  const key = getLabelFilterCacheKey(owner, repo, label);
  const cached = labelFilterCache[key];
  
  if (cached && 
      cached.owner === owner && 
      cached.repo === repo && 
      Date.now() - cached.timestamp < LABEL_FILTER_CACHE_DURATION) {
    console.log('Using label filter cached data');
    return cached.issues;
  }
  
  return null;
}

function setLabelFilterCache(owner: string, repo: string, label: string | undefined, issues: Issue[]) {
  const key = getLabelFilterCacheKey(owner, repo, label);
  labelFilterCache[key] = {
    issues,
    timestamp: Date.now(),
    owner,
    repo
  };
}

export async function getIssues(page: number = 1, labels?: string, forceSync: boolean = false) {
  const config = await getGitHubConfig();
  const lockKey = getRequestLockKey(config.owner, config.repo, page, labels);

  // Clean up any stale requests
  cleanupStaleRequests();

  // 检查是否有正在进行的有效请求
  const existingRequest = requestLocks[lockKey];
  if (existingRequest && Date.now() - existingRequest.timestamp < REQUEST_TIMEOUT) {
    console.log(`Reusing existing request ${existingRequest.requestId} for page ${page}`);
    return existingRequest.promise;
  }

  // 如果不是强制同步，先检查标签筛选缓存
  if (!forceSync && page === 1) {
    const cachedIssues = getFromLabelFilterCache(config.owner, config.repo, labels);
    if (cachedIssues) {
      return {
        issues: cachedIssues,
        syncStatus: null
      };
    }
  }

  // 如果不是强制同步，再检查普通缓存
  if (!forceSync) {
    const cached = getIssuesFromCache(config.owner, config.repo, page, labels);
    if (cached) {
      return cached;
    }
  }

  // 创建新的请求
  const requestId = getNextRequestId();
  console.log(`Creating new request ${requestId} for page ${page}`);

  const promise = (async () => {
    try {
      // 使用新的检查函数
      const needsGitHubSync = await checkNeedsSync(config.owner, config.repo, forceSync);

      // 如果需要从 GitHub 同步
      if (needsGitHubSync) {
        try {
          console.log(`[${requestId}] Starting GitHub sync...`);
          const client = await getOctokit();
          
          // 获取所有 issues
          let allIssues: Issue[] = [];
          let currentPage = 1;
          let hasMore = true;
          
          while (hasMore) {
            const { data } = await client.rest.issues.listForRepo({
              owner: config.owner,
              repo: config.repo,
              state: 'all',
              per_page: 100,
              page: currentPage,
              sort: 'created',
              direction: 'desc',
              labels: labels || undefined
            });

            if (data.length === 0) {
              hasMore = false;
            } else {
              const issuesData = data.map(issue => ({
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

              allIssues = [...allIssues, ...issuesData];
              currentPage++;
            }
          }

          console.log(`[${requestId}] Fetched ${allIssues.length} issues from GitHub API`);

          // 同步到数据库
          if (allIssues.length > 0) {
            // 首先同步 labels
            const { data: labelsData } = await client.rest.issues.listLabelsForRepo({
              owner: config.owner,
              repo: config.repo,
            });

            for (const label of labelsData) {
              await saveLabel(config.owner, config.repo, label);
            }

            // 然后同步 issues
            await syncIssuesData(config.owner, config.repo, allIssues);
          }
        } catch (error) {
          console.error(`[${requestId}] GitHub sync failed:`, error);
        }
      }

      // 从数据库获取分页数据
      console.log(`[${requestId}] Loading data from database...`);
      const issues = await getIssuesFromDb(config.owner, config.repo, page, labels ? [labels] : undefined);
      const lastSync = await getLastSyncHistory(config.owner, config.repo);
      
      if (issues.length === 0) {
        console.log(`[${requestId}] No issues found in database`);
      } else {
        console.log(`[${requestId}] Loaded ${issues.length} issues from database`);
      }

      const result = { 
        issues,
        syncStatus: lastSync ? {
          success: true,
          totalSynced: lastSync.issues_synced,
          lastSyncAt: lastSync.last_sync_at
        } : null
      };

      // 缓存结果
      if (!forceSync) {
        setIssuesCache(config.owner, config.repo, page, labels, result);
        if (page === 1) {
          setLabelFilterCache(config.owner, config.repo, labels, issues);
        }
      }

      return result;
    } finally {
      // 请求完成后删除锁
      console.log(`[${requestId}] Request completed, cleaning up lock`);
      delete requestLocks[lockKey];
    }
  })();

  // 保存请求锁
  requestLocks[lockKey] = {
    promise,
    timestamp: Date.now(),
    requestId
  };

  return promise;
}

export async function getIssue(issueNumber: number, forceSync: boolean = false) {
  const config = await getGitHubConfig();

  // 如果是强制同步，从 GitHub API 获取并同步到数据库
  if (forceSync) {
    const client = await getOctokit();

    const { data } = await client.rest.issues.get({
      owner: config.owner,
      repo: config.repo,
      issue_number: issueNumber
    });

    const issueData: Issue = {
      number: data.number,
      title: data.title,
      body: data.body || '',
      created_at: data.created_at,
      state: data.state,
      labels: data.labels
        .filter((label): label is { id: number; name: string; color: string; description: string | null } => 
          typeof label === 'object' && label !== null)
        .map(label => ({
          id: label.id,
          name: label.name,
          color: label.color,
          description: label.description,
        })),
    };

    // 同步到数据库
    await saveIssue(config.owner, config.repo, issueData);
    for (const label of issueData.labels) {
      await saveLabel(config.owner, config.repo, label);
    }

    return issueData;
  }

  // 否则从数据库获取
  const dbIssues = await getIssuesFromDb(config.owner, config.repo);
  const dbIssue = dbIssues.find(issue => issue.number === issueNumber);
  if (!dbIssue) {
    throw new Error(`Issue #${issueNumber} not found in database`);
  }
  return dbIssue;
}

export async function createIssue(title: string, body: string, labels: string[] = []) {
  const config = await getGitHubConfig();
  const client = await getOctokit();

  const { data } = await client.rest.issues.create({
    owner: config.owner,
    repo: config.repo,
    title,
    body,
    labels
  });

  // 同步到数据库
  const issueData: Issue = {
    number: data.number,
    title: data.title,
    body: data.body || '',
    created_at: data.created_at,
    state: data.state,
    labels: data.labels
      .filter((label): label is { id: number; name: string; color: string; description: string | null } => 
        typeof label === 'object' && label !== null)
      .map(label => ({
        id: label.id,
        name: label.name,
        color: label.color,
        description: label.description,
      })),
  };

  await saveIssue(config.owner, config.repo, issueData);
  return data;
}

export async function updateIssue(issueNumber: number, title: string, body: string, labels: string[] = []) {
  const config = await getGitHubConfig();
  const client = await getOctokit();

  const { data } = await client.rest.issues.update({
    owner: config.owner,
    repo: config.repo,
    issue_number: issueNumber,
    title,
    body,
    labels
  });

  // 同步到数据库
  const issueData: Issue = {
    number: data.number,
    title: data.title,
    body: data.body || '',
    created_at: data.created_at,
    state: data.state,
    labels: data.labels
      .filter((label): label is { id: number; name: string; color: string; description: string | null } => 
        typeof label === 'object' && label !== null)
      .map(label => ({
        id: label.id,
        name: label.name,
        color: label.color,
        description: label.description,
      })),
  };

  await saveIssue(config.owner, config.repo, issueData);
  return data;
}

// 添加标签缓存
interface LabelsCache {
  owner: string;
  repo: string;
  data: Label[];
  timestamp: number;
}

let labelsCache: LabelsCache | null = null;
const LABELS_CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存时间

export async function getLabels(forceSync: boolean = false) {
  const config = await getGitHubConfig();

  // 检查缓存是否有效
  const now = Date.now();
  const isCacheValid = labelsCache && 
    labelsCache.owner === config.owner && 
    labelsCache.repo === config.repo && 
    (now - labelsCache.timestamp) < LABELS_CACHE_DURATION;

  // 如果缓存有效且不是强制同步，直接使用缓存
  if (isCacheValid && !forceSync && labelsCache) {
    console.log('Using cached labels data');
    return labelsCache.data;
  }

  // 如果是强制同步，从 GitHub API 获取并同步到数据库
  if (forceSync) {
    const client = await getOctokit();

    const { data } = await client.rest.issues.listLabelsForRepo({
      owner: config.owner,
      repo: config.repo,
    });

    // 同步到数据库
    for (const label of data) {
      await saveLabel(config.owner, config.repo, label);
    }

    // 更新缓存
    labelsCache = {
      owner: config.owner,
      repo: config.repo,
      data,
      timestamp: now
    };

    return data;
  }

  // 从数据库获取
  const labels = await getLabelsFromDb(config.owner, config.repo);

  // 更新缓存
  labelsCache = {
    owner: config.owner,
    repo: config.repo,
    data: labels,
    timestamp: now
  };

  return labels;
}

export async function createLabel(name: string, color: string, description?: string): Promise<Label> {
  const config = await getGitHubConfig();
  const client = await getOctokit();

  const { data } = await client.rest.issues.createLabel({
    owner: config.owner,
    repo: config.repo,
    name,
    color,
    description
  });

  const label: Label = {
    id: data.id,
    name: data.name,
    color: data.color,
    description: data.description
  };

  // 同步到数据库
  await saveLabel(config.owner, config.repo, label);
  return label;
}