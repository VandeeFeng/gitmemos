import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Issue } from '@/types/github';
import { getIssues } from '@/lib/github';

interface BacklinksProps {
  currentIssueNumber: number;
}

export function Backlinks({ currentIssueNumber }: BacklinksProps) {
  const [backlinks, setBacklinks] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchBacklinks() {
      setLoading(true);
      try {
        // 获取所有 issues
        const result = await getIssues(1, undefined, false);
        // 过滤出引用了当前 issue 的其他 issues
        const linkedIssues = result.issues.filter(issue => {
          const pattern = new RegExp(`#${currentIssueNumber}\\b`);
          return issue.number !== currentIssueNumber && pattern.test(issue.body || '');
        });
        setBacklinks(linkedIssues);
      } catch (error) {
        console.error('Error fetching backlinks:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchBacklinks();
  }, [currentIssueNumber]);

  if (loading) {
    return (
      <div className="border-t border-gray-200 dark:border-[#373e47] mt-8 pt-6">
        <div className="animate-pulse flex space-x-4">
          <div className="h-4 bg-gray-200 dark:bg-[#373e47] rounded w-24"></div>
        </div>
      </div>
    );
  }

  if (backlinks.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-gray-200 dark:border-[#373e47] mt-8 pt-6">
      <h3 className="text-sm font-semibold text-[#24292f] dark:text-[#adbac7] mb-3 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
        </svg>
        Backlinks
      </h3>
      <div className="space-y-1">
        {backlinks.map(issue => (
          <Link
            key={issue.number}
            href={`/issue/${issue.number}`}
            className="block p-2 rounded-md hover:bg-[#f6f8fa] dark:hover:bg-[#2d333b] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#57606a] dark:text-[#768390]">#{issue.number}</span>
              <h4 className="text-sm font-medium text-[#24292f] dark:text-[#adbac7] truncate">
                {issue.title}
              </h4>
            </div>
            {issue.labels.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {issue.labels.map(label => (
                  <span
                    key={label.id}
                    className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full"
                    style={{
                      backgroundColor: `#${label.color}20`,
                      color: `#${label.color}`,
                      border: `1px solid #${label.color}40`
                    }}
                  >
                    {label.name}
                  </span>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
