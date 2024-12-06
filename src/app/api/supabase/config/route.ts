import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET() {
  try {
    // Log environment variables (without token for security)
    console.log('Environment variables:', {
      GITHUB_OWNER: process.env.GITHUB_OWNER,
      GITHUB_REPO: process.env.GITHUB_REPO,
      HAS_TOKEN: !!process.env.GITHUB_TOKEN
    });

    // First try to get config from environment variables
    const envConfig = {
      owner: process.env.GITHUB_OWNER,
      repo: process.env.GITHUB_REPO,
      token: process.env.GITHUB_TOKEN,
      issues_per_page: 10
    };

    if (envConfig.owner && envConfig.repo && envConfig.token) {
      console.log('Using environment config:', {
        owner: envConfig.owner,
        repo: envConfig.repo,
        hasToken: !!envConfig.token
      });
      return NextResponse.json(envConfig);
    }

    console.log('Environment config incomplete, trying database');

    // If env config is not complete, try to get from database
    const { data, error } = await supabaseServer
      .from('configs')
      .select('*')
      .limit(1)
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('Database config:', data ? {
      owner: data.owner,
      repo: data.repo,
      hasToken: !!data.token
    } : 'null');

    if (!data && (!envConfig.owner || !envConfig.repo || !envConfig.token)) {
      return NextResponse.json(
        { error: 'No valid configuration found' },
        { status: 400 }
      );
    }

    // If no config found in database, use env config
    return NextResponse.json(data || envConfig);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error in config route:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch config' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { data, error } = await supabaseServer
      .from('configs')
      .insert(body)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { error: err.message || 'Failed to save config' },
      { status: 500 }
    );
  }
} 