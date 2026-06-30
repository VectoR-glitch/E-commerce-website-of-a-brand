import Link from "next/link";
import { getSession } from "@/lib/session";

// Server-only: renders the ops-console link for signed-in admins, nothing
// otherwise. Passed into SiteHeader as its `adminSlot` from the (site) layout
// so the session read (server-only) never enters the client error/404 bundle.
// Reading the cookie opts header-bearing pages into dynamic rendering.
export async function HeaderAdminLink() {
  const session = await getSession();
  if (session?.role !== "ADMIN") return null;

  return (
    <Link
      href="/admin"
      className="smallcaps hidden border border-line px-3 py-1.5 text-ink/70 transition-colors hover:border-forest hover:text-forest md:inline-block"
    >
      Admin
    </Link>
  );
}