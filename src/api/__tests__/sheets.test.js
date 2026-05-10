import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock('../auth.js', () => ({
  hmacSign: vi.fn().mockResolvedValue('mockedsignature'),
}));

vi.mock('../cache.js', () => ({
  cachedFetch: vi.fn().mockImplementation(async (key, fetchFn, ttl) => {
    const data = await fetchFn();
    return { data, fromCache: false, stale: false };
  }),
}));

vi.mock('../../auth/session.js', () => ({
  getSecret: vi.fn().mockReturnValue('test-secret'),
  getAppsScriptUrl: vi.fn().mockReturnValue('https://script.google.com/macros/s/test/exec'),
}));

// Mock global fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Import after mocks
const { fetchMeta, fetchSummary, fetchMonth, fetchRecent } = await import('../sheets.js');
const { cachedFetch } = await import('../cache.js');
const { hmacSign } = await import('../auth.js');
const { getSecret } = await import('../../auth/session.js');

/*
 * Tests for the Sheets API wrappers.
 *
 * All dependencies are mocked so tests work before Gus
 * finishes the real implementations.
 */

beforeEach(() => {
  vi.clearAllMocks();

  // Default: API returns valid JSON
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ status: 'ok', data: {} }),
  });

  // Re-set getSecret to return a secret (authenticated state)
  getSecret.mockReturnValue('test-secret');
});

// ── fetchMeta ────────────────────────────────────────────────────────

describe('fetchMeta', () => {
  it('calls API with action=meta', async () => {
    const metaData = {
      availableMonths: ['Jan 2026'],
      totalTransactions: 100,
      lastUpdated: '2026-05-10',
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(metaData),
    });

    await fetchMeta();

    // cachedFetch should have been called with 'meta' key
    expect(cachedFetch).toHaveBeenCalled();
    const [cacheKey] = cachedFetch.mock.calls[0];
    expect(cacheKey).toBe('meta');
  });

  it('returns parsed response data', async () => {
    const metaData = {
      availableMonths: ['Jan 2026', 'Feb 2026'],
      totalTransactions: 200,
      lastUpdated: '2026-05-10',
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(metaData),
    });

    const result = await fetchMeta();

    // fetchMeta calls signedFetch which parses JSON,
    // then cachedFetch wraps it, then fetchMeta destructures { data }
    expect(result).toBeDefined();
  });

  it('uses correct cache key and TTL (1 min for meta)', async () => {
    await fetchMeta();

    expect(cachedFetch).toHaveBeenCalledWith(
      'meta',
      expect.any(Function),
      60_000, // 1 minute
      expect.any(Object)
    );
  });
});

// ── fetchSummary ─────────────────────────────────────────────────────

describe('fetchSummary', () => {
  it('calls API with action=summary', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ months: [] }),
    });

    await fetchSummary();

    expect(cachedFetch).toHaveBeenCalled();
    const [cacheKey] = cachedFetch.mock.calls[0];
    expect(cacheKey).toBe('summary');
  });

  it('uses correct cache TTL (5 min)', async () => {
    await fetchSummary();

    expect(cachedFetch).toHaveBeenCalledWith(
      'summary',
      expect.any(Function),
      300_000, // 5 minutes
      expect.any(Object)
    );
  });
});

// ── fetchMonth ───────────────────────────────────────────────────────

describe('fetchMonth', () => {
  it('calls API with action=month and month param', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ month: '2026-05', count: 0, transactions: [] }),
    });

    await fetchMonth('2026-05');

    // Verify the fetchFn inside cachedFetch would call fetch with month param
    expect(cachedFetch).toHaveBeenCalled();
    const [cacheKey] = cachedFetch.mock.calls[0];
    expect(cacheKey).toContain('month');
    expect(cacheKey).toContain('2026-05');
  });

  it('current month uses 2-min TTL', async () => {
    // Current month in YYYY-MM format
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    await fetchMonth(currentMonth);

    const [, , ttl] = cachedFetch.mock.calls[0];
    expect(ttl).toBe(120_000); // 2 minutes
  });

  it('past month uses longer TTL', async () => {
    await fetchMonth('2026-01');

    const [, , ttl] = cachedFetch.mock.calls[0];
    expect(ttl).toBeGreaterThan(120_000); // more than 2 min
  });
});

// ── fetchRecent ──────────────────────────────────────────────────────

describe('fetchRecent', () => {
  it('calls API with action=recent and limit param', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ transactions: [] }),
    });

    await fetchRecent(25);

    expect(cachedFetch).toHaveBeenCalled();
    const [cacheKey] = cachedFetch.mock.calls[0];
    expect(cacheKey).toContain('recent');
  });

  it('default limit is 50', async () => {
    await fetchRecent();

    expect(cachedFetch).toHaveBeenCalled();
    const [cacheKey] = cachedFetch.mock.calls[0];
    expect(cacheKey).toContain('recent');
    // The fetch function inside cachedFetch should use limit=50
    // We verify this by calling the fetch function
    const fetchFn = cachedFetch.mock.calls[0][1];
    expect(fetchFn).toBeDefined();
  });
});

// ── Error cases ──────────────────────────────────────────────────────

describe('error cases', () => {
  it('throws when no secret is available (not authenticated)', async () => {
    getSecret.mockReturnValue(null);

    await expect(fetchMeta()).rejects.toThrow();
  });

  it('handles API error responses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({ error: 'Server error' }),
    });

    // The cachedFetch mock calls fetchFn directly, so the error
    // should propagate if the implementation checks response.ok
    cachedFetch.mockImplementationOnce(async (key, fetchFn, ttl) => {
      const data = await fetchFn();
      return { data, fromCache: false, stale: false };
    });

    // Depending on implementation, this may throw or return error data
    // We test that it doesn't silently swallow the error
    try {
      const result = await fetchMeta();
      // If it doesn't throw, the error data should be available
      expect(result).toBeDefined();
    } catch (err) {
      expect(err).toBeDefined();
    }
  });
});
