// app/features/ads-manager/useCampaigns.ts
// TanStack Query hooks for campaigns — client caching + background revalidation +
// optimistic bulk mutations (onMutate → snapshot → rollback → invalidate).
// This is the drop-in replacement for the raw fetch/useState blocks in the
// 2,300-line CampaignsTable; wire it in once the UI can be visually verified.
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  bulkDeleteCampaigns,
  fetchCampaigns,
  pauseCampaign,
  publishCampaign,
  type CampaignsResult,
  type ListCampaignsParams,
} from "./campaigns.api";

const key = (params: ListCampaignsParams) => ["campaigns", params] as const;

export function useCampaigns(params: ListCampaignsParams) {
  return useQuery({
    queryKey: key(params),
    queryFn: () => fetchCampaigns(params),
    placeholderData: (prev) => prev, // smooth pagination (keep previous page while loading)
  });
}

/** Optimistic pause/publish/delete. Updates the cache immediately, rolls back on error. */
export function useCampaignActions(params: ListCampaignsParams) {
  const qc = useQueryClient();
  const qk = key(params);

  const patchStatus = (id: string, status: string) => {
    qc.setQueryData<CampaignsResult>(qk, (old) =>
      old
        ? {
            ...old,
            data: old.data.map((c) =>
              c.id === id ? { ...c, status, effective_status: status } : c,
            ),
          }
        : old,
    );
  };

  // Build (not call) mutation options so useMutation stays at the top level.
  const statusOptions = (status: string, verb: string, apiFn: (id: string) => Promise<unknown>) => ({
    mutationFn: apiFn,
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: qk });
      const prev = qc.getQueryData<CampaignsResult>(qk);
      patchStatus(id, status);
      return { prev };
    },
    onError: (_e: unknown, _id: string, ctx: { prev?: CampaignsResult } | undefined) => {
      if (ctx?.prev) qc.setQueryData(qk, ctx.prev);
      toast.error(`Failed to ${verb} campaign`);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk }),
  });

  const pause = useMutation(statusOptions("PAUSED", "pause", pauseCampaign));
  const publish = useMutation(statusOptions("ACTIVE", "publish", publishCampaign));

  const remove = useMutation({
    mutationFn: bulkDeleteCampaigns,
    onMutate: async (ids: string[]) => {
      await qc.cancelQueries({ queryKey: qk });
      const prev = qc.getQueryData<CampaignsResult>(qk);
      qc.setQueryData<CampaignsResult>(qk, (old) =>
        old ? { ...old, data: old.data.filter((c) => !ids.includes(c.id)) } : old,
      );
      return { prev };
    },
    onError: (_e, _ids, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk, ctx.prev);
      toast.error("Failed to delete campaigns");
    },
    onSuccess: () => toast.success("Campaigns deleted"),
    onSettled: () => qc.invalidateQueries({ queryKey: qk }),
  });

  return { pause, publish, remove };
}
