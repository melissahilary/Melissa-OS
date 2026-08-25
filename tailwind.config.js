/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // The whole neutral system reads from CSS variables so a single
        // data-mos-theme attribute reskins the app (see index.css palettes).
        cream: 'var(--mos-cream, #FAFAF7)',
        stone: {
          50: 'var(--mos-stone-50, #fafaf9)',
          100: 'var(--mos-stone-100, #f5f5f4)',
          200: 'var(--mos-stone-200, #e7e5e4)',
          300: 'var(--mos-stone-300, #d6d3d1)',
          400: 'var(--mos-stone-400, #a8a29e)',
          500: 'var(--mos-stone-500, #78716c)',
          600: 'var(--mos-stone-600, #57534e)',
          700: 'var(--mos-stone-700, #44403c)',
          800: 'var(--mos-stone-800, #292524)',
          900: 'var(--mos-stone-900, #1c1917)',
        },
        sand: '#C4A882',
        mauve: '#B8849A',
        phase: {
          menstrual: '#8B3A3A',
          follicular: '#7B8B5F',
          ovulation: '#C9A961',
          luteal: '#5A6B7B',
        },
        tint: {
          bookend: '#F0EBE2',
          snack: '#F5F0EA',
          meal: '#EDE7DD',
          supps: '#E8DFCF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Cormorant Garamond"', 'ui-serif', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
