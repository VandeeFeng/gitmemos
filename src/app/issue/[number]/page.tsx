'use client';

import { useEffect, useState, use } from 'react';
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
import { PageLayout } from '@/components/layouts/page-layout';
import { Loading } from '@/components/ui/loading';

interface PageProps {
  params: Promise<{
    number: string;
  }>;
}

export default function IssuePage({ params }: PageProps) {
  const resolvedParams = use(params);
  const [issue, setIssue] = useState<Issue | null>(null);
  const [isContentReady, setIsContentReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    setIsContentReady(false);
    
    async function fetchIssue() {
      if (!resolvedParams?.number) return;
      
      try {
        const data = await getIssue(parseInt(resolvedParams.number), false);
        if (mounted) {
          setIssue(data);
          // 使用 requestAnimationFrame 确保在下一帧再设置 ready 状态
          // 这样可以给内容渲染留出时间
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (mounted) {
                setIsContentReady(true);
              }
            });
          });
        }
      } catch (error) {
        console.error('Error fetching issue:', error);
        if (mounted) {
          setIsContentReady(true);
        }
      }
    }

    fetchIssue();

    return () => {
      mounted = false;
    };
  }, [resolvedParams?.number]);

  if (!issue || !isContentReady) {
    return (
      <PageLayout showFooter={false} showSearchAndNew={false}>
        <Loading />
      </PageLayout>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#22272e] p-4">
      <div className="max-w-4xl mx-auto animate-content-show">
        <div className="mb-12">
          <Button
            onClick={() => router.back()}
            variant="link"
            className="text-[#57606a] dark:text-[#768390] hover:text-[#0969da] dark:hover:text-[#2f81f7] group hover:no-underline text-lg py-2 pl-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5 transition-transform group-hover:-translate-x-0.5">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
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