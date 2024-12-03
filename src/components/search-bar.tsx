'use client';
import { useState, ChangeEvent, useEffect, useRef } from 'react';
import { Input } from "./ui/input";
import { Issue } from '@/types/github';

interface SearchBarProps {
  onSearch: (query: string) => void;
  issues?: Issue[];
}

// 辅助函数：分词（支持中文和英文）
const tokenize = (text: string): string[] => {
  // 将文本按照中文字符、英文单词、数字分开
  const tokens = text.match(/[\u4e00-\u9fa5]+|[a-zA-Z]+|[0-9]+/g) || [];
  return tokens;
};

// 辅助函数：计算两个字符串的相似度（Levenshtein 距离）
const similarity = (s1: string, s2: string): number => {
  if (s1.length < s2.length) [s1, s2] = [s2, s1];
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) costs[j] = j;
      else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1))
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return 1 - costs[s2.length] / Math.max(s1.length, s2.length);
};

// 辅助函数：智能截断文本（在句子边界处截断）
const smartTruncate = (text: string, targetLength: number, position: number): { text: string, start: number, end: number } => {
  const sentenceEndings = [...text.matchAll(/[.!?。！？\n]+/g)];
  if (sentenceEndings.length === 0) {
    const start = Math.max(0, position - targetLength / 2);
    const end = Math.min(text.length, position + targetLength / 2);
    return { 
      text: text.slice(start, end), 
      start, 
      end 
    };
  }

  let bestStart = 0;
  let bestEnd = text.length;
  let minDistance = Number.MAX_VALUE;

  for (let i = 0; i < sentenceEndings.length; i++) {
    const sentenceEnd = sentenceEndings[i].index! + sentenceEndings[i][0].length;
    if (Math.abs(sentenceEnd - position) < minDistance && sentenceEnd < position) {
      bestStart = sentenceEnd;
      minDistance = Math.abs(sentenceEnd - position);
    }
  }

  minDistance = Number.MAX_VALUE;
  for (let i = 0; i < sentenceEndings.length; i++) {
    const sentenceEnd = sentenceEndings[i].index! + sentenceEndings[i][0].length;
    if (Math.abs(sentenceEnd - position) < minDistance && sentenceEnd > position) {
      bestEnd = sentenceEnd;
      minDistance = Math.abs(sentenceEnd - position);
    }
  }

  // 如果截取的内容太长，进一步缩小范围
  if (bestEnd - bestStart > targetLength * 1.5) {
    const mid = position;
    bestStart = Math.max(bestStart, mid - targetLength / 2);
    bestEnd = Math.min(bestEnd, mid + targetLength / 2);
  }

  return { 
    text: text.slice(bestStart, bestEnd), 
    start: bestStart, 
    end: bestEnd 
  };
};

export function SearchBar({ onSearch, issues = [] }: SearchBarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (previewRef.current && !previewRef.current.contains(event.target as Node)) {
        setShowPreview(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
    setShowPreview(false);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setShowPreview(true);
  };

  // Ensure issues is always an array and deduplicate by issue number
  const safeIssues = Array.isArray(issues) ? issues : [];
  const uniqueIssues = Array.from(
    new Map(safeIssues.filter(issue => issue && issue.number).map(issue => [issue.number, issue])).values()
  );

  const filteredIssues = searchQuery ? uniqueIssues.filter(issue => {
    if (!issue || !issue.title) return false;
    
    const searchTerms = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    const title = issue.title.toLowerCase();
    const body = (issue.body || '').toLowerCase();
    const labelNames = (issue.labels || []).map(label => label.name.toLowerCase());
    const labelDescriptions = (issue.labels || []).map(label => (label.description || '').toLowerCase());

    return searchTerms.some(term => 
      title.includes(term) || 
      body.includes(term) || 
      labelNames.some(name => name.includes(term)) ||
      labelDescriptions.some(desc => desc.includes(term))
    );
  }).slice(0, 5) : [];

  const highlightText = (text: string, query: string) => {
    if (!query || !text) return text;

    // 预处理文本：保留原始换行，但清理多余的空格
    const cleanText = text.replace(/[^\S\n]+/g, ' ').trim();
    
    // 对查询词和文本进行分词
    const queryTokens = tokenize(query.toLowerCase());
    const textTokens = tokenize(cleanText.toLowerCase());
    
    // 找到所有匹配位置（包括模糊匹配）
    const matches: Array<{ start: number, end: number, similarity: number }> = [];
    let currentPos = 0;

    textTokens.forEach(token => {
      const tokenStart = cleanText.toLowerCase().indexOf(token, currentPos);
      if (tokenStart === -1) return;

      queryTokens.forEach(queryToken => {
        const sim = similarity(token, queryToken);
        if (sim > 0.8) { // 相似度阈值
          matches.push({
            start: tokenStart,
            end: tokenStart + token.length,
            similarity: sim
          });
        }
      });

      currentPos = tokenStart + token.length;
    });

    // 按开始位置排序并合并重叠区域
    matches.sort((a, b) => a.start - b.start);
    const mergedMatches = matches.reduce((acc, match) => {
      if (acc.length === 0) return [match];
      const last = acc[acc.length - 1];
      if (match.start <= last.end + 1) { // +1 允许相邻字符的合并
        last.end = Math.max(last.end, match.end);
        last.similarity = Math.max(last.similarity, match.similarity);
        return acc;
      }
      return [...acc, match];
    }, [] as typeof matches);

    // 构建结果数组
    const result: (string | JSX.Element)[] = [];
    let lastEnd = 0;

    mergedMatches.forEach((match, index) => {
      // 添加未匹配的文本
      if (match.start > lastEnd) {
        result.push(cleanText.slice(lastEnd, match.start));
      }
      // 添加高亮的文本，根据相似度调整样式
      const opacity = Math.min(1, match.similarity);
      result.push(
        <span 
          key={index} 
          className="bg-[#2da44e]/20 dark:bg-[#2f81f7]/20 text-[#2da44e] dark:text-[#2f81f7] rounded px-0.5"
          style={{ opacity }}
        >
          {cleanText.slice(match.start, match.end)}
        </span>
      );
      lastEnd = match.end;
    });

    // 添加剩余的文本
    if (lastEnd < cleanText.length) {
      result.push(cleanText.slice(lastEnd));
    }

    return result;
  };

  const getPreviewContent = (content: string, query: string) => {
    if (!content || !query) return content?.slice(0, 150) + '...';
    
    // 预处理文本：清理多余的空格，但保留基本格式
    const cleanContent = content.replace(/\s+/g, ' ').trim();
    
    // 对查询词和文本进行分词
    const queryTokens = tokenize(query.toLowerCase());
    const contentLower = cleanContent.toLowerCase();
    
    // 找到所有匹配位置（包括模糊匹配）
    const matches: Array<{ start: number, end: number, score: number }> = [];
    
    queryTokens.forEach(queryToken => {
      let pos = 0;
      while (pos < contentLower.length) {
        const nextToken = tokenize(contentLower.slice(pos))[0];
        if (!nextToken) break;
        
        const tokenPos = contentLower.indexOf(nextToken, pos);
        if (tokenPos === -1) break;
        
        const sim = similarity(nextToken, queryToken);
        if (sim > 0.8) {
          matches.push({
            start: tokenPos,
            end: tokenPos + nextToken.length,
            score: sim
          });
        }
        pos = tokenPos + nextToken.length;
      }
    });

    if (matches.length === 0) {
      const truncated = smartTruncate(cleanContent, 300, 0);
      return truncated.text + (truncated.end < cleanContent.length ? '...' : '');
    }

    // 找到得分最高的匹配区域
    let bestMatch = matches[0];
    matches.forEach(match => {
      if (match.score > bestMatch.score) {
        bestMatch = match;
      }
    });

    // 智能截取包含最佳匹配的文本片段
    const truncated = smartTruncate(cleanContent, 300, bestMatch.start);
    return (truncated.start > 0 ? '...' : '') + 
           truncated.text + 
           (truncated.end < cleanContent.length ? '...' : '');
  };

  return (
    <div className="relative w-64" ref={previewRef}>
      <form onSubmit={handleSearch} className="relative">
        <Input
          type="text"
          value={searchQuery}
          onChange={handleChange}
          onFocus={() => setShowPreview(true)}
          placeholder="Search issues..."
          className="pl-10"
        />
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg
            className="h-4 w-4 text-muted-foreground"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
      </form>

      {showPreview && searchQuery && (
        <div 
          className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#2d333b] rounded-lg shadow-lg border border-[#d0d7de] dark:border-[#444c56] overflow-hidden z-50"
        >
          {filteredIssues.length > 0 ? (
            <div className="max-h-[400px] overflow-y-auto">
              {filteredIssues.map((issue) => (
                <div
                  key={issue.number}
                  className="block p-3 hover:bg-[#f6f8fa] dark:hover:bg-[#323942] border-b border-[#d0d7de] dark:border-[#444c56] last:border-0 cursor-pointer transition-colors"
                  onClick={() => {
                    setSearchQuery(issue.title);
                    onSearch(issue.title);
                    setShowPreview(false);
                  }}
                >
                  <div className="flex items-center gap-2 text-sm mb-1.5">
                    <span className="text-[#57606a] dark:text-[#768390]">#{issue.number}</span>
                    <h4 className="font-medium text-[#24292f] dark:text-[#adbac7]">
                      {highlightText(issue.title, searchQuery)}
                    </h4>
                  </div>
                  {issue.body && (
                    <p className="text-sm text-[#57606a] dark:text-[#768390] line-clamp-2 mb-1.5">
                      {highlightText(getPreviewContent(issue.body, searchQuery), searchQuery)}
                    </p>
                  )}
                  {issue.labels && issue.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {issue.labels.map(label => (
                        <span
                          key={label.id}
                          className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full"
                          style={{
                            backgroundColor: `#${label.color}20`,
                            color: `#${label.color}`,
                            border: `1px solid #${label.color}40`
                          }}
                        >
                          {highlightText(label.name, searchQuery)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-sm text-[#57606a] dark:text-[#768390] text-center">
              No matching issues found
            </div>
          )}
          <div className="p-2 bg-[#f6f8fa] dark:bg-[#323942] border-t border-[#d0d7de] dark:border-[#444c56] text-xs text-[#57606a] dark:text-[#768390] text-center">
            Press Enter to search
          </div>
        </div>
      )}
    </div>
  );
} 