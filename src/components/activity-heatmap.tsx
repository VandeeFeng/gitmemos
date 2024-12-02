import { useEffect, useState } from 'react';
import { Issue } from '@/types/github';
import { FormattedDate } from './formatted-date';

interface ActivityHeatmapProps {
  issues: Issue[];
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
  onDateClick?: (date: string) => void;
}

interface DayActivity {
  date: string;
  count: number;
}

// 格式化月份名称，确保服务端和客户端渲染结果一致
function formatMonthName(month: number) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[month];
}

// 获取指定月份的天数
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

// 获取指定日期的星期几（0-6）
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

// 格式化日期为 ISO 字符串的日期部分
function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function ActivityHeatmap({ issues, year, month, onMonthChange, onDateClick }: ActivityHeatmapProps) {
  const [activityData, setActivityData] = useState<Record<string, DayActivity>>({});
  const [maxCount, setMaxCount] = useState(0);
  
  useEffect(() => {
    // Process issues to create activity data
    const data: Record<string, DayActivity> = {};
    let max = 0;

    issues.forEach(issue => {
      const date = new Date(issue.created_at);
      const dateKey = date.toISOString().split('T')[0];
      
      if (!data[dateKey]) {
        data[dateKey] = { date: dateKey, count: 0 };
      }
      data[dateKey].count += 1;
      max = Math.max(max, data[dateKey].count);
    });

    setActivityData(data);
    setMaxCount(max);
  }, [issues]);

  const handlePrevMonth = () => {
    let newYear = year;
    let newMonth = month - 1;
    
    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    }
    
    onMonthChange(newYear, newMonth);
  };

  const handleNextMonth = () => {
    let newYear = year;
    let newMonth = month + 1;
    
    if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }
    
    onMonthChange(newYear, newMonth);
  };

  const generateMonthGrid = () => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="w-3 h-3" />);
    }
    
    // Add cells for each day
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = formatDateKey(year, month, day);
      const activity = activityData[dateKey];
      const count = activity?.count || 0;
      
      // Calculate color intensity based on activity count
      let bgColor = 'bg-[#ebedf0] dark:bg-[#2d333b]';
      if (count > 0) {
        const intensity = Math.ceil((count / maxCount) * 4);
        bgColor = `bg-[#0969da] dark:bg-[#2f81f7] opacity-${Math.min(intensity * 25, 100)}`;
      }
      
      days.push(
        <div
          key={dateKey}
          className={`w-3 h-3 rounded-sm ${bgColor} cursor-pointer transition-all hover:scale-110 hover:brightness-125`}
          title={`${dateKey}: ${count} issues`}
          onClick={() => onDateClick?.(dateKey)}
        />
      );
    }

    return days;
  };

  return (
    <div className="w-36">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={handlePrevMonth}
          className="text-[#57606a] dark:text-[#768390] hover:text-[#24292f] dark:hover:text-[#adbac7] transition-colors p-1 -ml-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <div className="flex flex-col items-center">
          <h2 className="text-3xl font-bold text-[#24292f] dark:text-[#adbac7]">
            {formatMonthName(month)}
          </h2>
          <div className="text-sm text-[#57606a] dark:text-[#768390]">
            {year}
          </div>
        </div>
        <button
          onClick={handleNextMonth}
          className="text-[#57606a] dark:text-[#768390] hover:text-[#24292f] dark:hover:text-[#adbac7] transition-colors p-1 -mr-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>
      <div className="text-xs text-[#57606a] dark:text-[#768390] mb-2 text-center">
        Total: {issues.length}
      </div>
      <div className="grid grid-cols-7 gap-[3px]">
        {generateMonthGrid()}
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-[#57606a] dark:text-[#768390]">
        <span>Less</span>
        <div className="flex gap-[3px]">
          <div className="w-2.5 h-2.5 rounded-sm bg-[#ebedf0] dark:bg-[#2d333b]" />
          <div className="w-2.5 h-2.5 rounded-sm bg-[#0969da] dark:bg-[#2f81f7] opacity-25" />
          <div className="w-2.5 h-2.5 rounded-sm bg-[#0969da] dark:bg-[#2f81f7] opacity-50" />
          <div className="w-2.5 h-2.5 rounded-sm bg-[#0969da] dark:bg-[#2f81f7] opacity-75" />
          <div className="w-2.5 h-2.5 rounded-sm bg-[#0969da] dark:bg-[#2f81f7]" />
        </div>
        <span>More</span>
      </div>
    </div>
  );
} 