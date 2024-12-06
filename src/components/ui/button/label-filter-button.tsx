import * as React from "react";
import { useState, useEffect, useRef } from 'react';
import { Label } from '@/types/github';
import { Loading } from '../loading';
import { Button } from './base-button';
import { cn } from '@/lib/utils';

interface LabelFilterButtonProps {
  selectedLabel: string | null;
  onLabelSelect: (label: string) => void;
  labels: Label[];
  loading?: boolean;
  className?: string;
}

export function LabelFilterButton({ 
  selectedLabel, 
  onLabelSelect, 
  labels, 
  loading = false,
  className 
}: LabelFilterButtonProps) {
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
      <Button
        onClick={() => {
          if (selectedLabel) {
            onLabelSelect('');
            setIsOpen(false);
          } else {
            setIsOpen(!isOpen);
          }
        }}
        variant={selectedLabel ? 'outline' : 'ghost'}
        size={selectedLabel ? 'default' : 'icon'}
        className={cn(
          'text-text-secondary hover:text-text-primary',
          selectedLabel && 'gap-1.5 bg-[#f6f8fa] dark:bg-[#373e47] hover:bg-[#f3f4f6] dark:hover:bg-[#444c56]',
          className
        )}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="flex-shrink-0"
        >
          <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
          <path d="M7 7h.01" />
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="flex-shrink-0"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </>
        )}
      </Button>

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
                    className={cn(
                      'w-full px-3 py-2 text-left hover:bg-[#f6f8fa] dark:hover:bg-[#373e47]',
                      selectedLabel === label.name ? 'bg-[#f6f8fa] dark:bg-[#373e47]' : ''
                    )}
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