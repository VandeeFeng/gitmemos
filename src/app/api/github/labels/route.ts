import { NextResponse } from 'next/server';
import { Octokit } from 'octokit';
import { getGitHubConfig, getGitHubToken } from '@/lib/github';
import { Label, GitHubApiError } from '@/types/github';
import { getLabels, saveLabel } from '@/lib/api';
import { cacheManager, CACHE_KEYS, CACHE_EXPIRY } from '@/lib/cache';

// Helper function to get Octokit instance
async function getOctokit() {
  const token = await getGitHubToken();
  return new Octokit({ auth: token });
}

// GET /api/github/labels
export async function GET() {
  try {
    const config = await getGitHubConfig();
    const token = await getGitHubToken();
    console.log('GitHub config:', { owner: config.owner, repo: config.repo, hasToken: !!token });

    if (!config.owner || !config.repo) {
      console.error('Missing owner or repo in config');
      return NextResponse.json(
        { error: 'Missing owner or repo in config' },
        { status: 400 }
      );
    }

    if (!token) {
      console.error('Missing GitHub token');
      return NextResponse.json(
        { error: 'GitHub token is missing' },
        { status: 401 }
      );
    }

    // First check cache
    const cacheKey = CACHE_KEYS.LABELS(config.owner, config.repo);
    const cached = cacheManager?.get<Label[]>(cacheKey);
    if (cached) {
      console.log('Using cached labels');
      return NextResponse.json(cached);
    }

    // Then check database
    try {
      console.log('Trying to find labels in database...');
      const dbLabels = await getLabels(config.owner, config.repo);
      if (dbLabels && dbLabels.length > 0) {
        console.log('Found labels in database');
        // Update cache
        cacheManager?.set(cacheKey, dbLabels, { expiry: CACHE_EXPIRY.LABELS });
        return NextResponse.json(dbLabels);
      }
    } catch (err) {
      console.warn('Failed to check database for labels:', err);
    }

    // If not in cache or database, fetch from GitHub API
    try {
      console.log('Fetching labels from GitHub API...');
      const client = await getOctokit();
      const { data } = await client.rest.issues.listLabelsForRepo({
        owner: config.owner,
        repo: config.repo,
      });

      const labels = data.map(label => ({
        id: label.id,
        name: label.name,
        color: label.color,
        description: label.description,
      }));

      // Update cache
      cacheManager?.set(cacheKey, labels, { expiry: CACHE_EXPIRY.LABELS });

      // Save to database
      for (const label of labels) {
        await saveLabel(config.owner, config.repo, label);
      }

      return NextResponse.json(labels);
    } catch (err) {
      console.error('GitHub API error:', (err as GitHubApiError).response?.data || err);
      return NextResponse.json(
        { error: (err as GitHubApiError).response?.data?.message || 'Failed to fetch labels from GitHub' },
        { status: (err as GitHubApiError).response?.status || 500 }
      );
    }
  } catch (err) {
    console.error('Error in labels route:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to fetch labels' },
      { status: 500 }
    );
  }
}

// POST /api/github/labels
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const config = await getGitHubConfig();
    const token = await getGitHubToken();

    if (!config.owner || !config.repo) {
      return NextResponse.json(
        { error: 'Missing owner or repo in config' },
        { status: 400 }
      );
    }

    if (!token) {
      return NextResponse.json(
        { error: 'GitHub token is missing' },
        { status: 401 }
      );
    }

    const client = await getOctokit();

    try {
      const { data } = await client.rest.issues.createLabel({
        owner: config.owner,
        repo: config.repo,
        name: body.name,
        color: body.color,
        description: body.description
      });

      const label: Label = {
        id: data.id,
        name: data.name,
        color: data.color,
        description: data.description,
      };

      // Save to database
      await saveLabel(config.owner, config.repo, label);

      return NextResponse.json(label);
    } catch (err) {
      console.error('GitHub API error:', (err as GitHubApiError).response?.data || err);
      return NextResponse.json(
        { error: (err as GitHubApiError).response?.data?.message || 'Failed to create label on GitHub' },
        { status: (err as GitHubApiError).response?.status || 500 }
      );
    }
  } catch (err) {
    console.error('Error in create label route:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to create label' },
      { status: 500 }
    );
  }
} 