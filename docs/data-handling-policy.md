# Klenich / Bharat Bliss Pvt Ltd — Data Handling Policy

**Effective:** 2026-08-03 · **Owner:** Founder/lead developer · **Review cadence:** every 6 months

This describes what personal data Klenich actually collects, why, and how it's
protected — written to match real current practice, not an aspirational
standard. Update it whenever practice changes; don't let it drift out of date.

## What we collect

For order fulfillment and delivery: customer name, shipping/billing address,
phone number, and email. For accounts: email and a hashed password (via
Auth.js). No payment card data is collected or stored directly — Razorpay
handles that and we never see raw card details.

## Why

Solely to fulfil orders: process payment, generate the shipping label/invoice,
deliver the package, and contact the customer about their order (status
updates, delivery issues). Not used for any purpose beyond running the store.

## Where it's stored

PostgreSQL, hosted on Neon (a SOC 2 Type II certified provider). Encrypted in
transit via TLS on every connection. The application itself runs on Vercel.

## Who can access it

Only authenticated admin accounts, gated by session-based authentication
(Auth.js) with role-checked admin routes. No public or customer-facing surface
exposes another customer's data.

## Retention

Order and shipment records are retained long-term for GST/tax record-keeping
purposes (invoicing compliance), not deleted on a short timer. This matches
statutory record-keeping expectations for Indian GST-registered businesses.

## Sharing with outside parties

Order/delivery data is shared only with the carrier actually delivering that
order (currently Ekart; Amazon Shipping once integrated) — solely as needed to
generate the shipping label and deliver the package. Payment data is shared
only with Razorpay to process the transaction. Order-status notifications may
be sent to the customer via WhatsApp (Meta's WhatsApp Business Platform) —
this is data being delivered *to the customer themselves*, not to an
unrelated third party.

## Disposal

No formal automated disposal process exists today; data is retained per the
retention policy above rather than actively purged. This is a known gap, not
a claim of active deletion tooling.
