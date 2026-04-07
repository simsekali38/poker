/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts,scss}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4f46e5',
          hover: '#4338ca',
          active: '#3730a3',
        },
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
        surface: '#ffffff',
        canvas: '#f9fafb',
        ink: '#111827',
        muted: '#6b7280',
        line: '#e5e7eb',
      },
      borderRadius: {
        card: '16px',
        'card-sm': '14px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
        'card-md': '0 4px 14px rgba(15, 23, 42, 0.08), 0 2px 4px rgba(15, 23, 42, 0.04)',
        'card-lg': '0 12px 32px rgba(15, 23, 42, 0.12), 0 4px 8px rgba(15, 23, 42, 0.06)',
      },
      transitionDuration: {
        180: '180ms',
        220: '220ms',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'reveal-pop': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'vote-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(79, 70, 229, 0.45)' },
          '50%': { boxShadow: '0 0 0 8px rgba(79, 70, 229, 0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.45s cubic-bezier(0.33, 1, 0.68, 1) forwards',
        'reveal-pop': 'reveal-pop 0.4s cubic-bezier(0.33, 1, 0.68, 1) forwards',
        'vote-pulse': 'vote-pulse 0.6s ease-out 1',
      },
    },
  },
  plugins: [],
};
