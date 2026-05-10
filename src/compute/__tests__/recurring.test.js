import { detectRecurring, totalRecurringAnnual } from '../recurring.js';
import { makeTxn } from '../../test/fixtures.js';

// ── detectRecurring ──────────────────────────────────────────
describe('detectRecurring', () => {
  it('detects transactions appearing in 2+ months', () => {
    const txns = [
      makeTxn({ description: 'Netflix', amount: 1500, date: '2026-03-15' }),
      makeTxn({ description: 'Netflix', amount: 1500, date: '2026-04-15' }),
      makeTxn({ description: 'Netflix', amount: 1500, date: '2026-05-15' }),
      makeTxn({ description: 'Random Purchase', amount: 500, date: '2026-05-01' }),
    ];
    const result = detectRecurring(txns);
    expect(result.length).toBe(1);
    expect(result[0].description).toBe('Netflix');
  });

  it('amount within ±10% counts as recurring', () => {
    const txns = [
      makeTxn({ description: 'Spotify', amount: 1000, date: '2026-03-01' }),
      makeTxn({ description: 'Spotify', amount: 1050, date: '2026-04-01' }),
      makeTxn({ description: 'Spotify', amount: 950, date: '2026-05-01' }),
    ];
    const result = detectRecurring(txns);
    expect(result.length).toBe(1);
    expect(result[0].description).toBe('Spotify');
  });

  it('groups by description case-insensitive', () => {
    const txns = [
      makeTxn({ description: 'NETFLIX', amount: 1500, date: '2026-03-15' }),
      makeTxn({ description: 'netflix', amount: 1500, date: '2026-04-15' }),
      makeTxn({ description: 'Netflix', amount: 1500, date: '2026-05-15' }),
    ];
    const result = detectRecurring(txns);
    expect(result.length).toBe(1);
  });

  it('returns sorted by annualCost descending', () => {
    const txns = [
      makeTxn({ description: 'Cheap Sub', amount: 500, date: '2026-03-01' }),
      makeTxn({ description: 'Cheap Sub', amount: 500, date: '2026-04-01' }),
      makeTxn({ description: 'Expensive Sub', amount: 5000, date: '2026-03-01' }),
      makeTxn({ description: 'Expensive Sub', amount: 5000, date: '2026-04-01' }),
    ];
    const result = detectRecurring(txns);
    expect(result.length).toBe(2);
    expect(result[0].annualCost).toBeGreaterThan(result[1].annualCost);
    expect(result[0].description.toLowerCase()).toContain('expensive');
  });

  it('returns empty array for no recurring', () => {
    const txns = [
      makeTxn({ description: 'One-off A', amount: 500, date: '2026-05-01' }),
      makeTxn({ description: 'One-off B', amount: 300, date: '2026-05-02' }),
    ];
    expect(detectRecurring(txns)).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(detectRecurring([])).toEqual([]);
    expect(detectRecurring(null)).toEqual([]);
  });

  it('each result has expected properties', () => {
    const txns = [
      makeTxn({ description: 'Gym', amount: 3000, date: '2026-03-01' }),
      makeTxn({ description: 'Gym', amount: 3000, date: '2026-04-01' }),
    ];
    const result = detectRecurring(txns);
    expect(result[0]).toHaveProperty('description');
    expect(result[0]).toHaveProperty('amount');
    expect(result[0]).toHaveProperty('frequency');
    expect(result[0]).toHaveProperty('annualCost');
    expect(result[0]).toHaveProperty('count');
    expect(result[0]).toHaveProperty('months');
  });

  it('rejects amounts with >10% variance', () => {
    const txns = [
      makeTxn({ description: 'Erratic', amount: 1000, date: '2026-03-01' }),
      makeTxn({ description: 'Erratic', amount: 2000, date: '2026-04-01' }),
    ];
    expect(detectRecurring(txns)).toEqual([]);
  });
});

// ── totalRecurringAnnual ─────────────────────────────────────
describe('totalRecurringAnnual', () => {
  it('sums all annualCost values', () => {
    const recurring = [
      { annualCost: 18000 },
      { annualCost: 6000 },
      { annualCost: 12000 },
    ];
    expect(totalRecurringAnnual(recurring)).toBe(36000);
  });

  it('returns 0 for empty array', () => {
    expect(totalRecurringAnnual([])).toBe(0);
    expect(totalRecurringAnnual(null)).toBe(0);
  });
});
