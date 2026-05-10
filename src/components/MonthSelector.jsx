export default function MonthSelector({
  months,
  loading,
  selectedMonth,
  onSelectMonth,
  hasMore,
  onLoadMore,
}) {
  const wrapper =
    'sticky top-0 z-30 bg-bg/95 backdrop-blur-sm px-4 pb-2 -mx-0';
  const wrapperStyle = {
    paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
  };

  if (loading || !months?.length) {
    return (
      <div className={wrapper} style={wrapperStyle}>
        <div className="bg-surface border border-border rounded-2xl h-[48px] animate-pulse" />
      </div>
    );
  }

  return (
    <div className={wrapper} style={wrapperStyle}>
      <div className="relative">
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <select
          value={selectedMonth || ''}
          onChange={(e) => {
            if (e.target.value === '__load_more__') {
              onLoadMore?.();
              return;
            }
            onSelectMonth?.(e.target.value);
          }}
          className="w-full appearance-none bg-surface border border-border rounded-2xl pl-11 pr-10 py-3.5 text-sm font-heading font-medium text-text min-h-[48px] focus:outline-none focus:border-green/50 transition-colors"
          aria-label="Pay period"
        >
          {months.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
          {hasMore && (
            <option value="__load_more__">Load older cycles…</option>
          )}
        </select>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );
}
