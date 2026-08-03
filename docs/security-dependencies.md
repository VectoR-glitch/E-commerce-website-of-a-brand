# Dependency Vulnerabilities — Status

**Snapshot:** 2026-08-03 · GitHub Dependabot alerts (continuous scanning, enabled this date)
**Result:** 0 open alerts.
**Monitoring:** Dependabot security alerts + automated security fixes are enabled at the
repo level (continuous, not periodic). `.github/dependabot.yml` also runs a weekly npm
version-update check. Supersedes the one-off manual `npm audit` snapshot from 2026-06-27.

## What happened on 2026-08-03

Enabling Dependabot surfaced 26 open alerts (14 high, 12 moderate) — more than the prior
manual `npm audit` snapshot had found, because Dependabot's advisory database and dependency
graph scanning catch more than a point-in-time `npm audit` run. All 26 were resolved same-day:

- **`next` 16.2.9 → 16.2.12** — patched 9 core CVEs in Next.js itself: SSRF in Server Actions
  and in rewrites, a middleware/proxy bypass, DoS in the App Router and Image Optimization
  API, unbounded Server Action payload, cache confusion, and unauthenticated Server Function
  endpoint disclosure. These were runtime-scoped (the deployed storefront), not build tooling.
- **`sharp` 0.34.5 → 0.35.0** and **`postcss` → 8.5.18**, both via `package.json` `overrides`
  — `next@16.2.12` still bundled the older, vulnerable versions of each internally. (Same
  "npm suggests downgrading to `next@9.3.3`" trap noted below in the original 2026-06-27
  findings — the fix is a targeted override, not `npm audit fix --force`.)
- **`fast-uri`, `hono`, `@hono/node-server`, `valibot`** — resolved via plain `npm audit fix`
  (no forced downgrade needed); all four are dev-only, pulled in by Sanity/Prisma tooling.

Verified before merging: `tsc` and `eslint` clean, a full production build succeeded across
all routes, and the homepage/`/shop` were visually checked (product images via `sharp`,
Tailwind styling via `postcss`) with no regression. Vercel's own remote preview build also
succeeded independently of the local checks.

## Historical context — the 2026-06-27 manual audit

Before Dependabot was enabled, a one-off `npm audit --omit=dev` found 16 moderate findings,
all judged low-risk because they lived in Sanity/Prisma CLI/Studio tooling, not the storefront
runtime, and npm's only offered "fix" at the time was a major-version downgrade (`next@9.3.3`,
`sanity@5.14.1`, `prisma@6.19.3`) that would have broken the stack. That reasoning was correct
for what it covered, but it only checked local `npm audit`, which missed several of the
runtime-scoped `next`/`sharp`/`postcss` issues that Dependabot's broader scanning caught.

## Going forward

- Dependabot alerts are continuous — new findings will show up as GitHub issues/PRs, not on
  the next person who happens to run `npm audit` manually.
- The weekly `dependabot.yml` version-update schedule keeps routine (non-security) bumps
  flowing too, rather than drifting for months between manual checks.
- If a future finding's only fix is a genuine breaking downgrade (the `next@9.3.3` trap from
  before), re-apply the same approach used here: check if the fix is actually bundled *inside*
  a newer version of the top-level package first, and use `overrides` for anything still stuck
  at an old version transitively, rather than accepting the downgrade.
