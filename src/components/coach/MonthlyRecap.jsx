import { totalIncome, totalExpenses, totalSavings, expensesByCategory, topCategory } from '../../compute/metrics.js';
import { formatKES } from '../../lib/format.js';

function monthLabel(key) {
  if (!key) return '';
  const [, m] = key.split('-');
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return names[Number(m) - 1] || key;
}

export default function MonthlyRecap({ monthsData, savingsGoal }) {
  if (!monthsData?.length) return null;

  // Compute per-cycle stats
  const stats = monthsData.map(m => {
    const income = totalIncome(m.transactions);
    const expenses = totalExpenses(m.transactions);
    const saved = totalSavings(m.transactions);
    const cats = expensesByCategory(m.transactions);
    const top = topCategory(m.transactions);
    const label = m.label || monthLabel(m.month);
    return { month: m.month, label, income, expenses, saved, cats, top };
  });

  // Cycle-over-cycle expense change
  const latest = stats[stats.length - 1];
  const prev = stats.length >= 2 ? stats[stats.length - 2] : null;
  const expDelta = prev ? latest.expenses - prev.expenses : null;
  const expDeltaPct = prev && prev.expenses > 0
    ? Math.round(((latest.expenses - prev.expenses) / prev.expenses) * 100)
    : null;

  // Find category that grew most between prev and latest
  let grownCat = null;
  if (prev) {
    let maxGrowth = 0;
    for (const [cat, amt] of Object.entries(latest.cats)) {
      const prevAmt = prev.cats[cat] || 0;
      const growth = amt - prevAmt;
      if (growth > maxGrowth && prevAmt > 0) {
        maxGrowth = growth;
        grownCat = { cat, growth, prevAmt, amt };
      }
    }
  }

  return (
    <div className="px-4">
      <h3 className="font-heading text-sm font-medium text-text-muted uppercase tracking-wide mb-3">
        Recent Performance
      </h3>

      <div className="bg-surface border border-border rounded-2xl p-5 space-y-5">
        {/* Month-over-month highlights */}
        {(expDelta !== null || grownCat) && (
          <div className="space-y-2">
            {expDelta !== null && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">
                  {latest.label} vs {prev.label} expenses
                </span>
                <span className={`font-mono text-xs font-medium ${expDelta > 0 ? 'text-orange' : 'text-green'}`}>
                  {expDelta > 0 ? '↑' : '↓'} {formatKES(Math.abs(expDelta))} ({expDeltaPct > 0 ? '+' : ''}{expDeltaPct}%)
                </span>
              </div>
            )}
            {grownCat && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Fastest growing</span>
                <span className="text-xs text-orange font-medium capitalize">
                  {grownCat.cat} +{formatKES(grownCat.growth)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Goal hit summary */}
        {savingsGoal > 0 && (
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">Cycles saving {formatKES(savingsGoal)}+</span>
              <span className="font-mono text-sm font-semibold text-text">
                {stats.filter(s => s.saved >= savingsGoal).length} / {stats.length}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
