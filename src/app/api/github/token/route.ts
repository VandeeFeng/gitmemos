import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      console.error('GitHub token not found in environment variables');
      return NextResponse.json(
        { error: 'GitHub token not configured' },
        { status: 500 }
      );
    }

    return NextResponse.json({ token });
  } catch (error) {
    console.error('Error getting GitHub token:', error);
    return NextResponse.json(
      { error: 'Failed to get GitHub token' },
      { status: 500 }
    );
  }
} 