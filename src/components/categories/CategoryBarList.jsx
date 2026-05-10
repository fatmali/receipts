import { formatKES } from '../../lib/format.js';

const CATEGORY_EMOJIS = {
  food: '🍽️', transport: '🚗', housing: '🏠', entertainment: '🎬',
  shopping: '🛍️', utilities: '⚡', health: '🏥', education: '📚',
  subscriptions: '📱', personal: '👤', gifts: '🎁', travel: '✈️',
  groceries: '🛒', fuel: '⛽', insurance: '🛡️', rent: '🏠',
  family: '👨‍👩‍👧', household: '🏡', grooming: '💇', selfcare: '🧖',
  internet: '🌐', gas: '⛽', healthcare: '🏥', pets: '🐾',
  phone: '📞', fees: '🏦', parking: '🅿️', delivery: '📦',
  vacation: '🏖️', splurge: '🎉', overdraft: '⚠️', debt: '💳',
  savings: '💰', income: '💵', other: '📂', '': '❓',
};

function getEmoji(category) {
  const key = (category || '').toLowerCase();
  return CATEGORY_EMOJIS[key] || '📂';
}

function getDelta(current, previous) {
  if (!previous || previous === 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  return pct;
}

export default function CategoryBarList({ data, total, previousData, anomalies, onCategorySelect, budgets }) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-text-muted text-sm">
        No category data
      </div>
    );
  }

  const anomalySet = new Set((anomalies || []).map((a) => a.category));
  const budgetMap = budgets || {};

  // Sort: over-budget first, then by amount descending
  const sorted = Object.entries(data)
    .filter(([, v]) => v > 0)
    .sort((a, b) => {
      const aOver = budgetMap[a[0]?.toLowerCase()] > 0 && a[1] > budgetMap[a[0]?.toLowerCase()] ? 1 : 0;
      const bOver = budgetMap[b[0]?.toLowerCase()] > 0 && b[1] > budgetMap[b[0]?.toLowerCase()] ? 1 : 0;
      if (bOver !== aOver) return bOver - aOver;
      return b[1] - a[1];
    });

  return (
    <div className="flex flex-col">
      {sorted.map(([cat, amount]) => {
        const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
        const prevAmount = previousData?.[cat];
        const delta = getDelta(amount, prevAmount);
        const hasAnomaly = anomalySet.has(cat);
        const budget = budgetMap[(cat || '').toLowerCase()];
        const overBudget = budget > 0 && amount > budget;
        const budgetPct = budget > 0 ? Math.min(Math.round((amount / budget) * 100), 100) : 0;
        const budgetRemaining = budget > 0 ? budget - amount : null;

        return (
          <button
            key={cat || '_uncategorized'}
            onClick={() => onCategorySelect?.(cat)}
            className="flex flex-col gap-1.5 px-4 py-3 border-b border-border hover:bg-surface/50 transition-colors text-left"
            style={{ minHeight: 44 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0">{getEmoji(cat)}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-text capitalize truncate">{cat || 'Uncategorized'}</span>
                    {hasAnomaly && (
                      <span className="text-xs border border-orange rounded-full px-1.5 py-0.5 text-orange shrink-0" title="Unusual spending">⚠️</span>
                    )}
                    {overBudget && (
                      <span className="text-[10px] bg-orange/15 text-orange rounded-full px-1.5 py-0.5 font-medium shrink-0">over</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-text-muted">
                    <span>{pct}% of total</span>
                    {delta !== null && (
                      <span className={delta > 0 ? 'text-orange' : 'text-green'}>
                        {delta > 0 ? '↑' : '↓'}{Math.abs(delta)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="font-mono text-sm text-text font-medium">
                  {formatKES(amount)}
                </span>
                {budget > 0 && (
                  <p className={`text-[10px] font-mono ${overBudget ? 'text-orange' : 'text-text-muted'}`}>
                    / {formatKES(budget)}
                  </p>
                )}
              </div>
            </div>
            {/* Budget progress bar — primary visual */}
            {budget > 0 ? (
              <div>
                <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${budgetPct}%`,
                      backgroundColor: overBudget ? '#E8845A' : '#52B788',
                    }}
                  />
                </div>
                <p className={`text-[10px] font-mono mt-0.5 ${overBudget ? 'text-orange' : 'text-text-muted'}`}>
                  {overBudget
                    ? `${formatKES(amount - budget)} over budget`
                    : `${formatKES(budgetRemaining)} remaining`
                  }
                </p>
              </div>
            ) : (
              <div>
                <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-text-muted/30 transition-all duration-500"
                    style={{ width: `${total > 0 ? (amount / total) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-[10px] text-text-faint mt-0.5">no budget set</p>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
