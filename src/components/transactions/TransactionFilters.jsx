import { formatAccount } from '../../lib/format.js';

const TYPE_OPTIONS = ['All', 'Income', 'Expenses', 'Transfers', 'Fuliza'];

function FilterSelect({ value, options, onChange, label, formatOption }) {
  return (
    <div className="relative flex-1 min-w-0">
      <select
        value={value || 'All'}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-surface border border-border rounded-xl pl-3 pr-8 py-2 text-xs font-medium text-text focus:outline-none focus:border-green/50 transition-colors"
        aria-label={label}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt === 'All' ? `All ${label}` : (formatOption ? formatOption(opt) : opt)}</option>
        ))}
      </select>
      <svg
        width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}

export default function TransactionFilters({
  activeType,
  activeAccount,
  onTypeChange,
  onAccountChange,
  accounts,
}) {
  const accountOptions = accounts?.length ? ['All', ...accounts] : ['All'];

  return (
    <div className="flex gap-2 px-4 pb-2">
      <FilterSelect value={activeType} options={TYPE_OPTIONS} onChange={onTypeChange} label="Types" />
      <FilterSelect value={activeAccount} options={accountOptions} onChange={onAccountChange} label="Accounts" formatOption={formatAccount} />
    </div>
  );
}
