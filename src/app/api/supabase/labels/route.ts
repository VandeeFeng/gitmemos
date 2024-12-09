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
    console.log('=== POST /api/supabase/labels called ===');
    const { owner, repo, label } = await request.json();
    
    console.log('Request body:', { owner, repo, label });
    
    if (!owner || !repo || !label) {
      console.error('Missing required parameters:', { owner, repo, label });
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // 先检查标签是否已存在
    console.log('Checking if label exists...');
    const { data: existingLabel, error: selectError } = await supabaseServer
      .from('labels')
      .select('*')
      .eq('owner', owner)
      .eq('repo', repo)
      .eq('name', label.name)
      .single();

    if (selectError && selectError.code !== 'PGRST116') { // PGRST116 是"没有找到记录"的错误
      console.error('Error checking existing label:', selectError);
      return NextResponse.json(
        { error: selectError.message },
        { status: 500 }
      );
    }

    console.log('Existing label:', existingLabel);

    let error;
    if (existingLabel) {
      // 如果标签存在，更新它
      console.log('Updating existing label:', existingLabel);
      const { error: updateError, data: updatedData } = await supabaseServer
        .from('labels')
        .update({
          color: label.color,
          description: label.description,
          updated_at: new Date().toISOString()
        })
        .eq('owner', owner)
        .eq('repo', repo)
        .eq('name', label.name)
        .select();
      error = updateError;
      console.log('Update result:', { error: updateError, data: updatedData });
    } else {
      // 如果标签不存在，插入新标签
      console.log('Inserting new label');
      const now = new Date().toISOString();
      const { error: insertError, data: insertedData } = await supabaseServer
        .from('labels')
        .insert({
          owner,
          repo,
          name: label.name,
          color: label.color,
          description: label.description,
          created_at: now,
          updated_at: now
        })
        .select();
      error = insertError;
      console.log('Insert result:', { error: insertError, data: insertedData });
    }

    if (error) {
      console.error('Database error when saving label:', error);
      return NextResponse.json(
        { error: error.message, details: error },
        { status: 500 }
      );
    }

    console.log('Label saved successfully:', label);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/supabase/labels:', error);
    return NextResponse.json(
      { error: 'Failed to save label', details: error },
      { status: 500 }
    );
  }
} 