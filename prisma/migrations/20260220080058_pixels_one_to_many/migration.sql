/*
  Warnings:

  - You are about to drop the column `adAccountId` on the `meta_pixels` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[ad_account_id,metaPixelId]` on the table `meta_pixels` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `ad_account_id` to the `meta_pixels` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `meta_pixels` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "meta_pixels" DROP CONSTRAINT "meta_pixels_adAccountId_fkey";

-- DropIndex
DROP INDEX "meta_pixels_adAccountId_key";

-- DropIndex
DROP INDEX "meta_pixels_metaPixelId_key";

-- AlterTable
ALTER TABLE "meta_pixels" DROP COLUMN "adAccountId",
ADD COLUMN     "ad_account_id" TEXT NOT NULL,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isUnavailable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_fired_time" TIMESTAMP(3),
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "meta_pixels_ad_account_id_idx" ON "meta_pixels"("ad_account_id");

-- CreateIndex
CREATE INDEX "meta_pixels_metaPixelId_idx" ON "meta_pixels"("metaPixelId");

-- CreateIndex
CREATE UNIQUE INDEX "meta_pixels_ad_account_id_metaPixelId_key" ON "meta_pixels"("ad_account_id", "metaPixelId");

-- AddForeignKey
ALTER TABLE "meta_pixels" ADD CONSTRAINT "meta_pixels_ad_account_id_fkey" FOREIGN KEY ("ad_account_id") REFERENCES "meta_ad_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
