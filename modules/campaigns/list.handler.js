// app/api/campaign/list/route.js

import { FacebookAdsApi, AdAccount, Campaign, AdCreative } from "facebook-nodejs-business-sdk";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { parse } from "json2csv";

const log = {
  start: (msg) => console.log(`\nSTART → ${msg}`),
  info: (msg) => console.log(`INFO → ${msg}`),
  success: (msg) => console.log(`SUCCESS → ${msg}`),
  error: (msg, err) => {
    console.error(`ERROR → ${msg}`);
    if (err) console.error(err);
  },
};

const CAMPAIGN_FIELDS = "id,name,status,effective_status,objective,start_time,stop_time,daily_budget,lifetime_budget,lifetime_spend_cap,budget_remaining,account_id,adlabels,buying_type,special_ad_categories,special_ad_categories_category,can_use_spend_cap,configured_status,created_time,updated_time,is_skadnetwork_attribution,boosted_object_id,brand_safety_score";

const ADSET_FIELDS = "id,name,status,effective_status,campaign_id,account_id,optimization_goal,optimization_sub_event,bid_strategy,bid_amount,billing_event,daily_budget,lifetime_budget,budget_remaining,start_time,end_time,created_time,updated_time,adlabels,attribution_spec,promoted_object,targeting{age_min,age_max,genders,geo_locations,flexible_spec,publisher_platforms,facebook_positions,instagram_positions,device_platforms,college_years,education_majors,education_schools,interests,behaviors},daily_imps_cap,lifetime_imps_cap,is_dynamic_creative,rf_prediction_id,regional_regulated_categories";

const AD_FIELDS = "id,name,status,effective_status,created_time,updated_time,adset_id,campaign_id,account_id,creative{id,name,title,body,thumbnail_url,image_url,link_url,call_to_action_type}";

const INSIGHT_FIELDS = "spend,impressions,reach,frequency,clicks,inline_link_clicks,ctr,cpm,cpc,cpp,actions,action_values,cost_per_action_type,cost_per_conversion,conversions,conversion_values,cost_per_inline_link_click,outbound_clicks,unique_clicks,unique_ctr,website_ctr,objective,date_start,date_stop";

export async function GET(request) {
  log.start("GET /api/campaign/list - DB-FIRST + FULL SYNC");

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const accountIdParam = searchParams.get("accountId");
  const statusFilter = searchParams.getAll("status");
  const nameFilter = searchParams.get("name") || "";
  const includeInsights = searchParams.get("include_insights") !== "false";
  const exportCsv = searchParams.get("export") === "csv";
  const forceSync = searchParams.get("sync") === "true";

  let selectedAccountId = null;
  if (accountIdParam) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(accountIdParam)) {
      return NextResponse.json({ error: "Invalid accountId format" }, { status: 400 });
    }
    selectedAccountId = accountIdParam;
  }

  try {
    // === DB-FIRST: Read from database ===
    let dbCampaigns = await prisma.metaCampaign.findMany({
      where: {
        userId: session.user.id,
        ...(selectedAccountId && { accountId: selectedAccountId }),
        ...(statusFilter.length > 0 && { effectiveStatus: { in: statusFilter } }),
        ...(nameFilter && { name: { contains: nameFilter, mode: "insensitive" } }),
      },
      include: {
        adSets: {
          include: { ads: true },
          take: limit,
        },
        account: { select: { id: true, name: true } },
      },
      take: limit,
      orderBy: { updatedTime: "desc" },
    });

    if (dbCampaigns.length > 0 && !forceSync) {
      log.info(`Returning ${dbCampaigns.length} campaigns from database`);

      // Convert DB camelCase → API snake_case format
      const formatted = dbCampaigns.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        effective_status: c.effectiveStatus,
        objective: c.objective,
        start_time: c.startTime?.toISOString() || null,
        stop_time: c.stopTime?.toISOString() || null,
        daily_budget: c.dailyBudget,
        lifetime_budget: c.lifetimeBudget,
        budget_remaining: c.budgetRemaining,
        account_id: c.accountIdMeta,
        buying_type: c.buyingType,
        special_ad_categories: c.specialAdCategories,
        special_ad_categories_category: c.specialAdCategoriesCategory,
        can_use_spend_cap: c.canUseSpendCap,
        configured_status: c.configuredStatus,
        created_time: c.createdTime.toISOString(),
        updated_time: c.updatedTime.toISOString(),
        is_skadnetwork_attribution: c.isSkadnetworkAttribution,
        boosted_object_id: c.boostedObjectId,
        brand_safety_score: c.brandSafetyScore,
        insights: c.insights || {},
        adSets: c.adSets.map(as => ({
          id: as.id,
          name: as.name,
          status: as.status,
          effective_status: as.effectiveStatus,
          campaign_id: as.campaignId,
          account_id: as.accountIdMeta,
          optimization_goal: as.optimizationGoal,
          optimization_sub_event: as.optimizationSubEvent,
          bid_strategy: as.bidStrategy,
          bid_amount: as.bidAmount,
          billing_event: as.billingEvent,
          daily_budget: as.dailyBudget,
          lifetime_budget: as.lifetimeBudget,
          budget_remaining: as.budgetRemaining,
          start_time: as.startTime?.toISOString() || null,
          end_time: as.endTime?.toISOString() || null,
          created_time: as.createdTime.toISOString(),
          updated_time: as.updatedTime.toISOString(),
          attribution_spec: as.attributionSpec,
          promoted_object: as.promotedObject,
          targeting: as.targeting,
          is_dynamic_creative: as.isDynamicCreative,
          insights: as.insights || {},
          ads: as.ads.map(ad => ({
            id: ad.id,
            name: ad.name,
            status: ad.status,
            effective_status: ad.effectiveStatus,
            created_time: ad.createdTime.toISOString(),
            updated_time: ad.updatedTime.toISOString(),
            adset_id: ad.adSetId,
            campaign_id: ad.campaignId,
            account_id: ad.accountIdMeta || ad.accountId,
            creative: ad.creative || {},
            previews: ad.previews || { reels: null, feed: null },
            insights: ad.insights || {},
          })),
        })),
        adAccount: { id: c.account.id, name: c.account.name },
      }));

      if (exportCsv) {
              const flatData = allCampaigns.flatMap(c =>
        c.adSets.flatMap(as =>
          as.ads.map(ad => ({
            campaign_name: c.name,
            campaign_status: c.effective_status,
            adset_name: as.name,
            ad_name: ad.name,
            spend: c.insights.spend || as.insights.spend || ad.insights.spend || 0,
            impressions: c.insights.impressions || as.insights.impressions || ad.insights.impressions || 0,
            clicks: c.insights.clicks || as.insights.clicks || ad.insights.clicks || 0,
          }))
        )
      );
        const csv = parse(flatData);
        return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=campaigns.csv" } });
      }

      return NextResponse.json({
        success: true,
        count: formatted.length,
        campaigns: formatted,
        source: "database",
      });
    }

    // === SYNC: Fetch from Meta and save ALL fields ===
    log.info("Syncing fresh data from Meta API");

    const whereClause = { userId: session.user.id };
    if (selectedAccountId) whereClause.id = selectedAccountId;

    const adAccounts = await prisma.metaAdAccount.findMany({
      where: whereClause,
      select: { id: true, metaAccountId: true, accessToken: true, name: true },
    });

    if (adAccounts.length === 0) {
      return NextResponse.json({ campaigns: [], message: "No linked accounts" });
    }

    const allCampaigns = [];

    for (const account of adAccounts) {
      if (!account.accessToken) continue;

      try {
        FacebookAdsApi.init(account.accessToken);
        const fbAccount = new AdAccount(account.metaAccountId);

        const campaignsResponse = await fbAccount.getCampaigns([], { fields: CAMPAIGN_FIELDS, limit });
        const campaigns = campaignsResponse.map(c => c._data);

        for (const campaignData of campaigns) {
          const campaignId = campaignData.id;

          let campaignInsights = {};
          if (includeInsights) {
            try {
              const insights = await new Campaign(campaignId).getInsights([], { fields: INSIGHT_FIELDS });
              campaignInsights = insights[0]?._data || {};
            } catch {}
          }

          let adSets = [];
          try {
            const rawAdSets = await new Campaign(campaignId).getAdSets([], { fields: ADSET_FIELDS, limit });

            for (const adSet of rawAdSets) {
              const adSetData = adSet._data;

              let adSetInsights = {};
              if (includeInsights) {
                try {
                  const insights = await adSet.getInsights([], { fields: INSIGHT_FIELDS });
                  adSetInsights = insights[0]?._data || {};
                } catch {}
              }

              let ads = [];
              try {
                const rawAds = await adSet.getAds([], { fields: AD_FIELDS });

                for (const adObj of rawAds) {
                  const adData = adObj._data;

                  let adInsights = {};
                  if (includeInsights) {
                    try {
                      const insights = await adObj.getInsights([], { fields: INSIGHT_FIELDS });
                      adInsights = insights[0]?._data || {};
                    } catch {}
                  }

                  let previews = { reels: null, feed: null };
                  if (adData.creative?.id) {
                    try {
                      const creative = new AdCreative(adData.creative.id);
                      try {
                        const reels = await creative.getPreviews(["body"], { ad_format: "FACEBOOK_REELS_MOBILE", limit: 1 });
                        if (reels.length > 0) previews.reels = reels[0]._data.body;
                      } catch {}
                      if (!previews.reels) {
                        try {
                          const feed = await creative.getPreviews(["body"], { ad_format: "MOBILE_FEED_STANDARD", limit: 1 });
                          if (feed.length > 0) previews.feed = feed[0]._data.body;
                        } catch {}
                      }
                    } catch {}
                  }

                  ads.push({
                    ...adData,
                    insights: adInsights,
                    creative: adData.creative || {},
                    previews,
                  });
                }
              } catch {}

              adSets.push({ ...adSetData, insights: adSetInsights, ads });
            }
          } catch {}

          // === SAVE EVERYTHING TO DB ===
          try {
            await prisma.$transaction(async (tx) => {
              await tx.metaCampaign.upsert({
                where: { id_accountId: { id: campaignId, accountId: account.id } },
                update: {
                  name: campaignData.name,
                  status: campaignData.status,
                  effectiveStatus: campaignData.effective_status,
                  objective: campaignData.objective,
                  startTime: campaignData.start_time ? new Date(campaignData.start_time) : null,
                  stopTime: campaignData.stop_time ? new Date(campaignData.stop_time) : null,
                  dailyBudget: campaignData.daily_budget,
                  lifetimeBudget: campaignData.lifetime_budget,
                  budgetRemaining: campaignData.budget_remaining,
                  accountIdMeta: campaignData.account_id,
                  buyingType: campaignData.buying_type,
                  specialAdCategories: campaignData.special_ad_categories || [],
                  specialAdCategoriesCategory: campaignData.special_ad_categories_category,
                  canUseSpendCap: campaignData.can_use_spend_cap,
                  configuredStatus: campaignData.configured_status,
                  isSkadnetworkAttribution: campaignData.is_skadnetwork_attribution,
                  boostedObjectId: campaignData.boosted_object_id,
                  brandSafetyScore: campaignData.brand_safety_score,
                  createdTime: new Date(campaignData.created_time),
                  updatedTime: new Date(campaignData.updated_time),
                  insights: campaignInsights,
                },
                create: {
                  id: campaignId,
                  userId: session.user.id,
                  accountId: account.id,
                  name: campaignData.name,
                  status: campaignData.status,
                  effectiveStatus: campaignData.effective_status,
                  objective: campaignData.objective,
                  startTime: campaignData.start_time ? new Date(campaignData.start_time) : null,
                  stopTime: campaignData.stop_time ? new Date(campaignData.stop_time) : null,
                  dailyBudget: campaignData.daily_budget,
                  lifetimeBudget: campaignData.lifetime_budget,
                  budgetRemaining: campaignData.budget_remaining,
                  accountIdMeta: campaignData.account_id,
                  buyingType: campaignData.buying_type,
                  specialAdCategories: campaignData.special_ad_categories || [],
                  specialAdCategoriesCategory: campaignData.special_ad_categories_category,
                  canUseSpendCap: campaignData.can_use_spend_cap,
                  configuredStatus: campaignData.configured_status,
                  isSkadnetworkAttribution: campaignData.is_skadnetwork_attribution,
                  boostedObjectId: campaignData.boosted_object_id,
                  brandSafetyScore: campaignData.brand_safety_score,
                  createdTime: new Date(campaignData.created_time),
                  updatedTime: new Date(campaignData.updated_time),
                  insights: campaignInsights,
                },
              });

              for (const adSet of adSets) {
                await tx.metaAdSet.upsert({
                  where: { id_accountId: { id: adSet.id, accountId: account.id } },
                  update: {
                    name: adSet.name,
                    status: adSet.status,
                    effectiveStatus: adSet.effective_status,
                    dailyBudget: adSet.daily_budget,
                    lifetimeBudget: adSet.lifetime_budget,
                    budgetRemaining: adSet.budget_remaining,
                    accountIdMeta: adSet.account_id,
                    bidStrategy: adSet.bid_strategy,
                    bidAmount: adSet.bid_amount ? String(adSet.bid_amount) : null,
                    billingEvent: adSet.billing_event,
                    optimizationSubEvent: adSet.optimization_sub_event,
                    attributionSpec: adSet.attribution_spec,
                    promotedObject: adSet.promoted_object,
                    isDynamicCreative: adSet.is_dynamic_creative,
                    rfPredictionId: adSet.rf_prediction_id,
                    regionalRegulatedCategories: adSet.regional_regulated_categories,
                    startTime: adSet.start_time ? new Date(adSet.start_time) : null,
                    endTime: adSet.end_time ? new Date(adSet.end_time) : null,
                    createdTime: new Date(adSet.created_time),
                    updatedTime: new Date(adSet.updated_time),
                    targeting: adSet.targeting,
                    insights: adSet.insights,
                  },
                  create: {
                    id: adSet.id,
                    campaignId,
                    accountId: account.id,
                    name: adSet.name,
                    status: adSet.status,
                    effectiveStatus: adSet.effective_status,
                    dailyBudget: adSet.daily_budget,
                    lifetimeBudget: adSet.lifetime_budget,
                    budgetRemaining: adSet.budget_remaining,
                    accountIdMeta: adSet.account_id,
                    bidStrategy: adSet.bid_strategy,
                    bidAmount: adSet.bid_amount ? String(adSet.bid_amount) : null,
                    billingEvent: adSet.billing_event,
                    optimizationSubEvent: adSet.optimization_sub_event,
                    attributionSpec: adSet.attribution_spec,
                    promotedObject: adSet.promoted_object,
                    isDynamicCreative: adSet.is_dynamic_creative,
                    rfPredictionId: adSet.rf_prediction_id,
                    regionalRegulatedCategories: adSet.regional_regulated_categories,
                    startTime: adSet.start_time ? new Date(adSet.start_time) : null,
                    endTime: adSet.end_time ? new Date(adSet.end_time) : null,
                    createdTime: new Date(adSet.created_time),
                    updatedTime: new Date(adSet.updated_time),
                    targeting: adSet.targeting,
                    insights: adSet.insights,
                  },
                });

                for (const ad of adSet.ads) {
                  await tx.metaAd.upsert({
                    where: { id_accountId: { id: ad.id, accountId: account.id } },
                    update: {
                      name: ad.name,
                      status: ad.status,
                      effectiveStatus: ad.effective_status,
                      createdTime: new Date(ad.created_time),
                      updatedTime: new Date(ad.updated_time),
                      creative: ad.creative,
                      previews: ad.previews,
                      insights: ad.insights,
                    },
                    create: {
                      id: ad.id,
                      adSetId: adSet.id,
                      campaignId,
                      accountId: account.id,
                      name: ad.name,
                      status: ad.status,
                      effectiveStatus: ad.effective_status,
                      createdTime: new Date(ad.created_time),
                      updatedTime: new Date(ad.updated_time),
                      creative: ad.creative,
                      previews: ad.previews,
                      insights: ad.insights,
                    },
                  });
                }
              }
            });

            log.success(`Saved full campaign data for ${campaignData.name}`);
          } catch (dbErr) {
            log.error("Failed to save to DB", dbErr);
          }

          allCampaigns.push({
            ...campaignData,
            insights: campaignInsights,
            adSets,
            adAccount: { id: account.id, name: account.name },
          });
        }
      } catch (err) {
        log.error(`Failed for account ${account.name}`, err);
      }
    }

    if (exportCsv) {
      // use allCampaigns (fresh data)
      const flatData = allCampaigns.flatMap(c => c.adSets.flatMap(as => as.ads.map(ad => ({ /* same */ }))));
      const csv = parse(flatData);
      return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=campaigns.csv" } });
    }

    return NextResponse.json({
      success: true,
      count: allCampaigns.length,
      campaigns: allCampaigns,
      source: "meta_api (fully synced)",
    });
  } catch (error) {
    log.error("Critical error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}