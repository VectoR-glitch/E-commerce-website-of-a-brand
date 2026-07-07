// Shared thin-line leaf glyph — the same botanical mark used across TrustBadges,
// Kicker, and the footer, so every "plant-powered" touch on the site draws
// from one consistent drawing rather than several slightly different leaves.
export function LeafIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <path
        d="M15.5 4.2C9 4.2 5 7.4 5 12.5c0 .9.15 1.7.45 2.4C6.3 10.8 9.6 8.5 13.8 8c-3.3 1.1-5.8 3.6-7.1 7.4C11 16.6 15.5 13.4 15.5 6.6V4.2z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
