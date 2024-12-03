'use client';

import { useState, useEffect } from 'react';
import { Timeline } from '@/components/timeline';
import { getIssues } from '@/lib/github';
import { Issue } from '@/types/github';
import { PageLayout } from '@/components/layouts/page-layout';
import { Loading } from '@/components/ui/loading';
import { animations } from '@/lib/animations';

export default function TimelinePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchIssues() {
      try {
        const result = await getIssues(1, undefined, false);
        setIssues(result.issues || []);
      } catch (error) {
        console.error('Error fetching issues:', error);
        setIssues([]);
      } finally {
        setLoading(false);
      }
    }
    fetchIssues();
  }, []);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  return (
    <PageLayout
      selectedLabel={selectedLabel}
      onLabelSelect={(label) => setSelectedLabel(label === selectedLabel ? null : label)}
      onSearch={handleSearch}
      issues={issues}
      showFooter={false}
    >
      {loading ? (
        <Loading />
      ) : (
        <div className={animations.fade.in}>
          <Timeline 
            searchQuery={searchQuery} 
            selectedLabel={selectedLabel} 
            onLabelClick={(label) => setSelectedLabel(label === selectedLabel ? null : label)}
            issues={issues}
          />
        </div>
      )}
    </PageLayout>
  );
} 