// app/dashboard/ads-manager/create-ads-manager/page.jsx
"use client";
import Image from "next/image";
import React, { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Info, Folder, LayoutGrid, Square } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useSearchParams } from "next/navigation";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";

const buyingTypes = [
  {
    id: "auction",
    label: "Auction",
    description:
      "Use auction buying to reach your audience through competitive bidding. Your ads will be delivered based on your bid.",
  },
  {
    id: "reservation",
    label: "Reservation",
    description:
      "Reserve ad space in advance at a fixed price. Guarantee your ad placement and impressions for premium inventory.",
  },
];

const objectives = [
  {
    id: "Awareness",
    label: "Awareness",
    icon: "📢",
    image: "/awareness.png",
    title: "Awareness",
    description: "Show your ads to people who are most likely to remember them.",
    goodFor: ["Reach", "Brand awareness", "Video views"],
  },
  {
    id: "Traffic",
    label: "Traffic",
    icon: "👆",
    image: "/traffic.png",
    title: "Traffic",
    description:
      "Drive traffic to your website or app. Get more visitors to explore your content and offerings.",
    goodFor: ["Website visits", "Landing page views", "Link clicks"],
  },
  {
    id: "Engagement",
    label: "Engagement",
    icon: "💬",
    image: "/engagement.jpg",
    title: "Engagement",
    description:
      "Get more messages, purchases through messaging, video views, post engagement, Page likes or event responses.",
    goodFor: [
      "Messenger, Instagram and WhatsApp",
      "Video views",
      "Post engagement",
      "Conversions",
      "Calls",
    ],
  },
  {
    id: "Leads",
    label: "Leads",
    icon: "🎯",
    image: "/leads.png",
    title: "Leads",
    description: "Collect leads for your business or brand.",
    goodFor: [
      "Website and instant forms",
      "Instant forms",
      "Messenger, Instagram and WhatsApp",
      "Conversions",
      "Calls",
    ],
  },
  {
    id: "AppPromotions",
    label: "App promotion",
    icon: "📱",
    image: "/promotions.png",
    title: "App promotion",
    description:
      "Find new people to install your app and continue using it. About app promotion",
    goodFor: ["App installs", "App events"],
  },
  {
    id: "Sales",
    label: "Sales",
    icon: "🛍️",
    image: "/sales.png",
    title: "Sales",
    description:
      "Find people who are likely to purchase your product or service.",
    goodFor: [
      "Conversions",
      "Catalogue sales",
      "Messenger, Instagram and WhatsApp",
      "Calls",
    ],
  },
];

const defaultInfo = {
  image: "/default.png",
  title: "Campaign Objective",
  description:
    "Your campaign objective is the business goal you hope to achieve by running your ads. Select an objective to learn more about it.",
  goodFor: [],
};

const autocompleteStyle = {
  width: "100%",
  "& .MuiOutlinedInput-root": {
    height: 40,
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
  "& .MuiAutocomplete-option": { padding: "0 !important" },
  "& .MuiAutocomplete-option.Mui-focused": {
    backgroundColor: "#4f46e5 !important",
    color: "#ffffff !important",
  },
  "& .MuiAutocomplete-option[aria-selected='true']": {
    backgroundColor: "#4338ca !important",
    color: "#ffffff !important",
  },
};

const ObjectiveItem = React.memo(
  ({ obj, isSelected, onSelect, onHover, onLeave }) => (
    <label
      className={`flex items-center gap-2 p-3 border rounded-md cursor-pointer text-sm transition-colors ${
        isSelected
          ? "border-indigo-500 bg-indigo-50"
          : "border-gray-300 hover:border-indigo-300"
      }`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <input
        type="radio"
        name="objective"
        value={obj.id}
        checked={isSelected}
        onChange={onSelect}
        className="w-4 h-4 text-indigo-600"
      />
      <span className="text-xl">{obj.icon}</span>
      <span className="text-gray-800">{obj.label}</span>
    </label>
  )
);
ObjectiveItem.displayName = "ObjectiveItem";

const DisplayInfo = React.memo(({ info }) => (
  <div className="flex flex-col gap-1 p-4 items-center text-center">
    <Image
      src={info.image}
      alt="Campaign preview"
      width={160}
      height={160}
      className="object-contain rounded-xl shadow-sm"
      priority
    />
    <h4 className="text-base font-semibold text-gray-900 w-full text-left">
      {info.title}
    </h4>
    <p className="text-sm text-gray-600 leading-relaxed text-left w-full">
      {info.description}
    </p>
    {info.goodFor && info.goodFor.length > 0 && (
      <div className="flex flex-col gap-2 w-full">
        <p className="text-sm font-semibold text-gray-900 text-left">Good for:</p>
        <div className="flex flex-wrap gap-3">
          {info.goodFor.map((item, index) => (
            <span
              key={index}
              className="text-sm text-gray-700 bg-gray-100 px-3 py-1 rounded-full border border-gray-200 shadow-sm"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    )}
  </div>
));
DisplayInfo.displayName = "DisplayInfo";

// Reusable chevron svg
const Chevron = () => (
  <svg
    className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
    width="16" height="16" fill="none" viewBox="0 0 24 24"
    stroke="currentColor" strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

function CampaignForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const adAccountId = searchParams.get("adAccountId");
  const metaAccountId = searchParams.get("metaAccountId");

  const [pageTab, setPageTab] = useState("create");

  // Tab 1
  const [selectedBuyingType, setSelectedBuyingType] = useState("auction");
  const [selectedObjective, setSelectedObjective] = useState("");
  const [hoveredObjective, setHoveredObjective] = useState("");

  // Tab 2
  const [campaignName, setCampaignName] = useState(null);
  const [campaignOptions, setCampaignOptions] = useState([]);
  const [campaignLoading, setCampaignLoading] = useState(false);

  const [adSetMode, setAdSetMode] = useState("create"); // "create" | "existing"
  const [adSetName, setAdSetName] = useState("");
  const [selectedAdSet, setSelectedAdSet] = useState(null);
  const [adSetOptions, setAdSetOptions] = useState([]);
  const [adSetLoading, setAdSetLoading] = useState(false);

  // adMode:
  //   when adSetMode==="create"  → options: "create" | "skip"
  //   when adSetMode==="existing" → only "create" (no skip option)
  const [adMode, setAdMode] = useState("create"); // "create" | "skip"
  const [adName, setAdName] = useState("");

  // adInput is disabled only when adMode === "skip"
  const adInputDisabled = adMode === "skip";

  const filteredObjectives = useMemo(() => {
    if (selectedBuyingType === "reservation") {
      return objectives.filter(
        (obj) => obj.id === "Awareness" || obj.id === "Engagement"
      );
    }
    return objectives;
  }, [selectedBuyingType]);

  const displayInfo = useMemo(() => {
    const id = hoveredObjective || selectedObjective;
    return objectives.find((obj) => obj.id === id) || defaultInfo;
  }, [hoveredObjective, selectedObjective]);

  const handleNext = useCallback(() => {
    if (selectedObjective) {
      const url = `/dashboard/ads-manager/create-ads-manager/${selectedObjective}?buyingType=${selectedBuyingType}&adAccountId=${adAccountId}&metaAccountId=${metaAccountId}`;
      router.push(url);
    }
  }, [selectedObjective, selectedBuyingType, adAccountId, metaAccountId, router]);
  console.log("Selected objective:", selectedObjective);

// Mapping: API objective → objectives array id
const objectiveMap = {
  OUTCOME_AWARENESS: "Awareness",
  OUTCOME_TRAFFIC: "Traffic",
  OUTCOME_ENGAGEMENT: "Engagement",
  OUTCOME_LEADS: "Leads",
  OUTCOME_APP_PROMOTION: "AppPromotions",
  OUTCOME_SALES: "Sales",
};

const handleContinue = useCallback(() => {
  if (!campaignName) return;

  const objective = objectiveMap[campaignName.objective] || campaignName.objective;
  const buyingType = campaignName.buying_type?.toLowerCase() || "auction";

  let url = `/dashboard/ads-manager/create-ads-manager/${objective}?buyingType=${buyingType}&adAccountId=${adAccountId}&metaAccountId=${metaAccountId}&campaignId=${campaignName.id}`;

  // If existing adset selected, append adSetId
  if (adSetMode === "existing" && selectedAdSet?.id) {
    url += `&adSetId=${selectedAdSet.id}`;
  }

  router.push(url);
}, [campaignName, adSetMode, selectedAdSet, adAccountId, metaAccountId, router]);

// console.log("Selected url:", url);

  const handleCancel = useCallback(() => {
    router.push("/dashboard/ads-manager");
  }, [router]);

  const fetchCampaigns = useCallback(async () => {
    if (campaignOptions.length > 0) return;
    setCampaignLoading(true);
    try {
      const res = await fetch(
        `/api/meta/campaigns?insights=true&accountId=${adAccountId}&sync=true`
      );
      const data = await res.json();
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data.data)
        ? data.data
        : Array.isArray(data.campaigns)
        ? data.campaigns
        : [];
      setCampaignOptions(list);
    } catch (err) {
      console.error("Failed to fetch campaigns:", err);
    } finally {
      setCampaignLoading(false);
    }
  }, [campaignOptions.length, adAccountId]);
  console.log("Campaign options:", campaignOptions);

  const fetchAdSets = useCallback(async (campaignId) => {
    if (!campaignId) return;
    setAdSetLoading(true);
    setAdSetOptions([]);
    setSelectedAdSet(null);
    try {
      const params = new URLSearchParams({
        insights: "true",
        accountId: adAccountId,
        sync: "true",
      });
      const res = await fetch(
        `/api/meta/campaign/${campaignId}/adsets?${params.toString()}`
      );
      console.log(`Fetching ad sets for campaign ${campaignId} with params:`, params.toString());
      const data = await res.json();
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data.data)
        ? data.data
        : Array.isArray(data.adsets)
        ? data.adsets
        : [];
      setAdSetOptions(list);
    } catch (err) {
      console.error("Failed to fetch adsets:", err);
    } finally {
      setAdSetLoading(false);
    }
  }, [adAccountId]);
  console.log("Ad set options:", adSetOptions);

  const handleTabChange = useCallback(
    (tab) => {
      setPageTab(tab);
      if (tab === "adset") fetchCampaigns();
    },
    [fetchCampaigns]
  );

  // When adSetMode changes, reset ad state
  const handleAdSetModeChange = (val) => {
    setAdSetMode(val);
    setAdSetName("");
    setSelectedAdSet(null);
    // when switching to "existing", force adMode back to "create"
    setAdMode("create");
    setAdName("");
  };

  return (
    <div className="h-full p-6 flex justify-start">
      <div className="w-full max-w-3xl bg-black/1 border rounded-lg shadow-sm py-4 px-6">

        {/* Heading + Tabs */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            {pageTab === "create" ? "Create New Campaign Setup" : "New Ad Set or Ad"}
          </h3>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden text-sm">
            <button
              onClick={() => handleTabChange("create")}
              className={`px-4 py-2 cursor-pointer transition-colors ${
                pageTab === "create"
                  ? "bg-indigo-600 text-white font-medium"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Create new campaign
            </button>
            <button
              onClick={() => handleTabChange("adset")}
              className={`px-4 py-2 cursor-pointer transition-colors border-l border-gray-200 ${
                pageTab === "adset"
                  ? "bg-indigo-600 text-white font-medium"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              New ad set or ad
            </button>
          </div>
        </div>

        {/* ════ TAB 1 — Create new campaign ════ */}
        {pageTab === "create" && (
          <>
            <div className="flex flex-col gap-2 mb-6">
              <label className="text-sm font-semibold text-gray-800 flex items-center gap-1">
                Choose a buying type
                <Info size={14} strokeWidth={2} className="text-gray-600" />
              </label>
              <Select onValueChange={setSelectedBuyingType} value={selectedBuyingType}>
                <SelectTrigger className="w-full border border-gray-300 bg-white rounded-md px-3 py-2 text-sm text-gray-800 focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 transition-all">
                  <SelectValue placeholder="Select buying type">
                    {buyingTypes.find((t) => t.id === selectedBuyingType)?.label || "Select buying type"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200 shadow-md rounded-lg">
                  <div className="flex flex-col gap-2 p-1">
                    {buyingTypes.map((type) => (
                      <SelectItem
                        key={type.id}
                        value={type.id}
                        className="cursor-pointer py-2 px-3 rounded-md text-sm text-gray-800 hover:bg-indigo-50 focus:bg-indigo-50 data-[state=checked]:bg-indigo-100 data-[state=checked]:text-indigo-700"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{type.label}</span>
                          <span className="text-xs text-gray-600">{type.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-gray-800">
                  Choose a campaign objective
                </label>
                <div className="flex flex-col gap-3">
                  {filteredObjectives.map((obj) => (
                    <ObjectiveItem
                      key={obj.id}
                      obj={obj}
                      isSelected={selectedObjective === obj.id}
                      onSelect={(e) => setSelectedObjective(e.target.value)}
                      onHover={() => setHoveredObjective(obj.id)}
                      onLeave={() => setHoveredObjective("")}
                    />
                  ))}
                </div>
              </div>
              <DisplayInfo info={displayInfo} />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 cursor-pointer text-gray-700 rounded-md hover:bg-gray-100 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleNext}
                disabled={!selectedObjective}
                className="px-5 py-2 bg-indigo-600 text-white cursor-pointer rounded-md hover:bg-indigo-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </>
        )}

        {/* ════ TAB 2 — New ad set or ad ════ */}
        {pageTab === "adset" && (
          <div className="flex flex-col gap-5">

            {/* Campaign autocomplete */}
            <div>
              <div className="flex items-center gap-2 mb-2 font-semibold text-gray-800 text-sm">
                <Folder size={16} className="text-gray-500" />
                Campaign
              </div>
              <Autocomplete
                size="small"
                loading={campaignLoading}
                options={campaignOptions}
                value={campaignName}
                onChange={(_, val) => {
                  setCampaignName(val);
                  setAdSetMode("create");
                  setAdSetName("");
                  setSelectedAdSet(null);
                  setAdMode("create");
                  setAdName("");
                  fetchAdSets(val?.id);
                }}
                getOptionLabel={(opt) => (opt ? opt.name : "")}
                isOptionEqualToValue={(opt, val) => opt?.id === val?.id}
                sx={autocompleteStyle}
                renderOption={(props, opt) => {
                  const { key, ...restProps } = props;
                  return (
                    <li key={opt.id} {...restProps} style={{}}
                      className="flex flex-col px-3 py-2 cursor-pointer hover:bg-indigo-600 group"
                    >
                      <span className="text-sm font-semibold group-hover:text-white text-gray-800">
                        {opt.name}
                      </span>
                      <span className="text-xs group-hover:text-indigo-200 text-gray-400">
                        {opt.status} • {opt.id} • {opt.objective?.replace("OUTCOME_", "")} • {opt.buying_type || "Auction"}
                      </span>
                    </li>
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select campaign"
                    variant="outlined"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {campaignLoading && (
                            <span className="text-xs text-gray-400 mr-1">Loading...</span>
                          )}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
            </div>

            {/* Ad set + Ad — show only after campaign selected */}
            {campaignName && (
              <>
                {/* Ad set */}
                <div>
                  <div className="flex items-center gap-2 mb-2 font-semibold text-gray-800 text-sm">
                    <LayoutGrid size={16} className="text-gray-500" />
                    Ad set
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="relative" style={{ minWidth: 175 }}>
                      <select
                        value={adSetMode}
                        onChange={(e) => handleAdSetModeChange(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-800 bg-white appearance-none cursor-pointer pr-8 h-10"
                      >
                        <option value="create">Create ad set</option>
                        <option value="existing">Use existing ad set</option>
                      </select>
                      <Chevron />
                    </div>

                    {adSetMode === "create" ? (
                      <input
                        type="text"
                        placeholder="Name this ad set"
                        value={adSetName}
                        onChange={(e) => setAdSetName(e.target.value)}
                        className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-800 bg-white h-10 outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                      />
                    ) : (
                      <div className="flex-1">
                        <Autocomplete
                          size="small"
                          loading={adSetLoading}
                          options={adSetOptions}
                          value={selectedAdSet}
                          onChange={(_, val) => setSelectedAdSet(val)}
                          getOptionLabel={(opt) => (opt ? opt.name : "")}
                          isOptionEqualToValue={(opt, val) => opt?.id === val?.id}
                          sx={autocompleteStyle}
                          renderOption={(props, opt) => {
                            const { key, ...restProps } = props;
                            return (
                              <li key={opt.id} {...restProps} style={{}}
                                className="flex flex-col px-3 py-2 cursor-pointer hover:bg-indigo-600 group"
                              >
                                <span className="text-sm font-semibold group-hover:text-white text-gray-800">
                                  {opt.name}
                                </span>
                                <span className="text-xs group-hover:text-indigo-200 text-gray-400">
                                  {opt.status} • {opt.id} • Campaign: {opt.campaign?.name || ""}
                                </span>
                              </li>
                            );
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Search ad set"
                              variant="outlined"
                              InputProps={{
                                ...params.InputProps,
                                endAdornment: (
                                  <>
                                    {adSetLoading && (
                                      <span className="text-xs text-gray-400 mr-1">Loading...</span>
                                    )}
                                    {params.InputProps.endAdornment}
                                  </>
                                ),
                              }}
                            />
                          )}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Ad */}
                <div>
                  <div className="flex items-center gap-2 mb-2 font-semibold text-gray-800 text-sm">
                    <Square size={16} className="text-gray-500" />
                    Ad
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="relative" style={{ minWidth: 175 }}>
                      <select
                        value={adMode}
                        onChange={(e) => {
                          setAdMode(e.target.value);
                          if (e.target.value === "skip") setAdName("");
                        }}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-800 bg-white appearance-none cursor-pointer pr-8 h-10"
                      >
                        <option value="create">Create ad</option>
                        {/* Skip ad only shown when adSetMode is "create" */}
                        {adSetMode === "create" && (
                          <option value="skip">Skip ad</option>
                        )}
                      </select>
                      <Chevron />
                    </div>

                    <input
                      type="text"
                      placeholder="Name this ad"
                      value={adName}
                      onChange={(e) => setAdName(e.target.value)}
                      disabled={adInputDisabled}
                      className={`flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm h-10 outline-none transition-colors ${
                        adInputDisabled
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-white text-gray-800 focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
                      }`}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Buttons */}
            <div className="flex justify-end gap-3 mt-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 cursor-pointer text-gray-700 rounded-md hover:bg-gray-100 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleContinue}
                className="px-5 py-2 bg-indigo-600 text-white cursor-pointer rounded-md hover:bg-indigo-700 text-sm"
              >
                Continue
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default CampaignForm;