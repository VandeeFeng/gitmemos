'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { IssueList } from '@/components/issue-list';
import { useTheme } from "next-themes";
import { setGitHubConfig, getGitHubConfig, getIssues, getLabels } from '@/lib/github';
import { GitHubConfig, Issue } from '@/types/github';
import { PageLayout } from '@/components/layouts/page-layout';
import { Loading } from '@/components/ui/loading';
import { animations } from '@/lib/animations';
import { componentStates } from '@/lib/component-states';
import { cn } from '@/lib/utils';
import { testConnection } from '@/lib/db';
import { SyncButton } from '@/components/sync-button';

// 提示组件
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  const { theme } = useTheme();

  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={cn(
      "fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg transition-all duration-300 transform translate-y-0",
      theme === 'light' 
        ? "bg-[#2da44e] text-white" 
        : "bg-[#238636] text-white",
      animations.fade.in
    )}>
      {message}
    </div>
  );
}

export default function Home() {
  const [showConfig, setShowConfig] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [allIssues, setAllIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const { theme } = useTheme();
  const [githubConfig, setGithubConfig] = useState<GitHubConfig>({
    owner: '',
    repo: '',
    token: '',
    issuesPerPage: 10
  });

  const showToast = (message: string) => {
    setToast(message);
  };

  // 获取所有 issues
  const fetchAllIssues = async (forceSync: boolean = false) => {
    if (!forceSync && allIssues.length > 0) {
      return;
    }
    
    setLoading(true);
    try {
      const result = await getIssues(1, undefined, forceSync);
      setAllIssues(result.issues);
      
      if (result.syncStatus?.success) {
        showToast(`Successfully synced ${result.syncStatus.totalSynced} issues`);
      }
    } catch (error) {
      console.error('Error fetching issues:', error);
      showToast('Failed to fetch issues');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async (page: number) => {
    try {
      const result = await getIssues(page, selectedLabel || undefined, false);
      
      // Ensure no duplicate issues by checking issue numbers
      const existingIssueNumbers = new Set(allIssues.map(issue => issue.number));
      const newIssues = result.issues.filter(issue => !existingIssueNumbers.has(issue.number));
      
      if (newIssues.length > 0) {
        setAllIssues(prev => [...prev, ...newIssues]);
      }
      
      return result.issues.length === 10;
    } catch (error) {
      console.error('Error loading more issues:', error);
      return false;
    }
  };

  const handleSync = async () => {
    await fetchAllIssues(true);
  };

  useEffect(() => {
    const init = async () => {
      if (initialized) {
        return;
      }

      try {
        const config = await getGitHubConfig(false);
        setGithubConfig(config);
        
        if (config.token && config.owner && config.repo) {
          // 检查是否有缓存数据
          const result = await getIssues(1, undefined, false);
          if (result.issues.length === 0) {
            // 如果没有缓存数据，则强制同步
            await fetchAllIssues(true);
          } else {
            // 如果有缓存数据，直接使用
            setAllIssues(result.issues);
            setLoading(false);
          }
        } else {
          setShowConfig(true);
          setLoading(false);
        }
        setInitialized(true);
      } catch (error) {
        console.error('Error initializing:', error);
        setLoading(false);
      }
    };
    init();
  }, [initialized, fetchAllIssues]);

  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await setGitHubConfig(githubConfig);
    setShowConfig(false);
    await fetchAllIssues(true);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const filteredIssues = allIssues.filter(issue => {
    if (selectedLabel && !issue.labels.some(label => label.name === selectedLabel)) {
      return false;
    }
    
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const titleMatch = issue.title.toLowerCase().includes(searchLower);
      const bodyMatch = (issue.body || '').toLowerCase().includes(searchLower);
      const labelsMatch = issue.labels.some(label => 
        label.name.toLowerCase().includes(searchLower) ||
        (label.description || '').toLowerCase().includes(searchLower)
      );
      return titleMatch || bodyMatch || labelsMatch;
    }
    
    return true;
  });

  return (
    <PageLayout
      selectedLabel={selectedLabel}
      onLabelSelect={(label) => setSelectedLabel(label === selectedLabel ? null : label)}
      onSearch={handleSearch}
      showConfig={true}
      onConfigClick={() => setShowConfig(!showConfig)}
      issues={filteredIssues}
      onSync={handleSync}
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
        ) : loading ? (
          <Loading />
        ) : (
          <IssueList 
            issues={filteredIssues}
            selectedLabel={selectedLabel}
            onLabelClick={(label) => setSelectedLabel(label === selectedLabel ? null : label)}
            searchQuery={searchQuery}
            onLoadMore={handleLoadMore}
          />
        )}
      </div>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </PageLayout>
  );
}
