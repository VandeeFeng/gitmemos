import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { Label } from '@/types/github';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');
    const page = parseInt(searchParams.get('page') || '1');
    const labels = searchParams.get('labels')?.split(',').filter(Boolean);
    
    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Missing owner or repo parameter' },
        { status: 400 }
      );
    }

    const pageSize = 50;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabaseServer
      .from('issues')
      .select('*', { count: 'exact' })
      .eq('owner', owner)
      .eq('repo', repo)
      .order('github_created_at', { ascending: false })
      .range(from, to);

    if (labels && labels.length > 0) {
      query = query.contains('labels', labels);
    }

    const { data: issues, error: issuesError, count } = await query;

    if (issuesError) {
      return NextResponse.json(
        { error: issuesError.message },
        { status: 500 }
      );
    }

    // 获取标签数据
    const { data: labels_data, error: labelsError } = await supabaseServer
      .from('labels')
      .select('*')
      .eq('owner', owner)
      .eq('repo', repo);

    if (labelsError) {
      return NextResponse.json(
        { error: labelsError.message },
        { status: 500 }
      );
    }

    // 转换数据格式
    const formattedIssues = issues.map(issue => ({
      number: issue.issue_number,
      title: issue.title,
      body: issue.body || '',
      created_at: issue.created_at,
      github_created_at: issue.github_created_at,
      state: issue.state,
      labels: issue.labels.map((labelName: string) => {
        const labelInfo = labels_data?.find((l: Label) => l.name === labelName);
        return labelInfo || {
          id: 0,
          name: labelName,
          color: 'gray',
          description: null
        };
      })
    }));

    return NextResponse.json({
      issues: formattedIssues,
      total: count
    });
  } catch (error) {
    console.error('Error fetching issues:', error);
    return NextResponse.json(
      { error: 'Failed to fetch issues' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { owner, repo, issue } = await request.json();
    
    if (!owner || !repo || !issue) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // 检查 issue 是否已存在
    const { data: existingIssue } = await supabaseServer
      .from('issues')
      .select('id, created_at')
      .eq('owner', owner)
      .eq('repo', repo)
      .eq('issue_number', issue.number)
      .single();

    const now = new Date().toISOString();

    const { error } = await supabaseServer
      .from('issues')
      .upsert({
        owner,
        repo,
        issue_number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        labels: issue.labels.map((label: Label) => label.name),
        github_created_at: issue.created_at,
        ...(existingIssue ? {} : { created_at: now }), // 只在新建时设置 created_at
        updated_at: now
      }, {
        onConflict: 'owner,repo,issue_number'
      });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving issue:', error);
    return NextResponse.json(
      { error: 'Failed to save issue' },
      { status: 500 }
    );
  }
} 