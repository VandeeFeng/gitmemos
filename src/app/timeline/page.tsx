'use client';

import { useState, useEffect } from 'react';
import { Timeline } from '@/components/timeline';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { SearchBar } from '@/components/search-bar';
import { useTheme } from 'next-themes';
import { getIssues } from '@/lib/github';
import { Issue } from '@/types/github';
import { LabelFilter } from '@/components/label-filter';

export default function TimelinePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
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
          <header className="flex items-center justify-between py-4 mt-4 mb-4">
            <div className="flex items-center gap-4">
              <div className="text-2xl font-bold">GitMemo</div>
            </div>
          </header>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#22272e] transition-colors duration-500">
      <header className="fixed top-0 left-0 right-0 bg-white/80 dark:bg-[#22272e]/80 backdrop-blur-sm z-40">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between py-4 md:py-10">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-2xl font-bold text-[#24292f] dark:text-[#adbac7] hover:text-[#0969da] dark:hover:text-[#2f81f7] transition-colors"
              >
                GitMemo
              </Link>
              <LabelFilter
                selectedLabel={selectedLabel}
                onLabelSelect={(label) => setSelectedLabel(label === selectedLabel ? null : label)}
              />
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                {theme === "dark" ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                  </svg>
                )}
              </button>
            </div>
            <div className="flex items-center gap-4 mt-4 md:mt-0">
              <SearchBar onSearch={handleSearch} issues={issues} />
              <Button 
                asChild
                className="bg-success hover:bg-success/90 text-white border-0 shadow-none transition-colors whitespace-nowrap"
              >
                <Link href="/?new=true">
                  <span className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    New Issue
                  </span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="pt-32 md:pt-40">
        <div className="container mx-auto px-4 max-w-4xl">
          <div>
            <Timeline 
              searchQuery={searchQuery} 
              selectedLabel={selectedLabel} 
              onLabelClick={(label) => setSelectedLabel(label === selectedLabel ? null : label)}
            />
          </div>
        </div>
      </main>
    </div>
  );
} 