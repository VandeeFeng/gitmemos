export const componentStates = {
  // 交互状态
  interactive: {
    base: "transition-colors duration-200",
    hover: "hover:bg-bg-secondary",
    active: "active:bg-bg-tertiary",
    disabled: "opacity-50 cursor-not-allowed",
  },

  // 焦点状态
  focus: {
    base: "focus:outline-none",
    ring: "focus:ring-2 focus:ring-secondary focus:ring-offset-2",
    within: "focus-within:ring-2 focus-within:ring-secondary",
  },

  // 加载状态
  loading: {
    base: "cursor-wait opacity-70",
    spinner: "animate-spin",
  },

  // 错误状态
  error: {
    base: "border-error",
    text: "text-error",
    bg: "bg-error/10",
  },

  // 成功状态
  success: {
    base: "border-success",
    text: "text-success",
    bg: "bg-success/10",
  },
} as const

// 组件尺寸
export const sizes = {
  sm: {
    text: "text-sm",
    padding: "px-3 py-1.5",
    height: "h-8",
  },
  default: {
    text: "text-base",
    padding: "px-4 py-2",
    height: "h-10",
  },
  lg: {
    text: "text-lg",
    padding: "px-6 py-3",
    height: "h-12",
  },
} as const

// 圆角大小
export const radius = {
  none: "rounded-none",
  sm: "rounded-sm",
  default: "rounded-md",
  lg: "rounded-lg",
  full: "rounded-full",
} as const 