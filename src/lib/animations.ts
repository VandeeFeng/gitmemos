export const animations = {
  // 页面过渡
  transition: {
    base: "transition-all duration-200",
    slow: "transition-all duration-500",
  },
  
  // 淡入动画
  fade: {
    in: "animate-fade-in",
    inSlow: "animate-content-show",
  },
  
  // 加载动画
  loading: {
    spin: "animate-spin",
    pulse: "animate-pulse",
  },
  
  // 交互动画
  interaction: {
    hover: "transition-transform hover:scale-105",
    active: "active:scale-95",
    tap: "tap:scale-95",
  },
  
  // 手风琴动画
  accordion: {
    open: "animate-accordion-down",
    close: "animate-accordion-up",
  }
} as const

// 动画持续时间
export const durations = {
  fast: 150,
  normal: 200,
  slow: 500,
} as const

// 动画缓动函数
export const easings = {
  default: "cubic-bezier(0.4, 0, 0.2, 1)",
  linear: "linear",
  in: "cubic-bezier(0.4, 0, 1, 1)",
  out: "cubic-bezier(0, 0, 0.2, 1)",
  inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
} as const 