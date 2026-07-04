// prisma/seed.js
// ─────────────────────────────────────────────────────────────────────────────
// Seed Script — Users, OAuthAccounts, FacebookAccounts, MetaAdAccounts
// Run with: npx prisma db seed
// Safe to run multiple times — uses upsert (skip existing records)
// ─────────────────────────────────────────────────────────────────────────────

// const { PrismaClient } = require("@prisma/client");

// const prisma = new PrismaClient();

// prisma/seed.js
// prisma/seed.js
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log("🌱 Starting database seed...\n");

  // ─── STEP 1: USER ───────────────────────────────────────────────────────────
  console.log("👤 Seeding users...");

  const user = await prisma.user.upsert({
    where: { id: "1edc6838-e5d8-4fe3-b9f2-bdb882331eeb" },
    update: {}, // Skip update if already exists
    create: {
      id:            "1edc6838-e5d8-4fe3-b9f2-bdb882331eeb",
      email:         "adarsh@gmail.com",
      passwordHash:  "$2b$12$TiavSF1r.1Fut9Tzp3mFROUvldKWbjYdT0QTy0S18/0B9wQDb5sSi",
      name:          "Adarsh Yadav",
      avatarUrl:     "https://platform-lookaside.fbsbx.com/platform/profilepic/?asid=122093641389273878&height=50&width=50&ext=1773999523&hash=AT--ruktBKa-AC6cx0cCS-Rm",
      emailVerified: false,
      createdAt:     new Date("2026-02-13T05:38:16.269Z"),
      updatedAt:     new Date("2026-02-18T09:38:44.319Z"),
    },
  });

  console.log(`   ✅ User: ${user.email} (${user.id})`);

  // ─── STEP 2: OAUTH ACCOUNTS ─────────────────────────────────────────────────
  console.log("\n🔑 Seeding OAuth accounts...");

  const oauthData = [
    {
      id:                "e62f46dc-d9bf-49c2-a160-d67d9daeb885",
      userId:            "1edc6838-e5d8-4fe3-b9f2-bdb882331eeb",
      provider:          "facebook",
      providerAccountId: "761255647038086",
      accessToken:       "EAAL2T8oOhpkBQliRvyMZCQQJWSCNdK3j0VybWv3Vv0NJg9prCzXqZBbX4SrPuRTEtgb1tbGDF1WTaQjnUak9ScqOKrFm6n3c7NXZCXZBRM8f7FsMB6fLwzA0SBfX6urCgY9kOpEJDTJ4kPZBZCd4GI6Ybcx7XYiPeWPt3SxO08jQIXLZAvD2PmGR3ivHMvk",
      refreshToken:      null,
      expiresAt:         new Date("2026-04-14T06:35:07.021Z"),
      createdAt:         new Date("2026-02-13T06:35:07.659Z"),
      updatedAt:         new Date("2026-02-13T06:35:07.659Z"),
    },
    {
      id:                "43dbb720-2a4e-42f3-9ff3-d513cf1ac203",
      userId:            "1edc6838-e5d8-4fe3-b9f2-bdb882331eeb",
      provider:          "facebook",
      providerAccountId: "122145103556974001",
      accessToken:       "EAAL2T8oOhpkBQuEBCn6ZA5yXvL8PTMPASkFitSZCbZC5KULOAbx93dFLhqViaY92ekPHvHFHpIh8SL4X2ZBxDnZBJLMCll2ZBh6ZAKsYv238XvmUGvOjDk28VqeVXpw5WWLRrxUZCUhdUboCenZBNO0barhpQXto4i06vbZAbJvhfgxbKPIob6zpxfaaFmp0ZB7",
      refreshToken:      null,
      expiresAt:         new Date("2026-04-14T10:30:38.870Z"),
      createdAt:         new Date("2026-02-13T05:47:58.200Z"),
      updatedAt:         new Date("2026-02-13T10:30:40.341Z"),
    },
    {
      id:                "df1fea1e-7e69-423a-8c41-1862b72a2d3e",
      userId:            "1edc6838-e5d8-4fe3-b9f2-bdb882331eeb",
      provider:          "facebook",
      providerAccountId: "122093641389273878",
      accessToken:       "EAAL2T8oOhpkBQrKotTEKq8yIayuAS08KUvzb1bqb8rTEfgBlT23GKLZCCCSm3UazKElIf5wkSBMGoYHyEfZBZBUZAyiB0ZAxu9trpTVqjAZBLOwvldHhqJNzK6eZAEAd0gGZAVXbQatUt95HpFZBNICBZBF6gEmH47bSDxKx3qR6X0pk1ZAkxnLuxmELrjaKgKE",
      refreshToken:      null,
      expiresAt:         new Date("2026-04-19T09:38:43.469Z"),
      createdAt:         new Date("2026-02-13T05:39:24.608Z"),
      updatedAt:         new Date("2026-02-18T09:38:44.249Z"),
    },
  ];

  for (const oauth of oauthData) {
    const record = await prisma.oAuthAccount.upsert({
      where: {
        provider_providerAccountId: {
          provider:          oauth.provider,
          providerAccountId: oauth.providerAccountId,
        },
      },
      update: {}, // Skip update if already exists
      create: {
        id:                oauth.id,
        userId:            oauth.userId,
        provider:          oauth.provider,
        providerAccountId: oauth.providerAccountId,
        accessToken:       oauth.accessToken,
        refreshToken:      oauth.refreshToken,
        expiresAt:         oauth.expiresAt,
        createdAt:         oauth.createdAt,
        updatedAt:         oauth.updatedAt,
      },
    });
    console.log(`   ✅ OAuthAccount: ${record.provider} / ${record.providerAccountId}`);
  }

  // ─── STEP 3: FACEBOOK ACCOUNTS ──────────────────────────────────────────────
  console.log("\n📘 Seeding Facebook accounts...");

  const facebookData = [
    {
      id:               "683c7c21-a6d1-4ba4-b3d7-a05f571f7f5a",
      userId:           "1edc6838-e5d8-4fe3-b9f2-bdb882331eeb",
      facebookUserId:   "122145103556974001",
      facebookUserName: "Raunak Sharma",
      accessToken:      "EAAL2T8oOhpkBQuEBCn6ZA5yXvL8PTMPASkFitSZCbZC5KULOAbx93dFLhqViaY92ekPHvHFHpIh8SL4X2ZBxDnZBJLMCll2ZBh6ZAKsYv238XvmUGvOjDk28VqeVXpw5WWLRrxUZCUhdUboCenZBNO0barhpQXto4i06vbZAbJvhfgxbKPIob6zpxfaaFmp0ZB7",
      refreshToken:     null,
      tokenExpiresAt:   new Date("2026-04-14T10:30:38.870Z"),
      isActive:         true,
      isPrimary:        false,
      createdAt:        new Date("2026-02-13T05:47:58.194Z"),
      updatedAt:        new Date("2026-02-16T09:59:09.483Z"),
    },
    {
      id:               "6ab18f47-0326-461e-ba1b-cf89c98f2f1e",
      userId:           "1edc6838-e5d8-4fe3-b9f2-bdb882331eeb",
      facebookUserId:   "761255647038086",
      facebookUserName: "Shweta Gupta",
      accessToken:      "EAAL2T8oOhpkBQliRvyMZCQQJWSCNdK3j0VybWv3Vv0NJg9prCzXqZBbX4SrPuRTEtgb1tbGDF1WTaQjnUak9ScqOKrFm6n3c7NXZCXZBRM8f7FsMB6fLwzA0SBfX6urCgY9kOpEJDTJ4kPZBZCd4GI6Ybcx7XYiPeWPt3SxO08jQIXLZAvD2PmGR3ivHMvk",
      refreshToken:     null,
      tokenExpiresAt:   new Date("2026-04-14T06:35:07.021Z"),
      isActive:         true,
      isPrimary:        true,
      createdAt:        new Date("2026-02-13T06:35:07.652Z"),
      updatedAt:        new Date("2026-02-16T09:59:09.486Z"),
    },
    {
      id:               "addbf7ee-346b-4faf-a82e-4c5b57d5c709",
      userId:           "1edc6838-e5d8-4fe3-b9f2-bdb882331eeb",
      facebookUserId:   "122093641389273878",
      facebookUserName: "Adarsh Yadav",
      accessToken:      "EAAL2T8oOhpkBQrKotTEKq8yIayuAS08KUvzb1bqb8rTEfgBlT23GKLZCCCSm3UazKElIf5wkSBMGoYHyEfZBZBUZAyiB0ZAxu9trpTVqjAZBLOwvldHhqJNzK6eZAEAd0gGZAVXbQatUt95HpFZBNICBZBF6gEmH47bSDxKx3qR6X0pk1ZAkxnLuxmELrjaKgKE",
      refreshToken:     null,
      tokenExpiresAt:   new Date("2026-04-19T09:38:43.469Z"),
      isActive:         true,
      isPrimary:        false,
      createdAt:        new Date("2026-02-13T05:39:24.592Z"),
      updatedAt:        new Date("2026-02-18T09:38:44.339Z"),
    },
  ];

  for (const fb of facebookData) {
    const record = await prisma.facebookAccount.upsert({
      where: {
        userId_facebookUserId: {
          userId:         fb.userId,
          facebookUserId: fb.facebookUserId,
        },
      },
      update: {}, // Skip update if already exists
      create: {
        id:               fb.id,
        userId:           fb.userId,
        facebookUserId:   fb.facebookUserId,
        facebookUserName: fb.facebookUserName,
        accessToken:      fb.accessToken,
        refreshToken:     fb.refreshToken,
        tokenExpiresAt:   fb.tokenExpiresAt,
        isActive:         fb.isActive,
        isPrimary:        fb.isPrimary,
        createdAt:        fb.createdAt,
        updatedAt:        fb.updatedAt,
      },
    });
    console.log(`   ✅ FacebookAccount: ${record.facebookUserName} (${record.facebookUserId})`);
  }

  // ─── STEP 4: META AD ACCOUNTS ───────────────────────────────────────────────
  console.log("\n📊 Seeding Meta ad accounts...");

  const metaAdAccountData = [
    {
      id:                "0c72e381-cc8d-4246-a74e-3c641e180cc8",
      userId:            "1edc6838-e5d8-4fe3-b9f2-bdb882331eeb",
      facebookAccountId: "addbf7ee-346b-4faf-a82e-4c5b57d5c709",
      metaAccountId:     "act_33663117333335916",
      name:              "Adarsh Yadav",
      currency:          "INR",
      timezone:          "Asia/Kolkata",
      businessName:      null,
      accessToken:       "EAAL2T8oOhpkBQrKotTEKq8yIayuAS08KUvzb1bqb8rTEfgBlT23GKLZCCCSm3UazKElIf5wkSBMGoYHyEfZBZBUZAyiB0ZAxu9trpTVqjAZBLOwvldHhqJNzK6eZAEAd0gGZAVXbQatUt95HpFZBNICBZBF6gEmH47bSDxKx3qR6X0pk1ZAkxnLuxmELrjaKgKE",
      createdAt:         new Date("2026-02-13T05:39:24.665Z"),
      updatedAt:         new Date("2026-02-18T09:38:44.353Z"),
    },
    {
      id:                "e76f4a2c-4563-42a6-a7fd-0a21c1715d33",
      userId:            "1edc6838-e5d8-4fe3-b9f2-bdb882331eeb",
      facebookAccountId: "addbf7ee-346b-4faf-a82e-4c5b57d5c709",
      metaAccountId:     "act_2759851764383352",
      name:              "Sunny Ad's",
      currency:          "INR",
      timezone:          "Asia/Kolkata",
      businessName:      "Adarsh Yadav",
      accessToken:       "EAAL2T8oOhpkBQrKotTEKq8yIayuAS08KUvzb1bqb8rTEfgBlT23GKLZCCCSm3UazKElIf5wkSBMGoYHyEfZBZBUZAyiB0ZAxu9trpTVqjAZBLOwvldHhqJNzK6eZAEAd0gGZAVXbQatUt95HpFZBNICBZBF6gEmH47bSDxKx3qR6X0pk1ZAkxnLuxmELrjaKgKE",
      createdAt:         new Date("2026-02-13T05:39:24.675Z"),
      updatedAt:         new Date("2026-02-18T09:38:44.421Z"),
    },
    {
      id:                "397fea7c-923a-40f1-9506-d29b62213c68",
      userId:            "1edc6838-e5d8-4fe3-b9f2-bdb882331eeb",
      facebookAccountId: "683c7c21-a6d1-4ba4-b3d7-a05f571f7f5a",
      metaAccountId:     "act_2205948749832531",
      name:              "Raunak Sharma",
      currency:          "INR",
      timezone:          "Asia/Calcutta",
      businessName:      null,
      accessToken:       "EAAL2T8oOhpkBQuEBCn6ZA5yXvL8PTMPASkFitSZCbZC5KULOAbx93dFLhqViaY92ekPHvHFHpIh8SL4X2ZBxDnZBJLMCll2ZBh6ZAKsYv238XvmUGvOjDk28VqeVXpw5WWLRrxUZCUhdUboCenZBNO0barhpQXto4i06vbZAbJvhfgxbKPIob6zpxfaaFmp0ZB7",
      createdAt:         new Date("2026-02-13T05:47:58.206Z"),
      updatedAt:         new Date("2026-02-13T10:30:40.844Z"),
    },
    {
      id:                "7245d505-6ea3-4802-98ba-6736bf95485b",
      userId:            "1edc6838-e5d8-4fe3-b9f2-bdb882331eeb",
      facebookAccountId: "683c7c21-a6d1-4ba4-b3d7-a05f571f7f5a",
      metaAccountId:     "act_1498484404786530",
      name:              "perfect",
      currency:          "INR",
      timezone:          "Asia/Kolkata",
      businessName:      "Chat Realfam",
      accessToken:       "EAAL2T8oOhpkBQuEBCn6ZA5yXvL8PTMPASkFitSZCbZC5KULOAbx93dFLhqViaY92ekPHvHFHpIh8SL4X2ZBxDnZBJLMCll2ZBh6ZAKsYv238XvmUGvOjDk28VqeVXpw5WWLRrxUZCUhdUboCenZBNO0barhpQXto4i06vbZAbJvhfgxbKPIob6zpxfaaFmp0ZB7",
      createdAt:         new Date("2026-02-13T05:47:58.210Z"),
      updatedAt:         new Date("2026-02-13T10:30:40.940Z"),
    },
    {
      id:                "2a24f223-618e-493a-86fe-1f6b0611ff97",
      userId:            "1edc6838-e5d8-4fe3-b9f2-bdb882331eeb",
      facebookAccountId: "6ab18f47-0326-461e-ba1b-cf89c98f2f1e",
      metaAccountId:     "act_1313752672553991",
      name:              "Shweta Gupta",
      currency:          "INR",
      timezone:          "Asia/Kolkata",
      businessName:      null,
      accessToken:       "EAAL2T8oOhpkBQliRvyMZCQQJWSCNdK3j0VybWv3Vv0NJg9prCzXqZBbX4SrPuRTEtgb1tbGDF1WTaQjnUak9ScqOKrFm6n3c7NXZCXZBRM8f7FsMB6fLwzA0SBfX6urCgY9kOpEJDTJ4kPZBZCd4GI6Ybcx7XYiPeWPt3SxO08jQIXLZAvD2PmGR3ivHMvk",
      createdAt:         new Date("2026-02-13T06:35:07.663Z"),
      updatedAt:         new Date("2026-02-13T06:35:07.663Z"),
    },
    {
      id:                "f4630275-4179-42b9-a4cb-74c3995b71de",
      userId:            "1edc6838-e5d8-4fe3-b9f2-bdb882331eeb",
      facebookAccountId: "6ab18f47-0326-461e-ba1b-cf89c98f2f1e",
      metaAccountId:     "act_1780119226712528",
      name:              "Marcadeo Ads",
      currency:          "INR",
      timezone:          "Asia/Calcutta",
      businessName:      "Marcadeo Media pvt ltd",
      accessToken:       "EAAL2T8oOhpkBQliRvyMZCQQJWSCNdK3j0VybWv3Vv0NJg9prCzXqZBbX4SrPuRTEtgb1tbGDF1WTaQjnUak9ScqOKrFm6n3c7NXZCXZBRM8f7FsMB6fLwzA0SBfX6urCgY9kOpEJDTJ4kPZBZCd4GI6Ybcx7XYiPeWPt3SxO08jQIXLZAvD2PmGR3ivHMvk",
      createdAt:         new Date("2026-02-13T06:35:07.668Z"),
      updatedAt:         new Date("2026-02-13T06:35:07.668Z"),
    },
  ];

  for (const account of metaAdAccountData) {
    const record = await prisma.metaAdAccount.upsert({
      where: { metaAccountId: account.metaAccountId },
      update: {}, // Skip update if already exists
      create: {
        id:                 account.id,
        userId:             account.userId,
        facebookAccountId:  account.facebookAccountId,
        metaAccountId:      account.metaAccountId,
        name:               account.name,
        currency:           account.currency,
        timezone:           account.timezone,
        businessName:       account.businessName,
        accessToken:        account.accessToken,
        createdAt:          account.createdAt,
        updatedAt:          account.updatedAt,
        lastCampaignSyncAt: null,
        lastAdsetSyncAt:    null,
        // v3.0.0 fields — synced from Meta API later
        accountStatus:      null,
        accountSpendCap:    null,
        amountSpent:        null,
      },
    });
    console.log(`   ✅ MetaAdAccount: ${record.name} (${record.metaAccountId})`);
  }

  // ─── SUMMARY ────────────────────────────────────────────────────────────────
  console.log("\n─────────────────────────────────────────");
  console.log("✅ Seed completed successfully!");
  console.log("   • 1  User");
  console.log("   • 3  OAuthAccounts");
  console.log("   • 3  FacebookAccounts");
  console.log("   • 6  MetaAdAccounts");
  console.log("─────────────────────────────────────────\n");
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });