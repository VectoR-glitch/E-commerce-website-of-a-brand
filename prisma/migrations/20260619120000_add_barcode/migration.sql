-- AlterTable
ALTER TABLE "Variant" ADD COLUMN "barcode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Variant_barcode_key" ON "Variant"("barcode");