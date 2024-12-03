import { supabase } from './supabase';
import { GitHubConfig, Issue, Label } from '@/types/github';
import { Database } from '@/types/supabase';

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
  const { data, error } = await supabase
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
  console.log('Getting issues from database:', { owner, repo, page, labelsFilter });
  
  try {
    // First, get all labels for this repository
    const { data: labelsData, error: labelsError } = await supabase
      .from('labels')
      .select('*')
      .eq('owner', owner)
      .eq('repo', repo);

    if (labelsError) {
      console.error('Error fetching labels:', labelsError);
      return [];
    }

    // Create a map of label names to their full information
    const labelMap = new Map(
      labelsData.map(label => [
        label.name,
        {
          id: label.id,
          name: label.name,
          color: label.color,
          description: label.description
        }
      ])
    );

    let query = supabase
      .from('issues')
      .select('*')
      .eq('owner', owner)
      .eq('repo', repo)
      .order('github_created_at', { ascending: false });

    if (labelsFilter && labelsFilter.length > 0) {
      query = query.contains('labels', labelsFilter);
    }

    // 添加分页
    const pageSize = 10;
    const start = (page - 1) * pageSize;
    query = query.range(start, start + pageSize - 1);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching issues from database:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log('No issues found in database');
      return [];
    }

    console.log(`Found ${data.length} issues in database:`, data.map(i => ({ 
      number: i.issue_number, 
      title: i.title,
      labels: i.labels 
    })));

    return data.map(issue => ({
      number: issue.issue_number,
      title: issue.title,
      body: issue.body,
      created_at: issue.github_created_at,
      state: issue.state,
      labels: issue.labels.map(labelName => {
        const labelInfo = labelMap.get(labelName);
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
export async function syncIssuesData(owner: string, repo: string, issues: Issue[]) {
  console.log(`Starting sync of ${issues.length} issues to database for ${owner}/${repo}`);
  
  try {
    for (const issue of issues) {
      console.log(`Syncing issue #${issue.number}: ${issue.title}`);
      await saveIssue(owner, repo, issue);
      
      // 同步标签
      for (const label of issue.labels) {
        console.log(`Syncing label: ${label.name}`);
        await saveLabel(owner, repo, label);
      }
    }
    console.log('Sync completed successfully');
  } catch (error) {
    console.error('Failed to sync issues:', error);
    throw error;
  }
} 