import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatKES } from '../../lib/format.js';

const CATEGORY_COLORS = {
  food: '#52B788',
  transport: '#4EA8DE',
  housing: '#E8845A',
  entertainment: '#C77DCC',
  shopping: '#F4C542',
  utilities: '#6B7280',
  health: '#52B788',
  education: '#4EA8DE',
  subscriptions: '#C77DCC',
  personal: '#E8845A',
  gifts: '#F4C542',
  travel: '#4EA8DE',
  groceries: '#52B788',
  fuel: '#E8845A',
  insurance: '#6B7280',
};

const FALLBACK_COLORS = ['#52B788', '#4EA8DE', '#E8845A', '#C77DCC', '#F4C542', '#6B7280', '#4B5563'];

function getCategoryColor(category, index) {
  const key = (category || '').toLowerCase();
  return CATEGORY_COLORS[key] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, value, percent } = payload[0].payload;
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-text font-medium capitalize">{name || 'Uncategorized'}</p>
      <p className="font-mono text-xs text-green">{formatKES(value)}</p>
      <p className="text-[10px] text-text-muted">{Math.round((percent || 0) * 100)}%</p>
    </div>
  );
}

const RADIAN = Math.PI / 180;

function renderLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) {
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#F0EDE8" textAnchor="middle" dominantBaseline="central" fontSize={10}>
      {Math.round(percent * 100)}%
    </text>
  );
}

export default function CategoryPieChart({ data, onCategorySelect }) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="flex items-center justify-center h-[250px] text-text-muted text-sm">
        No category data
      </div>
    );
  }

  const total = Object.values(data).reduce((s, v) => s + v, 0);
  const chartData = Object.entries(data)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amount]) => ({
      name: cat || 'Uncategorized',
      value: amount,
      percent: total > 0 ? amount / total : 0,
    }));

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            label={renderLabel}
            labelLine={false}
            onClick={(_, index) => onCategorySelect?.(chartData[index]?.name)}
            style={{ cursor: 'pointer' }}
          >
            {chartData.map((entry, i) => (
              <Cell key={entry.name} fill={getCategoryColor(entry.name, i)} stroke="none" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      {/* Center label */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <p className="text-[10px] text-text-muted">Total</p>
          <p className="font-mono text-sm font-semibold text-text">{formatKES(total)}</p>
        </div>
      </div>
    </div>
  );
}
