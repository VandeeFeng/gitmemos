'use client';

import { useState, useCallback, useEffect } from 'react';
import { IssueList } from './issue-list';
import { PageLayout } from './layouts/page-layout';
import { GitHubConfig, Issue } from '@/types/github';
import { useIssues } from '@/lib/contexts/issue-context';
import { ConfigDialog } from './config-dialog';
import { toast } from 'sonner';

interface IssueListContainerProps {
  initialIssues: Issue[];
  initialConfig: GitHubConfig;
}

export function IssueListContainer({ initialIssues }: IssueListContainerProps) {
  const { issues: contextIssues, loading: contextLoading, syncIssues } = useIssues();
  const [issues, setIssues] = useState<Issue[]>(contextIssues.length > 0 ? contextIssues : initialIssues);
  const [displayedIssues, setDisplayedIssues] = useState<Issue[]>([]);  // 用于显示的分页数据
  const [displayCount, setDisplayCount] = useState(10);  // 初始显示10条
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // Update local issues when context issues change
  useEffect(() => {
    if (contextIssues.length > 0) {
      setIssues(contextIssues);
    }
  }, [contextIssues]);

  // Update displayed issues when issues change or display count changes
  useEffect(() => {
    const filtered = issues.filter((issue: Issue) => {
      if (selectedLabel && !issue.labels.some((label: { name: string }) => label.name === selectedLabel)) {
        return false;
      }
      
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const titleMatch = issue.title.toLowerCase().includes(searchLower);
        const bodyMatch = (issue.body || '').toLowerCase().includes(searchLower);
        const labelsMatch = issue.labels.some((label: { name: string; description: string | null }) => 
          label.name.toLowerCase().includes(searchLower) ||
          (label.description || '').toLowerCase().includes(searchLower)
        );
        return titleMatch || bodyMatch || labelsMatch;
      }
      
      return true;
    });

    setDisplayedIssues(filtered.slice(0, displayCount));
  }, [issues, displayCount, selectedLabel, searchQuery]);

  const handleSync = useCallback(async () => {
    setLoading(true);
    try {
      await syncIssues();
      toast.success('Successfully synced with GitHub');
    } catch (error) {
      console.error('Sync failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to sync with GitHub');
    } finally {
      setLoading(false);
    }
  }, [syncIssues]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      setDisplayCount(prev => prev + 10);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setDisplayCount(10);  // 重置显示数量
  }, []);

  const handleLabelSelect = useCallback((label: string) => {
    setSelectedLabel(label === selectedLabel ? null : label);
    setDisplayCount(10);  // 重置显示数量
  }, [selectedLabel]);

  const filteredIssues = issues.filter((issue: Issue) => {
    if (selectedLabel && !issue.labels.some((label: { name: string }) => label.name === selectedLabel)) {
      return false;
    }
    
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const titleMatch = issue.title.toLowerCase().includes(searchLower);
      const bodyMatch = (issue.body || '').toLowerCase().includes(searchLower);
      const labelsMatch = issue.labels.some((label: { name: string; description: string | null }) => 
        label.name.toLowerCase().includes(searchLower) ||
        (label.description || '').toLowerCase().includes(searchLower)
      );
      return titleMatch || bodyMatch || labelsMatch;
    }
    
    return true;
  });

  return (
    <>
      <PageLayout
        selectedLabel={selectedLabel}
        onLabelSelect={handleLabelSelect}
        onSearch={handleSearch}
        showConfig={true}
        onConfigClick={() => setShowConfig(true)}
        issues={filteredIssues}
        onSync={handleSync}
      >
        <div className="animate-fade-in">
          <IssueList 
            issues={displayedIssues}
            selectedLabel={selectedLabel}
            onLabelClick={handleLabelSelect}
            searchQuery={searchQuery}
            onLoadMore={handleLoadMore}
            loading={loading || contextLoading}
            hasMore={displayedIssues.length < filteredIssues.length}
            loadingMore={loadingMore}
          />
        </div>
      </PageLayout>
      <ConfigDialog 
        isOpen={showConfig} 
        onClose={() => setShowConfig(false)} 
      />
    </>
  );
} 