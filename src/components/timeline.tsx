import { useEffect, useState } from 'react';
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

export function Timeline({ searchQuery, selectedLabel, onLabelClick }: TimelineProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [{ year, month }, setYearMonth] = useState(() => getCurrentYearMonth());

  // 添加日期点击处理函数
  const handleDateClick = (dateKey: string) => {
    // 找到对应日期的元素
    const dateElement = document.querySelector(`[data-date="${dateKey}"]`);
    if (dateElement) {
      // 增加偏移量到 120px，考虑顶栏高度和额外间距
      const headerOffset = 120;
      // 获取元素的位置
      const elementPosition = dateElement.getBoundingClientRect().top;
      // 获取当前滚动位置
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      
      // 平滑滚动到该元素
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

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

  const handleMonthChange = (newYear: number, newMonth: number) => {
    setYearMonth({ year: newYear, month: newMonth });
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
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-[#f6f8fa] dark:border-[#2d333b] rounded-full"></div>
          <div className="absolute inset-0 border-4 border-t-[#2da44e] dark:border-t-[#2f81f7] rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  const monthIssues = groupedIssues[currentMonthKey] || {};
  const hasIssues = Object.keys(monthIssues).length > 0 && filteredIssues.length > 0;

  return (
    <div className="space-y-8 h-[calc(100vh-150px)] relative">
      {/* Main Layout Container */}
      <div className="flex flex-col sm:flex-row gap-6 sm:gap-0 h-full">
        {/* Left Sidebar Container (Calendar + Heatmap) */}
        <div className="sm:sticky sm:w-[180px] sm:top-0 sm:pr-2 flex-shrink-0">
          <div className="flex sm:flex sm:flex-col sm:items-center gap-4 sm:gap-0 justify-between">
            {/* Calendar Container */}
            <div className="flex-1 sm:flex-none sm:w-36">
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
        <div className="flex-1 sm:ml-[10px] overflow-y-auto pr-4 pb-16">
          {/* Timeline Container */}
          <div className="relative pl-6">
            {/* Timeline Line */}
            <div className="absolute left-[11px] top-0 bottom-0 w-[2px] bg-[#444c56]"></div>

            {/* Issues Container */}
            {hasIssues ? (
              <div className="space-y-6">
                {Object.entries(monthIssues).map(([dayKey, dayIssues]) => {
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
                    <div key={dayKey} className="relative" data-date={dayKey}>
                      <div className="relative flex items-center h-6">
                        <div className="absolute -left-[18px] w-3 h-3 rounded-full bg-[#2f81f7] ring-4 ring-[#22272e]" />
                        <div className="text-sm text-[#768390]">
                          <FormattedDate date={dayKey} />
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="space-y-3">
                          {filteredDayIssues.map((issue) => (
                            <IssueCard
                              key={issue.number}
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
                  <div className="absolute -left-[18px] top-[14px] w-3 h-3 rounded-full bg-[#2f81f7] ring-4 ring-[#22272e]" />
                  <div className="pl-6">
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
          {hasMore && filteredIssues.length >= 10 && (
            <div className="flex justify-center py-4">
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