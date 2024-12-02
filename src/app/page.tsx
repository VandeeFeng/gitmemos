'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { IssueList } from '@/components/issue-list';
import { useTheme } from "next-themes";
import { setGitHubConfig, getGitHubConfig, getIssues } from '@/lib/github';
import { LabelFilter } from '@/components/label-filter';
import { SearchBar } from '@/components/search-bar';
import Link from 'next/link';
import { Issue, GitHubConfig, EditableIssue } from '@/types/github';
import { Header } from '@/components/header';
import { useRouter } from 'next/navigation';

// 将 Issue 转换为 EditableIssue
const toEditableIssue = (issue: Issue): EditableIssue => ({
  ...issue,
  body: issue.body || ''
});

export default function Home() {
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [issues, setIssues] = useState<Issue[]>([]);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [githubConfig, setGithubConfig] = useState<GitHubConfig>({
    owner: '',
    repo: '',
    token: '',
    issuesPerPage: 10
  });
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      const uiConfig = getGitHubConfig(false);
      if (uiConfig.owner || uiConfig.repo || uiConfig.token) {
        setGithubConfig(uiConfig);
      }
    }
  }, [mounted]);

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

  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!githubConfig.owner.trim() || !githubConfig.repo.trim() || !githubConfig.token.trim()) {
        throw new Error('Please fill in all required fields');
      }

      setGitHubConfig(githubConfig);
      setShowConfig(false);
      setShowSuccess(true);
      
      setTimeout(() => {
        setShowSuccess(false);
        window.location.reload();
      }, 3000);
    } catch (error) {
      console.error('Error saving config:', error);
      alert(error instanceof Error ? error.message : 'Failed to save configuration');
    }
  };

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
      <div className="container mx-auto px-4 max-w-4xl">
        {showSuccess && (
          <div className="fixed top-4 right-4 bg-success/10 dark:bg-success/20 border border-success/20 dark:border-success/30 text-success dark:text-success px-4 py-2 rounded-lg shadow-sm flex items-center gap-2 animate-fade-in">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5"></path>
            </svg>
            <span className="text-sm font-medium">GitHub connection successful!</span>
          </div>
        )}
        <Header 
          onSearch={handleSearch}
          issues={issues}
          selectedLabel={selectedLabel}
          onLabelSelect={setSelectedLabel}
          showConfig={true}
          onConfigClick={() => setShowConfig(!showConfig)}
        />
        <main className="pt-32 md:pt-40">
          <div className="bg-white dark:bg-[#22272e]">
            {showConfig ? (
              <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 animate-fade-in">
                <div className="bg-white dark:bg-[#2d333b] rounded-lg shadow-lg max-w-2xl w-full mx-4 animate-content-show">
                  <div className="flex items-center justify-between p-4 border-b border-[#d0d7de] dark:border-[#444c56]">
                    <h2 className="text-lg font-semibold text-[#24292f] dark:text-[#adbac7]">GitHub Configuration</h2>
                    <button
                      onClick={() => setShowConfig(false)}
                      className="text-[#57606a] dark:text-[#768390] hover:text-[#24292f] dark:hover:text-[#adbac7]"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                  <div className="p-6">
                    <form onSubmit={handleConfigSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-[#24292f] dark:text-[#adbac7] mb-1">
                            Owner <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={githubConfig.owner}
                            onChange={(e) => setGithubConfig({...githubConfig, owner: e.target.value})}
                            className="w-full px-3 py-2 border border-[#d0d7de] dark:border-[#444c56] rounded-lg bg-white dark:bg-[#22272e] text-[#24292f] dark:text-[#adbac7] focus:outline-none focus:ring-2 focus:ring-[#0969da] dark:focus:ring-[#2f81f7]"
                            placeholder="GitHub username or organization"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#24292f] dark:text-[#adbac7] mb-1">
                            Repository <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={githubConfig.repo}
                            onChange={(e) => setGithubConfig({...githubConfig, repo: e.target.value})}
                            className="w-full px-3 py-2 border border-[#d0d7de] dark:border-[#444c56] rounded-lg bg-white dark:bg-[#22272e] text-[#24292f] dark:text-[#adbac7] focus:outline-none focus:ring-2 focus:ring-[#0969da] dark:focus:ring-[#2f81f7]"
                            placeholder="Repository name"
                            required
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-[#24292f] dark:text-[#adbac7] mb-1">
                            Token <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="password"
                            value={githubConfig.token}
                            onChange={(e) => setGithubConfig({...githubConfig, token: e.target.value})}
                            className="w-full px-3 py-2 border border-[#d0d7de] dark:border-[#444c56] rounded-lg bg-white dark:bg-[#22272e] text-[#24292f] dark:text-[#adbac7] focus:outline-none focus:ring-2 focus:ring-[#0969da] dark:focus:ring-[#2f81f7]"
                            placeholder="GitHub personal access token"
                            required
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-4 mt-6">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowConfig(false)}
                          className="border-[#d0d7de] dark:border-[#444c56] text-[#24292f] dark:text-[#adbac7] hover:bg-[#f6f8fa] dark:hover:bg-[#373e47]"
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit"
                          className="bg-[#2da44e] hover:bg-[#2c974b] text-white border-0"
                        >
                          Save Configuration
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            ) : (
              <div className="animate-fade-in">
                <IssueList
                  onSelect={(issue) => {
                    router.push(`/editor?edit=${issue.number}`);
                  }}
                  selectedLabel={selectedLabel}
                  onLabelClick={(label) => {
                    setSelectedLabel(label === selectedLabel ? null : label);
                  }}
                  searchQuery={searchQuery}
                />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
