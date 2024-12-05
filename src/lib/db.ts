import { createClient } from '@supabase/supabase-js';
import { GitHubConfig, Issue, Label } from '@/types/github';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

interface DbIssue {
  owner: string;
  repo: string;
  issue_number: number;
  title: string;
  body: string;
  state: string;
  labels: string[];
  github_created_at: string;
  updated_at: string;
}

interface DbLabel {
  id: number;
  name: string;
  color: string;
  description: string | null;
  owner: string;
  repo: string;
}

interface DbConfig {
  owner: string;
  repo: string;
  token: string;
  issues_per_page: number;
  created_at: string;
  password?: string;
}

interface DbCache {
  timestamp: number;
  issues: DbIssue[];
  labels: DbLabel[];
  total: number;
}

interface SyncHistory {
  id: number;
  owner: string;
  repo: string;
  last_sync_at: string;
  issues_synced: number;
  status: 'success' | 'failed';
  error_message?: string;
}

interface DbError {
  message: string;
  details?: unknown;
  hint?: string;
  code?: string;
}

const DB_PAGE_SIZE = 50;
const DB_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

const dbCache: Record<string, DbCache> = {};

const PASSWORD_VERIFIED_KEY = 'password_verified';

function getCacheKey(owner: string, repo: string, page: number, labelsFilter?: string[]) {
  return `${owner}:${repo}:${page}:${labelsFilter?.join(',') || ''}`;
}

function getDbCacheKey(owner: string, repo: string, page: number, labelsFilter?: string[]) {
  return `db:${owner}:${repo}:${page}:${labelsFilter?.sort().join(',') || ''}`;
}

// 测试数据库连接和表结构
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
    setPasswordVerified(true);
  }
  return isValid;
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

  // 如果数据库没���配置，尝试从环境变量获取
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
  // 先检查是否已存在相同的配置
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
  const cacheKey = getDbCacheKey(owner, repo, page, labelsFilter);
  const cached = dbCache[cacheKey];
  
  if (cached && Date.now() - cached.timestamp < DB_CACHE_DURATION) {
    return cached.issues.map(issue => ({
      number: issue.issue_number,
      title: issue.title,
      body: issue.body,
      created_at: issue.github_created_at,
      state: issue.state,
      labels: issue.labels.map((labelName: string) => {
        const labelInfo = cached.labels.find((l: DbLabel) => l.name === labelName);
        return labelInfo || {
          id: 0,
          name: labelName,
          color: 'gray',
          description: null
        };
      })
    }));
  }

  try {
    // 获取标签数据
    const { data: labelsData, error: labelsError } = await supabase
      .from('labels')
      .select('*')
      .eq('owner', owner)
      .eq('repo', repo);

    if (labelsError) {
      console.error('Error fetching labels:', labelsError);
      return [];
    }

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

    if (labelsFilter && labelsFilter.length > 0) {
      query = query.contains('labels', labelsFilter);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching issues from database:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // 更新缓存
    dbCache[cacheKey] = {
      timestamp: Date.now(),
      issues: data as DbIssue[],
      labels: labelsData as DbLabel[],
      total: count || 0
    };

    // 返回处理后的数据
    return data.map((issue: DbIssue) => ({
      number: issue.issue_number,
      title: issue.title,
      body: issue.body,
      created_at: issue.github_created_at,
      state: issue.state,
      labels: issue.labels.map((labelName: string) => {
        const labelInfo = labelsData.find((label: DbLabel) => label.name === labelName);
        return labelInfo || {
          id: 0,
          name: labelName,
          color: 'gray',
          description: null
        };
      })
    }));
  } catch (error) {
    console.error('Failed to fetch issues from database:', error);
    return [];
  }
}

// 清理过期的数据库缓存
export function cleanupDbCache() {
  const now = Date.now();
  Object.keys(dbCache).forEach(key => {
    if (now - dbCache[key].timestamp > DB_CACHE_DURATION) {
      delete dbCache[key];
    }
  });
}

// 定期清理缓存
setInterval(cleanupDbCache, DB_CACHE_DURATION);

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

  return data.map(label => ({
    id: label.id,
    name: label.name,
    color: label.color,
    description: label.description
  }));
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

// 同步历史相关操作
export async function getLastSyncHistory(owner: string, repo: string): Promise<SyncHistory | null> {
  const { data, error } = await supabase
    .from('sync_history')
    .select('*')
    .eq('owner', owner)
    .eq('repo', repo)
    .order('last_sync_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data as SyncHistory;
}

export async function recordSyncHistory(
  owner: string,
  repo: string,
  status: 'success' | 'failed',
  issuesSynced: number = 0,
  errorMessage?: string
) {
  const { error } = await supabase
    .from('sync_history')
    .insert({
      owner,
      repo,
      last_sync_at: new Date().toISOString(),
      issues_synced: issuesSynced,
      status,
      error_message: errorMessage
    });

  if (error) {
    console.error('Error recording sync history:', error);
  }
}

// 检查是否需要同步
export async function shouldSync(owner: string, repo: string): Promise<boolean> {
  try {
    // 1. First check if there are any issues in the database
    const { data: issues, error: issuesError } = await supabase
      .from('issues')
      .select('issue_number')
      .eq('owner', owner)
      .eq('repo', repo)
      .limit(1);

    // If query failed or no issues found, sync is needed
    if (issuesError || !issues || issues.length === 0) {
      console.log('No issues in database, sync needed');
      return true;
    }

    // 2. Then check the last sync time
    const lastSync = await getLastSyncHistory(owner, repo);
    
    if (!lastSync) {
      console.log('No sync history, sync needed');
      return true;
    }

    const now = new Date();
    const lastSyncDate = new Date(lastSync.last_sync_at);
    const hoursSinceLastSync = (now.getTime() - lastSyncDate.getTime()) / (1000 * 60 * 60);
    
    // If last sync was more than 24 hours ago, sync is needed
    const needsSync = hoursSinceLastSync >= 24;
    console.log(`Last sync was ${hoursSinceLastSync.toFixed(2)} hours ago, sync ${needsSync ? 'needed' : 'not needed'}`);
    return needsSync;
  } catch (error) {
    console.error('Error checking sync status:', error);
    // If there's an error checking sync status, assume sync is needed
    return true;
  }
}

export function setPasswordVerified(verified: boolean) {
  if (typeof window !== 'undefined') {
    if (verified) {
      localStorage.setItem(PASSWORD_VERIFIED_KEY, 'true');
    } else {
      localStorage.removeItem(PASSWORD_VERIFIED_KEY);
    }
  }
}

export function isPasswordVerified(): boolean {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(PASSWORD_VERIFIED_KEY) === 'true';
  }
  return false;
} 