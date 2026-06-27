// Continuously scrolling promise strip. Renders two identical groups; the CSS
// animation shifts the track by half its width for a seamless infinite loop.
// Pure CSS (no JS) and pauses on hover; disabled under reduced motion.
// Declared at module scope (not inside Ticker) so it isn't re-created on every
// render. Rendered twice to form the seamless marquee loop.
function TickerGroup({
  items,
  hidden = false,
}: {
  items: string[];
  hidden?: boolean;
}) {
  return (
    <div
      aria-hidden={hidden || undefined}
      className="ticker-track flex shrink-0 items-center gap-12 pr-12"
    >
      {items.map((it, i) => (
        <span key={i} className="smallcaps whitespace-nowrap text-forest">
          <span className="text-brass-deep">◆</span> {it}
        </span>
      ))}
    </div>
  );
}

export function Ticker({ items }: { items: string[] }) {
  return (
    <div className="ticker overflow-hidden border-y border-line py-7">
      <div className="flex w-max">
        <TickerGroup items={items} />
        <TickerGroup items={items} hidden />
      </div>
    </div>
  );
}
