// ── Asset classes.
//
// A wishlist that treats a coat, a dermatologist, a sofa and a car as the same
// row of text is why every wishlist product is useless after a fortnight. What
// you need to know about a coat is its cost per wear; about a serum, its
// period-after-opening; about a car, when the service is due. So the class is
// chosen first, and the class decides the fields.
//
// Field types: text · num · money · date · bool · count
//
// No glyphs. Asset classes are set in letterspaced mono rather than drawn —
// forty-eight marks would be forty-eight chances to look like a bank, and type
// translates and rescales where a drawing has to be redone.

const f = (k, l, t = 'text') => ({ k, l, t })

export const ASSET_GROUPS = [
  {
    id: 'worn',
    label: 'Personal — worn',
    classes: [
      { id: 'wardrobe', label: 'Wardrobe', sized: true, fields: [f('brand', 'Brand'), f('size', 'Size'), f('colour', 'Colour'), f('season', 'Season'), f('category', 'Category'), f('worn', 'Worn', 'count')] },
      { id: 'outerwear', label: 'Outerwear', sized: true, fields: [f('brand', 'Brand'), f('size', 'Size'), f('season', 'Season'), f('warmth', 'Warmth'), f('worn', 'Worn', 'count')] },
      { id: 'shoes', label: 'Shoes', sized: true, fields: [f('brand', 'Brand'), f('size', 'Size'), f('heel', 'Heel height'), f('occasion', 'Occasion'), f('resole', 'Resole due', 'date'), f('worn', 'Worn', 'count')] },
      { id: 'bags', label: 'Bags', fields: [f('brand', 'Brand'), f('size', 'Size'), f('material', 'Material'), f('occasion', 'Occasion'), f('resale', 'Resale value', 'money')] },
      { id: 'jewellery', label: 'Jewellery', sized: true, fields: [f('metal', 'Metal'), f('stone', 'Stone'), f('carat', 'Carat'), f('occasion', 'Occasion'), f('insured', 'Insured', 'bool'), f('valuation', 'Valuation', 'money'), f('appraised', 'Appraised', 'date')] },
      { id: 'watches', label: 'Watches', fields: [f('brand', 'Brand'), f('reference', 'Reference'), f('movement', 'Movement'), f('service', 'Service due', 'date'), f('valuation', 'Valuation', 'money')] },
      { id: 'eyewear', label: 'Eyewear', fields: [f('brand', 'Brand'), f('prescription', 'Prescription'), f('lens', 'Lens type'), f('eyetest', 'Last eye test', 'date')] },
      { id: 'lingerie', label: 'Lingerie', sized: true, fields: [f('brand', 'Brand'), f('size', 'Size'), f('category', 'Category'), f('replace', 'Replace by', 'date')] },
      { id: 'activewear', label: 'Activewear', sized: true, fields: [f('brand', 'Brand'), f('size', 'Size'), f('sport', 'Sport'), f('washes', 'Washes', 'count')] },
      { id: 'vintage', label: 'Vintage & archive', fields: [f('provenance', 'Provenance'), f('condition', 'Condition'), f('era', 'Era'), f('valuation', 'Valuation', 'money')] },
    ],
  },
  {
    id: 'used',
    label: 'Personal — used',
    classes: [
      { id: 'skincare', label: 'Skincare', pillar: 'skincare', fields: [f('step', 'Step'), f('opened', 'Opened', 'date'), f('pao', 'PAO (months)', 'num'), f('actives', 'Actives'), f('repurchased', 'Repurchased', 'count')] },
      { id: 'haircare', label: 'Haircare', pillar: 'haircare', fields: [f('goal', 'Hair goal'), f('opened', 'Opened', 'date'), f('repurchased', 'Repurchased', 'count')] },
      { id: 'makeup', label: 'Makeup', fields: [f('shade', 'Shade'), f('finish', 'Finish'), f('opened', 'Opened', 'date'), f('pao', 'PAO (months)', 'num')] },
      { id: 'fragrance', label: 'Fragrance', fields: [f('house', 'House'), f('notes', 'Notes'), f('size', 'Size'), f('season', 'Season'), f('decant', 'Decant', 'bool')] },
      { id: 'bodycare', label: 'Bodycare', pillar: 'bodycare', fields: [f('opened', 'Opened', 'date'), f('repurchased', 'Repurchased', 'count')] },
      { id: 'devices', label: 'Tools & devices', fields: [f('kind', 'Kind'), f('warranty', 'Warranty until', 'date'), f('replacement', 'Head / filter due', 'date'), f('lastused', 'Last used', 'date')] },
      { id: 'supplements', label: 'Supplements', pillar: 'nutrition', fields: [f('dose', 'Dose'), f('form', 'Form'), f('brand', 'Brand'), f('protocol', 'Linked protocol'), f('servings', 'Servings left', 'num'), f('reorder', 'Reorder by', 'date')] },
      { id: 'medication', label: 'Medication', fields: [f('dose', 'Dose'), f('prescriber', 'Prescriber'), f('refill', 'Refill by', 'date'), f('interactions', 'Interaction notes')] },
    ],
  },
  {
    id: 'services',
    label: 'Health — services',
    classes: [
      { id: 'treatments', label: 'Treatments', pillar: 'aesthetics', fields: [f('provider', 'Provider'), f('interval', 'Interval'), f('lastdone', 'Last done', 'date'), f('nextdue', 'Next due', 'date'), f('downtime', 'Downtime')] },
      { id: 'practitioners', label: 'Practitioners', fields: [f('specialty', 'Specialty'), f('location', 'Location'), f('lastseen', 'Last seen', 'date'), f('nextdue', 'Next due', 'date'), f('referral', 'Referred by')] },
      { id: 'labs', label: 'Testing & labs', pillar: 'diagnostics', fields: [f('panel', 'Panel'), f('provider', 'Provider'), f('lastrun', 'Last run', 'date'), f('retest', 'Retest interval')] },
      { id: 'memberships', label: 'Memberships', fields: [f('kind', 'Gym · studio · clinic'), f('renewal', 'Renews', 'date'), f('visits', 'Visits', 'count')] },
      { id: 'courses', label: 'Programmes & courses', fields: [f('provider', 'Provider'), f('start', 'Starts', 'date'), f('completed', 'Completed', 'date')] },
    ],
  },
  {
    id: 'home',
    label: 'Home',
    classes: [
      { id: 'furniture', label: 'Furniture', fields: [f('room', 'Room'), f('dimensions', 'Dimensions'), f('material', 'Material'), f('leadtime', 'Lead time'), f('ordered', 'Ordered', 'date'), f('delivered', 'Delivered', 'date'), f('warranty', 'Warranty until', 'date')] },
      { id: 'lighting', label: 'Lighting', fields: [f('room', 'Room'), f('bulb', 'Bulb type'), f('dimensions', 'Dimensions')] },
      { id: 'appliances', label: 'Kitchen & appliances', fields: [f('brand', 'Brand'), f('model', 'Model'), f('warranty', 'Warranty until', 'date'), f('service', 'Service due', 'date'), f('filter', 'Filter due', 'date')] },
      { id: 'tableware', label: 'Tableware & glassware', fields: [f('setcount', 'Set count', 'num'), f('source', 'Replacement source')] },
      { id: 'linens', label: 'Linens & bedding', sized: true, fields: [f('room', 'Room'), f('size', 'Size'), f('material', 'Material'), f('replace', 'Replace by', 'date')] },
      { id: 'art', label: 'Art & objects', fields: [f('artist', 'Artist'), f('edition', 'Edition'), f('provenance', 'Provenance'), f('valuation', 'Valuation', 'money'), f('insured', 'Insured', 'bool')] },
      { id: 'rugs', label: 'Rugs & textiles', fields: [f('room', 'Room'), f('dimensions', 'Dimensions'), f('material', 'Material'), f('cleaned', 'Cleaned', 'date')] },
      { id: 'books', label: 'Books', fields: [f('author', 'Author'), f('status', 'Status'), f('source', 'Source')] },
      { id: 'plants', label: 'Plants', fields: [f('room', 'Room'), f('light', 'Light'), f('water', 'Water every'), f('repot', 'Repot', 'date')] },
      { id: 'renovation', label: 'Renovation & materials', fields: [f('room', 'Room'), f('trade', 'Trade'), f('quote', 'Quote', 'money'), f('leadtime', 'Lead time'), f('ordered', 'Ordered', 'date')] },
      { id: 'maintenance', label: 'Tools & maintenance', fields: [f('interval', 'Service interval'), f('warranty', 'Warranty until', 'date')] },
    ],
  },
  {
    id: 'vehicles',
    label: 'Vehicles',
    classes: [
      { id: 'cars', label: 'Cars', fields: [f('make', 'Make'), f('model', 'Model'), f('year', 'Year'), f('reg', 'Registration'), f('mileage', 'Mileage', 'num'), f('service', 'Service due', 'date'), f('mot', 'MOT', 'date'), f('insurance', 'Insurance renews', 'date'), f('valuation', 'Valuation', 'money')] },
      { id: 'bicycles', label: 'Bicycles', sized: true, fields: [f('brand', 'Brand'), f('size', 'Frame size'), f('service', 'Service', 'date')] },
      { id: 'othervehicles', label: 'Other vehicles', fields: [f('kind', 'Boat · motorbike'), f('reg', 'Registration'), f('service', 'Service', 'date'), f('insurance', 'Insurance renews', 'date'), f('storage', 'Mooring / storage')] },
    ],
  },
  {
    id: 'money',
    label: 'Assets and money',
    classes: [
      { id: 'property', label: 'Property', fields: [f('address', 'Address'), f('purchase', 'Purchase price', 'money'), f('valuation', 'Valuation', 'money'), f('mortgage', 'Mortgage renews', 'date'), f('insurance', 'Insurance renews', 'date'), f('works', 'Works due')] },
      { id: 'investments', label: 'Investments', fields: [f('kind', 'Type'), f('since', 'Held since', 'date'), f('value', 'Value', 'money')] },
      { id: 'collectibles', label: 'Collectibles', fields: [f('category', 'Category'), f('provenance', 'Provenance'), f('valuation', 'Valuation', 'money'), f('insured', 'Insured', 'bool')] },
      { id: 'insurance', label: 'Insurance policies', fields: [f('kind', 'Type'), f('provider', 'Provider'), f('premium', 'Premium', 'money'), f('renewal', 'Renews', 'date'), f('cover', 'Cover')] },
      { id: 'subscriptions', label: 'Subscriptions', fields: [f('service', 'Service'), f('renewal', 'Renews', 'date'), f('usage', 'Usage')] },
    ],
  },
  {
    id: 'life',
    label: 'Life and experience',
    classes: [
      { id: 'travel', label: 'Travel', fields: [f('destination', 'Destination'), f('season', 'Season'), f('booked', 'Booked', 'bool'), f('dates', 'Dates')] },
      { id: 'restaurants', label: 'Restaurants & bars', fields: [f('city', 'City'), f('occasion', 'Occasion'), f('booked', 'Booked', 'bool'), f('been', 'Been', 'bool')] },
      { id: 'places', label: 'Places to see', fields: [f('city', 'City'), f('kind', 'Type'), f('been', 'Been', 'bool')] },
      { id: 'recipes', label: 'Recipes', pillar: 'nutrition', fields: [f('source', 'Source'), f('occasion', 'Occasion'), f('cooked', 'Cooked', 'count')] },
      { id: 'wine', label: 'Wine & spirits', fields: [f('producer', 'Producer'), f('vintage', 'Vintage'), f('window', 'Drink window'), f('stored', 'Stored')] },
      { id: 'events', label: 'Events & tickets', fields: [f('date', 'Date', 'date'), f('venue', 'Venue'), f('booked', 'Booked', 'bool')] },
      { id: 'gifts', label: 'Gifts', fields: [f('recipient', 'For'), f('occasion', 'Occasion'), f('given', 'Given', 'date')] },
    ],
  },
  {
    id: 'work',
    label: 'Work and craft',
    classes: [
      { id: 'tech', label: 'Tech & devices', fields: [f('model', 'Model'), f('warranty', 'Warranty until', 'date'), f('cycle', 'Replacement cycle')] },
      { id: 'stationery', label: 'Stationery & supplies', fields: [f('reorder', 'Reorder by', 'date')] },
      { id: 'equipment', label: 'Equipment', fields: [f('model', 'Model'), f('service', 'Service', 'date'), f('insured', 'Insured', 'bool')] },
      { id: 'software', label: 'Software & tools', fields: [f('renewal', 'Renews', 'date'), f('usage', 'Usage')] },
    ],
  },
  {
    id: 'people',
    label: 'People',
    classes: [
      { id: 'circle', label: 'Circle', pillar: 'relationship', fields: [f('relationship', 'Relationship'), f('lastcontact', 'Last contact', 'date'), f('birthday', 'Birthday', 'date'), f('notes', 'Notes')] },
      { id: 'vendors', label: 'Vendors & services', fields: [f('trade', 'Trade'), f('lastused', 'Last used', 'date'), f('rating', 'Rating')] },
      { id: 'gifting', label: 'Gifting register', sized: true, fields: [f('person', 'Person'), f('ideas', 'Ideas'), f('history', 'Given before'), f('size', 'Sizes')] },
    ],
  },
]

export const ASSET_CLASSES = ASSET_GROUPS.flatMap((g) => g.classes.map((c) => ({ ...c, group: g.id, groupLabel: g.label })))
export const CLASS_BY_ID = ASSET_CLASSES.reduce((m, c) => { m[c.id] = c; return m }, {})
export const classMeta = (id) => CLASS_BY_ID[id] || { id: 'wardrobe', label: 'Wardrobe', fields: [] }

// A size field is what makes a gift list actually work, so classes that have one
// say so and the share sheet offers it.
export const hasSizes = (id) => !!classMeta(id).sized

export const CURRENCIES = [
  { id: 'USD', sym: '$' },
  { id: 'GBP', sym: '£' },
  { id: 'EUR', sym: '€' },
]
export const symbolOf = (cur) => (CURRENCIES.find((c) => c.id === cur) || CURRENCIES[0]).sym

export const parseMoney = (v) => {
  const n = parseFloat(String(v == null ? '' : v).replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : null
}
export const fmtMoney = (v, cur = 'USD') => {
  const n = parseMoney(v)
  if (n == null) return ''
  return `${symbolOf(cur)}${n.toLocaleString(undefined, { maximumFractionDigits: n % 1 ? 2 : 0 })}`
}

// "Toteme wool coat £480" / "Khaite cashmere crew 320" — the way a person
// actually types a thing they want, rather than a form.
export function parseTyped(text, cur = 'USD') {
  const raw = String(text || '').trim()
  const syms = CURRENCIES.map((c) => c.sym).join('')
  const m = raw.match(new RegExp(`\\s*[${syms}]?\\s*([\\d][\\d,]*(?:\\.\\d{1,2})?)\\s*$`))
  if (!m) return { title: raw, price: '' }
  const price = m[1].replace(/,/g, '')
  const title = raw.slice(0, m.index).replace(/[·,\-–—]\s*$/, '').trim()
  return { title: title || raw, price }
}
