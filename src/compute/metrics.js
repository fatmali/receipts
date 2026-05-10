// Financial metrics — pure functions

const SAVINGS_CATEGORIES = ['savings', 'investment', 'investments'];
const NON_SPENDING_CATEGORIES = ['overdraft', 'debt', 'loan'];
const LOAN_INCOME_PATTERN = /loan\s*disburse/i;

export function totalIncome(transactions) {
  if (!transactions?.length) return 0;
  return transactions
    .filter(t => t.type === 'income' && !LOAN_INCOME_PATTERN.test(t.description || ''))
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
}

export function totalExpenses(transactions) {
  if (!transactions?.length) return 0;
  return transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
}

/**
 * Actual savings: outflows (transfers/expenses) to savings/investment categories.
 * Excludes incoming side of transfers to avoid double-counting across accounts.
 */
export function totalSavings(transactions) {
  if (!transactions?.length) return 0;
  return transactions
    .filter(t => {
      if (t.type === 'income') return false; // skip incoming side of transfers
      return SAVINGS_CATEGORIES.includes((t.category || '').toLowerCase());
    })
    .reduce((sum, t) => sum + (Math.abs(Number(t.amount)) || 0), 0);
}

/**
 * Spending: expenses excluding savings/investment categories.
 */
export function totalSpending(transactions) {
  if (!transactions?.length) return 0;
  return transactions
    .filter(t => {
      if (t.type !== 'expense') return false;
      const cat = (t.category || '').toLowerCase();
      return !SAVINGS_CATEGORIES.includes(cat);
    })
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
}

export function netCashFlow(transactions) {
  return totalIncome(transactions) - totalExpenses(transactions);
}

export function savingsRate(transactions) {
  const income = totalIncome(transactions);
  if (income === 0) return null;
  const saved = totalSavings(transactions);
  return (saved / income) * 100;
}

export function totalFees(transactions) {
  if (!transactions?.length) return 0;
  return transactions.reduce((sum, t) => {
    const cost = Number(t.cost);
    return sum + (cost > 0 ? cost : 0);
  }, 0);
}

export function feesByCategory(transactions) {
  if (!transactions?.length) return {};
  return transactions
    .filter(t => Number(t.cost) > 0)
    .reduce((acc, t) => {
      const cat = t.category || 'uncategorized';
      acc[cat] = (acc[cat] || 0) + Number(t.cost);
      return acc;
    }, {});
}

export function expensesByCategory(transactions) {
  if (!transactions?.length) return {};
  return transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      const cat = t.category ?? '';
      acc[cat] = (acc[cat] || 0) + (Number(t.amount) || 0);
      return acc;
    }, {});
}

export function incomeByCategory(transactions) {
  if (!transactions?.length) return {};
  return transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => {
      const cat = t.category ?? '';
      acc[cat] = (acc[cat] || 0) + (Number(t.amount) || 0);
      return acc;
    }, {});
}

export function topCategory(transactions) {
  const cats = expensesByCategory(transactions);
  let best = '';
  let max = -Infinity;
  for (const [cat, total] of Object.entries(cats)) {
    if (cat === '') continue;
    if (total > max) {
      max = total;
      best = cat;
    }
  }
  return best;
}

export function uncategorizedCount(transactions) {
  if (!transactions?.length) return 0;
  return transactions.filter(t => t.type === 'expense' && t.category === '').length;
}

export function netByAccount(transactions) {
  if (!transactions?.length) return {};
  const acc = {};
  for (const t of transactions) {
    const key = t.account ?? 'unknown';
    if (!acc[key]) acc[key] = { in: 0, out: 0, net: 0 };
    const amt = Number(t.amount) || 0;
    if (t.type === 'income') acc[key].in += amt;
    else if (t.type === 'expense') acc[key].out += amt;
  }
  for (const key of Object.keys(acc)) {
    acc[key].net = acc[key].in - acc[key].out;
  }
  return acc;
}

export function balanceHistory(transactions) {
  if (!transactions?.length) return [];
  return transactions
    .filter(t => t.balance !== '' && t.balance != null && !isNaN(Number(t.balance)))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(t => ({ date: t.date, balance: Number(t.balance) }));
}

export function fulizaOutstanding(transactions) {
  if (!transactions?.length) return 0;

  // Try to get from the latest transaction that has fuliza_outstanding
  const withOutstanding = transactions
    .filter(t => t.fuliza_outstanding !== '' && t.fuliza_outstanding != null && !isNaN(Number(t.fuliza_outstanding)))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (withOutstanding.length > 0) {
    return Number(withOutstanding[0].fuliza_outstanding);
  }

  // Fallback: calculate manually
  const drawn = transactions
    .filter(t => t.type === 'fuliza_credit')
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);

  const repaid = transactions
    .filter(t => {
      const desc = (t.description || '').toLowerCase();
      return desc.includes('fuliza') && desc.includes('repayment');
    })
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);

  return Math.max(0, drawn - repaid);
}

export function fulizaDaysThisMonth(transactions, currentMonth) {
  if (!transactions?.length || !currentMonth) return 0;
  const days = new Set();
  for (const t of transactions) {
    // Count any transaction that drew on Fuliza in this month, whether it's
    // an explicit fuliza_credit row, a regular expense with fuliza_amount,
    // or a transaction whose SMS/description indicates Fuliza usage.
    const sms = (t.raw_sms || '').toLowerCase();
    const desc = (t.description || '').toLowerCase();
    const mentionsFuliza = sms.includes('fuliza') || desc.includes('fuliza');
    const isRepayment = desc.includes('repayment') || sms.includes('repayment');
    const usedFuliza =
      t.type === 'fuliza_credit' ||
      Number(t.fuliza_amount) > 0 ||
      (mentionsFuliza && !isRepayment);
    if (!usedFuliza) continue;
    const d = t.date || '';
    if (d.startsWith(currentMonth)) {
      days.add(d.slice(0, 10));
    }
  }
  return days.size;
}

export function fulizaHistory(allMonthsData) {
  if (!allMonthsData?.length) return [];
  return allMonthsData
    .map(({ month, transactions }) => {
      const drawn = (transactions || [])
        .filter(t => t.type === 'fuliza_credit')
        .reduce((s, t) => s + (Number(t.amount) || 0), 0);

      const repaid = (transactions || [])
        .filter(t => {
          const desc = (t.description || '').toLowerCase();
          return desc.includes('fuliza') && desc.includes('repayment');
        })
        .reduce((s, t) => s + (Number(t.amount) || 0), 0);

      return { month, drawn, repaid, outstanding: Math.max(0, drawn - repaid) };
    })
    .sort((a, b) => a.month.localeCompare(b.month));
}
