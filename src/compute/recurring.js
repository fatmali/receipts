// Recurring transaction detection

export function detectRecurring(allTransactions) {
  if (!allTransactions?.length) return [];

  // Group by normalized description
  const groups = {};
  for (const t of allTransactions) {
    const key = (t.description || '').trim().toLowerCase();
    if (!key) continue;
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }

  // Determine total month span from all transactions
  const allMonthKeys = new Set();
  for (const t of allTransactions) {
    if (t.date) allMonthKeys.add(t.date.slice(0, 7));
  }
  const totalMonthSpan = allMonthKeys.size || 1;

  const results = [];

  for (const [key, txns] of Object.entries(groups)) {
    // Unique months this description appears in
    const months = new Set();
    for (const t of txns) {
      if (t.date) months.add(t.date.slice(0, 7));
    }
    if (months.size < 2) continue;

    // Check amount consistency — within ±10% of median
    const amounts = txns.map(t => Number(t.amount) || 0).sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)];
    if (median === 0) continue;

    const consistent = amounts.every(a => Math.abs(a - median) / median <= 0.1);
    if (!consistent) continue;

    // Frequency
    const frequency = months.size >= totalMonthSpan * 0.8 ? 'monthly' : 'occasional';

    // Annual cost
    const annualCost = frequency === 'monthly'
      ? median * 12
      : median * (txns.length / months.size) * 12;

    // Last seen
    const sorted = [...txns].sort((a, b) => new Date(b.date) - new Date(a.date));

    results.push({
      description: sorted[0].description || key,
      amount: median,
      frequency,
      count: txns.length,
      months: months.size,
      lastSeen: sorted[0].date,
      annualCost,
      transactions: txns,
    });
  }

  return results.sort((a, b) => b.annualCost - a.annualCost);
}

export function totalRecurringAnnual(recurring) {
  if (!recurring?.length) return 0;
  return recurring.reduce((sum, r) => sum + (r.annualCost || 0), 0);
}
