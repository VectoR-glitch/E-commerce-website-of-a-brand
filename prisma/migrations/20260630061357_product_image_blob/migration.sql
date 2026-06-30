/*
  Warnings:

  - You are about to drop the column `url` on the `ProductImage` table. All the data in the column will be lost.
  - Added the required column `contentType` to the `ProductImage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `data` to the `ProductImage` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ProductImage" DROP COLUMN "url",
ADD COLUMN     "contentType" TEXT NOT NULL,
ADD COLUMN     "data" BYTEA NOT NULL;
