import { useState, useMemo } from 'react';
import { useMeta, useSalaryCycles } from '../../api/hooks.js';
import MonthSelector from '../MonthSelector.jsx';
import SearchBar from './SearchBar.jsx';
import TransactionFilters from './TransactionFilters.jsx';
import TransactionList from './TransactionList.jsx';

const SAVINGS_CATEGORIES = ['savings', 'investment', 'investments'];

const TYPE_MAP = {
  All: null,
  Income: 'income',
  Expenses: 'expense',
  Savings: '__savings__',
  Transfers: 'transfer',
  Fuliza: 'fuliza_credit',
};

export default function TransactionsTab() {
  const { data: meta } = useMeta();
  const months = meta?.availableMonths || [];
  const accounts = meta?.accounts || [];

  const { cycles, activeCycle, selectCycle, hasMore, loadMore, loading } = useSalaryCycles(months);
  const cycleLabels = useMemo(() => cycles.map(c => c.label), [cycles]);

  const allTransactions = activeCycle?.transactions || [];

  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState('All');
  const [activeAccount, setActiveAccount] = useState('All');

  const filtered = useMemo(() => {
    let txns = allTransactions;

    const typeVal = TYPE_MAP[activeType];
    if (typeVal === '__savings__') {
      txns = txns.filter((t) => SAVINGS_CATEGORIES.includes((t.category || '').toLowerCase()));
    } else if (typeVal) {
      txns = txns.filter((t) => t.type === typeVal);
    }

    if (activeAccount && activeAccount !== 'All') {
      const q = activeAccount.toLowerCase();
      txns = txns.filter((t) => {
        const acct = (t.account || '').toLowerCase();
        return acct === q || acct.includes(q);
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      txns = txns.filter((t) =>
        (t.description || '').toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q) ||
        String(t.amount || '').includes(q)
      );
    }

    return txns.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [allTransactions, activeType, activeAccount, search]);

  return (
    <div className="animate-fade-in">
      <MonthSelector
        months={cycleLabels}
        selectedMonth={activeCycle?.label}
        onSelectMonth={selectCycle}
        loading={loading && !cycles.length}
        hasMore={hasMore}
        onLoadMore={loadMore}
      />
      <SearchBar value={search} onChange={setSearch} onClear={() => setSearch('')} />
      <TransactionFilters
        activeType={activeType}
        activeAccount={activeAccount}
        onTypeChange={setActiveType}
        onAccountChange={setActiveAccount}
        accounts={accounts}
      />
      <TransactionList transactions={filtered} loading={loading} />
    </div>
  );
}
