import { NextResponse } from 'next/server';
import { Octokit } from 'octokit';
import { getGitHubConfig } from '@/lib/github';
import { Label } from '@/types/github';
import { saveLabel, getLabelsFromDb } from '@/lib/db';
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
      const dbLabels = await getLabelsFromDb(config.owner, config.repo);
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
  } catch (error) {
    console.error('Error fetching labels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch labels' },
      { status: 500 }
    );
  }
}

// POST /api/github/labels
export async function POST(request: Request) {
  try {
    const { name, color, description } = await request.json();
    const config = await getGitHubConfig();
    const client = await getOctokit();

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
  } catch (error) {
    console.error('Error creating label:', error);
    return NextResponse.json(
      { error: 'Failed to create label' },
      { status: 500 }
    );
  }
} 