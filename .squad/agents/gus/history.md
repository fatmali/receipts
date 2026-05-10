# Gus — History

## Core Context

Backend dev for Receipts PWA. WebAuthn + AES-GCM + PBKDF2 auth. HMAC-SHA256 API signing. IndexedDB caching. Pure compute functions. All crypto via SubtleCrypto. Owner: Fatma.

## Learnings

- PBKDF2 salt must be stored separately from encrypted payloads — using localStorage key `receipts_pbkdf2_salt`. Salt is not sensitive, only needs to be consistent across derivations.
- WebAuthn doesn't provide a shared secret, so we use a "wrapper key" pattern: a random AES key stored in localStorage acts as the gate. WebAuthn authentication is the authorization check; the wrapper key does the actual decryption. This is secure because the app logic won't read the wrapper key until WebAuthn passes.
- Both unlock paths (WebAuthn and PIN) encrypt the same HMAC secret with different keys. This means the user can recover via PIN if biometrics fail, without storing anything on a server.
- `crypto.subtle.decrypt` throws a DOMException on wrong key/ciphertext, which we catch to surface "Incorrect PIN" instead of a raw error.
- AuthContext.jsx already implements React-level auto-lock and visibility-lock. session.js provides standalone equivalents for non-React consumers if needed — both coexist without conflict.
- `isLocked()` kept as alias for backward compatibility since AuthContext.jsx may reference it.
- CryptoKey for HMAC signing should be cached at module level — `crypto.subtle.importKey` is expensive and the secret rarely changes within a session. Cache is invalidated when the secret string changes.
- `cachedFetch` stale-while-revalidate: return stale data immediately so the UI is never blocked, fire background refresh via fire-and-forget async call. Use a simple Set-based listener pattern (`onCacheUpdate`) so hooks can re-render when background refresh completes — no need for a full event emitter.
- Dynamic TTL for `fetchMonth`: compare month string (`YYYY-MM`) against current and previous month keys derived from `new Date()`. Avoids any date parsing of the month param itself.
- IndexedDB keys prefixed with `receipts_cache_` so `clearAllCache()` can enumerate and delete only our entries without touching idb-keyval's other consumers.
- `useApiData` hook stores `fetchFn` in a ref so the effect's dependency array only contains the serializable deps (month string, limit number), avoiding infinite re-render loops from unstable function references.
- All compute functions (metrics, trends, recurring, anomalies, insights) are pure — no side effects, no state. Every function guards against null/undefined/empty input and returns sensible defaults (0, null, or []).
- `fulizaOutstanding` uses a two-strategy approach: prefer the `fuliza_outstanding` field from the latest transaction that has it, fall back to manual drawn-minus-repaid calculation.
- `detectRecurring` normalizes descriptions (lowercase + trim) and uses ±10% of median amount as the consistency check. Frequency threshold is 80% of total month span for "monthly".
- `detectAnomalies` requires at least 2 historical months and 2 appearances per category. When stddev is 0 (identical history), uses a 20% deviation threshold instead of z-score.
- `generateInsights` caps output at 8 insights, prioritized from most to least actionable. Imports from metrics.js and recurring.js — keep cross-module imports minimal and acyclic.
- `monthOverMonth` in trends.js imports metric functions from metrics.js to recompute per-month values from raw transactions, keeping the summary data computation consistent with the rest of the app.
