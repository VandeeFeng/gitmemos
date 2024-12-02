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
                  if (stored) return stored;
                  
                  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  return systemDark ? 'dark' : 'light';
                } catch (e) {
                  return 'dark';
                }
              }
              const theme = getTheme();
              document.documentElement.setAttribute('data-theme', theme);
              document.documentElement.classList.add(theme);
              document.documentElement.style.backgroundColor = theme === 'dark' ? '#09090b' : '#ffffff';
            })()
          `
        }} />
        <link
          rel="stylesheet"
          href="https://unpkg.com/@uiw/react-md-editor@3.6.0/dist/mdeditor.min.css"
        />
        <style>{`
          :root {
            color-scheme: light;
            background-color: #ffffff;
          }
          [data-theme="dark"] {
            color-scheme: dark;
            background-color: #09090b;
          }
          html.dark {
            background-color: #09090b !important;
            color-scheme: dark;
          }
          html.light {
            background-color: #ffffff !important;
            color-scheme: light;
          }
          body {
            background-color: inherit;
          }
        `}</style>
      </head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <div className="min-h-screen bg-background">
            {children}
            <RootFooter />
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
