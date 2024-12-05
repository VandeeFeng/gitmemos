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

    const { data, error } = await supabaseServer
      .from('labels')
      .select('*')
      .eq('owner', owner)
      .eq('repo', repo)
      .order('name');

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const labels = data.map(label => ({
      id: label.id,
      name: label.name,
      color: label.color,
      description: label.description
    }));

    return NextResponse.json(labels);
  } catch (error) {
    console.error('Error fetching labels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch labels' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { owner, repo, label } = await request.json();
    
    if (!owner || !repo || !label) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const { error } = await supabaseServer
      .from('labels')
      .upsert({
        owner,
        repo,
        name: label.name,
        color: label.color,
        description: label.description,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'owner,repo,name'
      });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving label:', error);
    return NextResponse.json(
      { error: 'Failed to save label' },
      { status: 500 }
    );
  }
} 