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

    // Get last sync record
    const { data, error } = await supabaseServer
      .from('sync_history')
      .select('*')
      .eq('owner', owner)
      .eq('repo', repo)
      .order('last_sync_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 means "no rows found"
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ needsSync: true, lastSyncAt: null });
    }

    return NextResponse.json({
      needsSync: data.status === 'failed',
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
    const { owner, repo, status, issuesSynced, errorMessage, sync_type } = await request.json();
    
    if (!owner || !repo || !status) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Insert new record
    const { error: insertError } = await supabaseServer
      .from('sync_history')
      .insert({
        owner,
        repo,
        status,
        issues_synced: issuesSynced,
        error_message: errorMessage,
        sync_type: sync_type || 'full',
        last_sync_at: new Date().toISOString()
      });

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    // Get all sync records for current repository, ordered by time descending
    const { data: allRecords, error: selectError } = await supabaseServer
      .from('sync_history')
      .select('id, last_sync_at')
      .eq('owner', owner)
      .eq('repo', repo)
      .order('last_sync_at', { ascending: false });

    if (selectError) {
      console.error('Error fetching sync records:', selectError);
      // Don't let cleanup failure affect main process
      return NextResponse.json({ success: true });
    }

    // If more than 20 records, delete excess records
    if (allRecords && allRecords.length > 20) {
      const recordsToDelete = allRecords.slice(20);
      const idsToDelete = recordsToDelete.map(record => record.id);

      const { error: deleteError } = await supabaseServer
        .from('sync_history')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) {
        console.error('Error cleaning up old sync records:', deleteError);
      } else {
        console.log(`Cleaned up ${recordsToDelete.length} old sync records`);
      }
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