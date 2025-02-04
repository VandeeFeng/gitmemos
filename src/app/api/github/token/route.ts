import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET() {
  // First try environment variable
  const envToken = process.env.GITHUB_TOKEN;
  if (envToken) {
    return NextResponse.json({ token: envToken });
  }

  // If no environment token, try to get from database
  try {
    const { data, error } = await supabaseServer
      .from('configs')
      .select('token')
      .limit(1)
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to get token from database' },
        { status: 500 }
      );
    }

    if (!data?.token) {
      return NextResponse.json(
        { error: 'GitHub token not found in database' },
        { status: 404 }
      );
    }

    return NextResponse.json({ token: data.token });
  } catch {
    return NextResponse.json(
      { error: 'Failed to get GitHub token' },
      { status: 500 }
    );
  }
} 