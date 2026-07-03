// Reassurance row for checkout / cart — the small "you're safe to buy" cues
// (secure payment, COD, plant-powered, support). Purely presentational; no
// state, so it's a plain component usable from server or client trees. Every
// claim here is already true of the store (Razorpay SSL, COD, the brand, the
// /help + /contact pages), so nothing is aspirational.

type Badge = { icon: React.ReactNode; title: string; sub: string };

const shield = (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M10 2l6 2.2v4.3c0 3.9-2.6 7.4-6 8.7-3.4-1.3-6-4.8-6-8.7V4.2L10 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M7.2 10l1.9 1.9L13 8.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const coins = (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <ellipse cx="10" cy="5.4" rx="6" ry="2.6" stroke="currentColor" strokeWidth="1.3" />
    <path d="M4 5.4v4.2c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6V5.4M4 9.6v4.2c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6V9.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);
const leaf = (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M16 4C9 4 4.5 7.5 4.5 13c0 1 .2 1.9.5 2.6C6 11 9.5 8.5 14 8c-3.5 1.2-6.2 3.8-7.6 7.8C11.5 17 16 13.5 16 6.5V4z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);
const support = (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M4 11v-1a6 6 0 0112 0v1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <rect x="3" y="11" width="3" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
    <rect x="14" y="11" width="3" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
    <path d="M16 16c0 1.5-1.6 2.4-3.5 2.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const BADGES: Badge[] = [
  { icon: shield, title: "Secure checkout", sub: "256-bit SSL via Razorpay" },
  { icon: coins, title: "Cash on Delivery", sub: "Available on most pincodes" },
  { icon: leaf, title: "Plant-powered", sub: "Made in India, kinder home care" },
  { icon: support, title: "Here to help", sub: "Real support before & after" },
];

export function TrustBadges({ className = "" }: { className?: string }) {
  return (
    <ul className={`grid grid-cols-2 gap-3 ${className}`}>
      {BADGES.map((b) => (
        <li key={b.title} className="flex items-start gap-2.5 border border-line bg-bone/40 px-3 py-2.5">
          <span className="mt-0.5 shrink-0 text-forest">{b.icon}</span>
          <span className="min-w-0">
            <span className="smallcaps block text-xs text-ink/80">{b.title}</span>
            <span className="mt-0.5 block text-[11px] leading-snug text-ink/50">{b.sub}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
