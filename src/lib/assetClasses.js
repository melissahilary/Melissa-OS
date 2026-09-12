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
      { id: 'wardrobe', label: 'Ready to wear', about: 'Dresses, tops, trousers, jeans, skirts, knitwear, shirts, suiting.', sized: true, fields: [f('brand', 'Brand'), f('size', 'Size'), f('colour', 'Colour'), f('season', 'Season'), f('category', 'Category'), f('worn', 'Worn', 'count')] },
      { id: 'outerwear', label: 'Outerwear', about: 'Coats, jackets, trench, puffer, parka, blazers, capes, vests.', sized: true, fields: [f('brand', 'Brand'), f('size', 'Size'), f('season', 'Season'), f('warmth', 'Warmth'), f('worn', 'Worn', 'count')] },
      { id: 'shoes', label: 'Shoes', about: 'Heels, flats, boots, trainers, sandals, loafers, slippers.', sized: true, fields: [f('brand', 'Brand'), f('size', 'Size'), f('heel', 'Heel height'), f('occasion', 'Occasion'), f('resole', 'Resole due', 'date'), f('worn', 'Worn', 'count')] },
      { id: 'bags', label: 'Bags', about: 'Totes, shoulder bags, clutches, crossbody, backpacks, luggage, wallets.', fields: [f('brand', 'Brand'), f('size', 'Size'), f('material', 'Material'), f('occasion', 'Occasion'), f('resale', 'Resale value', 'money')] },
      // Where socks live, and hats, belts, scarves and hair. One shelf rather
      // than five thin ones, which is how a department store files hosiery too.
      { id: 'accessories', label: 'Accessories', about: 'Hats, caps, belts, scarves, gloves, socks, tights, hair clips, bows.', sized: true, fields: [f('kind', 'Hat · belt · scarf · socks · hair'), f('brand', 'Brand'), f('size', 'Size'), f('material', 'Material'), f('occasion', 'Occasion')] },
      { id: 'jewellery', label: 'Jewellery', about: 'Earrings, necklaces, rings, bracelets, brooches, anklets, charms.', sized: true, fields: [f('metal', 'Metal'), f('stone', 'Stone'), f('carat', 'Carat'), f('occasion', 'Occasion'), f('insured', 'Insured', 'bool'), f('valuation', 'Valuation', 'money'), f('appraised', 'Appraised', 'date')] },
      { id: 'watches', label: 'Watches', about: 'Everyday watches, dress watches, vintage, straps, winders.', fields: [f('brand', 'Brand'), f('reference', 'Reference'), f('movement', 'Movement'), f('service', 'Service due', 'date'), f('valuation', 'Valuation', 'money')] },
      { id: 'eyewear', label: 'Eyewear', about: 'Glasses, sunglasses, readers, frames, contacts, cases.', fields: [f('brand', 'Brand'), f('prescription', 'Prescription'), f('lens', 'Lens type'), f('eyetest', 'Last eye test', 'date')] },
      { id: 'lingerie', label: 'Lingerie', about: 'Bras, briefs, thongs, slips, bodysuits, shapewear, garters.', sized: true, fields: [f('brand', 'Brand'), f('size', 'Size'), f('category', 'Category'), f('replace', 'Replace by', 'date')] },
      { id: 'sleepwear', label: 'Sleepwear', about: 'Slips, pajama sets, nightgowns, robes, kimonos, sleep masks, slippers.', sized: true, fields: [f('brand', 'Brand'), f('size', 'Size'), f('kind', 'Slip · set · robe'), f('material', 'Material'), f('season', 'Season'), f('worn', 'Worn', 'count')] },
      { id: 'activewear', label: 'Activewear', about: 'Leggings, sports bras, shorts, tanks, jackets, socks, ski kit, tennis kit.', sized: true, fields: [f('brand', 'Brand'), f('size', 'Size'), f('sport', 'Sport'), f('washes', 'Washes', 'count')] },
      { id: 'swim', label: 'Swim', about: 'One-pieces, bikinis, cover-ups, kaftans, sarongs, swim shorts, sun hats.', sized: true, fields: [f('brand', 'Brand'), f('size', 'Size'), f('kind', 'One-piece · bikini'), f('colour', 'Colour'), f('trip', 'For'), f('worn', 'Worn', 'count')] },
      // The one gap the app makes for itself: it already knows the stage, and
      // until now it had nowhere to put the clothes the stage needs.
      { id: 'maternity', label: 'Maternity', about: 'Bump dresses, nursing tops, maternity jeans, nursing bras, belly bands, postpartum leggings.', sized: true, fields: [f('brand', 'Brand'), f('size', 'Size'), f('stage', 'Pregnancy · nursing · postpartum'), f('trimester', 'Trimester'), f('nursing', 'Nursing access', 'bool'), f('worn', 'Worn', 'count')] },
    ],
  },
  {
    id: 'used',
    label: 'Personal — used',
    classes: [
      { id: 'skincare', label: 'Skincare', about: 'Cleansers, serums, creams, SPF, retinol, masks, eye cream, toners.', pillar: 'skincare', fields: [f('step', 'Step'), f('opened', 'Opened', 'date'), f('pao', 'PAO (months)', 'num'), f('actives', 'Actives'), f('repurchased', 'Repurchased', 'count')] },
      { id: 'haircare', label: 'Haircare', about: 'Shampoo, conditioner, masks, oils, heat protectant, dry shampoo, scalp treatments.', pillar: 'haircare', fields: [f('goal', 'Hair goal'), f('opened', 'Opened', 'date'), f('repurchased', 'Repurchased', 'count')] },
      { id: 'makeup', label: 'Makeup', about: 'Foundation, concealer, blush, lipstick, mascara, brows, brushes, setting spray.', fields: [f('shade', 'Shade'), f('finish', 'Finish'), f('opened', 'Opened', 'date'), f('pao', 'PAO (months)', 'num')] },
      { id: 'fragrance', label: 'Fragrance', about: 'Eau de parfum, eau de toilette, body mist, oils, decants, travel sprays.', fields: [f('house', 'House'), f('notes', 'Notes'), f('size', 'Size'), f('season', 'Season'), f('decant', 'Decant', 'bool')] },
      { id: 'bodycare', label: 'Bodycare', about: 'Body wash, lotion, hand cream, deodorant, scrubs, body oil, SPF.', pillar: 'bodycare', fields: [f('opened', 'Opened', 'date'), f('repurchased', 'Repurchased', 'count')] },
      { id: 'devices', label: 'Tools & devices', about: 'Hair dryers, straighteners, curlers, cleansing brushes, red light, microcurrent, razors.', fields: [f('kind', 'Kind'), f('warranty', 'Warranty until', 'date'), f('replacement', 'Head / filter due', 'date'), f('lastused', 'Last used', 'date')] },
      { id: 'supplements', label: 'Supplements', about: 'Vitamins, minerals, collagen, protein, probiotics, omega, adaptogens, powders.', pillar: 'nutrition', fields: [f('dose', 'Dose'), f('form', 'Form'), f('brand', 'Brand'), f('protocol', 'Linked protocol'), f('servings', 'Servings left', 'num'), f('reorder', 'Reorder by', 'date')] },
      { id: 'medication', label: 'Medication', about: 'Prescriptions, over the counter, inhalers, creams, allergy, pain relief.', fields: [f('dose', 'Dose'), f('prescriber', 'Prescriber'), f('refill', 'Refill by', 'date'), f('interactions', 'Interaction notes')] },
    ],
  },
  {
    id: 'services',
    label: 'Health — services',
    classes: [
      { id: 'treatments', label: 'Treatments', about: 'Facials, injectables, laser, microneedling, peels, massage, lymphatic, waxing.', pillar: 'aesthetics', fields: [f('provider', 'Provider'), f('interval', 'Interval'), f('lastdone', 'Last done', 'date'), f('nextdue', 'Next due', 'date'), f('downtime', 'Downtime')] },
      { id: 'practitioners', label: 'Practitioners', about: 'Doctor, dentist, dermatologist, OB-GYN, physio, therapist, nutritionist, trainer.', fields: [f('specialty', 'Specialty'), f('location', 'Location'), f('lastseen', 'Last seen', 'date'), f('nextdue', 'Next due', 'date'), f('referral', 'Referred by')] },
      { id: 'labs', label: 'Testing & labs', about: 'Blood panels, hormone panels, thyroid, vitamin D, pap smear, scans, DNA, allergy tests.', pillar: 'diagnostics', fields: [f('panel', 'Panel'), f('provider', 'Provider'), f('lastrun', 'Last run', 'date'), f('retest', 'Retest interval')] },
      { id: 'memberships', label: 'Memberships', about: 'Gym, pilates, yoga, tennis club, spa, clinic, co-working, members clubs.', fields: [f('kind', 'Gym · studio · clinic'), f('renewal', 'Renews', 'date'), f('visits', 'Visits', 'count')] },
      { id: 'courses', label: 'Programmes & courses', about: 'Courses, certifications, trainings, retreats, workshops, coaching, language classes.', fields: [f('provider', 'Provider'), f('start', 'Starts', 'date'), f('completed', 'Completed', 'date')] },
    ],
  },
  {
    id: 'home',
    label: 'Home',
    classes: [
      { id: 'furniture', label: 'Furniture', about: 'Sofas, beds, tables, chairs, desks, dressers, shelving, mirrors.', fields: [f('room', 'Room'), f('dimensions', 'Dimensions'), f('material', 'Material'), f('leadtime', 'Lead time'), f('ordered', 'Ordered', 'date'), f('delivered', 'Delivered', 'date'), f('warranty', 'Warranty until', 'date')] },
      { id: 'lighting', label: 'Lighting', about: 'Pendants, lamps, sconces, floor lamps, bulbs, dimmers, candles.', fields: [f('room', 'Room'), f('bulb', 'Bulb type'), f('dimensions', 'Dimensions')] },
      { id: 'appliances', label: 'Kitchen & appliances', about: 'Oven, fridge, dishwasher, coffee machine, blender, kettle, air purifier, vacuum.', fields: [f('brand', 'Brand'), f('model', 'Model'), f('warranty', 'Warranty until', 'date'), f('service', 'Service due', 'date'), f('filter', 'Filter due', 'date')] },
      { id: 'tableware', label: 'Tableware & glassware', about: 'Plates, bowls, glasses, cutlery, serving dishes, vases, decanters, candlesticks.', fields: [f('setcount', 'Set count', 'num'), f('source', 'Replacement source')] },
      { id: 'linens', label: 'Linens & bedding', about: 'Sheets, duvets, pillows, towels, bathrobes, blankets, throws, table linen.', sized: true, fields: [f('room', 'Room'), f('size', 'Size'), f('material', 'Material'), f('replace', 'Replace by', 'date')] },
      { id: 'art', label: 'Art & objects', about: 'Paintings, prints, photographs, sculpture, ceramics, frames, objects.', fields: [f('artist', 'Artist'), f('edition', 'Edition'), f('provenance', 'Provenance'), f('valuation', 'Valuation', 'money'), f('insured', 'Insured', 'bool')] },
      { id: 'rugs', label: 'Rugs & textiles', about: 'Rugs, runners, curtains, blinds, cushions, throws, upholstery fabric.', fields: [f('room', 'Room'), f('dimensions', 'Dimensions'), f('material', 'Material'), f('cleaned', 'Cleaned', 'date')] },
      { id: 'books', label: 'Books', about: 'Fiction, non-fiction, cookbooks, coffee table books, reference, audiobooks.', fields: [f('author', 'Author'), f('status', 'Status'), f('source', 'Source')] },
      { id: 'plants', label: 'Plants', about: 'Houseplants, planters, pots, soil, plant food, watering cans, cuttings.', fields: [f('room', 'Room'), f('light', 'Light'), f('water', 'Water every'), f('repot', 'Repot', 'date')] },
      { id: 'renovation', label: 'Renovation & materials', about: 'Tiles, paint, flooring, taps, worktops, hardware, timber, trades.', fields: [f('room', 'Room'), f('trade', 'Trade'), f('quote', 'Quote', 'money'), f('leadtime', 'Lead time'), f('ordered', 'Ordered', 'date')] },
      { id: 'maintenance', label: 'Tools & maintenance', about: 'Tools, filters, boiler service, gutters, chimney, pest control, key cutting.', fields: [f('interval', 'Service interval'), f('warranty', 'Warranty until', 'date')] },
    ],
  },
  {
    id: 'vehicles',
    label: 'Vehicles',
    classes: [
      { id: 'cars', label: 'Cars', about: 'Cars, leases, tires, servicing, insurance, detailing, parking, chargers.', fields: [f('make', 'Make'), f('model', 'Model'), f('year', 'Year'), f('reg', 'Registration'), f('mileage', 'Mileage', 'num'), f('service', 'Service due', 'date'), f('mot', 'MOT', 'date'), f('insurance', 'Insurance renews', 'date'), f('valuation', 'Valuation', 'money')] },
      { id: 'bicycles', label: 'Bicycles', about: 'Road bikes, e-bikes, helmets, locks, lights, racks, servicing.', sized: true, fields: [f('brand', 'Brand'), f('size', 'Frame size'), f('service', 'Service', 'date')] },
      // The id stays `othervehicles`: it is what anything already filed here
      // is keyed to, and a label is a label.
      { id: 'othervehicles', label: 'Boats', about: 'Boats, tenders, yachts, dinghies, jet skis, moorings, trailers, winter storage.', fields: [f('kind', 'Sail · motor · tender'), f('length', 'Length'), f('reg', 'Registration'), f('service', 'Service', 'date'), f('insurance', 'Insurance renews', 'date'), f('storage', 'Mooring / storage')] },
      // Renaming the catch-all to Boats left these without a shelf, and a
      // motorbike is not a boat.
      { id: 'motorbikes', label: 'Motorbikes', about: 'Motorbikes, scooters, mopeds, helmets, leathers, servicing, insurance.', fields: [f('make', 'Make'), f('model', 'Model'), f('year', 'Year'), f('reg', 'Registration'), f('mileage', 'Mileage', 'num'), f('service', 'Service due', 'date'), f('insurance', 'Insurance renews', 'date')] },
    ],
  },
  {
    id: 'money',
    label: 'Assets and money',
    classes: [
      { id: 'property', label: 'Property', about: 'Homes, apartments, land, garages, rentals, mortgages, ground rent, insurance.', fields: [f('address', 'Address'), f('purchase', 'Purchase price', 'money'), f('valuation', 'Valuation', 'money'), f('mortgage', 'Mortgage renews', 'date'), f('insurance', 'Insurance renews', 'date'), f('works', 'Works due')] },
      { id: 'investments', label: 'Investments', about: 'Stocks, funds, bonds, retirement accounts, crypto, private equity, savings.', fields: [f('kind', 'Type'), f('since', 'Held since', 'date'), f('value', 'Value', 'money')] },
      { id: 'collectibles', label: 'Collectibles', about: 'Watches, wine, art, handbags, coins, cars, first editions, sneakers.', fields: [f('category', 'Category'), f('provenance', 'Provenance'), f('valuation', 'Valuation', 'money'), f('insured', 'Insured', 'bool')] },
      { id: 'insurance', label: 'Insurance policies', about: 'Home, contents, car, travel, health, life, jewelry, pet.', fields: [f('kind', 'Type'), f('provider', 'Provider'), f('premium', 'Premium', 'money'), f('renewal', 'Renews', 'date'), f('cover', 'Cover')] },
      { id: 'subscriptions', label: 'Subscriptions', about: 'Streaming, software, news, delivery boxes, cloud storage, memberships, apps.', fields: [f('service', 'Service'), f('renewal', 'Renews', 'date'), f('usage', 'Usage')] },
    ],
  },
  {
    id: 'life',
    label: 'Life and experience',
    classes: [
      { id: 'travel', label: 'Travel', about: 'Trips, flights, hotels, villas, cruises, road trips, weekends away.', fields: [f('destination', 'Destination'), f('season', 'Season'), f('booked', 'Booked', 'bool'), f('dates', 'Dates')] },
      { id: 'restaurants', label: 'Restaurants & bars', about: 'Restaurants, bars, wine bars, cafes, bakeries, supper clubs, pop-ups.', fields: [f('city', 'City'), f('occasion', 'Occasion'), f('booked', 'Booked', 'bool'), f('been', 'Been', 'bool')] },
      { id: 'places', label: 'Places to see', about: 'Museums, galleries, gardens, churches, viewpoints, markets, neighborhoods.', fields: [f('city', 'City'), f('kind', 'Type'), f('been', 'Been', 'bool')] },
      { id: 'recipes', label: 'Recipes', about: 'Dinners, bakes, sauces, cocktails, batch cooking, sides, cakes.', pillar: 'nutrition', fields: [f('source', 'Source'), f('occasion', 'Occasion'), f('cooked', 'Cooked', 'count')] },
      { id: 'wine', label: 'Wine & spirits', about: 'Reds, whites, champagne, sake, spirits, vermouth, cases to lay down.', fields: [f('producer', 'Producer'), f('vintage', 'Vintage'), f('window', 'Drink window'), f('stored', 'Stored')] },
      { id: 'events', label: 'Events & tickets', about: 'Concerts, theater, opera, games, festivals, exhibitions, talks.', fields: [f('date', 'Date', 'date'), f('venue', 'Venue'), f('booked', 'Booked', 'bool')] },
      { id: 'gifts', label: 'Gifts', about: 'Birthdays, Christmas, weddings, new babies, housewarmings, thank yous, hosts.', fields: [f('recipient', 'For'), f('occasion', 'Occasion'), f('given', 'Given', 'date')] },
    ],
  },
  {
    id: 'work',
    label: 'Work and craft',
    classes: [
      { id: 'tech', label: 'Tech & devices', about: 'Laptops, phones, tablets, monitors, keyboards, headphones, chargers, cables.', fields: [f('model', 'Model'), f('warranty', 'Warranty until', 'date'), f('cycle', 'Replacement cycle')] },
      { id: 'stationery', label: 'Stationery & supplies', about: 'Notebooks, pens, paper, planners, folders, labels, ink, printer paper.', fields: [f('reorder', 'Reorder by', 'date')] },
      { id: 'equipment', label: 'Equipment', about: 'Cameras, lenses, lighting, microphones, tripods, instruments, machines.', fields: [f('model', 'Model'), f('service', 'Service', 'date'), f('insured', 'Insured', 'bool')] },
      { id: 'software', label: 'Software & tools', about: 'Subscriptions, licenses, plugins, fonts, templates, domains, hosting.', fields: [f('renewal', 'Renews', 'date'), f('usage', 'Usage')] },
    ],
  },
  {
    id: 'people',
    label: 'People',
    classes: [
      { id: 'circle', label: 'Circle', about: 'Family, close friends, godchildren, mentors, colleagues you keep up with.', pillar: 'relationship', fields: [f('relationship', 'Relationship'), f('lastcontact', 'Last contact', 'date'), f('birthday', 'Birthday', 'date'), f('notes', 'Notes')] },
      { id: 'vendors', label: 'Vendors & services', about: 'Cleaner, plumber, electrician, tailor, cobbler, hairdresser, florist, dog walker.', fields: [f('trade', 'Trade'), f('lastused', 'Last used', 'date'), f('rating', 'Rating')] },
      { id: 'gifting', label: 'Gifting register', about: 'Sizes, colors they wear, brands they love, what you have given before.', sized: true, fields: [f('person', 'Person'), f('ideas', 'Ideas'), f('history', 'Given before'), f('size', 'Sizes')] },
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

export const classMeta = (id) => CLASS_BY_ID[id] || CUSTOM[id] || { id: 'wardrobe', label: 'Ready to wear', about: 'Dresses, tops, trousers, jeans, skirts, knitwear, shirts, suiting.', fields: [] }

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
