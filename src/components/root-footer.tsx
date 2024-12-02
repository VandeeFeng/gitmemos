'use client'

import { usePathname } from 'next/navigation'
import { Footer } from './footer'

export function RootFooter() {
  const pathname = usePathname()
  const isTimelinePage = pathname?.startsWith('/timeline')

  if (isTimelinePage) {
    return null
  }

  return <Footer />
} 