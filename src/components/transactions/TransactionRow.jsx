import { formatKES, formatAccount } from '../../lib/format.js';

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: false });
}

const SOURCE_COLORS = {
  mpesa: '#52B788',
  'bank-a': '#4EA8DE',
  'bank-b': '#F4C542',
  'bank-c-1234': '#E8845A',
  'bank-c-5678': '#E8845A',
};

function getSourceColor(account) {
  if (!account) return '#6B7280';
  const key = account.toLowerCase().replace(/\s+/g, '');
  for (const [src, color] of Object.entries(SOURCE_COLORS)) {
    if (key.includes(src.replace('-', ''))) return color;
  }
  return '#6B7280';
}

function getAmountStyle(transaction) {
  switch (transaction.type) {
    case 'income': return { color: '#52B788' };
    case 'transfer': return { color: '#4EA8DE' };
    case 'fuliza_credit': return { color: '#C77DCC' };
    default: return { color: '#F0EDE8' };
  }
}

export default function TransactionRow({ transaction }) {
  if (!transaction) return null;

  const t = transaction;
  const sourceColor = getSourceColor(t.account);
  const amountStyle = getAmountStyle(t);
  const cost = Number(t.cost) || 0;
  const isRecurring = t.recurring === 'true' || t.recurring === true;

  return (
    <div className="flex items-center gap-3.5 px-4 py-4 border-b border-border min-h-[68px]" style={{ minHeight: 68 }}>
      {/* Source indicator */}
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: sourceColor }}
      />

      {/* Left: description + date */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-text truncate">
            {t.description || 'Unknown'}
          </span>
          {isRecurring && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted shrink-0" title="Recurring">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
          )}
        </div>
        <div className="text-xs text-text-muted mt-0.5">
          {formatTime(t.date)}{t.account ? ` · ${formatAccount(t.account)}` : ''}
        </div>
      </div>

      {/* Right: amount + fee + balance */}
      <div className="text-right shrink-0">
        <div className="font-mono text-sm font-medium" style={amountStyle}>
          {t.type === 'income' ? '+' : ''}{formatKES(Number(t.amount) || 0)}
        </div>
        {t.type === 'transfer' && (
          <span className="text-[10px] bg-blue/20 text-blue px-1.5 py-0.5 rounded-full">Transfer</span>
        )}
        {cost > 0 && (
          <div className="text-[10px] text-text-muted mt-0.5">
            fee: {formatKES(cost)}
          </div>
        )}
        {t.balance !== '' && t.balance != null && !isNaN(Number(t.balance)) && (
          <div className="text-[10px] text-text-faint mt-0.5">
            bal: {formatKES(Number(t.balance))}
          </div>
        )}
      </div>
    </div>
  );
}
