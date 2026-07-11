import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { prismaCampaignRepository } from "@/modules/campaigns/campaign.repository.prisma";
import { prismaAdSetRepository } from "@/modules/adsets/adset.repository.prisma";
import { prismaAdRepository } from "@/modules/ads/ad.repository.prisma";
import { prismaAdAccountRepository } from "@/modules/ad-accounts/ad-account.repository.prisma";
import { prismaPixelRepository } from "@/modules/events-manager/pixel.repository.prisma";
import { prismaDatasetRepository } from "@/modules/events-manager/dataset.repository.prisma";
import { prismaCustomConversionRepository } from "@/modules/events-manager/custom-conversion.repository.prisma";
import { prismaTeamRepository } from "@/modules/teams/team.repository.prisma";

// A UUID that owns nothing — queries must run and return empty (read-only, safe).
const NO_USER = "00000000-0000-0000-0000-000000000000";

afterAll(async () => {
  await (prisma as any).$disconnect();
});

describe("repositories (integration · live DB · read-only)", () => {
  it("campaigns.listForUser executes against the real schema", async () => {
    expect(await prismaCampaignRepository.listForUser(NO_USER, { limit: 5 })).toEqual([]);
  });
  it("adsets.listForUser executes", async () => {
    expect(await prismaAdSetRepository.listForUser(NO_USER, { limit: 5 })).toEqual([]);
  });
  it("ads.listForUser executes", async () => {
    expect(await prismaAdRepository.listForUser(NO_USER, { limit: 5 })).toEqual([]);
  });
  it("ad-accounts.listForUser executes", async () => {
    expect(await prismaAdAccountRepository.listForUser(NO_USER, { limit: 5 })).toEqual([]);
  });
  it("pixels.listForUser executes", async () => {
    expect(await prismaPixelRepository.listForUser(NO_USER, { limit: 5 })).toEqual([]);
  });
  it("datasets.listForUser executes", async () => {
    expect(await prismaDatasetRepository.listForUser(NO_USER, { limit: 5 })).toEqual([]);
  });
  it("custom-conversions.listForUser executes", async () => {
    expect(await prismaCustomConversionRepository.listForUser(NO_USER, { limit: 5 })).toEqual([]);
  });
  it("teams.listMembershipsForUser executes", async () => {
    expect(await prismaTeamRepository.listMembershipsForUser(NO_USER)).toEqual([]);
  });
});
