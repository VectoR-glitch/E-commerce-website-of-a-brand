import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { logoutAction } from "@/app/actions/auth";
import { ProfileForm } from "@/components/account/profile-form";
import { AddressForm } from "@/components/account/address-form";
import { Kicker } from "@/components/kicker";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My Account" };

export default async function AccountPage() {
  const session = await requireSession("/account");
  const customer = await prisma.customer.findUnique({ where: { id: session.sub } });
  if (!customer) notFound();

  const isAdmin = customer.role === "ADMIN";

  const address = await prisma.address.findFirst({
    where: { customerId: customer.id, isDefault: true },
  });

  return (
    <div className="mx-auto max-w-2xl px-8 py-16">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <Kicker>Account</Kicker>
          <h1 className="mt-2 font-serif text-4xl">
            {customer.name ? `Hello, ${customer.name}` : "Your account"}
          </h1>
        </div>
        <form action={logoutAction}>
          <button className="smallcaps border border-line px-4 py-2 text-ink/70 transition-colors hover:border-forest hover:text-forest">
            Sign out
          </button>
        </form>
      </header>

      {/* Quick links */}
      <nav className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link
          href="/account/orders"
          className="border border-line bg-paper p-5 transition-colors hover:border-forest"
        >
          <p className="smallcaps text-brass-deep">Orders</p>
          <p className="mt-1 text-sm text-ink/60">Track and review your orders</p>
        </Link>
        <Link
          href="/account/subscriptions"
          className="border border-line bg-paper p-5 transition-colors hover:border-forest"
        >
          <p className="smallcaps text-brass-deep">Subscriptions</p>
          <p className="mt-1 text-sm text-ink/60">Manage your subscribe &amp; save deliveries</p>
        </Link>
        <Link
          href="/account/loyalty"
          className="border border-line bg-paper p-5 transition-colors hover:border-forest"
        >
          <p className="smallcaps text-brass-deep">Rewards</p>
          <p className="mt-1 text-sm text-ink/60">Your points, vouchers &amp; referral link</p>
        </Link>
        <Link
          href="/account/security"
          className="border border-line bg-paper p-5 transition-colors hover:border-forest"
        >
          <p className="smallcaps text-brass-deep">Password</p>
          <p className="mt-1 text-sm text-ink/60">Change your password</p>
        </Link>
        {isAdmin && (
          <Link
            href="/admin"
            className="border border-forest/40 bg-forest/5 p-5 transition-colors hover:border-forest sm:col-span-2"
          >
            <p className="smallcaps text-forest">Klenich Ops</p>
            <p className="mt-1 text-sm text-ink/60">Open the operations console</p>
          </Link>
        )}
      </nav>

      {/* Profile */}
      <section className="mt-10">
        <h2 className="smallcaps text-brass-deep">Your details</h2>
        <div className="mt-4 border border-line bg-paper p-6">
          <ProfileForm
            name={customer.name ?? ""}
            phone={customer.phone ?? ""}
            email={customer.email}
          />
        </div>
      </section>

      {/* Default shipping address */}
      <section className="mt-10">
        <h2 className="smallcaps text-brass-deep">Shipping address</h2>
        <p className="mt-1 text-sm text-ink/55">
          Your default delivery address. We&rsquo;ll use it to speed up checkout.
        </p>
        <div className="mt-4 border border-line bg-paper p-6">
          <AddressForm
            address={{
              line1: address?.line1 ?? "",
              line2: address?.line2 ?? "",
              city: address?.city ?? "",
              state: address?.state ?? "",
              pincode: address?.pincode ?? "",
              phone: address?.phone ?? "",
            }}
          />
        </div>
      </section>
    </div>
  );
}