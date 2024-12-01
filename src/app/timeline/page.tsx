'use client';

import { useState, useEffect } from 'react';
import { Timeline } from '@/components/timeline';
import { getIssues } from '@/lib/github';
import { Issue } from '@/types/github';
import { Header } from '@/components/header';

export default function TimelinePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  useEffect(() => {
    async function fetchIssues() {
      try {
        const data = await getIssues(1);
        setIssues(data);
      } catch (error) {
        console.error('Error fetching issues:', error);
      }
    }
    fetchIssues();
  }, []);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#22272e] transition-colors duration-500">
      <Header 
        selectedLabel={selectedLabel}
        onLabelSelect={(label) => setSelectedLabel(label === selectedLabel ? null : label)}
        onSearch={handleSearch}
        issues={issues}
      />
      <main className="container mx-auto px-4 max-w-4xl pt-32 md:pt-40">
        <div className="animate-fade-in">
          <Timeline 
            searchQuery={searchQuery} 
            selectedLabel={selectedLabel} 
            onLabelClick={(label) => setSelectedLabel(label === selectedLabel ? null : label)}
          />
        </div>
      </main>
    </div>
  );
} 