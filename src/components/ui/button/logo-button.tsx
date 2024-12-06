import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./base-button";

interface LogoButtonProps {
  onClick: () => void;
  className?: string;
}

export function LogoButton({ onClick, className }: LogoButtonProps) {
  return (
    <Button
      onClick={onClick}
      variant="ghost"
      className={cn(
        "text-2xl font-bold text-[#24292f] dark:text-[#adbac7] hover:text-[#0969da] dark:hover:text-[#2f81f7] px-0",
        className
      )}
    >
      GitMemo
    </Button>
  );
} 