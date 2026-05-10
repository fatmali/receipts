import { fulizaOutstanding } from '../../compute/metrics.js';
import { formatKES } from '../../lib/format.js';

export default function FulizaCard({ transactions, currentMonth }) {
  if (!transactions?.length) return null;

  // Detect Fuliza usage from type, raw_sms, or description
  const fulizaTxns = transactions.filter((t) => {
    if (t.type === 'fuliza_credit') return true;
    const sms = (t.raw_sms || '').toLowerCase();
    const desc = (t.description || '').toLowerCase();
    const mentionsFuliza = sms.includes('fuliza') || desc.includes('fuliza');
    const isRepayment = desc.includes('repayment') || sms.includes('repayment');
    return mentionsFuliza && !isRepayment;
  });
  if (fulizaTxns.length === 0) return null;

  const outstanding = fulizaOutstanding(transactions);
  const timesUsed = fulizaTxns.length;

  const drawn = fulizaTxns.reduce((s, t) => s + (Number(t.amount) || 0), 0);

  const repaid = transactions
    .filter((t) => {
      const desc = (t.description || '').toLowerCase();
      return desc.includes('fuliza') && desc.includes('repayment');
    })
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);

  // Days since last Fuliza entry
  const lastFuliza = fulizaTxns
    .map((t) => new Date(t.date))
    .sort((a, b) => b - a)[0];
  const daysSinceLast = lastFuliza
    ? Math.floor((Date.now() - lastFuliza.getTime()) / 86_400_000)
    : null;

  return (
    <div className="mx-4 bg-surface border border-border rounded-2xl p-5">
      <h3 className="font-heading text-sm font-medium text-text-muted mb-4">Fuliza</h3>

      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-text-muted">Used</span>
          <span className="font-mono">{timesUsed} time{timesUsed !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Drawn</span>
          <span className="font-mono">{formatKES(drawn)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Repaid</span>
          <span className="font-mono">{formatKES(repaid)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Outstanding</span>
          <span className={`font-mono font-semibold ${outstanding > 0 ? 'text-orange' : 'text-green'}`}>
            {formatKES(outstanding)}
          </span>
        </div>
        {daysSinceLast != null && (
          <p className="text-xs text-text-faint pt-1">
            {daysSinceLast === 0 ? 'Last entry today' : `${daysSinceLast} day${daysSinceLast !== 1 ? 's' : ''} since last entry`}
          </p>
        )}
      </div>
    </div>
  );
}
