import { createClient } from '@supabase/supabase-js';
import { GitHubConfig, Issue, Label } from '@/types/github';
import { cacheManager, CACHE_KEYS, CACHE_EXPIRY } from '@/lib/cache';
import { supabase } from './supabase';

interface DbError {
  message: string;
  details?: unknown;
  hint?: string;
  code?: string;
}

interface DbConfig {
  owner: string;
  repo: string;
  token: string;
  issues_per_page: number;
  created_at: string;
  password?: string;
}

interface DbIssue {
  id: number;
  owner: string;
  repo: string;
  issue_number: number;
  title: string;
  body: string | null;
  created_at: string;
  updated_at: string;
  state: string;
  labels: string[];
  github_created_at: string;
}

interface DbLabel {
  id: number;
  name: string;
  color: string;
  description: string | null;
  owner: string;
  repo: string;
}

interface SyncHistory {
  id: number;
  owner: string;
  repo: string;
  last_sync_at: string;
  issues_synced: number;
  status: 'success' | 'failed';
  error_message?: string;
  created_at?: string;
}

interface CountResult {
  count: number;
}

const DB_PAGE_SIZE = 50;

// 缓存锁
const cacheLocks = new Set<string>();
const pendingOperations = new Map<string, Promise<any>>();

async function withCacheLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
  // 检查是否有正在进行的操作
  const pending = pendingOperations.get(key);
  if (pending) {
    console.log(`Waiting for pending operation on key: ${key}`);
    return pending as Promise<T>;
  }

  if (cacheLocks.has(key)) {
    console.log(`Cache lock exists for key: ${key}, waiting...`);
    // 等待一段时间后重试
    await new Promise(resolve => setTimeout(resolve, 100));
    return withCacheLock(key, operation);
  }

  try {
    cacheLocks.add(key);
    console.log(`Acquired cache lock for key: ${key}`);
    
    // 创建并存储操作的 Promise
    const operationPromise = operation();
    pendingOperations.set(key, operationPromise);

    const result = await operationPromise;
    return result;
  } finally {
    cacheLocks.delete(key);
    pendingOperations.delete(key);
    console.log(`Released cache lock for key: ${key}`);
  }
}

// 测试数据库接和表结构
export async function testConnection(): Promise<boolean> {
  try {
    type CountResult = { count: number };

    // 检查 configs 表
    const { data: configsData, error: configsError } = await supabase
      .from('configs')
      .select('count') as { data: CountResult | null; error: DbError | null };
    
    if (configsError) {
      console.error('Error checking configs table:', configsError);
      return false;
    }
    
    // 检查 issues 表
    const { data: issuesData, error: issuesError } = await supabase
      .from('issues')
      .select('count') as { data: CountResult | null; error: DbError | null };
    
    if (issuesError) {
      console.error('Error checking issues table:', issuesError);
      return false;
    }
    
    // 检查 labels 表
    const { data: labelsData, error: labelsError } = await supabase
      .from('labels')
      .select('count') as { data: CountResult | null; error: DbError | null };
    
    if (labelsError) {
      console.error('Error checking labels table:', labelsError);
      return false;
    }

    console.log('Database connection and tables check successful', {
      configs: configsData,
      issues: issuesData,
      labels: labelsData
    });
    return true;
  } catch (error) {
    const dbError = error as DbError;
    console.error('Database connection or tables check failed:', dbError.message || dbError);
    return false;
  }
}

// 配置相关操作
export async function verifyPassword(password: string): Promise<boolean> {
  const { data } = await supabase
    .from('configs')
    .select('password')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const isValid = !!(data && data.password && data.password === password);
  if (isValid) {
    cacheManager?.set(CACHE_KEYS.PASSWORD_VERIFIED, true, { expiry: CACHE_EXPIRY.PASSWORD });
  }
  return isValid;
}

export function setPasswordVerified(verified: boolean) {
  if (verified) {
    cacheManager?.set(CACHE_KEYS.PASSWORD_VERIFIED, true, { expiry: CACHE_EXPIRY.PASSWORD });
  } else {
    cacheManager?.remove(CACHE_KEYS.PASSWORD_VERIFIED);
  }
}

export function isPasswordVerified(): boolean {
  return !!cacheManager?.get<boolean>(CACHE_KEYS.PASSWORD_VERIFIED);
}

export async function getConfig(): Promise<GitHubConfig | null> {
  // 先从数据库获取配置
  const { data } = await supabase
    .from('configs')
    .select('owner, repo, token, issues_per_page, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // 如果数据库有配置，直接返回
  if (data) {
    const dbConfig = data as DbConfig;
    return {
      owner: dbConfig.owner,
      repo: dbConfig.repo,
      token: dbConfig.token,
      issuesPerPage: dbConfig.issues_per_page
    };
  }

  // 如果据库没配置，尝试从环境变量获取
  const owner = process.env.NEXT_PUBLIC_GITHUB_OWNER;
  const repo = process.env.NEXT_PUBLIC_GITHUB_REPO;
  const token = process.env.NEXT_PUBLIC_GITHUB_TOKEN;

  // 如果环境变量有配置，保存到数据库并返回
  if (owner && repo && token) {
    const envConfig = {
      owner,
      repo,
      token,
      issuesPerPage: 10
    };

    // 检查是否已存在相同的配置
    const { data: existingConfig } = await supabase
      .from('configs')
      .select('*')
      .eq('owner', owner)
      .eq('repo', repo)
      .single();

    // 只有在不存在相同配置时才保存
    if (!existingConfig) {
      const { error: saveError } = await supabase
        .from('configs')
        .insert({
          owner,
          repo,
          token,
          issues_per_page: 10
        });

      if (saveError) {
        console.error('Error saving env config to database:', saveError);
      }
    }

    return envConfig;
  }

  return null;
}

export async function saveConfig(config: GitHubConfig) {
  // 先检查否已存相同的配
  const { data: existingConfig } = await supabase
    .from('configs')
    .select('*')
    .eq('owner', config.owner)
    .eq('repo', config.repo)
    .single();

  if (existingConfig) {
    // 如果存在，则更新配置
    const { error } = await supabase
      .from('configs')
      .update({
        token: config.token,
        issues_per_page: config.issuesPerPage,
        password: config.password,
        updated_at: new Date().toISOString()
      })
      .eq('owner', config.owner)
      .eq('repo', config.repo);

    if (error) {
      console.error('Error updating config:', error);
      throw error;
    }
  } else {
    // 如果不存在，则插入新配置
    const { error } = await supabase
      .from('configs')
      .insert({
        owner: config.owner,
        repo: config.repo,
        token: config.token,
        issues_per_page: config.issuesPerPage,
        password: config.password
      });

    if (error) {
      console.error('Error saving config:', error);
      throw error;
    }
  }
}

// Issues 相关操作
export async function saveIssue(owner: string, repo: string, issue: Issue) {
  console.log('Saving issue to database:', { 
    owner, 
    repo, 
    number: issue.number,
    title: issue.title,
    labels: issue.labels.map(l => l.name)
  });

  try {
    const { error } = await supabase
      .from('issues')
      .upsert({
        owner,
        repo,
        issue_number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        labels: issue.labels.map(label => label.name),
        github_created_at: issue.created_at,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'owner,repo,issue_number'
      });

    if (error) {
      console.error('Error saving issue:', error);
      throw error;
    }

    console.log('Successfully saved issue:', issue.number);
  } catch (error) {
    console.error('Failed to save issue:', error);
    throw error;
  }
}

export async function getIssuesFromDb(
  owner: string,
  repo: string,
  page: number = 1,
  labelsFilter?: string[]
): Promise<Issue[]> {
  const cacheKey = CACHE_KEYS.ISSUES(owner, repo, page, labelsFilter?.join(',') || '');
  
  return withCacheLock(cacheKey, async () => {
    // 先检查缓存
    const cached = cacheManager?.get<Issue[]>(cacheKey);
    if (cached) {
      console.log(`Using cached data for key: ${cacheKey}`);
      return cached;
    }

    console.log(`Fetching data from database for key: ${cacheKey}`);
    try {
      // 计算分页范围
      const from = (page - 1) * DB_PAGE_SIZE;
      const to = from + DB_PAGE_SIZE - 1;

      // 构建查询
      let query = supabase
        .from('issues')
        .select('*', { count: 'exact' })
        .eq('owner', owner)
        .eq('repo', repo)
        .order('github_created_at', { ascending: false })
        .range(from, to);

      // 如果有标签过滤，���加过滤条件
      if (labelsFilter && labelsFilter.length > 0) {
        query = query.contains('labels', labelsFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching issues:', error);
        return [];
      }

      // 获取标签数据
      const { data: labelsData } = await supabase
        .from('labels')
        .select('*')
        .eq('owner', owner)
        .eq('repo', repo);

      // 转换数据格式
      const issues = data.map((issue: DbIssue) => ({
        number: issue.issue_number,
        title: issue.title,
        body: issue.body || '',
        created_at: issue.github_created_at,
        state: issue.state,
        labels: issue.labels.map(labelName => {
          const labelInfo = labelsData?.find((l: DbLabel) => l.name === labelName);
          return labelInfo || {
            id: 0,
            name: labelName,
            color: 'gray',
            description: null
          };
        })
      }));

      // 存入缓存
      console.log(`Setting cache for key: ${cacheKey}`);
      cacheManager?.set(cacheKey, issues, { expiry: CACHE_EXPIRY.ISSUES });

      return issues;
    } catch (error) {
      console.error('Error fetching issues:', error);
      return [];
    }
  });
}

// Labels 相关操作
export async function saveLabel(owner: string, repo: string, label: Label) {
  const { error } = await supabase
    .from('labels')
    .upsert({
      owner,
      repo,
      name: label.name,
      color: label.color,
      description: label.description,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'owner,repo,name'
    });

  if (error) {
    console.error('Error saving label:', error);
    throw error;
  }
}

export async function getLabelsFromDb(owner: string, repo: string): Promise<Label[]> {
  const cacheKey = CACHE_KEYS.LABELS(owner, repo);
  const cached = cacheManager?.get<Label[]>(cacheKey);
  
  if (cached) {
    return cached;
  }

  return withCacheLock(cacheKey, async () => {
    // 再次检查缓存（可能在等待锁的过程中已经被其他请求设置了）
    const cachedAfterLock = cacheManager?.get<Label[]>(cacheKey);
    if (cachedAfterLock) {
      return cachedAfterLock;
    }

    try {
      const { data, error } = await supabase
        .from('labels')
        .select('*')
        .eq('owner', owner)
        .eq('repo', repo)
        .order('name');

      if (error) {
        console.error('Error fetching labels:', error);
        return [];
      }

      const labels = data.map(label => ({
        id: label.id,
        name: label.name,
        color: label.color,
        description: label.description
      }));

      // 存入缓存
      cacheManager?.set(cacheKey, labels, { expiry: CACHE_EXPIRY.LABELS });

      return labels;
    } catch (error) {
      console.error('Error fetching labels:', error);
      return [];
    }
  });
}

// 数据同步功能
export async function syncIssuesData(owner: string, repo: string, issues: Issue[]): Promise<void> {
  try {
    for (const issue of issues) {
      await saveIssue(owner, repo, issue);
    }

    // 更新同步历史
    const { error } = await supabase
      .from('sync_history')
      .insert({
        owner,
        repo,
        last_sync_at: new Date().toISOString(),
        issues_synced: issues.length,
        status: 'success'
      });

    if (error) {
      throw error;
    }
  } catch (error) {
    const dbError = error as DbError;
    console.error('Error syncing issues:', dbError.message || dbError);
    throw error;
  }
}

// 检查是否需要从 GitHub API 同步
export async function shouldSync(owner: string, repo: string, forceSync: boolean = false): Promise<boolean> {
  // 如果强制同步，直接返回 true
  if (forceSync) {
    return true;
  }

  try {
    // 获取最后一次同步录
    const { data: lastSync, error } = await supabase
      .from('sync_history')
      .select('*')
      .eq('owner', owner)
      .eq('repo', repo)
      .order('last_sync_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('Error checking sync history:', {
        error,
        owner,
        repo,
        context: 'shouldSync function'
      });
      return true; // 如果出错，建议进行同步
    }

    // 如果没有同步记录，需要同步
    if (!lastSync) {
      console.log('No sync history found, sync needed');
      return true;
    }

    // 检查上次同步状态和时间
    const lastSyncTime = new Date(lastSync.last_sync_at).getTime();
    const now = Date.now();
    const hoursSinceLastSync = (now - lastSyncTime) / (1000 * 60 * 60);

    // 如果上次同步失败或超过24小时，需要同步
    const needsSync = lastSync.status === 'failed' || hoursSinceLastSync >= 24;
    
    console.log('Sync check:', {
      owner,
      repo,
      lastSyncAt: new Date(lastSyncTime).toISOString(),
      hoursSinceLastSync: Math.round(hoursSinceLastSync),
      lastSyncStatus: lastSync.status,
      needsSync
    });

    return needsSync;
  } catch (error) {
    console.error('Error checking sync status:', error);
    return true; // 如果出错，建议进行同步
  }
}

// 记录同步历史
export async function recordSyncHistory(
  owner: string,
  repo: string,
  status: 'success' | 'failed',
  issuesSynced: number,
  errorMessage?: string
): Promise<void> {
  const { error: dbError } = await supabase
    .from('sync_history')
    .insert({
      owner,
      repo,
      status,
      issues_synced: issuesSynced,
      error_message: errorMessage,
      last_sync_at: new Date().toISOString()
    });

  if (dbError) {
    console.error('Failed to record sync history:', dbError);
  }
}

// 获取最后一次同步记录
export async function getLastSyncHistory(owner: string, repo: string): Promise<SyncHistory | null> {
  try {
    const { data, error } = await supabase
      .from('sync_history')
      .select('*')
      .eq('owner', owner)
      .eq('repo', repo)
      .order('last_sync_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching last sync history:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Failed to get last sync history:', error);
    return null;
  }
}

export async function checkSyncStatus(owner: string, repo: string) {
  const { data: lastSync, error } = await supabase
    .from('sync_history')
    .select('*')
    .eq('owner', owner)
    .eq('repo', repo)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Failed to check sync status:', error);
    return { needsSync: true, lastSyncAt: null };
  }

  if (!lastSync) {
    return { needsSync: true, lastSyncAt: null };
  }

  const lastSyncTime = new Date(lastSync.last_sync_at).getTime();
  const now = Date.now();
  const syncInterval = 1000 * 60 * 60; // 1 hour

  return {
    needsSync: now - lastSyncTime > syncInterval,
    lastSyncAt: lastSync.last_sync_at
  };
} 