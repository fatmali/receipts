// Computed insight strings

import { formatKES } from '../lib/format.js';
import { totalIncome, totalExpenses, totalFees, feesByCategory, topCategory, expensesByCategory, totalSavings, fulizaDaysThisMonth, balanceHistory } from './metrics.js';
import { totalRecurringAnnual } from './recurring.js';

function mostExpensiveDay(transactions) {
  if (!transactions?.length) return null;
  const byDay = {};
  for (const t of transactions) {
    if (t.type !== 'expense' || !t.date) continue;
    const day = t.date.slice(0, 10);
    byDay[day] = (byDay[day] || 0) + (Number(t.amount) || 0);
  }
  let best = null;
  let max = 0;
  for (const [day, total] of Object.entries(byDay)) {
    if (total > max) {
      max = total;
      best = day;
    }
  }
  if (!best) return null;
  const d = new Date(best);
  const dayName = d.toLocaleDateString('en-KE', { weekday: 'short' });
  const dateStr = d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
  return { dayName, dateStr, amount: max };
}

function topMerchant(transactions) {
  if (!transactions?.length) return null;
  const byDesc = {};
  const countByDesc = {};
  for (const t of transactions) {
    if (t.type !== 'expense') continue;
    const desc = (t.description || '').trim();
    if (!desc) continue;
    byDesc[desc] = (byDesc[desc] || 0) + (Number(t.amount) || 0);
    countByDesc[desc] = (countByDesc[desc] || 0) + 1;
  }
  let best = null;
  let max = 0;
  for (const [desc, total] of Object.entries(byDesc)) {
    if (total > max) {
      max = total;
      best = desc;
    }
  }
  if (!best) return null;
  return { description: best, amount: max, count: countByDesc[best] };
}

export function generateInsights(currentMonth, previousMonth, allMonths, recurring, { wealth = null } = {}) {
  const insights = [];
  const txns = currentMonth?.transactions || [];
  const month = currentMonth?.month || '';

  // 1. Top spend category
  const top = topCategory(txns);
  if (top) {
    const cats = expensesByCategory(txns);
    insights.push({ label: 'Top spend', value: formatKES(cats[top]), detail: top, tone: 'neutral', icon: 'category' });
  }

  // 2. Fuliza days
  const fDays = fulizaDaysThisMonth(txns, month);
  if (fDays > 0) {
    insights.push({ label: 'Fuliza days', value: String(fDays), detail: fDays > 5 ? 'heavy usage' : 'this month', tone: fDays > 10 ? 'negative' : 'warning', icon: 'alert' });
  }

  // 2b. Fuliza cost
  const cats = expensesByCategory(txns);
  const fulizaCost = (cats['overdraft'] || 0) + (cats['debt'] || 0);
  if (fulizaCost > 0) {
    insights.push({ label: 'Fuliza cost', value: formatKES(fulizaCost), detail: 'overdraft + debt', tone: 'negative', icon: 'trending-down' });
  }

  // 3. Recurring annual cost
  if (recurring?.length) {
    const annual = totalRecurringAnnual(recurring);
    const monthly = Math.round(annual / 12);
    insights.push({ label: 'Subscriptions', value: `${formatKES(monthly)}/mo`, detail: `${formatKES(annual)}/yr`, tone: 'neutral', icon: 'refresh' });
  }

  // 4. Savings rate change
  const currIncome = totalIncome(txns);
  const currSaved = totalSavings(txns);
  const currRate = currIncome > 0 ? (currSaved / currIncome) * 100 : null;
  if (previousMonth?.transactions?.length) {
    const prevInc = totalIncome(previousMonth.transactions);
    const prevSaved = totalSavings(previousMonth.transactions);
    const prevRate = prevInc > 0 ? (prevSaved / prevInc) * 100 : null;
    if (currRate != null && prevRate != null) {
      const cr = Math.round(currRate);
      const pr = Math.round(prevRate);
      if (cr !== pr) {
        const improved = cr > pr;
        insights.push({ label: 'Savings rate', value: `${cr}%`, detail: `${improved ? '↑' : '↓'} from ${pr}%`, tone: improved ? 'positive' : 'negative', icon: improved ? 'trending-up' : 'trending-down' });
      }
    }
  }

  // 5. Most expensive day
  const expDay = mostExpensiveDay(txns);
  if (expDay) {
    insights.push({ label: 'Biggest day', value: formatKES(expDay.amount), detail: `${expDay.dayName} ${expDay.dateStr}`, tone: 'neutral', icon: 'calendar' });
  }

  // 6. Best month
  if (allMonths?.length > 1) {
    let bestMonth = null;
    let bestRate = -Infinity;
    for (const m of allMonths) {
      let r = m.savingsRate != null ? Number(m.savingsRate) : null;
      if (r == null && m.transactions?.length) {
        const inc = totalIncome(m.transactions);
        const sav = totalSavings(m.transactions);
        r = inc > 0 ? (sav / inc) * 100 : null;
      }
      if (r != null && !isNaN(r) && r > bestRate) {
        bestRate = r;
        bestMonth = m.month;
      }
    }
    if (bestMonth && bestMonth !== month) {
      insights.push({ label: 'Best month', value: bestMonth, detail: `${Math.round(bestRate)}% saved`, tone: 'positive', icon: 'target' });
    }
  }

  // 7. Total fees
  const fees = totalFees(txns);
  if (fees > 0) {
    const feeCats = feesByCategory(txns);
    const topFeeCat = Object.entries(feeCats).sort((a, b) => b[1] - a[1])[0];
    const detail = topFeeCat && topFeeCat[0] !== 'uncategorized'
      ? `most on ${topFeeCat[0]}`
      : 'this month';
    insights.push({ label: 'Fees paid', value: formatKES(fees), detail, tone: 'warning', icon: 'coins' });
  }

  // 7b. M-Pesa balance swing
  const mpesaTxns = txns.filter(t => (t.account || '').toLowerCase() === 'mpesa');
  const mpesaBalHist = balanceHistory(mpesaTxns);
  if (mpesaBalHist.length >= 2) {
    const minBal = mpesaBalHist.reduce((min, b) => b.balance < min.balance ? b : min, mpesaBalHist[0]);
    const maxBal = mpesaBalHist.reduce((max, b) => b.balance > max.balance ? b : max, mpesaBalHist[0]);
    if (minBal.balance <= 0 && maxBal.balance > 0) {
      const d = new Date(minBal.date);
      const dateStr = d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
      insights.push({ label: 'M-Pesa low', value: formatKES(minBal.balance), detail: `hit zero on ${dateStr}`, tone: 'negative', icon: 'alert' });
    } else if (maxBal.balance - minBal.balance > 10000) {
      insights.push({ label: 'M-Pesa range', value: `${formatKES(minBal.balance)} – ${formatKES(maxBal.balance)}`, detail: null, tone: 'neutral', icon: 'chart' });
    }
  }

  // 8. Top merchant
  const merchant = topMerchant(txns);
  if (merchant) {
    insights.push({ label: 'Top merchant', value: formatKES(merchant.amount), detail: `${merchant.description} · ${merchant.count}x`, tone: 'neutral', icon: 'building' });
  }

  // 9. Income vs spending
  const totalInc = totalIncome(txns);
  const currSpending = totalExpenses(txns) - totalSavings(txns);
  if (totalInc > 0 || currSpending > 0) {
    const overspent = currSpending > totalInc;
    insights.push({
      label: overspent ? 'Overspent' : 'Net position',
      value: formatKES(Math.abs(totalInc - currSpending)),
      detail: overspent ? 'spent > earned' : 'under budget',
      tone: overspent ? 'negative' : 'positive',
      icon: overspent ? 'trending-down' : 'trending-up',
    });
  }

  return insights.slice(0, 10);
}
