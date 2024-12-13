import { Database } from '@/types/supabase';
import { Issue, Label } from '@/types/github';
import { cacheManager, CACHE_KEYS, CACHE_EXPIRY } from './cache';

type Config = Database['public']['Tables']['configs']['Row'];
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
export async function getConfig(): Promise<Config | null> {
  try {
    console.log('Fetching config from API...');
    const response = await fetch('/api/supabase/config');
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('Config API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData?.error || 'Unknown error'
      });
      throw new Error('Failed to fetch config: ' + (errorData?.error || response.statusText));
    }
    
    const data = await response.json();
    console.log('Config API response:', {
      hasData: !!data,
      hasOwner: !!data?.owner,
      hasRepo: !!data?.repo,
      hasToken: !!data?.token
    });
    
    // 缓存配置
    if (data) {
      cacheManager?.set(
        CACHE_KEYS.CONFIG(data.owner, data.repo),
        data,
        { expiry: CACHE_EXPIRY.CONFIG }
      );
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching config:', error);
    throw error;
  }
}

export async function saveConfig(config: Omit<Config, 'id' | 'created_at' | 'updated_at'>): Promise<Config | null> {
  try {
    const response = await fetch('/api/supabase/config', {
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
    
    // 更新缓存
    if (data) {
      cacheManager?.set(
        CACHE_KEYS.CONFIG(data.owner, data.repo),
        data,
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
    
    // 检查同步状态
    const syncStatus = await checkSyncStatus(owner, repo);
    const needsSync = syncStatus?.needsSync ?? true;
    
    // 如果需要同步（超过24小时或从未同步）
    if (needsSync) {
      console.log('Auto syncing due to outdated or missing sync status...');
      // 从 GitHub API 获取数据
      const response = await fetch('/api/github/issues');
      if (!response.ok) {
        throw new Error('Failed to sync with GitHub');
      }
      // 清除缓存
      cacheManager?.remove(cacheKey);
    } else if (syncStatus?.lastSyncAt) {
      console.log('Last sync time:', new Date(syncStatus.lastSyncAt).toLocaleString());
    }
    
    if (cached && !needsSync) {
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

    const response = await fetch(`/api/supabase/issues?${params}`);
    if (!response.ok) {
      throw new Error('Failed to fetch issues');
    }

    const data = await response.json();
    
    // 缓存结果
    cacheManager?.set(cacheKey, data, { expiry: CACHE_EXPIRY.ISSUES });
    
    return {
      ...data,
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
  errorMessage?: string
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
        errorMessage
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