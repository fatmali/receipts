import { generateInsights } from '../insights.js';
import { makeTxn, EMPTY_TRANSACTIONS, MIXED_TRANSACTIONS } from '../../test/fixtures.js';

describe('generateInsights', () => {
  const currentMonth = {
    month: '2026-05',
    transactions: MIXED_TRANSACTIONS,
  };

  it('returns array of structured insight objects', () => {
    const result = generateInsights(currentMonth, null, null, null);
    expect(Array.isArray(result)).toBe(true);
    result.forEach(insight => {
      expect(insight).toHaveProperty('label');
      expect(insight).toHaveProperty('value');
      expect(insight).toHaveProperty('tone');
      expect(insight).toHaveProperty('icon');
    });
  });

  it('includes top spend category', () => {
    const result = generateInsights(currentMonth, null, null, null);
    const topSpend = result.find(i => i.label === 'Top spend');
    expect(topSpend).toBeDefined();
    expect(topSpend.detail).toBe('housing');
  });

  it('includes Fuliza info when Fuliza data exists', () => {
    const fulizaMonth = {
      month: '2026-05',
      transactions: [
        ...MIXED_TRANSACTIONS,
        makeTxn({ type: 'fuliza_credit', amount: 5000, date: '2026-05-01' }),
      ],
    };
    const result = generateInsights(fulizaMonth, null, null, null);
    const fulizaInsight = result.find(i => i.label === 'Fuliza days');
    expect(fulizaInsight).toBeDefined();
  });

  it('includes savings rate change when previous month exists', () => {
    const previousMonth = {
      month: '2026-04',
      transactions: [
        makeTxn({ type: 'income', amount: 50000 }),
        makeTxn({ type: 'expense', amount: 40000 }),
      ],
    };
    const result = generateInsights(currentMonth, previousMonth, null, null);
    const rateInsight = result.find(i => i.label === 'Savings rate');
    expect(rateInsight).toBeDefined();
  });

  it('returns empty array for empty data', () => {
    const emptyMonth = { month: '2026-05', transactions: [] };
    const result = generateInsights(emptyMonth, null, null, null);
    expect(result).toEqual([]);
  });

  it('returns at most 10 insights', () => {
    // Rich data should produce many potential insights
    const richMonth = {
      month: '2026-05',
      transactions: [
        ...MIXED_TRANSACTIONS,
        makeTxn({ type: 'fuliza_credit', amount: 5000, date: '2026-05-01' }),
        makeTxn({ type: 'expense', amount: 200, cost: 35, description: 'ATM Withdrawal' }),
        makeTxn({ type: 'expense', amount: 500, cost: 15, description: 'Transfer Fee' }),
      ],
    };
    const previousMonth = {
      month: '2026-04',
      transactions: [
        makeTxn({ type: 'income', amount: 50000 }),
        makeTxn({ type: 'expense', amount: 40000 }),
      ],
    };
    const allMonths = [
      previousMonth,
      richMonth,
      { month: '2026-03', transactions: [makeTxn({ type: 'income', amount: 80000 }), makeTxn({ type: 'expense', amount: 10000 })] },
    ];
    const recurring = [
      { annualCost: 18000, description: 'Netflix', amount: 1500 },
    ];
    const result = generateInsights(richMonth, previousMonth, allMonths, recurring);
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it('all monetary insight values are formatted with KES', () => {
    const result = generateInsights(currentMonth, null, null, null);
    const monetaryInsights = result.filter(i => i.value.includes('KES'));
    expect(monetaryInsights.length).toBeGreaterThan(0);
    monetaryInsights.forEach(insight => {
      expect(insight.value).toMatch(/KES [\d,]+/);
    });
  });

  it('handles null currentMonth gracefully', () => {
    const result = generateInsights(null, null, null, null);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });

  it('includes subscription info when recurring data provided', () => {
    const recurring = [
      { annualCost: 18000, description: 'Netflix', amount: 1500 },
      { annualCost: 6000, description: 'Spotify', amount: 500 },
    ];
    const result = generateInsights(currentMonth, null, null, recurring);
    const subInsight = result.find(i => i.label === 'Subscriptions');
    expect(subInsight).toBeDefined();
    expect(subInsight.value).toContain('KES');
  });
});
