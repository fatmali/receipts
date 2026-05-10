// Month-over-month trend computations

import { totalIncome, totalExpenses, totalSavings, netCashFlow } from './metrics.js';

export function deltaAmount(current, previous) {
  return (Number(current) || 0) - (Number(previous) || 0);
}

export function deltaPercent(current, previous) {
  const prev = Number(previous) || 0;
  if (prev === 0) return null;
  const curr = Number(current) || 0;
  return ((curr - prev) / prev) * 100;
}

export function monthOverMonth(summaryData) {
  if (!summaryData?.length) return [];

  const result = [];
  for (let i = 0; i < summaryData.length; i++) {
    const entry = summaryData[i];
    const txns = entry.transactions || [];
    const income = totalIncome(txns);
    const expenses = totalExpenses(txns);
    const net = netCashFlow(txns);
    const saved = totalSavings(txns);
    const rate = income > 0 ? (saved / income) * 100 : null;

    const row = {
      month: entry.month,
      income,
      expenses,
      net,
      savingsRate: rate,
      incomeDelta: null,
      expenseDelta: null,
      netDelta: null,
      savingsRateDelta: null,
    };

    if (i > 0) {
      const prev = result[i - 1];
      row.incomeDelta = deltaPercent(income, prev.income);
      row.expenseDelta = deltaPercent(expenses, prev.expenses);
      row.netDelta = deltaAmount(net, prev.net);
      row.savingsRateDelta = prev.savingsRate != null && rate != null
        ? deltaAmount(rate, prev.savingsRate)
        : null;
    }

    result.push(row);
  }

  return result;
}
