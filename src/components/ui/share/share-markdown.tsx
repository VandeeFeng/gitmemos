import type { Components } from 'react-markdown';
import Link from 'next/link';

export const shareMarkdownComponents: Components = {
  p: ({ children, ...props }) => {
    if (typeof children === 'string') {
      const parts = children.split(/(#\d+)/g);
      return (
        <p {...props}>
          {parts.map((part, i) => {
            if (part.match(/^#\d+$/)) {
              const issueNumber = part.substring(1);
              return (
                <Link
                  key={`${part}-${i}`}
                  href={`/issue/${issueNumber}`}
                  className="text-secondary no-underline hover:underline"
                >
                  {part}
                </Link>
              );
            }
            return <span key={`text-${i}`}>{part}</span>;
          })}
        </p>
      );
    }
    return <p {...props}>{children}</p>;
  },
  blockquote: ({ children }) => {
    return (
      <div className="border-l-4 border-[#d0d7de] dark:border-[#373e47] pl-4 my-4">
        <div className="italic text-[#57606a] dark:text-[#768390] break-words [overflow-wrap:anywhere]">
          {children}
        </div>
      </div>
    );
  },
  img: ({ src, alt }) => {
    if (!src) return null;
    
    // 从 alt 文本中提取尺寸信息
    const match = alt?.match(/^(.+?)\s*=(\d+)(?:x(\d+))?$/);
    let width, height, cleanAlt;
    
    if (match) {
      [, cleanAlt, width, height] = match;
      width = parseInt(width);
      height = height ? parseInt(height) : undefined;
    } else {
      cleanAlt = alt;
    }
    
    // 使用代理 URL
    const proxyUrl = src ? `/api/proxy/image?url=${encodeURIComponent(src)}` : null;
    
    return (
      <img
        src={proxyUrl || src}
        alt={cleanAlt || ''}
        width={width}
        height={height}
        className="max-h-[400px] rounded-lg mx-auto object-contain"
        crossOrigin="anonymous"
      />
    );
  },
}; 