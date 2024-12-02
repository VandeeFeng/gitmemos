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
        <style>{`
          :root {
            color-scheme: light;
          }
          :root.dark {
            color-scheme: dark;
          }
          html {
            transition: background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          body {
            background-color: inherit;
            transition: background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          html.dark body {
            background-color: #22272e;
          }
          html body {
            background-color: #ffffff;
          }
          *, *::before, *::after {
            transition: background-color 0.3s ease,
                        border-color 0.1s ease,
                        fill 0.1s ease,
                        stroke 0.1s ease;
          }
        `}</style>
        <link
          rel="stylesheet"
          href="https://unpkg.com/@uiw/react-md-editor@3.6.0/dist/mdeditor.min.css"
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="min-h-screen bg-background">
            {children}
            <RootFooter />
          </div>
        </ThemeProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                let theme = localStorage.getItem('theme')
                if (!theme) {
                  theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
                }
                if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark')
                  document.documentElement.style.backgroundColor = '#22272e'
                } else {
                  document.documentElement.classList.remove('dark')
                  document.documentElement.style.backgroundColor = '#ffffff'
                }
              } catch (e) {}
            `,
          }}
        />
      </body>
    </html>
  )
}
