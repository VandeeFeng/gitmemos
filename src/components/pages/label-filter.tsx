import { useState, useEffect, useRef } from 'react';
import { Label } from '@/types/github';
import { Loading } from '@/components/ui/loading';

interface LabelFilterProps {
  selectedLabel: string | null;
  onLabelSelect: (label: string) => void;
  labels: Label[];
  loading?: boolean;
}

export function LabelFilter({ selectedLabel, onLabelSelect, labels, loading = false }: LabelFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const selectedLabelData = selectedLabel ? labels.find(label => label.name === selectedLabel) : null;

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      <button
        onClick={() => {
          if (selectedLabel) {
            onLabelSelect('');
            setIsOpen(false);
          } else {
            setIsOpen(!isOpen);
          }
        }}
        className={`inline-flex items-center py-1.5 rounded-md transition-colors ${
          selectedLabel 
            ? 'gap-1.5 px-2 text-[#24292f] dark:text-[#adbac7] bg-[#f6f8fa] dark:bg-[#373e47] hover:bg-[#f3f4f6] dark:hover:bg-[#444c56]' 
            : 'text-[#57606a] dark:text-[#768390] hover:text-[#24292f] dark:hover:text-[#adbac7]'
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" className="flex-shrink-0">
          <path d="M2.5 7.775V2.75a.25.25 0 0 1 .25-.25h5.025a.25.25 0 0 1 .177.073l6.25 6.25a.25.25 0 0 1 0 .354l-5.025 5.025a.25.25 0 0 1-.354 0l-6.25-6.25a.25.25 0 0 1-.073-.177Zm-1.5 0V2.75C1 1.784 1.784 1 2.75 1h5.025c.464 0 .91.184 1.238.513l6.25 6.25a1.75 1.75 0 0 1 0 2.474l-5.026 5.026a1.75 1.75 0 0 1-2.474 0l-6.25-6.25A1.75 1.75 0 0 1 1 7.775ZM6 5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"></path>
        </svg>
        {selectedLabelData && (
          <>
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: `#${selectedLabelData.color}` }}
            />
            <span className="text-sm font-medium">
              {selectedLabelData.name}
            </span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="flex-shrink-0">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path>
            </svg>
          </>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-lg border border-gray-200 dark:border-[#373e47] bg-white dark:bg-[#2d333b] shadow-lg">
          <div className="max-h-96 overflow-y-auto py-1">
            {loading ? (
              <div className="px-3 py-2">
                <Loading className="!p-0" />
              </div>
            ) : labels.length === 0 ? (
              <div className="px-3 py-2 text-center text-sm text-[#57606a] dark:text-[#768390]">
                No labels found
              </div>
            ) : (
              <div className="py-1">
                {labels.map((label) => (
                  <button
                    key={label.id}
                    className={`w-full px-3 py-2 text-left hover:bg-[#f6f8fa] dark:hover:bg-[#373e47] ${
                      selectedLabel === label.name ? 'bg-[#f6f8fa] dark:bg-[#373e47]' : ''
                    }`}
                    onClick={() => {
                      onLabelSelect(label.name === selectedLabel ? '' : label.name);
                      setIsOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: `#${label.color}` }}
                      />
                      <span className="text-sm text-[#24292f] dark:text-[#adbac7] truncate">
                        {label.name}
                      </span>
                    </div>
                    {label.description && (
                      <p className="mt-0.5 text-xs text-[#57606a] dark:text-[#768390] truncate pl-5">
                        {label.description}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 