import { Issue, Label } from '@/types/github';
import { cacheManager, CACHE_KEYS, CACHE_EXPIRY } from './cache';
import { BaseGitHubConfig, ServerGitHubConfig } from '@/types/config';

type SyncStatus = 'success' | 'failed';

// Auth API
export async function verifyPassword(password: string): Promise<boolean> {
  try {
    const response = await fetch('/api/supabase/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      throw new Error('Failed to verify password');
    }

    const { isValid } = await response.json();
    if (isValid) {
      cacheManager?.set(CACHE_KEYS.PASSWORD_VERIFIED, true, { expiry: CACHE_EXPIRY.PASSWORD });
    }
    return isValid;
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
}

export function setPasswordVerified(verified: boolean): void {
  if (verified) {
    cacheManager?.set(CACHE_KEYS.PASSWORD_VERIFIED, true, { expiry: CACHE_EXPIRY.PASSWORD });
  } else {
    cacheManager?.remove(CACHE_KEYS.PASSWORD_VERIFIED);
  }
}

export function isPasswordVerified(): boolean {
  return !!cacheManager?.get<boolean>(CACHE_KEYS.PASSWORD_VERIFIED);
}

// Config API
export async function getConfig(): Promise<ServerGitHubConfig | null> {
  try {
    console.log('Getting config from environment variables...');
    
    // First try to get config from environment variables
    const envConfig: Partial<ServerGitHubConfig> = {
      owner: process.env.GITHUB_OWNER,
      repo: process.env.GITHUB_REPO,
      token: process.env.GITHUB_TOKEN,
      issuesPerPage: 10
    };

    // Log environment config (without sensitive info)
    const safeConfig: Partial<BaseGitHubConfig> = {
      owner: envConfig.owner,
      repo: envConfig.repo,
      issuesPerPage: envConfig.issuesPerPage
    };
    
    console.log('Environment config:', {
      ...safeConfig,
      hasToken: !!envConfig.token
    });

    // If we have complete environment config, use it
    if (envConfig.owner && envConfig.repo && envConfig.token) {
      // Create safe config for caching (without sensitive info)
      const cacheConfig: BaseGitHubConfig = {
        owner: envConfig.owner,
        repo: envConfig.repo,
        issuesPerPage: envConfig.issuesPerPage || 10
      };
      
      // Cache only safe config
      cacheManager?.set(
        CACHE_KEYS.CONFIG(cacheConfig.owner, cacheConfig.repo),
        cacheConfig,
        { expiry: CACHE_EXPIRY.CONFIG }
      );
      
      // Return full config including token (only for internal use)
      return {
        ...cacheConfig,
        token: envConfig.token
      };
    }

    console.log('Environment config incomplete, trying API...');

    // If environment config is incomplete, try API
    const response = await fetch('/api/supabase/config');
    if (!response.ok) {
      throw new Error('Failed to fetch config from API');
    }

    const data = await response.json();
    
    // Create safe config for caching (without sensitive info)
    const cacheConfig: BaseGitHubConfig = {
      owner: data.owner,
      repo: data.repo,
      issuesPerPage: data.issues_per_page || 10
    };
    
    // Cache only safe config
    cacheManager?.set(
      CACHE_KEYS.CONFIG(cacheConfig.owner, cacheConfig.repo),
      cacheConfig,
      { expiry: CACHE_EXPIRY.CONFIG }
    );
    
    // Return full config including token (only for internal use)
    return {
      ...cacheConfig,
      token: data.token
    };
  } catch (error) {
    console.error('Error in getConfig:', error);
    throw error;
  }
}

export async function saveConfig(config: Omit<ServerGitHubConfig, 'issuesPerPage'>): Promise<ServerGitHubConfig | null> {
  try {
    const response = await fetch('/api/supabase/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        owner: config.owner,
        repo: config.repo,
        token: config.token
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to save config');
    }
    
    const data = await response.json();
    
    // 更新缓存 (只缓存安全配置)
    if (data) {
      const safeConfig: BaseGitHubConfig = {
        owner: data.owner,
        repo: data.repo,
        issuesPerPage: 10
      };
      cacheManager?.set(
        CACHE_KEYS.CONFIG(data.owner, data.repo),
        safeConfig,
        { expiry: CACHE_EXPIRY.CONFIG }
      );
    }
    
    return data;
  } catch (error) {
    console.error('Error saving config:', error);
    return null;
  }
}

// Issues API
export async function getIssues(
  owner: string,
  repo: string,
  page: number = 1,
  labels?: string[]
): Promise<{ issues: Issue[]; total: number; lastSyncAt?: string } | null> {
  try {
    const cacheKey = CACHE_KEYS.ISSUES(owner, repo, page, labels?.join(','));
    const cached = cacheManager?.get<{ issues: Issue[]; total: number }>(cacheKey);
    
    // 获取同步状态
    const syncStatus = await checkSyncStatus(owner, repo);
    
    if (cached?.issues && Array.isArray(cached.issues)) {
      console.log('API: Using cached issues:', { count: cached.issues.length });
      return {
        ...cached,
        lastSyncAt: syncStatus?.lastSyncAt || undefined
      };
    }

    const params = new URLSearchParams({
      owner,
      repo,
      page: page.toString(),
    });

    if (labels && labels.length > 0) {
      params.set('labels', labels.join(','));
    }

    console.log('API: Fetching issues from Supabase...');
    const response = await fetch(`/api/supabase/issues?${params}`);
    if (!response.ok) {
      throw new Error('Failed to fetch issues');
    }

    const data = await response.json();
    console.log('API: Got issues from Supabase:', { count: data.issues?.length || 0 });
    
    // 确保数据格式正确
    const issues = Array.isArray(data.issues) ? data.issues : [];
    const total = typeof data.total === 'number' ? data.total : issues.length;
    
    // 缓存结果
    if (issues.length > 0) {
      console.log('API: Caching issues');
      const cacheData = { issues, total };
      cacheManager?.set(cacheKey, cacheData, { expiry: CACHE_EXPIRY.ISSUES });
    }
    
    return {
      issues,
      total,
      lastSyncAt: syncStatus?.lastSyncAt || undefined
    };
  } catch (error) {
    console.error('Error fetching issues:', error);
    return null;
  }
}

export async function saveIssue(owner: string, repo: string, issue: Issue): Promise<boolean> {
  try {
    const response = await fetch('/api/supabase/issues', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ owner, repo, issue }),
    });

    if (!response.ok) {
      throw new Error('Failed to save issue');
    }

    // 清除相关缓存
    cacheManager?.remove(CACHE_KEYS.ISSUES(owner, repo, 1));
    
    return true;
  } catch (error) {
    console.error('Error saving issue:', error);
    return false;
  }
}

export async function saveIssues(owner: string, repo: string, issues: Issue[]): Promise<boolean> {
  try {
    const response = await fetch('/api/supabase/issues', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ owner, repo, issues }),
    });

    if (!response.ok) {
      throw new Error('Failed to save issues');
    }

    // 清除相关缓存
    cacheManager?.remove(CACHE_KEYS.ISSUES(owner, repo, 1));
    
    return true;
  } catch (error) {
    console.error('Error saving issues:', error);
    return false;
  }
}

// Labels API
export async function getLabels(owner: string, repo: string): Promise<Label[] | null> {
  try {
    const cacheKey = CACHE_KEYS.LABELS(owner, repo);
    const cached = cacheManager?.get<Label[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const params = new URLSearchParams({ owner, repo });
    const response = await fetch(`/api/supabase/labels?${params}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch labels');
    }

    const data = await response.json();
    
    // 缓存结果
    cacheManager?.set(cacheKey, data, { expiry: CACHE_EXPIRY.LABELS });
    
    return data;
  } catch (error) {
    console.error('Error fetching labels:', error);
    return null;
  }
}

export async function saveLabel(owner: string, repo: string, label: Label): Promise<boolean> {
  try {
    const response = await fetch('/api/supabase/labels', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ owner, repo, label }),
    });

    if (!response.ok) {
      const responseData = await response.json();
      console.error(`Failed to save label "${label.name}":`, {
        status: response.status,
        statusText: response.statusText,
        data: responseData
      });
      return false;
    }

    // 清除相关缓存
    cacheManager?.remove(CACHE_KEYS.LABELS(owner, repo));
    return true;
  } catch (error) {
    console.error(`Error saving label "${label.name}":`, error);
    return false;
  }
}

// Sync API
export async function recordSync(
  owner: string,
  repo: string,
  status: SyncStatus,
  issuesSynced: number,
  errorMessage?: string,
  sync_type: 'webhook' | 'full' | 'add' = 'full'
): Promise<boolean> {
  try {
    const response = await fetch('/api/supabase/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        owner,
        repo,
        status,
        issuesSynced,
        errorMessage,
        sync_type
      }),
    });

    if (!response.ok) {
      console.error('Failed to record sync:', await response.text());
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error recording sync:', error);
    return false;
  }
}

export async function checkSyncStatus(owner: string, repo: string): Promise<{
  needsSync: boolean;
  lastSyncAt: string | null;
  status?: SyncStatus;
  issuesSynced?: number;
} | null> {
  try {
    const response = await fetch(`/api/supabase/sync?owner=${owner}&repo=${repo}`);
    
    if (!response.ok) {
      throw new Error('Failed to check sync status');
    }
    
    return response.json();
  } catch (error) {
    console.error('Error checking sync status:', error);
    return null;
  }
}