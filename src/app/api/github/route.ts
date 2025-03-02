import { NextResponse } from 'next/server';
import { Octokit } from 'octokit';
import { getServerConfig } from '@/lib/supabase-client';
import { errorLog } from '@/lib/debug';
import { GitHubApiParams, GitHubApiResponse } from '@/types/github';

// Helper function to get Octokit instance
async function getOctokit() {
  const config = await getServerConfig();
  if (!config?.token) {
    throw new Error('GitHub token not configured');
  }

  return new Octokit({ auth: config.token });
}

// Generic handler for GitHub API calls
export async function POST(request: Request) {
  try {
    const { endpoint, params } = await request.json();
    const octokit = await getOctokit();

    // Call GitHub API using the provided endpoint and params
    const [namespace, method] = endpoint.split('.');
    const rest = octokit.rest;

    if (!namespace || !method || !(namespace in rest)) {
      return NextResponse.json(
        { error: `Invalid endpoint: ${endpoint}` },
        { status: 400 }
      );
    }

    // Use type assertion for dynamic method access
    const apiNamespace = rest[namespace as keyof typeof rest];
    if (!(method in apiNamespace)) {
      return NextResponse.json(
        { error: `Invalid method: ${method}` },
        { status: 400 }
      );
    }

    const apiMethod = apiNamespace[method as keyof typeof apiNamespace] as (params: GitHubApiParams) => Promise<GitHubApiResponse>;
    const response = await apiMethod(params);
    return NextResponse.json(response.data);
  } catch (error) {
    errorLog('Error calling GitHub API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to call GitHub API' },
      { status: 500 }
    );
  }
} 