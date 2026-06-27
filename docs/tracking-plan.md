# Order Tracking — Plan (deferred)

**Status:** Planned, not built. Build alongside the Shiprocket resume (see below).
**Decided:** 2026-06-27.

## Decisions
- **Access model:** tokened tracking link in order emails **+** a `/track` page with an
  order# + email manual lookup as fallback. No customer login required (accounts are
  deferred post-launch).
- **Timing:** do NOT build in isolation. Tracking's real value (live courier scans) comes
  from Shiprocket, which is currently paused (`SHIPROCKET_PAUSED=true`). Fold this into the
  Shiprocket un-pause so it shares the AWB + webhook plumbing.

## The two layers of tracking
1. **Internal order status** — already in the DB: `OrderStatus`
   (PENDING → CONFIRMED → PACKED → SHIPPED → DELIVERED → …). No external dependency.
2. **Live courier tracking** — AWB, courier scans, ETA. Only exists once an order ships
   through a courier, i.e. it comes from **Shiprocket** (Shipments/Tracking + webhook).
   A track page showing only manually-set internal status has limited value, which is why
   this is tied to the Shiprocket resume.

## Schema changes (Prisma `Order`)
- `awb String?` — courier tracking number (set on shipment)
- `courierName String?` — e.g. "Delhivery Surface"
- `trackingUrl String?` — courier deep-link
- `trackingToken String? @unique` — unguessable token for the email link (generate at order creation)
- New model `ShipmentEvent` — `{ id, orderId, status, location?, note?, occurredAt }`,
  one row per courier scan, for the timeline.

## Endpoints
- `GET /track/[token]` — opens directly from the email link (token → order).
- `POST /api/track` — manual lookup; body `{ orderNumber, email }`, **both must match**
  (guards against order-number enumeration); returns status + events + courier link.
- `POST /api/shipping/track-webhook` — Shiprocket tracking webhook, HMAC-verified like the
  Razorpay webhook → appends `ShipmentEvent`, advances `OrderStatus`, triggers status emails.

## UI
- `/track` page: status **timeline** (Confirmed → Packed → Shipped → Out for delivery →
  Delivered) in the Modern Apothecary style; shows courier + AWB + a "track on courier site"
  button + event history.

## Emails (extend `src/lib/email.ts`)
- Add a "Track your order" link (the tokened URL) to the confirmation email.
- Send "Shipped / Out for delivery / Delivered" updates, fired by the tracking webhook.

## Dependencies — rides on the paused Shiprocket work
1. Resume Shiprocket (remove `SHIPROCKET_PAUSED` from `.env`).
2. Wire fulfillment: paid order → push to Shiprocket (Orders API) → assign courier →
   store `awb` / `courierName` / `trackingUrl` on the order.
3. Register the tracking webhook in Shiprocket → live status + events.

## Build order (when picked up)
1. Schema migration (`awb`, `courierName`, `trackingUrl`, `trackingToken`, `ShipmentEvent`).
2. Tokened "Track your order" link in the confirmation email.
3. `/track` page + `POST /api/track` (works on internal status alone).
4. Shiprocket order-push + AWB capture (on payment settlement).
5. Tracking webhook + status-update emails → fully live.

## Security notes
- Manual lookup requires order# **and** matching email.
- The email-link token is random + unique (not derivable from the order number).
- Webhook is HMAC-verified before any DB write.