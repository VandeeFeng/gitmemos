import { cn } from "@/lib/utils"
import { animations } from "@/lib/animations"

interface LoadingProps {
  size?: 'sm' | 'default' | 'lg'
  className?: string
  fullPage?: boolean
  text?: string
}

export function Loading({ 
  size = 'default',
  className,
  fullPage = false,
  text
}: LoadingProps) {
  const sizes = {
    sm: 'w-6 h-6 border-2',
    default: 'w-8 h-8 border-3',
    lg: 'w-10 h-10 border-4'
  }

  const Wrapper = 'div'
  const wrapperClass = fullPage 
    ? 'fixed inset-0 flex items-center justify-center bg-bg-primary/80 backdrop-blur-sm z-50'
    : 'flex flex-col items-center justify-center'

  return (
    <Wrapper className={wrapperClass}>
      <div className={cn(
        sizes[size],
        "border-secondary/30 border-t-secondary rounded-full",
        animations.loading.spin,
        className
      )} />
      {text && (
        <span className="mt-2 text-sm text-secondary/80">{text}</span>
      )}
    </Wrapper>
  )
} 