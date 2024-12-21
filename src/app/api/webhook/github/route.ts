import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { Issue, Label } from '@/types/github';
import { recordSync } from '@/lib/api';
import { saveIssue, saveLabel } from '@/lib/api';

// GitHub webhook payload类型定义
interface GitHubWebhookPayload {
  repository: {
    owner: {
      login: string;
    };
    name: string;
  };
  issue?: Issue;
  label?: Label;
}

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

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const signature = headersList.get('x-hub-signature-256');
    const event = headersList.get('x-github-event');
    const deliveryId = headersList.get('x-github-delivery');
    
    if (!signature) {
      return NextResponse.json(
        { 
          error: 'Missing signature',
          details: {
            deliveryId,
            event,
            headers: {
              'content-type': headersList.get('content-type'),
              'user-agent': headersList.get('user-agent'),
              'x-github-event': event,
              'x-github-delivery': deliveryId,
              'x-github-hook-id': headersList.get('x-github-hook-id'),
            }
          }
        },
        { status: 400 }
      );
    }

    const payload = await request.text();
    
    // 验证webhook签名
    if (!verifyGitHubWebhook(payload, signature)) {
      return NextResponse.json(
        { 
          error: 'Invalid signature',
          details: {
            deliveryId,
            event,
            receivedSignature: signature,
            hasSecret: !!process.env.GITHUB_WEBHOOK_SECRET,
            secretLength: process.env.GITHUB_WEBHOOK_SECRET?.length
          }
        },
        { status: 401 }
      );
    }

    const data = JSON.parse(payload) as GitHubWebhookPayload;
    const { repository } = data;
    const owner = repository.owner.login;
    const repo = repository.name;

    // 处理不同类型的事件
    try {
      switch (event) {
        case 'issues':
          if (!data.issue) {
            throw new Error('Missing issue data in webhook payload');
          }

          // 使用 saveIssue 函数保存 issue
          const issue = {
            number: data.issue.number,
            title: data.issue.title,
            body: data.issue.body || '',
            created_at: data.issue.created_at,
            github_created_at: data.issue.created_at,
            state: data.issue.state,
            labels: data.issue.labels.map(label => ({
              id: label.id,
              name: label.name,
              color: label.color,
              description: label.description
            }))
          };

          const issueSaved = await saveIssue(owner, repo, issue);
          if (!issueSaved) {
            throw new Error(`Failed to save issue #${issue.number} (${issue.title})`);
          }

          await recordSync(owner, repo, 'success', 1, undefined, 'webhook');
          break;
        
        case 'label':
          if (!data.label) {
            throw new Error('Missing label data in webhook payload');
          }

          // 使用 saveLabel 函数保存 label
          const label = {
            id: data.label.id,
            name: data.label.name,
            color: data.label.color,
            description: data.label.description
          };

          const labelSaved = await saveLabel(owner, repo, label);
          if (!labelSaved) {
            throw new Error(`Failed to save label "${label.name}" (${label.color})`);
          }

          // 更新包含该label的issue的更新时间
          const { data: affectedIssues, error: fetchError } = await supabaseServer
            .from('issues')
            .select('*')
            .eq('owner', owner)
            .eq('repo', repo)
            .contains('labels', [data.label.name]);

          if (fetchError) {
            throw new Error(`Failed to fetch issues with label "${label.name}": ${fetchError.message}`);
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
                throw new Error(`Failed to update issue #${issue.issue_number} with label "${label.name}": ${updateError.message}`);
              }
            }
          }

          await recordSync(owner, repo, 'success', 1, undefined, 'webhook');
          break;

        default:
          return NextResponse.json(
            { 
              error: 'Unsupported event type',
              details: {
                deliveryId,
                event,
                supportedEvents: ['issues', 'label'],
                payload: {
                  repository: {
                    owner: owner,
                    name: repo
                  }
                }
              }
            },
            { status: 400 }
          );
      }

      return NextResponse.json({ 
        success: true,
        details: {
          deliveryId,
          event,
          owner,
          repo,
          action: data.issue ? `issue_${data.issue.state}` : (data.label ? 'label_updated' : 'unknown'),
          processedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await recordSync(owner, repo, 'failed', 0, errorMessage, 'webhook');
      
      return NextResponse.json(
        { 
          error: 'Webhook processing failed',
          details: {
            deliveryId,
            message: errorMessage,
            event,
            owner,
            repo,
            payload: {
              issue: data.issue ? {
                number: data.issue.number,
                title: data.issue.title,
                state: data.issue.state,
                labels: data.issue.labels.map(l => l.name)
              } : undefined,
              label: data.label ? {
                name: data.label.name,
                color: data.label.color
              } : undefined
            },
            timestamp: new Date().toISOString()
          }
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const headersList = await headers();
    
    return NextResponse.json(
      { 
        error: 'Webhook processing error',
        details: {
          deliveryId: headersList.get('x-github-delivery'),
          message: errorMessage,
          type: error instanceof Error ? error.constructor.name : typeof error,
          headers: {
            'content-type': headersList.get('content-type'),
            'user-agent': headersList.get('user-agent'),
            'x-github-event': headersList.get('x-github-event'),
            'x-github-delivery': headersList.get('x-github-delivery'),
            'x-github-hook-id': headersList.get('x-github-hook-id'),
          },
          timestamp: new Date().toISOString()
        }
      },
      { status: 500 }
    );
  }
} 