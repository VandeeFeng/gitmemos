import { NextResponse } from 'next/server';
import { getGitHubConfig } from '@/lib/github';
import { Label } from '@/types/github';
import { getLabels, saveLabel } from '@/lib/supabase-client';
import { cacheManager, CACHE_KEYS, CACHE_EXPIRY } from '@/lib/cache';
import { fetchLabels, createGitHubLabel } from '@/lib/github-api';

// GET /api/github/labels
export async function GET() {
  try {
    const config = await getGitHubConfig();
    console.log('GitHub config:', { owner: config.owner, repo: config.repo });

    if (!config.owner || !config.repo) {
      console.error('Missing owner or repo in config');
      return NextResponse.json(
        { error: 'Missing owner or repo in config' },
        { status: 400 }
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

    // If not found in cache or database, fetch from GitHub API
    try {
      console.log('Fetching labels from GitHub API...');
      const labels = await fetchLabels(config.owner, config.repo);

      // Update cache
      cacheManager?.set(cacheKey, labels, { expiry: CACHE_EXPIRY.LABELS });

      // Save to database
      for (const label of labels) {
        await saveLabel(config.owner, config.repo, label);
      }

      return NextResponse.json(labels);
    } catch (err) {
      console.error('GitHub API error:', err);
      return NextResponse.json(
        { error: 'Failed to fetch labels from GitHub' },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error('Error in labels route:', err);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

// POST /api/github/labels
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const config = await getGitHubConfig();

    if (!config.owner || !config.repo) {
      return NextResponse.json(
        { error: 'Missing owner or repo in config' },
        { status: 400 }
      );
    }

    try {
      const label = await createGitHubLabel(
        config.owner,
        config.repo,
        body.name,
        body.color,
        body.description
      );

      // Save to database
      await saveLabel(config.owner, config.repo, label);

      return NextResponse.json(label);
    } catch (err) {
      console.error('GitHub API error:', err);
      return NextResponse.json(
        { error: 'Failed to create label on GitHub' },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error('Error in create label route:', err);
    return NextResponse.json(
      { error: 'Failed to create label' },
      { status: 500 }
    );
  }
} 