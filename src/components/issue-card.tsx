import { Issue } from '@/types/github';
import Link from 'next/link';
import { Button } from './ui/button';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { markdownComponents } from './markdown-components';
import { Backlinks } from './backlinks';
import { getLabelStyles } from '@/lib/colors';
import { useState } from 'react';
import { FormattedDate } from './formatted-date';

interface IssueCardProps {
  issue: Issue;
  selectedLabel: string | null;
  onLabelClick: (label: string) => void;
  showStatus?: boolean;
}

export function IssueCard({ 
  issue, 
  selectedLabel, 
  onLabelClick,
  showStatus = true 
}: IssueCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="group border border-default rounded-lg shadow-card dark:shadow-card-dark hover:shadow-card-hover dark:hover:shadow-card-dark-hover transition-shadow">
      <div className="px-6 py-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1 min-w-0 pr-4">
            <h3 className="font-semibold text-text-primary">
              <Link
                href={`/issue/${issue.number}`}
                className="hover:text-secondary dark:hover:text-secondary transition-colors"
              >
                {issue.title}
              </Link>
            </h3>
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <span>#{issue.number}</span>
              <span>·</span>
              <span>
                <FormattedDate date={issue.created_at} />
              </span>
            </div>
            {issue.labels.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {issue.labels.map(label => (
                  <span
                    key={label.id}
                    className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full cursor-pointer transition-all ${
                      selectedLabel === label.name 
                        ? 'outline outline-2 outline-offset-1 outline-secondary dark:outline-secondary' 
                        : 'hover:opacity-80'
                    }`}
                    style={getLabelStyles(label.color)}
                    title={label.description || undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                      onLabelClick(label.name);
                    }}
                  >
                    {label.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {showStatus && (
              <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                issue.state === 'open'
                  ? 'bg-[#dafbe1] text-[#1a7f37] dark:bg-[rgba(35,134,54,0.2)] dark:text-[#3fb950]'
                  : 'bg-[#faf2f8] text-[#8250df] dark:bg-[rgba(130,80,223,0.2)] dark:text-[#a371f7]'
              }`}>
                <span className="relative flex w-2 h-2 mr-1.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    issue.state === 'open'
                      ? 'bg-[#1a7f37] dark:bg-[#238636]'
                      : 'bg-[#8250df] dark:bg-[#8250df]'
                  }`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${
                    issue.state === 'open'
                      ? 'bg-[#1a7f37] dark:bg-[#238636]'
                      : 'bg-[#8250df] dark:bg-[#8250df]'
                  }`}></span>
                </span>
                {issue.state}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity text-text-secondary hover:text-text-primary hover:bg-bg-secondary dark:hover:bg-bg-tertiary -mr-1.5 shrink-0"
              asChild
            >
              <Link href={`/?edit=${issue.number}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                <span className="text-xs">Edit</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
      {issue.body && (
        <div className="border-t border-default">
          <div className="px-6 py-3">
            <div className="prose dark:prose-invert max-w-none relative">
              <div className="relative">
                <div 
                  className={`origin-top overflow-hidden transition-all duration-500 ease-in-out ${
                    !isExpanded && (issue.body?.length ?? 0) > 300 
                      ? 'max-h-[300px]' 
                      : 'max-h-[10000px]'
                  }`}
                >
                  <div className="prose dark:prose-invert max-w-none prose-pre:bg-bg-secondary dark:prose-pre:bg-bg-tertiary prose-pre:p-4 prose-pre:rounded-lg prose-pre:my-4 prose-code:text-text-primary dark:prose-code:text-text-primary prose-code:before:content-none prose-code:after:content-none prose-p:leading-relaxed">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw, rehypeSanitize]}
                      components={markdownComponents}
                      className="text-text-primary"
                    >
                      {issue.body}
                    </ReactMarkdown>
                  </div>
                </div>
                {!isExpanded && (issue.body?.length ?? 0) > 300 && (
                  <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-bg-primary dark:from-bg-primary to-transparent opacity-100 transition-all duration-500" />
                )}
              </div>
              {(issue.body?.length ?? 0) > 300 && (
                <button
                  onClick={toggleExpand}
                  className="mt-2 text-xs font-semibold text-[#0969da] dark:text-[#2f81f7] hover:text-[#0969da]/90 dark:hover:text-[#2f81f7]/90 relative z-10"
                >
                  {isExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
            <Backlinks currentIssueNumber={issue.number} />
          </div>
        </div>
      )}
    </div>
  );
} 