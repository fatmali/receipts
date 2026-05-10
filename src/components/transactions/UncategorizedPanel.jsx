import { useState, useMemo } from 'react';
import { updateCategories } from '../../api/sheets.js';
import { clearCache } from '../../api/cache.js';
import { formatKES, formatDate } from '../../lib/format.js';

function titleCase(s) {
  if (!s) return '';
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Stable per-row key — many transactions lack a unique `id`, so fall back
// to a composite of date/amount/description/account so each row's pending
// state stays isolated.
function rowKey(t) {
  if (t.id) return String(t.id);
  return `${t.date || ''}|${t.amount || ''}|${t.description || ''}|${t.account || ''}`;
}

export default function UncategorizedPanel({ transactions, categories, month, onSaved }) {
  const uncategorized = useMemo(
    () => (transactions || []).filter((t) => t.category === '' || t.category == null),
    [transactions],
  );

  const [pending, setPending] = useState({}); // { [rowKey]: category }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedKeys, setSavedKeys] = useState(() => new Set());

  const visible = uncategorized.filter((t) => !savedKeys.has(rowKey(t)));
  const dirtyCount = Object.values(pending).filter(Boolean).length;

  if (visible.length === 0) return null;

  function handleSelect(key, category) {
    setPending((p) => ({ ...p, [key]: category }));
  }

  async function handleSaveAll() {
    const updates = visible
      .map((t) => {
        const key = rowKey(t);
        const category = pending[key];
        if (!category || !t.id) return null;
        return { key, txn_id: t.id, category };
      })
      .filter(Boolean);

    if (updates.length === 0) return;

    setSaving(true);
    setError(null);
    const optimisticKeys = new Set(updates.map((u) => u.key));
    setSavedKeys((prev) => new Set([...prev, ...optimisticKeys]));

    try {
      await updateCategories(updates.map(({ txn_id, category }) => ({ txn_id, category })));
      await clearCache('summary');
      if (month) await clearCache(`month:${month}`);
      setPending({});
      if (onSaved) onSaved();
    } catch (err) {
      setSavedKeys((prev) => {
        const next = new Set(prev);
        optimisticKeys.forEach((k) => next.delete(k));
        return next;
      });
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const categoryOptions = categories?.length ? categories : [];

  return (
    <div className="px-4 pt-2 pb-24">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-heading text-sm font-semibold text-text">Uncategorized</h2>
          <p className="text-xs text-text-muted mt-0.5">{visible.length} to categorize</p>
        </div>
        <button
          type="button"
          onClick={handleSaveAll}
          disabled={saving || dirtyCount === 0}
          className="px-3 py-1.5 rounded-full text-xs font-medium bg-green text-bg disabled:bg-surface disabled:text-text-faint disabled:border disabled:border-border transition-colors"
        >
          {saving ? 'Saving…' : `Save all${dirtyCount ? ` (${dirtyCount})` : ''}`}
        </button>
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-orange/10 border border-orange/30 text-orange text-xs">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-border overflow-hidden">
        {visible.map((t) => {
          const key = rowKey(t);
          return (
            <div
              key={key}
              className="flex items-center gap-3 px-3 py-3 border-b border-border last:border-b-0"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm text-text truncate">{t.description || 'Unknown'}</div>
                <div className="text-xs text-text-muted mt-0.5">{formatDate(t.date)}</div>
              </div>
              <div className="font-mono text-sm text-text shrink-0">
                {formatKES(Number(t.amount) || 0)}
              </div>
              <select
                value={pending[key] || ''}
                onChange={(e) => handleSelect(key, e.target.value)}
                disabled={saving}
                className="appearance-none bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-text focus:outline-none focus:border-green/50 transition-colors shrink-0 max-w-32"
                aria-label="Category"
              >
                <option value="">Select…</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>{titleCase(c)}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
