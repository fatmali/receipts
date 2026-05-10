import { formatKES } from '../../lib/format.js';

function OverBar({ spent, budget }) {
  const pct = budget > 0 ? Math.min((spent / budget) * 100, 150) : 0;
  const isOver = spent > budget;
  return (
    <div className="w-full h-2 bg-border rounded-full overflow-hidden relative">
      <div
        className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-orange' : 'bg-green'}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
      {budget > 0 && (
        <div
          className="absolute top-0 h-full w-px bg-text-muted"
          style={{ left: `${Math.min(100, (100 / Math.max(pct, 100)) * 100)}%` }}
        />
      )}
    </div>
  );
}

export default function BudgetSummary({ budgetSummary }) {
  if (!budgetSummary?.categories?.length) return null;

  const { categories, totalOverspendAllMonths } = budgetSummary;
  const overBudgetCats = categories.filter(c => c.monthsOver > 0);

  if (!overBudgetCats.length) return null;

  return (
    <div className="px-4">
      <h3 className="font-heading text-sm font-medium text-text-muted uppercase tracking-wide mb-3">
        Budget Discipline
      </h3>

      <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
        {overBudgetCats.map(c => {
          const avgOver = c.totalMonths > 0 ? Math.round(c.totalOverspend / c.totalMonths) : 0;
          return (
            <div key={c.category}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-text capitalize">{c.category}</span>
                <span className="font-mono text-xs text-orange">
                  +{formatKES(avgOver)}/cycle avg
                </span>
              </div>
              <OverBar spent={c.avgSpent} budget={c.budget} />
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[11px] text-text-muted">
                  Budget {formatKES(c.budget)} · Spent {formatKES(c.avgSpent)} avg
                </span>
                <span className="text-[11px] text-text-muted">
                  Over {c.monthsOver} of {c.totalMonths} cycle{c.totalMonths !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          );
        })}

        {totalOverspendAllMonths > 0 && (
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">Total overspend</span>
              <span className="font-mono text-sm font-semibold text-orange">
                {formatKES(totalOverspendAllMonths)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
