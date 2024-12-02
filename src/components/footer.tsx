import Link from 'next/link'

export function Footer() {
  return (
    <footer className="w-full py-4">
      <div className="container mx-auto px-4 text-center">
        <div className="text-sm text-gray-500">
          © {new Date().getFullYear()}{' '}
          <a 
            href="https://github.com/vandeefeng/gitmemos" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-[#0969da] dark:hover:text-[#2f81f7]"
          >
            GitMemo
          </a>
          . All rights reserved.
        </div>
      </div>
    </footer>
  )
} 