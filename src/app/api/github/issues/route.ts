import { NextResponse } from 'next/server';
import { getGitHubConfig } from '@/lib/github';
import { Issue, UpdateIssueInput } from '@/types/github';
import { getIssues, saveIssue, checkSyncStatus, recordSync } from '@/lib/supabase-client';
import { cacheManager, CACHE_KEYS, CACHE_EXPIRY } from '@/lib/cache';
import { fetchIssues, fetchIssue, createGitHubIssue, updateGitHubIssue } from '@/lib/github-api';

// Helper function to check if sync is needed
async function checkNeedsSync(owner: string, repo: string, forceSync: boolean): Promise<boolean> {
  // If force sync is requested, return true
  if (forceSync) return true;

  // Check sync status from the database
  const syncStatus = await checkSyncStatus(owner, repo);
  return syncStatus?.needsSync ?? true;
}

// GET /api/github/issues
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const labels = searchParams.get('labels');
    const issueNumber = searchParams.get('number');
    const forceSync = searchParams.get('forceSync') === 'true';
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');

    // 如果提供了 owner 和 repo，使用它们，否则从配置中获取
    const config = await getGitHubConfig();
    const effectiveOwner = owner || config.owner;
    const effectiveRepo = repo || config.repo;

    console.log('GitHub config:', { owner: effectiveOwner, repo: effectiveRepo });

    if (!effectiveOwner || !effectiveRepo) {
      console.error('Missing owner or repo');
      return NextResponse.json(
        { error: 'Missing owner or repo' },
        { status: 400 }
      );
    }

    if (issueNumber) {
      const issueNum = parseInt(issueNumber);
      // Get single issue
      const singleIssueCacheKey = CACHE_KEYS.SINGLE_ISSUE(effectiveOwner, effectiveRepo, issueNum);
      const cached = cacheManager?.get<Issue>(singleIssueCacheKey);
      if (cached && !forceSync) {
        console.log('Using cached single issue');
        return NextResponse.json(cached);
      }

      try {
        console.log('Fetching single issue from GitHub API...');
        const issue = await fetchIssue(effectiveOwner, effectiveRepo, issueNum);

        // Update cache
        cacheManager?.set(singleIssueCacheKey, issue, { expiry: CACHE_EXPIRY.ISSUES });

        // Sync to database
        await saveIssue(effectiveOwner, effectiveRepo, issue);

        return NextResponse.json(issue);
      } catch (err) {
        console.error('GitHub API error (single issue):', err);
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'Failed to fetch issue from GitHub' },
          { status: 500 }
        );
      }
    }

    // Get issues list
    try {
      // Check if sync is needed
      const needsSync = await checkNeedsSync(effectiveOwner, effectiveRepo, forceSync);
      
      // If not force sync and doesn't need sync, try cache first
      if (!forceSync && !needsSync) {
        const cacheKey = CACHE_KEYS.ISSUES(effectiveOwner, effectiveRepo, page, labels || '');
        const cached = cacheManager?.get<{ issues: Issue[] }>(cacheKey);
        if (cached?.issues) {
          console.log('Using cached issues');
          return NextResponse.json({
            issues: cached.issues,
            syncStatus: null
          });
        }

        // Try database if not in cache
        try {
          console.log('Trying to find issues in database...');
          const response = await getIssues(effectiveOwner, effectiveRepo);
          const dbIssues = response?.issues || [];
          if (dbIssues.length > 0) {
            console.log('Found issues in database');
            // Update cache
            cacheManager?.set(cacheKey, { issues: dbIssues }, { expiry: CACHE_EXPIRY.ISSUES });
            return NextResponse.json({
              issues: dbIssues,
              syncStatus: null
            });
          }
        } catch (err) {
          console.warn('Failed to check database for issues:', err);
        }
      }

      // Get sync status for incremental sync
      const syncStatus = await checkSyncStatus(effectiveOwner, effectiveRepo);
      const lastSyncAt = syncStatus?.lastSyncAt;

      console.log('Fetching issues from GitHub API...');
      try {
        const issues = await fetchIssues(
          effectiveOwner,
          effectiveRepo,
          page,
          labels || undefined,
          forceSync,
          lastSyncAt || undefined
        );

        // For incremental sync, if no updates found
        const isIncrementalSync = !forceSync && lastSyncAt && !labels;
        if (isIncrementalSync && issues.length === 0) {
          console.log('No updates found since last sync');
          await recordSync(
            effectiveOwner,
            effectiveRepo,
            'success',
            0,
            undefined,
            'add'
          );
          return NextResponse.json({
            issues: [],
            syncStatus: {
              success: true,
              totalSynced: 0,
              lastSyncAt: new Date().toISOString()
            }
          });
        }

        // Update cache
        const cacheKey = CACHE_KEYS.ISSUES(effectiveOwner, effectiveRepo, page, labels || '');
        cacheManager?.set(cacheKey, { issues }, { expiry: CACHE_EXPIRY.ISSUES });

        // Sync to database
        for (const issue of issues) {
          await saveIssue(effectiveOwner, effectiveRepo, issue);
        }

        // Record sync status
        await recordSync(
          effectiveOwner,
          effectiveRepo,
          'success',
          issues.length,
          undefined,
          forceSync ? 'full' : 'add'
        );

        return NextResponse.json({
          issues,
          syncStatus: {
            success: true,
            totalSynced: issues.length,
            lastSyncAt: new Date().toISOString()
          }
        });
      } catch (err) {
        console.error('GitHub API error:', err);
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'Failed to fetch issues from GitHub' },
          { status: 500 }
        );
      }
    } catch (err) {
      console.error('GitHub API error (issues list):', err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to fetch issues from GitHub' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in issues route:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process request' },
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
      console.error('GitHub API error:', err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to create issue on GitHub' },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error('Error in create issue route:', err);
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
    console.log('Update issue - GitHub config:', { owner: config.owner, repo: config.repo });

    if (!config.owner || !config.repo) {
      console.error('Missing owner or repo in config');
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
      console.error('GitHub API error:', err);
      return NextResponse.json(
        { error: 'Failed to update issue on GitHub' },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error('Error in update issue route:', err);
    return NextResponse.json(
      { error: 'Failed to update issue' },
      { status: 500 }
    );
  }
} 