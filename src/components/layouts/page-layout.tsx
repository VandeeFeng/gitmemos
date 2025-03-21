'use client';

import { cn } from "@/lib/utils"
import { Header } from "@/components/pages/header"
import { Footer } from "@/components/layouts/footer"
import { usePathname } from 'next/navigation'
import { Issue } from "@/types/github"

interface PageLayoutProps {
  children: React.ReactNode
  className?: string
  showHeader?: boolean
  showFooter?: boolean
  selectedLabel?: string | null
  onLabelSelect?: (label: string) => void
  onSearch?: (query: string) => void
  showConfig?: boolean
  onConfigClick?: () => void
  showSearchAndNew?: boolean
  issues?: Issue[]
  onSync?: () => Promise<void>
}

export function PageLayout({ 
  children, 
  className,
  showHeader = true,
  showFooter = true,
  selectedLabel,
  onLabelSelect,
  onSearch,
  showConfig,
  onConfigClick,
  showSearchAndNew = true,
  issues = [],
  onSync
}: PageLayoutProps) {
  const pathname = usePathname()
  const isTimelinePage = pathname === '/timeline'
  const isIssuePage = pathname.startsWith('/issue/')
  
  // Ensure issues is always an array
  const safeIssues = Array.isArray(issues) ? issues : [];

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary transition-colors duration-500">
      {showHeader && (
        <Header 
          selectedLabel={selectedLabel}
          onLabelSelect={onLabelSelect}
          onSearch={onSearch}
          showConfig={showConfig}
          onConfigClick={onConfigClick}
          showSearchAndNew={showSearchAndNew}
          issues={safeIssues}
          onSync={onSync}
        />
      )}
      <main className={cn(
        "container mx-auto px-4 max-w-4xl flex-grow",
        isIssuePage ? "pt-20 md:pt-24" : "pt-36 md:pt-28",
        className
      )}>
        {children}
      </main>
      {showFooter && !isTimelinePage && <Footer />}
    </div>
  )
} 