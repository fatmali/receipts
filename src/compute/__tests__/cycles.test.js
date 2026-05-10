import { buildSalaryCycles, currentCycle, previousCycle } from '../cycles.js';
import { makeTxn } from '../../test/fixtures.js';

describe('buildSalaryCycles', () => {
  it('returns empty array for no transactions', () => {
    expect(buildSalaryCycles([])).toEqual([]);
    expect(buildSalaryCycles(null)).toEqual([]);
  });

  it('returns single cycle when no salary transactions exist', () => {
    const txns = [
      makeTxn({ date: '2026-01-05', type: 'expense', amount: 1000 }),
      makeTxn({ date: '2026-01-10', type: 'expense', amount: 2000 }),
    ];
    const cycles = buildSalaryCycles(txns);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].transactions).toHaveLength(2);
    expect(cycles[0].label).toContain('now');
  });

  it('splits transactions at salary boundaries', () => {
    const txns = [
      makeTxn({ date: '2026-01-20', type: 'expense', amount: 500, category: 'food' }),
      makeTxn({ date: '2026-01-25', type: 'income', amount: 100000, category: 'salary' }),
      makeTxn({ date: '2026-01-28', type: 'expense', amount: 3000, category: 'food' }),
      makeTxn({ date: '2026-02-10', type: 'expense', amount: 5000, category: 'housing' }),
      makeTxn({ date: '2026-02-25', type: 'income', amount: 100000, category: 'salary' }),
      makeTxn({ date: '2026-02-28', type: 'expense', amount: 2000, category: 'food' }),
    ];
    const cycles = buildSalaryCycles(txns);

    // pre-salary + 2 salary cycles = 3
    expect(cycles).toHaveLength(3);

    // Pre-salary cycle has 1 transaction
    expect(cycles[0].transactions).toHaveLength(1);
    expect(cycles[0].transactions[0].amount).toBe(500);

    // First salary cycle: salary + 2 expenses (Jan 25 to Feb 24)
    expect(cycles[1].transactions).toHaveLength(3);

    // Second salary cycle: salary + 1 expense (Feb 25 onwards)
    expect(cycles[2].transactions).toHaveLength(2);
    expect(cycles[2].endDate).toBeNull(); // open-ended
  });

  it('includes salary transaction in its own cycle', () => {
    const txns = [
      makeTxn({ date: '2026-03-25', type: 'income', amount: 100000, category: 'salary' }),
      makeTxn({ date: '2026-03-26', type: 'expense', amount: 1000, category: 'food' }),
    ];
    const cycles = buildSalaryCycles(txns);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].transactions).toHaveLength(2);
    expect(cycles[0].startDate).toBe('2026-03-25');
  });

  it('deduplicates salary on the same day', () => {
    const txns = [
      makeTxn({ date: '2026-01-25', type: 'income', amount: 50000, category: 'salary' }),
      makeTxn({ date: '2026-01-25', type: 'income', amount: 50000, category: 'salary' }),
      makeTxn({ date: '2026-01-30', type: 'expense', amount: 1000, category: 'food' }),
    ];
    const cycles = buildSalaryCycles(txns);
    // Should NOT create two cycles for same-day salaries
    expect(cycles).toHaveLength(1);
    expect(cycles[0].transactions).toHaveLength(3);
  });

  it('generates readable labels', () => {
    const txns = [
      makeTxn({ date: '2026-01-25', type: 'income', amount: 100000, category: 'salary' }),
      makeTxn({ date: '2026-02-25', type: 'income', amount: 100000, category: 'salary' }),
      makeTxn({ date: '2026-03-01', type: 'expense', amount: 1000 }),
    ];
    const cycles = buildSalaryCycles(txns);
    // First cycle label should contain both start and end dates
    expect(cycles[0].label).toMatch(/25.*Jan.*24.*Feb/);
    // Last cycle label should say "now"
    expect(cycles[1].label).toContain('now');
  });
});

describe('currentCycle', () => {
  const txns = [
    makeTxn({ date: '2026-03-25', type: 'income', amount: 100000, category: 'salary' }),
    makeTxn({ date: '2026-04-25', type: 'income', amount: 100000, category: 'salary' }),
    makeTxn({ date: '2026-05-01', type: 'expense', amount: 1000 }),
  ];
  const cycles = buildSalaryCycles(txns);

  it('returns the cycle containing the given date', () => {
    const c = currentCycle(cycles, new Date('2026-04-30'));
    expect(c.startDate).toBe('2026-04-25');
  });

  it('returns latest cycle for future date', () => {
    const c = currentCycle(cycles, new Date('2026-12-01'));
    expect(c.startDate).toBe('2026-04-25');
  });

  it('returns null for empty cycles', () => {
    expect(currentCycle([], new Date())).toBeNull();
  });
});

describe('previousCycle', () => {
  const txns = [
    makeTxn({ date: '2026-03-25', type: 'income', amount: 100000, category: 'salary' }),
    makeTxn({ date: '2026-04-25', type: 'income', amount: 100000, category: 'salary' }),
    makeTxn({ date: '2026-05-01', type: 'expense', amount: 1000 }),
  ];
  const cycles = buildSalaryCycles(txns);

  it('returns the cycle before the given one', () => {
    const current = cycles[1];
    const prev = previousCycle(cycles, current);
    expect(prev.startDate).toBe('2026-03-25');
  });

  it('returns null for the first cycle', () => {
    expect(previousCycle(cycles, cycles[0])).toBeNull();
  });
});
