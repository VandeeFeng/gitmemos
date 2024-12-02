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
  const [systemTheme, setSystemTheme] = useState<'dark' | 'light'>('light');

  useEffect(() => {
    // 检测系统主题
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemTheme(darkModeMediaQuery.matches ? 'dark' : 'light');
    
    // 监听系统主题变化
    const handleThemeChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };
    darkModeMediaQuery.addEventListener('change', handleThemeChange);
    
    setMounted(true);
    
    return () => {
      darkModeMediaQuery.removeEventListener('change', handleThemeChange);
    };
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
    fetchIssues();
  }, []);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  if (!mounted) {
    return (
      <div className={`min-h-screen ${systemTheme === 'dark' ? 'bg-[#22272e]' : 'bg-white'} transition-colors duration-500`}>
        <div className="container mx-auto p-4 max-w-4xl">
          <Header />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#22272e] transition-colors duration-500 overflow-y-scroll">
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