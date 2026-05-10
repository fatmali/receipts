import { useEffect, useState, useCallback } from 'react';
import { getAllReviews, saveReview } from './reviews.js';

/**
 * Hook: load all reviews into a Map (txnId → review).
 * Returns { reviews, save, loading, refresh }.
 */
export function useReviews() {
  const [reviews, setReviews] = useState(new Map());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const map = await getAllReviews({ force: true });
    setReviews(new Map(map));
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const map = await getAllReviews();
        if (mounted) setReviews(map);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const save = useCallback(async (txnId, verdict, note) => {
    // Optimistic update
    const optimistic = {
      txnId, verdict, note: note || '',
      reviewedAt: new Date().toISOString(),
    };
    setReviews(prev => {
      const next = new Map(prev);
      next.set(txnId, optimistic);
      return next;
    });
    try {
      await saveReview(txnId, verdict, note);
    } catch (err) {
      // Revert on failure
      await refresh();
      throw err;
    }
  }, [refresh]);

  return { reviews, save, loading, refresh };
}
