-- DropIndex
DROP INDEX "BundleItem_bundleId_variantId_key";

-- AlterTable
ALTER TABLE "BundleItem" ADD COLUMN     "productId" TEXT,
ADD COLUMN     "size" TEXT,
ALTER COLUMN "variantId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "BundleItem" ADD CONSTRAINT "BundleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
