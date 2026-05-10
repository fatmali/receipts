import { useState, useMemo } from 'react';
import TransactionRow from './TransactionRow.jsx';

const PAGE_SIZE = 50;

function dayLabel(dateStr) {
  if (!dateStr) return 'Unknown';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function dayKey(dateStr) {
  if (!dateStr) return '';
  return dateStr.slice(0, 10);
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
      <div className="w-2 h-2 rounded-full bg-surface animate-pulse" />
      <div className="flex-1">
        <div className="h-4 w-40 bg-surface rounded animate-pulse mb-1" />
        <div className="h-3 w-24 bg-surface rounded animate-pulse" />
      </div>
      <div className="h-4 w-20 bg-surface rounded animate-pulse" />
    </div>
  );
}

export default function TransactionList({ transactions, loading }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Group by day
  const grouped = useMemo(() => {
    if (!transactions?.length) return [];
    const groups = [];
    let currentKey = null;
    let currentGroup = null;

    for (const t of transactions) {
      const key = dayKey(t.date);
      if (key !== currentKey) {
        currentKey = key;
        currentGroup = { label: dayLabel(t.date), items: [] };
        groups.push(currentGroup);
      }
      currentGroup.items.push(t);
    }
    return groups;
  }, [transactions]);

  if (loading && !transactions?.length) {
    return (
      <div className="animate-pulse">
        {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
      </div>
    );
  }

  if (!transactions?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.5" className="text-text-faint mb-3">
          <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="text-text-muted text-sm">No transactions found</p>
      </div>
    );
  }

  // Flatten and paginate
  let count = 0;
  const hasMore = (transactions?.length || 0) > visibleCount;

  return (
    <div className="pb-24">
      {grouped.map((group) => {
        const rows = [];
        for (const t of group.items) {
          if (count >= visibleCount) break;
          rows.push(<TransactionRow key={t.id || `${t.date}-${t.amount}-${count}`} transaction={t} />);
          count++;
        }
        if (rows.length === 0) return null;
        return (
          <div key={group.label}>
            <div className="sticky top-0 z-10 px-4 py-2 font-heading text-xs font-semibold text-text-muted uppercase tracking-wider bg-surface border-b border-border">
              {group.label}
            </div>
            {rows}
          </div>
        );
      })}
      {hasMore && (
        <button
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          className="w-full py-3 text-sm text-green hover:text-green/80 transition-colors"
        >
          Load more ({transactions.length - visibleCount} remaining)
        </button>
      )}
    </div>
  );
}
