-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "lifetimePoints" INTEGER NOT NULL DEFAULT 0;

-- Backfill from existing ledger history: lifetime points earned is the sum of
-- every positive-delta entry (order/referral/referee) — redemptions are
-- negative deltas and excluded by the > 0 filter, so this can't undercount.
UPDATE "Customer" c
SET "lifetimePoints" = COALESCE((
  SELECT SUM(l."delta") FROM "LoyaltyLedger" l
  WHERE l."customerId" = c.id AND l."delta" > 0
), 0);

