// Impulse-detection scorer — pure functions

const HIGH_IMPULSE_CATEGORIES = new Set([
  'dining', 'food', 'restaurants', 'eating out',
  'shopping', 'clothing', 'fashion',
  'entertainment', 'leisure', 'fun',
  'alcohol', 'bars', 'nightlife',
  'delivery', 'food delivery',
]);

const KNOWN_BILLER_KEYWORDS = [
  'kplc', 'kenya power',
  'rent', 'landlord',
  'safaricom', 'airtime', 'data bundle',
  'zuku', 'fiber', 'internet',
  'water', 'nairobi water',
  'dstv', 'gotv', 'netflix', 'spotify',
  'insurance', 'jubilee', 'apa', 'britam',
];

/**
 * Score how likely a transaction was an impulse purchase.
 *
 * @param {Object} transaction - { date, amount, category, description, account, type }
 * @param {Array} history - past 90 days of transactions for context
 * @param {Array} recurring - detected recurring patterns
 * @param {Object} budgets - { category: amount } resolved budgets for current month
 * @returns {{ score: number, reasons: string[] }}
 */
export function scoreImpulse(transaction, history = [], recurring = [], budgets = {}) {
  const reasons = [];
  let score = 0;

  if (!transaction || transaction.type !== 'expense') {
    return { score: 0, reasons: [] };
  }

  const amount = Math.abs(Number(transaction.amount) || 0);
  const description = String(transaction.description || '').toLowerCase();
  const category = String(transaction.category || '').toLowerCase();
  const date = new Date(transaction.date);
  const hour = date.getHours();

  // --- Negative signals (planned) ---

  // Recurring match
  const isRecurring = recurring.some(r => {
    const desc = String(r.description || '').toLowerCase();
    return desc && (desc === description || description.includes(desc) || desc.includes(description));
  });
  if (isRecurring) {
    score -= 0.5;
    reasons.push('matches a recurring pattern');
  }

  // Known biller
  const isKnownBiller = KNOWN_BILLER_KEYWORDS.some(kw => description.includes(kw));
  if (isKnownBiller) {
    score -= 0.5;
    reasons.push('known biller');
  }

  // Within budget
  const budget = budgets[category] || budgets[String(transaction.category || '')];
  if (budget && budget > 0) {
    const sameCategoryThisMonth = history
      .filter(t => {
        if (t.type !== 'expense') return false;
        const tCat = String(t.category || '').toLowerCase();
        if (tCat !== category) return false;
        const tDate = new Date(t.date);
        return tDate.getMonth() === date.getMonth() && tDate.getFullYear() === date.getFullYear();
      })
      .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
    if (sameCategoryThisMonth <= budget) {
      score -= 0.2;
      reasons.push('within category budget');
    }
  }

  // --- Positive signals (impulse) ---

  // Hour outside 6am–11pm (so < 6 or >= 23)
  if (hour < 6 || hour >= 23) {
    score += 0.3;
    reasons.push(`late-night purchase (${hour}:${String(date.getMinutes()).padStart(2, '0')})`);
  }

  // Spike: amount > 3× category 90-day median
  const categoryHistory = history
    .filter(t => {
      if (t.type !== 'expense') return false;
      const tCat = String(t.category || '').toLowerCase();
      return tCat === category;
    })
    .map(t => Math.abs(Number(t.amount) || 0))
    .filter(a => a > 0);

  if (categoryHistory.length >= 3) {
    const sorted = [...categoryHistory].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    if (median > 0 && amount > median * 3) {
      score += 0.4;
      reasons.push(`${Math.round(amount / median)}× your usual ${category} spend`);
    }
  }

  // New merchant in high-impulse category
  if (HIGH_IMPULSE_CATEGORIES.has(category)) {
    const seenBefore = history.some(t => {
      const desc = String(t.description || '').toLowerCase();
      return desc && desc === description;
    });
    if (!seenBefore && description) {
      score += 0.3;
      reasons.push('new merchant in a high-impulse category');
    }
  }

  // 3+ same-merchant transactions within 60 minutes
  if (description) {
    const txTime = date.getTime();
    const windowMs = 60 * 60 * 1000;
    const sameMerchantNearby = history.filter(t => {
      const desc = String(t.description || '').toLowerCase();
      if (desc !== description) return false;
      const tTime = new Date(t.date).getTime();
      return Math.abs(tTime - txTime) <= windowMs;
    }).length;
    if (sameMerchantNearby >= 2) { // 2 in history + this one = 3
      score += 0.4;
      reasons.push('multiple charges at same merchant in an hour');
    }
  }

  // Clamp 0..1
  score = Math.max(0, Math.min(1, score));

  return { score, reasons };
}

/**
 * Should this transaction be flagged for "Worth It?" review?
 * @returns {boolean}
 */
export function isLikelyImpulse(transaction, history, recurring, budgets) {
  const { score } = scoreImpulse(transaction, history, recurring, budgets);
  return score >= 0.5;
}
