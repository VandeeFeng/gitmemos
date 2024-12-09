import type { Config } from "tailwindcss";

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "rgb(var(--color-border-primary) / <alpha-value>)",
        input: "rgb(var(--color-border-primary) / <alpha-value>)",
        ring: "rgb(var(--color-border-primary) / <alpha-value>)",
        background: "rgb(var(--color-bg-primary) / <alpha-value>)",
        foreground: "rgb(var(--color-text-primary) / <alpha-value>)",
        
        primary: "rgb(var(--color-primary) / <alpha-value>)",
        secondary: "rgb(var(--color-secondary) / <alpha-value>)",
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        success: "rgb(var(--color-success) / <alpha-value>)",
        warning: "rgb(var(--color-warning) / <alpha-value>)",
        error: "rgb(var(--color-error) / <alpha-value>)",
        
        "bg-primary": "rgb(var(--color-bg-primary) / <alpha-value>)",
        "bg-secondary": "rgb(var(--color-bg-secondary) / <alpha-value>)",
        "bg-tertiary": "rgb(var(--color-bg-tertiary) / <alpha-value>)",
        
        "text-primary": "rgb(var(--color-text-primary) / <alpha-value>)",
        "text-secondary": "rgb(var(--color-text-secondary) / <alpha-value>)",
        "text-tertiary": "rgb(var(--color-text-tertiary) / <alpha-value>)",
        
        "border-primary": "rgb(var(--color-border-primary) / <alpha-value>)",
        "border-secondary": "rgb(var(--color-border-secondary) / <alpha-value>)",
        "border-default": "rgb(var(--color-border-primary) / <alpha-value>)",
      },
      typography: {
        DEFAULT: {
          css: {
            'code::before': { content: '""' },
            'code::after': { content: '""' },
            code: {
              backgroundColor: '#eaeef2',
              padding: '0.25rem 0.375rem',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              color: '#24292f',
            },
            pre: {
              backgroundColor: '#f6f8fa',
              code: {
                backgroundColor: 'transparent',
                padding: 0,
                color: 'inherit',
              },
            },
            blockquote: {
              color: '#57606a',
              borderLeftColor: '#d0d7de',
              fontWeight: '400',
            },
            a: {
              color: 'rgb(var(--color-secondary))',
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline',
              },
            },
            'ul > li': {
              '&::marker': {
                color: '#57606a',
              },
              '&::before': {
                display: 'none',
              },
            },
            'ul > li.contains-task-list': {
              listStyleType: 'none',
              paddingLeft: 0,
            },
            '.task-list-item': {
              listStyleType: 'none',
              paddingLeft: 0,
            },
          },
        },
        invert: {
          css: {
            code: {
              backgroundColor: '#2d333b',
              color: '#adbac7',
            },
            pre: {
              backgroundColor: '#2d333b',
              code: {
                backgroundColor: 'transparent',
                color: 'inherit',
              },
            },
            blockquote: {
              color: '#768390',
              borderLeftColor: '#373e47',
              fontWeight: '400',
            },
            'ul > li': {
              '&::marker': {
                color: '#768390',
              },
            },
          },
        },
      },
      boxShadow: {
        "card": "0 2px 8px -3px rgba(0,0,0,0.05), 0 1px 2px -2px rgba(0,0,0,0.05)",
        "card-hover": "0 4px 12px -3px rgba(0,0,0,0.1), 0 2px 3px -2px rgba(0,0,0,0.05)",
        "card-dark": "0 2px 8px -3px rgba(0,0,0,0.3), 0 1px 2px -2px rgba(0,0,0,0.3)",
        "card-dark-hover": "0 4px 12px -3px rgba(0,0,0,0.4), 0 2px 3px -2px rgba(0,0,0,0.3)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(-10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "content-show": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "content-show": "content-show 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require('@tailwindcss/typography')({
      target: 'modern',
      className: 'prose',
      modifiers: ['DEFAULT', 'sm', 'lg', 'xl', '2xl', 'invert'],
    }),
  ],
} satisfies Config;

export default config;
