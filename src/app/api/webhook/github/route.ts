import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { Issue, Label } from '@/types/github';
import { recordSync } from '@/lib/api';
import { getGitHubConfig } from '@/lib/github';

// GitHub webhook payload类型定义
interface WebhookPayload {
  action: string;
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
    // Verify GitHub webhook signature
    const signature = request.headers.get('x-hub-signature-256');
    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      );
    }

    const headersList = await headers();
    const event = headersList.get('x-github-event');
    const deliveryId = headersList.get('x-github-delivery');
    
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

    // Process webhook payload
    try {
      const data = JSON.parse(payload) as WebhookPayload;
      
      // Get GitHub configuration and check it
      const config = await getGitHubConfig();

      if (!config.owner || !config.repo) {
        return NextResponse.json(
          { error: 'Missing GitHub configuration' },
          { status: 400 }
        );
      }

      // Verify repository configuration
      const configCheck = await checkConfig(deliveryId, event, config.owner, config.repo);
      if ('error' in configCheck) {
        return configCheck.error;
      }

      // Use the verified config
      const verifiedConfig = configCheck.config;

      // Handle different webhook events
      switch (event) {
        case 'issues':
          if (data.issue) {
            // Process issue event using verified config
            console.log(`Processing issue event: ${data.action} for issue #${data.issue.number} in ${verifiedConfig.owner}/${verifiedConfig.repo}`);
          }
          break;
        case 'label':
          if (data.label) {
            // Process label event using verified config
            console.log(`Processing label event: ${data.action} for label ${data.label.name} in ${verifiedConfig.owner}/${verifiedConfig.repo}`);
          }
          break;
      }
      
      // Record sync status
      await recordSync(
        config.owner,
        config.repo,
        'success',
        1,
        undefined,
        'webhook'
      );

      return NextResponse.json({ 
        success: true,
        event,
        action: data.action,
        deliveryId
      });
    } catch (err) {
      console.error('Error processing webhook payload:', err);
      return NextResponse.json(
        { error: 'Failed to process webhook payload' },
        { status: 400 }
      );
    }
  } catch (err) {
    console.error('Error handling webhook:', err);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
} 