# Klenich.com — Deploy Runway

Click-by-click steps to take the app from the local repo to a live production
deploy on Vercel at **klenich.com**. Do the phases in order — each one's outputs
feed the next. Checkboxes are for you to tick as you go.

**Launch posture (decided):** flat shipping (₹64 West Bengal / ₹160 rest of
India), Shiprocket **PAUSED**. Shipping pricing strategy + Shiprocket resume are
post-launch.

---

## Phase 0 — Push the repo to GitHub  (prerequisite for Vercel)

The `web` repo is **local-only** (no remote). Vercel imports from a Git host.

- [ ] Create a **private** GitHub repo (e.g. `bharatblissofficial/klenich-web`). Do
      **not** initialize it with a README/.gitignore (the repo already has both).
- [ ] Add the remote and push `main`:
      ```bash
      cd C:/Users/Abhinava/Projects/Klenich/web
      git remote add origin https://github.com/<org>/<repo>.git
      git push -u origin main
      ```
- [ ] Confirm `.env` is **NOT** in the pushed files (only `.env.example` should be).
      `git ls-files | grep .env` must show only `.env.example`.

> Build fix already in place: `package.json` has `"postinstall": "prisma generate"`
> so Vercel generates the Prisma client on install. Without it the build fails.

---

## Phase 1 — Razorpay: TEST → LIVE  + webhook (Security ④)

Current keys are TEST (`rzp_test_T4c7QQN2GjmahZ`). The live account is KYC-activated.

- [ ] Razorpay Dashboard → switch to **Live Mode** (top toggle).
- [ ] **Settings → API Keys → Generate Live Key.** Copy **Key ID** (`rzp_live_…`)
      and **Key Secret** (shown once — save it now).
- [ ] **Settings → Webhooks → Add New Webhook:**
  - URL: `https://klenich.com/api/payment/webhook`
  - Active events: **`payment.captured`** (the handler also accepts `order.paid`)
  - **Secret:** enter a strong random string — this becomes `RAZORPAY_WEBHOOK_SECRET`.
        Generate one with: `openssl rand -hex 32`
- [ ] Record for Phase 4: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
      `RAZORPAY_WEBHOOK_SECRET`.

> The webhook code already **fails closed** (returns 500 if the secret is unset),
> so the secret MUST be set in Vercel env or captures won't reconcile.

---

## Phase 2 — Upstash Redis  (distributed rate limiting)

Without this the limiter falls back to in-memory, which does **not** work across
Vercel's serverless instances (each gets its own memory).

- [ ] [console.upstash.com](https://console.upstash.com) → **Create Database**
      (Redis). Region: **Singapore (ap-southeast-1)** to match Neon. Eviction on.
- [ ] Copy the **REST URL** and **REST TOKEN** (REST tab, not the redis:// URL).
- [ ] Record for Phase 4: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

---

## Phase 3 — Database (Neon)

The existing Neon DB (Singapore) is already migrated (6 migrations) and now clean
(test orders wiped, stock re-synced). You can use it as production.

- [ ] Use the Neon **pooled** connection string (host contains `-pooler`) for
      Vercel — serverless functions exhaust direct connections. Keep
      `sslmode=verify-full`.
- [ ] If you ever add migrations, deploy them with:
      `npx prisma migrate deploy` (against the prod `DATABASE_URL`).
- [ ] Record for Phase 4: `DATABASE_URL` (pooled, verify-full).

---

## Phase 4 — Vercel project + environment variables

- [ ] [vercel.com](https://vercel.com) → **Add New → Project** → import the GitHub
      repo from Phase 0. Root directory = `web` (if the repo root is `web`, leave
      default; if you pushed the whole `Klenich` folder, set root to `web`).
- [ ] Framework preset auto-detects **Next.js**. Leave build/output defaults
      (build runs `next build`; `postinstall` runs `prisma generate`).
- [ ] **Settings → Environment Variables** (Production scope) — set all of these:

  | Variable | Value |
  |---|---|
  | `DATABASE_URL` | Neon **pooled**, `sslmode=verify-full` |
  | `RAZORPAY_KEY_ID` | `rzp_live_…` |
  | `RAZORPAY_KEY_SECRET` | live secret |
  | `RAZORPAY_WEBHOOK_SECRET` | the string from Phase 1 webhook |
  | `RESEND_API_KEY` | current Resend key |
  | `RESEND_FROM` | `Klenich <orders@klenich.com>` |
  | `ADMIN_EMAIL` | `klenichofficial@gmail.com` |
  | `UPSTASH_REDIS_REST_URL` | from Phase 2 |
  | `UPSTASH_REDIS_REST_TOKEN` | from Phase 2 |
  | `NEXT_PUBLIC_SITE_URL` | `https://klenich.com` |
  | `NEXT_PUBLIC_SANITY_PROJECT_ID` | `tgaule93` |
  | `NEXT_PUBLIC_SANITY_DATASET` | `production` |
  | `NEXT_PUBLIC_SANITY_API_VERSION` | `2026-02-01` |
  | `SHIPROCKET_EMAIL` | klenichofficial@gmail.com |
  | `SHIPROCKET_PASSWORD` | **rotated** value (see note) |
  | `SHIPROCKET_PICKUP_PINCODE` | `700135` |
  | `SHIPROCKET_PAUSED` | `true` |

  - **Skip** `NEXT_PUBLIC_RAZORPAY_KEY_ID` — dead, read nowhere in code.
  - `SANITY_API_READ_TOKEN` — only if you later wire draft/preview; unused today.
- [ ] **Rotate the Shiprocket password first** (it was exposed in chat): Shiprocket
      → Settings → API → reset the API user's password, then use the new value above.
- [ ] Deploy. First build should be green (matches the clean local `next build`).

---

## Phase 5 — Domain + DNS  (klenich.com → Vercel)

- [ ] Vercel → Project → **Settings → Domains → Add** `klenich.com` (and
      `www.klenich.com`, redirecting to apex).
- [ ] At your klenich.com DNS host (GoDaddy, per the Resend setup), add the records
      Vercel shows — typically:
  - Apex `klenich.com` → **A** record to Vercel's IP (e.g. `76.76.21.21`), or an
    ALIAS/ANAME if supported.
  - `www` → **CNAME** to `cname.vercel-dns.com`.
- [ ] **Do not touch** the existing Resend records (`send` subdomain MX/TXT,
      `resend._domainkey`) — those keep transactional email working.
- [ ] Wait for Vercel to show the domain **Valid** (DNS propagation).

---

## Phase 6 — Post-deploy smoke test (LIVE)

- [ ] Open `https://klenich.com` — homepage renders, products load from Neon.
- [ ] Place one **real low-value online order** end-to-end (a real card/UPI, small
      amount). Confirm: order created, payment captured, confirmation email to
      customer + admin (`klenichofficial@`), stock decremented by the qty.
- [ ] In Razorpay → Webhooks, confirm the `payment.captured` delivery shows **200**.
- [ ] Place one **COD order** — confirm only the delivery fee (₹64/₹160) is charged
      online and the order is `PARTIALLY_PAID`.
- [ ] Delete those two real smoke-test orders, then re-run `npx tsx
      prisma/sync-stock.ts` (note: this resets stock to the script's values — only
      do it if no other real orders have come in yet).

---

## Still post-launch (not blocking go-live)

- Shipping pricing strategy (free-over-₹X / capped / bundles), then resume
  Shiprocket (remove `SHIPROCKET_PAUSED`) + build order tracking (`docs/tracking-plan.md`).
- Plain-text email alternative; customer accounts, reviews, referral/loyalty, GST invoicing.