-- CreateTable
CREATE TABLE "team_member_accounts" (
    "id" TEXT NOT NULL,
    "team_member_id" TEXT NOT NULL,
    "ad_account_id" TEXT NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_member_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_member_accounts_team_member_id_idx" ON "team_member_accounts"("team_member_id");

-- CreateIndex
CREATE INDEX "team_member_accounts_ad_account_id_idx" ON "team_member_accounts"("ad_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_member_accounts_team_member_id_ad_account_id_key" ON "team_member_accounts"("team_member_id", "ad_account_id");

-- AddForeignKey
ALTER TABLE "team_member_accounts" ADD CONSTRAINT "team_member_accounts_team_member_id_fkey" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member_accounts" ADD CONSTRAINT "team_member_accounts_ad_account_id_fkey" FOREIGN KEY ("ad_account_id") REFERENCES "meta_ad_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
