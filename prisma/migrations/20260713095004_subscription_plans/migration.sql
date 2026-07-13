-- CreateEnum
CREATE TYPE "SubscriptionPlanStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "subscriptionIntervalDays" INTEGER,
ADD COLUMN     "subscriptionPlanId" TEXT;

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "intervalDays" INTEGER NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "status" "SubscriptionPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "couponCode" TEXT NOT NULL,
    "nextDeliveryAt" TIMESTAMP(3) NOT NULL,
    "lastReminderAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlanItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "SubscriptionPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_couponCode_key" ON "SubscriptionPlan"("couponCode");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_customerId_idx" ON "SubscriptionPlan"("customerId");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_status_nextDeliveryAt_idx" ON "SubscriptionPlan"("status", "nextDeliveryAt");

-- CreateIndex
CREATE INDEX "SubscriptionPlanItem_planId_idx" ON "SubscriptionPlanItem"("planId");

-- CreateIndex
CREATE INDEX "SubscriptionPlanItem_variantId_idx" ON "SubscriptionPlanItem"("variantId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_subscriptionPlanId_fkey" FOREIGN KEY ("subscriptionPlanId") REFERENCES "SubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPlan" ADD CONSTRAINT "SubscriptionPlan_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPlanItem" ADD CONSTRAINT "SubscriptionPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPlanItem" ADD CONSTRAINT "SubscriptionPlanItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
