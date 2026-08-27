/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{html,ts}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Primary: screen-bright electric blue (on-brand for a phone shop) ──
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#3b94ff',
          500: '#0F6FFF',
          600: '#0057e0',
          700: '#0044b8',
          800: '#003490',
          900: '#002268',
        },
        // ── Ink: near-black with cold blue undertone for headings + numbers ──
        ink: {
          DEFAULT: '#1A1A2E',
          soft: '#2D2D44',
          muted: '#4A4A6A',
        },
        // ── Surface: very slightly cool off-white page background ──
        surface: {
          DEFAULT: '#F8F9FC',
          card: '#FFFFFF',
          raised: '#F1F3F9',
        },
        // ── Ledger: khata-specific debit/credit colours ──
        ledger: {
          debit:   '#DC2626',  // red ink — outstanding, credit given
          credit:  '#16A34A',  // green — repayment, settled
          'debit-bg':  '#FEF2F2',
          'credit-bg': '#F0FDF4',
          rule:    '#E5E7EB',  // horizontal ledger rule
        },
        // ── Semantic: tuned to the palette, not raw Tailwind defaults ──
        success: {
          DEFAULT: '#16A34A',
          50:  '#F0FDF4',
          100: '#DCFCE7',
          600: '#16A34A',
          700: '#15803D',
        },
        warning: {
          DEFAULT: '#D97706',
          50:  '#FFFBEB',
          100: '#FEF3C7',
          600: '#D97706',
          700: '#B45309',
        },
        danger: {
          DEFAULT: '#DC2626',
          50:  '#FEF2F2',
          100: '#FEE2E2',
          600: '#DC2626',
          700: '#B91C1C',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
      },
      fontSize: {
        // Tighter leading for dense tables
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        lg:  '0.625rem',
        xl:  '0.875rem',
        '2xl': '1.125rem',
      },
      boxShadow: {
        // Subtle elevation scale
        card:   '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        raised: '0 4px 12px -2px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
        float:  '0 8px 24px -4px rgb(0 0 0 / 0.12), 0 4px 8px -4px rgb(0 0 0 / 0.08)',
        // Primary glow for the checkout button
        'primary-glow': '0 0 0 3px rgb(15 111 255 / 0.20)',
      },
      transitionTimingFunction: {
        // expo-out: fast start, smooth settle — used everywhere
        'sp': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
        '250': '250ms',
        '400': '400ms',
      },
      keyframes: {
        // Realtime row highlight pulse
        'row-pulse': {
          '0%':   { backgroundColor: 'rgb(15 111 255 / 0.08)' },
          '100%': { backgroundColor: 'transparent' },
        },
        // Checkout success scale-in
        'success-pop': {
          '0%':   { transform: 'scale(0.92)', opacity: '0' },
          '60%':  { transform: 'scale(1.04)' },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
        // Cart item entry
        'slide-in-right': {
          '0%':   { transform: 'translateX(12px)', opacity: '0' },
          '100%': { transform: 'translateX(0)',    opacity: '1' },
        },
        // Stat card number entrance
        'count-in': {
          '0%':   { transform: 'translateY(6px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',   opacity: '1' },
        },
        // Skeleton shimmer
        'shimmer': {
          '0%':   { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        'row-pulse':       'row-pulse 600ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'success-pop':     'success-pop 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in-right':  'slide-in-right 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'count-in':        'count-in 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'shimmer':         'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
};
