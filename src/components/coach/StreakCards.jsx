function ChainViz({ length, max = 6 }) {
  const dots = Math.min(length, max);
  return (
    <div className="flex items-center gap-1 mt-3">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`h-2 flex-1 rounded-full ${i < dots ? 'bg-green' : 'bg-border'}`}
        />
      ))}
    </div>
  );
}

export default function StreakCards({ streak, savingsGoal }) {
  if (!savingsGoal) {
    return (
      <div className="px-4">
        <div className="bg-surface border border-border rounded-2xl p-5">
          <p className="text-sm text-text-muted">
            Set a monthly savings goal in your config to track streaks.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4">
      <h3 className="font-heading text-sm font-medium text-text-muted uppercase tracking-wide mb-3">
        Streaks
      </h3>

      <div className="bg-surface border border-border rounded-2xl p-5">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-xs text-text-muted">Savings goal hit</p>
            <p className="font-mono text-3xl font-semibold text-green mt-1">
              {streak.current}
              <span className="text-sm text-text-muted ml-1">
                {streak.current === 1 ? 'month' : 'months'}
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-text-muted">Best</p>
            <p className="font-mono text-xl text-text mt-1">
              {streak.longest}
            </p>
          </div>
        </div>

        <ChainViz length={streak.current} />

        {streak.current === 0 && streak.longest > 0 && (
          <p className="text-xs text-text-muted mt-3">
            You've done it before — {streak.longest} months in a row. You can again.
          </p>
        )}
        {streak.current >= 3 && (
          <p className="text-xs text-green mt-3">
            Identity is built one repetition at a time. Keep the chain.
          </p>
        )}
      </div>
    </div>
  );
}
