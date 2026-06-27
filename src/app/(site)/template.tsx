// A template re-mounts on every navigation, so this wrapper replays its
// fade-up animation on each route change — a subtle page transition. Header
// and footer live in the layout, so only the page content fades.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-fade">{children}</div>;
}
