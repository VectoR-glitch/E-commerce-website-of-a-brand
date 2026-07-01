import Link from "next/link";
import { getSession } from "@/lib/session";
import { AccountMenu } from "@/components/account-menu";

// Server-only account control for the site header. Reads the session (which
// opts header-bearing pages into dynamic rendering) and renders:
//   - signed out  → a person icon linking to /login (no client JS)
//   - signed in   → the AccountMenu dropdown (Ops dashboard for admins + Sign out)
// Passed into SiteHeader as its `accountSlot` from the (site) layout, so this
// server-only session read never enters the client error/404 bundle.
export async function HeaderAccount() {
  const session = await getSession();

  if (!session) {
    return (
      <Link
        href="/login"
        aria-label="Sign in"
        className="inline-flex items-center justify-center border border-ink p-2.5 text-ink transition-colors hover:border-forest hover:text-forest"
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" />
        </svg>
      </Link>
    );
  }

  return <AccountMenu isAdmin={session.role === "ADMIN"} email={session.email} />;
}