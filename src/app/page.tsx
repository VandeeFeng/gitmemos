'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { IssueList } from '@/components/issue-list';
import { IssueEditor } from '@/components/issue-editor';
import { useTheme } from "next-themes";
import { setGitHubConfig, getGitHubConfig } from '@/lib/github';
import { LabelFilter } from '@/components/label-filter';
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

  useEffect(() => {
    setMounted(true);
    // 获取界面配置时不使用环境变量
    const uiConfig = getGitHubConfig(false);
    if (uiConfig.owner || uiConfig.repo || uiConfig.token) {
      setGithubConfig(uiConfig);
    }
  }, []);

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
      setGitHubConfig(githubConfig);
      localStorage.setItem('github-config', JSON.stringify(githubConfig));
      setShowConfig(false);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        window.location.reload();
      }, 3000);
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Failed to save configuration');
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-white dark:bg-[#22272e] transition-colors duration-500">
      <div className="container mx-auto p-4 max-w-4xl">
        {showSuccess && (
          <div className="fixed top-4 right-4 bg-[#2da44e]/10 dark:bg-[#2da44e]/20 border border-[#2da44e]/20 dark:border-[#2da44e]/30 text-[#1a7f37] dark:text-[#3fb950] px-4 py-2 rounded-lg shadow-sm flex items-center gap-2 animate-fade-in">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5"></path>
            </svg>
            <span className="text-sm font-medium">GitHub connection successful!</span>
          </div>
        )}
        <header className="flex items-center justify-between py-4 mb-8">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-2xl font-bold text-[#24292f] dark:text-[#adbac7] hover:text-[#0969da] dark:hover:text-[#2f81f7] transition-colors"
              onClick={() => {
                setSelectedIssue(null);
                setIsEditing(false);
                setSelectedLabel(null);
                window.location.reload();
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
              className="text-[#57606a] dark:text-[#768390] hover:text-[#24292f] dark:hover:text-[#adbac7] transition-colors"
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
          <Button 
            onClick={handleNewIssue}
            className="bg-[#2da44e] hover:bg-[#2c974b] text-white border-0 shadow-none transition-colors"
          >
            <span className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              New Issue
            </span>
          </Button>
        </header>

        <div 
          className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${
            showConfig ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="bg-white dark:bg-[#2d333b] border border-gray-200 dark:border-[#373e47] rounded-lg shadow-sm p-6 mb-8">
            <form onSubmit={handleConfigSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Owner
                  </label>
                  <input
                    type="text"
                    value={githubConfig.owner}
                    onChange={(e) => setGithubConfig({...githubConfig, owner: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[#444c56] rounded-lg bg-white/50 dark:bg-[#22272e]/50"
                    placeholder="GitHub username or organization"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Repository
                  </label>
                  <input
                    type="text"
                    value={githubConfig.repo}
                    onChange={(e) => setGithubConfig({...githubConfig, repo: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[#444c56] rounded-lg bg-white/50 dark:bg-[#22272e]/50"
                    placeholder="Repository name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Token
                  </label>
                  <input
                    type="password"
                    value={githubConfig.token}
                    onChange={(e) => setGithubConfig({...githubConfig, token: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[#444c56] rounded-lg bg-white/50 dark:bg-[#22272e]/50"
                    placeholder="GitHub personal access token"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowConfig(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  Save Configuration
                </Button>
              </div>
            </form>
          </div>
        </div>

        <main className="mt-8">
          <div className="bg-white dark:bg-[#22272e]">
            {isEditing ? (
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
                />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
