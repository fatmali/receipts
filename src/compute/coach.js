// Coach tab — pure functions for behaviour analysis

import { totalIncome, totalSavings, expensesByCategory, topCategory } from './metrics.js';

/**
 * Generate a one-sentence identity statement from recent history.
 * When wealth config is available, incorporates total net worth context.
 *
 * @param {Array<{month: string, transactions: Array, salary?: number}>} monthsData - last N months sorted oldest→newest
 * @param {number} savingsGoal - monthly savings goal
 * @param {Object} [wealth] - wealth config with existing assets and pre-paycheck savings
 * @returns {{ sentence: string, tone: 'positive'|'neutral'|'honest' }}
 */
export function identityFromHistory(monthsData, savingsGoal = 0, wealth = null) {
  if (!monthsData?.length) {
    return { sentence: "Your money story is just beginning. Keep going.", tone: 'neutral' };
  }

  const recent = monthsData.slice(-4);
  const rates = recent
    .map(m => {
      const income = totalIncome(m.transactions || []);
      const saved = totalSavings(m.transactions || []);
      return income > 0 ? (saved / income) * 100 : null;
    })
    .filter(r => r != null);

  if (!rates.length) {
    return { sentence: "Not enough history yet \u2014 let's build a few months of data.", tone: 'neutral' };
  }

  const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
  const monthsAboveGoal = recent.filter(m => {
    const saved = totalSavings(m.transactions || []);
    return savingsGoal > 0 ? saved >= savingsGoal : false;
  }).length;

  // Trend: is savings rate improving?
  const trending = rates.length >= 3
    ? rates[rates.length - 1] > rates[0]
    : null;

  // Calculate total net worth if wealth config available
  const existing = wealth?.existing || {};
  const netWorth = (existing.investments || 0) + (existing.espp || 0)
    + (existing.pension || 0) + (existing.emergency || 0) + (existing.homeFund || 0);

  // Calculate total savings rate including pre-paycheck deductions
  const pre = wealth?.prePaycheck || {};
  const monthlyPrePaycheck = (pre.espp || 0) + (pre.pension || 0);
  const grossSalary = wealth?.grossSalary || 0;

  // Full savings rate: (pre-paycheck + actual savings) / gross
  // Normalize cycle savings to a monthly rate using actual cycle durations
  let fullSavingsRate = null;
  if (grossSalary > 0 && recent.length > 0) {
    // Sum savings and total days across cycles, then derive monthly average
    let totalSaved = 0;
    let totalDays = 0;
    for (const m of recent) {
      totalSaved += totalSavings(m.transactions || []);
      if (m.transactions?.length) {
        const dates = m.transactions.map(t => new Date(t.date).getTime());
        const span = (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24);
        totalDays += Math.max(span, 1);
      }
    }
    const avgMonthlySaved = totalDays > 0 ? (totalSaved / totalDays) * 30 : 0;
    fullSavingsRate = ((monthlyPrePaycheck + avgMonthlySaved) / grossSalary) * 100;
  }

  // Look at top categories across recent months
  const allTxns = recent.flatMap(m => m.transactions || []);
  const top = topCategory(allTxns);
  const cats = expensesByCategory(allTxns);
  const totalExp = Object.values(cats).reduce((a, b) => a + b, 0);
  const topShare = top && totalExp > 0 ? (cats[top] / totalExp) * 100 : 0;

  // Check for Fuliza usage — a key behaviour signal
  const fulizaSpend = (cats['overdraft'] || 0) + (cats['debt'] || 0);
  const hasFuliza = fulizaSpend > 0;

  // Pick the most informative sentence — wealth-aware
  if (fullSavingsRate != null && fullSavingsRate >= 50 && monthsAboveGoal >= 3) {
    return {
      sentence: `You're saving ${Math.round(fullSavingsRate)}% of gross income on average — wealth is being built every pay cycle.`,
      tone: 'positive',
    };
  }

  if (monthsAboveGoal >= 3) {
    return {
      sentence: `You're someone who hits their savings goal — ${monthsAboveGoal} of the last 4 months above target.`,
      tone: 'positive',
    };
  }

  if (fullSavingsRate != null && fullSavingsRate >= 40) {
    return {
      sentence: `You're saving ${Math.round(fullSavingsRate)}% of gross on average — ESPP, pension, and cash working in concert.`,
      tone: 'positive',
    };
  }

  if (avgRate >= 30) {
    return {
      sentence: `You're a strong saver — averaging ${Math.round(avgRate)}% savings rate over the last ${rates.length} months.`,
      tone: 'positive',
    };
  }

  if (hasFuliza && avgRate >= 15) {
    return {
      sentence: `Saving well overall, but Fuliza is leaking value. Breaking that cycle is your next unlock.`,
      tone: 'neutral',
    };
  }

  if (avgRate >= 15 && trending) {
    return {
      sentence: `You're growing into a saver — savings rate trending up, now at ${Math.round(avgRate)}%.`,
      tone: 'positive',
    };
  }

  if (avgRate >= 10) {
    return {
      sentence: `You're holding steady — averaging ${Math.round(avgRate)}% savings rate. Small lifts compound.`,
      tone: 'neutral',
    };
  }

  if (avgRate < 0) {
    return {
      sentence: `You're spending more than you earn lately. One month at a time — what's one expense to cut?`,
      tone: 'honest',
    };
  }

  if (topShare >= 30 && top) {
    return {
      sentence: `Your spending tells a story of ${top.toLowerCase()} — ${Math.round(topShare)}% of expenses go there.`,
      tone: 'honest',
    };
  }

  return {
    sentence: `You're saving ${Math.round(avgRate)}% on average. Worth aiming for 20%?`,
    tone: 'neutral',
  };
}

/**
 * Project wealth accumulation over N years given current monthly net.
 * Supports an optional annual return rate for compound growth.
 *
 * @param {number} monthlyNet - average monthly savings (income - expenses)
 * @param {number} years
 * @param {number} startingWealth - current accumulated savings (default 0)
 * @param {number} annualReturn - annual return rate as decimal, e.g. 0.08 for 8% (default 0)
 * @returns {Array<{ year: number, wealth: number }>}
 */
export function projectWealth(monthlyNet, years, startingWealth = 0, annualReturn = 0) {
  if (years <= 0) return [];
  const data = [];
  let accumulated = startingWealth;
  data.push({ year: 0, wealth: Math.max(0, Math.round(accumulated)) });
  for (let y = 1; y <= years; y++) {
    // Previous balance grows by annual return, plus 12 months of new savings
    accumulated = accumulated * (1 + annualReturn) + monthlyNet * 12;
    data.push({ year: y, wealth: Math.max(0, Math.round(accumulated)) });
  }
  return data;
}

/**
 * Full wealth projection combining all savings streams.
 * Uses wealth config (existing assets + pre-paycheck deductions) for accuracy.
 *
 * @param {Object} params
 * @param {number} params.monthlyNet - post-paycheck monthly savings
 * @param {number} params.years - projection horizon
 * @param {Object} params.wealth - wealth config from API
 * @param {number} params.annualReturn - assumed return rate (default 0.08)
 * @returns {{ data: Array<{ year, wealth, invested, pension, cash }>, totals: Object }}
 */
export function projectFullWealth({ monthlyNet, years, wealth = {}, annualReturn = 0.08 }) {
  if (years <= 0) return { data: [], totals: {} };

  const existing = wealth.existing || {};
  const pre = wealth.prePaycheck || {};

  // Starting balances
  let invested = (existing.investments || 0) + (existing.espp || 0);
  let pension = existing.pension || 0;
  let cash = (existing.emergency || 0) + (existing.homeFund || 0);

  // Monthly contributions
  const monthlyEspp = pre.espp || 0;
  const monthlyPension = pre.pension || 0;

  const data = [];
  data.push({
    year: 0,
    wealth: Math.round(invested + pension + cash),
    invested: Math.round(invested),
    pension: Math.round(pension),
    cash: Math.round(cash),
  });

  for (let y = 1; y <= years; y++) {
    // Invested assets grow + ESPP contributions
    invested = invested * (1 + annualReturn) + (monthlyEspp * 12);
    // Pension grows + employer contributions
    pension = pension * (1 + annualReturn) + (monthlyPension * 12);
    // Cash savings from post-paycheck (conservative, lower return)
    cash = cash * (1 + annualReturn * 0.5) + (monthlyNet * 12);

    data.push({
      year: y,
      wealth: Math.max(0, Math.round(invested + pension + cash)),
      invested: Math.max(0, Math.round(invested)),
      pension: Math.max(0, Math.round(pension)),
      cash: Math.max(0, Math.round(cash)),
    });
  }

  const final = data[data.length - 1];
  return {
    data,
    totals: {
      starting: data[0].wealth,
      final: final.wealth,
      totalContributed: (monthlyEspp + monthlyPension + monthlyNet) * 12 * years,
      totalReturns: final.wealth - data[0].wealth - (monthlyEspp + monthlyPension + monthlyNet) * 12 * years,
    },
  };
}

/**
 * Compute current and longest streaks for hitting savings goal.
 *
 * @param {Array<{month: string, transactions: Array, salary?: number}>} monthsData - sorted oldest→newest
 * @param {number} savingsGoal
 * @returns {{ current: number, longest: number, total: number }}
 */
export function computeSavingsStreak(monthsData, savingsGoal) {
  if (!monthsData?.length || !savingsGoal || savingsGoal <= 0) {
    return { current: 0, longest: 0, total: 0 };
  }

  const hits = monthsData.map(m => {
    const saved = totalSavings(m.transactions || []);
    return saved >= savingsGoal;
  });

  let current = 0;
  let longest = 0;
  let run = 0;
  let total = 0;

  for (const hit of hits) {
    if (hit) {
      run++;
      total++;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }

  // Current streak = trailing run from the end
  for (let i = hits.length - 1; i >= 0; i--) {
    if (hits[i]) current++;
    else break;
  }

  return { current, longest, total };
}

/**
 * Compute streaks for staying under each budget.
 *
 * @param {Array<{month: string, transactions: Array}>} monthsData
 * @param {Object} budgets - { category: amount } (resolved per-month if needed by caller)
 * @returns {Object} { category: { current, longest, total } }
 */
export function computeBudgetStreaks(monthsData, budgets) {
  if (!monthsData?.length || !budgets) return {};
  const result = {};

  for (const cat of Object.keys(budgets)) {
    const limit = budgets[cat];
    if (!limit || limit <= 0) continue;

    const hits = monthsData.map(m => {
      const cats = expensesByCategory(m.transactions || []);
      return (cats[cat] || 0) <= limit;
    });

    let current = 0;
    let longest = 0;
    let run = 0;
    let total = 0;

    for (const hit of hits) {
      if (hit) {
        run++;
        total++;
        if (run > longest) longest = run;
      } else {
        run = 0;
      }
    }

    for (let i = hits.length - 1; i >= 0; i--) {
      if (hits[i]) current++;
      else break;
    }

    result[cat] = { current, longest, total };
  }

  return result;
}

/**
 * Compute a budget summary across months: top spend categories, how often
 * each goes over budget, and how much would be saved by staying within budget.
 *
 * @param {Array<{month: string, transactions: Array}>} monthsData - sorted oldest→newest
 * @param {Object} budgets - { category: amount } resolved budget limits
 * @returns {{
 *   categories: Array<{
 *     category: string,
 *     budget: number,
 *     totalSpent: number,
 *     avgSpent: number,
 *     monthsOver: number,
 *     totalMonths: number,
 *     totalOverspend: number,
 *     annualOverspend: number,
 *   }>,
 *   totalOverspendAllMonths: number,
 *   annualOverspend: number,
 * }}
 */
export function computeBudgetSummary(monthsData, budgets) {
  if (!monthsData?.length || !budgets || !Object.keys(budgets).length) {
    return { categories: [], totalOverspendAllMonths: 0, annualOverspend: 0 };
  }

  const totalMonths = monthsData.length;
  const catMap = {};

  for (const cat of Object.keys(budgets)) {
    const limit = budgets[cat];
    if (!limit || limit <= 0) continue;
    catMap[cat] = { category: cat, budget: limit, monthsOver: 0, totalSpent: 0, totalOverspend: 0 };
  }

  for (const m of monthsData) {
    const cats = expensesByCategory(m.transactions || []);
    for (const [cat, entry] of Object.entries(catMap)) {
      const spent = cats[cat] || 0;
      entry.totalSpent += spent;
      if (spent > entry.budget) {
        entry.monthsOver++;
        entry.totalOverspend += spent - entry.budget;
      }
    }
  }

  let totalOverspendAllMonths = 0;
  const categories = Object.values(catMap)
    .map(e => {
      const avgSpent = e.totalSpent / totalMonths;
      const annualOverspend = totalMonths > 0
        ? (e.totalOverspend / totalMonths) * 12
        : 0;
      totalOverspendAllMonths += e.totalOverspend;
      return {
        category: e.category,
        budget: e.budget,
        totalSpent: e.totalSpent,
        avgSpent: Math.round(avgSpent),
        monthsOver: e.monthsOver,
        totalMonths,
        totalOverspend: e.totalOverspend,
        annualOverspend: Math.round(annualOverspend),
      };
    })
    .sort((a, b) => b.totalOverspend - a.totalOverspend);

  const annualOverspend = totalMonths > 0
    ? Math.round((totalOverspendAllMonths / totalMonths) * 12)
    : 0;

  return { categories, totalOverspendAllMonths, annualOverspend };
}
