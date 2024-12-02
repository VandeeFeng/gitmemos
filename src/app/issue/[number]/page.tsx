'use client';

import { useEffect, useState, use } from 'react';
import { getIssue } from '@/lib/github';
import { STATUS_COLORS, getLabelStyles } from '@/lib/colors';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { markdownComponents } from '@/components/markdown-components';
import { Issue } from '@/types/github';
import { Backlinks } from '@/components/backlinks';
import { useTheme } from 'next-themes';

export default function IssuePage({ params }: { params: Promise<{ number: string }> }) {
  const resolvedParams = use(params);
  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { theme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function fetchIssue() {
      try {
        const data = await getIssue(parseInt(resolvedParams.number));
        setIssue(data);
      } catch (error) {
        console.error('Error fetching issue:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchIssue();
  }, [resolvedParams.number]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#22272e] p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0969da] dark:border-[#2f81f7]"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#22272e] p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-16">
            <h2 className="text-xl font-semibold text-[#24292f] dark:text-[#adbac7] mb-2">
              Issue not found
            </h2>
            <p className="text-[#57606a] dark:text-[#768390] mb-4">
              The issue you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
            </p>
            <Button
              onClick={() => router.push('/')}
              variant="outline"
              className="border-gray-200 dark:border-[#373e47] hover:bg-gray-50 dark:hover:bg-[#2d333b]"
            >
              Return to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#22272e] p-4">
      <div className="max-w-4xl mx-auto animate-content-show">
        <div className="mb-12">
          <Button
            onClick={() => router.push('/')}
            variant="link"
            className="text-[#57606a] dark:text-[#768390] hover:text-[#0969da] dark:hover:text-[#2f81f7] group hover:no-underline text-lg py-2 pl-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5 transition-transform group-hover:-translate-x-0.5">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Issues
          </Button>
        </div>
        
        <div className="bg-white dark:bg-[#2d333b] border border-gray-200 dark:border-[#373e47] rounded-lg shadow-sm">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="space-y-1 flex-1 min-w-0 pr-4">
                <h1 className="text-2xl font-bold text-[#24292f] dark:text-[#adbac7]">
                  {issue.title}
                </h1>
                <div className="flex items-center gap-2 text-xs text-[#57606a] dark:text-[#768390]">
                  <span>#{issue.number}</span>
                  <span>·</span>
                  <span>
                    <time dateTime={issue.created_at} className="whitespace-nowrap">
                      {new Date(issue.created_at).toLocaleDateString()}
                    </time>
                  </span>
                </div>
              </div>
              <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full"
                style={mounted && issue?.state === 'open' 
                  ? STATUS_COLORS.open[theme === 'dark' ? 'dark' : 'light'].style
                  : STATUS_COLORS.closed[theme === 'dark' ? 'dark' : 'light'].style
                }
              >
                <span className="relative flex w-2 h-2 mr-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                    style={mounted && issue?.state === 'open'
                      ? STATUS_COLORS.open[theme === 'dark' ? 'dark' : 'light'].dotStyle
                      : STATUS_COLORS.closed[theme === 'dark' ? 'dark' : 'light'].dotStyle
                    }
                  ></span>
                  <span className="relative inline-flex rounded-full h-2 w-2"
                    style={mounted && issue?.state === 'open'
                      ? STATUS_COLORS.open[theme === 'dark' ? 'dark' : 'light'].dotStyle
                      : STATUS_COLORS.closed[theme === 'dark' ? 'dark' : 'light'].dotStyle
                    }
                  ></span>
                </span>
                {issue?.state}
              </span>
            </div>

            {issue.labels.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {issue.labels.map((label) => (
                  <span
                    key={label.id}
                    className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full"
                    style={getLabelStyles(label.color)}
                    title={label.description || undefined}
                  >
                    {label.name}
                  </span>
                ))}
              </div>
            )}

            <div className="prose dark:prose-invert max-w-none prose-pre:bg-bg-secondary dark:prose-pre:bg-bg-tertiary prose-pre:p-4 prose-pre:rounded-lg prose-pre:my-4 prose-code:text-text-primary dark:prose-code:text-text-primary prose-code:before:content-none prose-code:after:content-none prose-p:leading-relaxed">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
                components={markdownComponents}
                className="text-text-primary"
              >
                {issue.body || ''}
              </ReactMarkdown>
            </div>

            <Backlinks currentIssueNumber={issue.number} />
          </div>
        </div>
      </div>
    </div>
  );
} 