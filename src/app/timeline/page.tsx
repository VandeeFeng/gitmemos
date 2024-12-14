'use client';

import { useState } from 'react';
import { Timeline } from '@/components/pages/timeline';
import { PageLayout } from '@/components/layouts/page-layout';
import { Loading } from '@/components/ui/loading';
import { animations } from '@/lib/animations';
import { useIssues } from '@/lib/contexts/issue-context';

export default function TimelinePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const { issues, loading: contextLoading, isInitializing } = useIssues();

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Filter issues based on selected label
  const filteredIssues = selectedLabel
    ? issues.filter(issue => issue.labels.some(label => label.name === selectedLabel))
    : issues;

  return (
    <PageLayout
      selectedLabel={selectedLabel}
      onLabelSelect={(label) => setSelectedLabel(label === selectedLabel ? null : label)}
      onSearch={handleSearch}
      issues={filteredIssues}
      showFooter={false}
    >
      {(contextLoading || isInitializing) ? (
        <Loading />
      ) : (
        <div className={animations.fade.in}>
          <Timeline 
            searchQuery={searchQuery} 
            selectedLabel={selectedLabel} 
            onLabelClick={(label) => setSelectedLabel(label === selectedLabel ? null : label)}
            issues={filteredIssues}
          />
        </div>
      )}
    </PageLayout>
  );
} 