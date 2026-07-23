-- AlterTable
ALTER TABLE "Variant" ADD COLUMN     "lengthCm" INTEGER,
ADD COLUMN     "widthCm" INTEGER,
ADD COLUMN     "heightCm" INTEGER;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "ekartTrackingId" TEXT,
ADD COLUMN     "ekartWbn" TEXT,
ADD COLUMN     "ekartStatus" TEXT,
ADD COLUMN     "ekartShipmentCreatedAt" TIMESTAMP(3),
ADD COLUMN     "ekartLastTrackedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Order_ekartTrackingId_key" ON "Order"("ekartTrackingId");
