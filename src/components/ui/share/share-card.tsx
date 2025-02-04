import { Issue } from "@/types/github";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { FormattedDate } from "@/components/layouts/formatted-date";
import { shareMarkdownComponents } from "./share-markdown";
import { useTheme } from 'next-themes';
import { getLabelStyles } from '@/lib/colors';

interface ShareCardProps {
  issue: Issue;
}

export function ShareCard({ issue }: ShareCardProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className={`p-6 ${isDark ? 'bg-[#2d333b]' : 'bg-white'}`}>
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-text-primary">
            {issue.title}
          </h1>
          <div className="flex items-center gap-2 text-xs text-text-secondary whitespace-nowrap">
            <span>#{issue.number}</span>
            <span>·</span>
            <span>
              <FormattedDate date={issue.github_created_at} />
            </span>
          </div>
        </div>
        
        {issue.labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {issue.labels.map(label => (
              <span
                key={label.id}
                className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full"
                style={getLabelStyles(label.color)}
                title={label.description || undefined}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}
        
        <div className={`prose max-w-none ${
          isDark 
            ? 'dark:prose-invert prose-pre:bg-bg-secondary dark:prose-pre:bg-bg-tertiary prose-code:text-text-primary dark:prose-code:text-text-primary prose-headings:text-text-primary dark:prose-headings:text-text-primary' 
            : 'prose-pre:bg-bg-secondary prose-code:text-text-primary prose-headings:text-text-primary'
        } prose-pre:p-4 prose-pre:rounded-lg prose-pre:my-4 prose-code:before:content-none prose-code:after:content-none prose-p:leading-relaxed bg-inherit text-text-primary`}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw, rehypeSanitize]}
            components={shareMarkdownComponents}
            className="text-text-primary"
          >
            {issue.body || ""}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
} 