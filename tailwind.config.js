/** @type {import('tailwindcss').Config} */
//
// The house palette, as set out in the brand guidelines: ivory, walnut, ink, and
// one blue. Roughly 70% ivory, 22% walnut or ink, 5% metal, 3% cobalt — cobalt
// never fills a surface larger than a button.
//
// The `stone` scale is kept as a name because it is spelled through every
// component; what it points at is now the ivory-to-ink ramp. Renaming it would
// be a thousand-line diff that changes nothing on screen.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Page ground. Still a variable so a theme can retint the whole house.
        cream: 'var(--mos-cream, #F7F4ED)',
        // Ivory into ink. Fixed, not themed: the ground belongs to her, this
        // ramp belongs to the brand.
        stone: {
          50: '#F7F4ED',  // ivory 050
          100: '#EFEAE0', // ivory 100
          200: '#E2DACB', // ivory 200 — hairlines, 18% ink
          300: '#CEC3AF', // ivory 300
          400: '#B4A68D', // ivory 400
          500: '#96866C', // ivory 500 — label ink
          600: '#6E4526', // walnut 500
          700: '#3E2513', // walnut 700
          800: '#201D19', // ink 700
          900: '#16130F', // ink 800 — body copy, night surfaces
        },
        // The single accent. It marks what is due today and the active section,
        // and it never marks a warning or a streak.
        cobalt: {
          300: '#5A68E8',
          400: '#3A4BE0',
          500: '#1D2FC4',
          600: '#16249A',
          DEFAULT: '#1D2FC4',
        },
        // Chrome greys are for hairlines, tab hardware and crystal in
        // photographs. Never for type.
        chrome: '#94989C',
        walnut: {
          200: '#C89468',
          300: '#A9724A',
          400: '#8A5A32',
          500: '#6E4526',
          600: '#55341B',
          700: '#3E2513',
          DEFAULT: '#6E4526',
        },
        ink: {
          500: '#4A443C',
          600: '#332E28',
          700: '#201D19',
          800: '#16130F',
          900: '#0D0B09',
          DEFAULT: '#16130F',
        },
        sand: '#B4A68D',
        mauve: '#A9724A',
        // The product's own, and structural: edges and bands only, never a fill.
        phase: {
          menstrual: '#A0654C',
          follicular: '#889072',
          ovulation: '#C4A76A',
          luteal: '#8E8074',
        },
        // Labs and adherence, always shown with a word beside them. Out of range
        // is the one place oxblood appears on screen — it resolves the collision
        // where bleeding and low ferritin shipped as the same colour.
        state: {
          optimal: '#7C8B6B',
          inrange: '#A3A093',
          out: '#7A1220',
          unknown: '#C4BFB6',
        },
        oxblood: '#7A1220',
        tint: {
          bookend: '#EFEAE0',
          snack: '#F7F4ED',
          meal: '#E2DACB',
          supps: '#CEC3AF',
        },
      },
      fontFamily: {
        // One didone, one grotesk, one mono. Nothing else enters the system.
        sans: ['"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Bodoni Moda"', 'ui-serif', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      // Square. Radius belongs to physical objects in photographs, never to
      // layout — so every rounded utility resolves to nothing except the pill
      // shapes that are genuinely hardware.
      borderRadius: {
        none: '0',
        sm: '0',
        DEFAULT: '0',
        md: '0',
        lg: '0',
        xl: '0',
        '2xl': '0',
        '3xl': '0',
        full: '9999px',
      },
      // No shadows. Depth is the photograph's job.
      boxShadow: {
        none: 'none',
        sm: 'none',
        DEFAULT: 'none',
        md: 'none',
        lg: 'none',
        xl: 'none',
        '2xl': 'none',
        inner: 'none',
      },
    },
  },
  plugins: [],
}
