// ── The day's line. Chosen deterministically from the date, so the page is the
// same all day and the same on every device she opens it on — nothing is
// stored, and nothing has to be.

// Kept to lines that have outlived their authors, which is the register the
// rest of the house is written in.
export const QUOTES = [
  { text: 'Enough is a feast.', who: 'Buddhist proverb' },
  { text: 'He is a wise man who does not grieve for the things which he has not, but rejoices for those which he has.', who: 'Epictetus' },
  { text: 'The world is full of magic things, patiently waiting for our senses to grow sharper.', who: 'W. B. Yeats' },
  { text: 'To live is so startling it leaves little time for anything else.', who: 'Emily Dickinson' },
  { text: 'The soul should always stand ajar.', who: 'Emily Dickinson' },
  { text: 'Attention is the rarest and purest form of generosity.', who: 'Simone Weil' },
  { text: 'Nothing is worth more than this day.', who: 'Johann Wolfgang von Goethe' },
  { text: 'Let us be grateful to the people who make us happy.', who: 'Marcel Proust' },
  { text: 'Rest and be thankful.', who: 'William Wordsworth' },
  { text: 'There are years that ask questions and years that answer.', who: 'Zora Neale Hurston' },
  { text: 'In every walk with nature one receives far more than he seeks.', who: 'John Muir' },
  { text: 'What we love we shall grow to resemble.', who: 'Bernard of Clairvaux' },
  { text: 'Gratitude is the memory of the heart.', who: 'French proverb' },
  { text: 'A grateful mind is a great mind.', who: 'Philip Doddridge' },
  { text: 'The best remedy for those who are afraid is to go outside.', who: 'Anne Frank' },
  { text: 'Beauty is not caused. It is.', who: 'Emily Dickinson' },
  { text: 'Small cheer and great welcome makes a merry feast.', who: 'William Shakespeare' },
  { text: 'He who is not contented with what he has, would not be contented with what he would like to have.', who: 'Socrates' },
  { text: 'The manner of giving is worth more than the gift.', who: 'Pierre Corneille' },
  { text: 'Silent gratitude isn’t much use to anyone.', who: 'Gladys Bronwyn Stern' },
  { text: 'Wear gratitude like a cloak and it will feed every corner of your life.', who: 'Rumi' },
  { text: 'Do not spoil what you have by desiring what you have not.', who: 'Epicurus' },
  { text: 'Joy is the simplest form of gratitude.', who: 'Karl Barth' },
  { text: 'The whole of life is but a moment of time. Let us use it.', who: 'Plutarch' },
  { text: 'To awaken alone, in a strange town, is one of the pleasantest sensations in the world.', who: 'Freya Stark' },
  { text: 'Ordinary riches can be stolen; real riches cannot.', who: 'Oscar Wilde' },
  { text: 'Everything has beauty, but not everyone sees it.', who: 'Confucius' },
  { text: 'The heart that gives, gathers.', who: 'Tao Te Ching' },
  { text: 'Reflect upon your present blessings, of which every man has many.', who: 'Charles Dickens' },
  { text: 'There is no duty so much underrated as the duty of being happy.', who: 'Robert Louis Stevenson' },
  { text: 'Contentment is natural wealth; luxury is artificial poverty.', who: 'Socrates' },
  { text: 'It is not how much we have, but how much we enjoy, that makes happiness.', who: 'Charles Spurgeon' },
  { text: 'The day is of infinite length for him who knows how to appreciate and use it.', who: 'Johann Wolfgang von Goethe' },
  { text: 'Praise the sea; on shore remain.', who: 'English proverb' },
  { text: 'A quiet mind is richer than a crown.', who: 'Robert Greene' },
  { text: 'None is so rich as to throw away a friend.', who: 'Turkish proverb' },
]

// Days since an arbitrary epoch — a stable index for any date.
const dayIndex = (d) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000)

export const quoteFor = (date) => QUOTES[((dayIndex(date) % QUOTES.length) + QUOTES.length) % QUOTES.length]
