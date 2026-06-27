# Dependency Vulnerabilities — Accepted Residual Risk

**Snapshot:** 2026-06-27 · `npm audit --omit=dev`
**Result:** 16 moderate · 0 high · 0 critical
**Decision:** Accepted as residual risk. Do **not** run `npm audit fix --force` — every
offered fix is a major-version **downgrade** that would break the stack (see below).
Re-evaluate when upstream publishes forward-compatible patches.

## Why these are low-risk
- **All 16 are moderate**; none high or critical.
- **All are transitive** — none is a package we depend on directly; they're pulled in by
  Sanity, Next, and Prisma tooling.
- **The "fixes" are downgrades, not upgrades.** npm proposes `sanity@5.14.1` (we're on 6.x),
  `next@9.3.3` (we're on 16.2.9), and `prisma@6.19.3` (we're on 7.8). `npm audit fix --force`
  would regress the whole stack and break the app. The genuinely patched, forward-compatible
  versions are not yet published for our major lines.

## The 4 root causes (16 findings collapse to these)

### 1. `uuid <11.1.1` — GHSA-w5hq-g745-h8pq (missing buffer bounds check in v3/v5/v6 when `buf` is provided)
Pulled in via Sanity packages: `@sanity/uuid`, `typeid-js`, `@sanity/preview-url-secret`,
`@sanity/visual-editing`, `@sanity/cli`, `@sanity/vision`, `sanity`, `next-sanity`.
- **Exposure:** the flaw only triggers in uuid v3/v5/v6 when a caller passes a `buf`
  argument. That's internal Sanity Studio / preview / CLI usage — not reachable from the
  storefront's request path. Largely build/Studio-time.

### 2. `postcss <8.5.10`
Bundled inside `next@16.2.9`.
- **Exposure:** build-time CSS tooling, not a runtime request surface. Will clear with a
  future Next patch release (npm's only "fix" is an absurd downgrade to next@9).

### 3. `js-yaml <=4.1.1`
Via `@vercel/frameworks` → `@sanity/cli` / `sanity`.
- **Exposure:** Sanity CLI / Studio tooling, not the storefront runtime.

### 4. `@hono/node-server <1.19.13`
Via `@prisma/dev` → `prisma`.
- **Exposure:** Prisma's dev/CLI tooling, not the runtime query path (`@prisma/client` +
  the pg driver adapter serve requests).

## Net assessment
The vulnerable code sits in **build / Studio / CLI tooling**, not in the storefront's
runtime request path (checkout, payment verify, webhooks, product pages). Combined with
moderate severity and the lack of safe forward fixes, the residual risk is **low and
accepted** for launch.

## Follow-ups (when convenient — not blocking)
- **Re-run `npm audit --omit=dev` periodically** and after every `next` / `sanity` /
  `next-sanity` / `prisma` minor upgrade — adopt the patched versions as soon as they ship
  for our major lines (no `--force`).
- **Consider trimming Sanity from the production dependency surface.** `@sanity/vision`,
  `@sanity/visual-editing`, and Studio packages are authoring tools, not storefront runtime.
  Moving them out of `dependencies` (or not deploying Sanity Studio with the storefront)
  would drop most of these findings from the production audit entirely.
- **Upgrade Next** on its next patch to clear the bundled `postcss` advisory.

## Notes
- No dependency changes were made for this entry — it is documentation only. The app's
  build is therefore unchanged; `tsc` and `eslint` pass and the dev server serves normally.