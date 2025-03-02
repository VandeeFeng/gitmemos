import React from 'react';

interface ImageDimensions {
  width?: number | string;
  height?: number | string;
}

// Extract size information from alt text in Markdown images
// Format: ![alt text =100x200](image.jpg) or ![alt text =100](image.jpg) or ![alt text =50%x30%](image.jpg)
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

// Extract attributes from HTML img tag
function parseImgTag(imgTag: string): { src: string; alt: string; width?: string; height?: string } {
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

// Process dimension value, keep percentage format or convert to number
function processDimensionValue(value: number | string | undefined): string {
  if (value === undefined) return '';
  if (typeof value === 'number') return String(value);
  if (value.endsWith('%')) {
    return `"${value}"`;  // Percentage values need to be wrapped in quotes
  }
  return value;  // Number string values don't need quotes
}

// Process images in Markdown and wrap them in Lightbox component
export function wrapImagesWithLightbox(content: string): string {
  let processedContent = content;

  // Process HTML img tags
  const imgTagRegex = /<img[^>]+>/g;
  processedContent = processedContent.replace(imgTagRegex, (match) => {
    const { src, alt, width, height } = parseImgTag(match);
    if (!src) return match;

    const widthAttr = width ? `width={${processDimensionValue(width)}}` : '';
    const heightAttr = height ? `height={${processDimensionValue(height)}}` : '';
    
    return `<Lightbox src="${src}" alt="${alt}" ${widthAttr} ${heightAttr} className="rounded-lg" />`;
  });

  // Process Markdown image syntax
  const markdownImageRegex = /!\[(.*?)\]\((.*?)\)/g;
  processedContent = processedContent.replace(markdownImageRegex, (match, alt, src) => {
    const [cleanAlt, dimensions] = extractDimensions(alt);
    const width = dimensions.width ? `width={${processDimensionValue(dimensions.width)}}` : '';
    const height = dimensions.height ? `height={${processDimensionValue(dimensions.height)}}` : '';
    
    return `<Lightbox src="${src}" alt="${cleanAlt}" ${width} ${height} className="rounded-lg" />`;
  });

  return processedContent;
}

// Render Markdown content with images in component
export function renderMarkdownWithLightbox(content: string): JSX.Element {
  const processedContent = wrapImagesWithLightbox(content);
  
  return (
    <div className="markdown-content">
      {/* Use your Markdown rendering component here */}
      {processedContent}
    </div>
  );
} 