// React hooks for data fetching — consumed by Jesse's UI components

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { fetchMeta, fetchSummary, fetchMonth, fetchRecent, fetchConfig } from './sheets.js';
import { getLastSyncTime, onCacheUpdate } from './cache.js';
import { buildSalaryCycles, currentCycle, previousCycle } from '../compute/cycles.js';

/**
 * Generic hook for fetching data with loading/error/refresh states.
 * Handles stale-while-revalidate: shows cached data immediately,
 * updates when fresh data arrives via cache update listener.
 *
 * @param {Function} fetchFn
 * @param {Function} forceFetchFn
 * @param {Array} deps
 * @param {string|string[]|((key:string)=>boolean)} cacheKeyMatch
 *   The cache key(s) this hook listens to. Without this, every cache update
 *   would trigger a re-load on every hook (N² cascade).
 */
export function useApiData(fetchFn, forceFetchFn, deps = [], cacheKeyMatch = null) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const fetchRef = useRef(fetchFn);
  const forceFetchRef = useRef(forceFetchFn);
  const dataRef = useRef(null);
  fetchRef.current = fetchFn;
  forceFetchRef.current = forceFetchFn;
  dataRef.current = data;

  const load = useCallback(async () => {
    // Only show loading skeleton on first load. Background refreshes are silent
    // so the UI keeps showing cached data instead of flashing "0".
    if (dataRef.current == null) setLoading(true);
    setError(null);
    try {
      const result = await fetchRef.current();
      setData(result);
      setFromCache(false);
      const syncTime = await getLastSyncTime();
      setLastSync(syncTime);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  const forceRefresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await forceFetchRef.current();
      setData(result);
      setFromCache(false);
      const syncTime = await getLastSyncTime();
      setLastSync(syncTime);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Listen for background cache refreshes — but only for keys this hook owns.
  useEffect(() => {
    if (!cacheKeyMatch) return undefined;
    const matches = (key) => {
      if (typeof cacheKeyMatch === 'function') return cacheKeyMatch(key);
      if (Array.isArray(cacheKeyMatch)) return cacheKeyMatch.includes(key);
      return key === cacheKeyMatch;
    };
    return onCacheUpdate((updatedKey) => {
      if (matches(updatedKey)) load();
    });
  }, [load, cacheKeyMatch]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, refresh: forceRefresh, fromCache, lastSync };
}

export function useMeta() {
  return useApiData(fetchMeta, () => fetchMeta({ force: true }), [], 'meta');
}

export function useSummary() {
  return useApiData(fetchSummary, () => fetchSummary({ force: true }), [], 'summary');
}

export function useMonth(month) {
  return useApiData(
    () => fetchMonth(month),
    () => fetchMonth(month, { force: true }),
    [month],
    month ? `month:${month}` : null,
  );
}

/**
 * Load every month in a year in parallel and combine into a single
 * transactions array sorted newest-first.
 * @param {string|null} year - e.g. "2026"
 * @param {string[]} allMonths - list of available month strings (e.g. ["Jan 2026", ...])
 */
export function useYear(year, allMonths) {
  const monthsInYear = (year && allMonths?.length)
    ? allMonths.filter((m) => m.endsWith(` ${year}`))
    : [];
  const depsKey = monthsInYear.join('|');

  return useApiData(
    async () => {
      if (!monthsInYear.length) return null;
      const results = await Promise.all(monthsInYear.map((m) => fetchMonth(m)));
      const txns = results.flatMap((r) => r?.transactions || []);
      txns.sort((a, b) => new Date(b.date) - new Date(a.date));
      return { transactions: txns, monthsLoaded: monthsInYear };
    },
    async () => {
      if (!monthsInYear.length) return null;
      const results = await Promise.all(monthsInYear.map((m) => fetchMonth(m, { force: true })));
      const txns = results.flatMap((r) => r?.transactions || []);
      txns.sort((a, b) => new Date(b.date) - new Date(a.date));
      return { transactions: txns, monthsLoaded: monthsInYear };
    },
    [depsKey],
    (key) => typeof key === 'string' && key.startsWith('month:') && monthsInYear.some(m => key === `month:${m}`),
  );
}

export function useRecent(limit = 50) {
  return useApiData(
    () => fetchRecent(limit),
    () => fetchRecent(limit, { force: true }),
    [limit],
    `recent:${limit}`,
  );
}

export function useConfig() {
  return useApiData(fetchConfig, () => fetchConfig({ force: true }), [], 'config');
}

/**
 * Hook for sync status display
 * @returns {{ lastSync: number|null, isOnline: boolean, formattedLastSync: string }}
 */
export function useSyncStatus() {
  const isOnline = useOnlineStatus();
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    getLastSyncTime().then(setLastSync);
    return onCacheUpdate(() => {
      getLastSyncTime().then(setLastSync);
    });
  }, []);

  let formattedLastSync = 'Never';
  if (lastSync) {
    const ago = Date.now() - lastSync;
    if (ago < 60_000) formattedLastSync = 'Just now';
    else if (ago < 3_600_000) formattedLastSync = `${Math.floor(ago / 60_000)}m ago`;
    else formattedLastSync = new Date(lastSync).toLocaleTimeString();
  }

  return { lastSync, isOnline, formattedLastSync };
}

/**
 * Hook that loads all available months, combines transactions, and groups
 * them into salary-based cycles (pay-period "months").
 *
 * @param {string[]} allMonths - available month labels from useMeta
 * @returns {{ cycles, activeCycle, prevCycle, selectCycle, loading, refresh, lastSync, isOnline }}
 */
const INITIAL_WINDOW = 6;
const LOAD_MORE_STEP = 6;

function dedup(transactions) {
  const seen = new Set();
  return transactions.filter(t => {
    if (!t.txn_id || seen.has(t.txn_id)) return false;
    seen.add(t.txn_id);
    return true;
  });
}

export function useSalaryCycles(allMonths) {
  const total = (allMonths || []).length;
  const [window, setWindow] = useState(INITIAL_WINDOW);
  const [selectedLabel, setSelectedLabel] = useState(null);

  const monthsToFetch = useMemo(
    () => (allMonths || []).slice(-Math.min(window, total)),
    [allMonths, window, total],
  );
  const hasMore = monthsToFetch.length < total;
  const depsKey = monthsToFetch.join('|');

  const result = useApiData(
    async () => {
      if (!monthsToFetch.length) return null;
      const results = await Promise.all(monthsToFetch.map(m => fetchMonth(m)));
      const txns = dedup(results.flatMap(r => r?.transactions || []));
      return { transactions: txns };
    },
    async () => {
      if (!monthsToFetch.length) return null;
      const results = await Promise.all(monthsToFetch.map(m => fetchMonth(m, { force: true })));
      const txns = dedup(results.flatMap(r => r?.transactions || []));
      return { transactions: txns };
    },
    [depsKey],
    (key) => typeof key === 'string' && key.startsWith('month:'),
  );

  const cycles = useMemo(() => {
    if (!result.data?.transactions?.length) return [];
    return buildSalaryCycles(result.data.transactions);
  }, [result.data]);

  const activeCycle = useMemo(() => {
    if (!cycles.length) return null;
    if (selectedLabel) {
      return cycles.find(c => c.label === selectedLabel) || cycles[cycles.length - 1];
    }
    return currentCycle(cycles);
  }, [cycles, selectedLabel]);

  const prevCycle = useMemo(
    () => previousCycle(cycles, activeCycle),
    [cycles, activeCycle],
  );

  const loadMore = useCallback(
    () => setWindow(w => Math.min(w + LOAD_MORE_STEP, total)),
    [total],
  );

  return {
    cycles,
    activeCycle,
    prevCycle,
    selectCycle: setSelectedLabel,
    hasMore,
    loadMore,
    loading: result.loading,
    refresh: result.refresh,
    lastSync: result.lastSync,
  };
}

/**
 * Hook for online/offline status
 * @returns {boolean}
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
}
