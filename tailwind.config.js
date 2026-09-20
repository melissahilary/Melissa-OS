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
        // Page ground. Still a variable so a theme can retint the whole house —
        // but held as channels, because a bare `var(--x)` makes Tailwind refuse
        // to emit `text-cream/90` at all. That silence was the worst kind of
        // bug: light type on a dark tile fell back to inherited ink and simply
        // disappeared, in twenty places, with nothing in the console.
        cream: 'rgb(var(--mos-cream-rgb, 247 244 237) / <alpha-value>)',
        // A raised surface — a card lifted off the ground. On ivory it is
        // literally white; on the dark papers it is the ground plus a little
        // light, because a white box on a black page is a hole in the page.
        white: 'rgb(var(--mos-white, 255 255 255) / <alpha-value>)',
        // Ivory into ink — and themed, which is new.
        //
        // The ramp is used semantically everywhere in the app: the light end is
        // surfaces and hairlines, the dark end is type. So swapping the ends
        // turns the whole house over at once, and every pairing the components
        // already make (`bg-stone-900 text-cream`, `text-stone-500` on
        // `bg-cream`) stays legible, because both halves move together. That is
        // the only reason a theme can be dramatic without a thousand
        // dark-mode variants.
        //
        // Defaults are the ivory ramp, so a page with no theme attribute set —
        // the login screen, a stale bundle — still looks like the house.
        stone: {
          50: 'rgb(var(--mos-s50, 247 244 237) / <alpha-value>)',   // lightest surface
          100: 'rgb(var(--mos-s100, 239 234 224) / <alpha-value>)', // surface
          200: 'rgb(var(--mos-s200, 226 218 203) / <alpha-value>)', // hairlines
          300: 'rgb(var(--mos-s300, 206 195 175) / <alpha-value>)',
          400: 'rgb(var(--mos-s400, 180 166 141) / <alpha-value>)',
          500: 'rgb(var(--mos-s500, 150 134 108) / <alpha-value>)', // label ink
          600: 'rgb(var(--mos-s600, 110 69 38) / <alpha-value>)',   // the warm mid
          700: 'rgb(var(--mos-s700, 62 37 19) / <alpha-value>)',
          800: 'rgb(var(--mos-s800, 32 29 25) / <alpha-value>)',
          900: 'rgb(var(--mos-s900, 22 19 15) / <alpha-value>)',    // body copy
        },
        // The single accent. It marks what is due today and the active section,
        // and it never marks a warning or a streak. It stays one blue in every
        // theme; only its weight moves, because cobalt 500 on a near-black
        // ground is a shape you can see but not read.
        cobalt: {
          300: '#5A68E8',
          400: '#3A4BE0',
          500: 'rgb(var(--mos-accent-rgb, 29 47 196) / <alpha-value>)',
          600: '#16249A',
          DEFAULT: 'rgb(var(--mos-accent-rgb, 29 47 196) / <alpha-value>)',
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
