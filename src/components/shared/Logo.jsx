import { APP_NAME } from '../../lib/brand'

// One lockup. Sizes are fixed per context so the wordmark never drifts.
const SIZE = {
  splash: 'text-4xl text-stone-400',
  signin: 'text-5xl text-stone-900',
  home: 'text-5xl text-stone-900 md:text-6xl',
  nav: 'text-xl text-stone-800 md:text-2xl',
}

export default function Logo({ size = 'nav', className = '' }) {
  return (
    <span
      className={`inline-block whitespace-nowrap leading-tight ${SIZE[size] || SIZE.nav} ${className}`}
      style={{ fontFamily: "'Pinyon Script', cursive" }}
    >
      {APP_NAME}
    </span>
  )
}
