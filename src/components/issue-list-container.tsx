'use client';

import { useState, useCallback } from 'react';
import { IssueList } from './issue-list';
import { PageLayout } from './layouts/page-layout';
import { GitHubConfig, Issue } from '@/types/github';
import { getIssues } from '@/lib/github';

interface IssueListContainerProps {
  initialIssues: Issue[];
  initialConfig: GitHubConfig;
}

interface LoadMoreResult {
  issues: Issue[];
  syncStatus: {
    success: boolean;
    totalSynced: number;
    lastSyncAt: string;
  } | null;
}

// 内存缓存
const loadMoreCache: Record<string, Promise<boolean> | undefined> = {};

export function IssueListContainer({ initialIssues }: IssueListContainerProps) {
  const [issues, setIssues] = useState(initialIssues);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSync = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getIssues(1, undefined, true);
      setIssues(result.issues);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLoadMore = useCallback(async (page: number) => {
    const cacheKey = `${page}:${selectedLabel || ''}`;
    
    // 如果已经有正在进行的请求，直接返回该请求
    if (loadMoreCache[cacheKey]) {
      return loadMoreCache[cacheKey];
    }

    setLoading(true);
    
    try {
      // 创建新的请求并缓存
      loadMoreCache[cacheKey] = getIssues(page, selectedLabel || undefined, false)
        .then((result: LoadMoreResult) => {
          const existingIssueNumbers = new Set(issues.map(issue => issue.number));
          const newIssues = result.issues.filter(issue => !existingIssueNumbers.has(issue.number));
          
          if (newIssues.length > 0) {
            setIssues(prev => [...prev, ...newIssues]);
          }
          
          return result.issues.length === 10;
        })
        .catch((error: Error) => {
          console.error('Error loading more issues:', error);
          return false;
        })
        .finally(() => {
          setLoading(false);
          // 清除缓存
          delete loadMoreCache[cacheKey];
        });

      return loadMoreCache[cacheKey];
    } catch (error) {
      console.error('Error loading more issues:', error instanceof Error ? error.message : String(error));
      setLoading(false);
      return false;
    }
  }, [issues, selectedLabel]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const filteredIssues = issues.filter(issue => {
    if (selectedLabel && !issue.labels.some(label => label.name === selectedLabel)) {
      return false;
    }
    
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const titleMatch = issue.title.toLowerCase().includes(searchLower);
      const bodyMatch = (issue.body || '').toLowerCase().includes(searchLower);
      const labelsMatch = issue.labels.some(label => 
        label.name.toLowerCase().includes(searchLower) ||
        (label.description || '').toLowerCase().includes(searchLower)
      );
      return titleMatch || bodyMatch || labelsMatch;
    }
    
    return true;
  });

  return (
    <PageLayout
      selectedLabel={selectedLabel}
      onLabelSelect={(label) => setSelectedLabel(label === selectedLabel ? null : label)}
      onSearch={handleSearch}
      showConfig={true}
      issues={filteredIssues}
      onSync={handleSync}
    >
      <div className="animate-fade-in">
        <IssueList 
          issues={filteredIssues}
          selectedLabel={selectedLabel}
          onLabelClick={(label) => setSelectedLabel(label === selectedLabel ? null : label)}
          searchQuery={searchQuery}
          onLoadMore={handleLoadMore}
          loading={loading}
        />
      </div>
    </PageLayout>
  );
} 