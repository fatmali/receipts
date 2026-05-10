// Worth-It reviews — synced via the Apps Script backend.
// Reads use cachedFetch (stale-while-revalidate, offline-friendly).
// Writes go straight to the backend; the local cache is updated optimistically
// so the next read from any device picks up the change.

import { get, set } from 'idb-keyval';
import { fetchReviews, postReview } from './sheets.js';

const CACHE_KEY = 'cache:reviews';

/**
 * Fetch all reviews and return as a Map keyed by txnId.
 */
export async function getAllReviews({ force } = {}) {
  const list = await fetchReviews({ force });
  const map = new Map();
  for (const r of list) {
    if (r?.txnId) map.set(r.txnId, r);
  }
  return map;
}

/**
 * Save (upsert) a review.
 */
export async function saveReview(txnId, verdict, note = '') {
  if (!txnId) throw new Error('txnId required');
  if (!['worth', 'not_worth', 'neutral'].includes(verdict)) {
    throw new Error(`invalid verdict: ${verdict}`);
  }
  const review = {
    txnId,
    verdict,
    note: String(note || ''),
    reviewedAt: new Date().toISOString(),
  };

  await postReview(txnId, verdict, review.note);

  // Patch the local cache so the next read sees the new verdict immediately
  // (cachedFetch wraps payloads as { data, timestamp })
  try {
    const cached = await get(CACHE_KEY);
    if (cached?.data?.reviews) {
      const existingIdx = cached.data.reviews.findIndex(r => r.txnId === txnId);
      if (existingIdx >= 0) cached.data.reviews[existingIdx] = review;
      else cached.data.reviews.push(review);
      await set(CACHE_KEY, cached);
    }
  } catch {
    // best-effort cache patch — ignore
  }

  return review;
}

/**
 * Fetch a single review by txnId.
 */
export async function getReview(txnId) {
  if (!txnId) return null;
  const map = await getAllReviews();
  return map.get(txnId) || null;
}
