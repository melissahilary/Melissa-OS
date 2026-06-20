/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FAFAF7',
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
