import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// Read-only prefill for the checkout form: the signed-in customer's contact
// details + their saved default address. Returns { prefill: null } for guests
// or when nothing is saved, so the checkout can silently skip the prompt.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ prefill: null });

  const [customer, address] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: session.sub },
      select: { name: true, email: true, phone: true },
    }),
    prisma.address.findFirst({
      where: { customerId: session.sub, isDefault: true },
      select: { line1: true, line2: true, city: true, state: true, pincode: true, phone: true },
    }),
  ]);

  if (!customer) return NextResponse.json({ prefill: null });

  // Only worth prompting when there's a saved address to offer.
  if (!address) return NextResponse.json({ prefill: null });

  return NextResponse.json({
    prefill: {
      fullName: customer.name ?? "",
      email: customer.email,
      // Prefer the address's contact phone, falling back to the profile phone.
      phone: address.phone ?? customer.phone ?? "",
      line1: address.line1,
      line2: address.line2 ?? "",
      city: address.city,
      state: address.state,
      pincode: address.pincode,
    },
  });
}