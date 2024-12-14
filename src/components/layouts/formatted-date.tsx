import { useMemo } from 'react';

interface FormattedDateProps {
  date: string | Date;
  className?: string;
}

// 格式化日期，确保服务端和客户端渲染结果一致
function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function FormattedDate({ date, className }: FormattedDateProps) {
  const dateString = useMemo(() => {
    const dateObj = date instanceof Date ? date : new Date(date);
    return formatDate(dateObj);
  }, [date]);

  return (
    <time dateTime={date instanceof Date ? date.toISOString() : date} className={className}>
      {dateString}
    </time>
  );
} 