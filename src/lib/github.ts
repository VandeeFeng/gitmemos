import { Octokit } from "octokit";
import { GitHubConfig, Issue as GitHubIssue } from '@/types/github';
import { getConfig, saveConfig, getIssuesFromDb, saveIssue, getLabelsFromDb, saveLabel, syncIssuesData } from './db';

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

// 缓存机制
interface IssuesCache {
  data: GitHubIssue[];
  timestamp: number;
  owner: string;
  repo: string;
}

let issuesCache: IssuesCache | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存时间

export async function getIssues(page: number = 1, labels?: string, forceSync: boolean = false) {
  const config = await getGitHubConfig();
  console.log('Getting issues:', { page, labels, forceSync });

  // 检查缓存是否有效
  const now = Date.now();
  const isCacheValid = issuesCache && 
    issuesCache.owner === config.owner && 
    issuesCache.repo === config.repo && 
    (now - issuesCache.timestamp) < CACHE_DURATION;

  // 如果缓存有效且不是强制同步，直接使用缓存
  if (isCacheValid && !forceSync && issuesCache) {
    console.log('Using cached issues data');
    const start = (page - 1) * (config.issuesPerPage || 10);
    const end = start + (config.issuesPerPage || 10);
    const filteredIssues = labels 
      ? issuesCache.data.filter(issue => 
          issue.labels.some(label => label.name === labels)
        )
      : issuesCache.data;
    return { 
      issues: filteredIssues.slice(start, end),
      syncStatus: null
    };
  }

  // 如果是强制同步，从 GitHub API 获取所有 issues 和 labels 并同步到数据库
  if (forceSync) {
    try {
      console.log('Fetching all issues and labels from GitHub API');
      const client = await getOctokit();
      
      // 首先获取并同步所有 labels
      const { data: labelsData } = await client.rest.issues.listLabelsForRepo({
        owner: config.owner,
        repo: config.repo,
      });
      
      // 同步 labels 到数据库
      for (const label of labelsData) {
        await saveLabel(config.owner, config.repo, label);
      }
      
      try {
        // 获取所有 issues
        let allIssues: GitHubIssue[] = [];
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

        console.log(`Fetched ${allIssues.length} total issues from GitHub API`);

        // 同步到数据库
        if (allIssues.length > 0) {
          console.log('Syncing all issues to database');
          await syncIssuesData(config.owner, config.repo, allIssues);
          console.log('Database sync completed');

          // 更新缓存
          issuesCache = {
            data: allIssues,
            timestamp: Date.now(),
            owner: config.owner,
            repo: config.repo
          };
        }

        // 返回请求的页面的数据
        const start = (page - 1) * (config.issuesPerPage || 10);
        const end = start + (config.issuesPerPage || 10);
        return {
          issues: allIssues.slice(start, end),
          syncStatus: {
            success: true,
            totalSynced: allIssues.length
          }
        };
      } catch (apiError: Error) {
        console.error('Failed to fetch issues:', apiError.message);
        throw apiError;
      }
    } catch (error) {
      console.error('Error during sync:', error);
      throw error;
    }
  }

  // 从数据库获取分页数据
  const issues = await getIssuesFromDb(config.owner, config.repo, page, labels ? [labels] : undefined);
  
  // 更新缓存
  if (issues.length > 0) {
    issuesCache = {
      data: issues,
      timestamp: Date.now(),
      owner: config.owner,
      repo: config.repo
    };
  }
  
  return { issues, syncStatus: null };
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

export async function getLabels(forceSync: boolean = false) {
  const config = await getGitHubConfig();

  // 检查缓存是否有效
  const now = Date.now();
  const isCacheValid = labelsCache && 
    labelsCache.owner === config.owner && 
    labelsCache.repo === config.repo && 
    (now - labelsCache.timestamp) < CACHE_DURATION;

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
    description: data.description || null
  };

  // 保存到数据库
  await saveLabel(config.owner, config.repo, label);

  return label;
}