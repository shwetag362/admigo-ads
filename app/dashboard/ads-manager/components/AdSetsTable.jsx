import React, { useMemo, useState, useEffect } from "react";
import {
  MaterialReactTable,
  useMaterialReactTable,
} from "material-react-table";
import { useSidebar } from "@/components/ui/sidebar";
import { Box, Typography, Button, Card, Switch } from "@mui/material";
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
            <Box
              component="span"
              sx={{ fontWeight: 400, color: "#4ADE80", ml: 0.5 }}
            >
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
            <Box
              component="span"
              sx={{ fontWeight: 400, color: "#15803D", ml: 0.5 }}
            >
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

export function AdSetsTable({ selectedAdAccountId, dateRange, datePreset, syncData, selectedCampaignId, onAdSetSelect }) {
  const { state } = useSidebar();
  const [selectedAdSetIds, setSelectedAdSetIds] = useState([]);

  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 5,
  });
  const [totalCount, setTotalCount] = useState(0);
  const [selectedBidStrategy, setSelectedBidStrategy] = useState(null);
  const [selectedObjectives, setSelectedObjectives] = useState(null);
  const [selectedStatuses, setSelectedStatuses] = useState([]);

  const [currencySymbol, setCurrencySymbol] = useState("$");
  const [currencyCode, setCurrencyCode] = useState("USD");

  const [data, setData] = useState([]);

  // ── Sync indicator state ──────────────────────────────────────────────────
  const [syncStatus, setSyncStatus] = useState("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  // ─────────────────────────────────────────────────────────────────────────

  // Filter data by selected objective
  const filteredData = useMemo(() => {
    if (!selectedObjectives) return data;
    return data.filter((row) => {
      const rowObjective = (row.objective || "").toLowerCase();
      const selected = selectedObjectives.toLowerCase();
      return rowObjective === selected || rowObjective.includes(selected);
    });
  }, [data, selectedObjectives]);

  const totals = useMemo(() => {
    const parse = (s) => {
      if (s === null || s === undefined) return 0;
      if (typeof s === "number") return s;
      if (typeof s === "string") {
        return parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
      }
      return 0;
    };
    // const sum = (key) => data.reduce((a, r) => a + parse(r[key]), 0);
    const sum = (key) => filteredData.reduce((a, r) => a + parse(r[key]), 0);

    const totalBudget = sum("budget");
    const totalConsumption = sum("advertisingConsumption");
    const totalResults = sum("results");
    const totalImpressions = sum("impressions");
    const totalReach = sum("reach");
    const totalClicks = sum("clicks");
    const totalLinksClicks = sum("linksClicks");
    const totalOutboundClicks = sum("outboundClicks");
    const totalUniqueOutboundClicks = sum("uniqueOutboundClicks");
    // const activeCount = data.filter((r) => r.onOff).length;
    const activeCount = filteredData.filter((r) => r.onOff).length;

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
      avgCPPAll: avg(totalConsumption, totalResults),
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
  }, [filteredData]);

  useEffect(() => {
    if (onAdSetSelect && selectedAdSetIds.length > 0) {
      onAdSetSelect(selectedAdSetIds[0]);
    } else if (onAdSetSelect) {
      onAdSetSelect(null);
    }
  }, [selectedAdSetIds, onAdSetSelect]);

  useEffect(() => {
    const fetchAdSets = async (accountId, dateRange, paginationState, sync = false, campaignId = null) => {
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

        // Always force sync=true — every GET      
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

        const url = campaignId
          ? `/api/meta/campaign/${campaignId}/adsets?${params.toString()}`
          : `/api/meta/adsets?${params.toString()}`;

        console.log("Fetching adsets with URL:", url);

        const res = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        });

        const json = await res.json();
        console.log("AdSets fetch response:", json);

        if (json.total !== undefined) {
          setTotalCount(json.total);
        }

        const currencyInfo = json.currency || { symbol: "$", code: "USD" };
        const currency = currencyInfo.symbol || "$";

        setCurrencySymbol(currency);
        setCurrencyCode(currencyInfo.code || "USD");

        // ── Update indicator: synced or cached ───────────────────────────────
        const wasCached = json.cached === true;
        setSyncStatus(wasCached ? "cached" : "synced");
        setLastSyncedAt(new Date());
        console.log(`✅ [Sync] Status → ${wasCached ? "cached" : "synced"} at ${new Date().toLocaleTimeString()}`);

        const adSetsData = json.data || [];
        const rows = [];
        console.log("Processing adsets data:", adSetsData);

        adSetsData.forEach((adSet) => {
          const insights = adSet.insights || {};
          const actions = insights.actions || [];
          const costActions = insights.cost_per_action_type || [];
          const outbound_clicks = insights.outbound_clicks || [];
          const unique_outbound_clicks = insights.unique_outbound_clicks || [];
          const outbound_clicks_ctr = insights.outbound_clicks_ctr || [];
          const unique_outbound_clicks_ctr = insights.unique_outbound_clicks_ctr || [];

          const campaignName = adSet.campaign?.name || "-";
          const campaignId = adSet.campaign?.id || "-";
          const campaignObjective = adSet.campaign?.objective
            ? adSet.campaign.objective
              .replace("OUTCOME_", "")
              .toLowerCase()
              .replace(/\b\w/g, (c) => c.toUpperCase())
            : "-";

          const accountName = adSet.account?.name || adSet.insights?.account_name || "-";
          const accountIdDisplay = adSet.account_id || adSet.account?.id || "-";

          const linkClicks =
            actions.find((a) => a.action_type === "landing_page_view")?.value || 0;

          const costPerLinkClick =
            costActions.find((a) => a.action_type === "landing_page_view")?.value || 0;

          const impressions = Number(insights.impressions || 0);
          const spend = Number(insights.spend || 0);
          const clicks = Number(insights.clicks || 0);

          const outboundClicks = Number(
            outbound_clicks.find((a) => a.action_type === "outbound_click")?.value || 0
          ).toFixed(3);

          const uniqueOutboundClicks = Number(
            unique_outbound_clicks.find((a) => a.action_type === "outbound_click")?.value || 0
          ).toFixed(3);

          const outboundCTR = Number(
            outbound_clicks_ctr.find((a) => a.action_type === "outbound_click")?.value || 0
          ).toFixed(3);

          const uniqueOutboundCTR = Number(
            unique_outbound_clicks_ctr.find((a) => a.action_type === "outbound_click")?.value || 0
          ).toFixed(3);

          const reach = Number(insights.reach || 0);

          rows.push({
            id: adSet.id,
            onOff: adSet.status === "ACTIVE",
            adsets: adSet.name,
            adsetsId: adSet.id,
            status: adSet.status,

            affiliatedCampaign: campaignName,
            affiliatedCampaignId: campaignId,
            objective: campaignObjective,

            account: accountName,
            accountId: accountId,

            bidStrategy: adSet.bid_strategy
              ? adSet.bid_strategy
                .replace(/_/g, " ")
                .toLowerCase()
                .replace(/\b\w/g, (c) => c.toUpperCase())
              : "-",
            ends: adSet.stop_time || "Ongoing",
            dateCreated: adSet.createdTime
              ? new Date(adSet.createdTime).toLocaleString('en-GB', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
              }).replace(',', '')
              : adSet.created_time
                ?.replace("T", " ")
                ?.split("+")[0],
            budget: adSet.daily_budget
              ? `${currency}${(adSet.daily_budget / 100).toFixed(2)} Daily`
              : "Using Campaign Budget",
            advertisingConsumption: spend ? `${currency}${spend.toFixed(2)}` : `${currency}0`,
            results: linkClicks,
            costPerResult: costPerLinkClick
              ? `${currency}${Number(costPerLinkClick).toFixed(3)}`
              : `${currency}0`,
            impressions,
            reach,
            cpm: insights.cpm ? `${currency}${Number(insights.cpm).toFixed(2)}` : "-",
            clicks,
            ctrAll: insights.ctr
              ? `${Number(insights.ctr).toFixed(2)}%`
              : "-",
            cpcAll: insights.cpc
              ? `${currency}${Number(insights.cpc).toFixed(3)}`
              : "-",
            cppAll: insights.cpp
              ? `${currency}${Number(insights.cpp).toFixed(3)}`
              : "-",
            linksClicks: linkClicks,
            ctrLinks:
              impressions && linkClicks
                ? `${((linkClicks / impressions) * 100).toFixed(2)}%`
                : "-",
            cpcLinks:
              linkClicks && spend
                ? `${currency}${(spend / linkClicks).toFixed(3)}`
                : "-",
            frequency: insights.frequency || "-",
            outboundClicks,
            uniqueOutboundClicks,
            outboundCTR,
            uniqueOutboundCTR,
            costperOutboundClick:
              outboundClicks && spend
                ? `${currency}${(spend / outboundClicks).toFixed(3)}`
                : "-",
            costperUniqueOutboundClick:
              uniqueOutboundClicks && spend
                ? `${currency}${(spend / uniqueOutboundClicks).toFixed(3)}`
                : "-",
          });
        });
        console.log("Processed adsets data:", rows);

        return rows;
      } catch (err) {
        console.error("AdSets fetch error:", err);
        // ── Update indicator: error ───────────────────────────────────────────
        setSyncStatus("error");
        return [];
      } finally {
        setIsLoading(false);
      }
    };

    async function load() {
      const adSets = await fetchAdSets(
        selectedAdAccountId,
        dateRange,
        pagination,
        syncData,
        selectedCampaignId
      );
      setData(adSets);
    }
    load();
  }, [selectedAdAccountId, selectedStatuses, dateRange, datePreset, pagination, syncData, selectedCampaignId]);

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
        accessorKey: "adsets",
        header: "Ad Sets",
        size: 300,
        enableGrouping: false,
        enableColumnOrdering: false,
        Cell: ({ cell, row }) => {
          const value = cell.getValue() || "-";
          const adsetsId = row.original.adsetsId || "-";

          return (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
                width: "100%",
                position: "relative",
                "&:hover .adsets-info": {
                  width: "150px",
                },
                "&:hover .adsets-actions": {
                  opacity: 1,
                  visibility: "visible",
                },
              }}
            >
              <Box
                className="adsets-info"
                sx={{
                  flex: "0 0 auto",
                  width: "100%",
                  minWidth: 0,
                  overflow: "hidden",
                  transition: "width 0.3s ease",
                }}
                onClick={() => {
                  if (onAdSetSelect) {
                    onAdSetSelect(adsetsId);
                    if (typeof window !== "undefined") {
                      window.dispatchEvent(
                        new CustomEvent("switchToAdsTab", {
                          detail: { adSetId: adsetsId }
                        })
                      );
                    }
                  }
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 500,
                    fontSize: "14px",
                    lineHeight: "16px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    "&:hover": {
                      color: "#6366F1",
                      textDecoration: "underline",
                    },
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
                  {adsetsId}
                </Typography>
              </Box>

              <Box
                className="adsets-actions"
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
                <Tooltip title="Edit Ad Set" arrow>
                  <IconButton
                    size="small"
                    sx={{
                      padding: "4px",
                      color: "#666",
                      "&:hover": { color: "#333" },
                    }}
                    onClick={() => console.log("Edit adset:", row.original)}
                  >
                    <EditIcon sx={{ fontSize: "16px" }} />
                  </IconButton>
                </Tooltip>

                <Tooltip title="Duplicate Ad Set" arrow>
                  <IconButton
                    size="small"
                    sx={{
                      padding: "4px",
                      color: "#666",
                      "&:hover": { color: "#333" },
                    }}
                    onClick={() => console.log("Copy adset:", row.original)}
                  >
                    <ContentCopyIcon sx={{ fontSize: "16px" }} />
                  </IconButton>
                </Tooltip>

                <Tooltip title="View Report" arrow>
                  <IconButton
                    size="small"
                    sx={{
                      padding: "4px",
                      color: "#666",
                      "&:hover": { color: "#333" },
                    }}
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
            Total: {totals.totalRows} AdSets
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
            if (status === "ACTIVE") return "#22c55e";
            if (status === "PAUSED") return "#f59e0b";
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
        accessorKey: "affiliatedCampaign",
        header: "Affiliated Campaign",
        size: 200,
        enableGrouping: false,
        enableColumnOrdering: false,
        Cell: ({ cell, row }) => {
          const value = cell.getValue() || "-";
          const adsetsId = row.original.adsetsId || "-";
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
                sx={{
                  color: "#666",
                  fontSize: "12px",
                  lineHeight: "14px",
                  display: "block",
                }}
              >
                {adsetsId}
              </Typography>
            </Box>
          );
        },
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            Total: {totals.totalRows} Affiliated campaign
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
                  sx={{
                    color: "#666",
                    fontSize: "10px",
                    lineHeight: "14px",
                    display: "block",
                  }}
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
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                lineHeight: "16px",
              }}
            >
              <Typography variant="body2" sx={{ fontSize: "12px" }}>
                {date || "-"}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: "#666", fontSize: "10px" }}
              >
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
            {currencySymbol}{totals.totalBudget.toFixed(2)} Daily
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
            {cell.getValue() || "-"}
          </Typography>
        ),
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            {currencySymbol}{totals.totalConsumption.toFixed(2)}
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
        Cell: ({ cell }) => (
          <Typography variant="body2" sx={{ fontSize: "12px" }}>
            {cell.getValue() || "-"}
          </Typography>
        ),
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            {currencySymbol}{totals.avgCostPerResult.toFixed(3)} avg
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
            {cell.getValue() || "-"}
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
            {cell.getValue() || "-"}
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
        Cell: ({ cell }) => (
          <Typography variant="body2" sx={{ fontSize: "12px" }}>
            {cell.getValue() || "-"}
          </Typography>
        ),
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            {currencySymbol}{totals.avgCPM.toFixed(2)} avg
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
            {cell.getValue() || "-"}
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
        Cell: ({ cell }) => (
          <Typography variant="body2" sx={{ fontSize: "12px" }}>
            {cell.getValue() || "-"}
          </Typography>
        ),
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
        Cell: ({ cell }) => (
          <Typography variant="body2" sx={{ fontSize: "12px" }}>
            {cell.getValue() || "-"}
          </Typography>
        ),
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            {currencySymbol}{totals.avgCPCAll.toFixed(3)} avg
          </Box>
        ),
      },
      {
        accessorKey: "cppAll",
        header: "CPP (all)",
        size: 150,
        Cell: ({ cell }) => (
          <Typography variant="body2" sx={{ fontSize: "12px" }}>
            {cell.getValue() || "-"}
          </Typography>
        ),
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            {currencySymbol}{totals.avgCPPAll.toFixed(3)} avg
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
            {cell.getValue() || "-"}
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
        Cell: ({ cell }) => (
          <Typography variant="body2" sx={{ fontSize: "12px" }}>
            {cell.getValue() || "-"}
          </Typography>
        ),
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
        Cell: ({ cell }) => (
          <Typography variant="body2" sx={{ fontSize: "12px" }}>
            {cell.getValue() || "-"}
          </Typography>
        ),
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            {currencySymbol}{totals.avgCPCLinks.toFixed(3)} avg
          </Box>
        ),
      },
      {
        accessorKey: "frequency",
        header: "Frequency",
        size: 170,
        Cell: ({ cell }) => (
          <Typography variant="body2" sx={{ fontSize: "12px" }}>
            {cell.getValue() || "-"}
          </Typography>
        ),
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            {totals.avgFrequency.toFixed(2)} avg
          </Box>
        ),
      },
      {
        accessorKey: "outboundClicks",
        header: (
          <>
            Outbound
            <br />
            Clicks
          </>
        ),
        size: 170,
        Cell: ({ cell }) => (
          <Typography variant="body2" sx={{ fontSize: "12px" }}>
            {cell.getValue() || "-"}
          </Typography>
        ),
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            {totals.totalOutboundClicks.toLocaleString()}
          </Box>
        ),
      },
      {
        accessorKey: "uniqueOutboundClicks",
        header: (
          <>
            Unique
            <br />
            Outbound Clicks
          </>
        ),
        size: 200,
        Cell: ({ cell }) => (
          <Typography variant="body2" sx={{ fontSize: "12px" }}>
            {cell.getValue() || "-"}
          </Typography>
        ),
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            {totals.totalUniqueOutboundClicks.toLocaleString()}
          </Box>
        ),
      },
      {
        accessorKey: "outboundCTR",
        header: (
          <>
            Outbound CTR (<br />
            Click-through rate)
          </>
        ),
        size: 200,
        Cell: ({ cell }) => (
          <Typography variant="body2" sx={{ fontSize: "12px" }}>
            {cell.getValue() || "-"}
          </Typography>
        ),
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            {totals.avgOutboundCTR.toFixed(2)}% avg
          </Box>
        ),
      },

      {
        accessorKey: "uniqueOutboundCTR",
        header: (
          <>
            Unique Outbound
            <br />
            CTR (Click-through rate)
          </>
        ),
        size: 200,
        Cell: ({ cell }) => (
          <Typography variant="body2" sx={{ fontSize: "12px" }}>
            {cell.getValue() || "-"}
          </Typography>
        ),
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            {totals.avgUniqueOutboundCTR.toFixed(2)}% avg
          </Box>
        ),
      },
      {
        accessorKey: "costperOutboundClick",
        header: (
          <>
            Cost per
            <br />
            Outbound click
          </>
        ),
        size: 200,
        Cell: ({ cell }) => (
          <Typography variant="body2" sx={{ fontSize: "12px" }}>
            {cell.getValue() || "-"}
          </Typography>
        ),
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            {currencySymbol}{totals.avgCostPerOutboundClick.toFixed(3)} avg
          </Box>
        ),
      },
      {
        accessorKey: "costperUniqueOutboundClick",
        header: (
          <>
            Cost per
            <br />
            Unique Outbound click
          </>
        ),
        size: 200,
        Cell: ({ cell }) => (
          <Typography variant="body2" sx={{ fontSize: "12px" }}>
            {cell.getValue() || "-"}
          </Typography>
        ),
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            {currencySymbol}{totals.avgCostPerUniqueOutboundClick.toFixed(3)} avg
          </Box>
        ),
      },
    ],
    [totals, currencySymbol]
  );

  const table = useMaterialReactTable({
    columns,
    data: filteredData,
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
    enableMultiRowSelection: false,
    enableDensityToggle: false,
    enableFullScreenToggle: false,
    manualPagination: true,
    rowCount: totalCount,
    onPaginationChange: setPagination,
    state: {
      pagination,
      rowSelection: selectedAdSetIds.reduce((acc, id) => ({ ...acc, [id]: true }), {}),
    },
    onRowSelectionChange: (updater) => {
      const newSelection = typeof updater === 'function'
        ? updater(selectedAdSetIds.reduce((acc, id) => ({ ...acc, [id]: true }), {}))
        : updater;
      setSelectedAdSetIds(Object.keys(newSelection));
    },
    getRowId: (row) => row.adsetsId,
    initialState: {
      density: "compact",
      pagination: { pageSize: 5, pageIndex: 0 },
      showGlobalFilter: true,
      columnPinning: { left: ["mrt-row-select", "onOff", "adsets"] },
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
        maxHeight: "360px",
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
                  width: 100,
                  height: 40,
                  bgcolor: "#E8E8FF",
                  borderRadius: "6px",
                  animation: "pulse 1.5s ease-in-out infinite",
                  "@keyframes pulse": {
                    "0%, 100%": { opacity: 1 },
                    "50%": { opacity: 0.5 },
                  },
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
                  {[40, 70, 0, 150, 200, 170].map((width, i) => (
                    <Box
                      key={i}
                      sx={{
                        width: width || undefined,
                        flex: width === 0 ? 1 : undefined,
                        height: 24,
                        bgcolor: "#E8E8E8",
                        borderRadius: "4px",
                        animation: "pulse 1.5s ease-in-out infinite",
                        animationDelay: `${row * 0.1}s`,
                      }}
                    />
                  ))}
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