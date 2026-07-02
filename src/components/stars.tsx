// Read-only star rating display. Renders 5 stars with the filled portion set by
// `value` (0–5), so a 4.3 shows 86% of the row gilded. Server-safe (no client).
export function Stars({
  value,
  size = 16,
  className = "",
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  const row = (fill: string) => (
    <span className="flex" style={{ color: fill }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M10 1.6l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.2l-4.94 2.6.94-5.5-4-3.9 5.53-.8L10 1.6z" />
        </svg>
      ))}
    </span>
  );
  return (
    <span
      className={`relative inline-flex leading-none ${className}`}
      style={{ width: size * 5, height: size }}
      role="img"
      aria-label={`${value.toFixed(1)} out of 5 stars`}
    >
      <span className="absolute inset-0">{row("var(--color-line)")}</span>
      <span className="absolute inset-0 overflow-hidden" style={{ width: `${pct}%` }}>
        {row("var(--color-brass)")}
      </span>
    </span>
  );
}
