-- AlterTable
ALTER TABLE "meta_pixels" ADD COLUMN     "advanced_matching_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "automatic_events_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "dataset_id" TEXT,
ADD COLUMN     "event_match_quality_score" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "last_event_received_at" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "total_events_received" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "meta_datasets" (
    "id" TEXT NOT NULL,
    "dataset_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ad_account_id" TEXT NOT NULL,
    "description" TEXT,
    "source_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "total_events" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_datasets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pixel_capi_configs" (
    "id" TEXT NOT NULL,
    "pixel_id" TEXT NOT NULL,
    "dataset_id" TEXT,
    "capi_version" TEXT NOT NULL DEFAULT 'v2',
    "test_event_code" TEXT,
    "deduplication_enabled" BOOLEAN NOT NULL DEFAULT true,
    "gateway_mode" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'inactive',
    "total_events_sent" INTEGER NOT NULL DEFAULT 0,
    "last_event_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pixel_capi_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_custom_events" (
    "id" TEXT NOT NULL,
    "pixel_id" TEXT NOT NULL,
    "dataset_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "event_type" TEXT NOT NULL DEFAULT 'custom',
    "parameters" JSONB NOT NULL DEFAULT '[]',
    "rules" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "total_occurrences" INTEGER NOT NULL DEFAULT 0,
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_custom_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_custom_conversions" (
    "id" TEXT NOT NULL,
    "conversion_id" TEXT NOT NULL,
    "pixel_id" TEXT NOT NULL,
    "dataset_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "custom_event_type" TEXT NOT NULL DEFAULT 'OTHER',
    "event_source_type" TEXT NOT NULL DEFAULT 'pixel',
    "rule" TEXT,
    "url_rules" JSONB NOT NULL DEFAULT '[]',
    "param_rules" JSONB NOT NULL DEFAULT '[]',
    "default_conversion_value" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "aggregation_rule" TEXT NOT NULL DEFAULT 'COUNT',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_custom_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_offline_uploads" (
    "id" TEXT NOT NULL,
    "upload_id" TEXT NOT NULL,
    "pixel_id" TEXT NOT NULL,
    "dataset_id" TEXT,
    "upload_tag" TEXT,
    "upload_source" TEXT NOT NULL DEFAULT 'manual',
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "valid_rows" INTEGER NOT NULL DEFAULT 0,
    "invalid_rows" INTEGER NOT NULL DEFAULT 0,
    "matched_rows" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "meta_offline_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_offline_events" (
    "id" TEXT NOT NULL,
    "upload_id" TEXT NOT NULL,
    "pixel_id" TEXT NOT NULL,
    "dataset_id" TEXT,
    "event_name" TEXT NOT NULL,
    "event_time" TIMESTAMP(3) NOT NULL,
    "match_keys" JSONB NOT NULL DEFAULT '{}',
    "custom_data" JSONB NOT NULL DEFAULT '{}',
    "currency" TEXT,
    "value" DECIMAL(12,2),
    "order_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "match_result" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_offline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_test_events" (
    "id" TEXT NOT NULL,
    "pixel_id" TEXT NOT NULL,
    "test_code" TEXT,
    "event_name" TEXT NOT NULL,
    "event_source" TEXT NOT NULL DEFAULT 'pixel',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "match_quality" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'received',
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_test_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_diagnostics" (
    "id" TEXT NOT NULL,
    "pixel_id" TEXT NOT NULL,
    "dataset_id" TEXT,
    "issue_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "event_name" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "affected_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "meta_diagnostics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_domain_verifications" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "pixel_id" TEXT,
    "ad_account_id" TEXT NOT NULL,
    "verification_method" TEXT NOT NULL,
    "verification_code" TEXT NOT NULL,
    "verification_tag" TEXT,
    "dns_txt_record" TEXT,
    "html_file_name" TEXT,
    "html_file_content" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_domain_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_partner_integrations" (
    "id" TEXT NOT NULL,
    "pixel_id" TEXT NOT NULL,
    "partner_name" TEXT NOT NULL,
    "partner_type" TEXT,
    "integration_status" TEXT NOT NULL DEFAULT 'inactive',
    "config" JSONB NOT NULL DEFAULT '{}',
    "auto_events_enabled" BOOLEAN NOT NULL DEFAULT true,
    "connected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_partner_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_signals_gateways" (
    "id" TEXT NOT NULL,
    "gateway_id" TEXT NOT NULL,
    "pixel_id" TEXT NOT NULL,
    "dataset_id" TEXT,
    "name" TEXT NOT NULL,
    "cloud_provider" TEXT,
    "region" TEXT,
    "endpoint_url" TEXT,
    "external_destinations" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'inactive',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_signals_gateways_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_privacy_settings" (
    "id" TEXT NOT NULL,
    "pixel_id" TEXT NOT NULL,
    "data_retention_days" INTEGER NOT NULL DEFAULT 180,
    "ldu_enabled" BOOLEAN NOT NULL DEFAULT false,
    "gdpr_mode" BOOLEAN NOT NULL DEFAULT false,
    "ccpa_mode" BOOLEAN NOT NULL DEFAULT false,
    "consent_required" BOOLEAN NOT NULL DEFAULT false,
    "pii_hashing_enforced" BOOLEAN NOT NULL DEFAULT true,
    "data_processing_options" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_privacy_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_aem_configs" (
    "id" TEXT NOT NULL,
    "pixel_id" TEXT NOT NULL,
    "domain" TEXT,
    "auto_managed" BOOLEAN NOT NULL DEFAULT true,
    "opted_in_value_optimization" BOOLEAN NOT NULL DEFAULT false,
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_aem_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_event_dedups" (
    "id" TEXT NOT NULL,
    "pixel_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_name" TEXT,
    "pixel_event_received" BOOLEAN NOT NULL DEFAULT false,
    "capi_event_received" BOOLEAN NOT NULL DEFAULT false,
    "deduplicated" BOOLEAN NOT NULL DEFAULT false,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_event_dedups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meta_datasets_dataset_id_key" ON "meta_datasets"("dataset_id");

-- CreateIndex
CREATE INDEX "meta_datasets_ad_account_id_idx" ON "meta_datasets"("ad_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "pixel_capi_configs_pixel_id_key" ON "pixel_capi_configs"("pixel_id");

-- CreateIndex
CREATE INDEX "meta_custom_events_pixel_id_idx" ON "meta_custom_events"("pixel_id");

-- CreateIndex
CREATE UNIQUE INDEX "meta_custom_conversions_conversion_id_key" ON "meta_custom_conversions"("conversion_id");

-- CreateIndex
CREATE INDEX "meta_custom_conversions_pixel_id_idx" ON "meta_custom_conversions"("pixel_id");

-- CreateIndex
CREATE UNIQUE INDEX "meta_offline_uploads_upload_id_key" ON "meta_offline_uploads"("upload_id");

-- CreateIndex
CREATE INDEX "meta_offline_uploads_pixel_id_idx" ON "meta_offline_uploads"("pixel_id");

-- CreateIndex
CREATE INDEX "meta_offline_events_upload_id_idx" ON "meta_offline_events"("upload_id");

-- CreateIndex
CREATE INDEX "meta_offline_events_pixel_id_idx" ON "meta_offline_events"("pixel_id");

-- CreateIndex
CREATE INDEX "meta_test_events_pixel_id_idx" ON "meta_test_events"("pixel_id");

-- CreateIndex
CREATE INDEX "meta_diagnostics_pixel_id_status_idx" ON "meta_diagnostics"("pixel_id", "status");

-- CreateIndex
CREATE INDEX "meta_domain_verifications_pixel_id_idx" ON "meta_domain_verifications"("pixel_id");

-- CreateIndex
CREATE INDEX "meta_domain_verifications_ad_account_id_idx" ON "meta_domain_verifications"("ad_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "meta_domain_verifications_domain_ad_account_id_key" ON "meta_domain_verifications"("domain", "ad_account_id");

-- CreateIndex
CREATE INDEX "meta_partner_integrations_pixel_id_idx" ON "meta_partner_integrations"("pixel_id");

-- CreateIndex
CREATE UNIQUE INDEX "meta_partner_integrations_pixel_id_partner_name_key" ON "meta_partner_integrations"("pixel_id", "partner_name");

-- CreateIndex
CREATE UNIQUE INDEX "meta_signals_gateways_gateway_id_key" ON "meta_signals_gateways"("gateway_id");

-- CreateIndex
CREATE UNIQUE INDEX "meta_signals_gateways_pixel_id_key" ON "meta_signals_gateways"("pixel_id");

-- CreateIndex
CREATE UNIQUE INDEX "meta_privacy_settings_pixel_id_key" ON "meta_privacy_settings"("pixel_id");

-- CreateIndex
CREATE UNIQUE INDEX "meta_aem_configs_pixel_id_key" ON "meta_aem_configs"("pixel_id");

-- CreateIndex
CREATE INDEX "meta_event_dedups_pixel_id_idx" ON "meta_event_dedups"("pixel_id");

-- CreateIndex
CREATE UNIQUE INDEX "meta_event_dedups_pixel_id_event_id_key" ON "meta_event_dedups"("pixel_id", "event_id");

-- AddForeignKey
ALTER TABLE "meta_datasets" ADD CONSTRAINT "meta_datasets_ad_account_id_fkey" FOREIGN KEY ("ad_account_id") REFERENCES "meta_ad_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pixel_capi_configs" ADD CONSTRAINT "pixel_capi_configs_pixel_id_fkey" FOREIGN KEY ("pixel_id") REFERENCES "meta_pixels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_custom_events" ADD CONSTRAINT "meta_custom_events_pixel_id_fkey" FOREIGN KEY ("pixel_id") REFERENCES "meta_pixels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_custom_conversions" ADD CONSTRAINT "meta_custom_conversions_pixel_id_fkey" FOREIGN KEY ("pixel_id") REFERENCES "meta_pixels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_offline_uploads" ADD CONSTRAINT "meta_offline_uploads_pixel_id_fkey" FOREIGN KEY ("pixel_id") REFERENCES "meta_pixels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_offline_events" ADD CONSTRAINT "meta_offline_events_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "meta_offline_uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_test_events" ADD CONSTRAINT "meta_test_events_pixel_id_fkey" FOREIGN KEY ("pixel_id") REFERENCES "meta_pixels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_diagnostics" ADD CONSTRAINT "meta_diagnostics_pixel_id_fkey" FOREIGN KEY ("pixel_id") REFERENCES "meta_pixels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_domain_verifications" ADD CONSTRAINT "meta_domain_verifications_pixel_id_fkey" FOREIGN KEY ("pixel_id") REFERENCES "meta_pixels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_domain_verifications" ADD CONSTRAINT "meta_domain_verifications_ad_account_id_fkey" FOREIGN KEY ("ad_account_id") REFERENCES "meta_ad_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_partner_integrations" ADD CONSTRAINT "meta_partner_integrations_pixel_id_fkey" FOREIGN KEY ("pixel_id") REFERENCES "meta_pixels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_signals_gateways" ADD CONSTRAINT "meta_signals_gateways_pixel_id_fkey" FOREIGN KEY ("pixel_id") REFERENCES "meta_pixels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_privacy_settings" ADD CONSTRAINT "meta_privacy_settings_pixel_id_fkey" FOREIGN KEY ("pixel_id") REFERENCES "meta_pixels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_aem_configs" ADD CONSTRAINT "meta_aem_configs_pixel_id_fkey" FOREIGN KEY ("pixel_id") REFERENCES "meta_pixels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_event_dedups" ADD CONSTRAINT "meta_event_dedups_pixel_id_fkey" FOREIGN KEY ("pixel_id") REFERENCES "meta_pixels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
