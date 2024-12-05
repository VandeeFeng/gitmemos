import { NextResponse } from 'next/server';
import { Octokit } from 'octokit';
import { getGitHubConfig } from '@/lib/github';
import { Label } from '@/types/github';
import { getLabels, saveLabel } from '@/lib/api';
import { cacheManager, CACHE_KEYS, CACHE_EXPIRY } from '@/lib/cache';

// Helper function to get Octokit instance
async function getOctokit() {
  const config = await getGitHubConfig();
  if (!config.token) {
    throw new Error('GitHub token is missing');
  }
  return new Octokit({ auth: config.token });
}

// GET /api/github/labels
export async function GET() {
  try {
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

    // First check cache
    const cacheKey = CACHE_KEYS.LABELS(config.owner, config.repo);
    const cachedLabels = cacheManager?.get<Label[]>(cacheKey);
    if (cachedLabels) {
      console.log('Using cached labels data');
      return NextResponse.json(cachedLabels);
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
    } catch (error) {
      console.warn('Failed to check database for labels:', error);
    }

    // If not found in cache or database, fetch from GitHub API
    console.log('Fetching labels from GitHub API...');
    const client = await getOctokit();
    
    try {
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
    } catch (error: unknown) {
      const err = error as GitHubApiError;
      console.error('GitHub API error:', err.response?.data || error);
      return NextResponse.json(
        { error: err.response?.data?.message || 'Failed to fetch labels from GitHub' },
        { status: err.response?.status || 500 }
      );
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error in labels route:', error);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch labels' },
      { status: 500 }
    );
  }
}

// POST /api/github/labels
export async function POST(request: Request) {
  try {
    const { name, color, description } = await request.json();
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
      const { data } = await client.rest.issues.createLabel({
        owner: config.owner,
        repo: config.repo,
        name,
        color: color.replace('#', ''), // GitHub API expects color without #
        description
      });

      const label: Label = {
        id: data.id,
        name: data.name,
        color: data.color,
        description: data.description || null
      };

      // Save to database
      await saveLabel(config.owner, config.repo, label);

      // Update cache if it exists
      const cacheKey = CACHE_KEYS.LABELS(config.owner, config.repo);
      const cachedLabels = cacheManager?.get<Label[]>(cacheKey);
      if (cachedLabels) {
        const updatedLabels = [...cachedLabels, label];
        cacheManager?.set(cacheKey, updatedLabels, { expiry: CACHE_EXPIRY.LABELS });
      }

      return NextResponse.json(label);
    } catch (error: unknown) {
      const err = error as GitHubApiError;
      console.error('GitHub API error:', err.response?.data || error);
      return NextResponse.json(
        { error: err.response?.data?.message || 'Failed to create label on GitHub' },
        { status: err.response?.status || 500 }
      );
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error in create label route:', error);
    return NextResponse.json(
      { error: err.message || 'Failed to create label' },
      { status: 500 }
    );
  }
} 