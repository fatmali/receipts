import { useMemo } from 'react';
import { formatKES } from '../../lib/format.js';
import { scoreImpulse } from '../../compute/impulse.js';

const REVIEW_THRESHOLD_KES = 2000;
const REVIEW_AGE_DAYS = 7;

function daysAgo(dateStr) {
  const d = new Date(dateStr);
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function VerdictPill({ verdict }) {
  const styles = {
    worth:     { bg: 'bg-green/10',  text: 'text-green',  label: 'Worth it' },
    not_worth: { bg: 'bg-orange/10', text: 'text-orange', label: 'Not worth it' },
    neutral:   { bg: 'bg-blue/10',   text: 'text-blue',   label: 'Meh' },
  };
  const s = styles[verdict] || styles.neutral;
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

function VerdictButtons({ txnId, onVerdict }) {
  return (
    <div className="flex gap-2 mt-3">
      <button
        onClick={() => onVerdict(txnId, 'worth')}
        className="flex-1 py-2 rounded-lg bg-green/10 text-green text-xs font-medium hover:bg-green/20 transition-colors min-h-11"
      >
        Worth it
      </button>
      <button
        onClick={() => onVerdict(txnId, 'neutral')}
        className="flex-1 py-2 rounded-lg bg-blue/10 text-blue text-xs font-medium hover:bg-blue/20 transition-colors min-h-11"
      >
        Meh
      </button>
      <button
        onClick={() => onVerdict(txnId, 'not_worth')}
        className="flex-1 py-2 rounded-lg bg-orange/10 text-orange text-xs font-medium hover:bg-orange/20 transition-colors min-h-11"
      >
        Not worth
      </button>
    </div>
  );
}

/**
 * Show recent expenses ≥ threshold + ≥ N days old + not yet reviewed.
 * Impulse-flagged shown first.
 */
export default function WorthItLog({ allTransactions = [], recurring = [], budgets = {}, reviews = new Map(), onVerdict }) {
  const candidates = useMemo(() => {
    const expenses = allTransactions.filter(t =>
      t.type === 'expense'
      && Math.abs(Number(t.amount) || 0) >= REVIEW_THRESHOLD_KES
      && daysAgo(t.date) >= REVIEW_AGE_DAYS,
    );

    // Score impulse for each
    const scored = expenses.map(t => {
      const { score, reasons } = scoreImpulse(t, allTransactions, recurring, budgets);
      return { txn: t, impulseScore: score, reasons, review: reviews.get(t.txn_id) };
    });

    // Sort: unreviewed flagged first, then unreviewed unflagged, then reviewed (most recent first)
    return scored.sort((a, b) => {
      const aRev = !!a.review;
      const bRev = !!b.review;
      if (aRev !== bRev) return aRev ? 1 : -1;
      if (!aRev) {
        // Both unreviewed: sort by impulse score desc, then date desc
        if (b.impulseScore !== a.impulseScore) return b.impulseScore - a.impulseScore;
      }
      return new Date(b.txn.date) - new Date(a.txn.date);
    });
  }, [allTransactions, recurring, budgets, reviews]);

  const unreviewedCount = candidates.filter(c => !c.review).length;
  const flaggedCount = candidates.filter(c => !c.review && c.impulseScore >= 0.5).length;

  if (!candidates.length) {
    return (
      <div className="px-4">
        <h3 className="font-heading text-sm font-medium text-text-muted uppercase tracking-wide mb-3">
          Worth It Log
        </h3>
        <div className="bg-surface border border-border rounded-2xl p-5">
          <p className="text-sm text-text-muted">
            No big expenses to reflect on yet. Come back when you've made a purchase ≥ {formatKES(REVIEW_THRESHOLD_KES)}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-heading text-sm font-medium text-text-muted uppercase tracking-wide">
          Worth It Log
        </h3>
        <p className="text-xs text-text-faint">
          {unreviewedCount} to reflect on
        </p>
      </div>

      {flaggedCount > 0 && (
        <p className="text-xs text-orange mb-3 px-1">
          {flaggedCount} flagged as possibly impulse — worth a closer look.
        </p>
      )}

      <div className="space-y-2">
        {candidates.slice(0, 20).map(({ txn, impulseScore, reasons, review }) => {
          const flagged = !review && impulseScore >= 0.5;
          return (
            <div
              key={txn.txn_id}
              className={`bg-surface border rounded-xl p-4 ${flagged ? 'border-orange/40' : 'border-border'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm text-text truncate">{txn.description || '(no description)'}</p>
                    {review && <VerdictPill verdict={review.verdict} />}
                  </div>
                  <p className="text-xs text-text-faint">
                    {new Date(txn.date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}
                    {' · '}
                    {txn.category || 'uncategorised'}
                    {' · '}
                    {daysAgo(txn.date)}d ago
                  </p>
                </div>
                <p className="font-mono text-sm text-orange whitespace-nowrap">
                  {formatKES(Math.abs(Number(txn.amount) || 0))}
                </p>
              </div>

              {flagged && reasons.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {reasons.slice(0, 3).map((r, i) => (
                    <li key={i} className="text-[11px] text-orange/80">• {r}</li>
                  ))}
                </ul>
              )}

              {!review && <VerdictButtons txnId={txn.txn_id} onVerdict={onVerdict} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
