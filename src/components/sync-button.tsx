import { cn } from "@/lib/utils";
import { useState } from "react";

interface SyncButtonProps {
  onSync: () => Promise<void>;
  className?: string;
}

export function SyncButton({ onSync, className }: SyncButtonProps) {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await onSync();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <button
      onClick={handleSync}
      disabled={syncing}
      className={cn(
        "text-text-secondary hover:text-text-primary transition-colors",
        syncing && "opacity-70 cursor-not-allowed",
        className
      )}
      title={syncing ? "Syncing..." : "Sync with GitHub"}
    >
      <svg
        className={cn(
          "h-5 w-5",
          syncing && "animate-spin"
        )}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38" />
      </svg>
    </button>
  );
} 