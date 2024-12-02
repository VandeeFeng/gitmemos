'use client';

import { useState, useEffect } from 'react';
import { Timeline } from '@/components/timeline';
import { useTheme } from 'next-themes';
import { getIssues } from '@/lib/github';
import { Issue } from '@/types/github';
import { Header } from '@/components/header';

export default function TimelinePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const { } = useTheme();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function fetchIssues() {
      try {
        const data = await getIssues(1);
        setIssues(data);
      } catch (error) {
        console.error('Error fetching issues:', error);
      }
    }
    if (mounted) {
      fetchIssues();
    }
  }, [mounted]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#22272e] transition-colors duration-500">
        <div className="container mx-auto p-4 max-w-4xl">
          <Header />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#22272e] transition-colors duration-500">
      <Header 
        selectedLabel={selectedLabel}
        onLabelSelect={(label) => setSelectedLabel(label === selectedLabel ? null : label)}
        onSearch={handleSearch}
        issues={issues}
      />
      <main className="container mx-auto px-4 max-w-4xl pt-32 md:pt-40">
        <div>
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