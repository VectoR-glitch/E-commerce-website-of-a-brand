// Mirrors the (site) template — a template re-mounts on every navigation, so
// this replays the fade-up on each admin route change too. Header/nav live in
// the layout, so only the page content fades.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-fade">{children}</div>;
}
