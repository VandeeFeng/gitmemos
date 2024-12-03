import { cn } from "@/lib/utils"

interface LoadingProps {
  size?: 'sm' | 'default' | 'lg'
  className?: string
  fullPage?: boolean
}

export function Loading({ 
  size = 'default',
  className,
  fullPage = false
}: LoadingProps) {
  const sizes = {
    sm: 'w-6 h-6 border-2',
    default: 'w-8 h-8 border-4',
    lg: 'w-10 h-10 border-4'
  }

  const Wrapper = fullPage ? 'div' : 'div'
  const wrapperClass = fullPage 
    ? 'fixed inset-0 flex items-center justify-center bg-bg-primary/80 z-50'
    : 'flex justify-center'

  return (
    <Wrapper className={wrapperClass}>
      <div className={cn(
        sizes[size],
        "border-secondary/50 border-t-secondary rounded-full animate-spin",
        className
      )} />
    </Wrapper>
  )
} 