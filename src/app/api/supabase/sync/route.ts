import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');
    
    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Missing owner or repo parameter' },
        { status: 400 }
      );
    }

    // 获取最后一次同步记录
    const { data, error } = await supabaseServer
      .from('sync_history')
      .select('*')
      .eq('owner', owner)
      .eq('repo', repo)
      .order('last_sync_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 是"没有找到记录"的错误
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ needsSync: true, lastSyncAt: null });
    }

    const lastSyncTime = new Date(data.last_sync_at).getTime();
    const now = Date.now();
    const hoursSinceLastSync = (now - lastSyncTime) / (1000 * 60 * 60);

    return NextResponse.json({
      needsSync: data.status === 'failed' || hoursSinceLastSync >= 24,
      lastSyncAt: data.last_sync_at,
      status: data.status,
      issuesSynced: data.issues_synced
    });
  } catch (error) {
    console.error('Error checking sync status:', error);
    return NextResponse.json(
      { error: 'Failed to check sync status' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { owner, repo, status, issuesSynced, errorMessage } = await request.json();
    
    if (!owner || !repo || !status) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const { error } = await supabaseServer
      .from('sync_history')
      .insert({
        owner,
        repo,
        status,
        issues_synced: issuesSynced,
        error_message: errorMessage,
        last_sync_at: new Date().toISOString()
      });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recording sync history:', error);
    return NextResponse.json(
      { error: 'Failed to record sync history' },
      { status: 500 }
    );
  }
} 