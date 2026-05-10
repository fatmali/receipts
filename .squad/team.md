# Receipts — Squad Team

## Project Context

**Project:** Receipts — Personal Finance Tracker PWA
**Owner:** Fatma
**Stack:** React 18, Vite, Tailwind CSS, Recharts, WebAuthn, IndexedDB (idb-keyval), vite-plugin-pwa
**Deployment:** GitHub Pages (gh-pages branch)
**Description:** A dark-mode PWA that reads transaction data from Google Sheets via authenticated Apps Script API. Single user (Fatma) in Nairobi, Kenya. All amounts in KES. Installable on iOS via Safari, works offline, secured behind Face ID / PIN. No backend — static site only.
**Created:** 2026-05-10

## Coordinator

| Name | Role | Notes |
|------|------|-------|
| Squad | Coordinator | Routes work, enforces handoffs and reviewer gates. |

## Members

| Name | Role | Scope | Emoji |
|------|------|-------|-------|
| Heisenberg | Lead | Architecture, decisions, code review | 🏗️ |
| Jesse | Frontend Dev | React, Tailwind, UI components, Recharts charts | ⚛️ |
| Gus | Backend Dev | API layer, crypto, WebAuthn, caching, data pipeline | 🔧 |
| Hank | Tester | Tests, quality, edge cases, security audit | 🧪 |
| Scribe | Session Logger | Memory, decisions, session logs | 📋 |
| Ralph | Work Monitor | Work queue, backlog, keep-alive | 🔄 |

## Tech Stack

- **Framework:** React 18 + Vite
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **Auth:** WebAuthn (Face ID) + PIN fallback, AES-GCM, PBKDF2
- **Storage:** IndexedDB via idb-keyval, localStorage for settings
- **PWA:** vite-plugin-pwa + Workbox
- **Deployment:** GitHub Pages
- **Date handling:** Native JS Date only
- **No external crypto libs** — SubtleCrypto only
