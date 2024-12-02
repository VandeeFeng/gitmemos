'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getIssue } from '@/lib/github';
import { Issue } from '@/types/github';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { markdownComponents } from '@/components/markdown-components';
import { Backlinks } from '@/components/backlinks';
import { FormattedDate } from '@/components/formatted-date';

interface PageProps {
  params: {
    number: string;
  };
}

export default function IssuePage({ params }: PageProps) {
  const [issue, setIssue] = useState<Issue | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchIssue() {
      try {
        const data = await getIssue(parseInt(params.number));
        setIssue(data);
      } catch (error) {
        console.error('Error fetching issue:', error);
      }
    }
    fetchIssue();
  }, [params.number]);

  if (!issue) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#22272e] p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-center items-center min-h-[200px]">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-[#f6f8fa] dark:border-[#2d333b] rounded-full"></div>
              <div className="absolute inset-0 border-4 border-t-[#2da44e] dark:border-t-[#2f81f7] rounded-full animate-spin"></div>
            </div>
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
                    <FormattedDate date={issue.created_at} />
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => router.push(`/?edit=${issue.number}`)}
                className="text-[#57606a] dark:text-[#768390] hover:text-[#24292f] dark:hover:text-[#adbac7] hover:bg-[#f6f8fa] dark:hover:bg-[#373e47] border-[#d0d7de] dark:border-[#444c56]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                Edit
              </Button>
            </div>
            <div className="prose dark:prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
                components={markdownComponents}
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