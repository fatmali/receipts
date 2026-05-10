import { deltaAmount, deltaPercent, monthOverMonth } from '../trends.js';
import { makeTxn, EMPTY_TRANSACTIONS } from '../../test/fixtures.js';

// ── deltaAmount ──────────────────────────────────────────────
describe('deltaAmount', () => {
  it('returns positive diff when current > previous', () => {
    expect(deltaAmount(1500, 1000)).toBe(500);
  });

  it('returns negative diff when current < previous', () => {
    expect(deltaAmount(800, 1000)).toBe(-200);
  });

  it('returns 0 when equal', () => {
    expect(deltaAmount(1000, 1000)).toBe(0);
  });

  it('handles string inputs', () => {
    expect(deltaAmount('1500', '1000')).toBe(500);
  });

  it('handles null/undefined as 0', () => {
    expect(deltaAmount(null, 500)).toBe(-500);
    expect(deltaAmount(500, undefined)).toBe(500);
  });
});

// ── deltaPercent ─────────────────────────────────────────────
describe('deltaPercent', () => {
  it('returns correct percentage change', () => {
    // (1500-1000)/1000 * 100 = 50%
    expect(deltaPercent(1500, 1000)).toBe(50);
  });

  it('returns null when previous is 0', () => {
    expect(deltaPercent(1000, 0)).toBeNull();
  });

  it('handles negative deltas', () => {
    // (500-1000)/1000 * 100 = -50%
    expect(deltaPercent(500, 1000)).toBe(-50);
  });

  it('returns 0 when current equals previous', () => {
    expect(deltaPercent(1000, 1000)).toBe(0);
  });

  it('returns null when previous is null', () => {
    expect(deltaPercent(1000, null)).toBeNull();
  });
});

// ── monthOverMonth ───────────────────────────────────────────
describe('monthOverMonth', () => {
  const summaryData = [
    {
      month: '2026-03',
      transactions: [
        makeTxn({ type: 'income', amount: 50000 }),
        makeTxn({ type: 'expense', amount: 30000 }),
      ],
    },
    {
      month: '2026-04',
      transactions: [
        makeTxn({ type: 'income', amount: 60000 }),
        makeTxn({ type: 'expense', amount: 25000 }),
      ],
    },
    {
      month: '2026-05',
      transactions: [
        makeTxn({ type: 'income', amount: 55000 }),
        makeTxn({ type: 'expense', amount: 35000 }),
      ],
    },
  ];

  it('returns array with delta values', () => {
    const result = monthOverMonth(summaryData);
    expect(result).toHaveLength(3);
    expect(result[0].month).toBe('2026-03');
    expect(result[1].month).toBe('2026-04');
    expect(result[2].month).toBe('2026-05');
  });

  it('first month has null deltas', () => {
    const result = monthOverMonth(summaryData);
    expect(result[0].incomeDelta).toBeNull();
    expect(result[0].expenseDelta).toBeNull();
    expect(result[0].netDelta).toBeNull();
    expect(result[0].savingsRateDelta).toBeNull();
  });

  it('subsequent months have computed deltas', () => {
    const result = monthOverMonth(summaryData);
    // Month 2: income 60000 vs 50000 → +20%
    expect(result[1].incomeDelta).toBe(20);
    // Month 2: expenses 25000 vs 30000 → -16.67%
    expect(result[1].expenseDelta).toBeCloseTo(-16.67, 1);
    // Month 2: net 35000 vs 20000 → delta amount = 15000
    expect(result[1].netDelta).toBe(15000);
  });

  it('returns empty array for empty input', () => {
    expect(monthOverMonth([])).toEqual([]);
    expect(monthOverMonth(null)).toEqual([]);
  });

  it('single month has null deltas', () => {
    const single = [{ month: '2026-05', transactions: [makeTxn({ type: 'income', amount: 5000 })] }];
    const result = monthOverMonth(single);
    expect(result).toHaveLength(1);
    expect(result[0].incomeDelta).toBeNull();
  });
});
