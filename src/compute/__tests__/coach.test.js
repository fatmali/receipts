import { describe, it, expect } from 'vitest';
import {
  identityFromHistory,
  projectWealth,
  projectFullWealth,
  computeSavingsStreak,
  computeBudgetStreaks,
  computeBudgetSummary,
} from '../coach.js';
import { makeTxn } from '../../test/fixtures.js';

// ── identityFromHistory ──────────────────────────────────────
describe('identityFromHistory', () => {
  it('returns neutral starter sentence with no data', () => {
    const result = identityFromHistory([], 0);
    expect(result.tone).toBe('neutral');
    expect(result.sentence).toMatch(/beginning|history/i);
  });

  it('returns positive when hitting savings goal 3+ months', () => {
    const months = Array.from({ length: 4 }).map((_, i) => ({
      month: `2026-0${i + 1}`,
      transactions: [
        makeTxn({ type: 'income', amount: 100000 }),
        makeTxn({ type: 'expense', amount: 30000 }),
        makeTxn({ type: 'transfer', amount: 60000, category: 'savings' }),
      ],
      salary: 0,
    }));
    const result = identityFromHistory(months, 50000);
    expect(result.tone).toBe('positive');
    expect(result.sentence).toMatch(/savings goal/i);
  });

  it('returns positive for strong saver (≥30%)', () => {
    const months = Array.from({ length: 4 }).map((_, i) => ({
      month: `2026-0${i + 1}`,
      transactions: [
        makeTxn({ type: 'income', amount: 100000 }),
        makeTxn({ type: 'expense', amount: 50000 }),
        makeTxn({ type: 'transfer', amount: 40000, category: 'savings' }),
      ],
      salary: 0,
    }));
    const result = identityFromHistory(months, 0);
    expect(result.tone).toBe('positive');
    expect(result.sentence).toMatch(/strong saver/i);
  });

  it('returns honest read when no savings', () => {
    const months = Array.from({ length: 4 }).map((_, i) => ({
      month: `2026-0${i + 1}`,
      transactions: [
        makeTxn({ type: 'income', amount: 30000 }),
        makeTxn({ type: 'expense', amount: 50000 }),
      ],
      salary: 0,
    }));
    const result = identityFromHistory(months, 0);
    // avgRate is 0% (no savings-category txns), falls through to topShare or low saver
    expect(['neutral', 'honest']).toContain(result.tone);
  });

  it('includes salary in income calculation', () => {
    const months = Array.from({ length: 4 }).map((_, i) => ({
      month: `2026-0${i + 1}`,
      transactions: [
        makeTxn({ type: 'income', amount: 100000, category: 'salary', date: `2026-0${i + 1}-25` }),
        makeTxn({ type: 'expense', amount: 30000, date: `2026-0${i + 1}-26` }),
        makeTxn({ type: 'transfer', amount: 60000, category: 'savings', date: `2026-0${i + 1}-27` }),
      ],
    }));
    const result = identityFromHistory(months, 50000);
    // saved = 60000 >= 50000 goal, every month
    expect(result.tone).toBe('positive');
  });

  it('uses wealth context for high-saver identity', () => {
    const months = Array.from({ length: 4 }).map((_, i) => ({
      month: `2026-0${i + 1}`,
      transactions: [
        makeTxn({ type: 'income', amount: 400000, category: 'salary', date: `2026-0${i + 1}-25` }),
        makeTxn({ type: 'expense', amount: 250000, date: `2026-0${i + 1}-26` }),
        makeTxn({ type: 'transfer', amount: 160000, category: 'savings', date: `2026-0${i + 1}-27` }),
      ],
    }));
    const wealth = {
      grossSalary: 500000,
      prePaycheck: { espp: 80000, pension: 20000 },
      existing: { investments: 500000, pension: 1000000 },
    };
    const result = identityFromHistory(months, 150000, wealth);
    expect(result.tone).toBe('positive');
    expect(result.sentence).toMatch(/gross income|ESPP|savings goal/i);
  });

  it('flags Fuliza when saving but using overdraft', () => {
    const months = Array.from({ length: 4 }).map((_, i) => ({
      month: `2026-0${i + 1}`,
      transactions: [
        makeTxn({ type: 'income', amount: 400000 }),
        makeTxn({ type: 'expense', amount: 280000 }),
        makeTxn({ type: 'expense', amount: 30000, category: 'overdraft' }),
        makeTxn({ type: 'transfer', amount: 80000, category: 'savings' }),
      ],
      salary: 0,
    }));
    // saved=80k, income=400k → 20% rate; fuliza present → should flag
    const result = identityFromHistory(months, 200000);
    expect(result.sentence).toMatch(/[Ff]uliza/);
  });
});

// ── projectWealth ────────────────────────────────────────────
describe('projectWealth', () => {
  it('returns empty for non-positive years', () => {
    expect(projectWealth(1000, 0)).toEqual([]);
    expect(projectWealth(1000, -1)).toEqual([]);
  });

  it('produces year 0..N entries', () => {
    const data = projectWealth(10000, 5);
    expect(data).toHaveLength(6);
    expect(data[0]).toEqual({ year: 0, wealth: 0 });
    expect(data[5].year).toBe(5);
  });

  it('multiplies monthlyNet by 12 per year with no return', () => {
    const data = projectWealth(10000, 5, 0, 0);
    expect(data[1].wealth).toBe(120000);
    expect(data[5].wealth).toBe(600000);
  });

  it('respects starting wealth', () => {
    const data = projectWealth(10000, 5, 50000, 0);
    expect(data[0].wealth).toBe(50000);
    expect(data[5].wealth).toBe(50000 + 600000);
  });

  it('applies compound returns', () => {
    const data = projectWealth(0, 1, 100000, 0.10);
    // 100000 * 1.10 = 110000
    expect(data[1].wealth).toBe(110000);
  });

  it('compounds returns with contributions', () => {
    const data = projectWealth(10000, 1, 100000, 0.10);
    // (100000 * 1.10) + (10000 * 12) = 110000 + 120000 = 230000
    expect(data[1].wealth).toBe(230000);
  });

  it('clamps negative wealth to zero', () => {
    const data = projectWealth(-10000, 2, 0);
    expect(data.every(d => d.wealth >= 0)).toBe(true);
  });
});

// ── projectFullWealth ────────────────────────────────────────
describe('projectFullWealth', () => {
  it('returns empty for non-positive years', () => {
    const result = projectFullWealth({ monthlyNet: 1000, years: 0 });
    expect(result.data).toEqual([]);
  });

  it('includes existing assets as starting point', () => {
    const result = projectFullWealth({
      monthlyNet: 0,
      years: 1,
      wealth: {
        existing: { investments: 500000, pension: 1000000, emergency: 500000, homeFund: 1000000 },
        prePaycheck: { espp: 0, pension: 0 },
      },
      annualReturn: 0,
    });
    expect(result.data[0].wealth).toBe(3000000);
  });

  it('grows with pre-paycheck and post-paycheck streams', () => {
    const result = projectFullWealth({
      monthlyNet: 172000,
      years: 1,
      wealth: {
        existing: { investments: 0, espp: 0, pension: 0, emergency: 0, homeFund: 0 },
        prePaycheck: { espp: 80000, pension: 20000 },
      },
      annualReturn: 0,
    });
    // Year 1: invested = 80000*12 = 960000, pension = 20000*12 = 240000, cash = 172000*12 = 2064000
    expect(result.data[1].invested).toBe(960000);
    expect(result.data[1].pension).toBe(240000);
    expect(result.data[1].cash).toBe(2064000);
    expect(result.data[1].wealth).toBe(960000 + 240000 + 2064000);
  });

  it('returns totals summary', () => {
    const result = projectFullWealth({
      monthlyNet: 100000,
      years: 5,
      wealth: {
        existing: { investments: 1000000 },
        prePaycheck: { espp: 50000, pension: 10000 },
      },
    });
    expect(result.totals.starting).toBeGreaterThan(0);
    expect(result.totals.final).toBeGreaterThan(result.totals.starting);
    expect(result.totals.totalContributed).toBe((50000 + 10000 + 100000) * 12 * 5);
  });
});

// ── computeSavingsStreak ─────────────────────────────────────
describe('computeSavingsStreak', () => {
  function monthHitting(savedAmount) {
    const txns = [
      makeTxn({ type: 'income', amount: 100000 }),
      makeTxn({ type: 'expense', amount: 80000, category: 'food' }),
    ];
    if (savedAmount > 0) {
      txns.push(makeTxn({ type: 'transfer', amount: savedAmount, category: 'savings' }));
    }
    return { transactions: txns, salary: 0 };
  }

  it('returns zeros with no goal', () => {
    expect(computeSavingsStreak([monthHitting(10000)], 0)).toEqual({
      current: 0, longest: 0, total: 0,
    });
  });

  it('counts current trailing run', () => {
    const months = [monthHitting(0), monthHitting(20000), monthHitting(20000)];
    const r = computeSavingsStreak(months, 10000);
    expect(r.current).toBe(2);
    expect(r.longest).toBe(2);
    expect(r.total).toBe(2);
  });

  it('current=0 when latest month misses', () => {
    const months = [monthHitting(20000), monthHitting(20000), monthHitting(0)];
    const r = computeSavingsStreak(months, 10000);
    expect(r.current).toBe(0);
    expect(r.longest).toBe(2);
    expect(r.total).toBe(2);
  });

  it('tracks longest run across breaks', () => {
    const months = [
      monthHitting(20000), monthHitting(20000), monthHitting(20000), // 3
      monthHitting(0),
      monthHitting(20000), monthHitting(20000), // 2
    ];
    const r = computeSavingsStreak(months, 10000);
    expect(r.current).toBe(2);
    expect(r.longest).toBe(3);
    expect(r.total).toBe(5);
  });
});

// ── computeBudgetStreaks ─────────────────────────────────────
describe('computeBudgetStreaks', () => {
  it('returns empty when no budgets', () => {
    expect(computeBudgetStreaks([], {})).toEqual({});
  });

  it('per-category streaks for staying under budget', () => {
    const months = [
      { transactions: [makeTxn({ category: 'food', amount: 5000 })] },  // under
      { transactions: [makeTxn({ category: 'food', amount: 5000 })] },  // under
      { transactions: [makeTxn({ category: 'food', amount: 20000 })] }, // over
      { transactions: [makeTxn({ category: 'food', amount: 5000 })] },  // under
    ];
    const r = computeBudgetStreaks(months, { food: 10000 });
    expect(r.food.current).toBe(1);
    expect(r.food.longest).toBe(2);
    expect(r.food.total).toBe(3);
  });
});

// ── computeBudgetSummary ─────────────────────────────────────
describe('computeBudgetSummary', () => {
  it('returns empty for no data', () => {
    const r = computeBudgetSummary([], {});
    expect(r.categories).toEqual([]);
    expect(r.totalOverspendAllMonths).toBe(0);
    expect(r.annualOverspend).toBe(0);
  });

  it('returns empty when no budgets configured', () => {
    const months = [{ transactions: [makeTxn({ category: 'food', amount: 5000 })] }];
    const r = computeBudgetSummary(months, {});
    expect(r.categories).toEqual([]);
  });

  it('computes overspend per category and totals', () => {
    const months = [
      { transactions: [makeTxn({ category: 'food', amount: 15000 }), makeTxn({ category: 'transport', amount: 5000 })] },
      { transactions: [makeTxn({ category: 'food', amount: 8000 }), makeTxn({ category: 'transport', amount: 12000 })] },
      { transactions: [makeTxn({ category: 'food', amount: 20000 }), makeTxn({ category: 'transport', amount: 7000 })] },
    ];
    const budgets = { food: 10000, transport: 8000 };
    const r = computeBudgetSummary(months, budgets);

    // food: over in months 0 (15k>10k by 5k), 2 (20k>10k by 10k) = 2 months, 15k overspend
    const food = r.categories.find(c => c.category === 'food');
    expect(food.monthsOver).toBe(2);
    expect(food.totalOverspend).toBe(15000);
    expect(food.totalMonths).toBe(3);
    expect(food.avgSpent).toBe(Math.round((15000 + 8000 + 20000) / 3));

    // transport: over in month 1 (12k>8k by 4k) = 1 month, 4k overspend
    const transport = r.categories.find(c => c.category === 'transport');
    expect(transport.monthsOver).toBe(1);
    expect(transport.totalOverspend).toBe(4000);

    // total overspend = 15000 + 4000 = 19000
    expect(r.totalOverspendAllMonths).toBe(19000);
    // annual = (19000 / 3) * 12
    expect(r.annualOverspend).toBe(Math.round((19000 / 3) * 12));
  });

  it('sorts categories by totalOverspend descending', () => {
    const months = [
      { transactions: [
        makeTxn({ category: 'food', amount: 15000 }),
        makeTxn({ category: 'transport', amount: 25000 }),
      ] },
    ];
    const budgets = { food: 10000, transport: 8000 };
    const r = computeBudgetSummary(months, budgets);
    expect(r.categories[0].category).toBe('transport');
    expect(r.categories[1].category).toBe('food');
  });

  it('reports zero overspend for categories within budget', () => {
    const months = [
      { transactions: [makeTxn({ category: 'food', amount: 5000 })] },
      { transactions: [makeTxn({ category: 'food', amount: 8000 })] },
    ];
    const r = computeBudgetSummary(months, { food: 10000 });
    const food = r.categories.find(c => c.category === 'food');
    expect(food.monthsOver).toBe(0);
    expect(food.totalOverspend).toBe(0);
    expect(r.totalOverspendAllMonths).toBe(0);
    expect(r.annualOverspend).toBe(0);
  });

  it('computes annualOverspend correctly for single month', () => {
    const months = [
      { transactions: [makeTxn({ category: 'food', amount: 15000 })] },
    ];
    const r = computeBudgetSummary(months, { food: 10000 });
    // 5000 overspend in 1 month → 60000/yr
    expect(r.annualOverspend).toBe(60000);
  });
});
