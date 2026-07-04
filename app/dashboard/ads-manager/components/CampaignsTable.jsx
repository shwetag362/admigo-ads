import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  MaterialReactTable,
  useMaterialReactTable,
} from "material-react-table";
import { useSidebar } from "@/components/ui/sidebar";
import { useRouter } from "next/navigation";
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
import { DuplicateCampaignDialog } from "./DuplicateCampaignDialog";
import { notify } from "@/lib/toast";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";

// ─── Sync Status Indicator ────────────────────────────────────────────────────
// Shows real-time feedback: syncing (live), synced (cached), or error
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
        {/* Animated pulse dot */}
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
        {/* Spinner ring */}
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
        {/* Checkmark */}
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

export function CampaignsTable({ selectedAdAccountId, selectedMetaAccountId, dateRange, datePreset, syncData, onCampaignSelect }) {
  const { state } = useSidebar();
  console.log("CampaignsTable syncData:", syncData);
  console.log("CampaignsTable selectedAdAccountId:", selectedAdAccountId);
  console.log("CampaignsTable selectedMetaAccountId:", selectedMetaAccountId);
  const router = useRouter();
  const [adAccounts, setAdAccounts] = useState([]);
  const [selectedBidStrategy, setSelectedBidStrategy] = useState(null);
  const [selectedObjectives, setSelectedObjectives] = useState(null);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 5,
  });
  const [totalCount, setTotalCount] = useState(0);
  const [data, setData] = useState([]);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [selectedCampaignForDuplicate, setSelectedCampaignForDuplicate] = useState(null);
  const metaAccountIdRef = useRef(selectedMetaAccountId);
  const adAccountIdRef = useRef(selectedAdAccountId);
  // NEW: Currency state
  const [currencyInfo, setCurrencyInfo] = useState({
    code: 'USD',
    symbol: '$',
    decimals: 2,
    name: 'US Dollar'
  });

  // ── Sync indicator state ──────────────────────────────────────────────────
  // "syncing"  → API call in flight with sync=true
  // "synced"   → just completed a sync=true call successfully
  // "cached"   → completed a sync=false (cached) call
  // "error"    → last call failed
  // "idle"     → initial, no call yet
  const [syncStatus, setSyncStatus] = useState("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    metaAccountIdRef.current = selectedMetaAccountId;
  }, [selectedMetaAccountId]);

  useEffect(() => {
    adAccountIdRef.current = selectedAdAccountId;
  }, [selectedAdAccountId]);

  useEffect(() => {
    async function fetchAdAccounts() {
      try {
        const res = await fetch("/api/meta-accounts", {
          credentials: "include",
        });
        if (res.ok) {
          const { accounts } = await res.json();
          setAdAccounts(accounts);
        }
      } catch (err) {
        console.error("Error fetching accounts:", err);
      }
    }
    fetchAdAccounts();
  }, []);

  const handleDeleteCampaign = async () => {
    if (selectedCampaignIds.length === 0) return;

    console.log("🗑️ Delete initiated");
    console.log("Selected Campaign IDs:", selectedCampaignIds);
    console.log("Total campaigns to delete:", selectedCampaignIds.length);

    setIsDeleting(true);
    try {
      const requestBody = {
        campaignIds: selectedCampaignIds,
        permanent: true,
      };
      console.log("📤 Request Body:", JSON.stringify(requestBody, null, 2));

      const res = await fetch(`/api/meta/campaigns/bulk-delete`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Cookie: getSessionCookie(),
        },
        credentials: "include",
        body: JSON.stringify(requestBody),
      });

      console.log("📥 Response status:", res.status, res.statusText);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("❌ Delete failed:", err);
        throw new Error(err.message || "Failed to delete campaign");
      }

      const responseData = await res.json().catch(() => ({}));
      console.log("✅ Delete success response:", responseData);

      notify.success(
        selectedCampaignIds.length > 1
          ? `${selectedCampaignIds.length} campaigns deleted successfully!`
          : "Campaign deleted successfully!"
      );
      setDeleteDialogOpen(false);
      setSelectedCampaignIds([]);

      // ── After action: always sync=true ───────────────────────────────────
      console.log("🔄 Refetching table with sync: true (post-delete)…");
      const campaigns = await fetchCampaigns(selectedAdAccountId, selectedMetaAccountId, dateRange, pagination, true);
      console.log("📋 Refetched campaigns count:", campaigns.length);
      setData(campaigns.map(mapCampaignToRow));
    } catch (error) {
      console.error("💥 Error in handleDeleteCampaign:", error);
      notify.error(error.message || "Failed to delete campaign");
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePublishCampaign = async () => {
    const campaignId = selectedCampaignIds[0];
    console.log("🚀 Publish initiated");
    console.log("Selected Campaign IDs:", selectedCampaignIds);
    console.log("Campaign ID to publish:", campaignId);
    if (!campaignId) {
      console.error("❌ No campaign ID found — selectedCampaignIds is empty!");
      return;
    }
    setIsPublishing(true);
    try {
      const url = `/api/meta/campaign/${campaignId}/publish`;
      console.log("📤 Publish URL:", url);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: getSessionCookie(),
        },
        credentials: "include",
      });

      console.log("📥 Response status:", res.status, res.statusText);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("❌ Publish failed. Error from API:", err);

        // Show validation errors as formatted toast
        if (err.errors && Array.isArray(err.errors) && err.errors.length > 0) {
          const groupedErrors = err.errors.reduce((acc, e) => {
            const type = (e.type || "general").toUpperCase();
            if (!acc[type]) acc[type] = [];
            acc[type].push(e.message);
            return acc;
          }, {});

          const formattedMessage = Object.entries(groupedErrors)
            .map(([type, messages]) =>
              `[${type}]\n${messages.map((m) => `• ${m}`).join("\n")}`
            )
            .join("\n\n");

          notify.error(formattedMessage);
          setIsPublishing(false);
          return;
        }

        throw new Error(err.message || "Failed to publish campaign");
      }

      const responseData = await res.json().catch(() => ({}));
      console.log("✅ Publish success. Response:", responseData);

      notify.success("Campaign published successfully!");
      setPublishDialogOpen(false);
      setSelectedCampaignIds([]);

      // ── After action: always sync=true ───────────────────────────────────
      console.log("🔄 Refetching table with sync: true (post-publish)…");
      const campaigns = await fetchCampaigns(selectedAdAccountId, selectedMetaAccountId, dateRange, pagination, true);
      console.log("📋 Refetched campaigns count:", campaigns.length);
      setData(campaigns.map(mapCampaignToRow));
    } catch (error) {
      console.error("💥 Error in handlePublishCampaign:", error);
      notify.error(error.message || "Failed to publish campaign");
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePauseCampaign = async () => {
    const campaignId = selectedCampaignIds[0];
    console.log("⏸️ Pause initiated");
    console.log("Selected Campaign IDs:", selectedCampaignIds);
    console.log("Campaign ID to pause:", campaignId);
    if (!campaignId) {
      console.error("❌ No campaign ID found!");
      return;
    }

    setIsPausing(true);
    try {
      const url = `/api/meta/campaign/${campaignId}/pause`;
      console.log("📤 Pause URL:", url);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: getSessionCookie(),
        },
        credentials: "include",
      });

      console.log("📥 Pause response status:", res.status, res.statusText);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("❌ Pause failed:", err);
        throw new Error(err.message || "Failed to pause campaign");
      }

      const responseData = await res.json().catch(() => ({}));
      console.log("✅ Pause success:", responseData);

      notify.success("Campaign paused successfully!");
      setPauseDialogOpen(false);
      setSelectedCampaignIds([]);

      // ── After action: always sync=true ───────────────────────────────────
      const campaigns = await fetchCampaigns(selectedAdAccountId, selectedMetaAccountId, dateRange, pagination, true);
      setData(campaigns.map(mapCampaignToRow));
    } catch (error) {
      console.error("💥 Error in handlePauseCampaign:", error);
      notify.error(error.message || "Failed to pause campaign");
    } finally {
      setIsPausing(false);
    }
  };
  useEffect(() => {
    if (onCampaignSelect && selectedCampaignIds.length > 0) {
      onCampaignSelect(selectedCampaignIds[0]);
    } else if (onCampaignSelect) {
      onCampaignSelect(null);
    }
  }, [selectedCampaignIds, onCampaignSelect]);

  // NEW: Number formatting helper with locale support
  const formatNumberWithLocale = (value) => {
    const numValue = Number(value || 0);

    // Use appropriate locale based on currency
    const getNumberLocale = (currencyCode) => {
      if (currencyCode === 'INR') return 'en-IN'; // Indian numbering (1,23,456)
      return 'en-US'; // International numbering (123,456)
    };

    try {
      return numValue.toLocaleString(getNumberLocale(currencyInfo.code));
    } catch {
      return numValue.toLocaleString('en-US');
    }
  };

  // NEW: Currency formatting helper with locale support
  const formatCurrency = (amount, decimals = null) => {
    const decimalPlaces = decimals !== null ? decimals : currencyInfo.decimals;
    const numAmount = parseFloat(amount) || 0;

    // Determine locale based on currency
    const getLocale = (currencyCode) => {
      const localeMap = {
        'INR': 'en-IN',  // Indian Rupee - Indian format (₹1,23,456.78)
        'USD': 'en-US',  // US Dollar
        'EUR': 'de-DE',  // Euro - German format
        'GBP': 'en-GB',  // British Pound
        'JPY': 'ja-JP',  // Japanese Yen
        'CNY': 'zh-CN',  // Chinese Yuan
        'AUD': 'en-AU',  // Australian Dollar
        'CAD': 'en-CA',  // Canadian Dollar
        'SGD': 'en-SG',  // Singapore Dollar
        'HKD': 'zh-HK',  // Hong Kong Dollar
        'MYR': 'ms-MY',  // Malaysian Ringgit
        'THB': 'th-TH',  // Thai Baht
        'IDR': 'id-ID',  // Indonesian Rupiah
        'PHP': 'en-PH',  // Philippine Peso
        'VND': 'vi-VN',  // Vietnamese Dong
        'KRW': 'ko-KR',  // South Korean Won
        'BRL': 'pt-BR',  // Brazilian Real
        'MXN': 'es-MX',  // Mexican Peso
        'ZAR': 'en-ZA',  // South African Rand
        'AED': 'ar-AE',  // UAE Dirham
        'SAR': 'ar-SA',  // Saudi Riyal
      };
      return localeMap[currencyCode] || 'en-US';
    };

    try {
      const locale = getLocale(currencyInfo.code);
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyInfo.code,
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      }).format(numAmount);
    } catch (error) {
      // Fallback: Manual formatting with currency symbol
      console.warn(`Currency formatting failed for ${currencyInfo.code}, using fallback`);

      // For INR, use Indian numbering system manually
      if (currencyInfo.code === 'INR') {
        const formatted = numAmount.toLocaleString('en-IN', {
          minimumFractionDigits: decimalPlaces,
          maximumFractionDigits: decimalPlaces,
        });
        return `₹${formatted}`;
      }

      return `${currencyInfo.symbol}${numAmount.toFixed(decimalPlaces)}`;
    }
  };
  // Filter data by selected objective
  const filteredData = useMemo(() => {
    if (!selectedObjectives) return data;
    return data.filter((row) => {
      const rowObjective = (row.objective || "").toLowerCase().replace("outcome_", "");
      const selected = selectedObjectives.toLowerCase();
      return rowObjective === selected || rowObjective.includes(selected);
    });
  }, [data, selectedObjectives]);

  const totals = useMemo(() => {
    const parse = (s) => parseFloat(s?.replace(/[^0-9.]/g, "") || 0);
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
      avgCPP: avg(totalConsumption, totalResults),
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

  const getSessionCookie = () => {
    if (typeof document === "undefined") return "";

    const token = document.cookie
      .split("; ")
      .find((row) => row.startsWith("authjs.session-token="))
      ?.split("=")[1];

    return token ? `authjs.session-token=${token}` : "";
  };



  // ── fetchCampaigns: sync=true on EVERY call ───────────────────────────────
  // The `sync` parameter is kept for backward-compat but internally we always
  // force sync=true. The indicator tells the user whether the current fetch is
  // a live sync or served from cache (only relevant if your backend has its own
  // caching layer — if not, every call will just show "Syncing → Synced").
  const fetchCampaigns = async (accountId, metaAccountId, dateRange, paginationState, sync = true) => {
    // Always force sync=true — every GET must pull live data from Meta
    const forceSync = true;

    // Update indicator: show "syncing" while request is in-flight
    setSyncStatus("syncing");

    setIsLoading(true);
    try {
      const params = new URLSearchParams();

      if (accountId) {
        params.append("accountId", accountId);
      }

      params.append("insights", "true");

      if (selectedStatuses.length > 0) {
        const apiStatuses = selectedStatuses.map((status) => {
          if (status === "Active") return "ACTIVE";
          if (status === "Paused") return "PAUSED";
          return status;
        });
        params.append("status", apiStatuses.join(","));
      }

      // ── Always append sync=true ───────────────────────────────────────────
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

      const url = `/api/meta/campaigns?${params.toString()}`;
      console.log("Fetching campaigns with URL:", url);

      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Cookie: getSessionCookie(),
        },
        credentials: "include",
      });

      const json = await res.json();
      console.log("Campaigns API response:", json);
      // NEW: Extract and set currency info from response
      if (json.currency) {
        console.log("💰 Currency received from backend:", json.currency);
        setCurrencyInfo(json.currency);
      }

      // NEW: Set total count from pagination
      if (json.pagination) {
        setTotalCount(json.pagination.total);
      }

      // ── Update indicator: synced or cached ───────────────────────────────
      // If your backend returns a header/flag indicating cache hit, use it.
      // Otherwise we treat every successful response as "synced" (live).
      const wasCached = json.cached === true; // optional: backend can set this
      setSyncStatus(wasCached ? "cached" : "synced");
      setLastSyncedAt(new Date());
      console.log(`✅ [Sync] Status → ${wasCached ? "cached" : "synced"} at ${new Date().toLocaleTimeString()}`);

      return json.data || [];
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      // ── Update indicator: error ───────────────────────────────────────────
      setSyncStatus("error");
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const mapCampaignToRow = (campaign) => {
    const insights = campaign.insights || {};
    const account = campaign.account || {};
    const campaignCurrency = campaign.currency || currencyInfo.code;

    // NEW: Use campaign's currency for budget display
    let budgetDisplay = formatCurrency(0);
    if (campaign.daily_budget || campaign.lifetime_budget) {
      const daily = campaign.daily_budget
        ? parseFloat(campaign.daily_budget) / 100
        : 0;
      const lifetime = campaign.lifetime_budget
        ? parseFloat(campaign.lifetime_budget) / 100
        : 0;
      budgetDisplay =
        daily > 0
          ? `${formatCurrency(daily)} Daily`
          : lifetime > 0
            ? `${formatCurrency(lifetime)} Lifetime`
            : formatCurrency(0);
    } else {
      budgetDisplay = "Using ad set budget";
    }

    const num = (v) => Number(v || 0);
    const percent = (v) => `${num(v).toFixed(2)}%`;
    const money = (v) => formatCurrency(num(v)); // NEW: Use formatCurrency

    const outboundClicks = insights?.outbound_clicks?.[0]?.value
      ? num(insights.outbound_clicks[0].value)
      : 0;

    const uniqueOutboundClicks = num(insights.unique_clicks);

    const outboundCTR = insights.impressions
      ? (outboundClicks / num(insights.impressions)) * 100
      : 0;

    const uniqueOutboundCTR = insights.reach
      ? (uniqueOutboundClicks / num(insights.reach)) * 100
      : 0;

    const costPerOutboundClick =
      outboundClicks > 0 ? num(insights.spend) / outboundClicks : 0;

    const costPerUniqueOutboundClick =
      uniqueOutboundClicks > 0 ? num(insights.spend) / uniqueOutboundClicks : 0;

    return {
      id: campaign.id,
      onOff: campaign.status === "ACTIVE",
      campaign: campaign.name,
      campaignId: campaign.id,

      // NEW: Enhanced status with effective_status
      status: campaign.effective_status || campaign.status || "-",
      deliveryStatus: campaign.campaign_delivery_status || "-",

      account: account.name || "-",
      accountId: account.id || "-",
      accountCurrency: campaignCurrency, // NEW

      objective: campaign.objective?.replace("OUTCOME_", "") || "-",
      bidStrategy: campaign.bid_strategy || "Using ad set bid strategy", // NEW: Use actual bid strategy

      ends: campaign.stop_time || "Ongoing",

      dateCreated: campaign.created_time
        ? new Date(campaign.created_time)
          .toLocaleString("en-GB", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          })
          .replace(",", "")
        : "-",

      budget: budgetDisplay,
      advertisingConsumption: money(insights.spend),

      results:
        insights.actions?.find((a) => a.action_type === "landing_page_view")?.value ||
        "0",

      costPerResult: insights.cost_per_action_type?.find(
        (a) => a.action_type === "landing_page_view"
      )?.value
        ? money(
          insights.cost_per_action_type.find(
            (a) => a.action_type === "landing_page_view"
          ).value
        )
        : formatCurrency(0),

      // NEW: Use formatNumberWithLocale for all numeric values
      impressions: formatNumberWithLocale(insights.impressions),
      reach: formatNumberWithLocale(insights.reach),
      cpm: money(insights.cpm),
      clicks: formatNumberWithLocale(insights.clicks),
      ctrAll: percent(insights.ctr),
      cpcAll: money(insights.cpc),
      cpp: money(insights.cpp),
      linksClicks: formatNumberWithLocale(insights.inline_link_clicks),
      ctrLinks: insights.website_ctr?.[0]?.value
        ? percent(insights.website_ctr[0].value)
        : "0%",
      cpcLinks: money(insights.cost_per_inline_link_click),
      frequency: num(insights.frequency).toFixed(2),
      outboundClicks: formatNumberWithLocale(outboundClicks),
      uniqueOutboundClicks: formatNumberWithLocale(uniqueOutboundClicks),
      outboundCTR: `${outboundCTR.toFixed(2)}%`,
      uniqueOutboundCTR: `${uniqueOutboundCTR.toFixed(2)}%`,
      costperOutboundClick: money(costPerOutboundClick),
      costperUniqueOutboundClick: money(costPerUniqueOutboundClick),

      // NEW: Additional fields from enhanced API
      budgetRemaining: campaign.budget_remaining ? money(campaign.budget_remaining / 100) : "-",
      updatedTime: campaign.updated_time || "-",
      startTime: campaign.start_time || "-",
      adsetsCount: campaign.adsets_count || 0,
    };
  };

  useEffect(() => {
    async function load() {
      // sync=true is now always forced inside fetchCampaigns,
      // but we still pass `syncData` for backward-compat logging
      const campaigns = await fetchCampaigns(
        selectedAdAccountId,
        selectedMetaAccountId,
        dateRange,
        pagination,
        syncData   // ignored internally — kept for prop compat
      );
      const mapped = campaigns.map(mapCampaignToRow);
      setData(mapped);
    }

    load();
  }, [selectedAdAccountId, selectedMetaAccountId, selectedStatuses, dateRange, pagination, syncData]);




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
        accessorKey: "campaign",
        header: "Campaign",
        size: 300,
        enableGrouping: false,
        enableColumnOrdering: false,
        Cell: ({ cell, row }) => {
          const value = cell.getValue() || "-";
          const campaignId = row.original.campaignId || "-";
          const currency = row.original.accountCurrency || currencyInfo.code;

          return (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
                width: "100%",
                position: "relative",
                "&:hover .campaign-info": {
                  width: "150px",
                },
                "&:hover .campaign-actions": {
                  opacity: 1,
                  visibility: "visible",
                },
              }}
            >
              <Box
                className="campaign-info"
                sx={{
                  flex: "0 0 auto",
                  width: "100%",
                  minWidth: 0,
                  overflow: "hidden",
                  transition: "width 0.3s ease",
                }}
                onClick={() => {
                  if (onCampaignSelect) {
                    onCampaignSelect(campaignId);
                    if (typeof window !== "undefined") {
                      window.dispatchEvent(
                        new CustomEvent("switchToAdSetsTab", {
                          detail: { campaignId }
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
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.25 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "#666",
                      fontSize: "12px",
                      lineHeight: "14px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {campaignId}
                  </Typography>
                  {/* NEW: Currency badge */}
                  <Chip
                    label={currency}
                    size="small"
                    sx={{
                      height: "16px",
                      fontSize: "10px",
                      fontWeight: 600,
                      bgcolor: "#FEF3C7",
                      color: "#92400E",
                      "& .MuiChip-label": {
                        px: 0.75,
                      },
                    }}
                  />
                </Box>
              </Box>

              <Box
                className="campaign-actions"
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
                <Tooltip title="Edit Campaign" arrow>
                  <IconButton
                    size="small"
                    sx={{
                      padding: "4px",
                      color: "#666",
                      "&:hover": { color: "#333" },
                    }}
                    onClick={() => console.log("Edit campaign:", row.original)}
                  >
                    <EditIcon sx={{ fontSize: "16px" }} />
                  </IconButton>
                </Tooltip>

                <Tooltip title="Duplicate Campaign" arrow>
                  <IconButton
                    size="small"
                    sx={{
                      padding: "4px",
                      color: "#666",
                      "&:hover": { color: "#333" },
                    }}
                    onClick={() => {
                      setSelectedCampaignForDuplicate({
                        ...row.original,
                        adAccountId: row.original.accountId,  // ← ye add karo
                      }); setDuplicateDialogOpen(true);
                    }}
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
                    onClick={() => {
                      router.push(
                        `/dashboard/ads-reporting?campaignId=${row.original.campaignId}`
                      );
                    }}
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
            Total: {totals.totalRows} Campaigns
          </Box>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 150,
        Cell: ({ cell, row }) => {
          const status = cell.getValue() || "-";
          const deliveryStatus = row.original.deliveryStatus;

          const getColor = () => {
            if (status === "ACTIVE") return "#22c55e";
            if (status === "PAUSED") return "#f59e0b";
            return "#6b7280";
          };

          return (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <span style={{ color: getColor(), fontSize: "10px" }}>●</span>
                <Typography variant="body2" sx={{ fontSize: "12px", fontWeight: 500 }}>
                  {status}
                </Typography>
              </Box>
              {deliveryStatus !== "-" && (
                <Typography variant="caption" sx={{ fontSize: "10px", color: "#666" }}>
                  {deliveryStatus}
                </Typography>
              )}
            </Box>
          );
        },
        Footer: () => <Box sx={{ fontSize: "12px" }}>-</Box>,
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
            objective === "Engagement" || objective === "ENGAGEMENT"
              ? "💬"
              : objective === "Sales" || objective === "SALES"
                ? "🎯"
                : objective === "App Promotions" || objective === "APP_PROMOTION"
                  ? "📱"
                  : objective === "AWARENESS"
                    ? "👁️"
                    : objective === "TRAFFIC"
                      ? "🚗"
                      : objective === "LEADS"
                        ? "📋"
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
        Cell: ({ cell }) => {
          const value = cell.getValue();
          if (!value || value === "Ongoing") {
            return (
              <Typography variant="body2" sx={{ fontSize: "12px" }}>
                Ongoing
              </Typography>
            );
          }
          const date = new Date(value).toLocaleDateString("en-GB");
          return (
            <Typography variant="body2" sx={{ fontSize: "12px" }}>
              {date}
            </Typography>
          );
        },
        Footer: () => <Box sx={{ fontSize: "12px" }}>-</Box>,
      },
      {
        accessorKey: "dateCreated",
        header: "Date created",
        size: 180,
        Cell: ({ cell }) => {
          const value = cell.getValue();
          if (!value || value === "-")
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
            {/* {data.some((row) => row.budget.includes("Using ad set budget"))
             */}
            {filteredData.some((row) => row.budget.includes("Using ad set budget"))

              ? "Using ad set budget"
              : formatCurrency(totals.totalBudget)}
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
        size: 150,
        Cell: ({ cell }) => (
          <Typography variant="body2" sx={{ fontSize: "12px" }}>
            {cell.getValue() || "-"}
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
            {formatNumberWithLocale(totals.totalResults)}
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
            {formatCurrency(totals.avgCostPerResult, 3)} avg
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
            {formatNumberWithLocale(totals.totalImpressions)}
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
            {formatNumberWithLocale(totals.totalReach)}
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
            {cell.getValue() || "-"}
          </Typography>
        ),
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            {formatNumberWithLocale(totals.totalClicks)}
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
            {formatCurrency(totals.avgCPCAll, 3)} avg
          </Box>
        ),
      },
      {
        accessorKey: "cpp",
        header: "CPP (all)",
        size: 150,
        Cell: ({ cell }) => (
          <Typography variant="body2" sx={{ fontSize: "12px" }}>
            {cell.getValue() || "-"}
          </Typography>
        ),
        Footer: () => (
          <Box sx={{ fontWeight: 600, fontSize: "12px", color: "#333" }}>
            {formatCurrency(totals.avgCPP, 3)} avg
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
            {formatNumberWithLocale(totals.totalLinksClicks)}
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
            {formatCurrency(totals.avgCPCLinks, 3)} avg
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
    ],
    [totals, router, currencyInfo, formatCurrency, formatNumberWithLocale]
  );

  const table = useMaterialReactTable({
    columns,
    // data,
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
    enableMultiRowSelection: true,
    enableDensityToggle: false,
    enableFullScreenToggle: false,
    manualPagination: true,
    rowCount: totalCount,
    onPaginationChange: setPagination,
    state: {
      pagination,
      rowSelection: selectedCampaignIds.reduce((acc, id) => ({ ...acc, [id]: true }), {}),
    },
    onRowSelectionChange: (updater) => {
      const newSelection = typeof updater === 'function'
        ? updater(selectedCampaignIds.reduce((acc, id) => ({ ...acc, [id]: true }), {}))
        : updater;
      setSelectedCampaignIds(Object.keys(newSelection));
    },
    getRowId: (row) => row.campaignId,

    initialState: {
      density: "compact",
      pagination: { pageSize: 5, pageIndex: 0 },
      showGlobalFilter: true,
      columnPinning: { left: ["mrt-row-select", "onOff", "campaign"] },
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
      sx: { border: "0.25px solid rgba(81, 81, 81, 0.1)", fontWeight: 600, fontSize: "13px", },

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

        {/* NEW: Currency indicator in toolbar */}
        <Chip
          label={`Currency: ${currencyInfo.code} (${currencyInfo.symbol})`}
          size="small"
          icon={<Box sx={{ fontSize: "14px" }}>💰</Box>}
          sx={{
            height: 32,
            fontSize: "0.75rem",
            fontWeight: 600,
            bgcolor: "#FEF3C7",
            color: "#92400E",
            border: "1px solid #FCD34D",
            "& .MuiChip-label": {
              px: 1,
            },
          }}
        />

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            const matched = adAccounts.find(
              (acc) => acc.id === adAccountIdRef.current
            );
            const resolvedMetaAccountId =
              matched?.metaAccountId ?? metaAccountIdRef.current;
            router.push(
              `/dashboard/ads-manager/create-ads-manager?adAccountId=${adAccountIdRef.current}&metaAccountId=${resolvedMetaAccountId || metaAccountIdRef.current}`
            );
          }}
          sx={{
            height: 35,
            fontSize: "0.85rem",
            borderRadius: "6px",
            backgroundColor: "#6366F1",
            textTransform: "none",
            fontWeight: 500,
            "&:hover": {
              backgroundColor: "#4F46E5",
            },
          }}
        >
          Create
        </Button>

        <Tooltip title={selectedCampaignIds.length === 0 ? "Select a campaign to delete" : "Delete"} arrow>
          <span>
            <IconButton
              disabled={selectedCampaignIds.length === 0}
              onClick={() => setDeleteDialogOpen(true)}
              sx={{
                width: 40,
                height: 35,
                borderRadius: "6px",
                backgroundColor: "#F5F5F5",
                border: "1px solid #E0E0E0",
                "&:hover": { backgroundColor: "#EEEEEE" },
                "&.Mui-disabled": { opacity: 0.4 },
              }}
            >
              <DeleteOutlineIcon sx={{ fontSize: 20, color: "#757575" }} />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title={selectedCampaignIds.length === 0 ? "Select a campaign to pause" : "Pause"} arrow>
          <span>
            <IconButton
              disabled={selectedCampaignIds.length === 0}
              onClick={() => setPauseDialogOpen(true)}
              sx={{
                width: 40,
                height: 35,
                borderRadius: "6px",
                backgroundColor: "#F5F5F5",
                border: "1px solid #E0E0E0",
                "&:hover": { backgroundColor: "#EEEEEE" },
                "&.Mui-disabled": { opacity: 0.4 },
              }}
            >
              <PauseCircleOutlineIcon sx={{ fontSize: 20, color: "#757575" }} />
            </IconButton>
          </span>
        </Tooltip>

        {/* <Tooltip title="Start" arrow>
          <IconButton
            sx={{
              width: 40,
              height: 35,
              borderRadius: "6px",
              backgroundColor: "#F5F5F5",
              border: "1px solid #E0E0E0",
              "&:hover": {
                backgroundColor: "#EEEEEE",
              },
            }}
          >
            <PlayCircleOutlineIcon sx={{ fontSize: 20, color: "#757575" }} />
          </IconButton>
        </Tooltip> */}

        <Tooltip title="Edit" arrow>
          <IconButton
            sx={{
              width: 40,
              height: 35,
              borderRadius: "6px",
              backgroundColor: "#F5F5F5",
              border: "1px solid #E0E0E0",
              "&:hover": {
                backgroundColor: "#EEEEEE",
              },
            }}
          >
            <DriveFileRenameOutlineIcon
              sx={{ fontSize: 20, color: "#757575" }}
            />
          </IconButton>
        </Tooltip>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          disabled={selectedCampaignIds.length === 0}
          onClick={() => setPublishDialogOpen(true)}
          sx={{
            height: 35,
            fontSize: "0.85rem",
            borderRadius: "6px",
            backgroundColor: "#6366F1",
            borderColor: "#6366F1",
            textTransform: "none",
            fontWeight: 500,
            "&:hover": {
              backgroundColor: "#4F46E5",
            },
          }}
        >
          Publish
        </Button>


        {/* <Autocomplete
          size="small"
          options={["Maximum quantity", "Cost-per-performance goal", "Null"]}
          value={selectedBidStrategy}
          onChange={(e, newValue) => setSelectedBidStrategy(newValue)}
          sx={{
            width: 192,
            "& .MuiOutlinedInput-root": {
              height: 40,
              fontSize: "0.85rem",
              borderRadius: "6px",
              "& fieldset": {
                backgroundColor: "#00000003",
                borderColor: "#E0E0E0",
              },
              "&:hover fieldset": {
                borderColor: "#BDBDBD",
              },
              "&.Mui-focused fieldset": {
                borderColor: "#6366F1",
              },
            },
            "& .MuiInputLabel-root": {
              fontSize: "0.8rem",
              color: "#757575",
              "&.Mui-focused": {
                color: "#6366F1",
              },
            },
          }}
          renderInput={(params) => (
            <TextField {...params} label="Bid Strategy" variant="outlined" />
          )}
          renderOption={(props, option) => {
            const { key, ...otherProps } = props;
            return (
              <li
                key={key}
                {...otherProps}
                style={{
                  whiteSpace: "normal",
                  wordBreak: "break-word",
                  lineHeight: "1.2rem",
                  paddingTop: "6px",
                  paddingBottom: "6px",
                }}
                title={option}
              >
                {option}
              </li>
            );
          }}
        /> */}


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
              "& fieldset": {
                backgroundColor: "#00000003",
                borderColor: "#E0E0E0",
              },
              "&:hover fieldset": {
                borderColor: "#BDBDBD",
              },
              "&.Mui-focused fieldset": {
                borderColor: "#6366F1",
              },
            },
            "& .MuiInputLabel-root": {
              fontSize: "0.8rem",
              color: "#757575",
              "&.Mui-focused": {
                color: "#6366F1",
              },
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
          onChange={(e, newValue) =>
            setSelectedStatuses(newValue ? [newValue] : [])
          }
          sx={{
            width: 160,
            "& .MuiOutlinedInput-root": {
              height: 35,
              fontSize: "0.85rem",
              borderRadius: "6px",
              "& fieldset": {
                backgroundColor: "#00000003",
                borderColor: "#E0E0E0",
              },
              "&:hover fieldset": {
                borderColor: "#BDBDBD",
              },
              "&.Mui-focused fieldset": {
                borderColor: "#6366F1",
              },
            },
            "& .MuiInputLabel-root": {
              fontSize: "0.8rem",
              color: "#757575",
              "&.Mui-focused": {
                color: "#6366F1",
              },
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
            {/* Toolbar skeleton */}
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

            {/* Table skeleton */}
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
                <Box
                  sx={{
                    width: 40,
                    height: 36,
                    bgcolor: "#F0F0F0",
                    borderRadius: "4px",
                  }}
                />
                <Box
                  sx={{
                    width: 70,
                    height: 36,
                    bgcolor: "#F0F0F0",
                    borderRadius: "4px",
                  }}
                />
                <Box
                  sx={{
                    flex: 1,
                    height: 36,
                    bgcolor: "#F0F0F0",
                    borderRadius: "4px",
                  }}
                />
                <Box
                  sx={{
                    width: 150,
                    height: 36,
                    bgcolor: "#F0F0F0",
                    borderRadius: "4px",
                  }}
                />
                <Box
                  sx={{
                    width: 200,
                    height: 36,
                    bgcolor: "#F0F0F0",
                    borderRadius: "4px",
                  }}
                />
                <Box
                  sx={{
                    width: 170,
                    height: 36,
                    bgcolor: "#F0F0F0",
                    borderRadius: "4px",
                  }}
                />
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
                  <Box
                    sx={{
                      width: 40,
                      height: 24,
                      bgcolor: "#E8E8E8",
                      borderRadius: "4px",
                      animation: "pulse 1.5s ease-in-out infinite",
                      animationDelay: `${row * 0.1}s`,
                    }}
                  />
                  <Box
                    sx={{
                      width: 70,
                      height: 24,
                      bgcolor: "#E8E8E8",
                      borderRadius: "4px",
                      animation: "pulse 1.5s ease-in-out infinite",
                      animationDelay: `${row * 0.1}s`,
                    }}
                  />
                  <Box
                    sx={{
                      flex: 1,
                      height: 24,
                      bgcolor: "#E8E8E8",
                      borderRadius: "4px",
                      animation: "pulse 1.5s ease-in-out infinite",
                      animationDelay: `${row * 0.1}s`,
                    }}
                  />
                  <Box
                    sx={{
                      width: 150,
                      height: 24,
                      bgcolor: "#E8E8E8",
                      borderRadius: "4px",
                      animation: "pulse 1.5s ease-in-out infinite",
                      animationDelay: `${row * 0.1}s`,
                    }}
                  />
                  <Box
                    sx={{
                      width: 200,
                      height: 24,
                      bgcolor: "#E8E8E8",
                      borderRadius: "4px",
                      animation: "pulse 1.5s ease-in-out infinite",
                      animationDelay: `${row * 0.1}s`,
                    }}
                  />
                  <Box
                    sx={{
                      width: 170,
                      height: 24,
                      bgcolor: "#E8E8E8",
                      borderRadius: "4px",
                      animation: "pulse 1.5s ease-in-out infinite",
                      animationDelay: `${row * 0.1}s`,
                    }}
                  />
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
              <Box
                sx={{
                  width: 120,
                  height: 32,
                  bgcolor: "#F0F0F0",
                  borderRadius: "4px",
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              />
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
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !isDeleting && setDeleteDialogOpen(false)}
        PaperProps={{
          sx: { borderRadius: "12px", minWidth: "420px", p: 1 },
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: "16px", pb: 1 }}>
          Do you want to delete the campaign?
          <IconButton
            onClick={() => setDeleteDialogOpen(false)}
            disabled={isDeleting}
            sx={{ position: "absolute", right: 12, top: 12, color: "#666" }}
          >
            ✕
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: "4px !important" }}>
          <Typography variant="body2" sx={{ color: "#555", fontSize: "14px" }}>
            If you delete this campaign, you won't be able to recover it later.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            disabled={isDeleting}
            variant="outlined"
            sx={{
              borderRadius: "8px",
              textTransform: "none",
              fontWeight: 500,
              borderColor: "#ccc",
              color: "#333",
              "&:hover": { borderColor: "#999", backgroundColor: "#f5f5f5" },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteCampaign}
            disabled={isDeleting}
            variant="contained"
            sx={{
              borderRadius: "8px",
              textTransform: "none",
              fontWeight: 500,
              backgroundColor: "#6366F1",
              "&:hover": { backgroundColor: "#6366F1" },
            }}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Publish Confirmation Dialog */}
      <Dialog
        open={publishDialogOpen}
        onClose={() => !isPublishing && setPublishDialogOpen(false)}
        PaperProps={{
          sx: { borderRadius: "12px", minWidth: "420px", p: 1 },
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: "16px", pb: 1 }}>
          Do you want to publish the campaign?
          <IconButton
            onClick={() => setPublishDialogOpen(false)}
            disabled={isPublishing}
            sx={{ position: "absolute", right: 12, top: 12, color: "#666" }}
          >
            ✕
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: "4px !important" }}>
          <Typography variant="body2" sx={{ color: "#555", fontSize: "14px" }}>
            This will publish the selected campaign and make it live. Are you sure you want to continue?
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setPublishDialogOpen(false)}
            disabled={isPublishing}
            variant="outlined"
            sx={{
              borderRadius: "8px",
              textTransform: "none",
              fontWeight: 500,
              borderColor: "#ccc",
              color: "#333",
              "&:hover": { borderColor: "#999", backgroundColor: "#f5f5f5" },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handlePublishCampaign}
            disabled={isPublishing}
            variant="contained"
            sx={{
              borderRadius: "8px",
              textTransform: "none",
              fontWeight: 500,
              backgroundColor: "#6366F1",
              "&:hover": { backgroundColor: "#4F46E5" },
            }}
          >
            {isPublishing ? "Publishing..." : "Publish"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Pause Confirmation Dialog */}
      <Dialog
        open={pauseDialogOpen}
        onClose={() => !isPausing && setPauseDialogOpen(false)}
        PaperProps={{
          sx: { borderRadius: "12px", minWidth: "420px", p: 1 },
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: "16px", pb: 1 }}>
          Do you want to pause the campaign?
          <IconButton
            onClick={() => setPauseDialogOpen(false)}
            disabled={isPausing}
            sx={{ position: "absolute", right: 12, top: 12, color: "#666" }}
          >
            ✕
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: "4px !important" }}>
          <Typography variant="body2" sx={{ color: "#555", fontSize: "14px" }}>
            This will pause the selected campaign. You can resume it anytime.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setPauseDialogOpen(false)}
            disabled={isPausing}
            variant="outlined"
            sx={{
              borderRadius: "8px",
              textTransform: "none",
              fontWeight: 500,
              borderColor: "#ccc",
              color: "#333",
              "&:hover": { borderColor: "#999", backgroundColor: "#f5f5f5" },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handlePauseCampaign}
            disabled={isPausing}
            variant="contained"
            sx={{
              borderRadius: "8px",
              textTransform: "none",
              fontWeight: 500,
              backgroundColor: "#6366F1",
              "&:hover": { backgroundColor: "#4F46E5" },
            }}
          >
            {isPausing ? "Pausing..." : "Pause"}
          </Button>
        </DialogActions>
      </Dialog>
      <DuplicateCampaignDialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
        campaignData={selectedCampaignForDuplicate}
      />
    </div>
  );
}

export default CampaignsTable;