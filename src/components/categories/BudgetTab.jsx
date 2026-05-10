import { useState, useMemo, useCallback } from 'react';
import { useMeta, useSalaryCycles, useConfig } from '../../api/hooks.js';
import { expensesByCategory, totalExpenses, incomeByCategory, totalIncome } from '../../compute/metrics.js';
import { detectAnomalies } from '../../compute/anomalies.js';
import { resolveBudgets } from '../../compute/budgets.js';
import { formatKES } from '../../lib/format.js';
import MonthSelector from '../MonthSelector.jsx';
import CategoryPieChart from './CategoryPieChart.jsx';
import CategoryBarList from './CategoryBarList.jsx';
import CategoryDrillDown from './CategoryDrillDown.jsx';

function SkeletonPie() {
  return <div className="h-[250px] bg-surface border border-border rounded-xl animate-pulse mx-4" />;
}

function SkeletonBars() {
  return (
    <div className="flex flex-col gap-2 px-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-16 bg-surface border border-border rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

export default function BudgetTab() {
  const { data: meta } = useMeta();
  const { data: config } = useConfig();
  const months = meta?.availableMonths || [];

  const { cycles, activeCycle, prevCycle, selectCycle, hasMore, loadMore, loading } = useSalaryCycles(months);
  const cycleLabels = useMemo(() => cycles.map(c => c.label), [cycles]);

  const transactions = activeCycle?.transactions || [];
  const prevTransactions = prevCycle?.transactions || [];

  // Budgets — resolve using cycle start date as month key
  const monthKey = activeCycle?.startDate?.slice(0, 7) || null;
  const budgets = useMemo(
    () => resolveBudgets(config, monthKey),
    [config, monthKey],
  );

  const [flowMode, setFlowMode] = useState('expense');
  const isExpense = flowMode === 'expense';

  const catData = useMemo(
    () => (isExpense ? expensesByCategory(transactions) : incomeByCategory(transactions)),
    [transactions, isExpense],
  );
  const total = useMemo(
    () => (isExpense ? totalExpenses(transactions) : totalIncome(transactions)),
    [transactions, isExpense],
  );
  const prevCatData = useMemo(
    () => (isExpense ? expensesByCategory(prevTransactions) : incomeByCategory(prevTransactions)),
    [prevTransactions, isExpense],
  );
  const anomalies = useMemo(
    () => (isExpense
      ? detectAnomalies(transactions, prevTransactions.length ? [prevTransactions] : [])
      : []),
    [transactions, prevTransactions, isExpense],
  );

  const [viewMode, setViewMode] = useState('bar');
  const [drillCategory, setDrillCategory] = useState(null);

  const handleCategorySelect = useCallback((cat) => {
    setDrillCategory(cat);
  }, []);

  // Transactions for drill-down — scoped to the active flow (expense or income)
  const drillTransactions = useMemo(() => {
    if (!drillCategory) return [];
    const flowType = isExpense ? 'expense' : 'income';
    return transactions.filter((t) => {
      if (t.type !== flowType) return false;
      const tc = t.category || 'Uncategorized';
      return tc === drillCategory || (drillCategory === 'Uncategorized' && !t.category);
    });
  }, [drillCategory, transactions, isExpense]);

  return (
    <div className="animate-fade-in">
      <MonthSelector
        months={cycleLabels}
        selectedMonth={activeCycle?.label}
        onSelectMonth={selectCycle}
        hasMore={hasMore}
        onLoadMore={loadMore}
      />

      {/* Controls: flow toggle (Expenses/Income) on the left, chart view icons on the right */}
      <div className="flex items-center gap-2 mx-4 mt-2 mb-4">
        <div className="flex-1 flex gap-1 bg-surface rounded-full p-1 border border-border">
          <button
            onClick={() => { setFlowMode('expense'); setDrillCategory(null); }}
            className={`flex-1 rounded-full py-2 text-sm font-medium transition-colors ${
              isExpense ? 'bg-green text-white' : 'text-text-muted hover:text-text'
            }`}
            style={{ minHeight: 36 }}
          >
            Expenses
          </button>
          <button
            onClick={() => { setFlowMode('income'); setDrillCategory(null); }}
            className={`flex-1 rounded-full py-2 text-sm font-medium transition-colors ${
              !isExpense ? 'bg-green text-white' : 'text-text-muted hover:text-text'
            }`}
            style={{ minHeight: 36 }}
          >
            Income
          </button>
        </div>
        <div className="flex gap-1 bg-surface rounded-full p-1 border border-border shrink-0">
          <button
            onClick={() => setViewMode('pie')}
            aria-label="Pie view"
            title="Pie view"
            className={`rounded-full w-9 h-9 flex items-center justify-center transition-colors ${
              viewMode === 'pie' ? 'bg-green text-white' : 'text-text-muted hover:text-text'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
              <path d="M22 12A10 10 0 0 0 12 2v10z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('bar')}
            aria-label="Bar view"
            title="Bar view"
            className={`rounded-full w-9 h-9 flex items-center justify-center transition-colors ${
              viewMode === 'bar' ? 'bg-green text-white' : 'text-text-muted hover:text-text'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="20" x2="4" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="20" y1="20" x2="20" y2="14" />
            </svg>
          </button>
        </div>
      </div>

      {/* Budget summary header — only in expense + bar mode with budgets */}
      {isExpense && viewMode === 'bar' && Object.keys(budgets).length > 0 && (() => {
        const totalBudget = Object.values(budgets).reduce((a, b) => a + b, 0);
        const budgetedSpend = Object.entries(catData).reduce((sum, [cat, amt]) => {
          return budgets[cat?.toLowerCase()] ? sum + amt : sum;
        }, 0);
        const overCount = Object.entries(catData).filter(([cat, amt]) => {
          const b = budgets[cat?.toLowerCase()];
          return b > 0 && amt > b;
        }).length;
        const pctUsed = totalBudget > 0 ? Math.round((budgetedSpend / totalBudget) * 100) : 0;
        return (
          <div className="mx-4 mb-4 px-4 py-3 bg-surface border border-border rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-text-muted">Budget used</span>
              <span className={`font-mono text-sm font-semibold ${pctUsed > 100 ? 'text-orange' : 'text-green'}`}>
                {formatKES(budgetedSpend)} / {formatKES(totalBudget)}
              </span>
            </div>
            <div className="w-full h-2 bg-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(pctUsed, 100)}%`, backgroundColor: pctUsed > 100 ? '#E8845A' : '#52B788' }}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[11px] text-text-muted">{pctUsed}% used</span>
              {overCount > 0 && (
                <span className="text-[11px] text-orange font-medium">
                  {overCount} categor{overCount > 1 ? 'ies' : 'y'} over budget
                </span>
              )}
            </div>
          </div>
        );
      })()}

      {/* Anomaly banner */}
      {anomalies.length > 0 && (
        <div className="mx-4 mb-4 px-3 py-2 bg-orange/10 border border-orange/30 rounded-lg">
          <p className="text-xs text-orange font-medium">
            ⚠️ {anomalies.length} categor{anomalies.length > 1 ? 'ies' : 'y'} with unusual spending
          </p>
        </div>
      )}

      <div className="pb-24">
        {/* Chart / Bar view */}
        {loading && !Object.keys(catData).length ? (
          viewMode === 'pie' ? <SkeletonPie /> : <SkeletonBars />
        ) : viewMode === 'pie' ? (
          <div className="px-4">
            <CategoryPieChart data={catData} onCategorySelect={handleCategorySelect} />
          </div>
        ) : (
          <CategoryBarList
            data={catData}
            total={total}
            previousData={prevCatData}
            anomalies={anomalies}
            onCategorySelect={handleCategorySelect}
            budgets={isExpense ? budgets : {}}
          />
        )}

      </div>

      {/* Drill-down sheet */}
      <CategoryDrillDown
        category={drillCategory}
        transactions={drillTransactions}
        isOpen={!!drillCategory}
        onClose={() => setDrillCategory(null)}
      />
    </div>
  );
}
