import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return new NextResponse('Missing image URL', { status: 400 });
  }

  try {
    // 从原始请求中获取重要的请求头
    const headers = new Headers();
    const importantHeaders = [
      'User-Agent',
      'Accept',
      'Accept-Language',
      'Referer',
      'Cache-Control'
    ];

    importantHeaders.forEach(header => {
      const value = request.headers.get(header);
      if (value) {
        headers.set(header, value);
      }
    });

    // 添加跨域支持
    headers.set('Origin', new URL(request.url).origin);

    const response = await fetch(imageUrl, {
      headers,
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const responseHeaders = new Headers();

    // 复制原始响应的内容类型
    const contentType = response.headers.get('Content-Type');
    if (contentType) {
      responseHeaders.set('Content-Type', contentType);
    } else {
      // 如果没有内容类型，根据URL推测
      const ext = imageUrl.split('.').pop()?.toLowerCase();
      if (ext) {
        const mimeTypes: Record<string, string> = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'svg': 'image/svg+xml'
        };
        responseHeaders.set('Content-Type', mimeTypes[ext] || 'image/png');
      } else {
        responseHeaders.set('Content-Type', 'image/png');
      }
    }

    // 设置缓存控制
    responseHeaders.set('Cache-Control', 'public, max-age=31536000'); // 1年
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    responseHeaders.set('Cross-Origin-Resource-Policy', 'cross-origin');

    return new NextResponse(buffer, {
      headers: responseHeaders,
      status: 200,
    });
  } catch (error) {
    console.error('Failed to proxy image:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Failed to fetch image', details: (error as Error).message }), 
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400', // 24小时
    },
  });
} 