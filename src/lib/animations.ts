export const animations = {
  // Page transitions
  transition: {
    base: "transition-all duration-200",
    slow: "transition-all duration-500",
  },
  
  // Fade animations
  fade: {
    in: "animate-fade-in",
    inSlow: "animate-content-show",
  },
  
  // Loading animations
  loading: {
    spin: "animate-spin",
    pulse: "animate-pulse",
  },
  
  // Interaction animations
  interaction: {
    hover: "transition-transform hover:scale-105",
    active: "active:scale-95",
    tap: "tap:scale-95",
  },
  
  // Accordion animations
  accordion: {
    open: "animate-accordion-down",
    close: "animate-accordion-up",
  }
} as const

// Animation durations
export const durations = {
  fast: 150,
  normal: 200,
  slow: 500,
} as const

// Animation easing functions
export const easings = {
  default: "cubic-bezier(0.4, 0, 0.2, 1)",
  linear: "linear",
  in: "cubic-bezier(0.4, 0, 1, 1)",
  out: "cubic-bezier(0, 0, 0.2, 1)",
  inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
} as const 