// Reassurance row for checkout / cart — the quiet "you're safe to buy" cues,
// styled to the Modern Apothecary system: brass hairline medallions, small-caps
// labels, no heavy boxes. Purely presentational; no state, so it's a plain
// component usable from server or client trees. Every claim is already true of
// the store (Razorpay SSL, COD, the brand, the /help + /contact pages).

type Badge = { icon: React.ReactNode; title: string; sub: string };

// Thin-stroke line icons on a 20-unit grid, sized to sit inside the medallion.
const shield = (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M10 2.4l5.4 1.9v4c0 3.5-2.3 6.6-5.4 7.8-3.1-1.2-5.4-4.3-5.4-7.8v-4L10 2.4z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    <path d="M7.5 9.9l1.7 1.7L12.7 8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const coins = (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <ellipse cx="10" cy="5.6" rx="5.4" ry="2.3" stroke="currentColor" strokeWidth="1.1" />
    <path d="M4.6 5.6v4.2c0 1.27 2.42 2.3 5.4 2.3s5.4-1.03 5.4-2.3V5.6M4.6 9.8v4.2c0 1.27 2.42 2.3 5.4 2.3s5.4-1.03 5.4-2.3V9.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
  </svg>
);
const leaf = (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M15.5 4.2C9 4.2 5 7.4 5 12.5c0 .9.15 1.7.45 2.4C6.3 10.8 9.6 8.5 13.8 8c-3.3 1.1-5.8 3.6-7.1 7.4C11 16.6 15.5 13.4 15.5 6.6V4.2z" stroke="currentColor" strokeWidth="1.05" strokeLinejoin="round" />
  </svg>
);
const support = (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M4.5 11v-.9a5.5 5.5 0 0111 0v.9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    <rect x="3.4" y="11" width="2.7" height="4.6" rx="1.1" stroke="currentColor" strokeWidth="1.1" />
    <rect x="13.9" y="11" width="2.7" height="4.6" rx="1.1" stroke="currentColor" strokeWidth="1.1" />
    <path d="M15.5 15.6c0 1.4-1.5 2.2-3.3 2.2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
  </svg>
);

const BADGES: Badge[] = [
  { icon: shield, title: "Secure checkout", sub: "Encrypted & protected by Razorpay" },
  { icon: coins, title: "Cash on Delivery", sub: "Available across most pincodes" },
  { icon: leaf, title: "Plant-powered", sub: "Made in India, kinder home care" },
  { icon: support, title: "Here to help", sub: "Real support, before & after" },
];

export function TrustBadges({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      {/* Delicate captioned rule — the brand's hairline-and-brass signature. */}
      <div className="flex items-center gap-3 text-brass">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-brass/45" />
        <span className="smallcaps shrink-0 text-brass-deep">Shop with confidence</span>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-brass/45" />
      </div>

      <ul className="mt-5 space-y-4">
        {BADGES.map((b) => (
          <li key={b.title} className="flex items-center gap-3.5">
            {/* Brass medallion — an apothecary seal, not a boxed tile. */}
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-brass/35 bg-paper text-brass-deep shadow-[inset_0_0_0_1px_rgba(176,141,76,0.08)]">
              {b.icon}
            </span>
            <span className="min-w-0">
              <span className="smallcaps block text-ink/80">{b.title}</span>
              <span className="mt-1 block text-xs leading-snug text-ink/50">{b.sub}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
