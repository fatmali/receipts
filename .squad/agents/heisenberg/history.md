# Heisenberg — History

## Core Context

Lead architect for Receipts PWA. React 18 + Vite + Tailwind + Recharts. GitHub Pages deployment. Dark mode only. iOS-first PWA.

## Learnings

### Phase 1 Scaffold (2026-05-10)
- Vite `create-vite` interactive prompts don't work well with non-TTY terminals — create in temp dir and copy files when the target directory is non-empty
- Tailwind v4: no `tailwind.config.js` needed. Use `@import "tailwindcss"` + `@theme {}` block in CSS for design tokens
- `vite-plugin-pwa` manifest icon paths must include the `base` prefix (`/finance-dashboard/icon-192.png`) for GitHub Pages
- Apple touch icon `href` must also use the base path
- Placeholder PNGs can be generated with pure Node.js (zlib + manual PNG chunk assembly) — no canvas dependency needed
- Build output: 45 modules, ~238 KB JS (75 KB gzipped), ~9.6 KB CSS, service worker with 5 precached entries
- File structure matches PRD exactly: src/{api,auth,components,compute,lib,styles} + public/ icons
