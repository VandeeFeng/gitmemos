import React from 'react';

interface ImageDimensions {
  width?: number | string;
  height?: number | string;
}

// 从 Markdown 图片 alt 文本中提取尺寸信息
// 格式: ![alt text =100x200](image.jpg) 或 ![alt text =100](image.jpg) 或 ![alt text =50%x30%](image.jpg)
function extractDimensions(alt: string): [string, ImageDimensions] {
  const match = alt.match(/^(.+?)\s*=(\d+%?|\d*\.\d+%?)(?:x(\d+%?|\d*\.\d+%?))?$/);
  if (!match) return [alt, {}];

  const [, cleanAlt, width, height] = match;
  return [
    cleanAlt.trim(),
    {
      width: width || undefined,
      height: height || undefined,
    }
  ];
}

// 从 HTML img 标签中提取属性
function parseImgTag(imgTag: string): { src: string; alt: string; width?: number | string; height?: number | string } {
  const srcMatch = imgTag.match(/src=["'](.*?)["']/);
  const altMatch = imgTag.match(/alt=["'](.*?)["']/);
  const widthMatch = imgTag.match(/width=["']?([\d.]+%?|\d*\.\d+%?)["']?/);
  const heightMatch = imgTag.match(/height=["']?([\d.]+%?|\d*\.\d+%?)["']?/);

  return {
    src: srcMatch?.[1] || '',
    alt: altMatch?.[1] || '',
    width: widthMatch ? widthMatch[1] : undefined,
    height: heightMatch ? heightMatch[1] : undefined
  };
}

// 处理尺寸值，保持百分比格式或转换为数字
function processDimensionValue(value: string | undefined): string {
  if (!value) return '';
  if (value.endsWith('%')) {
    return `"${value}"`;  // 百分比值需要用引号包裹
  }
  return value;  // 数字值不需要引号
}

// 处理 Markdown 中的图片，将其包装在 Lightbox 组件中
export function wrapImagesWithLightbox(content: string): string {
  let processedContent = content;

  // 处理 HTML img 标签
  const imgTagRegex = /<img[^>]+>/g;
  processedContent = processedContent.replace(imgTagRegex, (match) => {
    const { src, alt, width, height } = parseImgTag(match);
    if (!src) return match;

    const widthAttr = width ? `width={${processDimensionValue(width)}}` : '';
    const heightAttr = height ? `height={${processDimensionValue(height)}}` : '';
    
    return `<Lightbox src="${src}" alt="${alt}" ${widthAttr} ${heightAttr} className="rounded-lg" />`;
  });

  // 处理 Markdown 图片语法
  const markdownImageRegex = /!\[(.*?)\]\((.*?)\)/g;
  processedContent = processedContent.replace(markdownImageRegex, (match, alt, src) => {
    const [cleanAlt, dimensions] = extractDimensions(alt);
    const width = dimensions.width ? `width={${processDimensionValue(String(dimensions.width))}}` : '';
    const height = dimensions.height ? `height={${processDimensionValue(String(dimensions.height))}}` : '';
    
    return `<Lightbox src="${src}" alt="${cleanAlt}" ${width} ${height} className="rounded-lg" />`;
  });

  return processedContent;
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