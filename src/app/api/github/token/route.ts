import { NextResponse } from 'next/server';
import { Octokit } from 'octokit';
import { getServerConfig } from '@/lib/supabase-client';
import { errorLog } from '@/lib/debug';

// Helper function to validate GitHub token
async function validateGitHubToken(token: string): Promise<boolean> {
  try {
    const octokit = new Octokit({ auth: token });
    // Try to get the authenticated user to verify token
    await octokit.rest.users.getAuthenticated();
    return true;
  } catch (error) {
    errorLog('Token validation failed:', error);
    return false;
  }
}

export async function GET() {
  try {
    // Get config from database or environment
    const config = await getServerConfig();
    if (!config || !config.token) {
      errorLog('GitHub token not found in configuration');
      return NextResponse.json(
        { error: 'GitHub token not configured' },
        { status: 500 }
      );
    }

    // Validate the token
    const isValid = await validateGitHubToken(config.token);
    if (!isValid) {
      errorLog('Invalid GitHub token');
      return NextResponse.json(
        { error: 'Invalid GitHub token' },
        { status: 401 }
      );
    }

    // Return success
    return NextResponse.json({ isValid: true });
  } catch (error) {
    errorLog('Error validating token:', error);
    return NextResponse.json(
      { error: 'Failed to validate token' },
      { status: 500 }
    );
  }
} 