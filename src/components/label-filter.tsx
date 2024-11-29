import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Octokit } from 'octokit';
import { getGitHubConfig } from '@/lib/github';

interface Label {
  id: number;
  name: string;
  color: string;
  description: string | null;
}

interface LabelFilterProps {
  selectedLabel: string | null;
  onLabelSelect: (label: string) => void;
}

export function LabelFilter({ selectedLabel, onLabelSelect }: LabelFilterProps) {
  const [labels, setLabels] = useState<Label[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    const fetchLabels = async () => {
      try {
        const config = getGitHubConfig();
        if (!config.token) {
          setLoading(false);
          return;
        }

        const octokit = new Octokit({ auth: config.token });

        const response = await octokit.rest.issues.listLabelsForRepo({
          owner: config.owner,
          repo: config.repo,
          per_page: 100,
        });

        const transformedLabels: Label[] = response.data.map(label => ({
          id: label.id,
          name: label.name,
          color: label.color,
          description: label.description
        }));

        setLabels(transformedLabels);
      } catch (error) {
        console.error('Error fetching labels:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLabels();
  }, []);

  const config = getGitHubConfig();
  if (!config.token) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          if (selectedLabel) {
            onLabelSelect('');
            setIsOpen(false);
          } else {
            setIsOpen(!isOpen);
          }
        }}
        className={`w-6 h-6 text-[#57606a] dark:text-[#768390] hover:text-[#24292f] dark:hover:text-[#adbac7] ${
          selectedLabel ? 'bg-[#f6f8fa] dark:bg-[#2d333b]' : ''
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2.5 7.775V2.75a.25.25 0 0 1 .25-.25h5.025a.25.25 0 0 1 .177.073l6.25 6.25a.25.25 0 0 1 0 .354l-5.025 5.025a.25.25 0 0 1-.354 0l-6.25-6.25a.25.25 0 0 1-.073-.177Zm-1.5 0V2.75C1 1.784 1.784 1 2.75 1h5.025c.464 0 .91.184 1.238.513l6.25 6.25a1.75 1.75 0 0 1 0 2.474l-5.026 5.026a1.75 1.75 0 0 1-2.474 0l-6.25-6.25A1.75 1.75 0 0 1 1 7.775ZM6 5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"></path>
        </svg>
      </Button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-lg border border-gray-200 dark:border-[#373e47] bg-white dark:bg-[#2d333b] shadow-lg">
          <div className="max-h-96 overflow-y-auto py-1">
            {loading ? (
              <div className="px-3 py-2 text-center text-sm text-[#57606a] dark:text-[#768390]">
                Loading labels...
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