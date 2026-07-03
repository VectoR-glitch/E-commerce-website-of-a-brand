-- CreateTable
CREATE TABLE "BackInStockAlert" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "customerId" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackInStockAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackInStockAlert_variantId_idx" ON "BackInStockAlert"("variantId");

-- CreateIndex
CREATE INDEX "BackInStockAlert_notifiedAt_idx" ON "BackInStockAlert"("notifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BackInStockAlert_variantId_email_key" ON "BackInStockAlert"("variantId", "email");

-- AddForeignKey
ALTER TABLE "BackInStockAlert" ADD CONSTRAINT "BackInStockAlert_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

