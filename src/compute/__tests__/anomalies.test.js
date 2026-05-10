import { detectAnomalies } from '../anomalies.js';
import { makeTxn } from '../../test/fixtures.js';

describe('detectAnomalies', () => {
  it('flags categories exceeding mean + 2*stddev', () => {
    const current = [
      makeTxn({ type: 'expense', amount: 50000, category: 'food' }),
    ];
    // Historical: food spending was ~5000 each month
    const historical = [
      [makeTxn({ type: 'expense', amount: 5000, category: 'food' })],
      [makeTxn({ type: 'expense', amount: 5500, category: 'food' })],
      [makeTxn({ type: 'expense', amount: 4800, category: 'food' })],
    ];
    const result = detectAnomalies(current, historical);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].category).toBe('food');
    expect(result[0].currentAmount).toBe(50000);
    expect(result[0]).toHaveProperty('mean');
    expect(result[0]).toHaveProperty('message');
  });

  it('returns empty array when fewer than 2 historical months', () => {
    const current = [makeTxn({ type: 'expense', amount: 5000, category: 'food' })];
    expect(detectAnomalies(current, [])).toEqual([]);
    expect(detectAnomalies(current, [[makeTxn({ type: 'expense', amount: 3000, category: 'food' })]])).toEqual([]);
  });

  it('handles categories that only appear in some months', () => {
    const current = [
      makeTxn({ type: 'expense', amount: 20000, category: 'travel' }),
    ];
    // travel only in 1 historical month → < 2 months → no anomaly for travel
    const historical = [
      [makeTxn({ type: 'expense', amount: 5000, category: 'food' })],
      [
        makeTxn({ type: 'expense', amount: 5000, category: 'food' }),
        makeTxn({ type: 'expense', amount: 10000, category: 'travel' }),
      ],
    ];
    const result = detectAnomalies(current, historical);
    // travel has < 2 historical months, so no anomaly detected for it
    const travelAnomaly = result.find(a => a.category === 'travel');
    expect(travelAnomaly).toBeUndefined();
  });

  it('does not flag categories within normal range', () => {
    const current = [
      makeTxn({ type: 'expense', amount: 5200, category: 'food' }),
    ];
    const historical = [
      [makeTxn({ type: 'expense', amount: 5000, category: 'food' })],
      [makeTxn({ type: 'expense', amount: 5500, category: 'food' })],
      [makeTxn({ type: 'expense', amount: 4800, category: 'food' })],
    ];
    const result = detectAnomalies(current, historical);
    expect(result).toEqual([]);
  });

  it('returns empty array for empty current transactions', () => {
    const historical = [
      [makeTxn({ type: 'expense', amount: 5000, category: 'food' })],
      [makeTxn({ type: 'expense', amount: 5500, category: 'food' })],
    ];
    expect(detectAnomalies([], historical)).toEqual([]);
    expect(detectAnomalies(null, historical)).toEqual([]);
  });

  it('each anomaly has required properties', () => {
    const current = [
      makeTxn({ type: 'expense', amount: 50000, category: 'food' }),
    ];
    const historical = [
      [makeTxn({ type: 'expense', amount: 5000, category: 'food' })],
      [makeTxn({ type: 'expense', amount: 5000, category: 'food' })],
    ];
    const result = detectAnomalies(current, historical);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]).toHaveProperty('category');
    expect(result[0]).toHaveProperty('currentAmount');
    expect(result[0]).toHaveProperty('mean');
    expect(result[0]).toHaveProperty('message');
    expect(typeof result[0].message).toBe('string');
  });

  it('ignores uncategorized expenses', () => {
    const current = [
      makeTxn({ type: 'expense', amount: 50000, category: '' }),
    ];
    const historical = [
      [makeTxn({ type: 'expense', amount: 1000, category: '' })],
      [makeTxn({ type: 'expense', amount: 1000, category: '' })],
    ];
    const result = detectAnomalies(current, historical);
    expect(result).toEqual([]);
  });
});
