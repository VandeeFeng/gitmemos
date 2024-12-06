import { Issue } from "@/types/github";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { FormattedDate } from "@/components/formatted-date";
import { shareMarkdownComponents } from "./share-markdown";
import { useTheme } from 'next-themes';

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
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {issue.title}
          </h1>
          <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            <span>#{issue.number}</span>
            <span>·</span>
            <span>
              <FormattedDate date={issue.created_at} />
            </span>
          </div>
        </div>
        
        {issue.labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {issue.labels.map(label => (
              <span
                key={label.id}
                className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full"
                style={{
                  backgroundColor: `#${label.color}1a`,
                  color: `#${label.color}`,
                }}
                title={label.description || undefined}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}
        
        <div className={`prose max-w-none ${
          isDark 
            ? 'dark:prose-invert prose-pre:bg-[#2a2a2a] prose-code:text-white prose-p:text-gray-300 prose-headings:text-gray-100 prose-strong:text-gray-100 prose-em:text-gray-200 prose-blockquote:text-gray-300 prose-blockquote:border-gray-600' 
            : 'prose-pre:bg-gray-100 prose-code:text-gray-900 prose-p:text-gray-600'
        } prose-pre:p-4 prose-pre:rounded-lg prose-pre:my-4 prose-code:before:content-none prose-code:after:content-none prose-p:leading-relaxed bg-inherit`}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw, rehypeSanitize]}
            components={shareMarkdownComponents}
          >
            {issue.body || ""}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
} 