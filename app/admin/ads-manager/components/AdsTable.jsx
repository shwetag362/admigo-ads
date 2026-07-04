import React, { useMemo, useState, useEffect } from "react";
import {
  MaterialReactTable,
  useMaterialReactTable,
} from "material-react-table";
import { useSidebar } from "@/components/ui/sidebar";
import { Box, Typography, Button, Card, Switch, Chip } from "@mui/material";
import Image from "next/image";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";

import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import { IconButton, Tooltip } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditIcon from "@mui/icons-material/Edit";
import BarChartIcon from "@mui/icons-material/BarChart";
import { useRouter } from "next/navigation";

// ─── Sync Status Indicator ────────────────────────────────────────────────────
function SyncIndicator({ status, lastSyncedAt }) {
  const formatTime = (date) => {
    if (!date) return "";
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  if (status === "syncing") {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          px: 1.25,
          py: 0.5,
          borderRadius: "6px",
          backgroundColor: "#EEF2FF",
          border: "1px solid #C7D2FE",
          height: 32,
        }}
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: "#6366F1",
            flexShrink: 0,
            "@keyframes syncPulse": {
              "0%, 100%": { opacity: 1, transform: "scale(1)" },
              "50%": { opacity: 0.4, transform: "scale(0.75)" },
            },
            animation: "syncPulse 1s ease-in-out infinite",
          }}
        />
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            border: "2px solid #C7D2FE",
            borderTopColor: "#6366F1",
            flexShrink: 0,
            "@keyframes spin": {
              "0%": { transform: "rotate(0deg)" },
              "100%": { transform: "rotate(360deg)" },
            },
            animation: "spin 0.7s linear infinite",
          }}
        />
        <Typography
          sx={{
            fontSize: "11px",
            fontWeight: 600,
            color: "#4338CA",
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
          }}
        >
          Syncing live data…
        </Typography>
      </Box>
    );
  }

  if (status === "cached") {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          px: 1.25,
          py: 0.5,
          borderRadius: "6px",
          backgroundColor: "#F0FDF4",
          border: "1px solid #BBF7D0",
          height: 32,
        }}
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: "#22c55e",
            flexShrink: 0,
          }}
        />
        <Typography
          sx={{
            fontSize: "11px",
            fontWeight: 600,
            color: "#15803D",
            whiteSpace: "nowrap",
          }}
        >
          Cached
          {lastSyncedAt && (
            <Box component="span" sx={{ fontWeight: 400, color: "#4ADE80", ml: 0.5 }}>
              · {formatTime(lastSyncedAt)}
            </Box>
          )}
        </Typography>
      </Box>
    );
  }

  if (status === "synced") {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          px: 1.25,
          py: 0.5,
          borderRadius: "6px",
          backgroundColor: "#F0FDF4",
          border: "1px solid #BBF7D0",
          height: 32,
          "@keyframes fadeIn": {
            from: { opacity: 0, transform: "scale(0.95)" },
            to: { opacity: 1, transform: "scale(1)" },
          },
          animation: "fadeIn 0.3s ease-out",
        }}
      >
        <Box sx={{ fontSize: "12px", lineHeight: 1, flexShrink: 0 }}>✓</Box>
        <Typography
          sx={{
            fontSize: "11px",
            fontWeight: 600,
            color: "#15803D",
            whiteSpace: "nowrap",
          }}
        >
          Synced
          {lastSyncedAt && (
            <Box component="span" sx={{ fontWeight: 400, color: "#15803D", ml: 0.5 }}>
              · {formatTime(lastSyncedAt)}
            </Box>
          )}
        </Typography>
      </Box>
    );
  }

  if (status === "error") {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          px: 1.25,
          py: 0.5,
          borderRadius: "6px",
          backgroundColor: "#FEF2F2",
          border: "1px solid #FECACA",
          height: 32,
        }}
      >
        <Box sx={{ fontSize: "12px", lineHeight: 1, flexShrink: 0 }}>⚠</Box>
        <Typography
          sx={{
            fontSize: "11px",
            fontWeight: 600,
            color: "#DC2626",
            whiteSpace: "nowrap",
          }}
        >
          Sync failed
        </Typography>
      </Box>
    );
  }

  return null;
}
// ─────────────────────────────────────────────────────────────────────────────

export function AdSetsTable({ selectedAdAccountId, dateRange, datePreset, syncData, selectedAdSetId }) {
  const { state } = useSidebar();

  const router = useRouter();
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 5,
  });
  const [totalCount, setTotalCount] = useState(0);
  const [selectedBidStrategy, setSelectedBidStrategy] = useState(null);
  const [selectedObjectives, setSelectedObjectives] = useState(null);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [data, setData] = useState([]);

  // Currency state - will be populated from API response
  const [currency, setCurrency] = useState({
    code: 'USD',
    symbol: '$',
    decimals: 2,
    name: 'US Dollar'
  });

  // ── Sync indicator state ──────────────────────────────────────────────────
  const [syncStatus, setSyncStatus] = useState("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  // ─────────────────────────────────────────────────────────────────────────

  // Helper function to format currency values
  const formatCurrency = (value, showSymbol = true) => {
    const numValue = typeof value === 'number' ? value : parseFloat(String(value || '0').replace(/[^0-9.-]/g, ''));
    const formatted = numValue.toFixed(currency.decimals);
    return showSymbol ? `${currency.symbol}${formatted}` : formatted;
  };

  const totals = useMemo(() => {
    const parse = (v) =>
      typeof v === "number"
        ? v
        : parseFloat(String(v || "").replace(/[^0-9.]/g, "")) || 0;
    const sum = (key) => data.reduce((a, r) => a + parse(r[key]), 0);
    const totalBudget = sum("budget");
    const totalConsumption = sum("advertisingConsumption");
    const totalResults = sum("results");
    const totalImpressions = sum("impressions");
    const totalReach = sum("reach");
    const totalClicks = sum("clicks");
    const totalLinksClicks = sum("linksClicks");
    const totalOutboundClicks = sum("outboundClicks");
    const totalUniqueOutboundClicks = sum("uniqueOutboundClicks");
    const activeCount = data.filter((r) => r.onOff).length;
    const avg = (num, den) => (den ? num / den : 0);
    return {
      activeCount,
      totalRows: data.length,
      totalBudget,
      totalConsumption,
      totalResults,
      totalImpressions,
      totalReach,
      totalClicks,
      totalLinksClicks,
      totalOutboundClicks,
      totalUniqueOutboundClicks,
      avgCostPerResult: avg(totalConsumption, totalResults),
      avgCPM: avg(totalConsumption, totalImpressions) * 1000,
      avgCTRAll: avg(totalClicks, totalImpressions) * 100,
      avgCPCAll: avg(totalConsumption, totalClicks),
      avgCTRLinks: avg(totalLinksClicks, totalImpressions) * 100,
      avgCPCLinks: avg(totalConsumption, totalLinksClicks),
      avgFrequency: avg(totalImpressions, totalReach),
      avgOutboundCTR: avg(totalOutboundClicks, totalImpressions) * 100,
      avgUniqueOutboundCTR: avg(totalUniqueOutboundClicks, totalReach) * 100,
      avgCostPerOutboundClick: avg(totalConsumption, totalOutboundClicks),
      avgCostPerUniqueOutboundClick: avg(
        totalConsumption,
        totalUniqueOutboundClicks
      ),
    };
  }, [data]);

  useEffect(() => {
    async function loadAds(accountId, dateRange, paginationState, sync = false, adSetId = null) {
      // Always force sync=true — every GET must pull live data from Meta
      setSyncStatus("syncing");

      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (accountId) {
          params.append("accountId", accountId);
        }

        params.append("insights", "true");

        if (selectedStatuses.length > 0) {
          const apiStatuses = selectedStatuses.map(status => {
            if (status === "Active") return "ACTIVE";
            if (status === "Paused") return "PAUSED";
            return status;
          });
          params.append("status", apiStatuses.join(","));
        }

        // Always force sync=true — every GET must pull live data from Meta
        params.append("sync", "true");
        console.log("🔄 [Sync] Sending sync=true to API");

        const limit = paginationState.pageSize;
        const offset = paginationState.pageIndex * paginationState.pageSize;
        params.append("limit", limit);
        params.append("skip", offset);

        if (dateRange && dateRange.length === 2 && dateRange[0] && dateRange[1]) {
          if (datePreset) {
            params.append("date_preset", datePreset);
            console.log("Using preset:", datePreset);
          } else {
            params.append("since", dateRange[0].format("YYYY-MM-DD"));
            params.append("until", dateRange[1].format("YYYY-MM-DD"));
            console.log("Using custom dates:", dateRange[0].format("YYYY-MM-DD"), dateRange[1].format("YYYY-MM-DD"));
          }
        }

        const url = adSetId
          ? `/api/meta/adset/${adSetId}/ads?${params.toString()}`
          : `/api/meta/ads?${params.toString()}`;

        console.log("Fetching ads with URL:", url);

        const res = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        });

        const json = await res.json();
        console.log("Ads fetch response:", json);

        if (json.currency) {
          setCurrency(json.currency);
          console.log("Currency set to:", json.currency);
        }

        if (json.pagination?.total !== undefined) {
          setTotalCount(json.pagination.total);
        }

        // ── Update indicator: synced or cached ───────────────────────────────
        const wasCached = json.cached === true;
        setSyncStatus(wasCached ? "cached" : "synced");
        setLastSyncedAt(new Date());
        console.log(`✅ [Sync] Status → ${wasCached ? "cached" : "synced"} at ${new Date().toLocaleTimeString()}`);

        if (!json?.success) {
          setData([]);
          return;
        }

        const rows = [];
        const currencySymbol = json.currency?.symbol || '$';

        json.data?.forEach((ad) => {
          const insights = ad.insights || {};
          let budgetDisplay = `${currencySymbol}0`;

          if (ad.adset?.daily_budget || ad.adset?.lifetime_budget) {
            const daily = ad.adset.daily_budget ? parseFloat(ad.adset.daily_budget) / 100 : 0;
            const lifetime = ad.adset.lifetime_budget ? parseFloat(ad.adset.lifetime_budget) / 100 : 0;
            budgetDisplay = daily > 0
              ? `${currencySymbol}${daily.toFixed(json.currency?.decimals || 2)} Daily`
              : lifetime > 0
                ? `${currencySymbol}${lifetime.toFixed(json.currency?.decimals || 2)} Lifetime`
                : `${currencySymbol}0`;
          } else {
            budgetDisplay = "Using ad set budget";
          }

          const spend = Number(insights.spend || 0);
          const impressions = Number(insights.impressions || 0);
          const clicks = Number(insights.clicks || 0);
          const result =
            insights.actions?.find(
              (a) => a.action_type === "landing_page_view"
            )?.value || 0;
          const linkClicks =
            insights.actions?.find(
              (a) => a.action_type === "link_click"
            )?.value || 0;
          const costPerResult = insights.cost_per_action_type?.find(
            (a) => a.action_type === "landing_page_view"
          )?.value || 0;
          const outboundClicks =
            insights.outbound_clicks?.[0]?.value || 0;

          const reach = Number(insights.reach || 0);

          rows.push({
            id: ad.id,
            status:
              ad.status === "ACTIVE"
                ? "Active"
                : ad.status === "PAUSED"
                  ? "Paused"
                  : ad.status || "-",
            ad: ad.name,
            adId: ad.id,
            adImage:
              ad.creative?.thumbnail_url ||
              "/avatar.png",
            adSet: ad.adset?.name || ad.adset_name || "-",
            adSetId: ad.adset?.id || ad.adset_id || "-",
            account: ad.account?.name || "-",
            accountId: ad.account?.id || "-",
            interception: false,
            objective: ad.campaign?.objective
              ? ad.campaign.objective.replace("OUTCOME_", "").toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
              : (ad.campaign_name?.includes("Traffic") ? "Traffic"
                : ad.campaign_name?.includes("Awareness") ? "Awareness"
                  : ad.campaign_name?.includes("Engagement") ? "Engagement"
                    : "-"),
            bidStrategy: ad.adset?.bid_strategy || ad.bid_strategy || "-",
            ends: ad.stop_time || "Ongoing",
            dateCreated: ad.createdTime
              ? new Date(ad.createdTime).toLocaleString('en-GB', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
              }).replace(',', '')
              : ad.created_time
                ?.replace("T", " ")
                ?.split("+")[0],
            budget: budgetDisplay,
            advertisingConsumption: spend,
            results: result,
            costPerResult: costPerResult,
            impressions,
            reach,
            cpm:
              impressions > 0
                ? (spend / impressions) * 1000
                : 0,
            clicks,
            ctrAll:
              impressions > 0
                ? (clicks / impressions) * 100
                : 0,
            cpcAll:
              clicks > 0
                ? spend / clicks
                : 0,
            linksClicks: linkClicks,
            ctrLinks:
              impressions > 0
                ? (linkClicks / impressions) * 100
                : 0,
            cpcLinks:
              linkClicks > 0
                ? spend / linkClicks
                : 0,
            frequency:
              reach > 0
                ? impressions / reach
                : 0,
            outboundClicks,
            uniqueOutboundClicks: insights.unique_clicks || 0,
            outboundCTR:
              impressions > 0
                ? (outboundClicks / impressions) * 100
                : 0,
            uniqueOutboundCTR:
              reach > 0
                ? ((insights.unique_clicks || 0) / reach) * 100
                : 0,
            costperOutboundClick:
              outboundClicks > 0
                ? spend / outboundClicks
                : 0,
            costperUniqueOutboundClick:
              insights.unique_clicks > 0
                ? spend / insights.unique_clicks
                : 0,
          });
        });

        setData(rows);
      } catch (e) {
        console.error("Failed to load ads:", e);
        // ── Update indicator: error ───────────────────────────────────────────
        setSyncStatus("error");
        setData([]);
      } finally {
        setIsLoading(false);
      }
    }

    loadAds(selectedAdAccountId, dateRange, pagination, syncData, selectedAdSetId);
  }, [selectedAdAccountId, selectedStatuses, dateRange, datePreset, pagination, syncData, selectedAdSetId]);

  const columns = useMemo(
    () => [
      {
        accessorKey: "onOff",
        header: "Off/On",
        size: 70,
        enableSorting: false,
        enableColumnActions: false,
        enableColumnOrdering: false,
        enableColumnResizing: false,
        enableColumnPinning: false,
        enableGrouping: false,
        enableFacetedValues: false,
        Cell: ({ cell }) => (
          <Switch
            checked={!!cell.getValue()}
            size="small"
            sx={{
              "& .MuiSwitch-switchBase.Mui-checked": { color: "#6366F1" },
              "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                backgroundColor: "#6366F1",
              },
            }}
          />
        ),
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            {totals.activeCount} Active
          </Box>
        ),
      },
      {
        accessorKey: "ad",
        header: "Ad",
        size: 300,
        enableGrouping: false,
        enableColumnOrdering: false,
        Cell: ({ cell, row }) => {
          const value = cell.getValue() || "-";
          const adId = row.original.adId || "-";
          const adImage = row.original.adImage || "/avatar.png";

          return (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
                width: "100%",
                position: "relative",
                "&:hover .ad-info": {
                  width: "150px",
                },
                "&:hover .ad-actions": {
                  opacity: 1,
                  visibility: "visible",
                },
              }}
            >
              <Box
                className="ad-info"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  width: "100%",
                  minWidth: 0,
                  overflow: "hidden",
                  transition: "width 0.3s ease",
                }}
              >
                <Box
                  component="img"
                  src={adImage}
                  alt={value}
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: "8px",
                    objectFit: "cover",
                    flexShrink: 0,
                  }}
                />

                <Box sx={{ overflow: "hidden", minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 500,
                      fontSize: "14px",
                      lineHeight: "16px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {value}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "#666",
                      fontSize: "12px",
                      lineHeight: "14px",
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {adId}
                  </Typography>
                </Box>
              </Box>

              <Box
                className="ad-actions"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  flexShrink: 0,
                  opacity: 0,
                  visibility: "hidden",
                  transition: "opacity 0.3s ease, visibility 0.3s ease",
                }}
              >
                <Tooltip title="Edit Ad" arrow>
                  <IconButton
                    size="small"
                    sx={{ padding: "4px", color: "#666", "&:hover": { color: "#333" } }}
                    onClick={() => console.log("Edit ad:", row.original)}
                  >
                    <EditIcon sx={{ fontSize: "16px" }} />
                  </IconButton>
                </Tooltip>

                <Tooltip title="Duplicate Ad" arrow>
                  <IconButton
                    size="small"
                    sx={{ padding: "4px", color: "#666", "&:hover": { color: "#333" } }}
                    onClick={() => console.log("Copy ad:", row.original)}
                  >
                    <ContentCopyIcon sx={{ fontSize: "16px" }} />
                  </IconButton>
                </Tooltip>

                <Tooltip title="View Report" arrow>
                  <IconButton
                    size="small"
                    sx={{ padding: "4px", color: "#666", "&:hover": { color: "#333" } }}
                    onClick={() => console.log("View stats:", row.original)}
                  >
                    <BarChartIcon sx={{ fontSize: "16px" }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          );
        },
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            Total: {totals.totalRows} Ads
          </Box>
        ),
      },
      
      {
        accessorKey: "status",
        header: "Status",
        size: 150,
        Cell: ({ cell }) => {
          const status = cell.getValue() || "-";
          const getColor = () => {
            if (status === "Active") return "#22c55e";
            if (status === "Paused") return "#f59e0b";
            return "#6b7280";
          };

          return (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <span style={{ color: getColor(), fontSize: "10px" }}>●</span>
              <Typography variant="body2" sx={{ fontSize: "12px" }}>
                {status}
              </Typography>
            </Box>
          );
        },
        Footer: () => <Box sx={{ fontSize: "12px" }}>-</Box>,
      },
      {
        accessorKey: "adSet",
        header: "Ad Set",
        size: 300,
        enableGrouping: false,
        enableColumnOrdering: false,
        Cell: ({ cell, row }) => {
          const value = cell.getValue() || "-";
          const adSetId = row.original.adSetId || "-";

          return (
            <Box sx={{ py: 0.25 }}>
              <Typography
                variant="body2"
                sx={{ fontWeight: 500, fontSize: "14px", lineHeight: "16px" }}
              >
                {value}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: "#666", fontSize: "12px", lineHeight: "14px", display: "block" }}
              >
                {adSetId}
              </Typography>
            </Box>
          );
        },
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            Total: {totals.totalRows} Ad Sets
          </Box>
        ),
      },
      {
        accessorKey: "account",
        header: "Account",
        size: 200,
        Cell: ({ cell, row }) => {
          const account = cell.getValue() || "-";
          const accountId = row.original.accountId || "-";
          return (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Image
                src="/fblogo.webp"
                alt="Fblogo"
                width={22}
                height={22}
                style={{ borderRadius: "4px" }}
              />
              <Box>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 500, fontSize: "12px", lineHeight: "16px" }}
                >
                  {account}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "#666", fontSize: "10px", lineHeight: "14px", display: "block" }}
                >
                  {accountId}
                </Typography>
              </Box>
            </Box>
          );
        },
        Footer: () => <Box sx={{ fontSize: "12px" }}>-</Box>,
      },
      {
        accessorKey: "objective",
        header: "Objective",
        size: 170,
        Cell: ({ cell }) => {
          const objective = cell.getValue() || "-";
          const getIcon = () =>
            objective === "Engagement"
              ? "💬"
              : objective === "Sales"
                ? "🎯"
                : objective === "App Promotions"
                  ? "📱"
                  : "📊";
          return (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <span style={{ fontSize: "13px" }}>{getIcon()}</span>
              <Typography variant="body2" sx={{ fontSize: "12px" }}>
                {objective}
              </Typography>
            </Box>
          );
        },
        Footer: () => <Box sx={{ fontSize: "12px" }}>-</Box>,
      },
      {
        accessorKey: "bidStrategy",
        header: "Bid strategy",
        size: 200,
        Cell: ({ cell }) => (
          <Typography variant="body2" sx={{ fontSize: "12px" }}>
            {cell.getValue() || "-"}
          </Typography>
        ),
        Footer: () => <Box sx={{ fontSize: "12px" }}>-</Box>,
      },
      {
        accessorKey: "ends",
        header: "Ends",
        size: 150,
        Cell: ({ cell }) => (
          <Typography variant="body2" sx={{ fontSize: "12px" }}>
            {cell.getValue() || "-"}
          </Typography>
        ),
        Footer: () => <Box sx={{ fontSize: "12px" }}>-</Box>,
      },
      {
        accessorKey: "dateCreated",
        header: "Date created",
        size: 180,
        Cell: ({ cell }) => {
          const value = cell.getValue();
          if (!value)
            return (
              <Typography variant="body2" sx={{ fontSize: "12px" }}>
                -
              </Typography>
            );
          const [date, time] = value.split(" ");
          return (
            <Box sx={{ display: "flex", flexDirection: "column", lineHeight: "16px" }}>
              <Typography variant="body2" sx={{ fontSize: "12px" }}>
                {date || "-"}
              </Typography>
              <Typography variant="caption" sx={{ color: "#666", fontSize: "10px" }}>
                {time || "-"}
              </Typography>
            </Box>
          );
        },
        Footer: () => <Box sx={{ fontSize: "12px" }}>-</Box>,
      },
      {
        accessorKey: "budget",
        header: "Budget",
        size: 160,
        Cell: ({ cell }) => (
          <Typography variant="body2" sx={{ fontSize: "12px" }}>
            {cell.getValue() || "-"}
          </Typography>
        ),
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            {formatCurrency(totals.totalBudget)} Daily
          </Box>
        ),
      },
      {
        accessorKey: "advertisingConsumption",
        header: (
          <>
            Amount <br /> spent
          </>
        ),
        size: 180,
        Cell: ({ cell }) => (
          <Typography variant="body2" sx={{ fontSize: "12px" }}>
            {formatCurrency(cell.getValue() || 0)}
          </Typography>
        ),
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            {formatCurrency(totals.totalConsumption)}
          </Box>
        ),
      },
      {
        accessorKey: "results",
        header: "Results",
        size: 150,
        Cell: ({ cell }) => (
          <Typography variant="body2" sx={{ fontSize: "12px" }}>
            {cell.getValue() || "-"}
          </Typography>
        ),
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            {totals.totalResults.toLocaleString()}
          </Box>
        ),
      },
      {
        accessorKey: "costPerResult",
        header: (
          <>
            Cost per <br /> result
          </>
        ),
        size: 150,
        Cell: ({ cell }) => {
          const value = cell.getValue();
          return (
            <Typography variant="body2" sx={{ fontSize: "12px" }}>
              {value > 0 ? formatCurrency(value) : "-"}
            </Typography>
          );
        },
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            {formatCurrency(totals.avgCostPerResult)} avg
          </Box>
        ),
      },
      {
        accessorKey: "impressions",
        header: (
          <>
            Impressions <br /> (PV)
          </>
        ),
        size: 180,
        Cell: ({ cell }) => (
          <Typography variant="body2" sx={{ fontSize: "12px" }}>
            {Number(cell.getValue() || 0).toLocaleString()}
          </Typography>
        ),
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            {totals.totalImpressions.toLocaleString()}
          </Box>
        ),
      },
      {
        accessorKey: "reach",
        header: (
          <>
            Reach <br /> (UV)
          </>
        ),
        size: 150,
        Cell: ({ cell }) => (
          <Typography variant="body2" sx={{ fontSize: "12px" }}>
            {Number(cell.getValue() || 0).toLocaleString()}
          </Typography>
        ),
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            {totals.totalReach.toLocaleString()}
          </Box>
        ),
      },
      {
        accessorKey: "cpm",
        header: (
          <>
            CPM(cost
            <br />
            per 1,000 Impressions)
          </>
        ),
        size: 180,
        Cell: ({ cell }) => {
          const value = cell.getValue();
          return (
            <Typography variant="body2" sx={{ fontSize: "12px" }}>
              {value > 0 ? formatCurrency(value) : "-"}
            </Typography>
          );
        },
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            {formatCurrency(totals.avgCPM)} avg
          </Box>
        ),
      },
      {
        accessorKey: "clicks",
        header: (
          <>
            Clicks <br /> (all)
          </>
        ),
        size: 150,
        Cell: ({ cell }) => (
          <Typography variant="body2" sx={{ fontSize: "12px" }}>
            {Number(cell.getValue() || 0).toLocaleString()}
          </Typography>
        ),
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            {totals.totalClicks.toLocaleString()}
          </Box>
        ),
      },
      {
        accessorKey: "ctrAll",
        header: "CTR (all)",
        size: 150,
        Cell: ({ cell }) => {
          const value = cell.getValue();
          return (
            <Typography variant="body2" sx={{ fontSize: "12px" }}>
              {value > 0 ? `${value.toFixed(2)}%` : "-"}
            </Typography>
          );
        },
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            {totals.avgCTRAll.toFixed(2)}% avg
          </Box>
        ),
      },
      {
        accessorKey: "cpcAll",
        header: "CPC (all)",
        size: 150,
        Cell: ({ cell }) => {
          const value = cell.getValue();
          return (
            <Typography variant="body2" sx={{ fontSize: "12px" }}>
              {value > 0 ? formatCurrency(value) : "-"}
            </Typography>
          );
        },
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            {formatCurrency(totals.avgCPCAll)} avg
          </Box>
        ),
      },
      {
        accessorKey: "linksClicks",
        header: (
          <>
            Link <br /> Clicks
          </>
        ),
        size: 150,
        Cell: ({ cell }) => (
          <Typography variant="body2" sx={{ fontSize: "12px" }}>
            {Number(cell.getValue() || 0).toLocaleString()}
          </Typography>
        ),
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            {totals.totalLinksClicks.toLocaleString()}
          </Box>
        ),
      },
      {
        accessorKey: "ctrLinks",
        header: (
          <>
            CTR (link
            <br />
            click-through rate)
          </>
        ),
        size: 190,
        Cell: ({ cell }) => {
          const value = cell.getValue();
          return (
            <Typography variant="body2" sx={{ fontSize: "12px" }}>
              {value > 0 ? `${value.toFixed(2)}%` : "-"}
            </Typography>
          );
        },
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            {totals.avgCTRLinks.toFixed(2)}% avg
          </Box>
        ),
      },
      {
        accessorKey: "cpcLinks",
        header: (
          <>
            CPC (cost
            <br />
            per-link click)
          </>
        ),
        size: 190,
        Cell: ({ cell }) => {
          const value = cell.getValue();
          return (
            <Typography variant="body2" sx={{ fontSize: "12px" }}>
              {value > 0 ? formatCurrency(value) : "-"}
            </Typography>
          );
        },
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            {formatCurrency(totals.avgCPCLinks)} avg
          </Box>
        ),
      },
      {
        accessorKey: "frequency",
        header: "Frequency",
        size: 170,
        Cell: ({ cell }) => {
          const value = cell.getValue();
          return (
            <Typography variant="body2" sx={{ fontSize: "12px" }}>
              {value > 0 ? value.toFixed(2) : "-"}
            </Typography>
          );
        },
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            {totals.avgFrequency.toFixed(2)} avg
          </Box>
        ),
      },
      // {
      //   accessorKey: "outboundClicks",
      //   header: (
      //     <>
      //       Outbound
      //       <br />
      //       Clicks
      //     </>
      //   ),
      //   size: 170,
      //   Cell: ({ cell }) => (
      //     <Typography variant="body2" sx={{ fontSize: "12px" }}>
      //       {Number(cell.getValue() || 0).toLocaleString()}
      //     </Typography>
      //   ),
      //   Footer: () => (
      //     <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
      //       {totals.totalOutboundClicks.toLocaleString()}
      //     </Box>
      //   ),
      // },
      // {
      //   accessorKey: "uniqueOutboundClicks",
      //   header: (
      //     <>
      //       Unique
      //       <br />
      //       Outbound Clicks
      //     </>
      //   ),
      //   size: 200,
      //   Cell: ({ cell }) => (
      //     <Typography variant="body2" sx={{ fontSize: "12px" }}>
      //       {Number(cell.getValue() || 0).toLocaleString()}
      //     </Typography>
      //   ),
      //   Footer: () => (
      //     <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
      //       {totals.totalUniqueOutboundClicks.toLocaleString()}
      //     </Box>
      //   ),
      // },
      // {
      //   accessorKey: "outboundCTR",
      //   header: (
      //     <>
      //       Outbound CTR (<br />
      //       Click-through rate)
      //     </>
      //   ),
      //   size: 200,
      //   Cell: ({ cell }) => {
      //     const value = cell.getValue();
      //     return (
      //       <Typography variant="body2" sx={{ fontSize: "12px" }}>
      //         {value > 0 ? `${value.toFixed(2)}%` : "-"}
      //       </Typography>
      //     );
      //   },
      //   Footer: () => (
      //     <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
      //       {totals.avgOutboundCTR.toFixed(2)}% avg
      //     </Box>
      //   ),
      // },
      // {
      //   accessorKey: "uniqueOutboundCTR",
      //   header: (
      //     <>
      //       Unique Outbound
      //       <br />
      //       CTR (Click-through rate)
      //     </>
      //   ),
      //   size: 200,
      //   Cell: ({ cell }) => {
      //     const value = cell.getValue();
      //     return (
      //       <Typography variant="body2" sx={{ fontSize: "12px" }}>
      //         {value > 0 ? `${value.toFixed(2)}%` : "-"}
      //       </Typography>
      //     );
      //   },
      //   Footer: () => (
      //     <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
      //       {totals.avgUniqueOutboundCTR.toFixed(2)}% avg
      //     </Box>
      //   ),
      // },
      // {
      //   accessorKey: "costperOutboundClick",
      //   header: (
      //     <>
      //       Cost per
      //       <br />
      //       Outbound click
      //     </>
      //   ),
      //   size: 200,
      //   Cell: ({ cell }) => {
      //     const value = cell.getValue();
      //     return (
      //       <Typography variant="body2" sx={{ fontSize: "12px" }}>
      //         {value > 0 ? formatCurrency(value) : "-"}
      //       </Typography>
      //     );
      //   },
      //   Footer: () => (
      //     <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
      //       {formatCurrency(totals.avgCostPerOutboundClick)} avg
      //     </Box>
      //   ),
      // },
      // {
      //   accessorKey: "costperUniqueOutboundClick",
      //   header: (
      //     <>
      //       Cost per
      //       <br />
      //       Unique Outbound click
      //     </>
      //   ),
      //   size: 200,
      //   Cell: ({ cell }) => {
      //     const value = cell.getValue();
      //     return (
      //       <Typography variant="body2" sx={{ fontSize: "12px" }}>
      //         {value > 0 ? formatCurrency(value) : "-"}
      //       </Typography>
      //     );
      //   },
      //   Footer: () => (
      //     <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
      //       {formatCurrency(totals.avgCostPerUniqueOutboundClick)} avg
      //     </Box>
      //   ),
      // },
    ],
    [totals, currency, formatCurrency]
  );

  const table = useMaterialReactTable({
    columns,
    data,
    enableColumnResizing: true,
    enableGlobalFilter: true,
    enablePagination: true,
    enableSorting: true,
    enableColumnFilterModes: true,
    enableColumnOrdering: true,
    enableGrouping: true,
    enableColumnPinning: true,
    enableFacetedValues: true,
    enableRowSelection: true,
    enableDensityToggle: false,
    enableFullScreenToggle: false,
    manualPagination: true,
    rowCount: totalCount,
    onPaginationChange: setPagination,
    state: {
      pagination,
    },
    initialState: {
      density: "compact",
      pagination: { pageSize: 5, pageIndex: 0 },
      showGlobalFilter: true,
      columnPinning: { left: ["mrt-row-select", "onOff", "ad"] },
      showGlobalFilter: false,
    },
    paginationDisplayMode: "pages",
    positionToolbarAlertBanner: "bottom",
    muiSearchTextFieldProps: { size: "small", variant: "outlined" },
    muiPaginationProps: {
      color: "primary",
      rowsPerPageOptions: [5, 20, 50, 100],
      shape: "rounded",
      variant: "outlined",
    },
    muiTablePaginationProps: {
      sx: {
        ".MuiTablePagination-toolbar": {
          flexDirection: "row-reverse",
          justifyContent: "flex-start",
        },
        ".MuiTablePagination-selectLabel": { margin: 0 },
        ".MuiTablePagination-displayedRows": { margin: 0 },
      },
    },
    muiTableBodyRowProps: ({ row }) => ({
      sx: { backgroundColor: row.index % 2 === 1 ? "#fcfcfc" : "inherit" },
    }),
    muiTableContainerProps: {
      sx: {
        maxHeight: "420px",
        width: state === "collapsed" ? "1448px" : "1248px",
        transition: "max-width 0.3s ease",
        overflowY: "auto",
      },
    },
    muiTableHeadRowProps: {
      sx: { position: "sticky", top: 0, zIndex: 2, backgroundColor: "#fff" },
    },
    muiTableHeadCellProps: {
      sx: { border: "0.25px solid rgba(81, 81, 81, 0.1)", fontWeight: 600, fontSize: "13px" },
    },
    muiTableFooterRowProps: {
      sx: {
        backgroundColor: "#f8f9fa",
        fontWeight: 600,
        fontSize: "14px",
        height: "34px",
        position: "sticky",
        bottom: 0,
        zIndex: 1,
        borderTop: "2px solid #e0e0e0",
      },
    },
    muiTableFooterCellProps: ({ column }) => ({
      sx: {
        borderRight: column.getIsPinned()
          ? "none"
          : "0.25px solid rgba(81, 81, 81, 0.1)",
        borderBottom: "0.25px solid rgba(81, 81, 81, 0.1)",
        textAlign: "center",
        fontWeight: 600,
      },
    }),
    muiTableBodyCellProps: {
      sx: { border: "0.25px solid rgba(81, 81, 81, 0.1)" },
    },

    renderTopToolbarCustomActions: () => (
      <Box
        sx={{
          display: "flex",
          gap: 1,
          alignItems: "center",
          flexWrap: "wrap",
          width: "100%",
          padding: "8px 0",
        }}
      >
        {/* ── Sync Status Indicator ────────────────────────────────────────── */}
        <SyncIndicator status={syncStatus} lastSyncedAt={lastSyncedAt} />

        {/* Currency Display Chip */}
        <Chip
          label={`${currency.symbol} ${currency.code}`}
          size="small"
          sx={{
            height: 35,
            fontSize: "0.85rem",
            fontWeight: 600,
            backgroundColor: "#E8E8FF",
            color: "#6366F1",
            border: "1px solid #6366F1",
            "& .MuiChip-label": { px: 2 },
          }}
        />

        <Tooltip title="Delete" arrow>
          <IconButton
            sx={{
              width: 40,
              height: 35,
              borderRadius: "6px",
              backgroundColor: "#F5F5F5",
              border: "1px solid #E0E0E0",
              "&:hover": { backgroundColor: "#EEEEEE" },
            }}
          >
            <DeleteOutlineIcon sx={{ fontSize: 20, color: "#757575" }} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Pause" arrow>
          <IconButton
            sx={{
              width: 40,
              height: 35,
              borderRadius: "6px",
              backgroundColor: "#F5F5F5",
              border: "1px solid #E0E0E0",
              "&:hover": { backgroundColor: "#EEEEEE" },
            }}
          >
            <PauseCircleOutlineIcon sx={{ fontSize: 20, color: "#757575" }} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Start" arrow>
          <IconButton
            sx={{
              width: 40,
              height: 35,
              borderRadius: "6px",
              backgroundColor: "#F5F5F5",
              border: "1px solid #E0E0E0",
              "&:hover": { backgroundColor: "#EEEEEE" },
            }}
          >
            <PlayCircleOutlineIcon sx={{ fontSize: 20, color: "#757575" }} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Edit" arrow>
          <IconButton
            sx={{
              width: 40,
              height: 35,
              borderRadius: "6px",
              backgroundColor: "#F5F5F5",
              border: "1px solid #E0E0E0",
              "&:hover": { backgroundColor: "#EEEEEE" },
            }}
          >
            <DriveFileRenameOutlineIcon sx={{ fontSize: 20, color: "#757575" }} />
          </IconButton>
        </Tooltip>

        <Autocomplete
          size="small"
          options={[
            "Awareness",
            "Traffic",
            "Engagement",
            "Leads",
            "App Promotion",
            "Sales",
          ]}
          value={selectedObjectives}
          onChange={(e, newValue) => setSelectedObjectives(newValue)}
          sx={{
            width: 140,
            "& .MuiOutlinedInput-root": {
              height: 35,
              fontSize: "0.85rem",
              borderRadius: "6px",
              "& fieldset": { backgroundColor: "#00000003", borderColor: "#E0E0E0" },
              "&:hover fieldset": { borderColor: "#BDBDBD" },
              "&.Mui-focused fieldset": { borderColor: "#6366F1" },
            },
            "& .MuiInputLabel-root": {
              fontSize: "0.8rem",
              color: "#757575",
              "&.Mui-focused": { color: "#6366F1" },
            },
          }}
          renderInput={(params) => (
            <TextField {...params} label="Objectives" variant="outlined" />
          )}
        />

        <Autocomplete
          size="small"
          options={["Active", "Paused"]}
          value={selectedStatuses[0] || null}
          onChange={(e, newValue) => setSelectedStatuses(newValue ? [newValue] : [])}
          sx={{
            width: 160,
            "& .MuiOutlinedInput-root": {
              height: 35,
              fontSize: "0.85rem",
              borderRadius: "6px",
              "& fieldset": { backgroundColor: "#00000003", borderColor: "#E0E0E0" },
              "&:hover fieldset": { borderColor: "#BDBDBD" },
              "&.Mui-focused fieldset": { borderColor: "#6366F1" },
            },
            "& .MuiInputLabel-root": {
              fontSize: "0.8rem",
              color: "#757575",
              "&.Mui-focused": { color: "#6366F1" },
            },
          }}
          renderInput={(params) => (
            <TextField {...params} label="Status" variant="outlined" />
          )}
        />
      </Box>
    ),
  });

  if (isLoading) {
    return (
      <div className="container max-w-screen">
        <Card className="w-full overflow-hidden shadow-xl rounded-b-xl">
          <Box sx={{ p: 2 }}>
            <Box
              sx={{
                display: "flex",
                gap: 1,
                alignItems: "center",
                mb: 2,
                pb: 2,
                borderBottom: "1px solid #e0e0e0",
              }}
            >
              <Box
                sx={{
                  width: 80,
                  height: 40,
                  bgcolor: "#E8E8FF",
                  borderRadius: "20px",
                  animation: "pulse 1.5s ease-in-out infinite",
                  "@keyframes pulse": {
                    "0%, 100%": { opacity: 1 },
                    "50%": { opacity: 0.5 },
                  },
                }}
              />
              <Box
                sx={{
                  width: 100,
                  height: 40,
                  bgcolor: "#E8E8FF",
                  borderRadius: "6px",
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              />
              {[1, 2, 3, 4].map((i) => (
                <Box
                  key={i}
                  sx={{
                    width: 40,
                    height: 40,
                    bgcolor: "#F5F5F5",
                    borderRadius: "6px",
                    animation: "pulse 1.5s ease-in-out infinite",
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
              {[192, 140, 160].map((width, i) => (
                <Box
                  key={i}
                  sx={{
                    width,
                    height: 40,
                    bgcolor: "#F9F9F9",
                    borderRadius: "6px",
                    animation: "pulse 1.5s ease-in-out infinite",
                    animationDelay: `${(i + 4) * 0.1}s`,
                  }}
                />
              ))}
            </Box>
            <Box>
              <Box
                sx={{
                  display: "flex",
                  gap: 0.5,
                  mb: 1,
                  pb: 1,
                  borderBottom: "2px solid #e0e0e0",
                }}
              >
                <Box sx={{ width: 40, height: 36, bgcolor: "#F0F0F0", borderRadius: "4px" }} />
                <Box sx={{ width: 70, height: 36, bgcolor: "#F0F0F0", borderRadius: "4px" }} />
                <Box sx={{ flex: 1, height: 36, bgcolor: "#F0F0F0", borderRadius: "4px" }} />
                <Box sx={{ width: 150, height: 36, bgcolor: "#F0F0F0", borderRadius: "4px" }} />
                <Box sx={{ width: 200, height: 36, bgcolor: "#F0F0F0", borderRadius: "4px" }} />
                <Box sx={{ width: 170, height: 36, bgcolor: "#F0F0F0", borderRadius: "4px" }} />
              </Box>
              {[1, 2, 3, 4, 5].map((row) => (
                <Box
                  key={row}
                  sx={{
                    display: "flex",
                    gap: 0.5,
                    mb: 0.5,
                    py: 1.5,
                    borderBottom: "1px solid #f0f0f0",
                    bgcolor: row % 2 === 0 ? "#fcfcfc" : "transparent",
                  }}
                >
                  <Box sx={{ width: 40, height: 24, bgcolor: "#E8E8E8", borderRadius: "4px", animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${row * 0.1}s` }} />
                  <Box sx={{ width: 70, height: 24, bgcolor: "#E8E8E8", borderRadius: "4px", animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${row * 0.1}s` }} />
                  <Box sx={{ flex: 1, height: 24, bgcolor: "#E8E8E8", borderRadius: "4px", animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${row * 0.1}s` }} />
                  <Box sx={{ width: 150, height: 24, bgcolor: "#E8E8E8", borderRadius: "4px", animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${row * 0.1}s` }} />
                  <Box sx={{ width: 200, height: 24, bgcolor: "#E8E8E8", borderRadius: "4px", animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${row * 0.1}s` }} />
                  <Box sx={{ width: 170, height: 24, bgcolor: "#E8E8E8", borderRadius: "4px", animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${row * 0.1}s` }} />
                </Box>
              ))}
            </Box>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mt: 2,
                pt: 2,
                borderTop: "1px solid #e0e0e0",
              }}
            >
              <Box sx={{ width: 120, height: 32, bgcolor: "#F0F0F0", borderRadius: "4px", animation: "pulse 1.5s ease-in-out infinite" }} />
              <Box sx={{ display: "flex", gap: 1 }}>
                {[1, 2, 3, 4].map((i) => (
                  <Box
                    key={i}
                    sx={{
                      width: 32,
                      height: 32,
                      bgcolor: "#F0F0F0",
                      borderRadius: "4px",
                      animation: "pulse 1.5s ease-in-out infinite",
                      animationDelay: `${i * 0.1}s`,
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-screen">
      <Card className="w-full overflow-hidden shadow-xl rounded-b-xl">
        <MaterialReactTable table={table} />
      </Card>
    </div>
  );
}

export default AdSetsTable;