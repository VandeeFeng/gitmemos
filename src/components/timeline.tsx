import { useEffect, useState } from 'react';
import { getIssues } from '@/lib/github';
import { Issue } from '@/types/github';
import Link from 'next/link';
import { Button } from './ui/button';
import { ActivityHeatmap } from './activity-heatmap';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { markdownComponents } from './markdown-components';
import { Backlinks } from './backlinks';

interface TimelineProps {
  searchQuery: string;
  selectedLabel: string | null;
}

export function Timeline({ searchQuery, selectedLabel }: TimelineProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIssues, setExpandedIssues] = useState<{[key: number]: boolean}>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());

  useEffect(() => {
    const fetchIssues = async (page: number) => {
      try {
        const fetchedIssues = await getIssues(page, selectedLabel || undefined);
        // Sort issues by creation date in descending order
        const sortedIssues = fetchedIssues.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        
        if (page === 1) {
          setIssues(sortedIssues);
        } else {
          setIssues(prev => [...prev, ...sortedIssues]);
        }
        
        setHasMore(fetchedIssues.length === 10);
        setCurrentPage(page);
      } catch (error) {
        console.error('Error fetching issues:', error);
      }
    };

    const initialFetch = async () => {
      setLoading(true);
      await fetchIssues(1);
      setLoading(false);
    };
    initialFetch();
  }, [selectedLabel]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const fetchedIssues = await getIssues(nextPage, selectedLabel || undefined);
      const sortedIssues = fetchedIssues.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setIssues(prev => [...prev, ...sortedIssues]);
      setCurrentPage(nextPage);
      setHasMore(fetchedIssues.length === 10);
    } catch (error) {
      console.error('Error loading more issues:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleMonthChange = (year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
  };

  const toggleExpand = (e: React.MouseEvent, issueNumber: number) => {
    e.stopPropagation();
    setExpandedIssues(prev => ({
      ...prev,
      [issueNumber]: !prev[issueNumber]
    }));
  };

  // Group issues by month and year, and then by day
  const groupedIssues = issues.reduce((groups: Record<string, Record<string, Issue[]>>, issue) => {
    const date = new Date(issue.created_at);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const dayKey = date.toISOString().split('T')[0];
    
    if (!groups[monthKey]) {
      groups[monthKey] = {};
    }
    if (!groups[monthKey][dayKey]) {
      groups[monthKey][dayKey] = [];
    }
    groups[monthKey][dayKey].push(issue);
    return groups;
  }, {});

  // Get current month's issues
  const currentMonthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
  const currentMonthIssues = Object.values(groupedIssues[currentMonthKey] || {}).flat();

  // Filter issues by search query
  const filteredIssues = currentMonthIssues.filter(issue => {
    if (!searchQuery) return true;

    const searchLower = searchQuery.toLowerCase();
    const titleMatch = issue.title.toLowerCase().includes(searchLower);
    const bodyMatch = (issue.body || '').toLowerCase().includes(searchLower);
    const labelsMatch = issue.labels.some(label => 
      label.name.toLowerCase().includes(searchLower) ||
      (label.description || '').toLowerCase().includes(searchLower)
    );

    return titleMatch || bodyMatch || labelsMatch;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#22272e] transition-colors duration-500">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex justify-center items-center min-h-[200px]">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-[#f6f8fa] dark:border-[#2d333b] rounded-full"></div>
              <div className="absolute inset-0 border-4 border-t-[#2da44e] dark:border-t-[#2f81f7] rounded-full animate-spin"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#22272e] transition-colors duration-500">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="space-y-8 py-6">
          <div className="animate-fade-in">
            <div className="flex gap-6">
              <div className="pt-1">
                <ActivityHeatmap 
                  issues={currentMonthIssues}
                  year={selectedYear}
                  month={selectedMonth}
                  onMonthChange={handleMonthChange}
                />
              </div>
              <div className="flex-1 relative">
                <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#444c56] -ml-3"></div>
                {filteredIssues.length > 0 ? (
                  <div className="space-y-6">
                    {Object.entries(groupedIssues[currentMonthKey] || {}).map(([dayKey, dayIssues]) => {
                      const filteredDayIssues = dayIssues.filter(issue => {
                        if (!searchQuery) return true;

                        const searchLower = searchQuery.toLowerCase();
                        const titleMatch = issue.title.toLowerCase().includes(searchLower);
                        const bodyMatch = (issue.body || '').toLowerCase().includes(searchLower);
                        const labelsMatch = issue.labels.some(label => 
                          label.name.toLowerCase().includes(searchLower) ||
                          (label.description || '').toLowerCase().includes(searchLower)
                        );

                        return titleMatch || bodyMatch || labelsMatch;
                      });

                      if (filteredDayIssues.length === 0) return null;

                      return (
                        <div key={dayKey} className="relative">
                          <div className="absolute -left-[17px] top-[14px] w-3 h-3 rounded-full bg-[#2f81f7] ring-4 ring-[#22272e]" />
                          <div className="pl-6">
                            <div className="space-y-3">
                              {filteredDayIssues.map((issue) => (
                                <div 
                                  key={issue.number}
                                  className="group border border-[#444c56] rounded-lg shadow-card dark:shadow-card-dark hover:shadow-card-hover dark:hover:shadow-card-dark-hover transition-shadow bg-[#2d333b]"
                                >
                                  <div className="px-6 py-4">
                                    <div className="flex items-start justify-between">
                                      <div className="space-y-1 flex-1 min-w-0 pr-4">
                                        <h3 className="font-semibold text-[#adbac7]">
                                          <Link
                                            href={`/issue/${issue.number}`}
                                            className="hover:text-[#2f81f7] transition-colors"
                                          >
                                            {issue.title}
                                          </Link>
                                        </h3>
                                        <div className="flex items-center gap-2 text-xs text-[#768390]">
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
                                            {issue.labels.map(label => (
                                              <span
                                                key={label.id}
                                                className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                                                  selectedLabel === label.name 
                                                    ? 'outline outline-2 outline-offset-1 outline-[#2f81f7] dark:outline-[#2f81f7]' 
                                                    : ''
                                                }`}
                                                style={{
                                                  backgroundColor: `#${label.color}20`,
                                                  color: `#${label.color}`,
                                                  border: `1px solid #${label.color}40`
                                                }}
                                              >
                                                {label.name}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[#768390] hover:text-[#adbac7] hover:bg-[#373e47] -mr-1.5 shrink-0"
                                        asChild
                                      >
                                        <Link href={`/issue/${issue.number}`}>
                                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                          </svg>
                                          <span className="text-xs">Edit</span>
                                        </Link>
                                      </Button>
                                    </div>
                                  </div>
                                  {issue.body && (
                                    <div className="border-t border-[#444c56]">
                                      <div className="px-6 py-3">
                                        <div className="prose dark:prose-invert max-w-none relative">
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
                                                  {issue.body}
                                                </ReactMarkdown>
                                              </div>
                                            </div>
                                            {!expandedIssues[issue.number] && (issue.body?.length ?? 0) > 300 && (
                                              <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#2d333b] to-transparent opacity-100 transition-all duration-500" />
                                            )}
                                          </div>
                                          {(issue.body?.length ?? 0) > 300 && (
                                            <button
                                              onClick={(e) => toggleExpand(e, issue.number)}
                                              className="mt-2 text-xs font-semibold text-[#2f81f7] hover:text-[#2f81f7]/90 relative z-10"
                                            >
                                              {expandedIssues[issue.number] ? 'Show less' : 'Show more'}
                                            </button>
                                          )}
                                        </div>
                                        <Backlinks currentIssueNumber={issue.number} />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="relative">
                      <div className="absolute -left-[17px] top-[14px] w-3 h-3 rounded-full bg-[#2f81f7] ring-4 ring-[#22272e]" />
                      <div className="pl-6">
                        <div className="space-y-3">
                          <div className="border border-[#444c56] rounded-lg shadow-card dark:shadow-card-dark bg-[#2d333b] px-6 py-16">
                            <div className="flex flex-col items-center justify-center text-center">
                              <svg className="w-12 h-12 text-[#768390] mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                              <h3 className="text-lg font-semibold text-[#adbac7] mb-2">No issues found</h3>
                              <p className="text-[#768390]">
                                {searchQuery 
                                  ? 'No issues found matching your search'
                                  : selectedLabel
                                    ? 'No issues found with this label'
                                    : `No issues for ${new Date(selectedYear, selectedMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}`
                                }
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {hasMore && filteredIssues.length >= 10 && (
            <div className="flex justify-center mt-6">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loadingMore}
                className="text-[#768390] border-[#444c56] hover:bg-[#373e47] hover:text-[#adbac7] shadow-card dark:shadow-card-dark"
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
        </div>
      </div>
    </div>
  );
} 