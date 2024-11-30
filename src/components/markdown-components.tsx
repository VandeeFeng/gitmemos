import type { Components } from 'react-markdown';
import Link from 'next/link';
import { Lightbox } from './lightbox';

export const markdownComponents: Components = {
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
                  key={i}
                  href={`/issue/${issueNumber}`}
                  className="text-secondary no-underline hover:underline"
                >
                  {part}
                </Link>
              );
            }
            return part;
          })}
        </p>
      );
    }
    return <p {...props}>{children}</p>;
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
    
    return (
      <Lightbox
        src={src}
        alt={cleanAlt || ''}
        width={width}
        height={height}
        className="max-h-[400px] rounded-lg mx-auto object-contain"
      />
    );
  },
}; 