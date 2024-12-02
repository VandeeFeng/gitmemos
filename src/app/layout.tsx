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
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              function getInitialTheme() {
                const persistedTheme = window.localStorage.getItem('theme');
                const hasPersistedPreference = typeof persistedTheme === 'string';
                if (hasPersistedPreference) {
                  return persistedTheme;
                }
                const mql = window.matchMedia('(prefers-color-scheme: dark)');
                const hasMediaQueryPreference = typeof mql.matches === 'boolean';
                if (hasMediaQueryPreference) {
                  return mql.matches ? 'dark' : 'light';
                }
                return 'dark';
              }
              const theme = getInitialTheme();
              document.documentElement.style.setProperty('--initial-color-mode', theme);
              document.documentElement.classList.add(theme);
              document.documentElement.style.colorScheme = theme;
            })()
          `,
        }}
      />
      <head>
        <style>{`
          :root {
            --initial-color-mode: light;
          }
          :root[class='dark'] {
            --bg-color: #09090b;
            color-scheme: dark;
          }
          :root[class='light'] {
            --bg-color: #ffffff;
            color-scheme: light;
          }
          html {
            background-color: var(--bg-color);
          }
          body {
            background-color: var(--bg-color);
          }
          html.dark {
            background-color: #09090b;
          }
          html.light {
            background-color: #ffffff;
          }
        `}</style>
        <link
          rel="stylesheet"
          href="https://unpkg.com/@uiw/react-md-editor@3.6.0/dist/mdeditor.min.css"
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="min-h-screen bg-background">
            {children}
            <RootFooter />
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
