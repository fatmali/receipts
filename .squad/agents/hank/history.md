# Hank — History

## Core Context

Tester and security auditor for Receipts PWA. Reviews crypto/auth implementations. Tests edge cases: zero income, empty data, offline state. Owner: Fatma.

## Learnings

- **jsdom v27 + @csstools/css-calc ESM conflict**: jsdom's dep chain (`@asamuzakjp/css-color` → `@csstools/css-calc`) tries to `require()` an ESM-only module. Neither `pool: 'threads'` nor `server.deps.inline` fixes it with vitest 4.x. Switched to `happy-dom` — lighter, no ESM conflicts, works fine for our tests.
- **Gus's crypto API** (`encrypt(key, plaintext)`, `decrypt(key, ciphertext, iv)`) — key is the first arg, not second. The encrypt returns `{ ciphertext, iv }` as base64 strings, not raw buffers. Tests must match this signature.
- **PBKDF2 derived keys are non-extractable** (correct security practice). To test determinism, encrypt-then-cross-decrypt instead of exporting raw bytes.
- **Web Crypto polyfill** needed in test setup: `globalThis.crypto = webcrypto` from `node:crypto`.
- Test infra: vitest + happy-dom + @testing-library. Config in `vite.config.js` `test` block, setup in `src/test/setup.js`.
- **Phase 2 API tests (2026-05-10):** 34 new tests across 3 files (`src/api/__tests__/auth.test.js`, `cache.test.js`, `sheets.test.js`). Total suite: 79 tests, all green. Build clean.
- **idb-keyval mock pattern:** Use `vi.mock('idb-keyval')` with an in-memory `Map`. Cache module prefixes keys with `receipts_cache_` — when aging entries for stale tests, must access `store.get('receipts_cache_' + key)`, not the bare key.
- **Cache API field names:** `getCached()` returns `{ data, timestamp, isStale }` (not `stale`). `cachedFetch()` returns `{ data, fromCache, stale }` (lowercase). `getCacheInfo()` returns `{ entries, keys }` (not `count`). `setCached(key, data)` takes 2 args (no TTL — TTL is only used at read time).
- **Sheets wrappers unwrap data:** `fetchMeta()` etc. destructure `{ data }` from cachedFetch result and return `data` directly. Test return values as plain data, not wrapped.
- **Phase 3 compute tests (2026-05-10):** 87 new tests across 5 files (`src/compute/__tests__/metrics.test.js`, `trends.test.js`, `recurring.test.js`, `anomalies.test.js`, `insights.test.js`). Total suite: 166 tests, all green. Build clean.
- **Test data factory:** `src/test/fixtures.js` with `makeTxn()` factory and preset datasets (`MIXED_TRANSACTIONS`, `FULIZA_TRANSACTIONS`, `ZERO_INCOME`, `UNCATEGORIZED_TRANSACTIONS`). Reusable across all compute tests.
- **Insights test gotcha:** `generateInsights` returns non-monetary strings too (e.g. "Most active account: mpesa (6 transactions)"). Don't assert KES on every insight containing digits — filter for monetary insights specifically.
- **topCategory returns empty string** (not null/undefined) when no data. Match Gus's implementation.
