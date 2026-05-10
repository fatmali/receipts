// Apps Script API wrappers — signed requests with stale-while-revalidate caching

import { hmacSign } from './auth.js';
import { cachedFetch } from './cache.js';
import { getSecret, getAppsScriptUrl } from '../auth/session.js';

const TTL = {
  META: 60_000,            // 1 min
  SUMMARY: 300_000,        // 5 min
  RECENT: 120_000,         // 2 min
  RANGE: 300_000,          // 5 min
  CONFIG: 600_000,         // 10 min
  REVIEWS: 600_000,        // 10 min
  MONTH_CURRENT: 120_000,  // 2 min
  MONTH_PREVIOUS: 3_600_000, // 1 hour
  MONTH_OLD: 86_400_000,   // 24 hours
};

/**
 * Build a signed API URL for the given action
 */
async function buildSignedUrl(action, params = {}) {
  const secret = getSecret();
  if (!secret) throw new Error('Not authenticated');

  const baseUrl = getAppsScriptUrl();
  if (!baseUrl) throw new Error('Apps Script URL not configured');

  const ts = String(Date.now());
  const sig = await hmacSign(secret, ts);

  const url = new URL(baseUrl);
  url.searchParams.set('t', ts);
  url.searchParams.set('s', sig);
  url.searchParams.set('action', action);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}

/**
 * Execute a signed fetch and parse the JSON response.
 * Google Apps Script always returns 302 → script.googleusercontent.com,
 * so we follow redirects and parse the final response.
 */
async function signedFetch(action, params = {}) {
  const url = await buildSignedUrl(action, params);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();
  if (json && json.error) throw new Error(json.error);
  return json;
}

/**
 * Execute a signed POST with a JSON body. Auth (t, s, action) is included in
 * BOTH the URL query and the JSON body so the server can read it from either.
 */
async function signedPost(action, body = {}) {
  const secret = getSecret();
  if (!secret) throw new Error('Not authenticated');
  const baseUrl = getAppsScriptUrl();
  if (!baseUrl) throw new Error('Apps Script URL not configured');

  const ts = String(Date.now());
  const sig = await hmacSign(secret, ts);

  const url = new URL(baseUrl);
  url.searchParams.set('t', ts);
  url.searchParams.set('s', sig);
  url.searchParams.set('action', action);

  const res = await fetch(url.toString(), {
    method: 'POST',
    // text/plain to avoid CORS preflight (Apps Script doesn't handle OPTIONS)
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...body, action, t: ts, s: sig, timestamp: ts, signature: sig }),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();
  if (json && json.error) throw new Error(json.error);
  if (json && json.status === 'error') throw new Error(json.message || 'API error');
  return json;
}

/**
 * Fetch metadata — available months, total transactions, lastUpdated
 * Cache: 1 minute TTL
 */
export async function fetchMeta({ force } = {}) {
  const { data } = await cachedFetch(
    'meta',
    () => signedFetch('meta'),
    TTL.META,
    { force },
  );
  return data;
}

/**
 * Fetch monthly summaries — aggregates for all months
 * Cache: 5 minutes TTL
 */
export async function fetchSummary({ force } = {}) {
  const { data } = await cachedFetch(
    'summary',
    () => signedFetch('summary'),
    TTL.SUMMARY,
    { force },
  );
  return data;
}

/**
 * Fetch full transactions for a specific month
 * Cache: 2 min for current month, 1 hour for previous months, 24 hours for older
 * @param {string} month - Format "2026-05"
 */
export async function fetchMonth(month, { force } = {}) {
  if (!month) return null;
  const ttl = getMonthTtl(month);
  const { data } = await cachedFetch(
    `month:${month}`,
    () => signedFetch('month', { month }),
    ttl,
    { force },
  );
  return normalizeTransactions(data);
}

/**
 * Fetch latest N transactions across all months
 * Cache: 2 minutes TTL
 * @param {number} limit
 */
export async function fetchRecent(limit = 50, { force } = {}) {
  const { data } = await cachedFetch(
    `recent:${limit}`,
    () => signedFetch('recent', { limit }),
    TTL.RECENT,
    { force },
  );
  return normalizeTransactions(data);
}

/**
 * Fetch aggregates for a date range
 * Cache: 5 minutes TTL
 * @param {string} from - Format "2026-01"
 * @param {string} to - Format "2026-03"
 */
export async function fetchRange(from, to) {
  const { data } = await cachedFetch(
    `range:${from}:${to}`,
    () => signedFetch('range', { from, to }),
    TTL.RANGE,
  );
  return data;
}

/**
 * Fetch config — savings goal, budgets, salary config, categories.
 * API returns: { savingsGoal, budgets: {}, monthOverrides: {}, salary: { amount, day, account }, categories: string[] }
 * Cache: 10 minutes TTL
 */
export async function fetchConfig({ force } = {}) {
  const { data } = await cachedFetch(
    'config',
    () => signedFetch('config'),
    TTL.CONFIG,
    { force },
  );
  if (!data) return {};
  return {
    savingsGoal: data.savingsGoal,
    budgets: data.budgets,
    monthOverrides: data.monthOverrides,
    salary: data.salary,
    categories: data.categories || [],
    wealth: data.wealth || {},
  };
}

/**
 * Fetch all Worth-It reviews from the backend.
 * Returns: { reviews: [{ txnId, verdict, reviewedAt, note }] }
 */
export async function fetchReviews({ force } = {}) {
  const { data } = await cachedFetch(
    'reviews',
    () => signedFetch('reviews'),
    TTL.REVIEWS,
    { force },
  );
  return data?.reviews || [];
}

/**
 * Save a Worth-It review to the backend.
 * @param {string} txnId
 * @param {'worth'|'not_worth'|'neutral'} verdict
 * @param {string} note
 */
export async function postReview(txnId, verdict, note = '') {
  return signedPost('review', { reviews: { txnId, verdict, note } });
}

/**
 * Update categories for one or more transactions.
 * @param {Array<{ txn_id: string, category: string }>} updates
 */
export async function updateCategories(updates) {
  const secret = getSecret();
  if (!secret) throw new Error('Not authenticated');
  const baseUrl = getAppsScriptUrl();
  if (!baseUrl) throw new Error('Apps Script URL not configured');

  const ts = Date.now();
  const sig = await hmacSign(secret, String(ts));
  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'updateCategories',
      updates,
      timestamp: ts,
      signature: sig,
    }),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();
  if (json && json.error) throw new Error(json.error);
  return json;
}

/**
 * Normalize a transaction object — lowercase type field for consistent matching
 */
function normalizeTransaction(t) {
  if (!t || typeof t !== 'object') return t;
  return { ...t, type: typeof t.type === 'string' ? t.type.toLowerCase() : t.type };
}

function normalizeTransactions(data) {
  if (!data) return data;
  if (Array.isArray(data.transactions)) {
    return { ...data, transactions: data.transactions.map(normalizeTransaction) };
  }
  if (Array.isArray(data)) {
    return data.map(normalizeTransaction);
  }
  return data;
}

/**
 * Determine TTL based on how old the month is relative to now.
 * Accepts both "2026-05" and "May 2026" formats.
 */
function getMonthTtl(month) {
  const now = new Date();
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const currentDisplay = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  const currentISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  if (month === currentDisplay || month === currentISO) return TTL.MONTH_CURRENT;

  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevDisplay = `${monthNames[prev.getMonth()]} ${prev.getFullYear()}`;
  const prevISO = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;

  if (month === prevDisplay || month === prevISO) return TTL.MONTH_PREVIOUS;

  return TTL.MONTH_OLD;
}
