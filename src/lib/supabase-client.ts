import { Issue, Label } from '@/types/github';
import { cacheManager, CACHE_KEYS, CACHE_EXPIRY, authStore } from './cache';
import { BaseGitHubConfig, ServerGitHubConfig } from '@/types/config';
import { getApiUrl } from './utils';
import { decryptToken, isEncryptedToken } from '@/lib/encryption';
import { debugLog, infoLog, errorLog } from '@/lib/debug';

type SyncStatus = 'success' | 'failed';

// Auth API
export async function verifyPassword(password: string): Promise<boolean> {
  try {
    const response = await fetch(getApiUrl('/api/supabase/auth'), {
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
      authStore.setPasswordVerified(true, CACHE_EXPIRY.PASSWORD);
    }
    return isValid;
  } catch (error) {
    errorLog('Error verifying password:', error);
    return false;
  }
}

export function setPasswordVerified(verified: boolean): void {
  authStore.setPasswordVerified(verified, verified ? CACHE_EXPIRY.PASSWORD : undefined);
}

export function isPasswordVerified(): boolean {
  return authStore.isPasswordVerified();
}

// Config API
export async function getConfig(): Promise<BaseGitHubConfig | null> {
  try {
    // Try to get config from API
    const response = await fetch(getApiUrl('/api/supabase/config'));
    if (!response.ok) {
      throw new Error('Failed to fetch config from API');
    }

    const data = await response.json();
    
    // Return only safe config for client-side use
    const safeConfig: BaseGitHubConfig = {
      owner: data.owner,
      repo: data.repo,
      issuesPerPage: data.issues_per_page || 10
    };
    
    // Cache safe config
    cacheManager?.set(
      CACHE_KEYS.CONFIG(safeConfig.owner, safeConfig.repo),
      safeConfig,
      { expiry: CACHE_EXPIRY.CONFIG }
    );

    return safeConfig;
  } catch (error) {
    errorLog('Error in getConfig:', error);
    throw error;
  }
}

// Server-side only config retrieval
export async function getServerConfig(): Promise<ServerGitHubConfig | null> {
  try {
    // Try to get config from API
    const response = await fetch(getApiUrl('/api/supabase/config'));
    if (!response.ok) {
      throw new Error('Failed to fetch config from API');
    }

    const data = await response.json();
    
    // Handle encrypted token
    let actualToken = data.token;
    if (!actualToken) {
      errorLog('No token found in config data');
      throw new Error('GitHub token not configured');
    }

    if (isEncryptedToken(actualToken)) {
      try {
        actualToken = decryptToken(actualToken);
        debugLog('Token decrypted successfully');
      } catch (error) {
        errorLog('Failed to decrypt token:', error);
        throw new Error('Invalid GitHub token');
      }
    }

    if (typeof actualToken !== 'string' || !actualToken.trim()) {
      throw new Error('Invalid GitHub token');
    }
    
    // Return full config including decrypted token
    return {
      owner: data.owner,
      repo: data.repo,
      issuesPerPage: data.issues_per_page || 10,
      token: actualToken
    };
  } catch (error) {
    errorLog('Error in getServerConfig:', error);
    throw error;
  }
}

export async function saveConfig(config: BaseGitHubConfig): Promise<boolean> {
  try {
    const response = await fetch(getApiUrl('/api/supabase/config'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
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
    
    return true;
  } catch (error) {
    errorLog('Error saving config:', error);
    return false;
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
      infoLog('API: Using cached issues:', { count: cached.issues.length });
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

    debugLog('API: Fetching issues from Supabase...');
    const response = await fetch(getApiUrl(`/api/supabase/issues?${params}`));
    if (!response.ok) {
      throw new Error('Failed to fetch issues');
    }

    const data = await response.json();
    infoLog('API: Got issues from Supabase:', { count: data.issues?.length || 0 });
    
    // 确保数据格式正确
    const issues = Array.isArray(data.issues) ? data.issues : [];
    const total = typeof data.total === 'number' ? data.total : issues.length;
    
    // 缓存结果
    if (issues.length > 0) {
      debugLog('API: Caching issues');
      const cacheData = { issues, total };
      cacheManager?.set(cacheKey, cacheData, { expiry: CACHE_EXPIRY.ISSUES });
    }
    
    return {
      issues,
      total,
      lastSyncAt: syncStatus?.lastSyncAt || undefined
    };
  } catch (error) {
    errorLog('Error fetching issues:', error);
    return null;
  }
}

export async function saveIssue(owner: string, repo: string, issue: Issue): Promise<boolean> {
  try {
    const response = await fetch(getApiUrl('/api/supabase/issues'), {
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
    errorLog('Error saving issue:', error);
    return false;
  }
}

export async function saveIssues(owner: string, repo: string, issues: Issue[]): Promise<boolean> {
  try {
    const response = await fetch(getApiUrl('/api/supabase/issues'), {
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
    errorLog('Error saving issues:', error);
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
    const response = await fetch(getApiUrl(`/api/supabase/labels?${params}`));
    
    if (!response.ok) {
      throw new Error('Failed to fetch labels');
    }

    const data = await response.json();
    
    // 缓存结果
    cacheManager?.set(cacheKey, data, { expiry: CACHE_EXPIRY.LABELS });
    
    return data;
  } catch (error) {
    errorLog('Error fetching labels:', error);
    return null;
  }
}

export async function saveLabel(owner: string, repo: string, label: Label): Promise<boolean> {
  try {
    const response = await fetch(getApiUrl('/api/supabase/labels'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ owner, repo, label }),
    });

    if (!response.ok) {
      const responseData = await response.json();
      errorLog(`Failed to save label "${label.name}":`, {
        status: response.status,
        statusText: response.statusText,
        data: responseData
      });
      return false;
    }

    // Clear related cache
    cacheManager?.remove(CACHE_KEYS.LABELS(owner, repo));
    return true;
  } catch (error) {
    errorLog(`Failed to save label "${label.name}":`, {
      error,
      label,
      owner,
      repo,
    });
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
    const response = await fetch(getApiUrl('/api/supabase/sync'), {
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
      errorLog('Failed to record sync:', await response.text());
      return false;
    }
    
    return true;
  } catch (error) {
    errorLog('Error recording sync:', error);
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
    const response = await fetch(getApiUrl(`/api/supabase/sync?owner=${owner}&repo=${repo}`));
    
    if (!response.ok) {
      throw new Error('Failed to check sync status');
    }
    
    return response.json();
  } catch (error) {
    errorLog('Error checking sync status:', error);
    return null;
  }
}

export async function syncIssues(owner: string, repo: string): Promise<SyncStatus> {
  try {
    const response = await fetch(getApiUrl('/api/supabase/sync'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ owner, repo }),
    });

    if (!response.ok) {
      throw new Error('Failed to sync issues');
    }

    const data = await response.json();
    return data.status;
  } catch (error) {
    errorLog('Error syncing issues:', error);
    return 'failed';
  }
}