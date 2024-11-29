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
                  className="text-[rgb(88,137,223)] hover:underline"
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
  a: ({ href, children, ...props }) => {
    if (!href) return <>{children}</>;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[rgb(88,137,223)] hover:underline"
        {...props}
      >
        {children}
      </a>
    );
  },
  pre: ({ children, ...props }) => (
    <div className="relative my-4">
      <pre
        className="p-4 rounded-lg bg-[#f6f8fa] dark:bg-[#2d333b] overflow-x-auto"
        {...props}
      >
        {children}
      </pre>
    </div>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-[#24292f] dark:text-[#adbac7]" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }) => (
    <em className="text-[#24292f] dark:text-[#adbac7]" {...props}>
      {children}
    </em>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="pl-4 border-l-4 border-[#d0d7de] dark:border-[#373e47] text-[#57606a] dark:text-[#768390]"
      {...props}
    >
      {children}
    </blockquote>
  ),
  ul: ({ children, ...props }) => (
    <ul className="list-disc pl-5 my-4 text-[#24292f] dark:text-[#adbac7]" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="list-decimal pl-5 my-4 text-[#24292f] dark:text-[#adbac7]" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="my-1 text-[#24292f] dark:text-[#adbac7]" {...props}>
      {children}
    </li>
  ),
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