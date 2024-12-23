import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ClientLayout } from '@/components/layouts/client-layout'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'] })

let url = "https://memo.vandee.art/";
let title = "Git Memo";
let description = "A memo application based on GitHub issues";
let sitename = "memo.vandee.art";

export const metadata: Metadata = {
  metadataBase: new URL(url),
  title: {
    default: title,
    template: `%s - ${title}`,
  },
  description: description,
  keywords: ['memo', 'github', 'issues', 'notes', 'knowledge base', 'markdown'],
  authors: [{ name: 'Vandee' }],
  creator: 'Vandee',
  publisher: 'Vandee',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },

  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: url,
    siteName: sitename,
    title: title,
    description: description,
    images: [
      {
        url: `${url}og-image.png`,
        width: 1200,
        height: 630,
        alt: title,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: title,
    description: description,
    images: [`${url}og-image.png`],
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    minimumScale: 1,
    maximumScale: 5,
    userScalable: true,
  },

  alternates: {
    canonical: url,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ClientLayout>
          {children}
        </ClientLayout>
        <Toaster richColors position="top-right" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark')
                } else {
                  document.documentElement.classList.remove('dark')
                }
              } catch (e) {}
            `,
          }}
        />
      </body>
    </html>
  )
}