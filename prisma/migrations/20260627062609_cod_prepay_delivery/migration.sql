-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_PAID';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "amountPaidPaise" INTEGER NOT NULL DEFAULT 0;
