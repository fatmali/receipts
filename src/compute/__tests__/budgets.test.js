import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveBudgets, resolveSalary } from '../budgets.js';

describe('resolveBudgets', () => {
  const config = {
    savingsGoal: 50000,
    budgets: { food: 15000, transport: 8000, utilities: 5000, education: 3000 },
    monthOverrides: {
      'education:2026-04': 80000,
      'education:2026-05': 5000,
    },
    salary: { amount: 420000, day: 1 },
  };

  it('returns default budgets for a month without overrides', () => {
    const result = resolveBudgets(config, '2026-06');
    expect(result).toEqual({
      food: 15000,
      transport: 8000,
      utilities: 5000,
      education: 3000,
    });
  });

  it('returns month-specific override for education in April', () => {
    const result = resolveBudgets(config, '2026-04');
    expect(result.education).toBe(80000);
    expect(result.food).toBe(15000);
  });

  it('returns month-specific override for education in May', () => {
    const result = resolveBudgets(config, '2026-05');
    expect(result.education).toBe(5000);
  });

  it('ignores non-budget keys', () => {
    const result = resolveBudgets(config, '2026-05');
    expect(result).not.toHaveProperty('savingsGoal');
    expect(result).not.toHaveProperty('salary');
  });

  it('returns empty object for null config', () => {
    expect(resolveBudgets(null, '2026-05')).toEqual({});
    expect(resolveBudgets(undefined, '2026-05')).toEqual({});
  });

  it('returns defaults when monthKey is null', () => {
    const result = resolveBudgets(config, null);
    expect(result.food).toBe(15000);
    // No month-specific overrides applied
    expect(result.education).toBe(3000);
  });
});

describe('resolveSalary', () => {
  const config = {
    salary: { amount: 400000, day: 1, account: 'bank-main' },
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns salary for a past month', () => {
    vi.useFakeTimers({ now: new Date(2026, 4, 10) }); // May 10, 2026
    expect(resolveSalary(config, '2026-04')).toBe(400000);
    expect(resolveSalary(config, '2026-01')).toBe(400000);
  });

  it('returns salary for past year', () => {
    vi.useFakeTimers({ now: new Date(2026, 4, 10) });
    expect(resolveSalary(config, '2025-12')).toBe(400000);
  });

  it('returns salary for current month if past salary day', () => {
    vi.useFakeTimers({ now: new Date(2026, 4, 2) }); // May 2 (past day 1)
    expect(resolveSalary(config, '2026-05')).toBe(400000);
  });

  it('returns salary on salary day exactly', () => {
    vi.useFakeTimers({ now: new Date(2026, 4, 1) }); // May 1
    expect(resolveSalary(config, '2026-05')).toBe(400000);
  });

  it('returns 0 for current month if before salary day', () => {
    const lateDayConfig = { salary: { amount: 400000, day: 25 } };
    vi.useFakeTimers({ now: new Date(2026, 4, 10) }); // May 10
    expect(resolveSalary(lateDayConfig, '2026-05')).toBe(0);
  });

  it('returns 0 for future month', () => {
    vi.useFakeTimers({ now: new Date(2026, 4, 10) });
    expect(resolveSalary(config, '2026-06')).toBe(0);
  });

  it('returns 0 for null config or monthKey', () => {
    expect(resolveSalary(null, '2026-05')).toBe(0);
    expect(resolveSalary(config, null)).toBe(0);
  });

  it('returns 0 when config has no salary', () => {
    expect(resolveSalary({ budgets: {} }, '2026-05')).toBe(0);
  });

  it('defaults salary day to 1 if not set', () => {
    vi.useFakeTimers({ now: new Date(2026, 4, 1) }); // May 1
    const noDayConfig = { salary: { amount: 400000 } };
    expect(resolveSalary(noDayConfig, '2026-05')).toBe(400000);
  });
});
