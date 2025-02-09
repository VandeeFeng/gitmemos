import { NextResponse } from 'next/server';
import { Octokit } from 'octokit';

// Helper function to verify request origin
async function isValidOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  
  // Allow only requests from our own domain
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    'http://localhost:3000',
  ].filter(Boolean);

  return allowedOrigins.some(allowed => 
    origin === allowed || referer?.startsWith(allowed || '')
  );
}

// Helper function to validate GitHub token
async function validateGitHubToken(token: string): Promise<boolean> {
  try {
    const octokit = new Octokit({ auth: token });
    // Try to get the authenticated user to verify token
    await octokit.rest.users.getAuthenticated();
    return true;
  } catch (error) {
    console.error('Token validation failed:', error);
    return false;
  }
}

export async function GET(request: Request) {
  try {
    // Verify request origin
    if (!await isValidOrigin(request)) {
      console.error('Invalid request origin');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      console.error('GitHub token not found in environment variables');
      return NextResponse.json(
        { error: 'GitHub token not configured' },
        { status: 500 }
      );
    }

    // Validate the token
    const isValid = await validateGitHubToken(token);
    if (!isValid) {
      console.error('Invalid GitHub token');
      return NextResponse.json(
        { error: 'Invalid GitHub token' },
        { status: 401 }
      );
    }

    // Only return a masked version of the token for verification purposes
    const maskedToken = `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;

    return NextResponse.json({ 
      masked: maskedToken,
      // Add additional security-related information
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      scope: 'repo',
      type: 'bearer',
      isValid: true
    });
  } catch (error) {
    console.error('Error getting GitHub token:', error);
    return NextResponse.json(
      { error: 'Failed to get GitHub token' },
      { status: 500 }
    );
  }
} 