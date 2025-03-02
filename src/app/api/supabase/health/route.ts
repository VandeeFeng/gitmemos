import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { PostgrestError } from '@supabase/supabase-js';

export async function GET() {
  try {
    type CountResult = { count: number };

    // Check configs table
    const { data: configsData, error: configsError } = await supabaseServer
      .from('configs')
      .select('count') as { data: CountResult | null; error: PostgrestError | null };
    
    if (configsError) {
      return NextResponse.json(
        { error: 'Failed to check configs table', details: configsError },
        { status: 500 }
      );
    }
    
    // Check issues table
    const { data: issuesData, error: issuesError } = await supabaseServer
      .from('issues')
      .select('count') as { data: CountResult | null; error: PostgrestError | null };
    
    if (issuesError) {
      return NextResponse.json(
        { error: 'Failed to check issues table', details: issuesError },
        { status: 500 }
      );
    }
    
    // Check labels table
    const { data: labelsData, error: labelsError } = await supabaseServer
      .from('labels')
      .select('count') as { data: CountResult | null; error: PostgrestError | null };
    
    if (labelsError) {
      return NextResponse.json(
        { error: 'Failed to check labels table', details: labelsError },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: 'healthy',
      tables: {
        configs: configsData?.count || 0,
        issues: issuesData?.count || 0,
        labels: labelsData?.count || 0
      }
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    return NextResponse.json(
      { error: 'Database health check failed', details: error },
      { status: 500 }
    );
  }
} 