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
// These were set in letterspaced mono for a long time, on the argument that
// sixty marks would be sixty chances to look like a bank. Drawn to the pillar
// marks' rules — 24-unit square, outline, circles, lines and
// diagonals only — they are not, and a wall of them is how you choose. The
// drawings live in components/shared/assetMarks.jsx, keyed on the ids below; a
// class that belongs to a pillar wears that pillar's mark instead of a second
// drawing of the same idea.

const f = (k, l, t = 'text') => ({ k, l, t })

export const ASSET_GROUPS = [
  {
    id: 'worn',
    // The section is the Wardrobe; the shelves inside it are Ready to wear,
    // Outerwear, Shoes and the rest. That is the word doing the work it is
    // actually good at — naming the whole of what she wears, not one rail of it.
    label: 'Wardrobe',
    classes: [
      // The id stays `wardrobe`: it is what every list she already has is filed
      // under, and a label is a label.
      { id: 'wardrobe', label: 'Ready to wear', about: 'Dresses, tops, trousers, skirts, knitwear, suiting. The clothes everything else goes over or under.', sized: true, fields: [f('brand', 'Brand'), f('size', 'Size'), f('colour', 'Colour'), f('season', 'Season'), f('category', 'Category'), f('worn', 'Worn', 'count')] },
      { id: 'outerwear', label: 'Outerwear', about: 'Coats, jackets, trench, puffer, a blazer worn as a layer. Anything that goes on last.', sized: true, fields: [f('brand', 'Brand'), f('size', 'Size'), f('season', 'Season'), f('warmth', 'Warmth'), f('worn', 'Worn', 'count')] },
      { id: 'shoes', label: 'Shoes', about: 'Heels, flats, boots, trainers, sandals. What needs resoling and how often you actually wear it.', sized: true, fields: [f('brand', 'Brand'), f('size', 'Size'), f('heel', 'Heel height'), f('occasion', 'Occasion'), f('resole', 'Resole due', 'date'), f('worn', 'Worn', 'count')] },
      { id: 'bags', label: 'Bags', about: 'Totes, shoulder bags, clutches, luggage. What you paid and what it is worth now.', fields: [f('brand', 'Brand'), f('size', 'Size'), f('material', 'Material'), f('occasion', 'Occasion'), f('resale', 'Resale value', 'money')] },
      // Where socks live, and hats, belts, scarves and hair. One shelf rather
      // than five thin ones, which is how a department store files hosiery too.
      { id: 'accessories', label: 'Accessories', about: 'Hats, belts, scarves, gloves, socks and tights, hair clips and bows.', sized: true, fields: [f('kind', 'Hat · belt · scarf · socks · hair'), f('brand', 'Brand'), f('size', 'Size'), f('material', 'Material'), f('occasion', 'Occasion')] },
      { id: 'jewellery', label: 'Jewellery', about: 'Fine and costume. Metal, stone, what it was valued at and when it was last appraised.', sized: true, fields: [f('metal', 'Metal'), f('stone', 'Stone'), f('carat', 'Carat'), f('occasion', 'Occasion'), f('insured', 'Insured', 'bool'), f('valuation', 'Valuation', 'money'), f('appraised', 'Appraised', 'date')] },
      { id: 'watches', label: 'Watches', about: 'The reference, the movement, and when the service is due.', fields: [f('brand', 'Brand'), f('reference', 'Reference'), f('movement', 'Movement'), f('service', 'Service due', 'date'), f('valuation', 'Valuation', 'money')] },
      { id: 'eyewear', label: 'Eyewear', about: 'Glasses and sunglasses. Prescriptions, lens type, and your last eye test.', fields: [f('brand', 'Brand'), f('prescription', 'Prescription'), f('lens', 'Lens type'), f('eyetest', 'Last eye test', 'date')] },
      { id: 'lingerie', label: 'Lingerie', about: 'Bras, briefs, slips, shapewear. What is wearing out and when to replace it.', sized: true, fields: [f('brand', 'Brand'), f('size', 'Size'), f('category', 'Category'), f('replace', 'Replace by', 'date')] },
      { id: 'sleepwear', label: 'Sleepwear', about: 'Slips, pyjama sets, robes. What you sleep in and what you answer the door in.', sized: true, fields: [f('brand', 'Brand'), f('size', 'Size'), f('kind', 'Slip · set · robe'), f('material', 'Material'), f('season', 'Season'), f('worn', 'Worn', 'count')] },
      { id: 'activewear', label: 'Activewear', about: 'Leggings, sports bras, kit for a particular sport. How many washes it has had.', sized: true, fields: [f('brand', 'Brand'), f('size', 'Size'), f('sport', 'Sport'), f('washes', 'Washes', 'count')] },
      { id: 'swim', label: 'Swim', about: 'One-pieces, bikinis, cover-ups. And the trip you are buying it for.', sized: true, fields: [f('brand', 'Brand'), f('size', 'Size'), f('kind', 'One-piece · bikini'), f('colour', 'Colour'), f('trip', 'For'), f('worn', 'Worn', 'count')] },
      // The one gap the app makes for itself: it already knows the stage, and
      // until now it had nowhere to put the clothes the stage needs.
      { id: 'maternity', label: 'Maternity', about: 'Clothes for pregnancy, nursing and the months after. Which stage, and whether it opens.', sized: true, fields: [f('brand', 'Brand'), f('size', 'Size'), f('stage', 'Pregnancy · nursing · postpartum'), f('trimester', 'Trimester'), f('nursing', 'Nursing access', 'bool'), f('worn', 'Worn', 'count')] },
      { id: 'vintage', label: 'Vintage & archive', about: 'Secondhand, archive and inherited. Where it came from, its condition and its era.', fields: [f('provenance', 'Provenance'), f('condition', 'Condition'), f('era', 'Era'), f('valuation', 'Valuation', 'money')] },
    ],
  },
  {
    id: 'used',
    label: 'Personal — used',
    classes: [
      { id: 'skincare', label: 'Skincare', about: 'Cleansers, serums, creams, SPF. When it was opened and how long it keeps.', pillar: 'skincare', fields: [f('step', 'Step'), f('opened', 'Opened', 'date'), f('pao', 'PAO (months)', 'num'), f('actives', 'Actives'), f('repurchased', 'Repurchased', 'count')] },
      { id: 'haircare', label: 'Haircare', about: 'Shampoo, masks, oils, anything you use on your hair.', pillar: 'haircare', fields: [f('goal', 'Hair goal'), f('opened', 'Opened', 'date'), f('repurchased', 'Repurchased', 'count')] },
      { id: 'makeup', label: 'Makeup', about: 'Base, colour, brushes. Shades, finishes, and how old it is.', fields: [f('shade', 'Shade'), f('finish', 'Finish'), f('opened', 'Opened', 'date'), f('pao', 'PAO (months)', 'num')] },
      { id: 'fragrance', label: 'Fragrance', about: 'Perfume and body mist. The house, the notes, and the season it suits.', fields: [f('house', 'House'), f('notes', 'Notes'), f('size', 'Size'), f('season', 'Season'), f('decant', 'Decant', 'bool')] },
      { id: 'bodycare', label: 'Bodycare', about: 'Body wash, lotion, hand cream, deodorant.', pillar: 'bodycare', fields: [f('opened', 'Opened', 'date'), f('repurchased', 'Repurchased', 'count')] },
      { id: 'devices', label: 'Tools & devices', about: 'Hair tools, cleansing devices, red light. Anything with a head or a filter to replace.', fields: [f('kind', 'Kind'), f('warranty', 'Warranty until', 'date'), f('replacement', 'Head / filter due', 'date'), f('lastused', 'Last used', 'date')] },
      { id: 'supplements', label: 'Supplements', about: 'Vitamins, minerals, powders. The dose, the servings left, and when to reorder.', pillar: 'nutrition', fields: [f('dose', 'Dose'), f('form', 'Form'), f('brand', 'Brand'), f('protocol', 'Linked protocol'), f('servings', 'Servings left', 'num'), f('reorder', 'Reorder by', 'date')] },
      { id: 'medication', label: 'Medication', about: 'Prescriptions and over the counter. Doses, refills and interactions.', fields: [f('dose', 'Dose'), f('prescriber', 'Prescriber'), f('refill', 'Refill by', 'date'), f('interactions', 'Interaction notes')] },
    ],
  },
  {
    id: 'services',
    label: 'Health — services',
    classes: [
      { id: 'treatments', label: 'Treatments', about: 'Facials, injectables, lasers, massage. The interval and the downtime.', pillar: 'aesthetics', fields: [f('provider', 'Provider'), f('interval', 'Interval'), f('lastdone', 'Last done', 'date'), f('nextdue', 'Next due', 'date'), f('downtime', 'Downtime')] },
      { id: 'practitioners', label: 'Practitioners', about: 'Doctors, dentists, dermatologists, therapists. Who they are and when you last went.', fields: [f('specialty', 'Specialty'), f('location', 'Location'), f('lastseen', 'Last seen', 'date'), f('nextdue', 'Next due', 'date'), f('referral', 'Referred by')] },
      { id: 'labs', label: 'Testing & labs', about: 'Blood panels, imaging, screening. What was run and when to run it again.', pillar: 'diagnostics', fields: [f('panel', 'Panel'), f('provider', 'Provider'), f('lastrun', 'Last run', 'date'), f('retest', 'Retest interval')] },
      { id: 'memberships', label: 'Memberships', about: 'Gyms, studios, clubs, clinics. When it renews and how much you go.', fields: [f('kind', 'Gym · studio · clinic'), f('renewal', 'Renews', 'date'), f('visits', 'Visits', 'count')] },
      { id: 'courses', label: 'Programmes & courses', about: 'Programmes, trainings and courses. When it starts and whether you finished it.', fields: [f('provider', 'Provider'), f('start', 'Starts', 'date'), f('completed', 'Completed', 'date')] },
    ],
  },
  {
    id: 'home',
    label: 'Home',
    classes: [
      { id: 'furniture', label: 'Furniture', about: 'Sofas, beds, tables, chairs. Dimensions, lead times, and what is on order.', fields: [f('room', 'Room'), f('dimensions', 'Dimensions'), f('material', 'Material'), f('leadtime', 'Lead time'), f('ordered', 'Ordered', 'date'), f('delivered', 'Delivered', 'date'), f('warranty', 'Warranty until', 'date')] },
      { id: 'lighting', label: 'Lighting', about: 'Lamps, pendants, sconces. The room, the bulb, and the size.', fields: [f('room', 'Room'), f('bulb', 'Bulb type'), f('dimensions', 'Dimensions')] },
      { id: 'appliances', label: 'Kitchen & appliances', about: 'Ovens, fridges, coffee machines, small appliances. Warranties, services and filters.', fields: [f('brand', 'Brand'), f('model', 'Model'), f('warranty', 'Warranty until', 'date'), f('service', 'Service due', 'date'), f('filter', 'Filter due', 'date')] },
      { id: 'tableware', label: 'Tableware & glassware', about: 'Plates, glasses, cutlery, serving pieces. How many you have and where to replace them.', fields: [f('setcount', 'Set count', 'num'), f('source', 'Replacement source')] },
      { id: 'linens', label: 'Linens & bedding', about: 'Sheets, towels, duvets, blankets. Sizes and when to replace them.', sized: true, fields: [f('room', 'Room'), f('size', 'Size'), f('material', 'Material'), f('replace', 'Replace by', 'date')] },
      { id: 'art', label: 'Art & objects', about: 'Paintings, prints, photographs, objects. Artist, edition, provenance and value.', fields: [f('artist', 'Artist'), f('edition', 'Edition'), f('provenance', 'Provenance'), f('valuation', 'Valuation', 'money'), f('insured', 'Insured', 'bool')] },
      { id: 'rugs', label: 'Rugs & textiles', about: 'Rugs, throws, curtains, cushions. Sizes and when they were last cleaned.', fields: [f('room', 'Room'), f('dimensions', 'Dimensions'), f('material', 'Material'), f('cleaned', 'Cleaned', 'date')] },
      { id: 'books', label: 'Books', about: 'Books to buy, borrow or read. Author, source, and where you are with it.', fields: [f('author', 'Author'), f('status', 'Status'), f('source', 'Source')] },
      { id: 'plants', label: 'Plants', about: 'Houseplants and pots. Light, watering, and when to repot.', fields: [f('room', 'Room'), f('light', 'Light'), f('water', 'Water every'), f('repot', 'Repot', 'date')] },
      { id: 'renovation', label: 'Renovation & materials', about: 'Tiles, paint, fittings, timber, trades. Quotes and lead times.', fields: [f('room', 'Room'), f('trade', 'Trade'), f('quote', 'Quote', 'money'), f('leadtime', 'Lead time'), f('ordered', 'Ordered', 'date')] },
      { id: 'maintenance', label: 'Tools & maintenance', about: 'Tools, filters, servicing. Anything the house needs doing to it on a schedule.', fields: [f('interval', 'Service interval'), f('warranty', 'Warranty until', 'date')] },
    ],
  },
  {
    id: 'vehicles',
    label: 'Vehicles',
    classes: [
      { id: 'cars', label: 'Cars', about: 'Make, model, mileage. Service, MOT, insurance, and what it is worth.', fields: [f('make', 'Make'), f('model', 'Model'), f('year', 'Year'), f('reg', 'Registration'), f('mileage', 'Mileage', 'num'), f('service', 'Service due', 'date'), f('mot', 'MOT', 'date'), f('insurance', 'Insurance renews', 'date'), f('valuation', 'Valuation', 'money')] },
      { id: 'bicycles', label: 'Bicycles', about: 'Bikes and frames. Frame size and when it was last serviced.', sized: true, fields: [f('brand', 'Brand'), f('size', 'Frame size'), f('service', 'Service', 'date')] },
      { id: 'othervehicles', label: 'Other vehicles', about: 'Boats, motorbikes, anything else with a registration and somewhere to keep it.', fields: [f('kind', 'Boat · motorbike'), f('reg', 'Registration'), f('service', 'Service', 'date'), f('insurance', 'Insurance renews', 'date'), f('storage', 'Mooring / storage')] },
    ],
  },
  {
    id: 'money',
    label: 'Assets and money',
    classes: [
      { id: 'property', label: 'Property', about: 'Homes and land. Purchase price, valuation, mortgage and insurance renewals.', fields: [f('address', 'Address'), f('purchase', 'Purchase price', 'money'), f('valuation', 'Valuation', 'money'), f('mortgage', 'Mortgage renews', 'date'), f('insurance', 'Insurance renews', 'date'), f('works', 'Works due')] },
      { id: 'investments', label: 'Investments', about: 'Holdings of any kind. What it is, how long you have held it, what it is worth.', fields: [f('kind', 'Type'), f('since', 'Held since', 'date'), f('value', 'Value', 'money')] },
      { id: 'collectibles', label: 'Collectibles', about: 'Watches, wine, art, handbags held as assets. Provenance and valuation.', fields: [f('category', 'Category'), f('provenance', 'Provenance'), f('valuation', 'Valuation', 'money'), f('insured', 'Insured', 'bool')] },
      { id: 'insurance', label: 'Insurance policies', about: 'Policies of every kind. Provider, premium, cover, and the renewal date.', fields: [f('kind', 'Type'), f('provider', 'Provider'), f('premium', 'Premium', 'money'), f('renewal', 'Renews', 'date'), f('cover', 'Cover')] },
      { id: 'subscriptions', label: 'Subscriptions', about: 'Everything that bills you again. When it renews and whether you use it.', fields: [f('service', 'Service'), f('renewal', 'Renews', 'date'), f('usage', 'Usage')] },
    ],
  },
  {
    id: 'life',
    label: 'Life and experience',
    classes: [
      { id: 'travel', label: 'Travel', about: 'Trips you want to take. Destination, season, dates, and whether it is booked.', fields: [f('destination', 'Destination'), f('season', 'Season'), f('booked', 'Booked', 'bool'), f('dates', 'Dates')] },
      { id: 'restaurants', label: 'Restaurants & bars', about: 'Restaurants and bars to try. City, occasion, and whether you have been.', fields: [f('city', 'City'), f('occasion', 'Occasion'), f('booked', 'Booked', 'bool'), f('been', 'Been', 'bool')] },
      { id: 'places', label: 'Places to see', about: 'Museums, galleries, buildings, views. Anywhere worth going to see.', fields: [f('city', 'City'), f('kind', 'Type'), f('been', 'Been', 'bool')] },
      { id: 'recipes', label: 'Recipes', about: 'Recipes to cook. Where it came from and how many times you have made it.', pillar: 'nutrition', fields: [f('source', 'Source'), f('occasion', 'Occasion'), f('cooked', 'Cooked', 'count')] },
      { id: 'wine', label: 'Wine & spirits', about: 'Bottles to buy or keep. Producer, vintage, drinking window, and where it is stored.', fields: [f('producer', 'Producer'), f('vintage', 'Vintage'), f('window', 'Drink window'), f('stored', 'Stored')] },
      { id: 'events', label: 'Events & tickets', about: 'Concerts, shows, matches. The date, the venue, and whether you have tickets.', fields: [f('date', 'Date', 'date'), f('venue', 'Venue'), f('booked', 'Booked', 'bool')] },
      { id: 'gifts', label: 'Gifts', about: 'Presents to give. Who it is for, the occasion, and whether it has been given.', fields: [f('recipient', 'For'), f('occasion', 'Occasion'), f('given', 'Given', 'date')] },
    ],
  },
  {
    id: 'work',
    label: 'Work and craft',
    classes: [
      { id: 'tech', label: 'Tech & devices', about: 'Laptops, phones, screens, peripherals. Warranties and when you replace them.', fields: [f('model', 'Model'), f('warranty', 'Warranty until', 'date'), f('cycle', 'Replacement cycle')] },
      { id: 'stationery', label: 'Stationery & supplies', about: 'Paper, pens, notebooks, desk supplies. And when to reorder.', fields: [f('reorder', 'Reorder by', 'date')] },
      { id: 'equipment', label: 'Equipment', about: 'Cameras, instruments, machines. Servicing, and whether it is insured.', fields: [f('model', 'Model'), f('service', 'Service', 'date'), f('insured', 'Insured', 'bool')] },
      { id: 'software', label: 'Software & tools', about: 'Tools and licences. When it renews and whether you still use it.', fields: [f('renewal', 'Renews', 'date'), f('usage', 'Usage')] },
    ],
  },
  {
    id: 'people',
    label: 'People',
    classes: [
      { id: 'circle', label: 'Circle', about: 'The people you keep up with. Birthdays, last contact, and what matters to them.', pillar: 'relationship', fields: [f('relationship', 'Relationship'), f('lastcontact', 'Last contact', 'date'), f('birthday', 'Birthday', 'date'), f('notes', 'Notes')] },
      { id: 'vendors', label: 'Vendors & services', about: 'Cleaners, plumbers, tailors, stylists. Who you use and how they were.', fields: [f('trade', 'Trade'), f('lastused', 'Last used', 'date'), f('rating', 'Rating')] },
      { id: 'gifting', label: 'Gifting register', about: 'Sizes, ideas, and what you have already given, person by person.', sized: true, fields: [f('person', 'Person'), f('ideas', 'Ideas'), f('history', 'Given before'), f('size', 'Sizes')] },
    ],
  },
]

export const ASSET_CLASSES = ASSET_GROUPS.flatMap((g) => g.classes.map((c) => ({ ...c, group: g.id, groupLabel: g.label })))
export const CLASS_BY_ID = ASSET_CLASSES.reduce((m, c) => { m[c.id] = c; return m }, {})

// ── Topics she made herself.
//
// The sixty above are a starting set, not a fixture: she can take a shelf off
// the wall and put one up. A shelf she invents has no drawing and no opinion
// about its fields, so it gets the four that suit nearly anything a person buys.
// They live in her own row in the store and are registered here so that every
// existing caller of classMeta keeps working without knowing they exist.
export const CUSTOM_FIELDS = [f('brand', 'Brand'), f('size', 'Size'), f('material', 'Material'), f('occasion', 'Occasion')]
let CUSTOM = {}
export function setCustomClasses(list) {
  const next = {}
  ;(Array.isArray(list) ? list : []).forEach((c) => {
    if (c && c.id) next[c.id] = { fields: CUSTOM_FIELDS, sized: true, ...c, custom: true }
  })
  CUSTOM = next
}
export const customClasses = () => Object.values(CUSTOM)

export const classMeta = (id) => CLASS_BY_ID[id] || CUSTOM[id] || { id: 'wardrobe', label: 'Ready to wear', about: 'Dresses, tops, trousers, skirts, knitwear, suiting. The clothes everything else goes over or under.', fields: [] }

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
