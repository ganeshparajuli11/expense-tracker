// Shared between the app UI, the API and the Claude connector.
export const EXPENSE_CATEGORIES = [
  { name: 'Groceries', emoji: '🛒', hint: 'supermarkets: Tesco, Aldi, Lidl, Sainsbury’s, Asda, Co-op, Morrisons, Asian/Nepali grocery shops' },
  { name: 'Eating Out', emoji: '🍜', hint: 'restaurants, cafés, takeaway, Deliveroo, Uber Eats, Just Eat, Greggs, coffee' },
  { name: 'Transport', emoji: '🚌', hint: 'bus, train, tram, Uber/Bolt, National Express, fuel, parking, West Midlands Network' },
  { name: 'Rent', emoji: '🏠', hint: 'rent, deposit, accommodation' },
  { name: 'Bills & Utilities', emoji: '💡', hint: 'electricity, gas, water, council tax, TV licence' },
  { name: 'Phone & Internet', emoji: '📱', hint: 'mobile plan, top-up, broadband, eSIM' },
  { name: 'Subscriptions', emoji: '🔁', hint: 'Netflix, Spotify, iCloud, Google One, Claude, ChatGPT, domains, hosting, software' },
  { name: 'Shopping', emoji: '🛍️', hint: 'clothes, Amazon, electronics, household items, Primark, Argos' },
  { name: 'Health', emoji: '💊', hint: 'pharmacy, Boots, prescriptions, dentist, gym' },
  { name: 'Education', emoji: '🎓', hint: 'tuition, books, courses, exam fees, certifications, printing' },
  { name: 'Entertainment', emoji: '🎬', hint: 'cinema, events, games, outings' },
  { name: 'Travel', emoji: '✈️', hint: 'flights, hotels, holidays, visa/travel costs' },
  { name: 'Personal Care', emoji: '💇', hint: 'haircut, toiletries, cosmetics' },
  { name: 'Gifts & Donations', emoji: '🎁', hint: 'presents, charity, temple/church donations' },
  { name: 'Money Sent Home', emoji: '🌏', hint: 'remittance, Wise/Remitly/Western Union transfers to family' },
  { name: 'Fees & Charges', emoji: '🧾', hint: 'bank fees, card fees, fines, late fees' },
  { name: 'Other', emoji: '📦', hint: 'anything that does not fit' },
];

export const INCOME_CATEGORIES = [
  { name: 'Salary', emoji: '💼', hint: 'wages, payslip, part-time job' },
  { name: 'Freelance', emoji: '💻', hint: 'client work, contracts' },
  { name: 'Side Income', emoji: '🌐', hint: 'website/ads revenue (e.g. AdSense), selling things' },
  { name: 'Family Support', emoji: '👪', hint: 'money received from family' },
  { name: 'Refund', emoji: '↩️', hint: 'refunds, cashback' },
  { name: 'Gift', emoji: '🎁', hint: 'money received as a gift' },
  { name: 'Other Income', emoji: '💰', hint: 'interest, anything else' },
];

const ALL = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export function categoryEmoji(name) {
  const c = ALL.find((x) => x.name.toLowerCase() === String(name || '').toLowerCase());
  return c ? c.emoji : '🏷️';
}

export const PAYMENT_METHODS = ['Card', 'Cash', 'Bank transfer', 'Apple/Google Pay', 'Direct debit'];
