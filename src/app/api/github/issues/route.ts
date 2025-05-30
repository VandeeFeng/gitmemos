import { NextResponse } from 'next/server';
import { getGitHubConfig } from '@/lib/github';
import { Issue, UpdateIssueInput } from '@/types/github';
import { getIssues, saveIssue, saveIssues, checkSyncStatus, recordSync } from '@/lib/supabase-client';
import { cacheManager, CACHE_KEYS, CACHE_EXPIRY } from '@/lib/cache';
import { fetchIssues, createGitHubIssue, updateGitHubIssue } from '@/lib/github-api';
import { debugLog, warnLog, errorLog } from '@/lib/debug';

// GET /api/github/issues
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');
    const forceSync = searchParams.get('forceSync') === 'true';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const labels = searchParams.get('labels');

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Missing owner or repo parameter' },
        { status: 400 }
      );
    }

    // 获取同步状态
    const syncStatus = await checkSyncStatus(owner, repo);
    const lastSyncAt = syncStatus?.lastSyncAt;
    const isFullSync = forceSync || !lastSyncAt;

    // If not a forced sync, try to get from cache first
    if (!isFullSync) {
      const cacheKey = CACHE_KEYS.ISSUES(owner, repo, page, labels || '');
      const cached = cacheManager?.get<{ issues: Issue[] }>(cacheKey);
      if (cached?.issues) {
        debugLog('Using cached issues');
        // Record sync status (even when using cache)
        const now = new Date().toISOString();
        await recordSync(owner, repo, 'success', 0, undefined, 'add');
        return NextResponse.json({
          issues: cached.issues,
          syncStatus: {
            success: true,
            totalSynced: 0,
            lastSyncAt: now
          }
        });
      }

      // If no cache, try to get from database
      try {
        debugLog('Trying to find issues in database...');
        const response = await getIssues(owner, repo);
        const dbIssues = response?.issues || [];
        if (dbIssues.length > 0) {
          debugLog('Found issues in database');
          // Update cache
          cacheManager?.set(cacheKey, { issues: dbIssues }, { expiry: CACHE_EXPIRY.ISSUES });
          // Record sync status (even when using database data)
          const now = new Date().toISOString();
          await recordSync(owner, repo, 'success', 0, undefined, 'add');
          return NextResponse.json({
            issues: dbIssues,
            syncStatus: {
              success: true,
              totalSynced: 0,
              lastSyncAt: now
            }
          });
        }
      } catch (err) {
        warnLog('Failed to check database for issues:', err);
      }
    }

    // Get data from GitHub API
    debugLog(isFullSync ? 'Performing full sync...' : `Performing incremental sync since ${lastSyncAt}`);
    const issues = await fetchIssues(
      owner,
      repo,
      page,
      labels || undefined,
      isFullSync,
      lastSyncAt || undefined
    );

    // For incremental sync, if no updates found
    if (!isFullSync && issues.length === 0) {
      debugLog('No updates found since last sync');
      const now = new Date().toISOString();
      // Record sync status (even when no updates)
      await recordSync(owner, repo, 'success', 0, undefined, 'add');
      return NextResponse.json({
        issues: [],
        syncStatus: {
          success: true,
          totalSynced: 0,
          lastSyncAt: now
        }
      });
    }

    // Save to database
    const saveResult = await saveIssues(owner, repo, issues);
    if (!saveResult) {
      throw new Error('Failed to save issues to database');
    }

    // Update cache
    const cacheKey = CACHE_KEYS.ISSUES(owner, repo, page, labels || '');
    cacheManager?.set(cacheKey, { issues }, { expiry: CACHE_EXPIRY.ISSUES });

    // Record sync status
    const now = new Date().toISOString();
    await recordSync(
      owner,
      repo,
      'success',
      issues.length,
      undefined,
      isFullSync ? 'full' : 'add'
    );

    return NextResponse.json({
      issues,
      syncStatus: {
        success: true,
        totalSynced: issues.length,
        lastSyncAt: now
      }
    });
  } catch (error) {
    errorLog('Error in GET /api/github/issues:', error);
    
    // Record sync failure
    const owner = new URL(request.url).searchParams.get('owner');
    const repo = new URL(request.url).searchParams.get('repo');
    if (owner && repo) {
      await recordSync(
        owner,
        repo,
        'failed',
        0,
        error instanceof Error ? error.message : 'Unknown error',
        'full'
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch issues' },
      { status: 500 }
    );
  }
}

// POST /api/github/issues
export async function POST(request: Request) {
  try {
    const { owner, repo, issue } = await request.json();
    const config = await getGitHubConfig();

    if (!config.owner || !config.repo) {
      return NextResponse.json(
        { error: 'Missing owner or repo in config' },
        { status: 400 }
      );
    }

    if (!issue || !issue.title) {
      return NextResponse.json(
        { error: 'Missing required issue fields' },
        { status: 400 }
      );
    }

    try {
      const createdIssue = await createGitHubIssue(
        owner || config.owner,
        repo || config.repo,
        issue.title,
        issue.body || '',
        (issue.labels || []).map((l: { name: string }) => l.name)
      );

      // Sync to database
      await saveIssue(config.owner, config.repo, createdIssue);

      return NextResponse.json(createdIssue);
    } catch (err) {
      errorLog('GitHub API error:', err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to create issue on GitHub' },
        { status: 500 }
      );
    }
  } catch (err) {
    errorLog('Error in create issue route:', err);
    return NextResponse.json(
      { error: 'Failed to create issue' },
      { status: 500 }
    );
  }
}

// PATCH /api/github/issues
export async function PATCH(request: Request) {
  try {
    const body: UpdateIssueInput = await request.json();
    const config = await getGitHubConfig();
    debugLog('Update issue - GitHub config:', { owner: config.owner, repo: config.repo });

    if (!config.owner || !config.repo) {
      errorLog('Missing owner or repo in config');
      return NextResponse.json(
        { error: 'Missing owner or repo in config' },
        { status: 400 }
      );
    }

    try {
      const issue = await updateGitHubIssue(
        config.owner,
        config.repo,
        body.number,
        body.title,
        body.body,
        body.labels || []
      );

      // Sync to database
      await saveIssue(config.owner, config.repo, issue);

      return NextResponse.json(issue);
    } catch (err) {
      errorLog('GitHub API error:', err);
      return NextResponse.json(
        { error: 'Failed to update issue on GitHub' },
        { status: 500 }
      );
    }
  } catch (err) {
    errorLog('Error in update issue route:', err);
    return NextResponse.json(
      { error: 'Failed to update issue' },
      { status: 500 }
    );
  }
} 