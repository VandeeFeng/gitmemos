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
import { Header } from '@/components/header';
import { IssueEditor } from '@/components/issue-editor';

export default function TimelinePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

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

  const handleNewIssue = () => {
    setSelectedIssue(null);
    setIsEditing(true);
  };

  const handleEditComplete = () => {
    setIsEditing(false);
    setSelectedIssue(null);
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
        onNewIssue={handleNewIssue}
      />
      <main className="container mx-auto px-4 max-w-4xl pt-32 md:pt-40">
        {isEditing ? (
          <div className="animate-fade-in">
            <IssueEditor
              issue={selectedIssue ? { ...selectedIssue, body: selectedIssue.body || '' } : undefined}
              onSave={handleEditComplete}
              onCancel={() => setIsEditing(false)}
            />
          </div>
        ) : (
          <div>
            <Timeline 
              searchQuery={searchQuery} 
              selectedLabel={selectedLabel} 
              onLabelClick={(label) => setSelectedLabel(label === selectedLabel ? null : label)}
            />
          </div>
        )}
      </main>
    </div>
  );
} 