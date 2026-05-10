import { describe, it, expect } from 'vitest';
import { scoreImpulse, isLikelyImpulse } from '../impulse.js';
import { makeTxn } from '../../test/fixtures.js';

// ── scoreImpulse ─────────────────────────────────────────────
describe('scoreImpulse', () => {
  it('returns 0 for non-expenses', () => {
    const txn = makeTxn({ type: 'income', amount: 50000 });
    expect(scoreImpulse(txn).score).toBe(0);
  });

  it('returns 0 for null transaction', () => {
    expect(scoreImpulse(null).score).toBe(0);
  });

  it('flags late-night purchase (after 23h)', () => {
    const txn = makeTxn({
      date: '2026-05-01T23:30:00',
      category: 'food',
      description: 'Random Late Snack',
    });
    const { score, reasons } = scoreImpulse(txn, [], [], {});
    expect(score).toBeGreaterThan(0);
    expect(reasons.some(r => r.includes('late-night'))).toBe(true);
  });

  it('flags late-night purchase (before 6h)', () => {
    const txn = makeTxn({
      date: '2026-05-01T03:00:00',
      category: 'food',
    });
    const { reasons } = scoreImpulse(txn, [], [], {});
    expect(reasons.some(r => r.includes('late-night'))).toBe(true);
  });

  it('flags large category spike (>3× median)', () => {
    const history = [
      makeTxn({ category: 'food', amount: 1000 }),
      makeTxn({ category: 'food', amount: 1000 }),
      makeTxn({ category: 'food', amount: 1000 }),
    ];
    const txn = makeTxn({
      date: '2026-05-15T14:00:00',
      category: 'food',
      amount: 5000, // 5× median
      description: 'Fancy Restaurant',
    });
    const { score, reasons } = scoreImpulse(txn, history, [], {});
    expect(score).toBeGreaterThanOrEqual(0.4);
    expect(reasons.some(r => r.includes('usual food spend'))).toBe(true);
  });

  it('flags new merchant in high-impulse category', () => {
    const txn = makeTxn({
      date: '2026-05-15T14:00:00',
      category: 'shopping',
      description: 'New Boutique',
    });
    const { reasons } = scoreImpulse(txn, [], [], {});
    expect(reasons.some(r => r.includes('new merchant'))).toBe(true);
  });

  it('does NOT flag new merchant in non-impulse category (e.g., utilities)', () => {
    const txn = makeTxn({
      date: '2026-05-15T14:00:00',
      category: 'utilities',
      description: 'Some Utility Co',
    });
    const { reasons } = scoreImpulse(txn, [], [], {});
    expect(reasons.some(r => r.includes('new merchant'))).toBe(false);
  });

  it('flags rapid same-merchant repeats (3+ in 60min)', () => {
    const baseDate = '2026-05-15T14:00:00';
    const history = [
      makeTxn({ date: '2026-05-15T13:30:00', description: 'bar tab', category: 'shopping' }),
      makeTxn({ date: '2026-05-15T14:30:00', description: 'bar tab', category: 'shopping' }),
    ];
    const txn = makeTxn({
      date: baseDate,
      description: 'bar tab',
      category: 'shopping',
    });
    const { reasons } = scoreImpulse(txn, history, [], {});
    expect(reasons.some(r => r.includes('multiple charges'))).toBe(true);
  });

  it('reduces score for recurring patterns', () => {
    const txn = makeTxn({
      date: '2026-05-01T03:00:00', // late night (would normally add)
      description: 'netflix subscription',
      category: 'entertainment',
      amount: 1100,
    });
    const recurring = [{ description: 'netflix subscription' }];
    const { score, reasons } = scoreImpulse(txn, [], recurring, {});
    expect(reasons.some(r => r.includes('recurring'))).toBe(true);
    // Late-night +0.3 minus recurring -0.5 = clamped to 0
    expect(score).toBe(0);
  });

  it('reduces score for known billers', () => {
    const txn = makeTxn({
      date: '2026-05-01T03:00:00',
      description: 'KPLC PREPAID TOKEN',
      category: 'utilities',
      amount: 2000,
    });
    const { score, reasons } = scoreImpulse(txn, [], [], {});
    expect(reasons.some(r => r.includes('known biller'))).toBe(true);
    expect(score).toBe(0); // late-night +0.3 - 0.5 = clamped to 0
  });

  it('reduces score when within category budget', () => {
    const history = [
      makeTxn({ date: '2026-05-02T10:00:00', category: 'food', amount: 1000 }),
    ];
    const txn = makeTxn({
      date: '2026-05-15T14:00:00',
      category: 'food',
      amount: 1500,
      description: 'lunch',
    });
    const { reasons } = scoreImpulse(txn, history, [], { food: 10000 });
    expect(reasons.some(r => r.includes('within category budget'))).toBe(true);
  });

  it('clamps score between 0 and 1', () => {
    // Stack many positive signals
    const txn = makeTxn({
      date: '2026-05-15T02:00:00',
      category: 'shopping',
      amount: 50000,
      description: 'New Store',
    });
    const history = [
      makeTxn({ category: 'shopping', amount: 100 }),
      makeTxn({ category: 'shopping', amount: 100 }),
      makeTxn({ category: 'shopping', amount: 100 }),
    ];
    const { score } = scoreImpulse(txn, history, [], {});
    expect(score).toBeLessThanOrEqual(1);
    expect(score).toBeGreaterThan(0);
  });
});

// ── isLikelyImpulse ──────────────────────────────────────────
describe('isLikelyImpulse', () => {
  it('returns true when score >= 0.5', () => {
    const txn = makeTxn({
      date: '2026-05-15T02:00:00',
      category: 'shopping',
      description: 'Spontaneous Buy',
      amount: 5000,
    });
    expect(isLikelyImpulse(txn, [], [], {})).toBe(true);
  });

  it('returns false for routine recurring expense', () => {
    const txn = makeTxn({
      date: '2026-05-01T10:00:00',
      description: 'rent payment',
      category: 'housing',
      amount: 25000,
    });
    expect(isLikelyImpulse(txn, [], [], {})).toBe(false);
  });
});
