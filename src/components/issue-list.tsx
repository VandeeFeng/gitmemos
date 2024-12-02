'use client';

import { useEffect, useState } from 'react';
import { getIssues } from '@/lib/github';
import { Button } from './ui/button';
import { Issue } from '@/types/github';
import { IssueCard } from './issue-card';

export function IssueList({ 
  onSelect,
  selectedLabel,
  onLabelClick,
  searchQuery = ''
}: { 
  onSelect: (issue: Issue) => void;
  selectedLabel: string | null;
  onLabelClick: (label: string) => void;
  searchQuery?: string;
}) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    async function fetchIssues() {
      setLoading(true);
      try {
        const data = await getIssues(1, selectedLabel || undefined);
        setIssues(data);
        setHasMore(data.length === 10);
        setCurrentPage(1);
      } catch (error) {
        console.error('Error fetching issues:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchIssues();
  }, [selectedLabel]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const data = await getIssues(nextPage, selectedLabel || undefined);
      setIssues(prev => [...prev, ...data]);
      setCurrentPage(nextPage);
      setHasMore(data.length === 10);
    } catch (error) {
      console.error('Error loading more issues:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const filteredIssues = issues.filter(issue => {
    const matchesLabel = !selectedLabel || issue.labels.some(label => label.name === selectedLabel);
    
    if (!searchQuery) return matchesLabel;

    const searchLower = searchQuery.toLowerCase();
    const titleMatch = issue.title.toLowerCase().includes(searchLower);
    const bodyMatch = (issue.body || '').toLowerCase().includes(searchLower);
    const labelsMatch = issue.labels.some(label => 
      label.name.toLowerCase().includes(searchLower) ||
      (label.description || '').toLowerCase().includes(searchLower)
    );

    return matchesLabel && (titleMatch || bodyMatch || labelsMatch);
  });

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-gray-100 dark:border-[#2d333b] rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-[#2da44e] dark:border-t-[#2f81f7] rounded-full animate-spin"></div>
          </div>
          <p className="text-sm text-[#57606a] dark:text-[#768390] animate-pulse">Loading issues...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {filteredIssues.length === 0 ? (
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
            <div key={issue.number} onClick={() => onSelect(issue)}>
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