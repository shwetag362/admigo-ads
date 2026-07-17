// app/features/ads-manager/campaigns.api.ts
// Typed fetch layer for the ads-manager. Endpoints are verified against real
// data. Consumed by the TanStack Query hooks (useCampaigns).

export interface CampaignRow {
  id: string;
  name: string;
  status: string;
  effective_status?: string;
  objective?: string;
  [key: string]: unknown;
}

export interface ListCampaignsParams {
  accountId?: string;
  limit?: number;
  status?: string[];
  name?: string;
}

export interface CampaignsResult {
  data: CampaignRow[];
  total: number;
}

export async function fetchCampaigns(params: ListCampaignsParams): Promise<CampaignsResult> {
  const sp = new URLSearchParams();
  if (params.accountId) sp.set("accountId", params.accountId);
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.name) sp.set("name", params.name);
  (params.status ?? []).forEach((s) => sp.append("status", s));

  const res = await fetch(`/api/meta/campaigns?${sp.toString()}`);
  if (!res.ok) throw new Error(`Failed to load campaigns (${res.status})`);
  const json = await res.json();
  return { data: json.data ?? [], total: json.total ?? json.count ?? (json.data?.length ?? 0) };
}

export async function pauseCampaign(id: string) {
  const res = await fetch(`/api/meta/campaign/${id}/pause`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to pause campaign (${res.status})`);
  return res.json();
}

export async function publishCampaign(id: string) {
  const res = await fetch(`/api/meta/campaign/${id}/publish`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to publish campaign (${res.status})`);
  return res.json();
}

export async function bulkDeleteCampaigns(ids: string[]) {
  const res = await fetch(`/api/meta/campaigns/bulk-delete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ campaignIds: ids }),
  });
  if (!res.ok) throw new Error(`Failed to delete campaigns (${res.status})`);
  return res.json();
}
