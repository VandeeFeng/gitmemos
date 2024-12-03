'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { IssueList } from '@/components/issue-list';
import { useTheme } from "next-themes";
import { setGitHubConfig, getGitHubConfig, getIssues } from '@/lib/github';
import { GitHubConfig, Issue } from '@/types/github';
import { PageLayout } from '@/components/layouts/page-layout';
import { Loading } from '@/components/ui/loading';
import { animations } from '@/lib/animations';
import { componentStates } from '@/lib/component-states';
import { cn } from '@/lib/utils';

export default function Home() {
  const [showConfig, setShowConfig] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const { theme } = useTheme();
  const [githubConfig, setGithubConfig] = useState<GitHubConfig>({
    owner: '',
    repo: '',
    token: '',
    issuesPerPage: 10
  });

  useEffect(() => {
    const config = getGitHubConfig();
    if (config) {
      setGithubConfig(config);
      fetchIssues();
    } else {
      setShowConfig(true);
      setLoading(false);
    }
  }, []);

  const fetchIssues = async () => {
    try {
      const data = await getIssues(1);
      setIssues(data);
    } catch (error) {
      console.error('Error fetching issues:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGitHubConfig(githubConfig);
    setShowConfig(false);
    await fetchIssues();
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  if (loading) {
    return (
      <PageLayout>
        <Loading />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      selectedLabel={selectedLabel}
      onLabelSelect={(label) => setSelectedLabel(label === selectedLabel ? null : label)}
      onSearch={handleSearch}
      showConfig={true}
      onConfigClick={() => setShowConfig(!showConfig)}
      issues={issues}
    >
      <div className={animations.fade.in}>
        {showConfig ? (
          <div className="fixed inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className={cn(
              "rounded-lg shadow-lg max-w-2xl w-full mx-4 animate-content-show",
              theme === 'light' ? "bg-[#f6f8fa]" : "bg-[#2d333b]"
            )}>
              <div className={cn(
                "flex items-center justify-between p-4 border-b",
                theme === 'light' ? "border-[#d0d7de]" : "border-[#444c56]"
              )}>
                <h2 className={theme === 'light' ? "text-lg font-semibold text-[#24292f]" : "text-lg font-semibold text-[#adbac7]"}>
                  GitHub Configuration
                </h2>
                <button
                  onClick={() => setShowConfig(false)}
                  className={cn(
                    theme === 'light' 
                      ? "text-[#57606a] hover:text-[#24292f]" 
                      : "text-[#768390] hover:text-[#adbac7]",
                    componentStates.interactive.base
                  )}
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
                      <label className={cn(
                        "block text-sm font-medium mb-1",
                        theme === 'light' ? "text-[#24292f]" : "text-[#adbac7]"
                      )}>
                        Owner <span className={theme === 'light' ? "text-[#cf222e]" : "text-[#ff7b72]"}>*</span>
                      </label>
                      <input
                        type="text"
                        value={githubConfig.owner}
                        onChange={(e) => setGithubConfig({...githubConfig, owner: e.target.value})}
                        className={cn(
                          "w-full px-3 py-2 border rounded-lg",
                          theme === 'light' 
                            ? "bg-white text-[#24292f] border-[#d0d7de] placeholder-[#6e7781]" 
                            : "bg-[#22272e] text-[#adbac7] border-[#444c56] placeholder-[#545d68]",
                          componentStates.focus.base,
                          "focus:ring-2 focus:ring-[#0969da] dark:focus:ring-[#2f81f7] focus:border-transparent"
                        )}
                        placeholder="GitHub username or organization"
                        required
                      />
                    </div>
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-1",
                        theme === 'light' ? "text-[#24292f]" : "text-[#adbac7]"
                      )}>
                        Repository <span className={theme === 'light' ? "text-[#cf222e]" : "text-[#ff7b72]"}>*</span>
                      </label>
                      <input
                        type="text"
                        value={githubConfig.repo}
                        onChange={(e) => setGithubConfig({...githubConfig, repo: e.target.value})}
                        className={cn(
                          "w-full px-3 py-2 border rounded-lg",
                          theme === 'light' 
                            ? "bg-white text-[#24292f] border-[#d0d7de] placeholder-[#6e7781]" 
                            : "bg-[#22272e] text-[#adbac7] border-[#444c56] placeholder-[#545d68]",
                          componentStates.focus.base,
                          "focus:ring-2 focus:ring-[#0969da] dark:focus:ring-[#2f81f7] focus:border-transparent"
                        )}
                        placeholder="Repository name"
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className={cn(
                        "block text-sm font-medium mb-1",
                        theme === 'light' ? "text-[#24292f]" : "text-[#adbac7]"
                      )}>
                        Token <span className={theme === 'light' ? "text-[#cf222e]" : "text-[#ff7b72]"}>*</span>
                      </label>
                      <input
                        type="password"
                        value={githubConfig.token}
                        onChange={(e) => setGithubConfig({...githubConfig, token: e.target.value})}
                        className={cn(
                          "w-full px-3 py-2 border rounded-lg",
                          theme === 'light' 
                            ? "bg-white text-[#24292f] border-[#d0d7de] placeholder-[#6e7781]" 
                            : "bg-[#22272e] text-[#adbac7] border-[#444c56] placeholder-[#545d68]",
                          componentStates.focus.base,
                          "focus:ring-2 focus:ring-[#0969da] dark:focus:ring-[#2f81f7] focus:border-transparent"
                        )}
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
                      className={cn(
                        theme === 'light'
                          ? "border-[#d0d7de] text-[#24292f] hover:bg-[#f3f4f6] active:bg-[#ebecf0]"
                          : "border-[#444c56] text-[#adbac7] hover:bg-[#373e47] active:bg-[#2d333b]"
                      )}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit"
                      className={cn(
                        theme === 'light'
                          ? "bg-[#2da44e] hover:bg-[#2c974b] active:bg-[#298e46]"
                          : "bg-[#238636] hover:bg-[#2ea043] active:bg-[#238636]",
                        "text-white border-0"
                      )}
                    >
                      Save Configuration
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        ) : (
          <div className={animations.fade.in}>
            <IssueList
              selectedLabel={selectedLabel}
              onLabelClick={(label) => {
                setSelectedLabel(label === selectedLabel ? null : label);
              }}
              searchQuery={searchQuery}
            />
          </div>
        )}
      </div>
    </PageLayout>
  );
}
