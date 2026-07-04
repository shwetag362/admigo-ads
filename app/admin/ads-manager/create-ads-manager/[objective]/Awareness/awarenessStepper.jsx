// app/dashboard/ads-manager/create-ads-manager/[objective]/Awareness/awarenessStepper.jsx
"use client";
import { useState, useEffect , useCallback } from "react";
import { useRouter } from "next/navigation";
import React, { useRef, forwardRef, useImperativeHandle } from "react";
import { useSearchParams } from "next/navigation";
import { notify } from "@/lib/toast"; // ✅ Import toast

import {
  Folder,
  Layers,
  MonitorPlay,
  Info,
  ChevronDown,
  Banknote,
  Briefcase,
  Home,
  Megaphone,
  X,
  ChevronUp,
  Link,
  Pencil,
} from "lucide-react";
import { DatePicker } from "antd";
const { RangePicker } = DatePicker;
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MetaAdsDrawer from "../../../components/PreviewDrawer";
import { useParams } from "next/navigation";
import BatchCreationDrawer from "../../../components/BatchCreationDrawer";
import Image from "next/image";
import dayjs from "dayjs";


export default function AwarenessStepper() {
  const searchParams = useSearchParams();
  const buyingType = searchParams.get("buyingType") || "auction";
  const [step, setStep] = useState(0);
  const router = useRouter();
  const adAccountId = searchParams.get("adAccountId");
  console.log("Ad Account ID (from URL query):", adAccountId);
  const metaAccountId = searchParams.get("metaAccountId");
  console.log("Meta Account ID (from URL query):", metaAccountId);

  const [campaignData, setCampaignData] = useState({});
  const [adSetData, setAdSetData] = useState({});
  const [adData, setAdData] = useState({});
  const [draftId, setDraftId] = useState(null);
  const [metaCampaignId, setMetaCampaignId] = useState(null);
  const [metaAdSetId, setMetaAdSetId] = useState(null);
  const [adSetDraftId, setAdSetDraftId] = useState(null);
  const [loading, setLoading] = useState(false);
  const objective = "BRAND_AWARENESS";
  const [campaignLabel, setCampaignLabel] = useState("New Awareness campaign");
  const [adSetLabel, setAdSetLabel] = useState("New Awareness ad set");
  const [adLabel, setAdLabel] = useState("New Awareness ad");

  console.log("Objective Route Param:", objective);

  const getSessionCookie = () => {
    if (typeof document !== "undefined") {
      const token = document.cookie
        .split("; ")
        .find((row) => row.startsWith("authjs.session-token="))
        ?.split("=")[1];

      return token ? `authjs.session-token=${token}` : "";
    }
    return "";
  };


  const handleNext = async () => {
    setLoading(true);
    const loadingToast = notify.loading("Processing..."); // ✅ Show loading toast

    try {
      if (step === 0 && campaignFormRef.current?.getData) {
        // Step 1: Create Campaign
        const data = campaignFormRef.current.getData();
        setCampaignData(data);

        const campaignPayload = {
          step: "campaign",
          data: {
            adAccountId: adAccountId,
            name: data.campaignName,
            objective: "BRAND_AWARENESS",
            campaignBudgetOptimization: data.advantagePlus,
            specialAdCategories: data.specialAdCategories || [],
            buyingType: (data.buyingType || "AUCTION").toUpperCase(),

            ...(data.advantagePlus && {
              bidStrategy: data.bidStrategy || "LOWEST_COST_WITHOUT_CAP",

              ...(data.budget?.type === "daily" && {
                dailyBudget: data.budget.amount,
              }),

              ...(data.budget?.type === "lifetime" && {
                lifetimeBudget: data.budget.amount,
              }),

              ...(data.scheduleBudget && {
                scheduleBudget: true,
                budgetIncreaseAmount: parseFloat(data.budgetIncrease?.amount || 50),
                ...(data.startTime && { startTime: data.startTime }),
                ...(data.endTime && { endTime: data.endTime }),
              }),
            }),
          }
        };

        console.log("Campaign Payload:", campaignPayload);

        const sessionCookie = getSessionCookie();

        const response = await fetch("/api/campaign/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: sessionCookie,
          },
          body: JSON.stringify(campaignPayload)
        });

        const result = await response.json();
        console.log("Campaign Creation Result:", result);

        notify.dismiss(loadingToast); // ✅ Dismiss loading

        if (result.success) {
          setDraftId(result.draftId);
          console.log("🔹 Created Draft ID:", result.draftId);
          setMetaCampaignId(result.metaCampaignId);
          notify.success(result.message || "Campaign created successfully!");
          setStep(1);
        } else {
          // ✅ Show error from API response
          const errorMessage = result.error?.message || result.message || "Error creating campaign";
          notify.error(errorMessage);
        }

      } else if (step === 1 && adSetFormRef.current?.getData) {
        // Step 2: Create Ad Set
        const data = adSetFormRef.current.getData();
        setAdSetData(data);
        console.log("🔹 Using Draft ID:", draftId);
        const adSetPayload = {
          step: "adset",
          data: {
            campaignDraftId: draftId,
            name: data.adSetName,
            performanceGoal: data.performanceGoal || "Maximise reach of ads",
            optimizationGoal: "REACH",
            facebookPage: data.facebookPage || "",
            pageId: data.facebookPageId || "",
            pixelName: data.pixelName || "",
            pixelId: data.pixelId || "",

            // ✅ FIXED: Send dailyBudget OR lifetimeBudget based on type
            budgetType: data.budgetType || "daily",
            ...(data.budgetType === "daily" && {
              dailyBudget: data.dailyBudget || 200,
            }),
            ...(data.budgetType === "lifetime" && {
              lifetimeBudget: data.lifetimeBudget || 200,
            }),
            currency: data.currency || "INR",

            ...(data.costGoal && {
              costPerResult: data.costGoal
            }),

            // ✅ UPDATED: Send startTime (required)
            startTime: data.startTime || new Date().toISOString(),
            // ✅ UPDATED: Send endTime only if provided
            ...(data.endTime && {
              endTime: data.endTime
            }),

            scheduleBudget: data.scheduleBudget || false,
            // ✅ UPDATED: Send schedule period dates if scheduleBudget is enabled
            ...(data.scheduleBudget && data.schedulePeriod?.startTime && {
              scheduleStartTime: data.schedulePeriod.startTime,
              ...(data.schedulePeriod.endTime && {
                scheduleEndTime: data.schedulePeriod.endTime
              })
            }),
            scheduleBudget: data.scheduleBudget || false,
            ...(data.scheduleBudget && data.budgetIncreaseAmount && {
              budgetIncreaseAmount: parseFloat(data.budgetIncreaseAmount),
            }),
            targeting: {
              geo_locations: {
                countries: data.audienceControls?.location === "india" ? ["IN"] : ["IN"]
              },
              age_min: parseInt(data.audienceControls?.minimumAge) || 18,
              age_max: parseInt(data.audienceControls?.maximumAge) || 65,
              ...(data.audienceControls?.languages !== "all" && {
                locales: [data.audienceControls.languages]
              }),

              ...((!campaignData.specialAdCategories || campaignData.specialAdCategories.length === 0) && {
                targeting_automation: {
                  advantage_audience: 1
                }
              })
            }
          }
        };

        console.log("Ad Set Payload:", adSetPayload);
        const sessionCookie = getSessionCookie();

        const response = await fetch("/api/campaign/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: sessionCookie,
          },
          body: JSON.stringify(adSetPayload)
        });

        const result = await response.json();
        console.log("Ad Set Creation Result:", result);

        notify.dismiss(loadingToast); // ✅ Dismiss loading

        if (result.success) {
          setMetaAdSetId(result.metaAdSetId);
          setAdSetDraftId(result.draftId);
          notify.success(result.message || "Ad Set created successfully!"); // ✅ Success toast with API message
          setStep(2);
        } else {
          // ✅ Show error from API response
          const errorMessage = result.error?.message || result.message || "Error creating ad set";
          notify.error(errorMessage);
        }
      }
    } catch (error) {
      console.error("Error:", error);
      notify.dismiss(loadingToast); // ✅ Dismiss loading
      notify.error(`Something went wrong: ${error.message}`); // ✅ Error toast
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    console.log("🔍 Current metaAdSetId:", metaAdSetId)
    if (!adFormRef.current?.getData) {
      notify.warning("Ad creative not ready yet!"); // ✅ Warning toast
      return;
    }

    setLoading(true);
    const loadingToast = notify.loading("Publishing campaign..."); // ✅ Loading toast

    try {
      const data = adFormRef.current.getData();
      setAdData(data);

      const adPayload = {
        step: "ad",
        data: {
          adSetDraftId: adSetDraftId,

          adSetup: data.adSetup || "create-ad",
          adFormat: data.format || "",
          multiAdvertiser: data.multiAdvertiser || false,
          destination: data.destination || "website",

          ...(data.destination === "website" && {
            websiteUrl: data.websiteUrl || "",
            displayLink: data.displayLink || "",
          }),

          creativeData: {
            name: data.adName || "New Awareness ad",
            primaryText: data.creative?.primaryText || "",

            ...(data.format === "single" && {
              headline: data.creative?.headline || "",
              description: data.creative?.description || "",
            }),

            websiteUrl: data.websiteUrl || "",
            facebookPage: data.identity?.facebookPage || "",
            pageId: data.identity?.facebookPageId || "",
            instagramAccount: data.identity?.instagramAccount || null,

            callToAction:
              data.creative?.callToAction
                ?.toUpperCase()
                .replace(/-/g, "_") || "LEARN_MORE",

            // ✅ Single image — types is now array, check includes("image-ad")
            ...(data.format !== "carousel" &&
              data.creative?.types?.includes("image-ad") &&
              data.creative?.images?.length > 0 && {
              imageHash: data.creative.images[0].hash,
              imageUrl: data.creative.images[0].url,
              ImageName: data.creative.images[0].name || "Ad Image",
            }),

            // ✅ Single video — types is now array, check includes("video-ad")
            ...(data.format !== "carousel" &&
              data.creative?.types?.includes("video-ad") &&
              data.creative?.videoId && {
              videoId: data.creative.videoId,
              thumbnailUrl: data.creative.videoUrl,
            }),

            // ✅ Carousel — mixed image+video cards via cardType field
            ...(data.format === "carousel" && {
              cards: (data.creative?.carouselCards || []).map((card) => ({
                // Image card fields — cardType === "image-card"
                ...(card.cardType === "image-card" && {
                  imageHash: card.hash,
                  imageUrl: card.url,
                  ImageName: card.name || "Carousel Image",
                }),

                // Video card fields — cardType === "video-card"
                ...(card.cardType === "video-card" && {
                  videoId: card.videoId,
                  thumbnailUrl: card.videoUrl,
                  videoName: card.videoName || "Carousel Video",
                }),

                // cardType to distinguish on backend
                cardType: card.cardType,

                // Per-card details
                headline: card.headline || "",
                description: card.description || "",
                link: card.link || "",

                call_to_action: {
                  type:
                    data.creative?.callToAction
                      ?.toUpperCase()
                      .replace(/-/g, "_") || "LEARN_MORE",
                },
              })),
            }),
          },
        },
      };

      console.log("Ad Payload:", adPayload);
      const sessionCookie = getSessionCookie();

      const response = await fetch("/api/campaign/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: sessionCookie,
        },
        body: JSON.stringify(adPayload)
      });

      const result = await response.json();
      console.log("Ad Creation Result:", result);

      notify.dismiss(loadingToast); // ✅ Dismiss loading

      if (result.success) {
        notify.success(result.message || "🎉 Campaign Published Successfully!", { duration: 5000 }); // ✅ Success toast with API message
        setTimeout(() => {
          router.push("/dashboard/ads-manager");
        }, 1500);
      } else {
        // ✅ Show error from API response
        const errorMessage = result.error?.message || result.message || "Error publishing ad";
        notify.error(errorMessage);
      }
    } catch (error) {
      console.error("Error:", error);
      notify.dismiss(loadingToast); // ✅ Dismiss loading
      notify.error(`Something went wrong: ${error.message}`); // ✅ Error toast
    } finally {
      setLoading(false);
    }
  };

  const campaignFormRef = useRef(null);
  const adSetFormRef = useRef(null);
  const adFormRef = useRef(null);



  const renderStep = () => {
    switch (step) {
      case 0:
        return <CampaignForm ref={campaignFormRef} initialBuyingType={buyingType} onNameChange={setCampaignLabel} />;
      case 1:
        return <AdSetsForm ref={adSetFormRef} adAccountId={adAccountId} metaAccountId={metaAccountId} campaignData={campaignData} onNameChange={setAdSetLabel} />;
      case 2:
        return <AdForm ref={adFormRef} adAccountId={adAccountId} metaAccountId={metaAccountId} onNameChange={setAdLabel} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full py-2 bg-[#f9f9fb]">
      {/* Sidebar */}
      <aside className="w-80 h-full border-r fixed overflow-hidden bg-white shadow-sm">
        <div className="p-3 space-y-0.5">

          {/* Campaign row */}
          <div
            onClick={() => setStep(0)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-all ${step === 0 ? "bg-[#E0E7FF]" : "hover:bg-indigo-50"
              }`}
          >
            <Folder size={15} className={step === 0 ? "text-indigo-700" : "text-gray-500"} />
            <span className={`text-[15px] truncate max-w-50 ${step === 0 ? "text-indigo-800 font-semibold" : "text-gray-700"}`}>
              {campaignLabel}
            </span>
          </div>

          {/* AdSet row — indented */}
          <div
            onClick={() => setStep(1)}
            className={`flex items-center gap-2 pl-8 pr-3 py-2 rounded-md cursor-pointer transition-all ${step === 1 ? "bg-[#E0E7FF]" : "hover:bg-indigo-50"
              }`}
          >
            <Layers size={15} className={step === 1 ? "text-indigo-700" : "text-gray-400"} />
            <span className={`text-[15px] truncate max-w-50 ${step === 1 ? "text-indigo-800 font-semibold" : "text-gray-600"}`}>
              {adSetLabel}
            </span>
          </div>

          {/* Ad row — more indented */}
          <div
            onClick={() => setStep(2)}
            className={`flex items-center gap-2 pl-14 pr-3 py-2 rounded-md cursor-pointer transition-all ${step === 2 ? "bg-[#E0E7FF]" : "hover:bg-indigo-50"
              }`}
          >
            <MonitorPlay size={15} className={step === 2 ? "text-indigo-700" : "text-gray-400"} />
            <span className={`text-[15px] truncate max-w-50 ${step === 2 ? "text-indigo-800 font-semibold" : "text-gray-500"}`}>
              {adLabel}
            </span>
          </div>

        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-2 overflow-y-auto ml-80 pl-0">
        <div className="flex-1 p-2 mb-16">{renderStep()}</div>

        {/* Fixed Bottom Navbar */}
        <div className="fixed bottom-0 left-144 right-0 bg-white border-t border-gray-200 shadow-sm py-3 px-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/dashboard/ads-manager")}
              className="px-4 py-2 border cursor-pointer border-gray-300 rounded-md text-gray-800 text-sm hover:bg-gray-100 transition"
              disabled={loading}
            >
              Close
            </button>
          </div>

          <div className="flex items-center gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 border cursor-pointer border-gray-300 rounded-md text-gray-800 text-sm hover:bg-gray-100 transition"
                disabled={loading}
              >
                Back
              </button>
            )}

            {step < 2 ? (
              <button
                onClick={handleNext}
                disabled={loading || !adAccountId}
                className="px-5 py-2 cursor-pointer bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating..." : "Next"}
              </button>
            ) : (
              <button
                onClick={handlePublish}
                disabled={loading}
                className="px-5 py-2 cursor-pointer bg-green-600 text-white rounded-md text-sm hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Publishing..." : "Publish"}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

/* CampaignForm component remains the same - no changes needed here */
const CampaignForm = forwardRef(({ initialBuyingType = "auction", onNameChange }, ref) => {
  const router = useRouter();
  const [buyingType, setBuyingType] = useState(initialBuyingType);
  const [campaignName, setCampaignName] = useState("New Awareness campaign");
  const [objective, setObjective] = useState("Awareness");
  const [advantagePlus, setAdvantagePlus] = useState(false);
  const [scheduleBudget, setScheduleBudget] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [budgetType, setBudgetType] = useState("daily");
  const [budgetAmount, setBudgetAmount] = useState("200.00");
  const [budgetIncreaseAmount, setBudgetIncreaseAmount] = useState("50.00");
  const [scheduleStartEnd, setScheduleStartEnd] = useState(null);
  const [bidStrategy, setBidStrategy] = useState("LOWEST_COST_WITHOUT_CAP");

  const objectives = [
    { id: "Awareness", label: "Awareness" },
    { id: "Traffic", label: "Traffic" },
    { id: "Engagement", label: "Engagement" },
    { id: "Leads", label: "Leads" },
    { id: "AppPromotions", label: "App promotion" },
    { id: "Sales", label: "Sales" },
  ];

  const buyingTypes = [
    { id: "auction", label: "Auction" },
    { id: "reservation", label: "Reservation" },
  ];

  const bidStrategies = [
    {
      id: "LOWEST_COST_WITHOUT_CAP",
      label: "Highest volume  (Lowest cost without cap)",
      description: "Recommended for maximum reach. Meta will aim to get you the most results for your budget."
    },
    {
      id: "LOWEST_COST_WITH_BID_CAP",
      label: "Lowest cost with bid cap",
      description: "Control your maximum bid while still getting competitive results."
    },
    {
      id: "COST_CAP",
      label: "Cost cap (Target cost per result)",
      description: "Set a target cost per result. Meta will aim to keep your average cost at or below this amount."
    }
  ];

  const categories = [
    {
      id: "FINANCIAL_PRODUCTS_SERVICES",
      label: "Financial products and services",
      description:
        "Ads for credit cards, long-term financing, current and savings accounts, investment services, or insurance products.",
      icon: Banknote,
    },
    {
      id: "EMPLOYMENT",
      label: "Employment",
      description:
        "Ads for job offers, internships, or professional certification programmes and related opportunities.",
      icon: Briefcase,
    },
    {
      id: "HOUSING",
      label: "Housing",
      description:
        "Ads for property listings, home insurance, mortgages or related housing services.",
      icon: Home,
    },
    {
      id: "ISSUES_ELECTIONS_POLITICS",
      label: "Social issues, elections or politics",
      description:
        "Ads about social issues, civil rights, elections, or political campaigns and figures.",
      icon: Megaphone,
    },
  ];

  const toggleCategory = (id) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleBuyingTypeChange = (newBuyingType) => {
    setBuyingType(newBuyingType);
    const params = new URLSearchParams(window.location.search);
    params.set("buyingType", newBuyingType);
    const newUrl = `/dashboard/ads-manager/create-ads-manager/${objective}?${params.toString()}`;
    router.push(newUrl);
  };

  const handleObjectiveChange = (newObjective) => {
    setObjective(newObjective);
    const params = new URLSearchParams(window.location.search);
    params.set("buyingType", buyingType);
    const newUrl = `/dashboard/ads-manager/create-ads-manager/${newObjective}?${params.toString()}`;
    router.push(newUrl);
  };

  useImperativeHandle(ref, () => ({
    getData: () => {
      const payload = {
        campaignName,
        buyingType,
        objective: "BRAND_AWARENESS",
        advantagePlus,
        ...(advantagePlus && {
          budget: {
            type: budgetType,
            amount: parseFloat(budgetAmount),
            currency: "INR"
          },
          bidStrategy: bidStrategy,
          scheduleBudget: scheduleBudget,
          ...(scheduleBudget && {
            budgetIncrease: {
              amount: parseFloat(budgetIncreaseAmount)
            }
          })
        }),

        ...(advantagePlus && scheduleBudget && scheduleStartEnd && {
          startTime: scheduleStartEnd.startTime,
          endTime: scheduleStartEnd.endTime
        }),
        specialAdCategories: selectedCategories
      };

      console.log("Campaign Data:", payload);
      return payload;
    }
  }));

  const objectivesFiltered =
    buyingType === "reservation"
      ? objectives.filter((obj) =>
        ["Awareness", "Engagement"].includes(obj.id)
      )
      : objectives;

  return (
    <div className="max-w-2xl">
      <div className="space-y-4">
        {/* Campaign Name Section */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-full border-2 border-green-500 flex items-center justify-center">
              <svg
                className="w-3 h-3 text-green-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">
              Campaign name
            </h3>
          </div>
          <input
            type="text"
            value={campaignName}
            onChange={(e) => { setCampaignName(e.target.value); onNameChange?.(e.target.value); }}
            className="flex-1 w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Campaign Details Section - NOW EDITABLE */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 rounded-full border-2 border-green-500 flex items-center justify-center">
              <svg
                className="w-3 h-3 text-green-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">
              Campaign details
            </h3>
          </div>

          <div className="space-y-4">
            {/* ✅ Buying Type - Now Editable */}
            <div>
              <label className="text-sm font-semibold text-gray-900 block mb-2">
                Buying type
              </label>
              <Select
                value={buyingType}
                onValueChange={handleBuyingTypeChange}
              >
                <SelectTrigger className="w-full border border-gray-300 bg-white rounded-md px-3 py-2 text-sm text-gray-800 focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 transition-all">
                  <SelectValue>
                    {buyingTypes.find((type) => type.id === buyingType)?.label || "Select buying type"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200 shadow-md rounded-lg">
                  {buyingTypes.map((type) => (
                    <SelectItem
                      key={type.id}
                      value={type.id}
                      className="cursor-pointer py-2 px-3 rounded-md text-sm text-gray-800 hover:bg-indigo-50 focus:bg-indigo-50"
                    >
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ✅ Campaign Objective - Now Editable */}
            <div>
              <div className="flex items-center gap-1 mb-2">
                <label className="text-sm font-semibold text-gray-900">
                  Campaign objective
                </label>
                <Info className="w-4 h-4 text-gray-400" />
              </div>
              <Select
                value={objective}
                onValueChange={handleObjectiveChange}
              >
                <SelectTrigger className="w-full border border-gray-300 bg-white rounded-md px-3 py-2 text-sm text-gray-800 focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 transition-all">
                  <SelectValue>
                    {objectivesFiltered.find((obj) => obj.id === objective)?.label || "Select objective"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200 shadow-md rounded-lg">
                  {objectivesFiltered.map((obj) => (
                    <SelectItem
                      key={obj.id}
                      value={obj.id}
                      className="cursor-pointer py-2 px-3 rounded-md text-sm text-gray-800 hover:bg-indigo-50 focus:bg-indigo-50"
                    >
                      {obj.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Advantage+ campaign budget Section */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full border-2 border-green-500 flex items-center justify-center">
                <svg
                  className="w-3 h-3 text-green-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-900">
                Advantage+ campaign budget
              </h3>
            </div>

            {/* Switch */}
            <button
              onClick={() => setAdvantagePlus(!advantagePlus)}
              className={`relative inline-flex h-6 w-11 items-center cursor-pointer rounded-full transition-colors ${advantagePlus ? "bg-indigo-600" : "bg-gray-300"
                }`}
            >

              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${advantagePlus ? "translate-x-6" : "translate-x-1"
                  }`}
              />
            </button>
          </div>

          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            Distribute your budget across ad sets to get more results. You can
            control spending for each ad set.{" "}
            <a href="#" className="text-indigo-600 hover:text-indigo-700">
              About Advantage+ campaign budget
            </a>
          </p>

          {/* Budget Options - Show when switch is ON */}
          {advantagePlus && (
            <div className="space-y-4 pt-4 border-t">
              {/* Budget Section */}
              <div>
                <div className="flex items-center gap-1 mb-2">
                  <label className="text-sm font-semibold text-gray-900">
                    Budget
                  </label>
                  <Info className="w-4 h-4 text-gray-400" />
                </div>

                <div className="flex items-center gap-2">
                  <Select value={budgetType} onValueChange={setBudgetType}>
                    <SelectTrigger className="w-70">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily budget</SelectItem>
                      <SelectItem value="lifetime">Lifetime budget</SelectItem>
                    </SelectContent>
                  </Select>

                  <span className="text-sm text-gray-700">₹</span>
                  <input
                    type="number"
                    value={budgetAmount}
                    onChange={(e) => setBudgetAmount(e.target.value)}
                    className="w-70 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">INR</span>
                </div>

                <p className="text-xs text-gray-600 mt-2">
                  You will spend an average of ₹{budgetAmount} per day. Your maximum
                  daily spend is ₹{(parseFloat(budgetAmount) * 1.75).toFixed(2)} and your maximum weekly spend is
                  ₹{(parseFloat(budgetAmount) * 7).toFixed(2)}.{" "}
                  <a href="#" className="text-indigo-600 hover:text-indigo-700">
                    About daily budget
                  </a>
                </p>
              </div>

              {/* Campaign bid strategy */}
              <div>
                <div className="flex items-center gap-1 mb-2">
                  <label className="text-sm font-semibold text-gray-900">
                    Campaign bid strategy
                  </label>
                  <Info className="w-4 h-4 text-gray-400" />
                </div>

                <Select value={bidStrategy} onValueChange={setBidStrategy}>
                  <SelectTrigger className="w-full border border-gray-300 bg-white rounded-md px-3 py-2 text-sm text-gray-800 focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 transition-all">
                    <SelectValue>
                      {bidStrategies.find((strategy) => strategy.id === bidStrategy)?.label || "Select bid strategy"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200 shadow-md rounded-lg">
                    {bidStrategies.map((strategy) => (
                      <SelectItem
                        key={strategy.id}
                        value={strategy.id}
                        className="cursor-pointer py-2 px-3 rounded-md text-sm text-gray-800 hover:bg-indigo-50 focus:bg-indigo-50"
                      >

                        <div className="flex flex-col">
                          <div>{strategy.label}</div>
                          {strategy.description && (
                            <span className="text-xs text-gray-500">{strategy.description}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <p className="text-xs text-gray-600 mt-2">
                  {bidStrategies.find((strategy) => strategy.id === bidStrategy)?.description}
                </p>
              </div>

              {/* Budget scheduling */}
              <div className="pt-4 border-t">
                <div className="flex items-center gap-1 mb-2">
                  <label className="text-sm font-semibold text-gray-900">
                    Budget scheduling
                  </label>
                  <Info className="w-4 h-4 text-gray-400" />
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Increase your budget during specific days or times.
                </p>

                {/* Schedule budget increases checkbox */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="scheduleBudget"
                      disabled={budgetType === "daily"}

                      checked={scheduleBudget}
                      onChange={(e) => setScheduleBudget(e.target.checked)}
                      className="accent-indigo-600 w-4 h-4"
                    />


                    <label
                      htmlFor="scheduleBudget"
                      className="text-sm text-gray-900"
                    >
                      Schedule budget increases
                    </label>

                  </div>

                </div>
                {budgetType === "daily" && (
                  <p className="text-xs text-gray-500 mt-1">
                    Budget scheduling is only available for lifetime budgets.
                  </p>
                )}

                {/* Time period section - shows when checkbox is checked */}
                {scheduleBudget && (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-900">
                        Time period for budget increase
                      </h4>
                      <ChevronDown className="w-4 h-4 text-gray-600" />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-900 block mb-2">
                        Time Period
                      </label>
                      <RangePicker
                        showTime={{ format: "HH:mm" }}
                        format="YYYY-MM-DD HH:mm"
                        style={{ width: "100%" }}
                        onChange={(dates) => {
                          if (dates && dates[0] && dates[1]) {
                            setScheduleStartEnd({
                              startTime: dates[0].toISOString(),
                              endTime: dates[1].toISOString(),
                            });
                          } else {
                            setScheduleStartEnd(null);
                          }
                        }}
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <Select defaultValue="value">
                        <SelectTrigger className="w-72">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="value">
                            Increase daily budget by value amount (₹)
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      <span className="text-sm text-gray-700">₹</span>

                      <input
                        type="number"
                        value={budgetIncreaseAmount}
                        onChange={(e) => setBudgetIncreaseAmount(e.target.value)}
                        className="w-32 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />

                      <span className="text-sm text-gray-700">INR</span>
                    </div>

                    <p className="text-sm text-gray-600">
                      Meta will aim to spend an average of ₹
                      {parseFloat(budgetAmount) + parseFloat(budgetIncreaseAmount || 0)} a day
                      (a ₹{budgetIncreaseAmount || 50} increase) during this period.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Special Ad Categories */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-full border-2 border-green-500 flex items-center justify-center">
              <svg
                className="w-3 h-3 text-green-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">
              Special Ad Categories
            </h3>
          </div>

          <p className="text-sm text-gray-600 mb-4 leading-relaxed">
            Declare if your ads are related to financial products and services,
            employment, housing, or social issues, elections or politics to help
            prevent ad rejections.
            <a href="#" className="text-indigo-600 hover:text-indigo-700 ml-1">
              About Special Ad Categories
            </a>
          </p>

          {/* Multi Select */}
          <div className="space-y-3">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategories.includes(cat.id);
              return (
                <div
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  className={`flex items-start gap-3 border rounded-md p-3 cursor-pointer transition-all ${isSelected
                    ? "bg-indigo-50 border-indigo-300"
                    : "border-gray-200 hover:bg-gray-50"
                    }`}
                >
                  <div className="shrink-0 mt-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="accent-indigo-600 w-4 h-4"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-gray-700" />
                      <span className="text-sm font-medium text-gray-900">
                        {cat.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 leading-snug">
                      {cat.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Show selected names at top */}
          {selectedCategories.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {selectedCategories.map((id) => {
                const cat = categories.find((c) => c.id === id);
                const Icon = cat.icon;
                return (
                  <div
                    key={id}
                    className="flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs"
                  >
                    <Icon className="w-3 h-3" />
                    {cat.label}
                    <X
                      size={12}
                      className="cursor-pointer ml-1"
                      onClick={() => toggleCategory(id)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
CampaignForm.displayName = "CampaignForm";

/* -----------------------------
   Step 2: Ad Set Targeting
------------------------------ */

const AdSetsForm = forwardRef(({ adAccountId, metaAccountId, campaignData = {}, onNameChange }, ref) => {
  const [adSetName, setAdSetName] = useState("New Awareness ad set");
  const [performanceGoal, setPerformanceGoal] = useState(
    "Maximise reach of ads"
  );
  // ✅ NEW: Pixel states
  const [pixelId, setPixelId] = useState("");
  const [pixels, setPixels] = useState([]);
  const [loadingPixels, setLoadingPixels] = useState(false);
  const [facebookPage, setFacebookPage] = useState("");
  const [facebookPages, setFacebookPages] = useState([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [costGoal, setCostGoal] = useState("");
  const [scheduleBudget, setScheduleBudget] = useState(false);
  const [endDateEnabled, setEndDateEnabled] = useState(false);
  // ✅ Add state for other fields
  const [budgetType, setBudgetType] = useState("daily");
  const [budgetAmount, setBudgetAmount] = useState("200.00");
  // ✅ NEW: Country selection states
  const [countries, setCountries] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState("IN"); // Default India (ISO2)
  const [selectedCountryName, setSelectedCountryName] = useState("India");
  // ✅ NEW: Date states for schedule
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  // ✅ NEW: Date states for scheduled budget period
  const [scheduleStartTime, setScheduleStartTime] = useState(null);
  const [scheduleEndTime, setScheduleEndTime] = useState(null);
  const [increaseAmount, setIncreaseAmount] = useState("50");
  const [minAge, setMinAge] = useState("18");
  const [maxAge, setMaxAge] = useState("65");

  const getSessionCookie = () => {
    if (typeof document !== "undefined") {
      const token = document.cookie
        .split("; ")
        .find((row) => row.startsWith("authjs.session-token="))
        ?.split("=")[1];
      return token ? `authjs.session-token=${token}` : "";
    }
    return "";
  };

  // ✅ NEW: Fetch Countries from API
  useEffect(() => {
    const fetchCountries = async () => {
      setLoadingCountries(true);
      try {
        const response = await fetch('https://countriesnow.space/api/v0.1/countries/iso');
        const result = await response.json();

        console.log("🌍 Fetched Countries:", result);

        if (result.error === false && result.data) {
          // Sort alphabetically by country name
          const sortedCountries = result.data.sort((a, b) =>
            a.name.localeCompare(b.name)
          );
          setCountries(sortedCountries);
        }
      } catch (error) {
        console.error("❌ Error fetching countries:", error);
      } finally {
        setLoadingCountries(false);
      }
    };

    fetchCountries();
  }, []);
  // ✅ NEW: Fetch Facebook Pages on component mount
const fetchPages = useCallback(async () => {
  if (!metaAccountId) return;
  
  setLoadingPages(true);
  setFacebookPages([]); // reset before fetch
  
  try {
    const response = await fetch(
      `/api/meta/facebook-pages?adAccountId=${metaAccountId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",  // ✅ Cache bypass करो
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log("🔹 Fetched Pages:", result);

    if (result.success && result.pages?.length > 0) {
      setFacebookPages(result.pages);
      setFacebookPage(result.pages[0].metaPageId);
    } else {
      // ✅ Retry once if empty
      console.warn("⚠️ Empty pages, retrying in 1s...");
      setTimeout(fetchPages, 1000);
    }
  } catch (error) {
    console.error("❌ Error fetching pages:", error);
  } finally {
    setLoadingPages(false);
  }
}, [metaAccountId]);

// ✅ Retry जब metaAccountId change हो
useEffect(() => {
  if (!metaAccountId) return;
  fetchPages();
}, [metaAccountId, fetchPages]);

  // Add inside AdSetsForm component:
  useEffect(() => {
    const fetchPixels = async () => {
      setLoadingPixels(true);
      try {
        const sessionCookie = getSessionCookie();
        console.log("🔹 [Pixels] Session Cookie:", sessionCookie);

        const response = await fetch(`/api/meta/pixels?adAccountId=${adAccountId}&sync=true`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Cookie: sessionCookie,
          },
        });

        console.log("🔹 [Pixels] Response Status:", response.status);

        const result = await response.json();
        console.log("🔹 [Pixels] Fetched Data:", result);

        if (result.success && result.pixels) {
          setPixels(result.pixels);
          if (result.pixels.length > 0) {
            setPixelId(result.pixels[0].metaPixelId);
          }
        }
      } catch (error) {
        console.error("❌ [Pixels] Error fetching:", error);
      } finally {
        setLoadingPixels(false);
      }
    };

    fetchPixels();
  }, []);

  // ✅ Expose getData function
  useImperativeHandle(ref, () => ({
    getData: () => {
      const selectedPage = facebookPages.find(p => p.metaPageId === facebookPage);
      const selectedPixel = pixels.find(p => p.metaPixelId === pixelId);
      const payload = {
        adSetName,
        performanceGoal,
        facebookPage: selectedPage?.name || facebookPage,
        facebookPageId: facebookPage,
        pixelName: selectedPixel?.name || "",
        pixelId: pixelId,
        costGoal: costGoal ? parseFloat(costGoal) : null,

        // ✅ FIXED: Only send budget if campaignData.advantagePlus is false
        ...(!campaignData?.advantagePlus && {
          budgetType: budgetType,
          // ✅ Send dailyBudget OR lifetimeBudget based on type
          ...(budgetType === "daily" && {
            dailyBudget: parseFloat(budgetAmount || 200),
          }),
          ...(budgetType === "lifetime" && {
            lifetimeBudget: parseFloat(budgetAmount || 200),
          }),
          currency: "INR"
        }),

        // ✅ UPDATED: Send startTime (required)
        startTime: startTime ? startTime.toISOString() : new Date().toISOString(),
        // ✅ UPDATED: Send endTime only if provided
        ...(endDateEnabled && endTime && {
          endTime: endTime.toISOString()
        }),

        scheduleBudget,
        // ✅ UPDATED: Send schedule period if scheduleBudget is enabled
        ...(scheduleBudget &&
          scheduleStartTime && {
          schedulePeriod: {
            startTime: scheduleStartTime.toISOString(),
            ...(scheduleEndTime && { endTime: scheduleEndTime.toISOString() }),
          },
          budgetIncreaseAmount: parseFloat(increaseAmount) || 50,   // ← now uses state
        }),

        audienceControls: {
          location: selectedCountry,
          locationName: selectedCountryName,
          minimumAge: parseInt(minAge) || 18,
          maximumAge: parseInt(maxAge) || 65,     // ← added
        },
      };
      console.log("Ad Set Data:", payload);
      return payload;
    }
  }));

  return (
    <div className="max-w-2xl space-y-5">
      {/* 🔹 Ad set name section */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full border-2 border-green-500 flex items-center justify-center">
              <svg
                className="w-3 h-3 text-green-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Ad set name</h3>
          </div>
        </div>

        <input
          type="text"
          value={adSetName}
          onChange={(e) => { setAdSetName(e.target.value); onNameChange?.(e.target.value); }}
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* 🔹 Awareness Section */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 rounded-full border-2 border-green-500 flex items-center justify-center">
            <svg
              className="w-3 h-3 text-green-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Awareness</h3>
        </div>

        <div className="space-y-6">
          {/* Performance Goal */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Performance goal
            </label>
            <p className="text-xs text-gray-500 mb-2">
              How you measure success for your ads.{" "}
              <a href="#" className="text-indigo-600 hover:underline">
                About performance goals
              </a>
            </p>

            <Select
              value={performanceGoal}
              onValueChange={(v) => setPerformanceGoal(v)}
            >

              <SelectTrigger className="w-full">
                <SelectValue>
                  <div className="text-sm font-medium text-gray-900">
                    {performanceGoal}
                  </div>
                </SelectValue>
              </SelectTrigger>

              <SelectContent className="w-(--radix-select-trigger-width)">
                <div className="px-3 py-2 border-b text-xs font-semibold text-gray-500">
                  Awareness goals
                </div>

                <SelectItem value="Maximise reach of ads">
                  <div className="w-full">
                    <div className="text-sm font-medium text-gray-900">
                      Maximise reach of ads
                    </div>
                    <p className="text-xs text-gray-600">
                      We’ll try to show your ads to as many people as possible.
                    </p>
                  </div>
                </SelectItem>

                <SelectItem value="Maximise number of impressions">
                  <div className="w-full">
                    <div className="text-sm font-medium text-gray-900">
                      Maximise number of impressions
                    </div>
                    <p className="text-xs text-gray-600">
                      We’ll try to show your ads to people as many times as
                      possible.
                    </p>
                  </div>
                </SelectItem>

                <SelectItem value="Maximise ad recall lift">
                  <div className="w-full">
                    <div className="text-sm font-medium text-gray-900">
                      Maximise ad recall lift
                    </div>
                    <p className="text-xs text-gray-600">
                      We’ll try to show your ads to people who are likely to
                      remember seeing them.
                    </p>
                  </div>
                </SelectItem>

                {/* Video view goals */}
                <div className="px-3 py-2 border-b text-xs font-semibold text-gray-500 mt-2">
                  Video view goals
                </div>

                <SelectItem value="Maximise ThruPlay views">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      Maximise ThruPlay views
                    </div>
                    <p className="text-xs text-gray-600">
                      We’ll try to show your video ads to people who will watch
                      the entire video when it’s shorter than 15 seconds, or at
                      least 15 seconds for longer videos.
                    </p>
                  </div>
                </SelectItem>

              </SelectContent>
            </Select>

            <p className="text-xs text-gray-500 my-1">
              To help us improve delivery, we may survey a small section of your
              audience.
            </p>
          </div>

          {/* Facebook Page */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Facebook Page
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Choose the Page that you want to promote.
            </p>

            {loadingPages ? (
              <div className="text-sm text-gray-500">Loading pages...</div>
            ) : (
              <Select
                value={facebookPage}
                onValueChange={(v) => {
                  setFacebookPage(v);
                  console.log("🔹 Selected Page ID:", v); // ✅ Console log
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
  {facebookPage ? (
    <div className="flex items-center gap-2">
      {(() => {
        const page = facebookPages.find(
          (p) => p.metaPageId === facebookPage
        );

        return (
          <>
            {page?.picture ? (
              <img
                src={page.picture}
                alt={page.name}
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-200 text-cyan-800 font-semibold text-sm">
                {page?.name?.charAt(0) || "?"}
              </div>
            )}

            <span className="text-sm font-medium text-gray-900">
              {page?.name || "Select a page"}
            </span>
          </>
        );
      })()}
    </div>
  ) : (
    "Select a page"
  )}
</SelectValue>
                </SelectTrigger>

               <SelectContent>
  {facebookPages.length > 0 ? (
    facebookPages.map((page) => (
      <SelectItem key={page.id} value={page.metaPageId}>
        <div className="flex items-center gap-3">
          
          {page.picture ? (
            <img
              src={page.picture}
              alt={page.name}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-cyan-200 text-cyan-800 font-semibold text-sm">
              {page.name.charAt(0)}
            </div>
          )}

          <div>
            <div className="text-sm font-medium text-gray-900">
              {page.name}
            </div>
            <p className="text-xs text-gray-500">
              ID: {page.metaPageId}
            </p>
          </div>

        </div>
      </SelectItem>
    ))
  ) : (
    <div className="px-3 py-2 text-sm text-gray-500">
      No pages found
    </div>
  )}
</SelectContent>
              </Select>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Pixel Id
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Choose the Pixel for tracking conversions.
            </p>

            {loadingPixels ? (
              <div className="text-sm text-gray-500">Loading pixels...</div>
            ) : (
              <Select
                value={pixelId}
                onValueChange={(v) => {
                  setPixelId(v);
                  console.log("🔹 Selected Pixel ID:", v);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {pixelId ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-200 text-purple-800 font-semibold text-sm">
                          {pixels.find(p => p.metaPixelId === pixelId)?.name.charAt(0).toUpperCase() || ""}
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {pixels.find(p => p.metaPixelId === pixelId)?.name || "Select a pixel"}
                        </span>
                      </div>
                    ) : (
                      "Select a pixel"
                    )}
                  </SelectValue>
                </SelectTrigger>

                <SelectContent>
                  {pixels.length > 0 ? (
                    pixels.map((pixel) => (
                      <SelectItem key={pixel.id} value={pixel.metaPixelId}>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-200 text-purple-800 font-semibold text-sm">
                            {pixel.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {pixel.name}
                            </div>
                            <p className="text-xs text-gray-500">
                              ID: {pixel.metaPixelId}
                            </p>
                          </div>
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      No pixels found
                    </div>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Cost per result goal */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Cost per result goal{" "}
              <span className="text-gray-500">(Optional)</span>
            </label>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-gray-700">₹</span>
              <input
                type="number"
                value={costGoal}
                onChange={(e) => setCostGoal(e.target.value)}
                placeholder="X.XX"
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">INR</span>
            </div>
          </div>
        </div>
      </div>



      {/* Budget and Schedule */}
      <div className="bg-white rounded-lg p-6 shadow-sm space-y-6">

        {/* ──────────────────────────────────────── */}
        {/* When Advantage+ campaign budget is ON    */}
        {/* ──────────────────────────────────────── */}
        {campaignData?.advantagePlus ? (
          <div className="space-y-5">
            <div>
              <label className="text-sm font-semibold text-gray-900 block mb-1">
                Campaign budget
              </label>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-700">
                  You set a <strong>{campaignData.budget?.type === "daily" ? "daily" : "lifetime"}</strong>&nbsp;
                  Advantage+campaign budget of <strong>₹{campaignData.budget?.amount?.toFixed(2)}</strong>.
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Budget is controlled at the campaign level. No separate budget needed here.
                </p>
              </div>
            </div>

            {/* Keep schedule section visible and unchanged */}
            <div className="border-t pt-5">
              <label className="text-sm font-semibold text-gray-900 block mb-2">
                Schedule
              </label>
              {/* ... existing schedule code remains exactly the same ... */}
              <div className="flex items-center gap-2 mb-3">
                <label className="text-sm text-gray-700 w-20">Start time</label>
                <DatePicker
                  showTime
                  format="YYYY-MM-DD HH:mm"
                  style={{ width: "240px" }}
                  defaultValue={dayjs()}   // 👈 auto current date-time

                  onChange={(date) => {
                    setStartTime(date ? date.toDate() : null);
                  }}
                />
              </div>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={endDateEnabled}
                  onChange={(e) => setEndDateEnabled(e.target.checked)}
                  className="accent-indigo-600 w-4 h-4"
                />
                <label className="text-sm text-gray-900">Set an end time</label>
              </div>
              {endDateEnabled && (
                <div className="flex items-center gap-2 mt-2">
                  <label className="text-sm text-gray-700 w-20">End time</label>
                  <DatePicker
                    showTime
                    format="YYYY-MM-DD HH:mm"
                    style={{ width: "240px" }}
                    onChange={(date) => {
                      setEndTime(date ? date.toDate() : null);
                    }}
                  />
                </div>
              )}
            </div>

            {/* Budget Scheduling */}
            <div className="border-t pt-4">
              <div className="flex items-center gap-1 mb-2">
                <label className="text-sm font-semibold text-gray-900">
                  Budget scheduling
                </label>
                <Info className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Increase your budget during specific days or times.
              </p>

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="scheduleBudget"
                    checked={scheduleBudget}
                    onChange={(e) => setScheduleBudget(e.target.checked)}
                    className="accent-indigo-600 w-4 h-4"
                  />
                  <label htmlFor="scheduleBudget" className="text-sm text-gray-900">
                    Schedule budget increases
                  </label>
                </div>
              </div>

              {scheduleBudget && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-900">
                      Time period for budget increase
                    </h4>
                    <ChevronDown className="w-4 h-4 text-gray-600" />
                  </div>

                  {scheduleBudget && (
                    <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                      <RangePicker
                        showTime={{ format: "HH:mm" }}
                        format="YYYY-MM-DD HH:mm"
                        style={{ width: "100%" }}
                        onChange={(dates) => {
                          if (dates?.[0] && dates?.[1]) {
                            setScheduleStartTime(dates[0].toDate());
                            setScheduleEndTime(dates[1].toDate());
                          }
                        }}
                      />

                      <div className="flex items-center gap-3">
                        <Select value="amount" disabled>
                          <SelectTrigger className="w-72">
                            <SelectValue>Increase by amount (₹)</SelectValue>
                          </SelectTrigger>
                        </Select>

                        <span className="text-sm">₹</span>

                        <input
                          type="number"
                          value={increaseAmount}          // ← ये सबसे जरूरी
                          onChange={(e) => setIncreaseAmount(e.target.value)}
                          placeholder="50"
                          className="w-32 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />

                        <span className="text-sm">INR</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Meta will aim to spend an average of ₹{parseFloat(budgetAmount) + parseFloat(increaseAmount || 0)} a day
                        (a ₹{increaseAmount} increase) during this period.
                      </p>
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>
        ) : (
          /* ──────────────────────────────────────── */
          /* When Advantage+ is OFF → keep original   */
          /* ──────────────────────────────────────── */
          <>
            {/* Budget */}
            <div>
              <label className="text-sm font-semibold text-gray-900 block mb-2">
                Budget
              </label>
              <div className="flex items-center gap-2">
                <Select value={budgetType} onValueChange={setBudgetType}>
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily budget</SelectItem>
                    <SelectItem value="lifetime">Lifetime budget</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-gray-700">₹</span>
                <input
                  type="number"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  className="w-64 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">INR</span>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                You will spend an average of ₹{parseFloat(budgetAmount).toFixed(2)} per day....
              </p>
            </div>

            {/* Schedule (same as before) */}
            {/* Schedule */}
            <div className="border-t pt-4">
              <label className="text-sm font-semibold text-gray-900 block mb-2">
                Schedule
              </label>

              {/* Start Date */}
              <div className="flex items-center gap-2 mb-3">
                <label className="text-sm text-gray-700 w-20">Start time</label>
                <DatePicker
                  showTime
                  format="YYYY-MM-DD HH:mm"
                  defaultValue={dayjs()}   // 👈 auto current date-time

                  style={{ width: "240px" }}
                  onChange={(date) => {
                    setStartTime(date ? date.toDate() : null);
                    console.log("✅ Start Time:", date ? date.toISOString() : null);
                  }}
                />
              </div>

              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={endDateEnabled}
                  onChange={(e) => setEndDateEnabled(e.target.checked)}
                  className="accent-indigo-600 w-4 h-4"
                />
                <label className="text-sm text-gray-900">Set an end time</label>
              </div>

              {/* End Date (when checkbox enabled) */}
              {endDateEnabled && (
                <div className="flex items-center gap-2 mt-2">
                  <label className="text-sm text-gray-700 w-20">End time</label>
                  <DatePicker
                    showTime
                    format="YYYY-MM-DD HH:mm"
                    style={{ width: "240px" }}
                    onChange={(date) => {
                      setEndTime(date ? date.toDate() : null);
                      console.log("✅ End Time:", date ? date.toISOString() : null);
                    }}
                  />
                </div>
              )}
            </div>

            {/* Budget Scheduling */}
            <div className="border-t pt-4">
              <div className="flex items-center gap-1 mb-2">
                <label className="text-sm font-semibold text-gray-900">
                  Budget scheduling
                </label>
                <Info className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Increase your budget during specific days or times.
              </p>

              <div className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  checked={scheduleBudget}
                  onChange={(e) => setScheduleBudget(e.target.checked)}
                  className="accent-indigo-600 w-4 h-4"
                />
                <label className="text-sm text-gray-900">Schedule budget increases</label>
              </div>

              {scheduleBudget && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <RangePicker
                    showTime={{ format: "HH:mm" }}
                    format="YYYY-MM-DD HH:mm"
                    style={{ width: "100%" }}
                    onChange={(dates) => {
                      if (dates?.[0] && dates?.[1]) {
                        setScheduleStartTime(dates[0].toDate());
                        setScheduleEndTime(dates[1].toDate());
                      }
                    }}
                  />
                  <div className="bg-gray-50 rounded-lg p-4 space-y-6">

                    <div className="flex items-center gap-3">
                      <Select defaultValue="value">
                        <SelectTrigger className="w-72">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="value">Increase by amount (₹)</SelectItem>
                          {/* <SelectItem value="percent">Increase by percentage</SelectItem> */}
                        </SelectContent>
                      </Select>
                      <span className="text-sm">₹</span>
                      <input
                        type="number"
                        value={increaseAmount}          // ← ये सबसे जरूरी
                        onChange={(e) => setIncreaseAmount(e.target.value)}
                        placeholder="50"
                        className="w-32 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />

                      <span className="text-sm">INR</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Meta will aim to spend an average of ₹{parseFloat(budgetAmount) + parseFloat(increaseAmount || 0)} a day
                      (a ₹{increaseAmount} increase) during this period.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 🔹 Audience Controls Section */}
      {/* 🔹 Audience Controls Section */}
      <div className="bg-white rounded-lg p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Audience controls
          </h3>
          <p className="text-xs text-gray-500">
            Set criteria for where ads for this campaign can be delivered.
          </p>
        </div>

        {/* 🌍 Location - WITH API INTEGRATION */}
        <div>
          <label className="text-sm font-semibold text-gray-900 block mb-1">
            Location
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Choose where your ads will be shown.
          </p>

          {loadingCountries ? (
            <div className="text-sm text-gray-500">Loading countries...</div>
          ) : (
            <Select
              value={selectedCountry}
              onValueChange={(iso2) => {
                setSelectedCountry(iso2);
                const country = countries.find(c => c.Iso2 === iso2);
                if (country) {
                  setSelectedCountryName(country.name);
                  console.log("✅ Selected Country:", {
                    name: country.name,
                    iso2: iso2
                  });
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {selectedCountryName || "Select location"}
                </SelectValue>
              </SelectTrigger>

              <SelectContent className="max-h-[300px]">
                {countries.map((country) => (
                  <SelectItem key={country.Iso2} value={country.Iso2}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {country.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({country.Iso2})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="mt-3 flex items-start gap-2 p-1">
            <Info className="w-4 h-4 mt-0.5" />
            <p className="text-xs text-gray-400 leading-snug">
              To run ads in India, you need to declare if your ads are related
              to securities and investments.
            </p>
          </div>
        </div>

        <div className="flex gap-3 items-center">
          <Select value={minAge} onValueChange={setMinAge}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 48 }, (_, i) => i + 18).map(age => (
                <SelectItem key={age} value={age.toString()}>{age}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-gray-500">to</span>

          <Select value={maxAge} onValueChange={setMaxAge}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 48 }, (_, i) => i + 18).map(age => (
                <SelectItem key={age} value={age.toString()}>{age}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

      </div>
    </div>
  );
});
AdSetsForm.displayName = "AdSetsForm";


/* -----------------------------
   Step 3: Ad Creative - Updated with multi-type carousel support
------------------------------ */

const AdForm = forwardRef(({ adAccountId, metaAccountId, onNameChange }, ref) => {
  const [description, setDescription] = useState("");
  const [adName, setAdName] = useState("New Awareness ad");
  const [facebookPages, setFacebookPages] = useState([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [facebookPage, setFacebookPage] = useState("");
  const [adSetup, setAdSetup] = useState("create-ad");
  const [format, setFormat] = useState("single");
  const [multiAdvertiser, setMultiAdvertiser] = useState(true);
  const [destination, setDestination] = useState("website");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [displayLink, setDisplayLink] = useState("");
  const [browserAddon, setBrowserAddon] = useState("none");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState(false);
  const [callbackEnabled, setCallbackEnabled] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [instagramAccounts, setInstagramAccounts] = useState([]);
  const [instagramAccountId, setInstagramAccountId] = useState("");
  const [loadingInstagram, setLoadingInstagram] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const websiteUrlRef = useRef("");
  const displayLinkRef = useRef("");

  // ✅ CHANGED: creativeTypes is now an ARRAY (supports multiple types)
  // For single format: ["image-ad"] or ["video-ad"]
  // For carousel format: ["image-card", "video-card"] both can exist together
  const [creativeTypes, setCreativeTypes] = useState([]);
  const creativeTypesRef = useRef([]);

  // ✅ Ad Creative fields
  const [primaryText, setPrimaryText] = useState("");
  const [headline, setHeadline] = useState("");
  const [callToAction, setCallToAction] = useState("learn-more");

  // ✅ Per-carousel-card metadata: { [index]: { headline, description, link } }
  const [cardMeta, setCardMeta] = useState({});
  const [openCardIndex, setOpenCardIndex] = useState(null);

  // ✅ Batch Drawer - now tracks which "slot" (type) we're adding for
  const [batchDrawerOpen, setBatchDrawerOpen] = useState(false);
  const [batchMediaType, setBatchMediaType] = useState(null);
  // ✅ drawerKey: increment on every open to force fresh remount (clears drawer's internal cache)
  const [drawerKey, setDrawerKey] = useState(0);

  const getSessionCookie = () => {
    if (typeof document !== "undefined") {
      const token = document.cookie
        .split("; ")
        .find((row) => row.startsWith("authjs.session-token="))
        ?.split("=")[1];
      return token ? `authjs.session-token=${token}` : "";
    }
    return "";
  };

  // ✅ Fetch Facebook Pages
const fetchPages = useCallback(async () => {
  if (!metaAccountId) return;
  
  setLoadingPages(true);
  setFacebookPages([]); // reset before fetch
  
  try {
    const response = await fetch(
      `/api/meta/facebook-pages?adAccountId=${metaAccountId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",  // ✅ Cache bypass करो
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log("🔹 Fetched Pages:", result);

    if (result.success && result.pages?.length > 0) {
      setFacebookPages(result.pages);
      setFacebookPage(result.pages[0].metaPageId);
    } else {
      // ✅ Retry once if empty
      console.warn("⚠️ Empty pages, retrying in 1s...");
      setTimeout(fetchPages, 1000);
    }
  } catch (error) {
    console.error("❌ Error fetching pages:", error);
  } finally {
    setLoadingPages(false);
  }
}, [metaAccountId]);

// ✅ Retry जब metaAccountId change हो
useEffect(() => {
  if (!metaAccountId) return;
  fetchPages();
}, [metaAccountId, fetchPages]);

  // ✅ Fetch Instagram Accounts
  useEffect(() => {
    if (!adAccountId || !facebookPage) return;
    const fetchInstagramAccounts = async () => {
      setLoadingInstagram(true);
      try {
        const sessionCookie = getSessionCookie();
        const response = await fetch(
          `/api/meta/instagram-account?adAccountId=${adAccountId}&pageId=${facebookPage}`,
          { method: "GET", headers: { "Content-Type": "application/json", Cookie: sessionCookie } }
        );
        const result = await response.json();
        if (result.success && result.instagramAccounts) {
          setInstagramAccounts(result.instagramAccounts);
          if (result.instagramAccounts.length > 0)
            setInstagramAccountId(result.instagramAccounts[0].instagramUserId);
        }
      } catch (err) {
        console.error("❌ [AwarenessAdForm] Instagram fetch error:", err);
      } finally {
        setLoadingInstagram(false);
      }
    };
    fetchInstagramAccounts();
  }, [adAccountId, facebookPage]);

  // ✅ Reset creative on format change
  useEffect(() => {
    setCreativeTypes([]);
    creativeTypesRef.current = [];
    setSelectedImages([]);
    setCardMeta({});
    setOpenCardIndex(null);
  }, [format]);

  // ✅ Reset/sync cardMeta when images change
  useEffect(() => {
    if (format === "carousel") {
      setCardMeta((prev) => {
        const next = {};
        selectedImages.forEach((_, i) => {
          next[i] = prev[i] || { headline: "", description: "", link: "" };
        });
        return next;
      });
    }
  }, [selectedImages, format]);

  const selectedInstagram = instagramAccounts.find(
    (i) => i.instagramUserId === instagramAccountId
  );

  // ✅ HELPER: Check if a type is currently active
  const hasCreativeType = (type) => creativeTypes.includes(type);

  // ✅ HELPER: Open fresh drawer for a creative type
  const toggleCreativeType = (type, mediaType) => {
    let newTypes;
    if (format === "single") {
      newTypes = [type];
    } else {
      // Carousel: add type if not present; if already present just re-open fresh drawer
      newTypes = creativeTypes.includes(type)
        ? creativeTypes
        : [...creativeTypes, type];
    }
    setCreativeTypes(newTypes);
    creativeTypesRef.current = newTypes;

    // Always open FRESH drawer (drawerKey increment forces remount = empty state)
    setBatchMediaType(mediaType);
    setDrawerKey((k) => k + 1);
    setBatchDrawerOpen(true);
  };

  // Helper to update a single card's meta field
  const updateCardMeta = (index, field, value) => {
    setCardMeta((prev) => ({
      ...prev,
      [index]: {
        ...(prev[index] || { headline: "", description: "", link: "" }),
        [field]: value,
      },
    }));
  };

  // Toggle edit panel for a card
  const toggleCardEdit = (index) => {
    setOpenCardIndex((prev) => (prev === index ? null : index));
  };

  // ✅ Expose getData function
  useImperativeHandle(ref, () => ({
    getData: () => {
      const selectedPage = facebookPages.find((p) => p.metaPageId === facebookPage);

      // Build carousel cards — handles mixed image+video
      const buildCarouselCards = () =>
        selectedImages.map((item, i) => {
          const base = {
            headline: cardMeta[i]?.headline || "",
            description: cardMeta[i]?.description || "",
            link: cardMeta[i]?.link || "",
            cardType: item.type === "image" ? "image-card" : "video-card",
          };
          if (item.type === "image") {
            return { ...base, hash: item.hash || "", id: item.id || "", url: item.url || "", name: item.name || "" };
          } else {
            return { ...base, videoId: item.id || "", videoUrl: item.url || item.thumbnail || "", videoName: item.name || "" };
          }
        });

      const payload = {
        adName,
        identity: {
          facebookPage: selectedPage?.name || facebookPage,
          facebookPageId: facebookPage,
          instagramAccount: selectedInstagram
            ? { id: selectedInstagram.instagramUserId, username: selectedInstagram.username }
            : null,
        },
        adSetup,
        format,
        multiAdvertiser,
        destination,
        websiteUrl: websiteUrlRef.current,
        displayLink: displayLinkRef.current,

        creative: {
          // ✅ types is now an array
          types: creativeTypesRef.current,

          // ✅ Single image
          ...(format === "single" && creativeTypesRef.current.includes("image-ad") && selectedImages.length > 0 && {
            images: [{
              hash: selectedImages[0].hash,
              id: selectedImages[0].id,
              url: selectedImages[0].url || selectedImages[0].thumbnail,
              name: selectedImages[0].name,
            }]
          }),

          // ✅ Single video
          ...(format === "single" && creativeTypesRef.current.includes("video-ad") && selectedImages.length > 0 && {
            videoId: selectedImages[0].id,
            videoUrl: selectedImages[0].url || selectedImages[0].thumbnail,
            videoName: selectedImages[0].name,
          }),

          // ✅ Carousel — MIXED image+video cards supported
          ...(format === "carousel" && selectedImages.length > 0 && {
            carouselCards: buildCarouselCards(),
          }),

          primaryText,
          headline,
          description,
          callToAction,
        }
      };
      console.log("🔹 [AwarenessAdForm] getData payload:", payload);
      return payload;
    }
  }));

  // ✅ Count images/videos in selectedImages
  const imageCount = selectedImages.filter((i) => i.type === "image").length;
  const videoCount = selectedImages.filter((i) => i.type === "video").length;

  return (
    <div className="max-w-xl space-y-5">
      {/* 🔹 Ad name section */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full border-2 border-green-500 flex items-center justify-center">
              <svg
                className="w-3 h-3 text-green-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Ad name</h3>
          </div>
        </div>

        <input
          type="text"
          value={adName}
          onChange={(e) => { setAdName(e.target.value); onNameChange?.(e.target.value); }}
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* 🔹 Identity Section */}
      <div className="bg-white rounded-lg p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded-full border-2 border-blue-500 flex items-center justify-center">
            <svg
              className="w-3 h-3 text-blue-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.707a1 1 0 00-1.414 0L7 9.586V13a1 1 0 001 1h4a1 1 0 001-1V9.586l-2.293-2.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Identity</h3>
        </div>

        <p className="text-sm text-gray-600">
          The profiles that will be used in your ad.
        </p>

        {/* Facebook Page */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-1">
            Facebook Page
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Your ad must be associated with a Facebook Page.
          </p>

          {loadingPages ? (
            <div className="text-sm text-gray-500">Loading pages...</div>
          ) : (
             <Select
                value={facebookPage}
                onValueChange={(v) => {
                  setFacebookPage(v);
                  console.log("🔹 Selected Page ID:", v); // ✅ Console log
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
  {facebookPage ? (
    <div className="flex items-center gap-2">
      {(() => {
        const page = facebookPages.find(
          (p) => p.metaPageId === facebookPage
        );

        return (
          <>
            {page?.picture ? (
              <img
                src={page.picture}
                alt={page.name}
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-200 text-cyan-800 font-semibold text-sm">
                {page?.name?.charAt(0) || "?"}
              </div>
            )}

            <span className="text-sm font-medium text-gray-900">
              {page?.name || "Select a page"}
            </span>
          </>
        );
      })()}
    </div>
  ) : (
    "Select a page"
  )}
</SelectValue>
                </SelectTrigger>

               <SelectContent>
  {facebookPages.length > 0 ? (
    facebookPages.map((page) => (
      <SelectItem key={page.id} value={page.metaPageId}>
        <div className="flex items-center gap-3">
          
          {page.picture ? (
            <img
              src={page.picture}
              alt={page.name}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-cyan-200 text-cyan-800 font-semibold text-sm">
              {page.name.charAt(0)}
            </div>
          )}

          <div>
            <div className="text-sm font-medium text-gray-900">
              {page.name}
            </div>
            <p className="text-xs text-gray-500">
              ID: {page.metaPageId}
            </p>
          </div>

        </div>
      </SelectItem>
    ))
  ) : (
    <div className="px-3 py-2 text-sm text-gray-500">
      No pages found
    </div>
  )}
</SelectContent>
              </Select>
          )}
        </div>

        {/* Instagram Account */}
        <div className="pt-2">
          <div className="flex items-center gap-1 mb-1">
            <label className="text-sm font-semibold text-gray-900">
              Instagram account
            </label>
            <Info className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-xs text-gray-500 mb-2">
            Instagram account linked to selected Facebook Page
          </p>

          {loadingInstagram ? (
            <div className="text-sm text-gray-500">
              Loading Instagram accounts...
            </div>
          ) : (
            <Select
              value={instagramAccountId}
              onValueChange={(v) => setInstagramAccountId(v)}
              disabled={instagramAccounts.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {instagramAccountId ? (
                    <div className="flex items-center gap-2">
                      <img
                        src={
                          instagramAccounts.find(
                            (i) => i.instagramUserId === instagramAccountId
                          )?.profile_picture_url
                        }
                        alt="Instagram"
                        className="w-6 h-6 rounded-full"
                      />
                      <span className="text-sm font-medium text-gray-900">
                        {
                          instagramAccounts.find(
                            (i) => i.instagramUserId === instagramAccountId
                          )?.username
                        }
                      </span>
                    </div>
                  ) : (
                    "Select Instagram account"
                  )}
                </SelectValue>
              </SelectTrigger>

              <SelectContent>
                {instagramAccounts.length > 0 ? (
                  instagramAccounts.map((ig) => (
                    <SelectItem
                      key={ig.instagramUserId}
                      value={ig.instagramUserId}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={ig.profile_picture_url}
                          alt={ig.username}
                          className="w-8 h-8 rounded-full"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {ig.username}
                          </div>
                          <p className="text-xs text-gray-500">
                            ID: {ig.instagramUserId}
                          </p>
                        </div>
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-gray-500">
                    No Instagram account found
                  </div>
                )}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* 🔹 Ad Setup Section */}
      <div className="bg-white rounded-lg p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded-full border-2 border-green-500 flex items-center justify-center">
            <svg
              className="w-3 h-3 text-green-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Ad setup</h3>
        </div>

        {/* Create Ad / Use Existing / Mockup */}
        <Select value={adSetup} onValueChange={(v) => setAdSetup(v)}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {adSetup === "create-ad"
                ? "Create ad"
                : adSetup === "existing-post"
                  ? "Use existing post"
                  : "Use Creative Hub mockup"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="create-ad">Create ad</SelectItem>
            <SelectItem value="existing-post">Use existing post</SelectItem>
            <SelectItem value="mockup">Use Creative Hub mockup</SelectItem>
          </SelectContent>
        </Select>

        {/* Format Section */}
        <div className="pt-4 border-t">
          <div className="flex items-center gap-1 mb-2">
            <label className="text-sm font-semibold text-gray-900">
              Format
            </label>
            <Info className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Choose an ad creative layout.
          </p>

          {/* Radio buttons */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-900">
              <input
                type="radio"
                name="format"
                value="single"
                checked={format === "single"}
                onChange={(e) => setFormat(e.target.value)}
                className="accent-indigo-600"
              />
              Single image or video
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-900">
              <input
                type="radio"
                name="format"
                value="carousel"
                checked={format === "carousel"}
                onChange={(e) => setFormat(e.target.value)}
                className="accent-indigo-600"
              />
              Carousel
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-900">
              <input
                type="radio"
                name="format"
                value="collection"
                checked={format === "collection"}
                onChange={(e) => setFormat(e.target.value)}
                className="accent-indigo-600"
              />
              Collection
            </label>
          </div>
        </div>

        {/* Multi-advertiser ads */}
        <div className="pt-4 border-t">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={multiAdvertiser}
              onChange={(e) => setMultiAdvertiser(e.target.checked)}
              className="accent-indigo-600 mt-1"
            />
            <span className="text-sm text-gray-900 leading-snug">
              <span className="font-semibold">Multi-advertiser ads</span>
              <br />
              <span className="text-xs text-gray-600">
                Your ad can appear with others in the same ad unit to help
                promote discoverability. Your ad creative may be resized or
                cropped.{" "}
                <a href="#" className="text-indigo-600 hover:text-indigo-700">
                  About multi-advertiser ads
                </a>
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* 🔹 Destination Section */}
      <div className="bg-white rounded-lg p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 rounded-full border-2 border-blue-500 flex items-center justify-center">
            <svg
              className="w-3 h-3 text-blue-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 8a1 1 0 012 0v4a1 1 0 01-2 0V8z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Destination</h3>
        </div>

        <p className="text-sm text-gray-600">
          Tell us where to send people immediately after they tap or click your
          ad.{" "}
          <a href="#" className="text-indigo-600 hover:text-indigo-700">
            Learn more
          </a>
        </p>

        {/* 🟦 Show normal destination if Single Image or carousel */}
        {(format === "single" || format === "carousel") && (
          <>
            {/* Destination Options */}
            <div className="space-y-3">
              {["website", "call", "messaging"].map((option) => (
                <label
                  key={option}
                  className="flex items-start gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="destination"
                    value={option}
                    checked={destination === option}
                    onChange={(e) => setDestination(e.target.value)}
                    className="accent-indigo-600 mt-1"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900 capitalize">
                      {option === "website"
                        ? "Website"
                        : option === "call"
                          ? "Call"
                          : "Messaging apps"}
                    </span>
                    <p className="text-xs text-gray-600">
                      {option === "website"
                        ? "Send people to your website."
                        : option === "call"
                          ? "Let people call you directly."
                          : "Send people to Messenger, Instagram and WhatsApp."}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            {/* 🌐 Website Fields */}
            {destination === "website" && (
              <div className="space-y-4 border-t pt-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">
                    Website URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    placeholder="http://www.example.com/page"
                    value={websiteUrl}
                    onChange={(e) => { setWebsiteUrl(e.target.value); websiteUrlRef.current = e.target.value; }}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter the website URL field for your ad.
                  </p>
                  <a href="#" className="text-xs text-indigo-600">
                    Build a URL parameter
                  </a>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">
                    Display link
                  </label>
                  <input
                    type="text"
                    placeholder="Enter the link that you want to show on your ad"
                    value={displayLink}
                    onChange={(e) => { setDisplayLink(e.target.value); displayLinkRef.current = e.target.value; }}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">
                    Mobile app
                  </label>
                  <Select defaultValue="none">
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose app" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Choose app</SelectItem>
                      <SelectItem value="android">Android app</SelectItem>
                      <SelectItem value="ios">iOS app</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Browser Add-ons */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">
                    Browser add-ons
                  </h4>
                  <p className="text-xs text-gray-500 mb-3">
                    People will see your website when they tap on your ad. You
                    can add an additional contact method in the browser to help
                    people connect with you.
                  </p>

                  <div className="space-y-2">
                    {["none", "whatsapp"].map((opt) => (
                      <label
                        key={opt}
                        className="flex items-center gap-2 text-sm text-gray-900"
                      >
                        <input
                          type="radio"
                          name="addon"
                          value={opt}
                          checked={browserAddon === opt}
                          onChange={(e) => setBrowserAddon(e.target.value)}
                          className="accent-indigo-600"
                        />
                        {opt === "none"
                          ? "None – Don't add a button."
                          : "WhatsApp – Add a WhatsApp button on your website."}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 📞 Call Option */}
            {destination === "call" && (
              <div className="space-y-4 border-t pt-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1">
                    Call now <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <Select defaultValue="in">
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder="Country code" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in">+91 (India)</SelectItem>
                        <SelectItem value="us">+1 (USA)</SelectItem>
                        <SelectItem value="uk">+44 (UK)</SelectItem>
                      </SelectContent>
                    </Select>
                    <input
                      type="tel"
                      placeholder="Enter a phone number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className={`flex-1 px-3 py-2 border rounded text-sm focus:outline-none focus:ring-1 ${phoneError
                        ? "border-red-500 focus:ring-red-500"
                        : "border-gray-300 focus:ring-indigo-500"
                        }`}
                    />
                  </div>
                  {phoneError && (
                    <p className="text-xs text-red-500 mt-1">
                      Provide a valid phone number.
                    </p>
                  )}
                </div>

                {/* Callback Requests */}
                <div className="flex items-center justify-between border-t pt-3">
                  <label className="text-sm font-semibold text-gray-900">
                    Enable callback requests
                  </label>
                  <button
                    onClick={() => setCallbackEnabled(!callbackEnabled)}
                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${callbackEnabled ? "bg-indigo-600" : "bg-gray-300"
                      }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${callbackEnabled ? "translate-x-5" : "translate-x-1"
                        }`}
                    />
                  </button>
                </div>

                {callbackEnabled && (
                  <div className="space-y-2 ml-6">
                    <label className="flex items-center gap-2 text-sm text-gray-900">
                      <input
                        type="radio"
                        name="callback"
                        className="accent-indigo-600"
                      />
                      Receive callback requests in a spreadsheet
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-900">
                      <input
                        type="radio"
                        name="callback"
                        className="accent-indigo-600"
                      />
                      Receive callback requests on Messenger
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* 💬 Messaging Apps Option */}
            {destination === "messaging" && (
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-cyan-200 text-cyan-800 font-semibold text-sm">
                      N
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        Messenger
                      </div>
                      <p className="text-xs text-gray-500">Niya Bags</p>
                    </div>
                  </div>
                </div>

                {["Instagram", "WhatsApp"].map((app) => (
                  <div key={app} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-semibold text-sm">
                        {app.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {app}
                        </div>
                      </div>
                    </div>
                    <button className="text-xs px-3 py-1 cursor-pointer border border-gray-300 rounded hover:bg-gray-50">
                      Connect account
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Show Instant Experience only if collection */}
        {format === "collection" && (
          <div className="border-t pt-4 space-y-4">
            <div className="flex items-center gap-1 mb-1">
              <label className="text-sm font-semibold text-gray-900">
                Instant Experience
              </label>
              <Info className="w-4 h-4 text-gray-400" />
            </div>

            <input
              type="text"
              placeholder="Search for an existing Instant Experience"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />

            <button className="px-4 py-2 border text-sm border-gray-300 rounded hover:bg-gray-50">
              + Create new
            </button>

            <label className="flex items-center gap-2">
              <input type="checkbox" className="accent-indigo-600" />
              <span className="text-sm text-gray-900">
                Override catalogue website deep links
              </span>
            </label>
            <p className="text-xs text-gray-500 ml-6">
              This allows you to override any website deep links for items in
              the selected catalogue.
            </p>
          </div>
        )}
      </div>

      {/* 🔹 Ad Creative Section - UPDATED WITH MULTI-TYPE CAROUSEL SUPPORT */}
      <div className="bg-white rounded-lg p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 rounded-full border-2 border-blue-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 8a1 1 0 012 0v4a1 1 0 01-2 0V8z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Ad creative</h3>
        </div>

        <p className="text-sm text-gray-600">
          Select and optimise your ad text, media and enhancements.
        </p>

        {/* Common text fields - shown for ALL formats */}
        <div className="space-y-4 border-t pt-4">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <label className="text-sm font-semibold text-gray-900">Primary text</label>
              <Info className="w-4 h-4 text-gray-400" />
            </div>
            <textarea
              value={primaryText}
              onChange={(e) => setPrimaryText(e.target.value)}
              placeholder="Tell people what your ad is about"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              rows={3}
            />
          </div>

          {format === "single" && (
            <div>
              <div className="flex items-center gap-1 mb-1">
                <label className="text-sm font-semibold text-gray-900">Headline</label>
                <Info className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Write a short headline"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          )}

          {format === "single" && (
            <div>
              <div className="flex items-center gap-1 mb-1">
                <label className="text-sm font-semibold text-gray-900">Description</label>
                <Info className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Write a short description (optional)"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Call to action
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Choose a call-to-action button for your ad.
            </p>
            <Select value={callToAction} onValueChange={setCallToAction}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select button" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no-button">No button</SelectItem>
                <SelectItem value="learn-more">Learn more</SelectItem>
                <SelectItem value="apply-now">Apply now</SelectItem>
                <SelectItem value="book-now">Book now</SelectItem>
                <SelectItem value="contact-us">Contact us</SelectItem>
                <SelectItem value="download">Download</SelectItem>
                <SelectItem value="get-directions">Get directions</SelectItem>
                <SelectItem value="get-quote">Get quote</SelectItem>
                <SelectItem value="request-time">Request time</SelectItem>
                <SelectItem value="save">Save</SelectItem>
                <SelectItem value="see-menu">See menu</SelectItem>
                <SelectItem value="shop-now">Shop now</SelectItem>
                <SelectItem value="sign-up">Sign up</SelectItem>
                <SelectItem value="subscribe">Subscribe</SelectItem>
                <SelectItem value="watch-more">Watch more</SelectItem>
                <SelectItem value="send-whatsapp-message">Send WhatsApp message</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ✅ Single format — only one type at a time */}
        {format === "single" && (
          <div className="space-y-4 border-t pt-4">
            <label className="block text-sm font-semibold text-gray-900 mb-1">Set up creative</label>
            <Select
              value={creativeTypes[0] || ""}
              onValueChange={(value) => {
                // Single: clear old images and start fresh
                setSelectedImages([]);
                setCreativeTypes([value]);
                creativeTypesRef.current = [value];
                setBatchMediaType(value === "image-ad" ? "image" : "video");
                setDrawerKey((k) => k + 1);
                setBatchDrawerOpen(true);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Set up creative" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="image-ad">Image ad</SelectItem>
                <SelectItem value="video-ad">Video ad</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* ✅ Carousel format — MULTI-TYPE TOGGLE BUTTONS (image-card + video-card both selectable) */}
        {format === "carousel" && (
          <div className="space-y-4 border-t pt-4">
            <div>
              <div className="flex items-center gap-1 mb-1">
                <label className="text-sm font-semibold text-gray-900">Carousel cards</label>
                <Info className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-xs text-gray-500 mb-3">
                {selectedImages.length} of 10 cards added
                {imageCount > 0 && videoCount > 0 && (
                  <span className="ml-1 text-indigo-500">({imageCount} image{imageCount > 1 ? "s" : ""}, {videoCount} video{videoCount > 1 ? "s" : ""})</span>
                )}
              </p>

              {/* ✅ Two toggle buttons — both can be active simultaneously */}
              <div className="flex gap-2">
                {/* Image card button */}
                <button
                  type="button"
                  onClick={() => toggleCreativeType("image-card", "image")}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${hasCreativeType("image-card")
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:bg-indigo-50/50"
                    }`}
                >
                  {/* Image icon */}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Image card
                  {hasCreativeType("image-card") && imageCount > 0 && (
                    <span className="ml-1 bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {imageCount}
                    </span>
                  )}
                </button>

                {/* Video card button */}
                <button
                  type="button"
                  onClick={() => toggleCreativeType("video-card", "video")}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${hasCreativeType("video-card")
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:bg-indigo-50/50"
                    }`}
                >
                  {/* Video icon */}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.277A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                  </svg>
                  Video card
                  {hasCreativeType("video-card") && videoCount > 0 && (
                    <span className="ml-1 bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {videoCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ✅ Selected media preview — with per-card edit panel */}
        {selectedImages.length > 0 && (
          <div className="space-y-2 border-t pt-4">
            {selectedImages.map((item, index) => (
              <div key={`${item.hash || item.id}-${index}`} className="rounded-lg border border-gray-200 overflow-hidden">
                {/* Card row */}
                <div className="flex items-center gap-3 p-3 bg-white">
                  {/* Thumbnail */}
                  <div className="relative border rounded-lg overflow-hidden h-14 w-14 bg-gray-100 shrink-0">
                    <Image src={item.thumbnail} alt={item.name} fill className="object-cover" unoptimized sizes="56px" />
                    {item.type === "video" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M6 4l10 6-10 6V4z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Name & type */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate" title={item.name}>{item.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${item.type === "video" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                        {item.type === "video" ? "Video" : "Image"}
                      </span>
                      <span className="text-[10px] text-gray-400">· Card {index + 1}</span>
                    </div>
                    {/* Show filled card meta as hints */}
                    {format === "carousel" && (cardMeta[index]?.headline || cardMeta[index]?.description || cardMeta[index]?.link) && (
                      <p className="text-[10px] text-indigo-500 mt-0.5 truncate">
                        {[cardMeta[index]?.headline, cardMeta[index]?.description, cardMeta[index]?.link].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>

                  {/* Right-side actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Edit icon — only for carousel */}
                    {format === "carousel" && (
                      <button
                        onClick={() => toggleCardEdit(index)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 cursor-pointer rounded-md text-xs font-medium transition-colors ${openCardIndex === index
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600"
                          }`}
                      >
                        <Pencil className="w-3 h-3" />
                        {openCardIndex === index ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}

                    {/* ✅ Individual remove button — always visible */}
                    <button
                      onClick={() => {
                        const removedType = selectedImages[index]?.type;
                        setSelectedImages((prev) => {
                          const updated = prev.filter((_, i) => i !== index);
                          // ✅ If no more items of this type remain, remove that type from creativeTypes
                          const stillHasType = updated.some((img) => img.type === removedType);
                          if (!stillHasType) {
                            const typeKey = removedType === "image"
                              ? (format === "carousel" ? "image-card" : "image-ad")
                              : (format === "carousel" ? "video-card" : "video-ad");
                            setCreativeTypes((prev) => prev.filter((t) => t !== typeKey));
                            creativeTypesRef.current = creativeTypesRef.current.filter((t) => t !== typeKey);
                          }
                          return updated;
                        });
                        // Close edit panel if it was open for this card
                        setOpenCardIndex((prev) => {
                          if (prev === index) return null;
                          if (prev > index) return prev - 1;
                          return prev;
                        });
                        // Shift cardMeta indices down
                        setCardMeta((prev) => {
                          const next = {};
                          Object.entries(prev).forEach(([key, val]) => {
                            const k = parseInt(key);
                            if (k < index) next[k] = val;
                            else if (k > index) next[k - 1] = val;
                          });
                          return next;
                        });
                      }}
                      className="flex items-center justify-center w-7 h-7 rounded-md bg-gray-50 cursor-pointer text-red-400 hover:bg-gray-100 hover:text-red-600 transition-colors"
                      title="Remove this card"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* ✅ Per-card edit panel */}
                {format === "carousel" && openCardIndex === index && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 space-y-3 animate-in slide-in-from-top-1 duration-200">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Card {index + 1} Details
                      <span className={`ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${item.type === "video" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                        {item.type === "video" ? "Video card" : "Image card"}
                      </span>
                    </p>

                    {/* Headline */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Headline</label>
                      <input
                        type="text"
                        value={cardMeta[index]?.headline || ""}
                        onChange={(e) => updateCardMeta(index, "headline", e.target.value)}
                        placeholder={`Headline for card ${index + 1}`}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
                      <input
                        type="text"
                        value={cardMeta[index]?.description || ""}
                        onChange={(e) => updateCardMeta(index, "description", e.target.value)}
                        placeholder={`Description for card ${index + 1}`}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                      />
                    </div>

                    {/* Link */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                        <Link className="w-3 h-3" /> Link URL
                      </label>
                      <input
                        type="url"
                        value={cardMeta[index]?.link || ""}
                        onChange={(e) => updateCardMeta(index, "link", e.target.value)}
                        placeholder={`https://example.com/card-${index + 1}`}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                      />
                    </div>

                    <div className="pt-1 flex justify-end">
                      <button onClick={() => setOpenCardIndex(null)} className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 flex items-center gap-1">
                        <ChevronUp className="w-3 h-3" /> Collapse
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

   {selectedImages.length > 0 && (
  <button onClick={() => setPreviewOpen(true)} className="w-full px-6 py-2 text-indigo-600 bg-white rounded-lg font-semibold cursor-pointer border-2 border-indigo-300 transition-colors">
    Ad Preview
  </button>
)}
      </div>

{previewOpen && (
  <MetaAdsDrawer
    open={previewOpen}
    onClose={() => setPreviewOpen(false)}
    selectedImages={selectedImages}
    format={format}
      facebookPageName={facebookPages.find(p => p.metaPageId === facebookPage)?.name || ""}
    facebookPageInitial={facebookPages.find(p => p.metaPageId === facebookPage)?.name?.charAt(0) || "A"}
    instagramUsername={instagramAccounts.find(i => i.instagramUserId === instagramAccountId)?.username || ""}
    instagramPicture={instagramAccounts.find(i => i.instagramUserId === instagramAccountId)?.profile_picture_url || ""}
  />
)}
      <BatchCreationDrawer
        key={drawerKey}
        open={batchDrawerOpen}
        onClose={() => {
          setBatchDrawerOpen(false);
          // ✅ Do NOT clear anything on cancel — user keeps what they already selected
        }}
        mediaType={batchMediaType}
        format={format}
        onSelect={(newImages) => {
          if (format === "single") {
            // Single: replace all
            setSelectedImages(newImages);
            const type = batchMediaType === "image" ? "image-ad" : "video-ad";
            setCreativeTypes([type]);
            creativeTypesRef.current = [type];
          } else {
            // Carousel: MERGE new selection with existing same-type items
            const incomingType = batchMediaType === "image" ? "image" : "video";
            setSelectedImages((prev) => {
              const otherTypeItems = prev.filter((img) => img.type !== incomingType);
              const existingSameType = prev.filter((img) => img.type === incomingType);
              const existingIds = new Set(existingSameType.map((img) => img.id));
              const trulyNew = newImages.filter((img) => !existingIds.has(img.id));
              return [...otherTypeItems, ...existingSameType, ...trulyNew].slice(0, 10);
            });
          }
        }}
      />
    </div>
  );
});
AdForm.displayName = "AdForm";