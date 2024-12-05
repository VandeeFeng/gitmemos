import { NextResponse } from 'next/server';
import { Octokit } from 'octokit';
import { getGitHubConfig } from '@/lib/github';
import { Issue, CreateIssueInput, UpdateIssueInput } from '@/types/github';
import { getIssues, saveIssue } from '@/lib/api';
import { cacheManager, CACHE_KEYS, CACHE_EXPIRY } from '@/lib/cache';

// Helper function to get Octokit instance
async function getOctokit() {
  const config = await getGitHubConfig();
  if (!config.token) {
    throw new Error('GitHub token is missing');
  }
  return new Octokit({ auth: config.token });
}

// GET /api/github/issues
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const labels = searchParams.get('labels');
    const issueNumber = searchParams.get('number');

    const config = await getGitHubConfig();
    console.log('GitHub config:', { owner: config.owner, repo: config.repo, hasToken: !!config.token });

    if (!config.owner || !config.repo) {
      console.error('Missing owner or repo in config');
      return NextResponse.json(
        { error: 'Missing owner or repo in config' },
        { status: 400 }
      );
    }

    if (!config.token) {
      console.error('Missing GitHub token in config');
      return NextResponse.json(
        { error: 'GitHub token is missing' },
        { status: 401 }
      );
    }

    if (issueNumber) {
      // Get single issue
      const issueNum = parseInt(issueNumber);

      // First check the issues list cache
      const issuesListCacheKey = CACHE_KEYS.ISSUES(config.owner, config.repo, 1, '');
      const cachedData = cacheManager?.get<{ issues: Issue[] }>(issuesListCacheKey);
      if (cachedData?.issues) {
        const issueFromList = cachedData.issues.find(issue => issue.number === issueNum);
        if (issueFromList) {
          console.log('Found issue in issues list cache');
          return NextResponse.json(issueFromList);
        }
      }

      // Then check the individual issue cache
      const singleIssueCacheKey = `issue:${config.owner}:${config.repo}:${issueNum}`;
      const cachedSingleIssue = cacheManager?.get<Issue>(singleIssueCacheKey);
      if (cachedSingleIssue) {
        console.log('Using cached single issue data');
        return NextResponse.json(cachedSingleIssue);
      }

      // Try to find in database
      try {
        console.log('Trying to find issue in database...');
        const response = await getIssues(config.owner, config.repo);
        const issueFromDb = response?.issues.find(issue => issue.number === issueNum);
        if (issueFromDb) {
          console.log('Found issue in database');
          // Update cache
          cacheManager?.set(singleIssueCacheKey, issueFromDb, { expiry: CACHE_EXPIRY.ISSUES });
          return NextResponse.json(issueFromDb);
        }
      } catch (error) {
        console.warn('Failed to check database for issue:', error);
      }

      // If not found in cache or database, fetch from GitHub API
      try {
        console.log('Fetching single issue from GitHub API...');
        const client = await getOctokit();
        const { data } = await client.rest.issues.get({
          owner: config.owner,
          repo: config.repo,
          issue_number: issueNum
        });

        const issue: Issue = {
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
            }))
        };

        // Update both caches
        cacheManager?.set(singleIssueCacheKey, issue, { expiry: CACHE_EXPIRY.ISSUES });

        // Also update the issues list cache if it exists
        if (cachedData?.issues) {
          const updatedIssues = cachedData.issues.map(i => 
            i.number === issue.number ? issue : i
          );
          cacheManager?.set(issuesListCacheKey, { issues: updatedIssues }, { expiry: CACHE_EXPIRY.ISSUES });
        }

        // Sync to database
        await saveIssue(config.owner, config.repo, issue);

        return NextResponse.json(issue);
      } catch (error: any) {
        console.error('GitHub API error (single issue):', error.response?.data || error);
        return NextResponse.json(
          { error: error.response?.data?.message || 'Failed to fetch issue from GitHub' },
          { status: error.response?.status || 500 }
        );
      }
    } else {
      // Get issues list
      try {
        console.log('Fetching issues list from GitHub API...');
        const client = await getOctokit();
        const { data } = await client.rest.issues.listForRepo({
          owner: config.owner,
          repo: config.repo,
          state: 'all',
          per_page: 50,
          page,
          sort: 'created',
          direction: 'desc',
          labels: labels || undefined
        });

        const issues = data.map(issue => ({
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

        // Update cache
        const cacheKey = CACHE_KEYS.ISSUES(config.owner, config.repo, page, labels || '');
        cacheManager?.set(cacheKey, { issues }, { expiry: CACHE_EXPIRY.ISSUES });

        // Sync to database
        for (const issue of issues) {
          await saveIssue(config.owner, config.repo, issue);
        }

        return NextResponse.json(issues);
      } catch (error: any) {
        console.error('GitHub API error (issues list):', error.response?.data || error);
        return NextResponse.json(
          { error: error.response?.data?.message || 'Failed to fetch issues from GitHub' },
          { status: error.response?.status || 500 }
        );
      }
    }
  } catch (error: any) {
    console.error('Error in issues route:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch issues' },
      { status: 500 }
    );
  }
}

// POST /api/github/issues
export async function POST(request: Request) {
  try {
    const body: CreateIssueInput = await request.json();
    const config = await getGitHubConfig();

    if (!config.owner || !config.repo) {
      return NextResponse.json(
        { error: 'Missing owner or repo in config' },
        { status: 400 }
      );
    }

    if (!config.token) {
      return NextResponse.json(
        { error: 'GitHub token is missing' },
        { status: 401 }
      );
    }

    const client = await getOctokit();

    try {
      const { data } = await client.rest.issues.create({
        owner: config.owner,
        repo: config.repo,
        title: body.title,
        body: body.body,
        labels: body.labels
      });

      const issue: Issue = {
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
          }))
      };

      // Sync to database
      await saveIssue(config.owner, config.repo, issue);

      return NextResponse.json(issue);
    } catch (error: any) {
      console.error('GitHub API error:', error.response?.data || error);
      return NextResponse.json(
        { error: error.response?.data?.message || 'Failed to create issue on GitHub' },
        { status: error.response?.status || 500 }
      );
    }
  } catch (error: any) {
    console.error('Error in create issue route:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create issue' },
      { status: 500 }
    );
  }
}

// PATCH /api/github/issues
export async function PATCH(request: Request) {
  try {
    const body: UpdateIssueInput = await request.json();
    const config = await getGitHubConfig();

    if (!config.owner || !config.repo) {
      return NextResponse.json(
        { error: 'Missing owner or repo in config' },
        { status: 400 }
      );
    }

    if (!config.token) {
      return NextResponse.json(
        { error: 'GitHub token is missing' },
        { status: 401 }
      );
    }

    const client = await getOctokit();

    try {
      const { data } = await client.rest.issues.update({
        owner: config.owner,
        repo: config.repo,
        issue_number: body.number,
        title: body.title,
        body: body.body,
        labels: body.labels
      });

      const issue: Issue = {
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
          }))
      };

      // Sync to database
      await saveIssue(config.owner, config.repo, issue);

      return NextResponse.json(issue);
    } catch (error: any) {
      console.error('GitHub API error:', error.response?.data || error);
      return NextResponse.json(
        { error: error.response?.data?.message || 'Failed to update issue on GitHub' },
        { status: error.response?.status || 500 }
      );
    }
  } catch (error: any) {
    console.error('Error in update issue route:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update issue' },
      { status: 500 }
    );
  }
} 