'use client';

import { usePathname, useRouter } from 'next/navigation';
import { SearchBar } from './search-bar';
import { Issue } from '@/types/github';
import { useLabels } from '@/lib/contexts/label-context';
import { 
  Button,
  SyncButton,
  ThemeButton,
  TimelineButton,
  ConfigButton,
  LogoButton,
  LabelFilterButton
} from './ui/button';

interface HeaderProps {
  onSearch?: (query: string) => void;
  issues?: Issue[];
  selectedLabel?: string | null;
  onLabelSelect?: (label: string) => void;
  showSearchAndNew?: boolean;
  showConfig?: boolean;
  onConfigClick?: () => void;
  onSync?: () => Promise<void>;
}

export function Header({
  onSearch,
  issues = [],
  selectedLabel,
  onLabelSelect,
  showSearchAndNew = true,
  showConfig = false,
  onConfigClick,
  onSync
}: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { labels, loading: labelsLoading } = useLabels();

  // Ensure issues is always an array
  const safeIssues = Array.isArray(issues) ? issues : [];

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  return (
    <header className="fixed top-0 left-0 right-0 bg-white/80 dark:bg-[#22272e]/80 backdrop-blur-sm z-40">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between py-4 md:py-8">
          <div className="flex items-center">
            <LogoButton onClick={() => handleNavigation('/')} className="mr-3" />
            <div className="flex items-center gap-1">
              {onLabelSelect && (
                <LabelFilterButton
                  selectedLabel={selectedLabel || null}
                  onLabelSelect={onLabelSelect}
                  labels={labels}
                  loading={labelsLoading}
                />
              )}
              <TimelineButton 
                onClick={() => handleNavigation(pathname === '/timeline' ? '/' : '/timeline')} 
              />
              {onSync && <SyncButton onSync={onSync} />}
              {showConfig && onConfigClick && <ConfigButton onClick={onConfigClick} />}
              <ThemeButton />
            </div>
          </div>
          {showSearchAndNew && (
            <div className="flex items-center gap-4 mt-4 md:mt-0">
              {onSearch && <SearchBar onSearch={onSearch} issues={safeIssues} />}
              <Button 
                onClick={() => handleNavigation('/editor')}
                variant="success"
                className="whitespace-nowrap"
              >
                <span className="flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  New Issue
                </span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
} 