-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "name" TEXT,
    "avatar_url" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facebook_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "facebook_user_id" TEXT NOT NULL,
    "facebook_user_name" TEXT,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facebook_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_ad_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "facebook_account_id" TEXT NOT NULL,
    "metaAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "businessName" TEXT,
    "accessToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastCampaignSyncAt" TIMESTAMP(3),
    "lastAdsetSyncAt" TIMESTAMP(3),
    "accountStatus" INTEGER,
    "accountSpendCap" DOUBLE PRECISION,
    "amountSpent" DOUBLE PRECISION,

    CONSTRAINT "meta_ad_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_pixels" (
    "id" TEXT NOT NULL,
    "metaPixelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "capiEnabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "meta_pixels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_pages" (
    "id" TEXT NOT NULL,
    "metaPageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "tasks" TEXT[],
    "category" TEXT,
    "picture" TEXT,

    CONSTRAINT "meta_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_drafts" (
    "id" TEXT NOT NULL,
    "metaCampaignId" TEXT,
    "adAccountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "buyingType" TEXT NOT NULL DEFAULT 'AUCTION',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "specialAdCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isAdvantagePlus" BOOLEAN NOT NULL DEFAULT false,
    "dailyBudget" INTEGER,
    "lifetimeBudget" INTEGER,
    "bidStrategy" TEXT,
    "spendCap" INTEGER,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "advantageAudience" BOOLEAN NOT NULL DEFAULT true,
    "advantagePlacements" BOOLEAN NOT NULL DEFAULT true,
    "strictPlacementExclusions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adset_drafts" (
    "id" TEXT NOT NULL,
    "metaAdSetId" TEXT,
    "campaignDraftId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "optimizationGoal" TEXT NOT NULL,
    "targeting" JSONB NOT NULL,
    "placements" JSONB,
    "destinationType" TEXT NOT NULL DEFAULT 'WEBSITE',
    "enableDynamicCreative" BOOLEAN NOT NULL DEFAULT false,
    "valueRulesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "optimizeForFirstConversion" BOOLEAN NOT NULL DEFAULT false,
    "dailyBudget" INTEGER,
    "lifetimeBudget" INTEGER,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "bidStrategy" TEXT NOT NULL DEFAULT 'LOWEST_COST_WITHOUT_CAP',
    "bidAmount" INTEGER,
    "costPerResult" INTEGER,
    "promotedObject" JSONB,
    "pacingType" JSONB,
    "isAdvantagePlus" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adset_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_drafts" (
    "id" TEXT NOT NULL,
    "metaAdId" TEXT,
    "metaCreativeId" TEXT,
    "adSetDraftId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "creativeSpec" JSONB NOT NULL,
    "primaryText" TEXT NOT NULL,
    "headline" TEXT,
    "description" TEXT,
    "callToAction" TEXT,
    "websiteUrl" TEXT,
    "displayUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_campaigns" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "effectiveStatus" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "startTime" TIMESTAMP(3),
    "stopTime" TIMESTAMP(3),
    "dailyBudget" TEXT,
    "lifetimeBudget" TEXT,
    "createdTime" TIMESTAMP(3) NOT NULL,
    "updatedTime" TIMESTAMP(3) NOT NULL,
    "insights" JSONB,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAdsetSyncAt" TIMESTAMP(3),
    "budgetRemaining" TEXT,
    "accountIdMeta" TEXT,
    "buyingType" TEXT,
    "specialAdCategories" JSONB NOT NULL DEFAULT '[]',
    "specialAdCategoriesCategory" TEXT,
    "canUseSpendCap" BOOLEAN,
    "configuredStatus" TEXT,
    "isSkadnetworkAttribution" BOOLEAN,
    "boostedObjectId" TEXT,
    "brandSafetyScore" TEXT,

    CONSTRAINT "meta_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_adsets" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "effectiveStatus" TEXT NOT NULL,
    "dailyBudget" TEXT,
    "lifetimeBudget" TEXT,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "createdTime" TIMESTAMP(3) NOT NULL,
    "updatedTime" TIMESTAMP(3) NOT NULL,
    "targeting" JSONB,
    "insights" JSONB,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "budgetRemaining" TEXT,
    "accountIdMeta" TEXT,
    "bidStrategy" TEXT,
    "bidAmount" TEXT,
    "billingEvent" TEXT,
    "optimizationSubEvent" TEXT,
    "promotedObject" JSONB,
    "attributionSpec" JSONB,
    "isDynamicCreative" BOOLEAN NOT NULL DEFAULT false,
    "rfPredictionId" TEXT,
    "regionalRegulatedCategories" JSONB,

    CONSTRAINT "meta_adsets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_ads" (
    "id" TEXT NOT NULL,
    "adSetId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "effectiveStatus" TEXT NOT NULL,
    "createdTime" TIMESTAMP(3) NOT NULL,
    "updatedTime" TIMESTAMP(3) NOT NULL,
    "creative" JSONB,
    "previews" JSONB,
    "insights" JSONB,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_ads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceId" TEXT,
    "metaResourceId" TEXT,
    "payload" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orphaned_meta_resources" (
    "id" TEXT NOT NULL,
    "metaResourceId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orphaned_meta_resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE INDEX "sessions_session_token_idx" ON "sessions"("session_token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "oauth_accounts_user_id_idx" ON "oauth_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_accounts_provider_provider_account_id_key" ON "oauth_accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE INDEX "facebook_accounts_user_id_idx" ON "facebook_accounts"("user_id");

-- CreateIndex
CREATE INDEX "facebook_accounts_facebook_user_id_idx" ON "facebook_accounts"("facebook_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "facebook_accounts_user_id_facebook_user_id_key" ON "facebook_accounts"("user_id", "facebook_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "meta_ad_accounts_metaAccountId_key" ON "meta_ad_accounts"("metaAccountId");

-- CreateIndex
CREATE INDEX "meta_ad_accounts_userId_idx" ON "meta_ad_accounts"("userId");

-- CreateIndex
CREATE INDEX "meta_ad_accounts_facebook_account_id_idx" ON "meta_ad_accounts"("facebook_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "meta_ad_accounts_facebook_account_id_metaAccountId_key" ON "meta_ad_accounts"("facebook_account_id", "metaAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "meta_pixels_metaPixelId_key" ON "meta_pixels"("metaPixelId");

-- CreateIndex
CREATE UNIQUE INDEX "meta_pixels_adAccountId_key" ON "meta_pixels"("adAccountId");

-- CreateIndex
CREATE INDEX "meta_pages_userId_idx" ON "meta_pages"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "meta_pages_metaPageId_userId_key" ON "meta_pages"("metaPageId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_drafts_metaCampaignId_key" ON "campaign_drafts"("metaCampaignId");

-- CreateIndex
CREATE INDEX "campaign_drafts_adAccountId_idx" ON "campaign_drafts"("adAccountId");

-- CreateIndex
CREATE INDEX "campaign_drafts_userId_idx" ON "campaign_drafts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "adset_drafts_metaAdSetId_key" ON "adset_drafts"("metaAdSetId");

-- CreateIndex
CREATE INDEX "adset_drafts_campaignDraftId_idx" ON "adset_drafts"("campaignDraftId");

-- CreateIndex
CREATE INDEX "adset_drafts_metaAdSetId_idx" ON "adset_drafts"("metaAdSetId");

-- CreateIndex
CREATE UNIQUE INDEX "ad_drafts_metaAdId_key" ON "ad_drafts"("metaAdId");

-- CreateIndex
CREATE UNIQUE INDEX "ad_drafts_metaCreativeId_key" ON "ad_drafts"("metaCreativeId");

-- CreateIndex
CREATE INDEX "ad_drafts_adSetDraftId_idx" ON "ad_drafts"("adSetDraftId");

-- CreateIndex
CREATE UNIQUE INDEX "meta_campaigns_id_accountId_key" ON "meta_campaigns"("id", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "meta_adsets_id_accountId_key" ON "meta_adsets"("id", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "meta_ads_id_accountId_key" ON "meta_ads"("id", "accountId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_metaResourceId_idx" ON "audit_logs"("metaResourceId");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "orphaned_meta_resources_resolved_idx" ON "orphaned_meta_resources"("resolved");

-- CreateIndex
CREATE INDEX "orphaned_meta_resources_userId_idx" ON "orphaned_meta_resources"("userId");

-- CreateIndex
CREATE INDEX "orphaned_meta_resources_resourceType_idx" ON "orphaned_meta_resources"("resourceType");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facebook_accounts" ADD CONSTRAINT "facebook_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_ad_accounts" ADD CONSTRAINT "meta_ad_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_ad_accounts" ADD CONSTRAINT "meta_ad_accounts_facebook_account_id_fkey" FOREIGN KEY ("facebook_account_id") REFERENCES "facebook_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_pixels" ADD CONSTRAINT "meta_pixels_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "meta_ad_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_pages" ADD CONSTRAINT "meta_pages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_drafts" ADD CONSTRAINT "campaign_drafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_drafts" ADD CONSTRAINT "campaign_drafts_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "meta_ad_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adset_drafts" ADD CONSTRAINT "adset_drafts_campaignDraftId_fkey" FOREIGN KEY ("campaignDraftId") REFERENCES "campaign_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_drafts" ADD CONSTRAINT "ad_drafts_adSetDraftId_fkey" FOREIGN KEY ("adSetDraftId") REFERENCES "adset_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_campaigns" ADD CONSTRAINT "meta_campaigns_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "meta_ad_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_campaigns" ADD CONSTRAINT "meta_campaigns_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_adsets" ADD CONSTRAINT "meta_adsets_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "meta_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_adsets" ADD CONSTRAINT "meta_adsets_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "meta_ad_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_ads" ADD CONSTRAINT "meta_ads_adSetId_fkey" FOREIGN KEY ("adSetId") REFERENCES "meta_adsets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_ads" ADD CONSTRAINT "meta_ads_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "meta_ad_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orphaned_meta_resources" ADD CONSTRAINT "orphaned_meta_resources_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
