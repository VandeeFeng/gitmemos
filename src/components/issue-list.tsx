'use client';

import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Issue } from '@/types/github';
import { IssueCard } from './issue-card';

interface IssueListProps {
  selectedLabel: string | null;
  onLabelClick: (label: string) => void;
  searchQuery?: string;
  issues: Issue[];
  onLoadMore: (page: number) => Promise<boolean>;
  loading?: boolean;
}

export function IssueList({ 
  selectedLabel,
  onLabelClick,
  searchQuery = '',
  issues,
  onLoadMore,
  loading = false
}: IssueListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setHasMore(issues.length === 10);
    setCurrentPage(1);
  }, [issues]);

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const hasMoreIssues = await onLoadMore(nextPage);
      
      if (hasMoreIssues) {
        setCurrentPage(nextPage);
        setHasMore(true);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more issues:', error);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  const filteredIssues = issues.filter(issue => {
    if (!searchQuery) return true;

    const searchLower = searchQuery.toLowerCase();
    const titleMatch = issue.title.toLowerCase().includes(searchLower);
    const bodyMatch = (issue.body || '').toLowerCase().includes(searchLower);
    const labelsMatch = issue.labels.some(label => 
      label.name.toLowerCase().includes(searchLower) ||
      (label.description || '').toLowerCase().includes(searchLower)
    );

    return titleMatch || bodyMatch || labelsMatch;
  });

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="flex items-center gap-2 text-text-secondary">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Loading issues...</span>
          </div>
        </div>
      ) : filteredIssues.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-text-secondary">
            {searchQuery 
              ? 'No issues found matching your search'
              : selectedLabel
                ? 'No issues found with this label'
                : 'No issues found'
            }
          </div>
        </div>
      ) : (
        <>
          {filteredIssues.map((issue) => (
            <div key={issue.number}>
              <IssueCard
                issue={issue}
                selectedLabel={selectedLabel}
                onLabelClick={onLabelClick}
              />
            </div>
          ))}
          {hasMore && filteredIssues.length >= 10 && (
            <div className="flex justify-center mt-6">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loadingMore}
                className="text-text-secondary border-default hover:bg-bg-secondary dark:hover:bg-bg-tertiary hover:text-text-primary shadow-card dark:shadow-card-dark px-4"
              >
                {loadingMore ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading...
                  </span>
                ) : (
                  'Load more'
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
} 