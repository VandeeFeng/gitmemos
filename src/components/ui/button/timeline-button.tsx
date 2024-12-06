import * as React from "react";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { Button } from "./base-button";

interface TimelineButtonProps {
  onClick: () => void;
  className?: string;
}

export function TimelineButton({ onClick, className }: TimelineButtonProps) {
  const pathname = usePathname();
  const isTimelinePage = pathname === '/timeline';

  return (
    <Button
      onClick={onClick}
      variant="ghost"
      size="icon"
      className={cn(
        isTimelinePage ? 'text-[#0969da] dark:text-[#2f81f7]' : 'text-text-secondary hover:text-text-primary',
        className
      )}
      title={isTimelinePage ? "Exit Timeline" : "Timeline"}
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
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    </Button>
  );
} 