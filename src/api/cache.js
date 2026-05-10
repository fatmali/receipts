// IndexedDB cache with TTL logic via idb-keyval
// Stale-while-revalidate pattern for offline-first UX

import { get, set, del, keys } from 'idb-keyval';

const PREFIX = 'receipts_cache_';
const LAST_SYNC_KEY = 'receipts_last_sync';

/** Listeners notified when a background refresh completes */
const _updateListeners = new Set();

export function onCacheUpdate(cb) {
  _updateListeners.add(cb);
  return () => _updateListeners.delete(cb);
}

function notifyUpdate(cacheKey, data) {
  _updateListeners.forEach((cb) => {
    try { cb(cacheKey, data); } catch (_) { /* swallow */ }
  });
}

/**
 * Stale-while-revalidate fetch wrapper.
 *
 * 1. Check IndexedDB for cached response
 * 2. If cached and not expired: return cached data immediately
 * 3. If cached but stale: return cached data immediately, fetch fresh in background
 * 4. If no cache: fetch, cache, return
 * 5. If fetch fails and cache exists (even stale): return cached data
 * 6. If fetch fails and no cache: throw error
 *
 * @param {string} cacheKey
 * @param {Function} fetchFn - async function that performs the actual fetch
 * @param {number} ttlMs - time-to-live in milliseconds
 * @returns {Promise<{data: any, fromCache: boolean, stale: boolean}>}
 */
export async function cachedFetch(cacheKey, fetchFn, ttlMs, { force = false } = {}) {
  if (!force) {
    const cached = await getCached(cacheKey, ttlMs);

    if (cached && !cached.isStale) {
      return { data: cached.data, fromCache: true, stale: false };
    }

    if (cached && cached.isStale) {
      // Return stale data now, refresh in background
      refreshInBackground(cacheKey, fetchFn);
      return { data: cached.data, fromCache: true, stale: true };
    }
  }

  // No cache — must fetch
  try {
    const data = await fetchFn();
    await setCached(cacheKey, data);
    return { data, fromCache: false, stale: false };
  } catch (err) {
    // Last resort: return any expired cache
    const fallback = await getRaw(cacheKey);
    if (fallback) {
      return { data: fallback.data, fromCache: true, stale: true };
    }
    throw err;
  }
}

async function refreshInBackground(cacheKey, fetchFn) {
  try {
    const data = await fetchFn();
    await setCached(cacheKey, data);
    notifyUpdate(cacheKey, data);
  } catch (_) {
    // Silently fail — stale data already returned
  }
}

/**
 * Store data in cache with timestamp
 */
export async function setCached(cacheKey, data) {
  const entry = { data, timestamp: Date.now(), key: cacheKey };
  await set(PREFIX + cacheKey, entry);
  await set(LAST_SYNC_KEY, Date.now());
}

/**
 * Get cached data with staleness info
 * @returns {{ data: any, timestamp: number, isStale: boolean } | null}
 */
export async function getCached(cacheKey, ttlMs) {
  const entry = await getRaw(cacheKey);
  if (!entry) return null;
  const age = Date.now() - entry.timestamp;
  return { data: entry.data, timestamp: entry.timestamp, isStale: age > ttlMs };
}

async function getRaw(cacheKey) {
  try {
    return (await get(PREFIX + cacheKey)) || null;
  } catch (_) {
    return null;
  }
}

/**
 * Clear a specific cache entry
 */
export async function clearCache(cacheKey) {
  await del(PREFIX + cacheKey);
}

/**
 * Clear all cached data
 */
export async function clearAllCache() {
  const allKeys = await keys();
  const cacheKeys = allKeys.filter((k) => typeof k === 'string' && k.startsWith(PREFIX));
  await Promise.all(cacheKeys.map((k) => del(k)));
}

/**
 * Get cache size info for Settings display
 * @returns {{ entries: number, keys: string[] }}
 */
export async function getCacheInfo() {
  const allKeys = await keys();
  const cacheKeys = allKeys
    .filter((k) => typeof k === 'string' && k.startsWith(PREFIX))
    .map((k) => k.slice(PREFIX.length));
  return { entries: cacheKeys.length, keys: cacheKeys };
}

/**
 * Get the last sync timestamp
 * @returns {number|null}
 */
export async function getLastSyncTime() {
  return (await get(LAST_SYNC_KEY)) || null;
}
