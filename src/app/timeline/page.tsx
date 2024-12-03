'use client';

import { useState, useEffect } from 'react';
import { Timeline } from '@/components/timeline';
import { PageLayout } from '@/components/layouts/page-layout';
import { Loading } from '@/components/ui/loading';
import { animations } from '@/lib/animations';
import { useIssues } from '@/lib/contexts/issue-context';
import { Issue } from '@/types/github';
import { getIssues } from '@/lib/github';

// 内存缓存
const issuesCache: Record<string, { issues: Issue[]; timestamp: number }> = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export default function TimelinePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [localIssues, setLocalIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(false);
  const { issues, loading: contextLoading, isInitializing } = useIssues();

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  useEffect(() => {
    const fetchIssues = async () => {
      if (!selectedLabel) {
        setLocalIssues(issues);
        return;
      }

      const cacheKey = `timeline:${selectedLabel}`;
      const cached = issuesCache[cacheKey];
      
      // Check if we have valid cached data
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        setLocalIssues(cached.issues);
        return;
      }

      setLoading(true);
      try {
        const result = await getIssues(1, selectedLabel, false);
        setLocalIssues(result.issues);
        
        // Cache the result
        issuesCache[cacheKey] = {
          issues: result.issues,
          timestamp: Date.now()
        };
      } catch (error) {
        console.error('Error fetching issues:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchIssues();
  }, [selectedLabel, issues]);

  return (
    <PageLayout
      selectedLabel={selectedLabel}
      onLabelSelect={(label) => setSelectedLabel(label === selectedLabel ? null : label)}
      onSearch={handleSearch}
      issues={localIssues}
      showFooter={false}
    >
      {(loading || contextLoading || isInitializing) ? (
        <Loading />
      ) : (
        <div className={animations.fade.in}>
          <Timeline 
            searchQuery={searchQuery} 
            selectedLabel={selectedLabel} 
            onLabelClick={(label) => setSelectedLabel(label === selectedLabel ? null : label)}
            issues={localIssues}
          />
        </div>
      )}
    </PageLayout>
  );
} 