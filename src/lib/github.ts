import { Octokit } from "octokit";
import { GitHubConfig, Issue as GitHubIssue, Label as GitHubLabel } from '@/types/github';

// 缓存接口
interface CacheItem<T> {
  data: T;
  timestamp: number;
}

interface CacheStore {
  issues: Map<string, CacheItem<GitHubIssue[]>>;
  singleIssue: Map<number, CacheItem<GitHubIssue>>;
  labels: CacheItem<GitHubLabel[]> | null;
}

// 缓存配置
const CACHE_DURATION = 60 * 60 * 1000; // 1小时缓存
const LABELS_CACHE_DURATION = 60 * 60 * 1000; // 标签缓存也设为1小时

// 声明全局类型
declare global {
  interface Window {
    __GITHUB_CACHE: CacheStore | undefined;
  }
}

// 确保这是一个模块
export {};

// 创建一个在客户端和服务器端都可用的缓存存储
const createCache = (): CacheStore => ({
  issues: new Map(),
  singleIssue: new Map(),
  labels: null,
});

// 获取缓存实例
const getCache = (): CacheStore => {
  if (typeof window === 'undefined') {
    // 服务器端：每个请求使用新的缓存
    return createCache();
  }
  
  // 客户端：使用全局缓存
  if (!window.__GITHUB_CACHE) {
    window.__GITHUB_CACHE = createCache();
  }
  return window.__GITHUB_CACHE || createCache();
};

// 生成缓存键
const getCacheKey = (page: number, labels?: string): string => {
  return `${page}-${labels || 'all'}`;
};

// 检查缓存是否有效
const isCacheValid = <T>(cache: CacheItem<T>, duration: number = CACHE_DURATION): boolean => {
  return Date.now() - cache.timestamp < duration;
};

let config: GitHubConfig | null = null;

export function setGitHubConfig(newConfig: GitHubConfig) {
  config = newConfig;
  // 当配置改变时，清除所有缓存
  const cache = getCache();
  cache.issues.clear();
  cache.singleIssue.clear();
  cache.labels = null;
  
  if (typeof window !== 'undefined') {
    localStorage.setItem('github-config', JSON.stringify(newConfig));
  }
}

export const getGitHubConfig = (forApi: boolean = true): GitHubConfig => {
  // API 调用时优先使用环境变量
  if (forApi) {
    const envConfig = {
      owner: process.env.NEXT_PUBLIC_GITHUB_OWNER,
      repo: process.env.NEXT_PUBLIC_GITHUB_REPO,
      token: process.env.NEXT_PUBLIC_GITHUB_TOKEN,
    };

    if (envConfig.owner && envConfig.repo && envConfig.token) {
      return {
        owner: envConfig.owner,
        repo: envConfig.repo,
        token: envConfig.token,
        issuesPerPage: 10
      };
    }
  }

  // 其次使用运行时配置
  if (config) {
    return config;
  }

  // 最后尝试从 localStorage 读取（仅在客户端）
  if (typeof window !== 'undefined') {
    const savedConfig = localStorage.getItem('github-config');
    if (savedConfig) {
      const parsedConfig = JSON.parse(savedConfig);
      config = parsedConfig;
      return parsedConfig;
    }
  }

  // 如果都没有，返回空配置
  return {
    owner: '',
    repo: '',
    token: '',
    issuesPerPage: 10
  };
};

export async function getIssues(page: number = 1, labels?: string) {
  const cache = getCache();
  const cacheKey = getCacheKey(page, labels);
  
  // 检查缓存
  const cachedData = cache.issues.get(cacheKey);
  if (cachedData && isCacheValid(cachedData)) {
    return cachedData.data;
  }

  const config = getGitHubConfig();
  const octokit = new Octokit({
    auth: config.token
  });
  
  const { data } = await octokit.rest.issues.listForRepo({
    owner: config.owner,
    repo: config.repo,
    state: 'all',
    per_page: config.issuesPerPage,
    page,
    sort: 'created',
    direction: 'desc',
    labels: labels || undefined
  });

  const issuesData: GitHubIssue[] = data.map(issue => ({
    number: issue.number,
    title: issue.title,
    body: issue.body || null,
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

  // 更新缓存
  cache.issues.set(cacheKey, {
    data: issuesData,
    timestamp: Date.now()
  });

  return issuesData;
}

export async function getIssue(issueNumber: number) {
  const cache = getCache();
  
  // 先检查单个issue缓存
  const cachedIssue = cache.singleIssue.get(issueNumber);
  if (cachedIssue && isCacheValid(cachedIssue)) {
    return cachedIssue.data;
  }

  // 尝试从列表缓存中查找
  for (const [, cachedData] of cache.issues) {
    if (isCacheValid(cachedData)) {
      const issueFromList = cachedData.data.find(issue => issue.number === issueNumber);
      if (issueFromList) {
        // 找到后，同时更新单个issue缓存
        cache.singleIssue.set(issueNumber, {
          data: issueFromList,
          timestamp: Date.now()
        });
        return issueFromList;
      }
    }
  }

  // 如果缓存中都没有，则调用API获取
  const config = getGitHubConfig();
  const octokit = new Octokit({
    auth: config.token
  });

  const { data } = await octokit.rest.issues.get({
    owner: config.owner,
    repo: config.repo,
    issue_number: issueNumber
  });

  const issueData: GitHubIssue = {
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

  // 更新缓存
  cache.singleIssue.set(issueNumber, {
    data: issueData,
    timestamp: Date.now()
  });

  return issueData;
}

export async function createIssue(title: string, body: string, labels: string[] = []) {
  const config = getGitHubConfig();
  const octokit = new Octokit({
    auth: config.token
  });

  const { data } = await octokit.rest.issues.create({
    owner: config.owner,
    repo: config.repo,
    title,
    body,
    labels
  });

  // 清除 issues 列表缓存，因为有新的 issue 创建
  getCache().issues.clear();

  return data;
}

export async function updateIssue(issueNumber: number, title: string, body: string, labels: string[] = []) {
  const config = getGitHubConfig();
  const octokit = new Octokit({
    auth: config.token
  });

  const { data } = await octokit.rest.issues.update({
    owner: config.owner,
    repo: config.repo,
    issue_number: issueNumber,
    title,
    body,
    labels
  });

  // 清除相关缓存
  getCache().singleIssue.delete(issueNumber);
  getCache().issues.clear();

  return data;
}

export async function getLabels() {
  const cache = getCache();
  // 检查标签缓存
  if (cache.labels && isCacheValid(cache.labels, LABELS_CACHE_DURATION)) {
    return cache.labels.data;
  }

  const config = getGitHubConfig();
  const octokit = new Octokit({
    auth: config.token
  });

  const { data } = await octokit.rest.issues.listLabelsForRepo({
    owner: config.owner,
    repo: config.repo,
  });

  // 更新缓存
  getCache().labels = {
    data,
    timestamp: Date.now()
  };

  return data;
}

export async function createLabel(name: string, color: string, description?: string) {
  const config = getGitHubConfig();
  const octokit = new Octokit({
    auth: config.token
  });

  const { data } = await octokit.rest.issues.createLabel({
    owner: config.owner,
    repo: config.repo,
    name,
    color,
    description
  });

  // 清除标签缓存
  getCache().labels = null;

  return data;
}

// 创建一个全局的 Octokit 实例
export const octokit = new Octokit({
  auth: getGitHubConfig().token,
});