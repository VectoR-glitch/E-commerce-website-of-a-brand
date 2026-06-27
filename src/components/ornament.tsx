// A fine brass pinstripe with a small central diamond motif — an understated
// nod to traditional Indian border ornamentation. Purely decorative.
// `align="left"` drops the leading line for editorial, left-aligned headings.
export function Ornament({
  className = "",
  align = "center",
}: {
  className?: string;
  align?: "center" | "left";
}) {
  return (
    <div
      aria-hidden="true"
      className={`flex items-center text-brass ${
        align === "left" ? "justify-start" : "justify-center"
      } ${className}`}
    >
      {align === "center" && (
        <span className="h-px w-16 bg-gradient-to-r from-transparent to-brass/70 sm:w-24" />
      )}
      <svg
        width="34"
        height="10"
        viewBox="0 0 34 10"
        fill="currentColor"
        className="mx-2 shrink-0"
      >
        <circle cx="4" cy="5" r="1.4" />
        <rect x="14" y="2" width="6" height="6" transform="rotate(45 17 5)" />
        <circle cx="30" cy="5" r="1.4" />
      </svg>
      <span className="h-px w-16 bg-gradient-to-l from-transparent to-brass/70 sm:w-24" />
    </div>
  );
}