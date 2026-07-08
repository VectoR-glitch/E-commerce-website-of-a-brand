-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "loyaltyAwardedAt" TIMESTAMP(3);

-- Backfill: orders that already settled under the old (pre-delivery-gated)
-- award flow already had their points + any referral bonus credited at
-- settlement. Mark them as awarded now so a future DELIVERED transition on
-- one of these pre-existing orders can't double-credit it.
UPDATE "Order"
SET "loyaltyAwardedAt" = "updatedAt"
WHERE "paymentStatus" IN ('PAID', 'PARTIALLY_PAID');
