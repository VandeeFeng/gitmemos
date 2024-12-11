import type { Components } from 'react-markdown';
import Link from 'next/link';

interface ListItemProps extends React.LiHTMLAttributes<HTMLLIElement> {
  checked?: boolean;
}

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
    
    // 使用代理 URL 并确保跨域处理
    const proxyUrl = src.startsWith('http') ? `/api/proxy/image?url=${encodeURIComponent(src)}` : src;
    
    return (
      <img
        src={proxyUrl}
        alt={cleanAlt || ''}
        width={width}
        height={height}
        className="max-h-[400px] rounded-lg mx-auto object-contain"
        crossOrigin="anonymous"
        loading="eager"
        onError={(e) => {
          // 如果代理加载失败，尝试直接加载原始图片
          const imgElement = e.target as HTMLImageElement;
          if (imgElement.src !== src) {
            imgElement.src = src;
          }
        }}
      />
    );
  },
  li: ({ children, checked, ...props }: React.PropsWithChildren<ListItemProps>) => {
    if (typeof checked === 'boolean') {
      return (
        <li {...props} className="list-none flex items-center gap-2 my-1">
          <input
            type="checkbox"
            checked={checked}
            readOnly
            className="flex-none"
          />
          <span className="flex-1">{children}</span>
        </li>
      );
    }
    return <li {...props}>{children}</li>;
  }
} 