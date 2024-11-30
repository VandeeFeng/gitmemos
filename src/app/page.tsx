'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { IssueList } from '@/components/issue-list';
import { IssueEditor } from '@/components/issue-editor';
import { useTheme } from "next-themes";
import { setGitHubConfig, getGitHubConfig, getIssues } from '@/lib/github';
import { LabelFilter } from '@/components/label-filter';
import { SearchBar } from '@/components/search-bar';
import Link from 'next/link';
import { Issue, GitHubConfig, EditableIssue } from '@/types/github';

// 将 Issue 转换为 EditableIssue
const toEditableIssue = (issue: Issue): EditableIssue => ({
  ...issue,
  body: issue.body || ''
});

export default function Home() {
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
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

  // 将所有的客户端操作移到 mounted 之后
  useEffect(() => {
    setMounted(true);
  }, []);

  // 分离配置加载逻辑
  useEffect(() => {
    if (mounted) {
      const uiConfig = getGitHubConfig(false);
      if (uiConfig.owner || uiConfig.repo || uiConfig.token) {
        setGithubConfig(uiConfig);
      }
    }
  }, [mounted]);

  // 分离 issues 加载逻辑
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

  const handleNewIssue = () => {
    setSelectedIssue(null);
    setIsEditing(true);
  };

  const handleEditComplete = () => {
    setIsEditing(false);
    setSelectedIssue(null);
  };

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

  // 避免闪烁，使用一致的初始渲染
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
      <div className="container mx-auto px-4 max-w-4xl">
        {showSuccess && (
          <div className="fixed top-4 right-4 bg-success/10 dark:bg-success/20 border border-success/20 dark:border-success/30 text-success dark:text-success px-4 py-2 rounded-lg shadow-sm flex items-center gap-2 animate-fade-in">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5"></path>
            </svg>
            <span className="text-sm font-medium">GitHub connection successful!</span>
          </div>
        )}
        <header className="fixed top-0 left-0 right-0 bg-white/80 dark:bg-[#22272e]/80 backdrop-blur-sm z-40">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="flex items-center justify-between py-10">
              <div className="flex items-center gap-4">
                <Link
                  href="/"
                  className="text-2xl font-bold text-[#24292f] dark:text-[#adbac7] hover:text-[#0969da] dark:hover:text-[#2f81f7] transition-colors"
                  onClick={() => {
                    setSelectedIssue(null);
                    setIsEditing(false);
                    setSelectedLabel(null);
                  }}
                >
                  GitMemo
                </Link>
                <LabelFilter
                  selectedLabel={selectedLabel}
                  onLabelSelect={setSelectedLabel}
                />
                <button
                  onClick={() => setShowConfig(!showConfig)}
                  className="text-[#57606a] dark:text-[#768390] hover:text-[#24292f] dark:hover:text-[#adbac7] transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </button>
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
              <div className="flex items-center gap-4">
                <SearchBar onSearch={handleSearch} issues={issues} />
                <Button 
                  onClick={handleNewIssue}
                  className="bg-success hover:bg-success/90 text-white border-0 shadow-none transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    New Issue
                  </span>
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="pt-40">
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
            ) : isEditing ? (
              <div className="animate-fade-in">
                <IssueEditor
                  issue={selectedIssue ? toEditableIssue(selectedIssue) : undefined}
                  onSave={handleEditComplete}
                  onCancel={() => setIsEditing(false)}
                />
              </div>
            ) : (
              <div className="animate-fade-in">
                <IssueList
                  onSelect={(issue) => {
                    setSelectedIssue(issue);
                    setIsEditing(true);
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
