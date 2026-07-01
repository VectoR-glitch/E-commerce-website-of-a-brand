import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth";

// GET target of the emailed verification link. Confirms the address, then
// redirects to login with a status notice. A route handler (not a page) so the
// DB write is an explicit side effect, and redirects use the request origin.
export async function GET(request: NextRequest) {
  const url = (path: string) => new URL(path, request.nextUrl.origin);
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(url("/login?notice=verify-invalid"));

  const row = await prisma.verificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { customerId: true, expiresAt: true, customer: { select: { email: true } } },
  });
  if (!row || row.expiresAt < new Date()) {
    return NextResponse.redirect(url("/login?notice=verify-expired"));
  }

  // Confirm the email, clear outstanding tokens, and CLAIM any past guest orders
  // placed with this (now-verified) email — verification proves ownership, so
  // attributing them to the account is safe.
  await prisma.$transaction([
    prisma.customer.update({ where: { id: row.customerId }, data: { emailVerified: new Date() } }),
    prisma.verificationToken.deleteMany({ where: { customerId: row.customerId } }),
    prisma.order.updateMany({
      where: { email: row.customer.email, customerId: null },
      data: { customerId: row.customerId },
    }),
  ]);

  return NextResponse.redirect(url("/login?notice=verified"));
}