'use client';

import { Button } from './ui/button';
import { Issue } from '@/types/github';
import { IssueCard } from './issue-card';
import { Loading } from './ui/loading';

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
      {issues.map((issue) => (
        <div key={issue.number}>
          <IssueCard
            issue={issue}
            selectedLabel={selectedLabel}
            onLabelClick={onLabelClick}
          />
        </div>
      ))}
      {hasMore && (
        <div className="flex justify-center mt-6">
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