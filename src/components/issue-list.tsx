'use client';

import { useEffect, useState } from 'react';
import { getIssues } from '@/lib/github';
import { Button } from './ui/button';
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import { markdownComponents } from './markdown-components';
import Link from 'next/link';
import { Issue } from '@/types/github';
import { Backlinks } from './backlinks';
import { getLabelStyles, STATUS_COLORS } from '@/lib/colors';
import { useTheme } from 'next-themes';

export function IssueList({ 
  onSelect,
  selectedLabel,
  onLabelClick,
  searchQuery = ''
}: { 
  onSelect: (issue: Issue) => void;
  selectedLabel: string | null;
  onLabelClick: (label: string) => void;
  searchQuery?: string;
}) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIssues, setExpandedIssues] = useState<{[key: number]: boolean}>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    async function fetchIssues() {
      setLoading(true);
      try {
        const data = await getIssues(1, selectedLabel || undefined);
        setIssues(data);
        setHasMore(data.length === 10);
        setCurrentPage(1);
      } catch (error) {
        console.error('Error fetching issues:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchIssues();
  }, [selectedLabel]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const data = await getIssues(nextPage, selectedLabel || undefined);
      setIssues(prev => [...prev, ...data]);
      setCurrentPage(nextPage);
      setHasMore(data.length === 10);
    } catch (error) {
      console.error('Error loading more issues:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleExpand = (e: React.MouseEvent, issueNumber: number) => {
    e.stopPropagation();
    setExpandedIssues(prev => ({
      ...prev,
      [issueNumber]: !prev[issueNumber]
    }));
  };

  const filteredIssues = issues.filter(issue => {
    const matchesLabel = !selectedLabel || issue.labels.some(label => label.name === selectedLabel);
    
    if (!searchQuery) return matchesLabel;

    const searchLower = searchQuery.toLowerCase();
    const titleMatch = issue.title.toLowerCase().includes(searchLower);
    const bodyMatch = (issue.body || '').toLowerCase().includes(searchLower);
    const labelsMatch = issue.labels.some(label => 
      label.name.toLowerCase().includes(searchLower) ||
      (label.description || '').toLowerCase().includes(searchLower)
    );

    return matchesLabel && (titleMatch || bodyMatch || labelsMatch);
  });

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-gray-100 dark:border-[#2d333b] rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-[#2da44e] dark:border-t-[#2f81f7] rounded-full animate-spin"></div>
          </div>
          <p className="text-sm text-[#57606a] dark:text-[#768390] animate-pulse">Loading issues...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-4 border-secondary/50 border-t-secondary rounded-full animate-spin"></div>
        </div>
      ) : filteredIssues.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-text-secondary">
            {searchQuery 
              ? 'No issues found matching your search'
              : selectedLabel
                ? 'No issues found with this label'
                : 'No issues found'
            }
          </div>
        </div>
      ) : (
        <>
          {filteredIssues.map((issue) => (
            <div
              key={issue.number}
              className="group border border-default rounded-lg shadow-card dark:shadow-card-dark hover:shadow-card-hover dark:hover:shadow-card-dark-hover transition-shadow max-w-4xl mx-auto"
            >
              <div className="px-6 py-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1 min-w-0 pr-4">
                    <h3 className="font-semibold text-text-primary truncate">
                      <Link
                        href={`/issue/${issue.number}`}
                        className="hover:text-secondary dark:hover:text-secondary transition-colors"
                      >
                        {issue.title}
                      </Link>
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-text-secondary">
                      <span>#{issue.number}</span>
                      <span>·</span>
                      <span>
                        <time dateTime={issue.created_at} className="whitespace-nowrap">
                          {new Date(issue.created_at).toLocaleDateString()}
                        </time>
                      </span>
                    </div>
                    {issue.labels.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {issue.labels.map((label) => (
                          <span
                            key={label.id}
                            className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full cursor-pointer transition-all ${
                              selectedLabel === label.name 
                                ? 'outline outline-2 outline-offset-1 outline-secondary dark:outline-secondary' 
                                : 'hover:opacity-80'
                            }`}
                            style={getLabelStyles(label.color)}
                            title={label.description || undefined}
                            onClick={(e) => {
                              e.stopPropagation();
                              onLabelClick(label.name);
                            }}
                          >
                            {label.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full"
                      style={issue.state === 'open' 
                        ? STATUS_COLORS.open[theme === 'dark' ? 'dark' : 'light'].style
                        : STATUS_COLORS.closed[theme === 'dark' ? 'dark' : 'light'].style
                      }
                    >
                      <span className="relative flex w-2 h-2 mr-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                          style={issue.state === 'open'
                            ? STATUS_COLORS.open[theme === 'dark' ? 'dark' : 'light'].dotStyle
                            : STATUS_COLORS.closed[theme === 'dark' ? 'dark' : 'light'].dotStyle
                          }
                        ></span>
                        <span className="relative inline-flex rounded-full h-2 w-2"
                          style={issue.state === 'open'
                            ? STATUS_COLORS.open[theme === 'dark' ? 'dark' : 'light'].dotStyle
                            : STATUS_COLORS.closed[theme === 'dark' ? 'dark' : 'light'].dotStyle
                          }
                        ></span>
                      </span>
                      {issue.state}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-text-secondary hover:text-text-primary hover:bg-bg-secondary dark:hover:bg-bg-tertiary -mr-1.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(issue);
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                      <span className="text-xs">Edit</span>
                    </Button>
                  </div>
                </div>
              </div>
              <div className="border-t border-default">
                <div className="px-6 py-3">
                  <div 
                    className="prose dark:prose-invert max-w-none relative"
                    data-color-mode="dark"
                    data-dark-theme="dark_dimmed"
                  >
                    <div className="relative">
                      <div 
                        className={`origin-top overflow-hidden transition-all duration-500 ease-in-out ${
                          !expandedIssues[issue.number] && (issue.body?.length ?? 0) > 300 
                            ? 'max-h-[300px]' 
                            : 'max-h-[10000px]'
                        }`}
                      >
                        <div className="prose dark:prose-invert max-w-none prose-pre:bg-bg-secondary dark:prose-pre:bg-bg-tertiary prose-pre:p-4 prose-pre:rounded-lg prose-pre:my-4 prose-code:text-text-primary dark:prose-code:text-text-primary prose-code:before:content-none prose-code:after:content-none prose-p:leading-relaxed">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeRaw, rehypeSanitize]}
                            components={markdownComponents}
                            className="text-text-primary"
                          >
                            {issue.body || ''}
                          </ReactMarkdown>
                        </div>
                      </div>
                      {!expandedIssues[issue.number] && (issue.body?.length ?? 0) > 300 && (
                        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-bg-primary dark:from-bg-primary to-transparent opacity-100 transition-all duration-500" />
                      )}
                    </div>
                    {(issue.body?.length ?? 0) > 300 && (
                      <button
                        onClick={(e) => toggleExpand(e, issue.number)}
                        className="mt-2 text-xs font-semibold text-[#0969da] dark:text-[#2f81f7] hover:text-[#0969da]/90 dark:hover:text-[#2f81f7]/90 relative z-10"
                      >
                        {expandedIssues[issue.number] ? 'Show less' : 'Show more'}
                      </button>
                    )}
                  </div>

                  <Backlinks currentIssueNumber={issue.number} />
                </div>
              </div>
            </div>
          ))}
          {hasMore && filteredIssues.length >= 10 && (
            <div className="flex justify-center mt-6">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loadingMore}
                className="text-text-secondary border-default hover:bg-bg-secondary dark:hover:bg-bg-tertiary hover:text-text-primary shadow-card dark:shadow-card-dark px-4"
              >
                {loadingMore ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading...
                  </span>
                ) : (
                  'Load more'
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
} 