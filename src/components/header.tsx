import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/search-bar';
import { LabelFilter } from '@/components/label-filter';
import { Issue } from '@/types/github';

interface HeaderProps {
  onSearch?: (query: string) => void;
  issues?: Issue[];
  selectedLabel?: string | null;
  onLabelSelect?: (label: string) => void;
  showSearchAndNew?: boolean;
  showConfig?: boolean;
  onConfigClick?: () => void;
}

export function Header({
  onSearch,
  issues = [],
  selectedLabel,
  onLabelSelect,
  showSearchAndNew = true,
  showConfig = false,
  onConfigClick
}: HeaderProps) {
  const { theme, setTheme } = useTheme();

  return (
    <header className="fixed top-0 left-0 right-0 bg-white/80 dark:bg-[#22272e]/80 backdrop-blur-sm z-40">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between py-4 md:py-10">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-2xl font-bold text-[#24292f] dark:text-[#adbac7] hover:text-[#0969da] dark:hover:text-[#2f81f7] transition-colors"
            >
              GitMemo
            </Link>
            <Link
              href="/timeline"
              className="text-text-secondary hover:text-text-primary transition-colors"
              title="Timeline"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </Link>
            {selectedLabel !== undefined && onLabelSelect && (
              <LabelFilter
                selectedLabel={selectedLabel}
                onLabelSelect={onLabelSelect}
              />
            )}
            {showConfig && (
              <button
                onClick={onConfigClick}
                className="text-[#57606a] dark:text-[#768390] hover:text-[#24292f] dark:hover:text-[#adbac7] transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
            )}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              {theme === "dark" ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              )}
            </button>
          </div>
          {showSearchAndNew && (
            <div className="flex items-center gap-4 mt-4 md:mt-0">
              {onSearch && <SearchBar onSearch={onSearch} issues={issues} />}
              <Button 
                asChild
                className="bg-success hover:bg-success/90 text-white border-0 shadow-none transition-colors whitespace-nowrap"
              >
                <Link href="/editor">
                  <span className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    New Issue
                  </span>
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
} 