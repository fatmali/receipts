import { useMemo } from 'react';
import { useMeta, useSummary, useSalaryCycles, useConfig } from '../../api/hooks.js';
import { useReviews } from '../../api/useReviews.js';
import { resolveBudgets } from '../../compute/budgets.js';
import { netCashFlow } from '../../compute/metrics.js';
import { detectRecurring } from '../../compute/recurring.js';
import { identityFromHistory, projectWealth, projectFullWealth, computeSavingsStreak, computeBudgetSummary } from '../../compute/coach.js';
import IdentityCard from './IdentityCard.jsx';
import MonthlyRecap from './MonthlyRecap.jsx';
import WealthProjection from './WealthProjection.jsx';
import StreakCards from './StreakCards.jsx';
import WorthItLog from './WorthItLog.jsx';
import BudgetSummary from './BudgetSummary.jsx';

export default function CoachTab() {
  const { data: meta } = useMeta();
  const { data: summary } = useSummary();
  const { data: config } = useConfig();

  const months = meta?.availableMonths || [];
  const { cycles } = useSalaryCycles(months);

  // Use last 4 cycles for identity/streak analysis
  const monthsData = useMemo(() => {
    return cycles.slice(-4).map(c => ({
      month: c.startDate?.slice(0, 7) || '',
      label: c.label,
      transactions: c.transactions,
    }));
  }, [cycles]);

  const savingsGoal = config?.savingsGoal ? Number(config.savingsGoal) : 0;

  const identity = useMemo(() => identityFromHistory(monthsData, savingsGoal, config?.wealth), [monthsData, savingsGoal, config?.wealth]);

  // Average monthly net (savings) over last 4 cycles for projection
  const avgMonthlyNet = useMemo(() => {
    if (!monthsData.length) return 0;
    const nets = monthsData.map(m => netCashFlow(m.transactions));
    return nets.reduce((a, b) => a + b, 0) / nets.length;
  }, [monthsData]);

  // Full wealth projection with existing assets and pre-paycheck savings
  const wealthProjection = useMemo(
    () => projectFullWealth({
      monthlyNet: Math.max(0, avgMonthlyNet),
      years: 5,
      wealth: config?.wealth || {},
    }),
    [avgMonthlyNet, config?.wealth],
  );

  const streak = useMemo(
    () => computeSavingsStreak(monthsData, savingsGoal),
    [monthsData, savingsGoal],
  );

  // Pool all transactions across recent months for the Worth-It log
  const allRecentTxns = useMemo(
    () => monthsData.flatMap(m => m.transactions),
    [monthsData],
  );
  const recurring = useMemo(() => detectRecurring(allRecentTxns), [allRecentTxns]);

  // Budgets for current cycle
  const currentMonthKey = monthsData[monthsData.length - 1]?.month;
  const budgets = useMemo(
    () => resolveBudgets(config, currentMonthKey),
    [config, currentMonthKey],
  );

  // Budget summary — overspend analysis across all recent months
  const budgetSummary = useMemo(
    () => computeBudgetSummary(monthsData, budgets),
    [monthsData, budgets],
  );

  const { reviews, save: saveReviewFn } = useReviews();

  const isLoading = !meta || !summary || !config;

  return (
    <div className="animate-fade-in" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <header className="px-4 pt-6 pb-4">
        <h1 className="font-heading text-2xl font-semibold text-text">Coach</h1>
        <p className="text-text-muted text-sm mt-1">Reflections on your money story</p>
      </header>

      {isLoading ? (
        <div className="px-4">
          <div className="bg-surface border border-border rounded-2xl p-6 animate-pulse">
            <div className="h-6 bg-border rounded w-3/4" />
          </div>
        </div>
      ) : (
        <div className="space-y-6 pb-8">
          <IdentityCard sentence={identity.sentence} tone={identity.tone} />
          <MonthlyRecap monthsData={monthsData} savingsGoal={savingsGoal} />
          <StreakCards streak={streak} savingsGoal={savingsGoal} />
          <BudgetSummary budgetSummary={budgetSummary} />
          <WealthProjection
            monthlyNet={Math.max(0, avgMonthlyNet)}
            wealthProjection={wealthProjection}
            wealth={config?.wealth}
          />
          <WorthItLog
            allTransactions={allRecentTxns}
            recurring={recurring}
            budgets={budgets}
            reviews={reviews}
            onVerdict={saveReviewFn}
          />
        </div>
      )}
    </div>
  );
}
