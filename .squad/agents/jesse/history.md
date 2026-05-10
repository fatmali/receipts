# Jesse — History

## Core Context

Frontend dev for Receipts PWA. React 18 + Tailwind + Recharts. Dark mode only. iOS-first. Bottom tab nav. KES currency. Owner: Fatma.

## Learnings

### Phase 1 — Auth Screens + Design System (May 2025)
- Built LockScreen with Face ID button + full PIN pad (auto-submit at 6 digits, manual OK at 4+, shake on error)
- Built SetupScreen as 5-step wizard: Welcome → URL → HMAC secret → PIN (create + confirm) → Face ID opt-in
- Both screens import Gus's stub functions (webauthn.js, crypto.js) and call them — ready for real crypto when Gus implements
- Polished globals.css: added font utilities, focus styles, animations (fade-in, shake, slide-in, spin), selection colors, iOS safe area class, scrollbar hover state
- Polished BottomTabBar: 60px height, safe-bottom CSS class (no inline styles), text-xs labels, 44px min tap targets
- Extracted inline placeholder pages from App.jsx into OverviewTab, CategoriesTab, TransactionsTab components + polished SettingsScreen
- Tailwind v4 @theme tokens work cleanly — `bg-green`, `text-text-muted`, `bg-surface` etc. all resolve from --color-* vars
- Used `safe-bottom` CSS class instead of inline `style={{ paddingBottom: 'env(...)' }}` to satisfy no-inline-styles rule
- PIN pad extracted as shared `PinPad` component inside SetupScreen (could be promoted to shared if LockScreen needs it later)

### Phase 2 — Offline & PWA Components (May 2026)
- Built OfflineBanner: fixed top bar, slide-down/up CSS animations, listens to window online/offline events, shows "Offline — last synced X ago" via timeAgo()
- Built PullToRefresh: touch gesture wrapper with damped pull, 60px threshold, spinner indicator using green accent, async onRefresh support, disabled prop for offline
- Built SyncIndicator: compact status line with colored dot (green/yellow/orange), auto-refreshes label every 60s, uses timeAgo()
- Built InstallPrompt: iOS Safari A2HS modal with 3-step instructions, share icon, backdrop overlay, dismisses permanently via localStorage, 2s show delay
- Wired OfflineBanner + InstallPrompt into MainApp (inside auth gate so they never show on lock/setup screens)
- Added 4 new CSS keyframe animations: slideDown, slideUp, fadeInOverlay, slideUpSheet — kept CSS-only approach per D-004
- PullToRefresh uses e.preventDefault() on touchmove to block native scroll during active pull; dampening factor of 0.5 for natural resistance feel
- InstallPrompt checks window.navigator.standalone + display-mode media query for standalone detection

### Phase 3 — Overview Tab (May 2026)
- Built MonthSelector: horizontal scroll pills with CSS scroll-snap, auto-scrolls to selected month via scrollIntoView, 44px min tap targets
- Built HeroStrip: 2x2 grid with Income/Expenses/Net/Savings Rate cards, delta arrows from compute/trends.js deltaPercent, inverted delta logic for expenses (up=bad)
- Built TrendChart: Recharts LineChart with 3 lines (income/expenses/net dashed), dark-mode custom tooltip + legend, CartesianGrid with border color, YAxis k-formatter, onClick for month selection
- Built InsightsStrip: horizontal scroll strip with snap, right-side fade gradient, emoji-prefixed insight cards from compute/insights.js, max 8 cards
- Built FulizaCard: conditionally rendered purple-border card, computes drawn/repaid/outstanding/days from fuliza_credit transactions, days-since-last calculation
- Built OverviewTab: assembles MonthSelector + SyncIndicator + PullToRefresh + HeroStrip + TrendChart + InsightsStrip + FulizaCard, month key conversion from display format ("May 2026") to API format ("2026-05"), skeleton loading states with animate-pulse
- Added `.scrollbar-hide` CSS utility to globals.css for hiding scrollbars on mobile scroll containers
- Recharts v3 API: ResponsiveContainer still works the same, CartesianGrid accepts stroke prop, custom tooltip/legend via content prop
- Month format gotcha: meta returns display strings like "May 2026" but API expects "2026-05" — needed conversion logic in OverviewTab

### Phase 4 — Categories Tab (May 2026)
- Built CategoryPieChart: Recharts donut chart with inner radius, per-category color mapping, custom dark tooltip, center total label via absolute positioning, percentage labels on slices > 5%, onClick slice → drill-down
- Built CategoryBarList: sorted vertical list with emoji + name + KES amount + "X% of total" + delta vs last month + progress bar + anomaly ⚠️ badge, 44pt tap targets
- Built CategoryDrillDown: slide-up sheet (80vh max) with drag handle, backdrop overlay, category emoji heading + total, top 5 merchants grouped by description, full transaction list reusing TransactionRow
- Built CategoriesTab: MonthSelector + Pie/Bar toggle pills + anomaly banner + chart/list view + collapsible Uncategorized section with category assignment dropdown + "always categorize" checkbox saving rules to localStorage via storage.js
- applyCategoryRules() reads `receipts_category_rules` from localStorage and auto-categorizes matching uncategorized transactions on display
- Reused toMonthKey() and prevMonthKeyOf() month conversion helpers (same pattern as OverviewTab)

### Phase 5 — Transactions Tab (May 2026)
- Built SearchBar: debounced 300ms input with search icon, clear × button, green focus ring, 44pt height
- Built TransactionFilters: two horizontal scroll rows (Type: All/Income/Expenses/Transfers/Fuliza, Account: All/M-Pesa/Stanbic/Stanchart 8541/Stanchart 3693), green active pill, 32px compact pills
- Built TransactionList: paginated (50/page) with sticky month headers (bg-bg/90 backdrop-blur), load-more button, skeleton loading (8 rows), empty state with search icon
- Built TransactionRow: source color dot (mpesa=green, stanbic=blue, pesalink=yellow, stanchart=orange), amount color by type (income=green, expense=white, transfer=blue+badge, fuliza=purple), fee display, recurring 🔄 badge, 60px min height
- Built TransactionsTab: assembles MonthSelector + SearchBar + TransactionFilters + TransactionList, client-side filtering by type/account/search across description+category+amount
- TYPE_MAP and ACCOUNT_MAP centralized for filter → data value mapping

### Phase 6 — Settings Tab + Final Polish (May 2026)
- Built full SettingsScreen with 7 sections: Connection (test + masked URL), Security (inline PIN change flow with current→new→confirm steps), Monthly Budgets (BudgetEditor), Savings Goal (SavingsGoalEditor with progress bar), Accounts (editable display names), Data & Sync (cache info + clear/refresh), About
- Built BudgetEditor: per-category KES input rows with emoji, add/remove, saves immediately to localStorage `receipts_budgets`
- Built SavingsGoal: single KES input with progress bar showing current month net vs target, font-mono for numbers
- Added budget indicator to CategoryBarList: thin secondary progress bar per category showing spend vs budget, turns orange when over budget, "KES X / KES Y budget" text
- Added savings goal progress card to OverviewTab: green fill bar, "KES X of KES Y" label, conditionally rendered only when goal is set
- Added collapsible Recurring Expenses panel to OverviewTab: list of detected recurring transactions with frequency badge (monthly/occasional), monthly amount, total annual cost footer
- PIN change flow: derives key from current PIN to verify, then re-encrypts secret with new PIN-derived key — uses existing deriveKeyFromPin + encrypt/decrypt from crypto.js
- Toast component: fixed-position, auto-dismiss 2.5s, green for success / orange for error, animate-fade-in
- SectionCard pattern: reusable card wrapper with Sora uppercase heading, surface bg, border, rounded-xl
- All inputs have aria-labels, 44px min tap targets, focus:border-green, JetBrains Mono for number inputs
- Build passes clean — no errors, no placeholder text remaining
