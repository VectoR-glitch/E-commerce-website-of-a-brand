import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AddressInput = {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  phone: string | null;
};

// Upserts a customer's single default shipping address. The read (is there
// already a default row?) and the write (update it, or create a new one) are
// wrapped in one SERIALIZABLE transaction — a read-then-write with no
// isolation guard would let two concurrent submits (double-click, retry)
// both miss the read and both create a row, leaving two `isDefault: true`
// addresses for the same customer with nothing in the schema preventing it.
// SERIALIZABLE makes Postgres abort one of the two conflicting transactions
// (P2034) instead of letting both succeed; we retry once, since a
// serialization failure is expected/transient, not a real application error.
export async function upsertDefaultAddress(customerId: string, data: AddressInput): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await prisma.$transaction(
        async (tx) => {
          const existing = await tx.address.findFirst({
            where: { customerId, isDefault: true },
            select: { id: true },
          });
          if (existing) {
            await tx.address.update({ where: { id: existing.id }, data });
          } else {
            await tx.address.create({ data: { customerId, ...data, isDefault: true } });
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return;
    } catch (err) {
      const isConflict = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
      if (!isConflict || attempt === 1) throw err;
      // Retry once on a genuine serialization conflict.
    }
  }
}
