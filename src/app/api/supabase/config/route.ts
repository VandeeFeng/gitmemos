import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { DbConfig } from '@/types/github';

// Helper function to create a safe version of config (without token)
const createSafeConfig = (config: DbConfig) => ({
  owner: config.owner,
  repo: config.repo,
  issues_per_page: config.issues_per_page || 10
});

export async function GET() {
  try {
    // Log environment variables (without token for security)
    console.log('Environment variables:', {
      GITHUB_OWNER: process.env.GITHUB_OWNER,
      GITHUB_REPO: process.env.GITHUB_REPO,
      HAS_TOKEN: !!process.env.GITHUB_TOKEN
    });

    // First try to get config from environment variables
    const envConfig: DbConfig = {
      owner: process.env.GITHUB_OWNER || '',
      repo: process.env.GITHUB_REPO || '',
      issues_per_page: 10,
      token: process.env.GITHUB_TOKEN || ''
    };

    if (envConfig.owner && envConfig.repo) {
      console.log('Using environment config:', createSafeConfig(envConfig));
      // Only return safe config to client
      return NextResponse.json(createSafeConfig(envConfig));
    }

    console.log('Environment config incomplete, trying database');

    // If env config is not complete, try to get from database
    const { data } = await supabaseServer
      .from('configs')
      .select('*')
      .limit(1)
      .single();

    if (!data) {
      console.error('No configuration found in database');
      return NextResponse.json(
        { error: 'No valid configuration found' },
        { status: 400 }
      );
    }

    console.log('Database config:', createSafeConfig(data as DbConfig));

    // Return safe version of config (without token)
    return NextResponse.json(createSafeConfig(data as DbConfig));
  } catch (err) {
    console.error('Error in config route:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to fetch config' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Create config with token from environment variable
    const config: DbConfig = {
      owner: body.owner,
      repo: body.repo,
      issues_per_page: body.issues_per_page || 10,
      token: process.env.GITHUB_TOKEN || '' // Use environment token when saving new config
    };

    const { data } = await supabaseServer
      .from('configs')
      .insert(config)
      .select()
      .single();

    if (!data) {
      return NextResponse.json(
        { error: 'Failed to save configuration' },
        { status: 500 }
      );
    }

    // Return safe version of config (without token)
    return NextResponse.json(createSafeConfig(data));
  } catch (err) {
    console.error('Error in config route:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to save config' },
      { status: 500 }
    );
  }
} 