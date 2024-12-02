import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { RootFooter } from '@/components/root-footer'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Git Memo',
  description: 'A memo application based on GitHub issues',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              function getTheme() {
                try {
                  const stored = localStorage.getItem('theme');
                  if (stored === 'light' || stored === 'dark') return stored;
                  
                  if (typeof localStorage !== 'undefined' && localStorage.getItem('theme') === null) {
                    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    const theme = systemDark ? 'dark' : 'light';
                    localStorage.setItem('theme', theme);
                    return theme;
                  }
                  
                  return 'dark';
                } catch (e) {
                  return 'dark';
                }
              }
              const theme = getTheme();
              document.documentElement.style.backgroundColor = theme === 'dark' ? '#09090b' : '#ffffff';
              document.documentElement.classList.add(theme);
            })()
          `
        }} />
        <style>{`
          :root {
            color-scheme: light;
            background-color: #ffffff;
          }
          :root[class~="dark"] {
            color-scheme: dark;
            background-color: #09090b;
          }
          body {
            background-color: inherit;
          }
        `}</style>
        <link
          rel="stylesheet"
          href="https://unpkg.com/@uiw/react-md-editor@3.6.0/dist/mdeditor.min.css"
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem={false}>
          <div className="min-h-screen bg-background">
            {children}
            <RootFooter />
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
