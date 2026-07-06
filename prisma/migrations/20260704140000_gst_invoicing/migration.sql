-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "invoiceGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "invoiceNumber" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "gstPercent" INTEGER NOT NULL DEFAULT 18,
ADD COLUMN     "hsnCode" TEXT NOT NULL DEFAULT '34022';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "gstPercent" INTEGER NOT NULL DEFAULT 18,
ADD COLUMN     "hsnCode" TEXT NOT NULL DEFAULT '34022';

-- CreateTable
CREATE TABLE "InvoiceSequence" (
    "id" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_invoiceNumber_key" ON "Order"("invoiceNumber");

