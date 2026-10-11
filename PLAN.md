# Plan — juanberrio0399.github.io

Updated: 2026-10-11 · Status: **live** at <https://juanberrio0399.github.io>

How it works is in the [README](README.md). This file says where the project stands and what comes next.

## What it is

The portfolio of Juan Berrio, Cloud & Data Engineer. Its job is to answer a recruiter in one page and to show the work instead of describing it: a SQL playground runs real queries over a snapshot of public GitHub activity with DuckDB-WASM, in the visitor's browser.

## How it works today

| Piece | Where |
|---|---|
| Portfolio with EN/ES toggle, project tabs, print stylesheet (PDF = `window.print()`) | `index.html`, `assets/` |
| SQL playground on DuckDB-WASM | `playground.html` |
| Static HTML/CSS/vanilla JS, no build step; Pages deploys from `main` | `.nojekyll` |
| CSP in a meta tag (Pages cannot send headers) | `index.html` |
| Lighthouse CI as a required check; OpenSSF Scorecard weekly; actions pinned by SHA | `.github/workflows/` |
| SEO: Open Graph, JSON-LD ProfilePage, sitemap, robots | root files |

## What it needs

- GitHub Pages (free). No secrets.
- Cost: 0.

## How it should work

- Every number on the site matches the CV and LinkedIn (today: **30M+**).
- Every project card describes the stack the project really runs.
- Lighthouse stays green; the playground works offline after the first load.

## What was done

| Date | What | PR |
|---|---|---|
| 2026-06/08 | First version; repositioned to Cloud & Data Engineer; SEO and Open Graph | #2 |
| 2026-09-01 | MIT license, JSON-LD, Lighthouse workflow | #12–#15 |
| 2026-09-15 | CSP with inline code moved out, Harden-Runner, DuckDB-WASM playground, real RAG stack | #28–#33 |
| 2026-09-22/23 | Scorecard, Dependabot, security policy, README rewritten | #37, #40 |
| 2026-09-29 | License year fixed (2024 → 2026) | #45 |

## What's left

1. **#42: live data.** The playground runs on a snapshot; a scheduled Action could refresh it.
2. Add **aws-labs** if it goes public; today the site has no visible AWS work.
3. #43 (CodeMirror for the SQL editor), #41 (Observable Plot), #36 (DuckDB remote attach).
4. #34 (Speculation Rules), #3 (scroll-driven animations): polish, low priority.

## Known traps

- **No build step**: what is committed is what is served. A broken file is a broken site on merge.
- **Pages cannot set headers**, so CSP lives in a meta tag and some directives (e.g. `frame-ancestors`) do not apply.
- **Keep metrics consistent across surfaces.** The old `portfolio` repo said 25M+ while the site said 30M+; that repo is now private.
