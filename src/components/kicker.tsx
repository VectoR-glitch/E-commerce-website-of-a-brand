import { LeafIcon } from "@/components/leaf-icon";

// The small "eyebrow" label every page header uses above its H1 — now with a
// tiny botanical sprig, extending the same thin-line leaf language already
// used in TrustBadges' "Plant-powered" icon. One consistent, quiet touch of
// the brand's plant-powered identity across every page, not a redesign.
export function Kicker({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`smallcaps inline-flex items-center gap-1.5 text-brass-deep ${className}`}>
      <LeafIcon className="text-brass" />
      {children}
    </span>
  );
}
