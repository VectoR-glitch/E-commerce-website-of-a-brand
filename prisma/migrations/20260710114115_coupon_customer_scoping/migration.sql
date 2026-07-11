-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "customerId" TEXT;

-- CreateIndex
CREATE INDEX "Coupon_customerId_idx" ON "Coupon"("customerId");
