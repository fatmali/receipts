# Receipts: Finance Tracker PWA — Squad Build Plan

## Project Overview

Build a personal finance PWA (Progressive Web App) called Receipts that reads transaction data from a Google Sheets backend via a secured Apps Script API. The app is for a single user (Fatma) based in Nairobi, Kenya. All transactions are in KES unless marked otherwise. The app must be installable on iOS via Safari "Add to Home Screen", work offline, and be secured behind Face ID / PIN authentication.

The data pipeline is already built and running:
- M-Pesa, Bank A, Bank B, and Bank C SMS messages are automatically parsed and stored in Google Sheets
- Each month gets its own sheet tab (e.g. "Jan 2026", "Feb 2026")
- Data is read via an authenticated Apps Script Web App URL

Your job is to build the dashboard PWA that consumes this data.

---

## Tech Stack

- **Framework:** React 18 with Vite
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **Date handling:** Native JS Date only — no moment or dayjs
- **Storage:** IndexedDB via `idb-keyval` for transaction cache, localStorage for settings
- **PWA:** `vite-plugin-pwa` for manifest, service worker, and precaching
- **Deployment:** GitHub Pages (`gh-pages` branch)

No backend. No server. Static site only. All auth is client-side using the Web Crypto API.

---

## Design System

Dark mode only. Warm, minimal aesthetic.

### Colors
```
--bg:           #0F1117
--surface:      #151821
--border:       #1C1F2A
--text:         #F0EDE8
--text-muted:   #6B7280
--text-faint:   #4B5563

--green:        #52B788   /* income, success, M-Pesa */
--orange:       #E8845A   /* expense, warning, Bank C */
--blue:         #4EA8DE   /* info, neutral, Bank A */
--purple:       #C77DCC   /* Fuliza, special */
--yellow:       #F4C542   /* caution, Pesalink */
```

### Typography
```
Body:    DM Sans (Google Fonts)
Headers: Sora (Google Fonts)
Numbers: JetBrains Mono (Google Fonts)
```

### Spacing & Mobile
- Min tap target: 44x44pt
- Bottom safe area: `env(safe-area-inset-bottom)`
- Viewport: `width=device-width, initial-scale=1.0, viewport-fit=cover`
- Primary layout: single column, 375-430px
- Bottom tab navigation (not top nav)

---

## Authentication

The app stores the HMAC secret (used to sign API requests) encrypted in localStorage. It is only decrypted after the user authenticates with Face ID or PIN.

### First Launch Flow
1. Show setup screen — user pastes their Apps Script URL and HMAC secret
2. App generates a random AES-GCM encryption key backed by WebAuthn (Face ID)
3. Secret is encrypted with that key and stored in localStorage
4. User sets a fallback PIN (4-6 digits)
5. Fallback PIN used to derive a second encryption key via PBKDF2

### Every Launch Flow
1. Show lock screen (blank, no data visible)
2. Trigger WebAuthn authentication (Face ID / Touch ID)
3. On success: decrypt HMAC secret from localStorage, store in memory only
4. On WebAuthn failure: show PIN pad, derive key from PIN, decrypt secret
5. App renders only after successful auth
6. Auto-lock after 15 minutes of inactivity or when app goes to background

### File Structure for Auth
```
src/auth/
  LockScreen.jsx         — PIN pad UI + Face ID trigger button
  SetupScreen.jsx        — First launch: paste URL + secret + set PIN
  webauthn.js            — register() and authenticate() functions
  crypto.js              — AES-GCM encrypt/decrypt, PBKDF2 key derivation
  session.js             — In-memory secret store + auto-lock timer
```

### WebAuthn Implementation Notes
- Use `authenticatorAttachment: "platform"` (device biometrics only)
- `userVerification: "required"`
- Store credential ID in localStorage (not sensitive)
- Use `SubtleCrypto` for all crypto operations — no external libraries

---

## API Layer

The Apps Script endpoint supports multiple actions via query parameters. All requests must be signed with HMAC-SHA256.

### HMAC Signing
```javascript
// Sign timestamp only — simple and consistent across environments
const ts = Date.now();
const sig = await hmacSign(secret, String(ts)); // uses SubtleCrypto
const url = `${APPS_SCRIPT_URL}?t=${ts}&s=${sig}&action=${action}`;
```

### Available Actions

**`action=meta`** — Called on every app launch. Returns available months and counts only.
```json
{
  "availableMonths": ["Jan 2026", "Feb 2026", "Mar 2026", "Apr 2026", "May 2026"],
  "totalTransactions": 847,
  "lastUpdated": "2026-05-10T14:32:00"
}
```

**`action=summary`** — Monthly aggregates only, no raw rows. Used for trend charts and hero cards.
```json
{
  "months": [
    {
      "month": "2026-05",
      "income": 85000,
      "expenses": 62000,
      "net": 23000,
      "savingsRate": 27,
      "topCategory": "food",
      "transactionCount": 143
    }
  ]
}
```

**`action=month&month=2026-05`** — Full transaction rows for one month.
```json
{
  "month": "2026-05",
  "count": 143,
  "transactions": [...]
}
```

**`action=recent&limit=50`** — Latest N transactions across all sheets.

**`action=range&from=2026-01&to=2026-03`** — Aggregates only for a date range. Used for trend comparisons.

### Cache Strategy (IndexedDB via idb-keyval)

| Cache key | TTL | Notes |
|---|---|---|
| `meta` | 1 min | Always refresh on launch |
| `summary` | 5 min | Refresh on foreground |
| `month:2026-05` | 2 min | Current month changes often |
| `month:2026-04` | 1 hour | Past month rarely changes |
| `month:2026-01` | 24 hours | Historical, basically static |
| `recent:50` | 2 min | Landing view |

Show cached data immediately, fetch fresh in background (stale-while-revalidate).

### File Structure for API
```
src/api/
  auth.js        — HMAC signing using SubtleCrypto
  sheets.js      — doGet wrappers for each action
  cache.js       — IndexedDB read/write with TTL logic
```

---

## Data Schema

Each transaction row has these fields:

```typescript
{
  date: string,              // ISO 8601
  txn_id: string,            // unique identifier
  type: "income" | "expense" | "transfer" | "fuliza_credit" | "unknown",
  amount: number,            // KES (or foreign currency — see currency field)
  cost: number,              // transaction fee (e.g. M-Pesa charge)
  description: string,       // merchant or sender name
  balance: number | "",      // account balance after transaction (M-Pesa only)
  source: "mpesa" | "bank-a" | "bank-b" | "bank-c-card" | "bank-c-cc" | "bank-c-fx",
  currency: "KES" | "USD" | string,
  category: string,          // empty string if uncategorized
  account: "mpesa" | "bank-a" | "bank-c-1234" | "bank-c-5678" | string,
  recurring: "" | "true" | "false",
  fuliza_amount: number | "", // Fuliza credit amount
  fuliza_outstanding: number | "" // Outstanding Fuliza balance
}
```

### Transaction Types
- `income` — money received from external source
- `expense` — money spent
- `transfer` — money moved between own accounts (exclude from income/expense totals)
- `fuliza_credit` — M-Pesa overdraft credit used
- `unknown` — could not be parsed

### Known Accounts
- `mpesa` — M-Pesa mobile wallet
- `bank-a` — Bank A (current account)
- `bank-c-1234` — Bank C credit card ending 1234
- `bank-c-5678` — Bank C credit card ending 5678

### Fuliza
Fuliza is M-Pesa's overdraft product. When balance is zero and a transaction is made, Fuliza covers it. Track separately:
- `fuliza_credit` rows = credit drawn
- Rows with `description === "Fuliza Full Repayment"` or `"Fuliza Partial Repayment"` = repayments
- Current Fuliza outstanding = sum(fuliza_credit amounts) - sum(repayment amounts)

---

## App Structure

### Navigation
Bottom tab bar with 4 tabs:
1. **Overview** — hero cards, trend chart, insights strip
2. **Categories** — spending breakdown, category drill-down
3. **Transactions** — full list, search, filter
4. **Settings** — URL/secret, budgets, savings goal, about

### File Structure
```
finance-dashboard/
├── public/
│   ├── manifest.json
│   ├── sw.js
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── icon-180.png          — iOS touch icon
│   └── icon-maskable.png     — Android adaptive icon
├── src/
│   ├── main.jsx
│   ├── App.jsx               — routing, global state, auth gate
│   ├── auth/
│   │   ├── LockScreen.jsx
│   │   ├── SetupScreen.jsx
│   │   ├── webauthn.js
│   │   ├── crypto.js
│   │   └── session.js
│   ├── api/
│   │   ├── auth.js
│   │   ├── sheets.js
│   │   └── cache.js
│   ├── compute/
│   │   ├── metrics.js        — all financial calculations (pure functions)
│   │   ├── trends.js         — month-over-month comparisons
│   │   ├── recurring.js      — recurring detection algorithm
│   │   ├── anomalies.js      — statistical outlier detection
│   │   └── insights.js       — computed insight strings
│   ├── components/
│   │   ├── BottomTabBar.jsx
│   │   ├── PullToRefresh.jsx
│   │   ├── InstallPrompt.jsx — iOS A2HS instructions
│   │   ├── OfflineBanner.jsx
│   │   ├── MonthSelector.jsx
│   │   ├── overview/
│   │   │   ├── HeroStrip.jsx
│   │   │   ├── TrendChart.jsx
│   │   │   ├── InsightsStrip.jsx
│   │   │   └── FulizaCard.jsx
│   │   ├── categories/
│   │   │   ├── CategoryBreakdown.jsx
│   │   │   ├── CategoryPieChart.jsx
│   │   │   ├── CategoryBarList.jsx
│   │   │   └── CategoryDrillDown.jsx
│   │   ├── transactions/
│   │   │   ├── TransactionList.jsx
│   │   │   ├── TransactionRow.jsx
│   │   │   ├── TransactionFilters.jsx
│   │   │   └── SearchBar.jsx
│   │   └── settings/
│   │       ├── SettingsScreen.jsx
│   │       ├── BudgetEditor.jsx
│   │       └── SavingsGoal.jsx
│   ├── lib/
│   │   ├── format.js         — KES formatting, date formatting, % helpers
│   │   └── storage.js        — localStorage wrapper
│   └── styles/
│       └── globals.css
├── index.html
├── package.json
└── vite.config.js
```

---

## Screens & Components

### Overview Tab

**HeroStrip** — 4 cards in a 2x2 grid:
1. Income — sum of income type, exclude transfers. Delta from last month with arrow.
2. Expenses — sum of expense type, exclude transfers. Delta from last month.
3. Net — income minus expenses. Green if positive, orange if negative.
4. Savings Rate — (income - expenses) / income × 100. Trend arrow.

**TrendChart** — Recharts LineChart showing income/expense/net per month. All available months on x-axis. 3 lines: green (income), orange (expenses), blue (net). Tap a month to jump to that month's detail.

**InsightsStrip** — Horizontal scroll of 1-line computed observation cards:
- "Top spend: Food — KES 45,200 this month"
- "Fuliza: 12 days this month"
- "Subscriptions cost KES 8,400/mo (KES 100,800/yr)"
- "Savings rate dropped from 23% to 11%"
- "Most expensive day: Monday 5th May — KES 12,400"
- "Best month so far: February (31% savings rate)"

All computed deterministically from transaction data, no LLM.

**FulizaCard** — Only shown if any fuliza_credit rows exist:
- Times entered Fuliza this month
- Total credit drawn
- Total repaid
- Current estimated outstanding (sum credits - sum repayments)
- Days since last entry

### Categories Tab

**Month selector** at top — "Jan 2026 · Feb · Mar · Apr · May" horizontal scroll.

**View toggle** — Pie | Bar List

**CategoryPieChart** — Recharts PieChart. Tap a slice to drill down.

**CategoryBarList** — Sorted by amount descending. Each row:
- Category emoji + name
- Amount (KES, JetBrains Mono)
- % of total expenses
- Delta vs last month (e.g. "+KES 3,200 vs April")
- Thin progress bar showing proportion

**CategoryDrillDown** — Sheet that slides up when tapping a category. Shows:
- All transactions in that category
- Top merchants within category
- Month-over-month chart for this category

**Uncategorized section** — At the bottom, collapsible list of transactions where `category === ""`. Manual dropdown to assign category. Apply rule checkbox: "Always categorize [merchant] as [category]". Rules stored in localStorage.

### Transactions Tab

**SearchBar** — text search across description field.

**TransactionFilters** — horizontal scroll of filter pills:
- All | Income | Expenses | Transfers | Fuliza
- By account: M-Pesa | Bank A | Bank C 1234 | Bank C 5678
- By source: M-Pesa | Bank A | Bank B | Bank C

**TransactionList** — paginated at 50 per page. Each TransactionRow:
- Left: source icon/color indicator, description, date + account
- Right: amount (green for income, white for expense, blue for transfer), cost if > 0

**Month grouping** — transactions grouped by month with sticky headers when viewing "All".

### Settings Tab

- **Connection** — Apps Script URL (masked) + test connection button
- **Change PIN** — re-enter current PIN, set new PIN
- **Monthly Budgets** — list of categories with KES input for budget target. Shows progress bar in Categories tab when set.
- **Savings Goal** — KES target per month. Shows progress on Overview.
- **Accounts** — list known accounts with custom display names
- **Sync** — last synced timestamp, manual refresh button, cache size
- **About** — version, data stays on device notice

---

## Computed Metrics

All in `src/compute/metrics.js`. Pure functions, no side effects.

```javascript
// Core
totalIncome(transactions)           // sum income type, exclude transfers
totalExpenses(transactions)         // sum expense type, exclude transfers
netCashFlow(transactions)           // income - expenses
savingsRate(transactions)           // net / income × 100
totalFees(transactions)             // sum of cost column

// Category
expensesByCategory(transactions)    // { category: total }
topCategory(transactions)           // string — highest spend category
uncategorizedCount(transactions)    // count where category === ""

// Trends (compare two months' transaction arrays)
deltaAmount(current, previous)      // current - previous
deltaPercent(current, previous)     // (current - previous) / previous × 100
monthOverMonth(allMonths)           // array of {month, income, expense, net, savingsRate}

// Accounts
netByAccount(transactions)          // { account: { in, out, net } }
balanceHistory(transactions)        // mpesa balance over time [{date, balance}]

// Recurring detection (deterministic)
detectRecurring(allTransactions)
// Group by description
// Find descriptions appearing in >= 2 months
// Same amount ± 10% → mark as likely recurring
// Returns [{ description, amount, frequency, lastSeen, annualCost }]

// Anomaly detection
detectAnomalies(currentMonth, historicalMonths)
// For each category: compute mean + stddev over last 3 months
// Flag if current > mean + 2*stddev
// Returns [{ category, currentAmount, mean, stddev, message }]

// Fuliza
fulizaOutstanding(transactions)     // sum credits - sum repayments
fulizaDaysThisMonth(transactions)   // count of distinct days with fuliza_credit
fulizaHistory(allTransactions)      // monthly { drawn, repaid, outstanding }
```

---

## PWA Configuration

### manifest.json
```json
{
  "name": "Finance Tracker",
  "short_name": "Finances",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0F1117",
  "theme_color": "#0F1117",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### iOS Meta Tags (in index.html)
```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Finances">
<link rel="apple-touch-icon" href="/icon-192.png">
<link rel="apple-touch-icon" sizes="180x180" href="/icon-180.png">
<meta name="theme-color" content="#0F1117">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```

### Service Worker Strategy
- App shell (HTML, JS, CSS, fonts): **cache-first**
- Transaction data (doGet responses): **stale-while-revalidate**, 5 min max stale
- Network unavailable: serve cached data + show OfflineBanner

Use `vite-plugin-pwa` with `workbox` strategy. Configure `runtimeCaching` for the Apps Script URL pattern.

### Offline Behavior
- On launch with no internet: show cached data immediately with "Offline — last synced X min ago" banner
- Refresh button disabled when offline
- No errors thrown — graceful degradation

### Install Prompt (iOS)
On first visit, if `window.matchMedia('(display-mode: standalone)').matches` is false:
- Show a dismissible modal with illustrated steps: tap Share → "Add to Home Screen"
- Store "prompt dismissed" in localStorage — never show again

---

## Build Phases

### Phase 1 — Foundation (do first, deploy early)
- [ ] Vite + React + Tailwind + vite-plugin-pwa setup
- [ ] manifest.json + iOS meta tags
- [ ] Service worker with basic shell caching
- [ ] Bottom tab bar shell (Overview, Categories, Transactions, Settings)
- [ ] SetupScreen (paste URL + secret)
- [ ] LockScreen + WebAuthn register/authenticate
- [ ] Fallback PIN screen + PBKDF2 derivation
- [ ] AES-GCM encrypt/decrypt secret
- [ ] Auto-lock on 15 min idle + background
- [ ] Deploy to GitHub Pages — confirm installable on iOS

### Phase 2 — Data layer
- [ ] `api/auth.js` — SubtleCrypto HMAC signing
- [ ] `api/sheets.js` — meta, summary, month, recent actions
- [ ] `api/cache.js` — IndexedDB TTL cache via idb-keyval
- [ ] Stale-while-revalidate fetch pattern
- [ ] OfflineBanner component
- [ ] PullToRefresh on Overview tab
- [ ] Sync indicator ("Last synced 2 min ago")

### Phase 3 — Overview tab
- [ ] MonthSelector component
- [ ] HeroStrip — 4 cards with deltas
- [ ] TrendChart — income/expense/net line chart
- [ ] InsightsStrip — horizontal scroll of computed observations
- [ ] FulizaCard — only rendered if Fuliza rows exist
- [ ] All compute functions in metrics.js + trends.js + insights.js

### Phase 4 — Categories tab
- [ ] CategoryBreakdown with Pie + Bar toggle
- [ ] CategoryBarList with delta indicators
- [ ] CategoryDrillDown slide-up sheet
- [ ] Uncategorized section with manual assignment
- [ ] Category rules stored in localStorage
- [ ] Anomaly highlights in bar list

### Phase 5 — Transactions tab
- [ ] TransactionList with pagination (50/page)
- [ ] TransactionRow component
- [ ] SearchBar (client-side filter on description)
- [ ] Filter pills (type, account, source)
- [ ] Month grouping with sticky headers
- [ ] Recurring badge on detected recurring transactions

### Phase 6 — Settings + polish
- [ ] Settings screen (URL, PIN change, budgets, savings goal)
- [ ] Budget progress bars in Categories tab
- [ ] Savings goal progress on Overview
- [ ] Recurring expenses panel with annual cost
- [ ] iOS InstallPrompt modal

---

## Implementation Notes

### Currency Display
Always format as `KES X,XXX` using `toLocaleString('en-KE')`. For foreign currency rows (`currency !== 'KES'`), show original amount in description column: "Interactive Brokers (USD 2,800)". Do not attempt currency conversion.

### Transfer Handling
Exclude all `type === "transfer"` rows from income and expense totals. Show them in the transactions list with a blue "Transfer" badge. Do not count them in category breakdowns.

### Savings Rate
Only meaningful when there is income. If income is 0 for a month, show "N/A" not 0%.

### Negative Net
Some months may have negative net (spent more than earned — Fuliza months especially). Show in orange. Do not hide or soften this.

### Date Handling
All dates stored as ISO 8601. Parse with `new Date(dateString)`. Display in Kenya locale: `toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })`.

### No LLM in the App
The dashboard does not call any LLM API. All insights are computed deterministically. Categorization is manual (user clicks) or via stored rules. This keeps the app free to run indefinitely.

---

## Acceptance Criteria

The app is complete when a user can answer these 6 questions in under 30 seconds:

1. How much did I spend this month vs last month?
2. What is my biggest expense category?
3. How much do my recurring subscriptions cost annually?
4. Am I in Fuliza right now and how much do I owe?
5. What is my savings rate trend over the last 3 months?
6. Which merchant am I spending the most at this month?

And the following must be true:
- Installs to iOS home screen via Safari
- Works offline showing last cached data
- Requires Face ID or PIN to open
- Auto-locks after 15 minutes
- Loads meaningful data in under 3 seconds on first authenticated view
- Handles months with zero income gracefully
- Handles missing categories gracefully (uncategorized bucket)
- Never crashes on empty data

---

## What Is Out of Scope

Do not build:
- Any backend or server
- Push notifications (future phase)
- Multi-user support
- Currency conversion
- Data export
- LLM categorization (this is a separate script, not part of the app)
- Android-specific optimizations (iOS first)
- Tablet layout

---

## Repository Setup

```
GitHub repo: finance-dashboard
Branch: main (source), gh-pages (deployed)
Deploy command: npm run build && gh-pages -d dist
Base URL: /finance-dashboard/ (set in vite.config.js as base)
```

Start with Phase 1. Deploy to GitHub Pages after Phase 1 is complete and confirm it is installable on iOS before proceeding to Phase 2.