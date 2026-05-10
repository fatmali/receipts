import { useState, useMemo } from 'react';
import { useMeta, useSummary, useSalaryCycles, useSyncStatus, useConfig } from '../../api/hooks.js';
import { generateInsights } from '../../compute/insights.js';
import { detectRecurring, totalRecurringAnnual } from '../../compute/recurring.js';
import { totalSavings, totalSpending } from '../../compute/metrics.js';
import { formatKES } from '../../lib/format.js';
import MonthSelector from '../MonthSelector.jsx';
import PullToRefresh from '../PullToRefresh.jsx';
import SyncIndicator from '../SyncIndicator.jsx';
import HeroStrip from './HeroStrip.jsx';
import TrendChart from './TrendChart.jsx';
import InsightsStrip from './InsightsStrip.jsx';
import FulizaCard from './FulizaCard.jsx';

function SkeletonCard() {
  return <div className="bg-surface border border-border rounded-xl h-24 animate-pulse min-w-0" />;
}

function SkeletonChart() {
  return <div className="bg-surface border border-border rounded-xl h-[220px] animate-pulse mx-4" />;
}

function SkeletonStrip() {
  return (
    <div className="flex gap-3 px-4 overflow-hidden">
      <div className="bg-surface border border-border rounded-xl h-16 w-[60%] shrink-0 animate-pulse" />
      <div className="bg-surface border border-border rounded-xl h-16 w-[50%] shrink-0 animate-pulse" />
    </div>
  );
}

export default function OverviewTab() {
  const { data: meta } = useMeta();
  const { data: summaryData, loading: summaryLoading, error: summaryError, refresh: refreshSummary } = useSummary();
  const { data: config } = useConfig();
  const { lastSync, isOnline } = useSyncStatus();

  const months = meta?.availableMonths || [];
  const { cycles, activeCycle, prevCycle, selectCycle, hasMore, loadMore, loading: cyclesLoading, refresh: refreshCycles } = useSalaryCycles(months);

  const currentTransactions = activeCycle?.transactions || [];
  const previousTransactions = prevCycle?.transactions || [];

  // Recurring transactions
  const recurring = useMemo(() => {
    const allTxns = [...currentTransactions, ...previousTransactions];
    if (!allTxns.length) return [];
    return detectRecurring(allTxns);
  }, [currentTransactions, previousTransactions]);

  const annualRecurring = useMemo(() => totalRecurringAnnual(recurring), [recurring]);

  // Generate insights
  const insights = useMemo(() => {
    if (!currentTransactions.length) return [];
    return generateInsights(
      { transactions: currentTransactions, month: activeCycle?.startDate?.slice(0, 7) },
      previousTransactions.length ? { transactions: previousTransactions } : null,
      summaryData?.months || [],
      recurring,
      { wealth: config?.wealth },
    );
  }, [currentTransactions, previousTransactions, activeCycle, config?.wealth, summaryData, recurring]);

  // Savings goal
  const savingsGoal = config?.savingsGoal ? Number(config.savingsGoal) : 0;
  const currentSavings = useMemo(() => {
    if (!currentTransactions.length) return 0;
    return totalSavings(currentTransactions);
  }, [currentTransactions]);

  const [recurringOpen, setRecurringOpen] = useState(false);

  const handleRefresh = async () => {
    await Promise.all([refreshSummary(), refreshCycles()]);
  };

  const isLoading = summaryLoading || cyclesLoading;
  const cycleLabels = useMemo(() => cycles.map(c => c.label), [cycles]);

  return (
    <div className="animate-fade-in">
      {/* Period selector */}
      <MonthSelector
        months={cycleLabels}
        selectedMonth={activeCycle?.label}
        onSelectMonth={selectCycle}
        loading={cyclesLoading && !cycles.length}
        hasMore={hasMore}
        onLoadMore={loadMore}
      />
      <SyncIndicator lastSyncTime={lastSync} isOnline={isOnline} />

      <PullToRefresh onRefresh={handleRefresh} disabled={!isOnline}>
        <div className="flex flex-col gap-8 pb-28">
          {/* Error banner */}
          {summaryError && (
            <div className="mx-4 bg-orange/10 border border-orange/30 rounded-2xl p-5">
              <div className="flex items-center gap-2.5 mb-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p className="text-sm text-orange font-medium">Data refresh failed</p>
              </div>
              <p className="text-xs text-text-muted mb-3">
                {summaryError?.message || 'Unknown error'}
              </p>
              <button
                onClick={handleRefresh}
                className="text-xs text-orange underline"
              >
                Retry
              </button>
            </div>
          )}

          {/* Hero cards */}
          {isLoading && !currentTransactions.length ? (
            <div className="grid grid-cols-2 gap-4 px-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : (
            <HeroStrip
              currentMonth={currentTransactions}
              previousMonth={previousTransactions.length ? previousTransactions : null}
            />
          )}

          {/* Trend chart */}
          {isLoading && !currentTransactions.length ? (
            <SkeletonChart />
          ) : (
            <TrendChart transactions={currentTransactions} title={activeCycle?.label || 'This Cycle'} />
          )}

          {/* Insights */}
          {isLoading && !insights.length ? (
            <SkeletonStrip />
          ) : (
            <InsightsStrip insights={insights} />
          )}

          {/* Emergency Fund */}
          {(() => {
            const emergency = config?.wealth?.existing?.emergency || 0;
            const spending = totalSpending(currentTransactions);
            if (!emergency || !spending) return null;
            // Normalize cycle spending to monthly
            const txnDates = currentTransactions.map(t => new Date(t.date).getTime());
            const spanDays = txnDates.length >= 2
              ? Math.max((Math.max(...txnDates) - Math.min(...txnDates)) / (1000 * 60 * 60 * 24), 1)
              : 30;
            const monthlySpend = (spending / spanDays) * 30;
            const months = monthlySpend > 0 ? emergency / monthlySpend : 0;
            const color = months >= 6 ? 'text-green' : months >= 3 ? 'text-yellow-400' : 'text-orange';
            return (
              <div className="px-4">
                <div className="bg-surface border border-border rounded-2xl p-5">
                  <div className="flex items-center gap-2.5 mb-3">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <p className="text-xs text-text-muted font-medium uppercase tracking-wide">Emergency Fund</p>
                  </div>
                  <p className={`text-2xl font-heading font-semibold ${color}`}>
                    {months.toFixed(1)} months
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    {formatKES(emergency)} covers ~{months.toFixed(1)} months of spending
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Savings Goal */}
          {savingsGoal > 0 && (
            <div className="px-4">
              <div className="bg-surface border border-border rounded-2xl p-5">
                <div className="flex items-center gap-2.5 mb-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                    <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
                  </svg>
                  <p className="text-xs text-text-muted font-medium uppercase tracking-wide">Savings Goal</p>
                </div>
                <div className="w-full h-2.5 bg-border rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full bg-green transition-all duration-500"
                    style={{ width: `${Math.min((currentSavings / savingsGoal) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-sm text-text-muted font-mono">
                  {formatKES(currentSavings)} of {formatKES(savingsGoal)}
                </p>
              </div>
            </div>
          )}

          {/* Recurring Expenses */}
          {recurring.length > 0 && (
            <div className="px-4">
              <button
                onClick={() => setRecurringOpen(!recurringOpen)}
                className="w-full bg-surface border border-border rounded-2xl p-5 text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                      <polyline points="23 4 23 10 17 10" />
                      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
                    </svg>
                    <span className="font-heading text-sm font-medium text-text">Recurring Expenses</span>
                    <span className="bg-border text-text-muted text-[10px] font-mono px-2 py-0.5 rounded-full">{recurring.length}</span>
                  </div>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={`text-text-muted transition-transform ${recurringOpen ? 'rotate-180' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </button>
              {recurringOpen && (
                <div className="bg-surface border border-t-0 border-border rounded-b-2xl overflow-hidden -mt-3 pt-3">
                  {recurring.map((r, i) => (
                    <div key={i} className="flex items-center justify-between px-5 py-3.5 border-b border-border last:border-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-text truncate">{r.description}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          r.frequency === 'monthly' ? 'bg-green/10 text-green' : 'bg-blue/10 text-blue'
                        }`}>
                          {r.frequency}
                        </span>
                      </div>
                      <span className="font-mono text-sm text-text shrink-0 ml-3">
                        {formatKES(r.amount)}
                      </span>
                    </div>
                  ))}
                  <div className="px-4 py-3 border-t border-border">
                    <p className="text-xs text-text-muted">
                      Total annual cost: <span className="font-mono font-semibold text-text">{formatKES(annualRecurring)}</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fuliza */}
          <FulizaCard transactions={currentTransactions} currentMonth={activeCycle?.startDate?.slice(0, 7)} />
        </div>
      </PullToRefresh>
    </div>
  );
}
