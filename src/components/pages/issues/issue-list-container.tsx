'use client';

import { useState, useCallback, useEffect } from 'react';
import { IssueList } from '@/components/pages/issues/issue-list';
import { PageLayout } from '@/components/layouts/page-layout';
import { GitHubConfig, Issue } from '@/types/github';
import { ConfigDialog } from '@/components/pages/config-dialog';
import { setConfig } from '@/lib/github';
import { toast } from 'sonner';
import { errorLog } from '@/lib/debug';

interface IssueListContainerProps {
  initialIssues: Issue[];
  initialConfig: GitHubConfig;
  onSync: () => Promise<{
    success: boolean;
    totalSynced: number;
    syncType: 'full' | 'add';
  }>;
}

export function IssueListContainer({ initialIssues, onSync }: IssueListContainerProps) {
  const [issues, setIssues] = useState<Issue[]>(Array.isArray(initialIssues) ? initialIssues : []);
  const [displayedIssues, setDisplayedIssues] = useState<Issue[]>([]);  // 用于显示的分页数据
  const [displayCount, setDisplayCount] = useState(10);  // 初始显示10条
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // Update local issues when initialIssues change
  useEffect(() => {
    if (Array.isArray(initialIssues)) {
      setIssues(initialIssues);
    }
  }, [initialIssues]);

  // Update displayed issues when issues change or display count changes
  useEffect(() => {
    const filtered = Array.isArray(issues) ? issues.filter((issue: Issue) => {
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
    }) : [];

    setDisplayedIssues(filtered.slice(0, displayCount));
  }, [issues, displayCount, selectedLabel, searchQuery]);

  const handleSync = useCallback(async () => {
    setLoading(true);
    try {
      const result = await onSync();
      if (result?.success) {
        if (result.totalSynced === 0) {
          toast.success('No updates found since last sync');
        } else {
          const syncTypeText = result.syncType === 'full' ? 'Full sync:' : 'Incremental sync:';
          toast.success(`${syncTypeText} Successfully synced ${result.totalSynced} issues from GitHub`);
        }
      } else {
        toast.error('Failed to sync with GitHub');
      }
    } catch (error) {
      errorLog('Sync failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to sync with GitHub');
    } finally {
      setLoading(false);
    }
  }, [onSync]);

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

  const filteredIssues = Array.isArray(issues) ? issues.filter((issue: Issue) => {
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
  }) : [];

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
            loading={loading}
            hasMore={displayedIssues.length < filteredIssues.length}
            loadingMore={loadingMore}
          />
        </div>
      </PageLayout>
      <ConfigDialog 
        isOpen={showConfig} 
        onClose={() => setShowConfig(false)}
        onSave={async (config) => {
          try {
            await setConfig(config);
            setShowConfig(false);
            toast.success('Configuration saved successfully');
          } catch (error) {
            errorLog('Failed to save config:', error);
            toast.error('Failed to save configuration');
          }
        }}
      />
    </>
  );
} 