-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('ONLINE', 'COD');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'ONLINE';
