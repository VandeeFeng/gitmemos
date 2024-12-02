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
            try {
              let theme = localStorage.getItem('theme');
              if (!theme) {
                theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                localStorage.setItem('theme', theme);
              }
              document.documentElement.classList.add(theme);
            } catch (e) {
              document.documentElement.classList.add('dark');
            }
          `
        }} />
        <style>{`
          :root {
            color-scheme: light dark;
          }
          :root, :root.light {
            background-color: #ffffff;
          }
          :root.dark {
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
