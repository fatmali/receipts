import { useMemo } from 'react';
import { formatKES } from '../../lib/format.js';
import TransactionRow from '../transactions/TransactionRow.jsx';

const CATEGORY_EMOJIS = {
  food: '🍽️', transport: '🚗', housing: '🏠', entertainment: '🎬',
  shopping: '🛍️', utilities: '⚡', health: '🏥', education: '📚',
  subscriptions: '📱', personal: '👤', gifts: '🎁', travel: '✈️',
  groceries: '🛒', fuel: '⛽', insurance: '🛡️', '': '❓',
};

function getEmoji(category) {
  const key = (category || '').toLowerCase();
  return CATEGORY_EMOJIS[key] || '📂';
}

export default function CategoryDrillDown({ category, transactions, isOpen, onClose }) {
  const total = useMemo(() => {
    if (!transactions?.length) return 0;
    return transactions.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  }, [transactions]);

  const topMerchants = useMemo(() => {
    if (!transactions?.length) return [];
    const byDesc = {};
    for (const t of transactions) {
      const key = t.description || 'Unknown';
      if (!byDesc[key]) byDesc[key] = { name: key, total: 0, count: 0 };
      byDesc[key].total += Number(t.amount) || 0;
      byDesc[key].count++;
    }
    return Object.values(byDesc).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [transactions]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Backdrop */}
      <div
        className="shrink-0 bg-black/60 animate-fade-overlay"
        style={{ height: 'env(safe-area-inset-top, 0px)', minHeight: 48 }}
        onClick={onClose}
      />

      {/* Sheet — fills remaining space */}
      <div
        className="relative bg-bg rounded-t-2xl flex-1 flex flex-col animate-slide-up-sheet overflow-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Header — fixed at top */}
        <div className="shrink-0">
          <div className="flex justify-center py-3 cursor-pointer" onClick={onClose}>
            <div className="w-10 h-1 rounded-full bg-border" />
          </div>
          <div className="px-4 pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{getEmoji(category)}</span>
                <h2 className="font-heading text-lg font-semibold capitalize">{category || 'Uncategorized'}</h2>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-surface text-text-muted"
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="flex items-baseline gap-3 mt-1">
              <p className="font-mono text-xl font-semibold text-green">{formatKES(total)}</p>
              <p className="text-xs text-text-muted">{transactions?.length || 0} transactions</p>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 overscroll-contain -webkit-overflow-scrolling-touch">
          {/* Top merchants */}
          {topMerchants.length > 0 && (
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Top Merchants</h3>
              {topMerchants.map((m) => (
                <div key={m.name} className="flex items-center justify-between py-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text truncate">{m.name}</p>
                    <p className="text-[10px] text-text-muted">{m.count}x</p>
                  </div>
                  <span className="font-mono text-sm text-text shrink-0 ml-3">{formatKES(m.total)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Transactions */}
          <div className="pb-8">
            {(transactions || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date)).map((t, i) => (
              <TransactionRow key={t.id || `${t.date}-${t.amount}-${i}`} transaction={t} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
