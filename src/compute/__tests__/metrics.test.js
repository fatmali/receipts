import {
  totalIncome,
  totalExpenses,
  totalSavings,
  totalSpending,
  netCashFlow,
  savingsRate,
  totalFees,
  expensesByCategory,
  topCategory,
  uncategorizedCount,
  netByAccount,
  balanceHistory,
  fulizaOutstanding,
  fulizaDaysThisMonth,
} from '../metrics.js';
import {
  makeTxn,
  EMPTY_TRANSACTIONS,
  MIXED_TRANSACTIONS,
  FULIZA_TRANSACTIONS,
  ZERO_INCOME,
  UNCATEGORIZED_TRANSACTIONS,
} from '../../test/fixtures.js';

// ── totalIncome ──────────────────────────────────────────────
describe('totalIncome', () => {
  it('returns sum of income transactions', () => {
    expect(totalIncome(MIXED_TRANSACTIONS)).toBe(60000);
  });

  it('excludes transfers', () => {
    const txns = [
      makeTxn({ type: 'income', amount: 5000 }),
      makeTxn({ type: 'transfer', amount: 20000 }),
    ];
    expect(totalIncome(txns)).toBe(5000);
  });

  it('excludes loan disbursements', () => {
    const txns = [
      makeTxn({ type: 'income', amount: 50000, description: 'Salary' }),
      makeTxn({ type: 'income', amount: 8865, description: 'Loan Disburse' }),
      makeTxn({ type: 'income', amount: 8865, description: 'M-Shwari Loan Disburse' }),
    ];
    expect(totalIncome(txns)).toBe(50000);
  });

  it('excludes expenses', () => {
    const txns = [
      makeTxn({ type: 'income', amount: 5000 }),
      makeTxn({ type: 'expense', amount: 3000 }),
    ];
    expect(totalIncome(txns)).toBe(5000);
  });

  it('returns 0 for empty array', () => {
    expect(totalIncome(EMPTY_TRANSACTIONS)).toBe(0);
  });

  it('returns 0 when no income transactions', () => {
    expect(totalIncome(ZERO_INCOME)).toBe(0);
  });

  it('returns 0 for null/undefined', () => {
    expect(totalIncome(null)).toBe(0);
    expect(totalIncome(undefined)).toBe(0);
  });
});

// ── totalExpenses ────────────────────────────────────────────
describe('totalExpenses', () => {
  it('returns sum of expense transactions', () => {
    expect(totalExpenses(MIXED_TRANSACTIONS)).toBe(26000);
  });

  it('excludes transfers', () => {
    const txns = [
      makeTxn({ type: 'expense', amount: 5000 }),
      makeTxn({ type: 'transfer', amount: 20000 }),
    ];
    expect(totalExpenses(txns)).toBe(5000);
  });

  it('excludes income', () => {
    const txns = [
      makeTxn({ type: 'expense', amount: 5000 }),
      makeTxn({ type: 'income', amount: 3000 }),
    ];
    expect(totalExpenses(txns)).toBe(5000);
  });

  it('returns 0 for empty array', () => {
    expect(totalExpenses(EMPTY_TRANSACTIONS)).toBe(0);
  });
});

// ── totalSavings ─────────────────────────────────────────────
describe('totalSavings', () => {
  it('sums transactions with savings or investment category', () => {
    // MIXED_TRANSACTIONS has 10000 savings + 5000 investment (both transfers)
    expect(totalSavings(MIXED_TRANSACTIONS)).toBe(15000);
  });

  it('picks up expense-typed savings too', () => {
    const txns = [
      makeTxn({ type: 'expense', amount: 8000, category: 'savings' }),
      makeTxn({ type: 'expense', amount: 3000, category: 'food' }),
    ];
    expect(totalSavings(txns)).toBe(8000);
  });

  it('is case-insensitive on category', () => {
    const txns = [
      makeTxn({ type: 'transfer', amount: 5000, category: 'Savings' }),
      makeTxn({ type: 'transfer', amount: 2000, category: 'Investment' }),
    ];
    expect(totalSavings(txns)).toBe(7000);
  });

  it('includes investments (plural) category', () => {
    const txns = [
      makeTxn({ type: 'expense', amount: 90000, category: 'investments' }),
      makeTxn({ type: 'expense', amount: 5000, category: 'investment' }),
      makeTxn({ type: 'expense', amount: 3000, category: 'food' }),
    ];
    expect(totalSavings(txns)).toBe(95000);
  });

  it('returns 0 when no savings categories', () => {
    expect(totalSavings(ZERO_INCOME)).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(totalSavings(EMPTY_TRANSACTIONS)).toBe(0);
  });

  it('returns 0 for null/undefined', () => {
    expect(totalSavings(null)).toBe(0);
    expect(totalSavings(undefined)).toBe(0);
  });
});

// ── totalSpending ────────────────────────────────────────────
describe('totalSpending', () => {
  it('returns expenses excluding savings/investment categories', () => {
    // MIXED_TRANSACTIONS has 15000 housing + 8000 food + 3000 transport = 26000 (all expenses, none are savings category)
    expect(totalSpending(MIXED_TRANSACTIONS)).toBe(26000);
  });

  it('excludes savings-categorised expenses', () => {
    const txns = [
      makeTxn({ type: 'expense', amount: 10000, category: 'savings' }),
      makeTxn({ type: 'expense', amount: 5000, category: 'food' }),
    ];
    expect(totalSpending(txns)).toBe(5000);
  });

  it('excludes overdraft and debt repayments', () => {
    const txns = [
      makeTxn({ type: 'expense', amount: 4046, category: 'overdraft' }),
      makeTxn({ type: 'expense', amount: 9675, category: 'debt' }),
      makeTxn({ type: 'expense', amount: 5000, category: 'food' }),
      makeTxn({ type: 'expense', amount: 3000, category: 'transport' }),
    ];
    expect(totalSpending(txns)).toBe(8000);
  });

  it('returns 0 for empty array', () => {
    expect(totalSpending(EMPTY_TRANSACTIONS)).toBe(0);
  });
});

// ── netCashFlow ──────────────────────────────────────────────
describe('netCashFlow', () => {
  it('returns income minus expenses', () => {
    expect(netCashFlow(MIXED_TRANSACTIONS)).toBe(34000);
  });

  it('can be negative', () => {
    expect(netCashFlow(ZERO_INCOME)).toBe(-8000);
  });

  it('returns 0 for empty array', () => {
    expect(netCashFlow(EMPTY_TRANSACTIONS)).toBe(0);
  });

  it('excludes transfers', () => {
    const txns = [
      makeTxn({ type: 'income', amount: 10000 }),
      makeTxn({ type: 'expense', amount: 4000 }),
      makeTxn({ type: 'transfer', amount: 50000 }),
    ];
    expect(netCashFlow(txns)).toBe(6000);
  });
});

// ── savingsRate ──────────────────────────────────────────────
describe('savingsRate', () => {
  it('returns correct percentage based on savings categories', () => {
    // 60000 income, 15000 in savings/investment categories → 15000/60000 * 100 = 25%
    const rate = savingsRate(MIXED_TRANSACTIONS);
    expect(rate).toBe(25);
  });

  it('returns null when income is 0', () => {
    expect(savingsRate(ZERO_INCOME)).toBeNull();
  });

  it('returns 0 when no savings categories exist', () => {
    const txns = [
      makeTxn({ type: 'income', amount: 5000 }),
      makeTxn({ type: 'expense', amount: 5000, category: 'food' }),
    ];
    expect(savingsRate(txns)).toBe(0);
  });

  it('counts investment and savings categories', () => {
    const txns = [
      makeTxn({ type: 'income', amount: 10000 }),
      makeTxn({ type: 'expense', amount: 3000, category: 'savings' }),
      makeTxn({ type: 'expense', amount: 2000, category: 'investment' }),
    ];
    expect(savingsRate(txns)).toBe(50);
  });
});

// ── totalFees ────────────────────────────────────────────────
describe('totalFees', () => {
  it('sums cost field', () => {
    expect(totalFees(MIXED_TRANSACTIONS)).toBe(50);
  });

  it('returns 0 when no fees', () => {
    const txns = [makeTxn({ cost: 0 }), makeTxn({ cost: 0 })];
    expect(totalFees(txns)).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(totalFees(EMPTY_TRANSACTIONS)).toBe(0);
  });
});

// ── expensesByCategory ───────────────────────────────────────
describe('expensesByCategory', () => {
  it('groups expenses by category', () => {
    const result = expensesByCategory(MIXED_TRANSACTIONS);
    expect(result).toEqual({
      housing: 15000,
      food: 8000,
      transport: 3000,
    });
  });

  it('handles uncategorized (empty string key)', () => {
    const result = expensesByCategory(UNCATEGORIZED_TRANSACTIONS);
    expect(result['']).toBe(5000);
    expect(result['food']).toBe(1000);
  });

  it('returns empty object for no expenses', () => {
    const txns = [makeTxn({ type: 'income', amount: 5000 })];
    expect(expensesByCategory(txns)).toEqual({});
  });

  it('returns empty object for empty array', () => {
    expect(expensesByCategory(EMPTY_TRANSACTIONS)).toEqual({});
  });
});

// ── topCategory ──────────────────────────────────────────────
describe('topCategory', () => {
  it('returns highest-spending category name', () => {
    expect(topCategory(MIXED_TRANSACTIONS)).toBe('housing');
  });

  it('excludes uncategorized', () => {
    expect(topCategory(UNCATEGORIZED_TRANSACTIONS)).toBe('food');
  });

  it('returns empty string for empty data', () => {
    expect(topCategory(EMPTY_TRANSACTIONS)).toBe('');
  });
});

// ── uncategorizedCount ───────────────────────────────────────
describe('uncategorizedCount', () => {
  it('counts expense transactions with empty category', () => {
    expect(uncategorizedCount(UNCATEGORIZED_TRANSACTIONS)).toBe(2);
  });

  it('returns 0 when all categorized', () => {
    expect(uncategorizedCount(MIXED_TRANSACTIONS)).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(uncategorizedCount(EMPTY_TRANSACTIONS)).toBe(0);
  });
});

// ── netByAccount ─────────────────────────────────────────────
describe('netByAccount', () => {
  it('groups by account with in/out/net', () => {
    const txns = [
      makeTxn({ type: 'income', amount: 10000, account: 'mpesa' }),
      makeTxn({ type: 'expense', amount: 3000, account: 'mpesa' }),
      makeTxn({ type: 'expense', amount: 2000, account: 'bank-main' }),
    ];
    const result = netByAccount(txns);
    expect(result.mpesa).toEqual({ in: 10000, out: 3000, net: 7000 });
    expect(result['bank-main']).toEqual({ in: 0, out: 2000, net: -2000 });
  });

  it('returns empty object for empty array', () => {
    expect(netByAccount(EMPTY_TRANSACTIONS)).toEqual({});
  });
});

// ── balanceHistory ───────────────────────────────────────────
describe('balanceHistory', () => {
  it('filters transactions with balance, sorts by date', () => {
    const txns = [
      makeTxn({ date: '2026-05-03', balance: 5000 }),
      makeTxn({ date: '2026-05-01', balance: 10000 }),
      makeTxn({ date: '2026-05-02', balance: '' }),
    ];
    const result = balanceHistory(txns);
    expect(result).toEqual([
      { date: '2026-05-01', balance: 10000 },
      { date: '2026-05-03', balance: 5000 },
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(balanceHistory(EMPTY_TRANSACTIONS)).toEqual([]);
  });

  it('returns empty array when no balances', () => {
    expect(balanceHistory(MIXED_TRANSACTIONS)).toEqual([]);
  });
});

// ── fulizaOutstanding ────────────────────────────────────────
describe('fulizaOutstanding', () => {
  it('calculates credits minus repayments', () => {
    // 5000 + 3000 credits, 5000 + 1000 repayments = 2000 outstanding
    expect(fulizaOutstanding(FULIZA_TRANSACTIONS)).toBe(2000);
  });

  it('returns 0 when no Fuliza data', () => {
    expect(fulizaOutstanding(MIXED_TRANSACTIONS)).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(fulizaOutstanding(EMPTY_TRANSACTIONS)).toBe(0);
  });

  it('uses fuliza_outstanding field if present', () => {
    const txns = [
      makeTxn({ type: 'fuliza_credit', amount: 5000, fuliza_outstanding: 3000, date: '2026-05-02' }),
      makeTxn({ type: 'fuliza_credit', amount: 2000, fuliza_outstanding: 1500, date: '2026-05-05' }),
    ];
    // Should use latest (May 5th) fuliza_outstanding = 1500
    expect(fulizaOutstanding(txns)).toBe(1500);
  });
});

// ── fulizaDaysThisMonth ──────────────────────────────────────
describe('fulizaDaysThisMonth', () => {
  it('counts distinct days with fuliza_credit', () => {
    expect(fulizaDaysThisMonth(FULIZA_TRANSACTIONS, '2026-05')).toBe(2);
  });

  it('handles multiple credits on same day (count once)', () => {
    const txns = [
      makeTxn({ type: 'fuliza_credit', date: '2026-05-01T08:00:00' }),
      makeTxn({ type: 'fuliza_credit', date: '2026-05-01T14:00:00' }),
      makeTxn({ type: 'fuliza_credit', date: '2026-05-02T10:00:00' }),
    ];
    expect(fulizaDaysThisMonth(txns, '2026-05')).toBe(2);
  });

  it('returns 0 when no Fuliza data', () => {
    expect(fulizaDaysThisMonth(MIXED_TRANSACTIONS, '2026-05')).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(fulizaDaysThisMonth(EMPTY_TRANSACTIONS, '2026-05')).toBe(0);
  });

  it('returns 0 when currentMonth is falsy', () => {
    expect(fulizaDaysThisMonth(FULIZA_TRANSACTIONS, '')).toBe(0);
  });

  it('counts expense rows that drew on Fuliza (fuliza_amount > 0)', () => {
    const txns = [
      makeTxn({ type: 'expense', amount: 1500, fuliza_amount: 500, date: '2026-05-04T10:00:00' }),
      makeTxn({ type: 'expense', amount: 2000, fuliza_amount: 0,   date: '2026-05-05T10:00:00' }),
      makeTxn({ type: 'expense', amount: 800,  fuliza_amount: 200, date: '2026-05-06T10:00:00' }),
    ];
    expect(fulizaDaysThisMonth(txns, '2026-05')).toBe(2);
  });

  it('detects Fuliza from raw_sms keywords', () => {
    const txns = [
      makeTxn({ type: 'expense', amount: 20, date: '2026-01-01T00:15:05+03:00', raw_sms: 'Customer Bundle Purchase with Fuliza to 4093441SAFARICOM DATA BUNDLES' }),
      makeTxn({ type: 'expense', amount: 5000, date: '2026-01-02T20:58:26+03:00', raw_sms: 'Customer Transfer Fuliza MPesa to - 2547******899 JANE DOE' }),
      makeTxn({ type: 'expense', amount: 1443, date: '2026-01-01T19:47:58+03:00', raw_sms: 'Pay Bill Online to 510800 - iPay Ltd' }),
    ];
    expect(fulizaDaysThisMonth(txns, '2026-01')).toBe(2);
  });
});
