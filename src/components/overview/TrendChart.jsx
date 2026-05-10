import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

const COLORS = {
  income: '#52B788',
  expenses: '#E8845A',
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-surface border border-border rounded-lg p-3 shadow-lg">
      <p className="text-xs text-text-muted mb-1 font-heading">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="text-xs font-mono" style={{ color: entry.color }}>
          {entry.name}: KES {(entry.value || 0).toLocaleString('en-KE')}
        </p>
      ))}
    </div>
  );
}

const NON_SPENDING_CATEGORIES = ['savings', 'investment', 'investments'];

/**
 * Builds daily cumulative income/expenses from the cycle's transactions.
 * Uses actual dates so cycles spanning month boundaries display correctly.
 */
function buildDailyData(transactions) {
  if (!transactions?.length) return [];

  const byDate = {};
  for (const t of transactions) {
    const d = t.date.slice(0, 10);
    if (!byDate[d]) byDate[d] = { income: 0, expenses: 0 };
    const amt = Math.abs(Number(t.amount) || 0);
    if (t.type === 'income') byDate[d].income += amt;
    else if (t.type === 'expense' && !NON_SPENDING_CATEGORIES.includes((t.category || '').toLowerCase())) byDate[d].expenses += amt;
  }

  const dates = Object.keys(byDate).sort();
  if (!dates.length) return [];

  const fmt = { day: 'numeric', month: 'short' };
  let cumIncome = 0;
  let cumExpenses = 0;
  return dates.map((d) => {
    cumIncome += byDate[d].income;
    cumExpenses += byDate[d].expenses;
    const label = new Date(d + 'T00:00:00').toLocaleDateString('en-KE', fmt);
    return { day: label, income: cumIncome, expenses: cumExpenses };
  });
}

export default function TrendChart({ transactions, title = 'This Month' }) {
  const data = useMemo(() => buildDailyData(transactions), [transactions]);

  if (!data.length) return null;

  return (
    <div className="px-4">
      <h3 className="font-heading text-sm font-medium text-text-muted mb-3">{title}</h3>
      <div className="flex gap-4 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: COLORS.income }} />
          <span className="text-xs text-text-muted">Income</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: COLORS.expenses }} />
          <span className="text-xs text-text-muted">Expenses</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.income} stopOpacity={0.2} />
              <stop offset="100%" stopColor={COLORS.income} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.expenses} stopOpacity={0.2} />
              <stop offset="100%" stopColor={COLORS.expenses} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1C1F2A" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fill: '#6B7280', fontSize: 11 }}
            axisLine={{ stroke: '#1C1F2A' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#6B7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${Math.round(v / 1000)}k`}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#1C1F2A' }} />
          <Area
            type="monotone"
            dataKey="income"
            name="Income"
            stroke={COLORS.income}
            strokeWidth={2}
            fill="url(#gradIncome)"
            dot={false}
            activeDot={{ r: 4, fill: COLORS.income }}
          />
          <Area
            type="monotone"
            dataKey="expenses"
            name="Expenses"
            stroke={COLORS.expenses}
            strokeWidth={2}
            fill="url(#gradExpenses)"
            dot={false}
            activeDot={{ r: 4, fill: COLORS.expenses }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
