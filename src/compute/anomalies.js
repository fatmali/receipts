// Statistical outlier / anomaly detection

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stddev(arr, meanVal) {
  if (arr.length < 2) return 0;
  const m = meanVal ?? mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

export function detectAnomalies(currentMonthTxns, historicalMonthsTxns) {
  if (!currentMonthTxns?.length) return [];
  if (!historicalMonthsTxns?.length || historicalMonthsTxns.length < 2) return [];

  // Current month totals by category
  const currentByCategory = {};
  for (const t of currentMonthTxns) {
    if (t.type !== 'expense') continue;
    const cat = t.category || '';
    if (cat === '') continue;
    currentByCategory[cat] = (currentByCategory[cat] || 0) + (Number(t.amount) || 0);
  }

  // Historical totals by category per month
  const historicalByCategory = {};
  for (const monthTxns of historicalMonthsTxns) {
    const monthTotals = {};
    for (const t of (monthTxns || [])) {
      if (t.type !== 'expense') continue;
      const cat = t.category || '';
      if (cat === '') continue;
      monthTotals[cat] = (monthTotals[cat] || 0) + (Number(t.amount) || 0);
    }
    for (const [cat, total] of Object.entries(monthTotals)) {
      if (!historicalByCategory[cat]) historicalByCategory[cat] = [];
      historicalByCategory[cat].push(total);
    }
  }

  const anomalies = [];

  for (const [cat, current] of Object.entries(currentByCategory)) {
    const history = historicalByCategory[cat];
    // Skip if category only appears in fewer than 2 historical months
    if (!history || history.length < 2) continue;

    const m = mean(history);
    const sd = stddev(history, m);

    let isAnomaly = false;
    let zScore = 0;

    if (sd === 0) {
      // Identical historical amounts — flag if current differs by > 20%
      if (m > 0 && Math.abs(current - m) / m > 0.2) {
        isAnomaly = true;
        zScore = m > 0 ? (current - m) / (m * 0.01) : 0; // synthetic z-score
      }
    } else {
      zScore = (current - m) / sd;
      if (current > m + 2 * sd) {
        isAnomaly = true;
      }
    }

    if (isAnomaly) {
      const pctHigher = m > 0 ? Math.round(((current - m) / m) * 100) : 0;
      anomalies.push({
        category: cat,
        currentAmount: current,
        mean: Math.round(m),
        stddev: Math.round(sd),
        zScore: Math.round(zScore * 100) / 100,
        message: `${cat} spending is ${pctHigher}% higher than your ${history.length}-month average`,
      });
    }
  }

  return anomalies.sort((a, b) => b.zScore - a.zScore);
}
