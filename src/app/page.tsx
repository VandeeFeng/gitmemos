'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { IssueList } from '@/components/issue-list';
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
            <div className="bg-[#f6f8fa] dark:bg-[#2d333b] rounded-lg shadow-lg max-w-2xl w-full mx-4 animate-content-show">
              <div className="flex items-center justify-between p-4 border-b border-[#d0d7de] dark:border-[#444c56]">
                <h2 className="text-lg font-semibold text-[#24292f] dark:text-[#adbac7]">GitHub Configuration</h2>
                <button
                  onClick={() => setShowConfig(false)}
                  className={cn(
                    "text-[#57606a] dark:text-[#768390] hover:text-[#24292f] dark:hover:text-[#adbac7]",
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
                      <label className="block text-sm font-medium text-[#24292f] dark:text-[#adbac7] mb-1">
                        Owner <span className="text-[#cf222e] dark:text-[#ff7b72]">*</span>
                      </label>
                      <input
                        type="text"
                        value={githubConfig.owner}
                        onChange={(e) => setGithubConfig({...githubConfig, owner: e.target.value})}
                        className={cn(
                          "w-full px-3 py-2 border rounded-lg",
                          "bg-white dark:bg-[#22272e] text-[#24292f] dark:text-[#adbac7]",
                          "border-[#d0d7de] dark:border-[#444c56]",
                          "placeholder-[#6e7781] dark:placeholder-[#545d68]",
                          componentStates.focus.base,
                          "focus:ring-2 focus:ring-[#0969da] dark:focus:ring-[#2f81f7] focus:border-transparent"
                        )}
                        placeholder="GitHub username or organization"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#24292f] dark:text-[#adbac7] mb-1">
                        Repository <span className="text-[#cf222e] dark:text-[#ff7b72]">*</span>
                      </label>
                      <input
                        type="text"
                        value={githubConfig.repo}
                        onChange={(e) => setGithubConfig({...githubConfig, repo: e.target.value})}
                        className={cn(
                          "w-full px-3 py-2 border rounded-lg",
                          "bg-white dark:bg-[#22272e] text-[#24292f] dark:text-[#adbac7]",
                          "border-[#d0d7de] dark:border-[#444c56]",
                          "placeholder-[#6e7781] dark:placeholder-[#545d68]",
                          componentStates.focus.base,
                          "focus:ring-2 focus:ring-[#0969da] dark:focus:ring-[#2f81f7] focus:border-transparent"
                        )}
                        placeholder="Repository name"
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-[#24292f] dark:text-[#adbac7] mb-1">
                        Token <span className="text-[#cf222e] dark:text-[#ff7b72]">*</span>
                      </label>
                      <input
                        type="password"
                        value={githubConfig.token}
                        onChange={(e) => setGithubConfig({...githubConfig, token: e.target.value})}
                        className={cn(
                          "w-full px-3 py-2 border rounded-lg",
                          "bg-white dark:bg-[#22272e] text-[#24292f] dark:text-[#adbac7]",
                          "border-[#d0d7de] dark:border-[#444c56]",
                          "placeholder-[#6e7781] dark:placeholder-[#545d68]",
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
                        "border-[#d0d7de] dark:border-[#444c56]",
                        "text-[#24292f] dark:text-[#adbac7]",
                        "hover:bg-[#f3f4f6] dark:hover:bg-[#373e47]",
                        "active:bg-[#ebecf0] dark:active:bg-[#2d333b]"
                      )}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit"
                      className={cn(
                        "bg-[#2da44e] hover:bg-[#2c974b] active:bg-[#298e46]",
                        "dark:bg-[#238636] dark:hover:bg-[#2ea043] dark:active:bg-[#238636]",
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
