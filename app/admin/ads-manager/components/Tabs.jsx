import React, { useState, useEffect } from "react";
import { Folder, Layers, MonitorPlay } from "lucide-react";
import { Box, Button, TextField, Autocomplete, Typography, IconButton, Tooltip, Badge, Chip } from "@mui/material";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";
import AddToQueueIcon from "@mui/icons-material/AddToQueue";
import ComplianceDialog from "./Compliancedialog";


export default function TabsComponent({
  activeTab,
  setActiveTab,
  onRefresh,
  onDownload,
  onReviewPublish,
  onBatchCreation,
  onAdAccountChange,
  onDateRangeChange,
  onSyncChange,
  selectedCampaignId,
  selectedAdSetId
}) {
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(30, "days"),
    dayjs(),
  ]);

  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [adAccounts, setAdAccounts] = useState([]);
  const [datePreset, setDatePreset] = useState('last_30d');
  const [complianceOpen, setComplianceOpen] = useState(false);

  console.log("Selected Ad Account in TabsComponent:", selectedAccount);
  const { RangePicker } = DatePicker;

  const chipStyles = {
    height: '28px',
    fontSize: '0.85rem',
    backgroundColor: '#EEF2FF',
    color: '#6366F1',
    fontWeight: 500,
    borderRadius: '8px',
    '& .MuiChip-label': {
      padding: '0 12px',
    },
    '& .MuiChip-deleteIcon': {
      color: '#6366F1',
      fontSize: '18px',
      margin: '0 6px 0 -4px',
      '&:hover': {
        color: '#4F46E5',
      },
    },
  };


  const tabs = [
    { key: "campaigns", label: "Campaigns", icon: Folder },
    { key: "adsets", label: "Ad Sets", icon: Layers },
    { key: "ads", label: "Ads", icon: MonitorPlay },
  ];


React.useEffect(() => {
  async function fetchAdAccounts() {
    try {
      const res = await fetch("/api/meta-accounts", {
        credentials: "include",
      });

      if (res.ok) {
        const { accounts } = await res.json();
        setAdAccounts(accounts);

        if (accounts && accounts.length > 0 && !selectedAccount) {
          setSelectedAccount(accounts[0]);
          onAdAccountChange?.(
            accounts[0]?.id || null,
            accounts[0]?.metaAccountId || null
          );
          if (accounts[0]?.id) {
            setComplianceOpen(true);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching accounts:", err);
    }
  }

  fetchAdAccounts();
}, []); 
  console.log("Ad Accounts in TabsComponent:", adAccounts);
  console.log("Selected Account in TabsComponent:", selectedAccount);

  const handleDateRangeChange = (values) => {
    setDateRange(values);

    if (onDateRangeChange && values && values.length === 2) {
      const since = values[0].format("YYYY-MM-DD");
      const until = values[1].format("YYYY-MM-DD");
      const today = dayjs().format("YYYY-MM-DD");

      let preset = null;

      if (since === dayjs().subtract(7, "days").format("YYYY-MM-DD") && until === today) {
        preset = 'last_7d';
      } else if (since === dayjs().subtract(30, "days").format("YYYY-MM-DD") && until === today) {
        preset = 'last_30d';
      } else if (since === dayjs().subtract(90, "days").format("YYYY-MM-DD") && until === today) {
        preset = 'last_90d';
      }

      // Pass values and preset SEPARATELY, not as an object
      onDateRangeChange(values, preset);
    }
  };

  const handleRefreshClick = () => {
    if (onSyncChange) {
      onSyncChange(true);
    }
    if (onRefresh) {
      onRefresh();
    }
  };
  useEffect(() => {
    if (selectedAccount?.id) {
      setComplianceOpen(true);
    }
  }, [selectedAccount]);

  return (
    <div className="w-full">
      <ComplianceDialog
        open={complianceOpen}
        onOpenChange={setComplianceOpen}
        adAccountId={selectedAccount?.id ?? null}
        adAccountName={selectedAccount?.name ?? null}
        onReady={() => {
          console.log("✅ Compliance passed");
          setComplianceOpen(false);
        }}
      />
      <div className="bg-white rounded border">
        {/* Tabs Header */}
        <div className="flex relative shadow-md rounded-t-xl border-b border-gray-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isCampaignTab = tab.key === 'campaigns';
            const isAdSetsTab = tab.key === 'adsets';
            const isAdsTab = tab.key === 'ads';  // ADD THIS HERE
            const hasCampaignSelected = selectedCampaignId !== null;
            const hasAdSetSelected = selectedAdSetId !== null;  // ADD THIS HERE

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center cursor-pointer justify-center gap-2 flex-1 px-6 py-4 text-sm font-medium relative transition-colors duration-200 ${activeTab === tab.key
                  ? "text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                <Icon size={20} />
                <span>{tab.label}</span>

                {/* Show "1 selected" chip on Campaigns tab when campaign is selected */}
                {isCampaignTab && hasCampaignSelected && (
                  <Chip
                    label="1 selected"
                    size="small"
                    onDelete={() => {
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(
                          new CustomEvent("deselectCampaign")
                        );
                      }
                    }}
                    deleteIcon={
                      <span style={{ fontSize: '18px', cursor: 'pointer' }}>×</span>
                    }
                    sx={chipStyles}

                  />
                )}

                {/* Show "AdSets for 1 campaign" chip on Ad Sets tab when campaign is selected */}
                {/* {isAdSetsTab && hasCampaignSelected && (
                  <Chip
                    label="AdSets for 1 campaign"
                    size="small"
                    // onDelete={() => {  // ADD THIS
                    //   if (typeof window !== "undefined") {
                    //     window.dispatchEvent(
                    //       new CustomEvent("deselectCampaign")
                    //     );
                    //   }
                    // }}
                    // deleteIcon={  // ADD THIS
                    //   <span style={{ fontSize: '16px', cursor: 'pointer' }}>×</span>
                    // }
                    sx={{
                      height: '28px',
                      fontSize: '0.85rem',
                      backgroundColor: '#EEF2FF',
                      color: '#6366F1',
                      fontWeight: 500,
                      borderRadius: '8px',

                      '& .MuiChip-label': {
                        padding: '0 12px',
                      },
                      '& .MuiChip-deleteIcon': {  // ADD THIS
                        color: '#6366F1',
                        fontSize: '18px',
                        margin: '0 4px 0 -4px',
                        '&:hover': {
                          color: '#4F46E5',
                        },
                      },
                    }}
                  />
                )} */}

                {isAdSetsTab && hasCampaignSelected && !hasAdSetSelected && (
                  <Chip
                    label="AdSets for 1 campaign"
                    size="small"
                    sx={chipStyles}

                  />
                )}

                {isAdSetsTab && hasAdSetSelected && (
                  <Chip
                    label="1 selected"
                    size="small"
                    onDelete={() => {
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(
                          new CustomEvent("deselectAdSet")
                        );
                      }
                    }}
                    deleteIcon={
                      <span style={{ fontSize: '18px', cursor: 'pointer' }}>×</span>
                    }
                    sx={chipStyles}

                  />
                )}

                {/* Ads tab chip logic */}

                {isAdsTab && hasAdSetSelected && (
                  <Chip
                    label="Ads for 1 AdSet"
                    size="small"
                    onDelete={() => {
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(
                          new CustomEvent("deselectAdSet")
                        );
                      }
                    }}
                    deleteIcon={
                      <span style={{ fontSize: '18px', cursor: 'pointer' }}>×</span>
                    }
                    sx={chipStyles}
                  />
                )}

                {isAdsTab && !hasAdSetSelected && hasCampaignSelected && (
                  <Chip
                    label="Ads for 1 Campaign"
                    size="small"
                    // onDelete={() => {
                    //   if (typeof window !== "undefined") {
                    //     window.dispatchEvent(
                    //       new CustomEvent("deselectCampaign")
                    //     );
                    //   }
                    // }}
                    // deleteIcon={
                    //   <span style={{ fontSize: '18px', cursor: 'pointer' }}>×</span>
                    // }
                    sx={chipStyles}
                  />
                )}


              </button>
            );
          })}
          {/* Sliding underline animation */}
          <div
            className="absolute bottom-0 h-1 bg-indigo-500 rounded-full transition-all duration-300"
            style={{
              left: `${(tabs.findIndex((t) => t.key === activeTab) * 100) / tabs.length}%`,
              width: `${100 / tabs.length}%`,
            }}
          />
        </div>

        {/* Common Filters Box */}
        <Box
          sx={{
            display: "flex",
            gap: 1,
            alignItems: "center",
            flexWrap: "wrap",
            width: "100%",
            padding: "16px 8px",
            borderBottom: "1px solid #E0E0E0",
          }}
        >
          <Tooltip title="Refresh for sync = true" arrow>
            <IconButton
              onClick={handleRefreshClick}
              sx={{
                width: 30,
                height: 35,
                borderRadius: "6px",
                backgroundColor: "#F5F5F5",
                border: "1px solid #E0E0E0",
                "&:hover": {
                  backgroundColor: "#EEEEEE",
                },
              }}
            >
              <RefreshIcon sx={{ fontSize: 20, color: "#757575" }} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Download" arrow>
            <IconButton
              onClick={onDownload}
              sx={{
                width: 30,
                height: 35,
                borderRadius: "6px",
                backgroundColor: "#F5F5F5",
                border: "1px solid #E0E0E0",
                "&:hover": {
                  backgroundColor: "#EEEEEE",
                },
              }}
            >
              <DownloadIcon sx={{ fontSize: 20, color: "#757575" }} />
            </IconButton>
          </Tooltip>

          {/* <Autocomplete
            size="small"
            multiple
            options={[
              {
                id: "ID-101",
                name: "Maximum quantity",
                image: "/avatar.png",
              },
              {
                id: "ID-102",
                name: "Cost-per-performance goal",
                image: "/avatar.png",
              },
              {
                id: "ID-103",
                name: "Null",
                image: "/avatar.png",
              },
            ]}
            value={selectedOrderIds}
            onChange={(e, newValue) => setSelectedOrderIds(newValue)}
            getOptionLabel={(option) => option.name || ""}
            sx={{
              width: 200,
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
              <TextField {...params} label="Order Id/Name" variant="outlined" />
            )}
            renderOption={(props, option) => {
              const { key, ...rest } = props;
              return (
                <Box
                  component="li"
                  key={key}
                  {...rest}
                  sx={{ display: "flex", alignItems: "center", gap: 1 }}
                >
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: "6px",
                      overflow: "hidden",
                      backgroundColor: "#f0f0f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span style={{ fontSize: "14px" }}>📦</span>
                  </Box>
                  <Box sx={{ display: "flex", flexDirection: "column" }}>
                    <Typography
                      variant="body2"
                      sx={{ fontSize: "0.85rem", fontWeight: 500 }}
                    >
                      {option.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: "text.secondary", fontSize: "0.75rem" }}
                    >
                      {option.id}
                    </Typography>
                  </Box>
                </Box>
              );
            }}
          /> */}

          <Autocomplete
            size="small"
            options={adAccounts}
            value={selectedAccount}
            onChange={(e, newValue) => {
              setSelectedAccount(newValue);
              onAdAccountChange?.(newValue?.id || null, newValue?.metaAccountId || null); // ADD metaAccountId
              if (newValue?.id) {
                setComplianceOpen(true);  // ✅ Direct event handler mein — no useEffect needed
              }
            }}
            getOptionLabel={(option) =>
              option
                ? `${option.name} - ${option.metaAccountId?.replace(/^act_/, "")}`
                : ""
            }
            sx={{
              width: 264,
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
              <TextField {...params} label="Ad Account" variant="outlined" />
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
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "0.75rem", color: "#666" }}>
                      {option.name}
                    </span>
                    <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>
                      {option.metaAccountId}
                    </span>
                  </div>
                </li>
              );
            }}
          />

          {/* <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onReviewPublish}
            sx={{
              height: 40,
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
            Review & Publish
          </Button>

          <Button
            variant="outlined"
            startIcon={<AddToQueueIcon />}
            onClick={onBatchCreation}
            sx={{
              height: 40,
              fontSize: "0.85rem",
              borderRadius: "6px",
              textTransform: "none",
              fontWeight: 500,
              borderColor: "#6366F1",
              color: "#6366F1",
              backgroundColor: "#fff",
              "&:hover": {
                backgroundColor: "#EEF2FF",
                borderColor: "#4F46E5",
                color: "#4F46E5",
              },
            }}
          >
            Content creation
          </Button> */}

          <RangePicker
            value={dateRange}
            onChange={handleDateRangeChange}
            onCalendarChange={() => {
              // Manual selection detected
              setDatePreset(null);
            }}
            format="YYYY-MM-DD"
            presets={[
              {
                label: "Last 7 days",
                value: [dayjs().subtract(7, "days"), dayjs()],
              },
              {
                label: "Last 30 days",
                value: [dayjs().subtract(30, "days"), dayjs()],
              },
              {
                label: "Last 90 days",
                value: [dayjs().subtract(90, "days"), dayjs()],
              },
              {
                label: "Last month",
                value: [
                  dayjs().subtract(1, "month").startOf("month"),
                  dayjs().subtract(1, "month").endOf("month"),
                ],
              },
            ]}
            onPresetClick={(preset) => {
              // Detect which preset was clicked
              if (preset.label === "Last 7 days") setDatePreset('last_7d');
              else if (preset.label === "Last 30 days") setDatePreset('last_30d');
              else if (preset.label === "Last 90 days") setDatePreset('last_90d');
              else if (preset.label === "Last month") setDatePreset('last_month');
            }}
            style={{
              height: 35,
              borderRadius: 6,
              width: 220,
              borderColor: "#E0E0E0",
              transition: "all 0.2s ease",
            }}
          />
        </Box>
      </div>
    </div>
  );
}