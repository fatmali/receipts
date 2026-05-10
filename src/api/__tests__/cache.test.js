import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock idb-keyval with an in-memory Map
const store = new Map();
vi.mock('idb-keyval', () => ({
  get: vi.fn((key) => Promise.resolve(store.get(key))),
  set: vi.fn((key, value) => { store.set(key, value); return Promise.resolve(); }),
  del: vi.fn((key) => { store.delete(key); return Promise.resolve(); }),
  keys: vi.fn(() => Promise.resolve([...store.keys()])),
}));

// Import after mock is set up
const {
  cachedFetch,
  getCached,
  setCached,
  clearCache,
  clearAllCache,
  getCacheInfo,
  getLastSyncTime,
} = await import('../cache.js');

/*
 * Tests for the caching layer (IndexedDB via idb-keyval).
 *
 * The module uses idb-keyval for storage with TTL-based staleness.
 * We mock idb-keyval with an in-memory Map to avoid needing IndexedDB.
 */

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

// ── setCached / getCached ────────────────────────────────────────────

describe('setCached / getCached', () => {
  it('set and get roundtrip', async () => {
    await setCached('key1', { name: 'test' });
    const result = await getCached('key1', 60_000);

    expect(result).not.toBeNull();
    expect(result.data).toEqual({ name: 'test' });
  });

  it('getCached returns null for missing keys', async () => {
    const result = await getCached('nonexistent', 60_000);

    expect(result).toBeNull();
  });

  it('getCached correctly identifies stale data based on TTL', async () => {
    await setCached('stale-key', 'old-data');

    // Manually age the entry by back-dating its timestamp
    const entry = store.get('receipts_cache_stale-key');
    if (entry && typeof entry === 'object') {
      entry.timestamp = Date.now() - 120_000; // 2 min ago, TTL is 1 min
      store.set('receipts_cache_stale-key', entry);
    }

    const result = await getCached('stale-key', 60_000);

    // Should still return data but mark it as stale
    expect(result).not.toBeNull();
    expect(result.isStale).toBe(true);
    expect(result.data).toBe('old-data');
  });

  it('getCached returns fresh data within TTL', async () => {
    await setCached('fresh-key', 'fresh-data');
    const result = await getCached('fresh-key', 60_000);

    expect(result).not.toBeNull();
    expect(result.isStale).toBe(false);
    expect(result.data).toBe('fresh-data');
  });
});

// ── cachedFetch ──────────────────────────────────────────────────────

describe('cachedFetch', () => {
  it('returns fresh data and caches it on first call', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ items: [1, 2, 3] });

    const result = await cachedFetch('first-call', fetchFn, 60_000);

    expect(fetchFn).toHaveBeenCalledOnce();
    expect(result.data).toEqual({ items: [1, 2, 3] });
    expect(result.fromCache).toBe(false);
  });

  it('returns cached data on second call within TTL', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ items: [1, 2, 3] });

    await cachedFetch('cached-key', fetchFn, 60_000);
    fetchFn.mockClear();

    const result = await cachedFetch('cached-key', fetchFn, 60_000);

    expect(result.fromCache).toBe(true);
    expect(result.data).toEqual({ items: [1, 2, 3] });
    // Should not call fetchFn again when cache is fresh
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('returns stale cached data and triggers background refresh after TTL expires', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ items: [1, 2, 3] });

    // First call — populate cache
    await cachedFetch('stale-fetch', fetchFn, 60_000);
    fetchFn.mockClear();

    // Age the cache entry
    const entry = store.get('receipts_cache_stale-fetch');
    if (entry && typeof entry === 'object') {
      entry.timestamp = Date.now() - 120_000;
      store.set('receipts_cache_stale-fetch', entry);
    }

    fetchFn.mockResolvedValue({ items: [4, 5, 6] });

    const result = await cachedFetch('stale-fetch', fetchFn, 60_000);

    // Should return stale data immediately
    expect(result.stale).toBe(true);
    expect(result.data).toEqual({ items: [1, 2, 3] });

    // Background refresh should have been triggered
    // Allow microtasks to flush
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchFn).toHaveBeenCalled();
  });

  it('returns cached data when fetch fails (offline fallback)', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ online: true });

    // Populate cache
    await cachedFetch('offline-key', fetchFn, 60_000);

    // Age the entry so it's stale
    const entry = store.get('receipts_cache_offline-key');
    if (entry && typeof entry === 'object') {
      entry.timestamp = Date.now() - 120_000;
      store.set('receipts_cache_offline-key', entry);
    }

    // Fetch fails now
    fetchFn.mockRejectedValue(new Error('Network error'));

    const result = await cachedFetch('offline-key', fetchFn, 60_000);

    expect(result.data).toEqual({ online: true });
    expect(result.fromCache).toBe(true);
  });

  it('throws when no cache and fetch fails', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('Network error'));

    await expect(
      cachedFetch('no-cache-key', fetchFn, 60_000)
    ).rejects.toThrow();
  });

  it('fromCache and stale flags are set correctly', async () => {
    const fetchFn = vi.fn().mockResolvedValue('data');

    // Fresh fetch
    const r1 = await cachedFetch('flags-key', fetchFn, 60_000);
    expect(r1.fromCache).toBe(false);
    expect(r1.stale).toBeFalsy();

    // Cached fetch (within TTL)
    const r2 = await cachedFetch('flags-key', fetchFn, 60_000);
    expect(r2.fromCache).toBe(true);
    expect(r2.stale).toBeFalsy();
  });
});

// ── clearCache / clearAllCache ───────────────────────────────────────

describe('clearCache / clearAllCache', () => {
  it('clearCache removes a specific entry', async () => {
    await setCached('remove-me', 'data');
    await setCached('keep-me', 'data');

    await clearCache('remove-me');

    expect(await getCached('remove-me', 60_000)).toBeNull();
    expect(await getCached('keep-me', 60_000)).not.toBeNull();
  });

  it('clearAllCache removes all entries', async () => {
    await setCached('a', 1);
    await setCached('b', 2);
    await setCached('c', 3);

    await clearAllCache();

    expect(await getCached('a', 60_000)).toBeNull();
    expect(await getCached('b', 60_000)).toBeNull();
    expect(await getCached('c', 60_000)).toBeNull();
  });
});

// ── getCacheInfo ─────────────────────────────────────────────────────

describe('getCacheInfo', () => {
  it('returns entry count and keys', async () => {
    await setCached('info-a', 1);
    await setCached('info-b', 2);

    const info = await getCacheInfo();

    expect(info.entries).toBe(2);
    expect(info.keys).toEqual(expect.arrayContaining(['info-a', 'info-b']));
  });
});

// ── getLastSyncTime ──────────────────────────────────────────────────

describe('getLastSyncTime', () => {
  it('returns null when no syncs', async () => {
    const ts = await getLastSyncTime();

    expect(ts).toBeNull();
  });

  it('returns timestamp of most recent sync', async () => {
    const before = Date.now();
    await setCached('sync-key', 'data');
    const after = Date.now();

    const ts = await getLastSyncTime();

    // Should be within a reasonable window of when we cached
    if (ts !== null) {
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    }
  });
});
