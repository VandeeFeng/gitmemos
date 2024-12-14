'use client';

import { ThemeProvider } from 'next-themes';
import { IssueProvider } from '@/lib/contexts/issue-context';
import { LabelProvider } from '@/lib/contexts/label-context';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <IssueProvider>
        <LabelProvider>
          <div className="min-h-screen bg-background">
            {children}
          </div>
        </LabelProvider>
      </IssueProvider>
    </ThemeProvider>
  );
} 