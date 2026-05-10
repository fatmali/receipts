import { describe, it, expect } from 'vitest';
import { formatKES, formatDate, formatPercent } from '../format.js';

describe('formatKES', () => {
  it('formats a positive integer with thousands separators', () => {
    const result = formatKES(1234);
    expect(result).toMatch(/KES\s*1,234/);
  });

  it('formats zero as "KES 0"', () => {
    expect(formatKES(0)).toBe('KES 0');
  });

  it('formats negative amounts with a minus sign', () => {
    const result = formatKES(-1234);
    expect(result).toContain('-');
    expect(result).toMatch(/KES/);
    expect(result).toMatch(/1,234/);
  });

  it('formats large numbers with multiple separators', () => {
    const result = formatKES(1234567);
    expect(result).toMatch(/KES/);
    expect(result).toMatch(/1,234,567/);
  });

  it('handles null gracefully', () => {
    const result = formatKES(null);
    expect(result).toMatch(/KES/);
    expect(result).not.toThrow;
  });

  it('handles undefined gracefully', () => {
    const result = formatKES(undefined);
    expect(result).toMatch(/KES/);
  });

  it('handles NaN gracefully', () => {
    const result = formatKES(NaN);
    expect(result).toMatch(/KES/);
  });
});

describe('formatDate', () => {
  it('formats an ISO date string to a readable format', () => {
    const result = formatDate('2026-05-10');
    expect(result).toContain('May');
    expect(result).toContain('10');
  });

  it('returns empty string for falsy input', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
  });

  it('returns the original string for invalid date', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  it('formats another date correctly', () => {
    const result = formatDate('2025-12-25');
    expect(result).toContain('Dec');
    expect(result).toContain('25');
  });
});

describe('formatPercent', () => {
  it('formats a whole number percentage', () => {
    const result = formatPercent(27.5);
    // Value > 1, used as-is, rounded
    expect(result).toBe('28%');
  });

  it('formats zero as "0%"', () => {
    expect(formatPercent(0)).toBe('0%');
  });

  it('formats a decimal ratio by multiplying by 100', () => {
    expect(formatPercent(0.5)).toBe('50%');
  });

  it('handles null gracefully', () => {
    expect(formatPercent(null)).toBe('0%');
  });

  it('handles NaN gracefully', () => {
    expect(formatPercent(NaN)).toBe('0%');
  });

  it('handles negative percentages', () => {
    const result = formatPercent(-15);
    expect(result).toBe('-15%');
  });
});
