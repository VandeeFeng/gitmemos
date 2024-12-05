import { NextResponse } from 'next/server';
import { Octokit } from 'octokit';
import { getGitHubConfig } from '@/lib/github';
import { Issue, CreateIssueInput, UpdateIssueInput } from '@/types/github';
import { syncIssuesData, getIssuesFromDb } from '@/lib/db';
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
        const issues = await getIssuesFromDb(config.owner, config.repo);
        const issueFromDb = issues.find(issue => issue.number === issueNum);
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
      const client = await getOctokit();
      const { data } = await client.rest.issues.get({
        owner: config.owner,
        repo: config.repo,
        issue_number: issueNum,
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
      await syncIssuesData(config.owner, config.repo, [issue]);

      return NextResponse.json(issue);
    } else {
      // Get issues list
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
      await syncIssuesData(config.owner, config.repo, issues);

      return NextResponse.json(issues);
    }
  } catch (error) {
    console.error('Error fetching issues:', error);
    return NextResponse.json(
      { error: 'Failed to fetch issues' },
      { status: 500 }
    );
  }
}

// POST /api/github/issues
export async function POST(request: Request) {
  try {
    const body: CreateIssueInput = await request.json();
    const config = await getGitHubConfig();
    const client = await getOctokit();

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
    await syncIssuesData(config.owner, config.repo, [issue]);

    return NextResponse.json(issue);
  } catch (error) {
    console.error('Error creating issue:', error);
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
    const client = await getOctokit();

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
    await syncIssuesData(config.owner, config.repo, [issue]);

    return NextResponse.json(issue);
  } catch (error) {
    console.error('Error updating issue:', error);
    return NextResponse.json(
      { error: 'Failed to update issue' },
      { status: 500 }
    );
  }
} 