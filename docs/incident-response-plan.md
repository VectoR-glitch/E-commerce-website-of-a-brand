# Klenich / Bharat Bliss Pvt Ltd — Incident Response Plan

**Effective:** 2026-08-03 · **Owner:** Founder/lead developer · **Review cadence:** every 6 months (next review: 2027-02-03)

A small-team incident response plan — deliberately lightweight, matching our
actual size, but genuinely followed rather than written for show.

## Roles

The founder/lead developer is the sole incident owner: detects or receives
reports of an incident, decides on response actions, and handles all
notifications. There is no dedicated security team — at our current size,
that's this one person.

## On detecting a security incident (e.g. credential leak, unauthorized
## access, data exposure)

1. **Contain**: immediately rotate any credentials/API keys suspected of
   compromise (Vercel environment variables, database credentials, carrier
   API tokens, payment gateway keys).
2. **Investigate**: review available logs (Vercel deployment/function logs,
   database access, admin action history) to determine scope — what data or
   systems were actually affected.
3. **Notify Amazon** (if the incident involves Amazon Information obtained via
   the Selling Partner API): email **security@amazon.com** within 24 hours of
   detection, describing what happened and what data was involved.
4. **Notify affected customers**, if customer data was actually exposed, via
   email/WhatsApp — plainly stating what happened and what we're doing about
   it.
5. **Remediate**: fix the underlying cause (patch the vulnerability, revoke
   the compromised access path, etc.) before considering the incident closed.

## Review

This document is reviewed and updated every 6 months, or immediately after any
real incident (to fold in what was learned). Next scheduled review: see date
above.
