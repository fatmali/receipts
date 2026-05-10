import { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { projectWealth, projectFullWealth } from '../../compute/coach.js';
import { formatKES } from '../../lib/format.js';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-surface border border-border rounded-lg p-3 shadow-lg">
      <p className="text-xs text-text-muted mb-2">Year {label}</p>
      <p className="text-xs font-mono text-green font-semibold">{formatKES(d.wealth)}</p>
      {d.invested != null && (
        <div className="mt-2 space-y-1">
          <p className="text-[10px] text-text-muted">
            <span className="inline-block w-2 h-2 rounded-full bg-blue mr-1" />
            Investments: {formatKES(d.invested)}
          </p>
          <p className="text-[10px] text-text-muted">
            <span className="inline-block w-2 h-2 rounded-full bg-purple mr-1" />
            Pension: {formatKES(d.pension)}
          </p>
          <p className="text-[10px] text-text-muted">
            <span className="inline-block w-2 h-2 rounded-full bg-green mr-1" />
            Cash: {formatKES(d.cash)}
          </p>
        </div>
      )}
    </div>
  );
}

function NetWorthBar({ label, amount, color }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-xs text-text-muted">{label}</span>
      </div>
      <span className="text-xs font-mono text-text">{formatKES(amount)}</span>
    </div>
  );
}

/**
 * @param {number} monthlyNet - baseline monthly savings (current behaviour)
 * @param {Object} wealthProjection - from projectFullWealth()
 * @param {Object} wealth - wealth config (existing assets)
 */
export default function WealthProjection({ monthlyNet, wealthProjection, wealth }) {
  const hasWealth = wealth?.existing && Object.keys(wealth.existing).length > 0;
  const [boost, setBoost] = useState(0);

  // Simple projection fallback when no wealth config exists
  const simpleData = useMemo(() => {
    const projected = Math.round(monthlyNet * (1 + boost / 100));
    return projectWealth(projected, 5);
  }, [monthlyNet, boost]);

  // Full projection with boost
  const fullProjection = useMemo(() => {
    if (!hasWealth) return null;
    const boostedNet = Math.round(monthlyNet * (1 + boost / 100));
    return projectFullWealth({
      monthlyNet: boostedNet,
      years: 5,
      wealth,
    });
  }, [monthlyNet, boost, wealth, hasWealth]);

  const data = fullProjection?.data || simpleData;
  const fiveYear = data[data.length - 1]?.wealth || 0;
  const startingWealth = data[0]?.wealth || 0;

  const existing = wealth?.existing || {};
  const currentNetWorth = (existing.investments || 0) + (existing.espp || 0)
    + (existing.pension || 0) + (existing.emergency || 0) + (existing.homeFund || 0);

  return (
    <div className="px-4">
      <div className="bg-surface border border-border rounded-2xl p-5">
        {/* Current net worth summary */}
        {hasWealth && currentNetWorth > 0 && (
          <div className="mb-5 pb-4 border-b border-border">
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="font-heading text-sm font-medium text-text-muted uppercase tracking-wide">
                Net Worth
              </h3>
              <p className="font-mono text-lg font-semibold text-text">
                {formatKES(currentNetWorth)}
              </p>
            </div>
            <div className="space-y-1.5">
              {(existing.investments || 0) + (existing.espp || 0) > 0 && (
                <NetWorthBar label="Investments + ESPP" amount={(existing.investments || 0) + (existing.espp || 0)} color="bg-blue" />
              )}
              {existing.pension > 0 && (
                <NetWorthBar label="Pension" amount={existing.pension} color="bg-purple" />
              )}
              {existing.homeFund > 0 && (
                <NetWorthBar label="Home fund" amount={existing.homeFund} color="bg-orange" />
              )}
              {existing.emergency > 0 && (
                <NetWorthBar label="Emergency" amount={existing.emergency} color="bg-green" />
              )}
            </div>
          </div>
        )}

        {/* 5-year projection */}
        <div className="flex items-baseline justify-between mb-1">
          <h3 className="font-heading text-sm font-medium text-text-muted uppercase tracking-wide">
            5-Year Trajectory
          </h3>
          <p className="text-xs text-text-faint">{hasWealth ? '8% return assumed' : 'no return assumed'}</p>
        </div>

        <p className="font-mono text-2xl font-semibold text-green mt-2">
          {formatKES(fiveYear)}
        </p>
        <p className="text-xs text-text-muted mt-1">
          {hasWealth
            ? `from ${formatKES(startingWealth)} today — all streams combined`
            : `if you save ${formatKES(Math.round(monthlyNet * (1 + boost / 100)))}/mo for 5 years`}
        </p>

        <div className="h-40 mt-4 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid stroke="#1C1F2A" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fill: '#6B7280', fontSize: 11 }}
                axisLine={{ stroke: '#1C1F2A' }}
                tickLine={false}
                tickFormatter={(v) => `Y${v}`}
              />
              <YAxis
                tick={{ fill: '#6B7280', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : `${Math.round(v/1000)}k`}
                width={45}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#1C1F2A' }} />
              {hasWealth ? (
                <>
                  <Area type="monotone" dataKey="invested" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.15} strokeWidth={0} />
                  <Area type="monotone" dataKey="pension" stackId="1" stroke="#A855F7" fill="#A855F7" fillOpacity={0.15} strokeWidth={0} />
                  <Area type="monotone" dataKey="cash" stackId="1" stroke="#52B788" fill="#52B788" fillOpacity={0.15} strokeWidth={0} />
                  <Area type="monotone" dataKey="wealth" stroke="#52B788" fill="none" strokeWidth={2.5} dot={{ r: 3, fill: '#52B788' }} activeDot={{ r: 5, fill: '#52B788' }} />
                </>
              ) : (
                <Area
                  type="monotone"
                  dataKey="wealth"
                  stroke="#52B788"
                  fill="#52B788"
                  fillOpacity={0.1}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#52B788' }}
                  activeDot={{ r: 5, fill: '#52B788' }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-text-muted">
              What if you saved {boost > 0 ? `${boost}% more` : 'the same'}?
            </label>
            <span className="text-xs font-mono text-blue">+{boost}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="50"
            step="5"
            value={boost}
            onChange={(e) => setBoost(Number(e.target.value))}
            className="w-full accent-green"
          />
          {boost > 0 && (
            <p className="text-xs text-text-muted mt-2">
              That's <span className="text-green font-mono">{formatKES(fiveYear)}</span> in 5 years.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
