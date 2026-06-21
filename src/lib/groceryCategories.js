// Auto-categorize a grocery item by name into editorial grocery sections.
// Every item lands in exactly one named category — no catch-all. Anything that
// doesn't match a named category falls into Pantry.

// Display order (used to render the sections).
export const GROCERY_CATEGORIES = [
  'Proteins', 'Dairy', 'Produce', 'Grains', 'Pantry', 'Supplements', 'Household',
]

// Match rules, checked in priority order. Supplements first so terms like
// "greens powder" or "fish oil" don't get caught by Produce/Pantry.
const RULES = [
  {
    category: 'Supplements',
    words: [
      'supplement', 'vitamin', 'multivitamin', 'prenatal', 'magnesium', 'omega', 'fish oil',
      'cod liver oil', 'collagen', 'probiotic', 'creatine', 'electrolyte', 'melatonin',
      'ashwagandha', 'biotin', 'glutathione', 'nmn', 'peptide', 'greens powder', 'protein powder',
      'zinc', 'b12', 'd3', 'capsule', 'tablet',
    ],
  },
  {
    category: 'Proteins',
    words: [
      'beef', 'chicken', 'turkey', 'lamb', 'bison', 'pork', 'salmon', 'cod', 'halibut', 'trout',
      'tuna', 'sardine', 'anchovy', 'anchovies', 'oyster', 'mussel', 'shrimp', 'liver', 'egg',
      'eggs', 'tofu', 'tempeh', 'roe', 'steak', 'fish', 'meat', 'bacon', 'sausage',
    ],
  },
  {
    category: 'Dairy',
    words: [
      'milk', 'yogurt', 'kefir', 'cheese', 'feta', 'butter', 'ghee', 'cream', 'cottage', 'ricotta',
      'mozzarella', 'parmesan',
    ],
  },
  {
    category: 'Produce',
    words: [
      'spinach', 'kale', 'chard', 'collard', 'beet', 'pomegranate', 'cherry', 'cherries', 'berry',
      'berries', 'blackberry', 'blueberry', 'raspberry', 'strawberry', 'avocado', 'broccoli',
      'zucchini', 'asparagus', 'artichoke', 'pea', 'fennel', 'cucumber', 'lemon', 'lime', 'grapefruit',
      'orange', 'parsley', 'dill', 'basil', 'mint', 'cilantro', 'cauliflower', 'brussels', 'arugula',
      'watercress', 'carrot', 'radish', 'romaine', 'lettuce', 'sweet potato', 'squash', 'parsnip',
      'turnip', 'banana', 'date', 'fig', 'apple', 'pear', 'grape', 'tomato', 'onion', 'garlic',
      'ginger', 'mushroom', 'pepper', 'sprout', 'herb', 'fruit', 'vegetable', 'greens',
    ],
  },
  {
    category: 'Grains',
    words: [
      'sourdough', 'bread', 'oat', 'oats', 'quinoa', 'rice', 'pasta', 'lentil', 'chickpea', 'bean',
      'flour', 'cereal', 'granola', 'cracker', 'tortilla',
    ],
  },
  {
    category: 'Household',
    words: ['paper', 'towel', 'soap', 'detergent', 'cleaner', 'sponge', 'foil', 'bag', 'wrap', 'trash'],
  },
  {
    category: 'Pantry',
    words: [
      'oil', 'olive', 'salt', 'cinnamon', 'turmeric', 'cardamom', 'cacao', 'chocolate',
      'honey', 'vinegar', 'miso', 'broth', 'stock', 'sauce', 'spice', 'seed', 'nut', 'almond',
      'walnut', 'pistachio', 'cashew', 'sunflower', 'sesame', 'flax', 'tea', 'coffee',
      'sugar', 'syrup', 'sauerkraut', 'kimchi', 'tahini',
    ],
  },
]

export function categorize(name) {
  const n = (name || '').toLowerCase()
  for (const rule of RULES) {
    if (rule.words.some((w) => n.includes(w))) return rule.category
  }
  return 'Pantry' // named default — never a catch-all bucket
}
