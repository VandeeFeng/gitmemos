import { cn } from "@/lib/utils"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
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
  issues = []
}: PageLayoutProps) {
  const pathname = usePathname()
  const isTimelinePage = pathname === '/timeline'

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
          issues={issues}
        />
      )}
      <main className={cn(
        "container mx-auto px-4 max-w-4xl pt-32 md:pt-40 flex-grow",
        className
      )}>
        {children}
      </main>
      {showFooter && !isTimelinePage && <Footer />}
    </div>
  )
} 