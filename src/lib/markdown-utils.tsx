import React from 'react';

interface ImageDimensions {
  width?: number;
  height?: number;
}

// 从 Markdown 图片 alt 文本中提取尺寸信息
// 格式: ![alt text =100x200](image.jpg) 或 ![alt text =100](image.jpg)
function extractDimensions(alt: string): [string, ImageDimensions] {
  const match = alt.match(/^(.+?)\s*=(\d+)(?:x(\d+))?$/);
  if (!match) return [alt, {}];

  const [, cleanAlt, width, height] = match;
  return [
    cleanAlt.trim(),
    {
      width: width ? parseInt(width) : undefined,
      height: height ? parseInt(height) : undefined,
    }
  ];
}

// 处理 Markdown 中的图片，将其包装在 Lightbox 组件中
export function wrapImagesWithLightbox(content: string): string {
  // 匹配 Markdown 图片语法
  const imageRegex = /!\[(.*?)\]\((.*?)\)/g;
  
  return content.replace(imageRegex, (match, alt, src) => {
    const [cleanAlt, dimensions] = extractDimensions(alt);
    const width = dimensions.width ? `width={${dimensions.width}}` : '';
    const height = dimensions.height ? `height={${dimensions.height}}` : '';
    
    // 将 Markdown 图片转换为 Lightbox 组件
    return `<Lightbox src="${src}" alt="${cleanAlt}" ${width} ${height} className="rounded-lg" />`;
  });
}

// 用于在组件中渲染包含图片的 Markdown 内容
export function renderMarkdownWithLightbox(content: string): JSX.Element {
  const processedContent = wrapImagesWithLightbox(content);
  
  return (
    <div className="markdown-content">
      {/* 这里需要使用你的 Markdown 渲染组件 */}
      {processedContent}
    </div>
  );
} 