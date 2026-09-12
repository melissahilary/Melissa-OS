import React from 'react'
import Mark, { markFor } from './marks'

// ── The asset marks.
//
// Sixty of them, one per class on the wishlist, drawn to exactly the same
// rules as the twelve pillar marks: a 24-unit square, 1.5 units of optical
// padding, butt terminals, mitred joins, outline only, and nothing but circles,
// lines and diagonals on the half-unit grid. They name a class. They never
// illustrate a feeling — no faces, no leaves, no hearts, no droplets.
//
// Where a class already belongs to a pillar it wears that pillar's mark rather
// than a second drawing of the same idea, so the skincare row on the wishlist
// and the Skincare pillar are recognisably the same thing.

// ── Wardrobe ────────────────────────────────────────────────────────
export const WardrobeMark = (p) => <Mark {...p}><path d="M12 4.5v3" /><path d="M4.5 16.5 12 7.5l7.5 9Z" /></Mark>
export const OuterwearMark = (p) => <Mark {...p}><path d="M7.5 5.5h9l3 14h-15Z" /><path d="M12 5.5v14" /></Mark>
export const ShoesMark = (p) => <Mark {...p}><path d="M4.5 19.5v-13h4v9h11v4Z" /></Mark>
export const BagsMark = (p) => <Mark {...p}><path d="M5 9.5h14v10H5Z" /><path d="M9 9.5a3 3 0 0 1 6 0" /></Mark>
export const JewelleryMark = (p) => <Mark {...p}><path d="M9 8.5 12 4.5l3 4" /><circle cx="12" cy="14" r="5.5" /></Mark>
export const WatchesMark = (p) => <Mark {...p}><circle cx="12" cy="12" r="5" /><path d="M9.5 7.5V4.5h5v3M9.5 16.5v3h5v-3" /></Mark>
export const EyewearMark = (p) => <Mark {...p}><circle cx="7.5" cy="13" r="3.5" /><circle cx="16.5" cy="13" r="3.5" /><path d="M11 13h2M4 10.5 5.5 8M20 10.5 18.5 8" /></Mark>
export const LingerieMark = (p) => <Mark {...p}><path d="M12 12 5 8v8ZM12 12l7-4v8Z" /></Mark>
export const ActivewearMark = (p) => <Mark {...p}><path d="M5 8 12 12l-7 4M12 8l7 4-7 4" /></Mark>
// A hat stands for the whole shelf: hats, belts, scarves, hair and socks drawn
// separately would be five thin marks nobody can tell apart at this size.
export const AccessoriesMark = (p) => <Mark {...p}><path d="M5.5 14a6.5 6.5 0 0 1 13 0Z" /><path d="M4.5 14h15v2.5h-15Z" /></Mark>
// The first pass drew a slip and a maillot. Both came out as narrow uprights
// with a band across them, which at 32 units is a bottle — and worse, they were
// a bottle each and indistinguishable from one another. Night and water say the
// two things instantly, and both are built from circles like everything else.
export const SleepwearMark = (p) => <Mark {...p}><path d="M16.5 6a7.5 7.5 0 1 0 0 12 6 6 0 0 1 0-12Z" /></Mark>
export const SwimMark = (p) => (
  <Mark {...p}>
    <path d="M4.5 8.5a5.5 5.5 0 0 1 7.5 0 5.5 5.5 0 0 0 7.5 0" />
    <path d="M4.5 12a5.5 5.5 0 0 1 7.5 0 5.5 5.5 0 0 0 7.5 0" />
    <path d="M4.5 15.5a5.5 5.5 0 0 1 7.5 0 5.5 5.5 0 0 0 7.5 0" />
  </Mark>
)
// Carried, not illustrated: one circle held inside another, resting on its floor.
// A circle sitting above an arc was the first attempt and it read as a face,
// which is the one thing these marks may never do.
export const MaternityMark = (p) => <Mark {...p}><circle cx="12" cy="12" r="7.5" /><circle cx="12" cy="14.5" r="5" /></Mark>

// ── Personal — used ─────────────────────────────────────────────────
export const MakeupMark = (p) => <Mark {...p}><path d="M10.5 4.5h3v4h-3Z" /><path d="M9.5 8.5h5v11h-5Z" /></Mark>
export const FragranceMark = (p) => <Mark {...p}><path d="M10.5 4.5h3v2.5h-3Z" /><path d="M8 7h8v12.5H8Z" /><path d="M8 11h8" /></Mark>
export const DevicesMark = (p) => <Mark {...p}><path d="M8 4.5h8v6H8Z" /><path d="M12 10.5v9M9 19.5h6" /></Mark>
export const MedicationMark = (p) => <Mark {...p}><path d="M4.5 9h15v6h-15Z" /><path d="M12 9v6" /></Mark>

// ── Health — services ───────────────────────────────────────────────
export const PractitionersMark = (p) => <Mark {...p}><circle cx="12" cy="8.5" r="4" /><path d="M5 19.5v-1.5l3.5-3h7l3.5 3v1.5" /></Mark>
export const ClubsMark = (p) => <Mark {...p}><path d="M4.5 7.5h15v9h-15Z" /><path d="M4.5 11h15M8 14h4" /></Mark>
export const CoursesMark = (p) => <Mark {...p}><path d="M4.5 9 12 5.5 19.5 9 12 12.5Z" /><path d="M8 10.75v5h8v-5" /></Mark>

// ── Home ────────────────────────────────────────────────────────────
export const FurnitureMark = (p) => <Mark {...p}><path d="M4.5 10.5h15v6h-15Z" /><path d="M4.5 10.5V7.5h15v3" /><path d="M7 16.5v3M17 16.5v3" /></Mark>
export const LightingMark = (p) => <Mark {...p}><path d="M12 4.5v5" /><path d="M6.5 16.5 12 9.5l5.5 7Z" /><path d="M9.5 19.5h5" /></Mark>
export const AppliancesMark = (p) => <Mark {...p}><path d="M5 4.5h14v15H5Z" /><path d="M5 8.5h14" /><circle cx="12" cy="13.5" r="3.5" /></Mark>
export const TablewareMark = (p) => <Mark {...p}><path d="M7.5 4.5h9l-2 7h-5Z" /><path d="M12 11.5v6M9 19.5h6" /></Mark>
export const LinensMark = (p) => <Mark {...p}><path d="M4.5 12.5h15v5h-15Z" /><path d="M4.5 12.5V8h15v4.5" /><path d="M8 8v4.5" /></Mark>
export const ArtMark = (p) => <Mark {...p}><path d="M4.5 4.5h15v15h-15Z" /><path d="M4.5 15.5 9.5 10.5l4 4 3-3 2.5 2.5" /></Mark>
export const RugsMark = (p) => <Mark {...p}><path d="M5 7.5h14v9H5Z" /><path d="M7 7.5v-2M12 7.5v-2M17 7.5v-2M7 16.5v2M12 16.5v2M17 16.5v2" /></Mark>
export const BooksMark = (p) => <Mark {...p}><path d="M6 4.5h5v15H6ZM13 4.5h5v15h-5Z" /></Mark>
export const PlantsMark = (p) => <Mark {...p}><path d="M6.5 9.5h11l-2 10h-7Z" /><path d="M12 9.5v-5" /></Mark>
export const RenovationMark = (p) => <Mark {...p}><path d="M4.5 12 12 5.5 19.5 12" /><path d="M7 12v7.5h10V12" /></Mark>
export const MaintenanceMark = (p) => <Mark {...p}><path d="M5 19 13.5 10.5" /><circle cx="16.5" cy="7.5" r="3" /></Mark>

// ── Vehicles ────────────────────────────────────────────────────────
export const CarsMark = (p) => <Mark {...p}><path d="M4.5 12h15v4.5h-15Z" /><path d="M7.5 12 9.5 7.5h5L16.5 12" /><circle cx="8" cy="16.5" r="2" /><circle cx="16" cy="16.5" r="2" /></Mark>
export const BicyclesMark = (p) => <Mark {...p}><circle cx="7" cy="14.5" r="4.5" /><circle cx="17" cy="14.5" r="4.5" /><path d="M7 14.5 11 7.5h4l2 7" /></Mark>
// A hull and a sail — which is what the mark always drew, and now what the
// shelf is actually called.
export const BoatsMark = (p) => <Mark {...p}><path d="M4.5 15h15l-2.5 4.5h-10Z" /><path d="M12 15V4.5L17 12h-5" /></Mark>
export const MotorbikesMark = (p) => <Mark {...p}><circle cx="6" cy="16.5" r="3.5" /><circle cx="18" cy="16.5" r="3.5" /><path d="M6 16.5 10.5 9h4.5l3 7.5M9 9h4" /></Mark>

// ── Assets and money ────────────────────────────────────────────────
export const PropertyMark = (p) => <Mark {...p}><path d="M4.5 11 12 5l7.5 6" /><path d="M6.5 11v8.5h11V11" /><path d="M10.5 19.5v-5h3v5" /></Mark>
export const InvestmentsMark = (p) => <Mark {...p}><path d="M6 19.5v-5M10.5 19.5v-9M15 19.5v-13M19.5 19.5v-7" /></Mark>
export const CollectiblesMark = (p) => <Mark {...p}><path d="M4.5 7.5h15v12h-15Z" /><path d="M9.5 7.5v-3h5v3" /><path d="M4.5 13h15" /></Mark>
export const InsuranceMark = (p) => <Mark {...p}><path d="M12 4.5 19 7v6l-7 6.5L5 13V7Z" /></Mark>
export const MembershipsMark = (p) => <Mark {...p}><path d="M4.5 7.5h15v12h-15Z" /><path d="M8.5 4.5v6M15.5 4.5v6M4.5 12h15" /></Mark>

// ── Life and experience ─────────────────────────────────────────────
export const TravelMark = (p) => <Mark {...p}><circle cx="12" cy="12" r="7.5" /><path d="M4.5 12h15" /><path d="M12 4.5a4.5 7.5 0 0 1 0 15 4.5 7.5 0 0 1 0-15" /></Mark>
export const RestaurantsMark = (p) => <Mark {...p}><path d="M8 19.5V9M5.5 4.5v4.5h5V4.5" /><path d="M16 19.5V4.5l3 4.5-3 2.5" /></Mark>
export const PlacesMark = (p) => <Mark {...p}><circle cx="12" cy="9" r="4.5" /><path d="M12 13.5v6M8 19.5h8" /></Mark>
export const WineMark = (p) => <Mark {...p}><path d="M7.5 4.5h9v4a4.5 4.5 0 0 1-9 0Z" /><path d="M12 13v6.5M8.5 19.5h7" /></Mark>
export const EventsMark = (p) => <Mark {...p}><path d="M4.5 8h15v8h-15Z" /><path d="M12 8v1.5M12 11.25v1.5M12 14.5V16" /></Mark>
export const GiftsMark = (p) => <Mark {...p}><path d="M4.5 9.5h15v10h-15Z" /><path d="M12 9.5v10M4.5 13.5h15" /><path d="M12 9.5 8.5 5M12 9.5 15.5 5" /></Mark>

// ── Work and craft ──────────────────────────────────────────────────
export const TechMark = (p) => <Mark {...p}><path d="M5.5 6.5h13v9h-13Z" /><path d="M4.5 19h15" /></Mark>
export const StationeryMark = (p) => <Mark {...p}><path d="M6.5 17.5 15 9l2.5 2.5-8.5 8.5H6.5Z" /><path d="M15 9l2-2 2.5 2.5-2 2" /></Mark>
export const EquipmentMark = (p) => <Mark {...p}><path d="M4.5 8.5h15v10h-15Z" /><path d="M9 8.5 10.5 5.5h3L15 8.5" /><circle cx="12" cy="13.5" r="3" /></Mark>
export const SoftwareMark = (p) => <Mark {...p}><path d="M9.5 6.5 5 12l4.5 5.5M14.5 6.5 19 12l-4.5 5.5" /></Mark>

// ── People ──────────────────────────────────────────────────────────
export const VendorsMark = (p) => <Mark {...p}><path d="M4.5 9.5h15v10h-15Z" /><path d="M4.5 9.5 7 5h10l2.5 4.5" /><path d="M9.5 19.5v-6h5v6" /></Mark>
export const GiftingMark = (p) => <Mark {...p}><path d="M6.5 4.5h11v15h-11Z" /><path d="M9 9h6M9 12.5h6M9 16h3" /></Mark>

// A class that belongs to a pillar takes the pillar's mark; the rest are above.
const OWN = {
  wardrobe: WardrobeMark, outerwear: OuterwearMark, shoes: ShoesMark, bags: BagsMark,
  jewellery: JewelleryMark, watches: WatchesMark, eyewear: EyewearMark, lingerie: LingerieMark,
  activewear: ActivewearMark,
  accessories: AccessoriesMark, sleepwear: SleepwearMark, swim: SwimMark, maternity: MaternityMark,
  makeup: MakeupMark, fragrance: FragranceMark, devices: DevicesMark, medication: MedicationMark,
  practitioners: PractitionersMark, memberships: ClubsMark, courses: CoursesMark,
  furniture: FurnitureMark, lighting: LightingMark, appliances: AppliancesMark,
  tableware: TablewareMark, linens: LinensMark, art: ArtMark, rugs: RugsMark, books: BooksMark,
  plants: PlantsMark, renovation: RenovationMark, maintenance: MaintenanceMark,
  cars: CarsMark, bicycles: BicyclesMark, othervehicles: BoatsMark, motorbikes: MotorbikesMark,
  property: PropertyMark, investments: InvestmentsMark, collectibles: CollectiblesMark,
  insurance: InsuranceMark, subscriptions: MembershipsMark,
  travel: TravelMark, restaurants: RestaurantsMark, places: PlacesMark, wine: WineMark,
  events: EventsMark, gifts: GiftsMark,
  tech: TechMark, stationery: StationeryMark, equipment: EquipmentMark, software: SoftwareMark,
  vendors: VendorsMark, gifting: GiftingMark,
}

// A shelf she named herself. It gets an empty frame rather than someone else's
// drawing, and the first cover she puts on it fills the frame in.
export const OwnMark = (p) => <Mark {...p}><path d="M5.5 5.5h13v13h-13Z" /></Mark>

export function assetMarkFor(cls) {
  if (!cls) return WardrobeMark
  if (OWN[cls.id]) return OWN[cls.id]
  if (cls.custom || String(cls.id).startsWith('own_')) return OwnMark
  if (cls.pillar) return markFor(cls.pillar)
  return WardrobeMark
}

export default OWN
