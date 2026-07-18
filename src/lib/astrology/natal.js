// Melissa's natal chart — computed once, hard-coded. Do not let the model touch
// these numbers; the math stays in code.

export const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
]

export const SIGN_GLYPH = {
  Aries: '♈', Taurus: '♉', Gemini: '♊', Cancer: '♋', Leo: '♌', Virgo: '♍',
  Libra: '♎', Scorpio: '♏', Sagittarius: '♐', Capricorn: '♑', Aquarius: '♒', Pisces: '♓',
}

export const NATAL = {
  name: 'Melissa',
  birth: '1997-10-17T06:30:00-04:00', // Valencia, Venezuela (VET)
  lat: 10.162,
  lon: -68.0077,
  placements: {
    Sun: ['Libra', 24.08],
    Moon: ['Taurus', 11.9],
    Mercury: ['Libra', 26.57],
    Venus: ['Sagittarius', 10.03],
    Mars: ['Sagittarius', 13.17],
    Jupiter: ['Aquarius', 12.23],
    Saturn: ['Aries', 16.33], // retrograde
    Uranus: ['Aquarius', 4.73],
    Neptune: ['Capricorn', 27.18],
    Pluto: ['Sagittarius', 3.93],
    NorthNode: ['Virgo', 17.72], // retrograde
    Ascendant: ['Libra', 25.53],
    Midheaven: ['Cancer', 23.58],
  },
}

// Absolute ecliptic longitude (0–360) for a [sign, degree] placement.
export function toLongitude(sign, degree) {
  return SIGNS.indexOf(sign) * 30 + degree
}

// Precomputed natal longitudes keyed by point name.
export const NATAL_LONGITUDES = Object.fromEntries(
  Object.entries(NATAL.placements).map(([k, [sign, deg]]) => [k, toLongitude(sign, deg)]),
)

// Natal longitudes with sign overrides for chosen points (keeps each point's
// original degree, just swaps its sign). Used to personalize Sun/Moon/Ascendant.
export function natalLongitudesWith(overrides = {}) {
  const out = { ...NATAL_LONGITUDES }
  Object.entries(overrides).forEach(([point, sign]) => {
    if (!sign || !SIGNS.includes(sign)) return
    const orig = NATAL.placements[point]
    out[point] = toLongitude(sign, orig ? orig[1] : 15)
  })
  return out
}

export function signOf(longitude) {
  const l = ((longitude % 360) + 360) % 360
  return SIGNS[Math.floor(l / 30)]
}

export function degreeInSign(longitude) {
  const l = ((longitude % 360) + 360) % 360
  return l % 30
}
