'use client';

import { Button } from '@/components/ui/button';
import { Issue } from '@/types/github';
import { IssueCard } from './issue-card';
import { Loading } from '@/components/ui/loading';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useEffect } from 'react';

interface IssueListProps {
  selectedLabel: string | null;
  onLabelClick: (label: string) => void;
  searchQuery?: string;
  issues: Issue[];
  onLoadMore: () => Promise<void>;
  loading?: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
}

export function IssueList({ 
  selectedLabel,
  onLabelClick,
  searchQuery = '',
  issues,
  onLoadMore,
  loading = false,
  hasMore = false,
  loadingMore = false
}: IssueListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: issues.length,
    getScrollElement: () => document.documentElement,
    estimateSize: () => 120,
    overscan: 5
  });

  // Intersection Observer for infinite loading
  useEffect(() => {
    if (!hasMore || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { threshold: 0.5 }
    );

    const loadMoreTrigger = document.getElementById('load-more-trigger');
    if (loadMoreTrigger) {
      observer.observe(loadMoreTrigger);
    }

    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  if (loading && !loadingMore) {
    return <Loading />;
  }

  if (issues.length === 0) {
    return (
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
    );
  }

  return (
    <div className="space-y-4">
      <div
        ref={parentRef}
        style={{
          width: '100%',
          position: 'relative',
          height: `${rowVirtualizer.getTotalSize()}px`,
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.index}
            data-index={virtualRow.index}
            ref={rowVirtualizer.measureElement}
            className="absolute left-0 w-full"
            style={{
              transform: `translateY(${virtualRow.start}px)`,
              padding: '0.5rem 0',
            }}
          >
            <IssueCard
              issue={issues[virtualRow.index]}
              selectedLabel={selectedLabel}
              onLabelClick={onLabelClick}
            />
          </div>
        ))}
      </div>
      
      {hasMore && (
        <div id="load-more-trigger" className="flex justify-center py-4">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="text-text-secondary border-default hover:bg-bg-secondary dark:hover:bg-bg-tertiary hover:text-text-primary shadow-card dark:shadow-card-dark px-4"
          >
            {loadingMore ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle 
                    className="opacity-25" 
                    cx="12" 
                    cy="12" 
                    r="10" 
                    stroke="currentColor" 
                    strokeWidth="4"
                    fill="none"
                  />
                  <path 
                    className="opacity-75" 
                    fill="currentColor" 
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Loading...
              </span>
            ) : (
              'Load more'
            )}
          </Button>
        </div>
      )}
    </div>
  );
} 