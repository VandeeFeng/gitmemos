import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { Issue, Label } from '@/types/github';
import { recordSync } from '@/lib/api';

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

// 检查配置是否存在
async function checkConfig(deliveryId: string | null, event: string | null, owner: string, repo: string) {
  // 先检查环境变量配置
  const envConfig = {
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO,
    token: process.env.GITHUB_TOKEN,
    issues_per_page: 10
  };

  // 如果环境变量配置完整且匹配（不区分大小写），直接使用
  if (envConfig.owner?.toLowerCase() === owner.toLowerCase() && 
      envConfig.repo?.toLowerCase() === repo.toLowerCase() && 
      envConfig.token) {
    return { config: envConfig };
  }

  // 如果环境变量配置不完整或不匹配，检查数据库
  const { data: configs, error: configError } = await supabaseServer
    .from('configs')
    .select('*');

  if (configError) {
    return {
      error: NextResponse.json(
        {
          error: 'Config check failed',
          details: {
            deliveryId,
            message: `Failed to get config: ${configError.message}`,
            code: configError.code,
            hint: configError.hint,
            details: configError.details,
            event,
            owner,
            repo
          }
        },
        { status: 500 }
      )
    };
  }

  // 不区分大小写查找匹配的配置
  const existingConfig = configs?.find(
    config => 
      config.owner.toLowerCase() === owner.toLowerCase() && 
      config.repo.toLowerCase() === repo.toLowerCase()
  );

  if (!existingConfig) {
    return {
      error: NextResponse.json(
        {
          error: 'Config not found',
          details: {
            deliveryId,
            message: 'No valid configuration found for this repository',
            event,
            owner,
            repo,
            envOwner: envConfig.owner,  // 添加更多调试信息
            envRepo: envConfig.repo
          }
        },
        { status: 400 }
      )
    };
  }

  return { config: existingConfig };
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
    
    // 验证webhook
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

          // 检查配置
          const configResult = await checkConfig(deliveryId, event, owner, repo);
          if (configResult.error) {
            return configResult.error;
          }

          // 检查 issue 是否已存在
          const { data: existingIssue } = await supabaseServer
            .from('issues')
            .select('id, created_at')
            .eq('owner', owner)
            .eq('repo', repo)
            .eq('issue_number', data.issue.number)
            .single();

          const now = new Date().toISOString();
          
          // 直接使用upsert，不需要先检查是否存在
          const { error: saveError } = await supabaseServer
            .from('issues')
            .upsert({
              owner: owner.toLowerCase(),
              repo,
              issue_number: data.issue.number,
              title: data.issue.title,
              body: data.issue.body || '',
              state: data.issue.state,
              labels: data.issue.labels.map(label => label.name),
              github_created_at: data.issue.created_at,
              ...(existingIssue ? { created_at: existingIssue.created_at } : { created_at: now }),
              updated_at: now
            }, {
              onConflict: 'owner,repo,issue_number'
            });

          if (saveError) {
            return NextResponse.json(
              {
                error: 'Database save failed',
                details: {
                  deliveryId,
                  message: `Failed to save issue to database: ${saveError.message}`,
                  code: saveError.code,
                  hint: saveError.hint,
                  details: saveError.details,
                  event,
                  owner,
                  repo,
                  issue: {
                    number: data.issue.number,
                    title: data.issue.title,
                    state: data.issue.state,
                    labels: data.issue.labels.map(l => l.name)
                  }
                }
              },
              { status: 500 }
            );
          }

          // 记录同步历史
          try {
            const now = new Date().toISOString();
            const { error: syncError } = await supabaseServer
              .from('sync_history')
              .insert({
                owner,
                repo,
                status: 'success',
                issues_synced: 1,
                sync_type: 'webhook',
                last_sync_at: now
              });

            if (syncError) {
              console.error('Failed to record sync history:', syncError);
            }

            // 清理旧记录
            const { data: allRecords } = await supabaseServer
              .from('sync_history')
              .select('id, last_sync_at')
              .eq('owner', owner)
              .eq('repo', repo)
              .order('last_sync_at', { ascending: false });

            // 如果记录数超过20条，删除多余的记录
            if (allRecords && allRecords.length > 20) {
              const recordsToDelete = allRecords.slice(20);
              const idsToDelete = recordsToDelete.map(record => record.id);

              const { error: deleteError } = await supabaseServer
                .from('sync_history')
                .delete()
                .in('id', idsToDelete);

              if (deleteError) {
                console.error('Error cleaning up old sync records:', deleteError);
              }
            }
          } catch (error) {
            console.error('Failed to record sync history:', error);
            // Continue processing even if sync history recording fails
          }

          return NextResponse.json({
            success: true,
            details: {
              deliveryId,
              event,
              owner,
              repo,
              action: 'issue_created',
              issue: {
                number: data.issue.number,
                title: data.issue.title,
                state: data.issue.state,
                labels: data.issue.labels.map(l => l.name)
              },
              processedAt: now
            }
          });

        case 'label':
          if (!data.label) {
            return NextResponse.json(
              {
                error: 'Invalid payload',
                details: {
                  deliveryId,
                  message: 'Missing label data in webhook payload',
                  event,
                  owner,
                  repo
                }
              },
              { status: 400 }
            );
          }

          // 检查配置
          const labelConfigResult = await checkConfig(deliveryId, event, owner, repo);
          if (labelConfigResult.error) {
            return labelConfigResult.error;
          }

          // 存 label
          const { error: labelError } = await supabaseServer
            .from('labels')
            .upsert({
              owner,
              repo,
              name: data.label.name,
              color: data.label.color,
              description: data.label.description,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'owner,repo,name'
            });

          if (labelError) {
            return NextResponse.json(
              {
                error: 'Database save failed',
                details: {
                  deliveryId,
                  message: `Failed to save label to database: ${labelError.message}`,
                  code: labelError.code,
                  hint: labelError.hint,
                  details: labelError.details,
                  event,
                  owner,
                  repo,
                  label: {
                    name: data.label.name,
                    color: data.label.color
                  }
                }
              },
              { status: 500 }
            );
          }

          // 更新包含该label的issue的更新时间
          const { data: affectedIssues, error: fetchError } = await supabaseServer
            .from('issues')
            .select('*')
            .eq('owner', owner)
            .eq('repo', repo)
            .contains('labels', [data.label.name]);

          if (fetchError) {
            return NextResponse.json(
              {
                error: 'Database query failed',
                details: {
                  deliveryId,
                  message: `Failed to fetch affected issues: ${fetchError.message}`,
                  code: fetchError.code,
                  hint: fetchError.hint,
                  details: fetchError.details,
                  event,
                  owner,
                  repo,
                  label: {
                    name: data.label.name,
                    color: data.label.color
                  }
                }
              },
              { status: 500 }
            );
          }

          // 批量更新受影响的issues
          if (affectedIssues && affectedIssues.length > 0) {
            const now = new Date().toISOString();
            const { error: updateError } = await supabaseServer
              .from('issues')
              .upsert(
                affectedIssues.map(issue => ({
                  owner: owner.toLowerCase(),
                  repo,
                  issue_number: issue.issue_number,
                  title: issue.title,
                  body: issue.body,
                  state: issue.state,
                  labels: issue.labels,
                  github_created_at: issue.github_created_at,
                  ...(issue.created_at ? { created_at: issue.created_at } : { created_at: now }),
                  updated_at: now
                })),
                {
                  onConflict: 'owner,repo,issue_number'
                }
              );

            if (updateError) {
              return NextResponse.json(
                {
                  error: 'Database update failed',
                  details: {
                    deliveryId,
                    message: `Failed to update affected issues: ${updateError.message}`,
                    code: updateError.code,
                    hint: updateError.hint,
                    details: updateError.details,
                    event,
                    owner,
                    repo,
                    label: {
                      name: data.label.name,
                      color: data.label.color
                    },
                    affectedIssues: affectedIssues.length
                  }
                },
                { status: 500 }
              );
            }
          }

          // 记录同步历史
          try {
            await recordSync(
              owner.toLowerCase(),
              repo,
              'success',
              affectedIssues?.length || 1,
              undefined,
              'webhook'
            );
          } catch (error) {
            console.error('Failed to record sync history:', error);
            // Continue processing even if sync history recording fails
          }

          return NextResponse.json({
            success: true,
            details: {
              deliveryId,
              event,
              owner,
              repo,
              action: 'label_updated',
              label: {
                name: data.label.name,
                color: data.label.color
              },
              affectedIssues: affectedIssues?.length || 0,
              processedAt: new Date().toISOString()
            }
          });

        default:
          return NextResponse.json(
            {
              error: 'Unsupported event',
              details: {
                deliveryId,
                message: `Unsupported event type: ${event}`,
                supportedEvents: ['issues', 'label'],
                event,
                owner,
                repo
              }
            },
            { status: 400 }
          );
      }
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