-- AlterTable
ALTER TABLE "BlogPost" ADD COLUMN     "previousSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[];
