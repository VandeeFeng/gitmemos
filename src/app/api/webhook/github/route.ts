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
  // 先尝试从环境变量获取配置
  const envConfig = {
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO,
    token: process.env.GITHUB_TOKEN,
    issues_per_page: 10
  };

  if (envConfig.owner && envConfig.repo && envConfig.token) {
    return { config: envConfig };
  }

  // 如果环境变量不完整，从数据库获取配置
  const { data: config, error: configError } = await supabaseServer
    .from('configs')
    .select('*')
    .limit(1)
    .single();

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

  if (!config && (!envConfig.owner || !envConfig.repo || !envConfig.token)) {
    return {
      error: NextResponse.json(
        {
          error: 'Config not found',
          details: {
            deliveryId,
            message: 'No configuration found in database or environment',
            event,
            owner,
            repo
          }
        },
        { status: 500 }
      )
    };
  }

  return { config: config || envConfig };
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

          // 先检查 issue 是否已存在
          const { data: existingIssue, error: checkError } = await supabaseServer
            .from('issues')
            .select('id, created_at')
            .eq('owner', owner)
            .eq('repo', repo)
            .eq('issue_number', data.issue.number)
            .single();

          if (checkError && checkError.code !== 'PGRST116') {
            return NextResponse.json(
              {
                error: 'Database check failed',
                details: {
                  deliveryId,
                  message: `Failed to check existing issue: ${checkError.message}`,
                  code: checkError.code,
                  hint: checkError.hint,
                  details: checkError.details,
                  event,
                  owner,
                  repo,
                  issue: {
                    number: data.issue.number,
                    title: data.issue.title
                  }
                }
              },
              { status: 500 }
            );
          }

          // 检查配置
          const configResult = await checkConfig(deliveryId, event, owner, repo);
          if (configResult.error) {
            return configResult.error;
          }

          // 保存 issue
          const now = new Date().toISOString();
          const { error: saveError } = await supabaseServer
            .from('issues')
            .upsert({
              ...(existingIssue ? { id: existingIssue.id } : {}),
              owner,
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
          const syncResult = await recordSync(owner, repo, 'success', 1, undefined, 'webhook');
          if (!syncResult) {
            return NextResponse.json(
              {
                error: 'Sync record failed',
                details: {
                  deliveryId,
                  message: 'Failed to record sync history',
                  event,
                  owner,
                  repo,
                  issue: {
                    number: data.issue.number,
                    title: data.issue.title
                  }
                }
              },
              { status: 500 }
            );
          }

          return NextResponse.json({
            success: true,
            details: {
              deliveryId,
              event,
              owner,
              repo,
              action: `issue_${data.issue.state}`,
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

          // 更新受影响的issues
          const updateTime = new Date().toISOString();
          if (affectedIssues) {
            for (const issue of affectedIssues) {
              const { error: updateError } = await supabaseServer
                .from('issues')
                .update({
                  updated_at: updateTime
                })
                .eq('owner', owner)
                .eq('repo', repo)
                .eq('issue_number', issue.issue_number);

              if (updateError) {
                return NextResponse.json(
                  {
                    error: 'Database update failed',
                    details: {
                      deliveryId,
                      message: `Failed to update issue #${issue.issue_number}: ${updateError.message}`,
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
                      issue: {
                        number: issue.issue_number,
                        title: issue.title
                      }
                    }
                  },
                  { status: 500 }
                );
              }
            }
          }

          // 记录同步历史
          const labelSyncResult = await recordSync(owner, repo, 'success', affectedIssues?.length || 1, undefined, 'webhook');
          if (!labelSyncResult) {
            return NextResponse.json(
              {
                error: 'Sync record failed',
                details: {
                  deliveryId,
                  message: 'Failed to record sync history',
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
              processedAt: updateTime
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