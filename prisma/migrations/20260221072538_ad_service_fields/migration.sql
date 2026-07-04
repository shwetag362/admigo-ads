-- AlterTable
ALTER TABLE "ad_drafts" ADD COLUMN     "adFormat" TEXT,
ADD COLUMN     "creativeReused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "intelligenceReport" TEXT,
ADD COLUMN     "rawFbPayload" TEXT;

-- CreateTable
CREATE TABLE "creative_fingerprints" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "metaCreativeId" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "adFormat" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "useCount" INTEGER NOT NULL DEFAULT 1,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creative_fingerprints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "creative_fingerprints_fingerprint_key" ON "creative_fingerprints"("fingerprint");

-- CreateIndex
CREATE INDEX "creative_fingerprints_adAccountId_idx" ON "creative_fingerprints"("adAccountId");

-- CreateIndex
CREATE INDEX "creative_fingerprints_fingerprint_idx" ON "creative_fingerprints"("fingerprint");

-- CreateIndex
CREATE INDEX "creative_fingerprints_metaCreativeId_idx" ON "creative_fingerprints"("metaCreativeId");

-- CreateIndex
CREATE INDEX "creative_fingerprints_adAccountId_status_idx" ON "creative_fingerprints"("adAccountId", "status");
