import { createClient } from '@supabase/supabase-js';
import { GitHubConfig, Issue, Label } from '@/types/github';
import { SupabaseClient } from '@supabase/supabase-js';

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

interface IssueCache {
  timestamp: number;
  issues: DbIssue[];
  labels: DbLabel[];
}

interface SyncHistory {
  id: number;
  owner: string;
  repo: string;
  last_sync_at: string;
  issues_synced: number;
}

interface DbError {
  message: string;
  details?: unknown;
  hint?: string;
  code?: string;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const dbCache: Record<string, IssueCache> = {};

function getCacheKey(owner: string, repo: string, page: number, labelsFilter?: string[]) {
  return `${owner}:${repo}:${page}:${labelsFilter?.join(',') || ''}`;
}

function getFromCache(owner: string, repo: string, page: number, labelsFilter?: string[]) {
  const key = getCacheKey(owner, repo, page, labelsFilter);
  const cached = dbCache[key];
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached;
  }
  
  return null;
}

function setCache(owner: string, repo: string, page: number, labelsFilter: string[] | undefined, issues: DbIssue[], labels: DbLabel[]) {
  const key = getCacheKey(owner, repo, page, labelsFilter);
  dbCache[key] = {
    timestamp: Date.now(),
    issues,
    labels
  };
}

// 测试数据库连接和表结构
export async function testConnection() {
  try {
    // 检查 configs 表
    const { data: configsData, error: configsError } = await supabase
      .from('configs')
      .select('count');
    
    if (configsError) {
      console.error('Error checking configs table:', configsError);
      return false;
    }
    
    // 检查 issues 表
    const { data: issuesData, error: issuesError } = await supabase
      .from('issues')
      .select('count');
    
    if (issuesError) {
      console.error('Error checking issues table:', issuesError);
      return false;
    }
    
    // 检查 labels 表
    const { data: labelsData, error: labelsError } = await supabase
      .from('labels')
      .select('count');
    
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
    console.error('Database connection or tables check failed:', error);
    return false;
  }
}

// 配置相关操作
export async function getConfig(): Promise<GitHubConfig | null> {
  // 先从数据库获取配置
  const { data } = await supabase
    .from('configs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // 如果数据库有配置，直接返回
  if (data) {
    return {
      owner: data.owner,
      repo: data.repo,
      token: data.token,
      issuesPerPage: data.issues_per_page
    };
  }

  // 如果数据库没有配置，尝试从环境变量获取
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

    // 保存环境变量配置到数据库
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

    return envConfig;
  }

  return null;
}

export async function saveConfig(config: GitHubConfig) {
  const { error } = await supabase
    .from('configs')
    .insert({
      owner: config.owner,
      repo: config.repo,
      token: config.token,
      issues_per_page: config.issuesPerPage
    });

  if (error) {
    console.error('Error saving config:', error);
    throw error;
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

export async function getIssuesFromDb(owner: string, repo: string, page: number = 1, labelsFilter?: string[]): Promise<Issue[]> {
  // 检查缓存
  const cached = getFromCache(owner, repo, page, labelsFilter);
  if (cached) {
    return cached.issues.map(issue => ({
      number: issue.issue_number,
      title: issue.title,
      body: issue.body,
      created_at: issue.github_created_at,
      state: issue.state,
      labels: issue.labels.map((labelName: string) => {
        const labelInfo = cached.labels.find((l: any) => l.name === labelName);
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

    // 获取 issues 数据
    let query = supabase
      .from('issues')
      .select('*')
      .eq('owner', owner)
      .eq('repo', repo)
      .order('github_created_at', { ascending: false });

    if (labelsFilter && labelsFilter.length > 0) {
      query = query.contains('labels', labelsFilter);
    }

    const pageSize = 10;
    const start = (page - 1) * pageSize;
    query = query.range(start, start + pageSize - 1);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching issues from database:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // 缓存结果
    setCache(owner, repo, page, labelsFilter, data as DbIssue[], labelsData as DbLabel[]);

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
        issues_synced: issues.length
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
  // 1. 首先检查数据库中是否有数据
  const { count, error: issuesError } = await supabase
    .from('issues')
    .select('*', { count: 'exact', head: true })
    .eq('owner', owner)
    .eq('repo', repo);

  // 如果查询出错或没有数据，需要同步
  if (issuesError || !count || count === 0) {
    console.log('No issues in database, sync needed');
    return true;
  }

  // 2. 然后检查最后同步时间
  const lastSync = await getLastSyncHistory(owner, repo);
  
  if (!lastSync) {
    console.log('No sync history, sync needed');
    return true;
  }

  const now = new Date();
  const lastSyncDate = new Date(lastSync.last_sync_at);
  const hoursSinceLastSync = (now.getTime() - lastSyncDate.getTime()) / (1000 * 60 * 60);
  
  // 如果距离上次同步超过24小时，则需要同步
  const needsSync = hoursSinceLastSync >= 24;
  console.log(`Last sync was ${hoursSinceLastSync.toFixed(2)} hours ago, sync ${needsSync ? 'needed' : 'not needed'}`);
  return needsSync;
} 