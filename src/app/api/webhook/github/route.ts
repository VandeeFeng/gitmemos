import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { Issue, Label } from '@/types/github';
import { encryptToken } from '@/lib/encryption';

// GitHub webhook payload type definition
interface GitHubWebhookPayload {
  action: string;
  repository: {
    owner: {
      login: string;
    };
    name: string;
  };
  issue?: Issue;
  label?: Label;
}

// Verify GitHub webhook signature
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

// Check if config exists
async function checkConfig(deliveryId: string | null, event: string | null, owner: string, repo: string) {
  // First try environment variables
  const envConfig = {
    owner: process.env.GITHUB_OWNER || '',
    repo: process.env.GITHUB_REPO || '',
    issues_per_page: 10,
    token: process.env.GITHUB_TOKEN ? encryptToken(process.env.GITHUB_TOKEN) : ''
  };

  // If environment config is complete and matches (case-insensitive), use it directly
  if (envConfig.owner && envConfig.repo && envConfig.token && 
      envConfig.owner.toLowerCase() === owner.toLowerCase() && 
      envConfig.repo.toLowerCase() === repo.toLowerCase()) {
    console.log('Using environment config for webhook');
    return { config: envConfig };
  }

  console.log('Environment config incomplete or mismatch, trying database');

  // If environment config is incomplete or doesn't match, check database
  const { data: configs, error: configError } = await supabaseServer
    .from('configs')
    .select('*');

  if (configError) {
    console.error('Failed to get config from database:', configError);
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

  // Case-insensitive search for matching config
  const existingConfig = configs?.find(
    config => 
      config.owner.toLowerCase() === owner.toLowerCase() && 
      config.repo.toLowerCase() === repo.toLowerCase()
  );

  if (!existingConfig) {
    console.error('No matching config found in database');
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
            envConfig: {
              hasOwner: !!envConfig.owner,
              hasRepo: !!envConfig.repo,
              hasToken: !!envConfig.token,
              owner: envConfig.owner,
              repo: envConfig.repo
            }
          }
        },
        { status: 400 }
      )
    };
  }

  // Update or create config
  const config = {
    owner: process.env.GITHUB_OWNER || existingConfig.owner,
    repo: process.env.GITHUB_REPO || existingConfig.repo,
    issues_per_page: existingConfig.issues_per_page || 10,
    token: process.env.GITHUB_TOKEN ? encryptToken(process.env.GITHUB_TOKEN) : existingConfig.token
  };

  console.log('Using database config for webhook');
  return { config };
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
    
    // Verify webhook
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

    // Handle different event types
    try {
      switch (event) {
        case 'issues':
          if (!data.issue) {
            throw new Error('Missing issue data in webhook payload');
          }

          // Check configuration
          const configResult = await checkConfig(deliveryId, event, owner, repo);
          if (configResult.error) {
            return configResult.error;
          }

          // Check if issue already exists
          const { data: existingIssue } = await supabaseServer
            .from('issues')
            .select('id, created_at')
            .eq('owner', owner)
            .eq('repo', repo)
            .eq('issue_number', data.issue.number)
            .single();

          const now = new Date().toISOString();
          
          // Use upsert to save issue
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

          // Record sync history
          try {
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

            // Clean up old records
            const { data: allRecords } = await supabaseServer
              .from('sync_history')
              .select('id, last_sync_at')
              .eq('owner', owner)
              .eq('repo', repo)
              .order('last_sync_at', { ascending: false });

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
          }

          return NextResponse.json({
            success: true,
            details: {
              deliveryId,
              event,
              owner,
              repo,
              action: data.action,
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

          // Check configuration
          const labelConfigResult = await checkConfig(deliveryId, event, owner, repo);
          if (labelConfigResult.error) {
            return labelConfigResult.error;
          }

          // Save label
          const { error: labelError } = await supabaseServer
            .from('labels')
            .upsert({
              owner: owner.toLowerCase(),
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

          // Update issues containing the label
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

          // Batch update affected issues
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

          // Record sync history
          try {
            const { error: syncError } = await supabaseServer
              .from('sync_history')
              .insert({
                owner,
                repo,
                status: 'success',
                issues_synced: affectedIssues?.length || 1,
                sync_type: 'webhook',
                last_sync_at: new Date().toISOString()
              });

            if (syncError) {
              console.error('Failed to record sync history:', syncError);
            }
          } catch (error) {
            console.error('Failed to record sync history:', error);
          }

          return NextResponse.json({
            success: true,
            details: {
              deliveryId,
              event,
              owner,
              repo,
              action: data.action,
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