import { totalIncome, totalSavings, totalSpending } from '../../compute/metrics.js';
import { deltaPercent } from '../../compute/trends.js';
import { formatKES } from '../../lib/format.js';

function HeroCard({ label, value, valueColor, delta, deltaInverted = false, icon, periodLabel = 'month' }) {
  const deltaNum = typeof delta === 'number' ? delta : null;
  let deltaColor = 'text-text-muted';
  let arrow = '';

  if (deltaNum != null) {
    const isPositive = deltaNum >= 0;
    arrow = isPositive ? '↑' : '↓';
    if (deltaInverted) {
      deltaColor = isPositive ? 'text-orange' : 'text-green';
    } else {
      deltaColor = isPositive ? 'text-green' : 'text-orange';
    }
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-text-muted">{icon}</span>
        <p className="text-text-muted text-xs font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className={`font-mono text-xl font-semibold ${valueColor}`}>{value}</p>
      {deltaNum != null && (
        <p className={`text-xs mt-2 ${deltaColor}`}>
          {arrow} {Math.abs(Math.round(deltaNum))}% vs last {periodLabel}
        </p>
      )}
    </div>
  );
}

const IncomeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
);
const ExpenseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <polyline points="19 12 12 19 5 12" />
  </svg>
);
const NetIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);
const SavingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 12h8M12 8v8" />
  </svg>
);

export default function HeroStrip({ currentMonth, previousMonth, periodLabel = 'month' }) {
  const income = totalIncome(currentMonth);
  const spending = totalSpending(currentMonth);
  const saved = totalSavings(currentMonth);
  const rate = income > 0 ? (saved / income) * 100 : null;

  const prevIncome = previousMonth ? totalIncome(previousMonth) : null;
  const prevSpending = previousMonth ? totalSpending(previousMonth) : null;
  const prevSaved = previousMonth ? totalSavings(previousMonth) : null;
  const prevRate = prevIncome != null && prevIncome > 0 && prevSaved != null ? (prevSaved / prevIncome) * 100 : null;

  const incomeDelta = prevIncome != null ? deltaPercent(income, prevIncome) : null;
  const spendingDelta = prevSpending != null ? deltaPercent(spending, prevSpending) : null;
  const savedDelta = prevSaved != null ? deltaPercent(saved, prevSaved) : null;
  const rateDelta = prevRate != null && rate != null ? rate - prevRate : null;

  return (
    <div className="grid grid-cols-2 gap-4 px-4">
      <HeroCard
        label="Income"
        value={formatKES(income)}
        valueColor="text-green"
        delta={incomeDelta}
        icon={<IncomeIcon />}
        periodLabel={periodLabel}
      />
      <HeroCard
        label="Spending"
        value={formatKES(spending)}
        valueColor="text-orange"
        delta={spendingDelta}
        deltaInverted
        icon={<ExpenseIcon />}
        periodLabel={periodLabel}
      />
      <HeroCard
        label="Saved"
        value={formatKES(saved)}
        valueColor={saved > 0 ? 'text-green' : 'text-text-muted'}
        delta={savedDelta}
        icon={<NetIcon />}
        periodLabel={periodLabel}
      />
      <HeroCard
        label="Savings Rate"
        value={rate != null ? `${Math.round(rate)}%` : 'N/A'}
        valueColor={rate != null ? 'text-blue' : 'text-text-muted'}
        delta={rateDelta}
        icon={<SavingsIcon />}
        periodLabel={periodLabel}
      />
    </div>
  );
}
