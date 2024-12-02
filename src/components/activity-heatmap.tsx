import { useEffect, useState } from 'react';
import { Issue } from '@/types/github';
import { FormattedDate } from './formatted-date';

interface ActivityHeatmapProps {
  issues: Issue[];
  year: number;
  month: number;
  onDateClick?: (date: string) => void;
}

interface DayActivity {
  date: string;
  count: number;
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

export function ActivityHeatmap({ issues, year, month, onDateClick }: ActivityHeatmapProps) {
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
          className={`w-3 h-3 rounded-sm ${bgColor} cursor-pointer transition-all hover:scale-110 hover:brightness-125 group relative`}
          onClick={() => onDateClick?.(dateKey)}
        >
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block">
            <div className="relative bg-[#24292f] dark:bg-[#2d333b] text-white px-2 py-1 rounded text-xs whitespace-nowrap">
              <FormattedDate date={dateKey} className="font-medium" />
              <span className="ml-1 text-[#768390]">
                {count} {count === 1 ? 'issue' : 'issues'}
              </span>
              <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-[#24292f] dark:border-t-[#2d333b]" />
            </div>
          </div>
          <span className="sr-only">
            <FormattedDate date={dateKey} />: {count} issues
          </span>
        </div>
      );
    }

    return days;
  };

  return (
    <div className="w-36">
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