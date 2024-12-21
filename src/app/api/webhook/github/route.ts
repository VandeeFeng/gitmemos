import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import crypto from 'crypto';

// 验证GitHub webhook签名
function verifyGitHubWebhook(payload: string, signature: string): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    console.error('Missing GITHUB_WEBHOOK_SECRET');
    return false;
  }

  const hmac = crypto.createHmac('sha256', secret);
  const calculatedSignature = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(calculatedSignature)
  );
}

// 更新issue记录
async function updateIssue(owner: string, repo: string, issue: any) {
  const { data: existingIssue, error: fetchError } = await supabaseServer
    .from('issues')
    .select('*')
    .eq('owner', owner)
    .eq('repo', repo)
    .eq('issue_number', issue.number)
    .single();

  const issueData = {
    owner,
    repo,
    issue_number: issue.number,
    title: issue.title,
    body: issue.body,
    state: issue.state,
    labels: issue.labels.map((label: any) => label.name),
    github_created_at: issue.created_at,
    updated_at: new Date().toISOString()
  };

  if (!existingIssue) {
    const { error: insertError } = await supabaseServer
      .from('issues')
      .insert([issueData]);

    if (insertError) {
      console.error('Error inserting issue:', insertError);
      throw insertError;
    }
  } else {
    const { error: updateError } = await supabaseServer
      .from('issues')
      .update(issueData)
      .eq('owner', owner)
      .eq('repo', repo)
      .eq('issue_number', issue.number);

    if (updateError) {
      console.error('Error updating issue:', updateError);
      throw updateError;
    }
  }
}

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const signature = headersList.get('x-hub-signature-256');
    const event = headersList.get('x-github-event');
    
    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    const payload = await request.text();
    
    // 验证webhook签名
    if (!verifyGitHubWebhook(payload, signature)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const data = JSON.parse(payload);
    const { repository } = data;
    const owner = repository.owner.login;
    const repo = repository.name;

    // 处理不同类型的事件
    try {
      switch (event) {
        case 'issues':
          await updateIssue(owner, repo, data.issue);
          // 使用API记录同步历史
          await fetch('/api/supabase/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              owner,
              repo,
              status: 'success',
              issuesSynced: 1,
              sync_type: 'webhook'
            }),
          });
          break;
        
        case 'label':
          // 当label变化时，我们需要更新所有包含该label的issue
          if (data.label) {
            const { data: affectedIssues, error: fetchError } = await supabaseServer
              .from('issues')
              .select('*')
              .eq('owner', owner)
              .eq('repo', repo)
              .contains('labels', [data.label.name]);

            if (fetchError) {
              console.error('Error fetching affected issues:', fetchError);
              throw fetchError;
            }

            // 更新每个受影响的issue
            if (affectedIssues) {
              for (const issue of affectedIssues) {
                const { error: updateError } = await supabaseServer
                  .from('issues')
                  .update({
                    updated_at: new Date().toISOString()
                  })
                  .eq('owner', owner)
                  .eq('repo', repo)
                  .eq('issue_number', issue.issue_number);

                if (updateError) {
                  console.error('Error updating issue:', updateError);
                  throw updateError;
                }
              }
            }
          }
          // 使用API记录同步历史
          await fetch('/api/supabase/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              owner,
              repo,
              status: 'success',
              issuesSynced: 1,
              sync_type: 'webhook'
            }),
          });
          break;

        default:
          return NextResponse.json(
            { error: 'Unsupported event type' },
            { status: 400 }
          );
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // 使用API记录同步失败
      await fetch('/api/supabase/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner,
          repo,
          status: 'failed',
          issuesSynced: 0,
          errorMessage,
          sync_type: 'webhook'
        }),
      });

      throw error;
    }
  } catch (error) {
    console.error('Webhook processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 