import { useEffect, useState, useRef } from 'react';
import { getIssues } from '@/lib/github';
import { Issue } from '@/types/github';
import { Button } from './ui/button';
import { ActivityHeatmap } from './activity-heatmap';
import { IssueCard } from './issue-card';
import { FormattedDate } from './formatted-date';

interface TimelineProps {
  searchQuery: string;
  selectedLabel: string | null;
  onLabelClick: (label: string) => void;
  issues: Issue[];
}

// 格式化月份和年份，确保服务端和客户端渲染结果一致
function formatMonthAndYear(month: number, year: number) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return {
    month: months[month],
    year: year.toString()
  };
}

// 获取当前日期的年份和月份
function getCurrentYearMonth() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth()
  };
}

export function Timeline({ searchQuery, selectedLabel, onLabelClick, issues = [] }: TimelineProps) {
  const [localIssues, setLocalIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [{ year, month }, setYearMonth] = useState(() => getCurrentYearMonth());
  const sidebarRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // 当外部 issues 改变时更新本地 issues
  useEffect(() => {
    setLocalIssues(issues);
    setHasMore(issues.length >= 10);
    setCurrentPage(1);
    setLoading(false);
  }, [issues]);

  // 添加日期点击处理函数
  const handleDateClick = (dateKey: string) => {
    if (typeof window === 'undefined') return;
    
    // 使用 requestAnimationFrame 确保在 DOM 更新后执行
    requestAnimationFrame(() => {
      const contentContainer = contentRef.current;
      const dateElement = document.querySelector(`[data-date="${dateKey}"]`);
      
      if (dateElement && contentContainer) {
        const containerRect = contentContainer.getBoundingClientRect();
        const elementRect = dateElement.getBoundingClientRect();
        const relativeTop = elementRect.top - containerRect.top + contentContainer.scrollTop;
        
        contentContainer.scrollTo({
          top: relativeTop - 20,
          behavior: "smooth"
        });
      }
    });
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const result = await getIssues(nextPage, selectedLabel || undefined, false);
      
      // Ensure no duplicate issues by checking issue numbers
      const existingIssueNumbers = new Set(localIssues.map(issue => issue.number));
      const newIssues = (result.issues || []).filter(issue => !existingIssueNumbers.has(issue.number));
      
      if (newIssues.length > 0) {
        setLocalIssues(prev => [...prev, ...newIssues]);
        setHasMore(result.issues.length === 10);
        setCurrentPage(nextPage);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more issues:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleMonthChange = (newYear: number, newMonth: number) => {
    setYearMonth({ year: newYear, month: newMonth });
  };

  // Group issues by month and year, and then by day
  const groupedIssues = localIssues.reduce((groups: Record<string, Record<string, Issue[]>>, issue) => {
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
  const currentMonthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
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
      <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-gray-100 dark:border-[#2d333b] rounded-full"></div>
          <div className="absolute inset-0 border-4 border-t-[#2da44e] dark:border-t-[#2f81f7] rounded-full animate-spin"></div>
        </div>
        <p className="text-sm text-[#57606a] dark:text-[#768390] animate-pulse">Loading timeline...</p>
      </div>
    );
  }

  const monthIssues = groupedIssues[currentMonthKey] || {};
  const hasIssues = Object.keys(monthIssues).length > 0 && filteredIssues.length > 0;

  // Sort days in descending order
  const sortedDays = Object.entries(monthIssues)
    .sort(([dayA], [dayB]) => dayB.localeCompare(dayA));

  return (
    <div className="space-y-8 h-[calc(100vh-150px)] relative">
      {/* Main Layout Container */}
      <div className="flex flex-col sm:flex-row h-full">
        {/* Left Sidebar Container (Calendar + Heatmap) */}
        <div ref={sidebarRef} className="sm:sticky sm:w-[170px] sm:top-0 flex-shrink-0">
          <div className="flex sm:flex sm:flex-col sm:items-center gap-2 sm:gap-0 justify-between">
            {/* Calendar Container */}
            <div className="flex-1 sm:flex-none sm:w-32">
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => handleMonthChange(
                    month === 0 ? year - 1 : year,
                    month === 0 ? 11 : month - 1
                  )}
                  className="text-[#57606a] dark:text-[#768390] hover:text-[#24292f] dark:hover:text-[#adbac7] transition-colors p-1 -ml-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6"/>
                  </svg>
                </button>
                <div className="flex flex-col items-center">
                  <h2 className="text-2xl font-bold text-[#24292f] dark:text-[#adbac7]">
                    {formatMonthAndYear(month, year).month}
                  </h2>
                  <div className="text-sm text-[#57606a] dark:text-[#768390]">
                    {formatMonthAndYear(month, year).year}
                  </div>
                </div>
                <button
                  onClick={() => handleMonthChange(
                    month === 11 ? year + 1 : year,
                    month === 11 ? 0 : month + 1
                  )}
                  className="text-[#57606a] dark:text-[#768390] hover:text-[#24292f] dark:hover:text-[#adbac7] transition-colors p-1 -mr-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>
              </div>
              <div className="text-xs text-[#57606a] dark:text-[#768390] mb-2 text-center">
                Total: {currentMonthIssues.length}
              </div>
            </div>

            {/* Heatmap Container */}
            <div className="flex-1 sm:flex-none sm:mt-1">
              <ActivityHeatmap 
                issues={currentMonthIssues}
                year={year}
                month={month}
                onDateClick={handleDateClick}
              />
            </div>
          </div>
        </div>

        {/* Right Content Container */}
        <div ref={contentRef} className="flex-1 overflow-y-auto pr-2 pb-16">
          {/* Timeline Container */}
          <div className="relative pl-4">
            {/* Timeline Line */}
            <div className="absolute left-[9px] top-0 bottom-0 w-[2px] bg-[#444c56]"></div>

            {/* Issues Container */}
            {hasIssues ? (
              <div className="space-y-6">
                {sortedDays.map(([dayKey, dayIssues]) => {
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

                  // Sort issues within the day by creation time in descending order
                  const sortedIssues = [...filteredDayIssues].sort((a, b) => 
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                  );

                  return (
                    <div key={dayKey} className="relative" data-date={dayKey}>
                      <div className="relative flex items-center h-6">
                        <div className="absolute -left-[12px] w-3 h-3 rounded-full bg-[#2f81f7] ring-4 ring-[#22272e]" />
                        <div className="text-sm text-[#768390] ml-2">
                          <FormattedDate date={dayKey} />
                        </div>
                      </div>
                      <div className="mt-3 ml-4">
                        <div className="space-y-3">
                          {sortedIssues.map((issue) => (
                            <IssueCard
                              key={`${dayKey}-${issue.number}`}
                              issue={issue}
                              selectedLabel={selectedLabel}
                              onLabelClick={onLabelClick}
                              showStatus={false}
                            />
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
                  <div className="relative flex items-center h-6">
                    <div className="absolute -left-[12px] w-3 h-3 rounded-full bg-[#2f81f7] ring-4 ring-[#22272e]" />
                  </div>
                  <div className="mt-3 ml-4">
                    <div className="space-y-3">
                      <div className="group border border-[#d0d7de] dark:border-[#444c56] rounded-lg shadow-card dark:shadow-card-dark hover:shadow-card-hover dark:hover:shadow-card-dark-hover transition-shadow bg-white dark:bg-[#2d333b] px-6 py-16">
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
                                : `No issues for ${formatMonthAndYear(month, year).month} ${formatMonthAndYear(month, year).year}`
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

          {/* Load More Button */}
          {hasMore && localIssues.length >= 10 && currentMonthIssues.length >= 10 && (
            <div className="flex justify-center py-4">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loadingMore}
                className="text-[#768390] border-[#444c56] hover:bg-[#373e47] hover:text-[#adbac7] shadow-card dark:shadow-card-dark"
              >
                {loadingMore ? (
                  <span className="flex items-center gap-2">
                    <div className="relative w-4 h-4">
                      <div className="absolute inset-0 border-2 border-[#444c56] border-t-[#768390] rounded-full animate-spin"></div>
                    </div>
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