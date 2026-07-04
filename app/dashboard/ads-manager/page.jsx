

"use client";
import React, { useState, useCallback, useMemo, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import Tabs from "./components/Tabs";
import BatchCreationDrawer from "./components/BatchCreationDrawer";
import dayjs from "dayjs";

const CampaignsTable = dynamic(() => import("./components/CampaignsTable"), {
  loading: () => <TableSkeleton />,
  ssr: false,
});
const AdSetsTable = dynamic(() => import("./components/AdSetsTable"), {
  loading: () => <TableSkeleton />,
  ssr: false,
});
const AdsTable = dynamic(() => import("./components/AdsTable"), {
  loading: () => <TableSkeleton />,
  ssr: false,
});

const TableSkeleton = () => (
  <div className="mt-4 space-y-4 animate-pulse">
    <div className="h-12 bg-gray-200 rounded"></div>
    <div className="h-100 bg-gray-100 rounded"></div>
  </div>
);

const TABLE_COMPONENTS = {
  campaigns: CampaignsTable,
  adsets: AdSetsTable,
  ads: AdsTable,
};

export default function AdsManagerPage() {
  const [activeTab, setActiveTab] = useState("campaigns");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedAdAccountId, setSelectedAdAccountId] = useState(null);
  const [syncData, setSyncData] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState(null); // NEW: Track selected campaign
  const [selectedAdSetId, setSelectedAdSetId] = useState(null);
  const [selectedMetaAccountId, setSelectedMetaAccountId] = useState(null);

  // ADD this state after your existing states (around line 27)
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(30, "days"),
    dayjs(),
  ]);
  const [datePreset, setDatePreset] = useState('last_30d');
  const handleTabChange = useCallback((newTab) => {
    setActiveTab(newTab);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("adsManagerTabChange", { detail: newTab })
      );
    }
  }, []);

  const handleSyncChange = useCallback((value) => {
    console.log('🔄 Sync triggered:', value);
    setSyncData(value);
    if (value) {
      setTimeout(() => {
        console.log('🔄 Resetting sync state');
        setSyncData(false);
      }, 500);
    }
  }, []);

  // NEW: Handle campaign selection
  const handleCampaignSelect = useCallback((campaignId) => {
    console.log('📋 Campaign selected:', campaignId);
    setSelectedCampaignId(campaignId);
  }, []);

  // ADD THIS HANDLER
  const handleAdSetSelect = useCallback((adSetId) => {
    console.log('📋 AdSet selected:', adSetId);
    setSelectedAdSetId(adSetId);
  }, []);

  const TableComponent = useMemo(() => {
    return TABLE_COMPONENTS[activeTab] || null;
  }, [activeTab]);

  // NEW: Pass selectedCampaignId only to AdSetsTable
  const tableProps = useMemo(() => {
    const baseProps = {
      selectedAdAccountId,
      selectedMetaAccountId, // ADD
      syncData,
      dateRange,
      datePreset,
    };

    if (activeTab === 'campaigns') {
      return {
        ...baseProps,
        onCampaignSelect: handleCampaignSelect,
      };
    }

    if (activeTab === 'adsets') {
      return {
        ...baseProps,
        selectedCampaignId,
        onAdSetSelect: handleAdSetSelect,  // ADD THIS
      };
    }

    if (activeTab === 'ads') {
      return {
        ...baseProps,
        selectedAdSetId,  // ADD THIS
      };
    }

    return baseProps;
  }, [activeTab, selectedAdAccountId, selectedMetaAccountId, syncData, dateRange, datePreset, selectedCampaignId, selectedAdSetId, handleCampaignSelect, handleAdSetSelect])


  // In AdsManagerPage, add this useEffect after your existing state declarations:

  useEffect(() => {
    const handleSwitchToAdSets = (event) => {
      const { campaignId } = event.detail;
      setSelectedCampaignId(campaignId);
      setActiveTab("adsets");
    };

    if (typeof window !== "undefined") {
      window.addEventListener("switchToAdSetsTab", handleSwitchToAdSets);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("switchToAdSetsTab", handleSwitchToAdSets);
      }
    };
  }, []);

  useEffect(() => {
    const handleSwitchToAds = (event) => {
      const { adSetId } = event.detail;
      setSelectedAdSetId(adSetId);
      setActiveTab("ads");
    };

    if (typeof window !== "undefined") {
      window.addEventListener("switchToAdsTab", handleSwitchToAds);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("switchToAdsTab", handleSwitchToAds);
      }
    };
  }, []);

  useEffect(() => {
    const handleDeselectCampaign = () => {
      setSelectedCampaignId(null);
      setActiveTab("campaigns");  // Optional: switch back to campaigns tab
    };

    if (typeof window !== "undefined") {
      window.addEventListener("deselectCampaign", handleDeselectCampaign);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("deselectCampaign", handleDeselectCampaign);
      }
    };
  }, []);

  useEffect(() => {
    const handleDeselectAdSet = () => {
      setSelectedAdSetId(null);
      setActiveTab("adsets");
    };

    if (typeof window !== "undefined") {
      window.addEventListener("deselectAdSet", handleDeselectAdSet);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("deselectAdSet", handleDeselectAdSet);
      }
    };
  }, []);
const handleAdAccountChange = useCallback((id, metaId) => {
  console.log("🔍 AdAccount ID:", id);
  console.log("🔍 Meta Account ID:", metaId);
  setSelectedAdAccountId(id);
  setSelectedMetaAccountId(metaId);
}, []);

  return (
    <div className="px-2 py-6">
      <Tabs
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onBatchCreation={() => setDrawerOpen(true)}
          onAdAccountChange={handleAdAccountChange}

        onSyncChange={handleSyncChange}
        onDateRangeChange={(values, preset) => {  // Receives TWO separate params
          setDateRange(values);  // Store array
          setDatePreset(preset); // Store preset string
        }}
        selectedCampaignId={selectedCampaignId}  // NEW: Pass this prop
        selectedAdSetId={selectedAdSetId}
      />
      <Suspense fallback={<TableSkeleton />}>
        {TableComponent && <TableComponent {...tableProps} />}
      </Suspense>
      <BatchCreationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}