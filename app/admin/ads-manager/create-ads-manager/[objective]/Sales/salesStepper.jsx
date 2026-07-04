"use client";
import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  CheckCircle,
  Smartphone,
  MonitorSmartphone,
  Gamepad2,
  Pencil,
  ChevronUp,
  Link,
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
import BatchCreationDrawer from "../../../components/BatchCreationDrawer";
import MetaAdsDrawer from "../../../components/PreviewDrawer";
import Image from "next/image";
import dayjs from "dayjs";


export default function SalesStepper() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const router = useRouter();
  const adAccountId = searchParams.get("adAccountId");
  const metaAccountId = searchParams.get("metaAccountId");
  console.log("Meta Account ID (from URL query):", metaAccountId);
  const [campaignData, setCampaignData] = useState({});
  const [adSetData, setAdSetData] = useState({});
  const [adData, setAdData] = useState({});
  const [draftId, setDraftId] = useState(null);
  const [metaCampaignId, setMetaCampaignId] = useState(null);
  const [adSetDraftId, setAdSetDraftId] = useState(null);

  const [metaAdSetId, setMetaAdSetId] = useState(null);
  const [loading, setLoading] = useState(false);
   const [campaignLabel, setCampaignLabel] = useState("New Sales campaign");
    const [adSetLabel, setAdSetLabel] = useState("New Sales ad set");
    const [adLabel, setAdLabel] = useState("New Sales ad");

  const objective = "SALES";

  const campaignFormRef = useRef(null);
  const adSetFormRef = useRef(null);
  const adFormRef = useRef(null);

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
    const loadingToast = notify.loading("Processing...");

    try {
      if (step === 0 && campaignFormRef.current?.getData) {
        const data = campaignFormRef.current.getData();

        // ✅ CONSOLE LOG - Campaign Data
        console.log("✅ Campaign Data from Form:", data);

        setCampaignData(data);

        const campaignPayload = {
          step: "campaign",
          data: {
            adAccountId: adAccountId,
            name: data.campaignName,
            objective: "SALES",
            buyingType: (data.buyingType || "AUCTION").toUpperCase(),
            specialAdCategories: data.specialAdCategories || [],

            ...(data.pixelId && {
              pixelId: data.pixelId,
            }),

            ...(data.budgetStrategy === "campaign" && {
              campaignBudgetOptimization: true,
              bidStrategy: data.bidStrategy || "LOWEST_COST_WITHOUT_CAP",

              ...(data.budget?.type === "daily"
                ? { dailyBudget: parseFloat(data.budget?.amount || "200") }
                : { lifetimeBudget: parseFloat(data.budget?.amount || "200") }),

              ...(data.scheduleBudget && data.startTime && data.endTime && {
                startTime: data.startTime,
                endTime: data.endTime,
                scheduleStartTime: data.startTime,
                scheduleEndTime: data.endTime,
                budgetIncreaseAmount: parseFloat(data.budgetIncreaseAmount || "50"),
              }),
            }),

            ...(data.budgetStrategy === "adset" && {
              campaignBudgetOptimization: false,

              ...(data.adSetBudgetSharing && {
                adSetBudgetSharing: true,
                bidStrategy: data.bidStrategy || "LOWEST_COST_WITHOUT_CAP",
              }),

              ...(!data.adSetBudgetSharing && {
                adSetBudgetSharing: false,
              }),
            }),
          }
        };

        // ✅ CONSOLE LOG - Campaign Payload
        console.log("🚀 Sales Campaign Payload to API:", campaignPayload);

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

        // ✅ CONSOLE LOG - API Response
        console.log("📡 API Response:", result);

        notify.dismiss(loadingToast);

        if (result.success) {
          setDraftId(result.draftId);
          setMetaCampaignId(result.metaCampaignId);
          notify.success(result.message || "Campaign created successfully!");
          setStep(1);
        } else {
          const errorMessage = result.error?.message || result.message || "Error creating campaign";
          notify.error(errorMessage);
        }

      } else if (step === 1 && adSetFormRef.current?.getData) {
        const data = adSetFormRef.current.getData();
        setAdSetData(data);

        const adSetPayload = {
          step: "adset",
          data: {
            campaignDraftId: draftId,
            name: data.adSetName,
            performanceGoal: data.performanceGoal || "Maximize number of conversions",
            optimizationGoal: "CONVERSIONS",
            conversionLocation: data.conversionLocation,
            facebookPage: data.facebookPage || "",
            pageId: data.facebookPageId || "",

            // ✅ SAME AS ENGAGEMENT - Budget handling
            ...(!campaignData?.campaignBudgetOptimization && {
              budgetType: data.budgetType || "daily",
              ...(data.budgetType === "daily" && {
                dailyBudget: parseFloat(data.dailyBudget || 200),
              }),
              ...(data.budgetType === "lifetime" && {
                lifetimeBudget: parseFloat(data.lifetimeBudget || 200),
              }),
              currency: "INR",
            }),

            ...(data.costGoal && {
              costPerResult: data.costGoal,
            }),

            // ✅ SAME AS ENGAGEMENT - Date/Time handling
            startTime: data.startTime || new Date().toISOString(),
            ...(data.endTime && { endTime: data.endTime }),
            ...(data.schedulePeriod && {
              scheduleStartTime: data.schedulePeriod.startTime,
              ...(data.schedulePeriod.endTime && {
                scheduleEndTime: data.schedulePeriod.endTime,
              }),
            }),
            ...(data.schedule?.endDate && {
              endTime: data.schedule.endDate,
            }),

            scheduleBudget: data.scheduleBudget || false,
            ...(data.scheduleBudget && data.budgetIncreaseAmount && {
              budgetIncreaseAmount: parseFloat(data.budgetIncreaseAmount),
            }),
            specialAdCategories: campaignData.specialAdCategories || [],

            ...(data.conversionLocation === "website" && {
              pixelId: data.pixelId,
            }),
            ...(data.conversionLocation === "app" && {
              appStore: data.appStore,
            }),

            targeting: {
              geo_locations: {
                countries: data.audienceControls?.location === "india" ? ["IN"] : ["IN"],
              },
              age_min: parseInt(data.audienceControls?.minimumAge) || 18,
              age_max: parseInt(data.audienceControls?.maximumAge) || 65,
              genders: [1, 2],
              // ...(data.audienceControls?.languages !== "all" && {
              //   locales: [data.audienceControls.languages],
              // }),
              ...(data.audienceControls?.excludeAudiences?.length > 0 && {
                excluded_custom_audiences: data.audienceControls.excludeAudiences,
              }),
              ...(
                (!campaignData.specialAdCategories ||
                  campaignData.specialAdCategories.length === 0) && {
                  targeting_automation: {
                    advantage_audience: 1,
                  },
                }
              ),
            },
          }
        }
        console.log("🚀 Sales Ad Set Payload to API:", adSetPayload);
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
          notify.success(result.message || "Ad Set created successfully!"); // ✅ Success toast
          setStep(2);
        } else {
          // ✅ Show error from API response
          const errorMessage = result.error?.message || result.message || "Error creating ad set";
          notify.error(errorMessage);
        }
      }
    } catch (error) {
      notify.dismiss(loadingToast); // ✅ Dismiss loading
      notify.error(`Something went wrong: ${error.message}`); // ✅ Error toast
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
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
            name: data.adName || "New Sales ad",
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
                .replace(/-/g, "_") || "SHOP_NOW",

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
                      .replace(/-/g, "_") || "SHOP_NOW",
                },
              })),
            }),
          },
        },
      };
      console.log("🚀 Sales Ad Payload to API:", adPayload);
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

      notify.dismiss(loadingToast); // ✅ Dismiss loading

      if (result.success) {
        notify.success(result.message || "🎉 Campaign Published Successfully!", { duration: 5000 }); // ✅ Success toast
        setTimeout(() => {
          router.push("/dashboard/ads-manager");
        }, 1500);
      } else {
        // ✅ Show error from API response
        const errorMessage = result.error?.message || result.message || "Error publishing ad";
        notify.error(errorMessage);
      }
    } catch (error) {
      notify.dismiss(loadingToast); // ✅ Dismiss loading
      notify.error(`Something went wrong: ${error.message}`); // ✅ Error toast
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { label: "New Sales campaign", icon: Folder, bg: "bg-[#E0E7FF]" },
    { label: "New Sales ad set", icon: Layers, bg: "bg-[#E0E7FF]" },
    { label: "New Sales ad", icon: MonitorPlay, bg: "bg-[#E0E7FF]" },
  ];

  const renderStep = () => {
    switch (step) {
      case 0:
        return <CampaignForm ref={campaignFormRef} onNameChange={setCampaignLabel}/>;
      case 1:
        return <AdSetsForm ref={adSetFormRef} adAccountId={adAccountId} metaAccountId={metaAccountId} campaignData={campaignData} onNameChange={setAdSetLabel} />;
      case 2:
        return <AdForm ref={adFormRef} adAccountId={adAccountId} metaAccountId={metaAccountId} onNameChange={setAdLabel}/>;
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

      <main className="flex-1 flex flex-col p-2 overflow-y-auto ml-80 pl-0">
        <div className="flex-1 p-2 mb-16">{renderStep()}</div>

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

/* -----------------------------
   Step 1: Campaign Setup
------------------------------ */

const CampaignForm = forwardRef(({props, onNameChange}, ref) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlBuyingType = searchParams.get('buyingType') || 'auction';
  const [pixels, setPixels] = useState([]);
  const [pixelId, setPixelId] = useState("");
  const [loadingPixels, setLoadingPixels] = useState(false);
  const [campaignName, setCampaignName] = useState("New Sales campaign");
  const [buyingType, setBuyingType] = useState(urlBuyingType);
  const [objective, setObjective] = useState("Sales");
  const [scheduleBudget, setScheduleBudget] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [budgetStrategy, setBudgetStrategy] = useState("adset");
  const [budgetType, setBudgetType] = useState("daily");
  const [budgetAmount, setBudgetAmount] = useState("200.00");
  const [budgetIncreaseAmount, setBudgetIncreaseAmount] = useState("50.00");
  const [adSetBudgetSharing, setAdSetBudgetSharing] = useState(false);
  const [bidStrategy, setBidStrategy] = useState("LOWEST_COST_WITHOUT_CAP");
  const [scheduleStartEnd, setScheduleStartEnd] = useState(null);

  const objectives = [
    { id: "Awareness", label: "Awareness" },
    { id: "Traffic", label: "Traffic" },
    { id: "Engagement", label: "Engagement" },
    { id: "Leads", label: "Leads" },
    { id: "AppPromotions", label: "App promotion" },
    { id: "Sales", label: "Sales" },
  ];

  const bidStrategies = [
    {
      id: "LOWEST_COST_WITHOUT_CAP",
      label: "Highest volume (Lowest cost without cap)",
      description: "Recommended for maximum results. Meta will aim to get you the most conversions for your budget.",
    },
    {
      id: "LOWEST_COST_WITH_BID_CAP",
      label: "Lowest cost with bid cap",
      description: "Control your maximum bid while still getting competitive results.",
    },
    {
      id: "COST_CAP",
      label: "Cost cap (Target cost per result)",
      description: "Set a target cost per conversion. Meta will aim to keep your average cost at or below this amount.",
    },
  ];

  const buyingTypes = [
    { id: "auction", label: "Auction" },
    { id: "reservation", label: "Reservation" },
  ];

  const categories = [
    {
      id: "FINANCIAL_PRODUCTS_SERVICES",
      label: "Financial products and services",
      description: "Ads for credit cards, long-term financing, current and savings accounts, investment services, or insurance products.",
      icon: Banknote,
    },
    {
      id: "EMPLOYMENT",
      label: "Employment",
      description: "Ads for job offers, internships, or professional certification programmes and related opportunities.",
      icon: Briefcase,
    },
    {
      id: "HOUSING",
      label: "Housing",
      description: "Ads for property listings, home insurance, mortgages or related housing services.",
      icon: Home,
    },
    {
      id: "ISSUES_ELECTIONS_POLITICS",
      label: "Social issues, elections or politics",
      description: "Ads about social issues, civil rights, elections, or political campaigns and figures.",
      icon: Megaphone,
    },
  ];

  const adAccountId = searchParams.get("adAccountId");

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

  useEffect(() => {
    if (!adAccountId) return;
    console.log("Fetching pixels for Ad Account ID:", adAccountId);
    const fetchPixels = async () => {
      setLoadingPixels(true);
      try {
        const sessionCookie = getSessionCookie();
        const response = await fetch(`/api/meta/pixels?adAccountId=${adAccountId}&sync=true`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Cookie: sessionCookie,
          },
        });
        const result = await response.json();

        if (result.success && result.pixels?.length > 0) {
          setPixels(result.pixels);
          setPixelId(result.pixels[0].metaPixelId); // Default first pixel
        }
      } catch (err) {
        console.error("Pixel fetch error:", err);
      } finally {
        setLoadingPixels(false);
      }
    };

    fetchPixels();
  }, [adAccountId]);

  const handleBuyingTypeChange = (newBuyingType) => {
    setBuyingType(newBuyingType);
    let newObjective = objective;
    if (newBuyingType === "reservation" && !["Awareness", "Engagement"].includes(objective)) {
      newObjective = "Awareness";
      setObjective("Awareness");
    }
    router.push(`/dashboard/ads-manager/create-ads-manager/${newObjective}?buyingType=${newBuyingType}`);
  };

const handleObjectiveChange = (newObjective) => {
  setObjective(newObjective);
  const params = new URLSearchParams(window.location.search);
  params.set("buyingType", buyingType);
  const newUrl = `/dashboard/ads-manager/create-ads-manager/${newObjective}?${params.toString()}`;
  router.push(newUrl);
};

  const toggleCategory = (id) => {
    setSelectedCategories((prev) => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const objectivesFiltered = buyingType === "reservation"
    ? objectives.filter(obj => ["Awareness", "Engagement"].includes(obj.id))
    : objectives;

  useImperativeHandle(ref, () => ({
    getData: () => {
      // ✅ FIX: selectedPixel ko properly find karo
      const selectedPixel = pixels.find((p) => p.metaPixelId === pixelId);

      const payload = {
        campaignName,
        buyingType,
        objective: "SALES",
        budgetStrategy,
        specialAdCategories: selectedCategories,

        // ✅ PIXEL DATA - only add if pixel exists
        ...(pixelId && {
          pixelId: pixelId,
          pixelName: selectedPixel?.name || "",
        }),
      };

      if (budgetStrategy === "campaign") {
        payload.campaignBudgetOptimization = true;
        payload.budget = {
          type: budgetType,
          amount: parseFloat(budgetAmount),
          currency: "INR"
        };
        payload.bidStrategy = bidStrategy;

        if (scheduleBudget && scheduleStartEnd) {
          payload.startTime = scheduleStartEnd.startTime;
          payload.endTime = scheduleStartEnd.endTime;
          payload.scheduleBudget = true;
          payload.budgetIncreaseAmount = parseFloat(budgetIncreaseAmount) || 50;

          // Add these two lines
          payload.scheduleStartTime = scheduleStartEnd.startTime;
          payload.scheduleEndTime = scheduleStartEnd.endTime;
        }
      }

      if (budgetStrategy === "adset") {
        payload.campaignBudgetOptimization = false;
        payload.adSetBudgetSharing = adSetBudgetSharing;
        if (adSetBudgetSharing) {
          payload.bidStrategy = bidStrategy;
        }
      }

      // ✅ CONSOLE LOG
      console.log("📦 Campaign Form Data:", payload);

      return payload;
    }
  }));
  return (
    <div className="max-w-2xl">
      <div className="space-y-4">
        {/* Campaign Name */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-full border-2 border-green-500 flex items-center justify-center">
              <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Campaign name</h3>
          </div>
          <input
            type="text"
            value={campaignName}
            onChange={(e) => { setCampaignName(e.target.value); onNameChange?.(e.target.value); }}
            className="flex-1 w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Campaign Details */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 rounded-full border-2 border-green-500 flex items-center justify-center">
              <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Campaign details</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-900 block mb-2">Buying type</label>
              <Select value={buyingType} onValueChange={handleBuyingTypeChange}>
                <SelectTrigger className="w-full border border-gray-300 bg-white rounded-md px-3 py-2 text-sm text-gray-800 focus:ring-1 focus:ring-indigo-400">
                  <SelectValue>{buyingTypes.find(t => t.id === buyingType)?.label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {buyingTypes.map(type => (
                    <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="flex items-center gap-1 mb-2">
                <label className="text-sm font-semibold text-gray-900">Campaign objective</label>
                <Info className="w-4 h-4 text-gray-400" />
              </div>
              <Select value={objective} onValueChange={handleObjectiveChange}>
                <SelectTrigger className="w-full border border-gray-300 bg-white rounded-md px-3 py-2 text-sm text-gray-800 focus:ring-1 focus:ring-indigo-400">
                  <SelectValue>{objectivesFiltered.find(o => o.id === objective)?.label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {objectivesFiltered.map(obj => (
                    <SelectItem key={obj.id} value={obj.id}>{obj.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Add this after Campaign Details section and before Budget section */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 rounded-full border-2 border-green-500 flex items-center justify-center">
              <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Meta Pixel</h3>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Dataset (Pixel)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Required for Sales campaigns to track conversions on your website.
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
                          {pixels
                            .find((p) => p.metaPixelId === pixelId)
                            ?.name.charAt(0)
                            .toUpperCase() || ""}
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {pixels.find((p) => p.metaPixelId === pixelId)?.name ||
                            "Select a pixel"}
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
                      No pixels found. Please create a pixel first.
                    </div>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Budget Section */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h3 className="text-base font-semibold  mb-3">Budget</h3>

          {/* Budget Strategy Options */}
          <div className="bg-black/1 border border-blue-100 rounded-lg p-4 mb-4">
            <label className="text-sm font-semibold text-gray-900 flex items-center gap-1 mb-3">
              Budget strategy <Info className="w-4 h-4 text-gray-400" />
            </label>

            <div className="space-y-3">
              {/* Campaign Budget Option */}
              <label
                className={`flex items-start gap-3 p-3 rounded-md cursor-pointer transition-all ${budgetStrategy === "campaign"
                  ? "bg-white border border-indigo-300 shadow-sm"
                  : "hover:bg-gray-50 border border-transparent"
                  }`}
              >
                <input
                  type="radio"
                  name="budgetStrategy"
                  value="campaign"
                  checked={budgetStrategy === "campaign"}
                  onChange={() => setBudgetStrategy("campaign")}
                  className="mt-1 accent-indigo-600"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Campaign budget
                  </p>
                  <p className="text-xs text-gray-600 leading-snug">
                    Automatically distribute your budget to the best
                    opportunities across your campaign. Also known as Advantage+
                    campaign budget.{" "}
                    <a
                      href="#"
                      className="text-indigo-600 hover:text-indigo-700"
                    >
                      About campaign budget
                    </a>
                  </p>
                </div>
              </label>

              {/* Ad Set Budget Option */}
              <label
                className={`flex items-start gap-3 p-3 rounded-md cursor-pointer transition-all ${budgetStrategy === "adset"
                  ? "bg-white border border-indigo-300 shadow-sm"
                  : "hover:bg-gray-50 border border-transparent"
                  }`}
              >
                <input
                  type="radio"
                  name="budgetStrategy"
                  value="adset"
                  checked={budgetStrategy === "adset"}
                  onChange={() => setBudgetStrategy("adset")}
                  className="mt-1 accent-indigo-600"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Ad set budget
                  </p>
                  <p className="text-xs text-gray-600 leading-snug">
                    Set different bid strategies or budget schedules for each ad
                    set.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Campaign Budget Fields */}
          {budgetStrategy === "campaign" && (
            <div className="space-y-4 border-t pt-4">
              {/* Budget Amount */}
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
              </div>

              {/* Bid Strategy */}
              <div className="pt-4 border-t">
                <div className="flex items-center gap-1 mb-2">
                  <label className="text-sm font-semibold text-gray-900">
                    Campaign bid strategy
                  </label>
                  <Info className="w-4 h-4 text-gray-400" />
                </div>
                <Select value={bidStrategy} onValueChange={setBidStrategy}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select bid strategy">
                      {bidStrategies.find((strategy) => strategy.id === bidStrategy)?.label || "Select bid strategy"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {bidStrategies.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex flex-col text-left">
                          <span>{s.label}</span>
                          <span className="text-xs text-gray-500">
                            {s.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-600 mt-2">
                  {bidStrategies.find((s) => s.id === bidStrategy)?.description}
                </p>
              </div>

              {/* Budget Scheduling */}
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
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="scheduleBudget"
                      checked={scheduleBudget}
                      disabled={budgetType === "daily"}
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
                          {/* <SelectItem value="percent">Increase daily budget by percentage</SelectItem> */}
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

          {/* Ad Set Budget Fields */}
          {budgetStrategy === "adset" && (
            <>
              <div className="pt-4 border-t mb-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adSetBudgetSharing}
                    onChange={(e) => setAdSetBudgetSharing(e.target.checked)}
                    className="accent-indigo-600 w-4 h-4 mt-0.5"
                  />
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium text-gray-900">
                        Share some of your budget with other ad sets
                      </span>
                      <Info className="w-4 h-4 text-gray-400" />
                    </div>
                    <p className="text-xs text-gray-600 mt-1 leading-snug">
                      We'll share up to 20% of your ad set budget with other ad
                      sets...
                    </p>
                  </div>
                </label>
              </div>

              {adSetBudgetSharing && (
                <div className="pt-4 border-t">
                  <div className="flex items-center gap-1 mb-2">
                    <label className="text-sm font-semibold text-gray-900">
                      Campaign bid strategy
                    </label>
                    <Info className="w-4 h-4 text-gray-400" />
                  </div>
                  <Select value={bidStrategy} onValueChange={setBidStrategy}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select bid strategy">
                        {bidStrategies.find((strategy) => strategy.id === bidStrategy)?.label || "Select bid strategy"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {bidStrategies.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <div className="flex flex-col text-left">
                            <span>{s.label}</span>
                            <span className="text-xs text-gray-500">
                              {s.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-600 mt-2">
                    {
                      bidStrategies.find((s) => s.id === bidStrategy)
                        ?.description
                    }
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Special Ad Categories – same as Engagement */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-full border-2 border-green-500 flex items-center justify-center">
              <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Special Ad Categories</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4 leading-relaxed">
            Declare if your ads are related to financial products..., employment..., housing..., or social issues... to help prevent ad rejections.
            <a href="#" className="text-indigo-600 hover:text-indigo-700 ml-1">About Special Ad Categories</a>
          </p>
          <div className="space-y-3">
            {categories.map(cat => {
              const Icon = cat.icon;
              const isSelected = selectedCategories.includes(cat.id);
              return (
                <div
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  className={`flex items-start gap-3 border rounded-md p-3 cursor-pointer transition-all ${isSelected ? "bg-indigo-50 border-indigo-300" : "border-gray-200 hover:bg-gray-50"}`}
                >
                  <div className="shrink-0 mt-1">
                    <input type="checkbox" checked={isSelected} readOnly className="accent-indigo-600 w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-gray-700" />
                      <span className="text-sm font-medium text-gray-900">{cat.label}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 leading-snug">{cat.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {selectedCategories.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {selectedCategories.map(id => {
                const cat = categories.find(c => c.id === id);
                return (
                  <div key={id} className="flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs">
                    <cat.icon className="w-3 h-3" />
                    {cat.label}
                    <X size={12} className="cursor-pointer ml-1" onClick={() => toggleCategory(id)} />
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
  const [adSetName, setAdSetName] = useState("New Sales ad set");
  const [performanceGoal, setPerformanceGoal] = useState("Maximise number of conversions");
  const [facebookPage, setFacebookPage] = useState("");
  const [facebookPages, setFacebookPages] = useState([]);
  const [loadingPages, setLoadingPages] = useState(false);
  // Add these two states near other budget scheduling states
  const [increaseAmount, setIncreaseAmount] = useState("50");
  const [minAge, setMinAge] = useState("18");
  const [maxAge, setMaxAge] = useState("65");
  const [costGoal, setCostGoal] = useState("");
  const [scheduleBudget, setScheduleBudget] = useState(false);
  const [endDateEnabled, setEndDateEnabled] = useState(false);
  const [budgetType, setBudgetType] = useState("daily");
  const [budgetAmount, setBudgetAmount] = useState("200.00");

  // Country selection
  const [countries, setCountries] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState("IN");
  const [selectedCountryName, setSelectedCountryName] = useState("India");

  const [conversionLocation, setConversionLocation] = useState("website");
  const [pixelId, setPixelId] = useState("");
  const [pixels, setPixels] = useState([]);
  const [loadingPixels, setLoadingPixels] = useState(false);

  const [appStore, setAppStore] = useState("google_play");

  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [scheduleStartTime, setScheduleStartTime] = useState(null);
  const [scheduleEndTime, setScheduleEndTime] = useState(null);


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

  // Fetch countries
  useEffect(() => {
    const fetchCountries = async () => {
      setLoadingCountries(true);
      try {
        const res = await fetch("https://countriesnow.space/api/v0.1/countries/iso");
        const result = await res.json();
        if (!result.error && result.data) {
          setCountries(result.data.sort((a, b) => a.name.localeCompare(b.name)));
        }
      } catch (err) {
        console.error("Countries fetch error:", err);
      } finally {
        setLoadingCountries(false);
      }
    };
    fetchCountries();
  }, []);

  // Fetch pixels (only when website selected)
  useEffect(() => {
    if (
      conversionLocation !== "website" &&
      conversionLocation !== "website_calls"
    )
      return;

    const fetchPixels = async () => {
      setLoadingPixels(true);
      try {
        const sessionCookie = getSessionCookie();
        const res = await fetch(`/api/meta/pixels?adAccountId=${adAccountId}&sync=true`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Cookie: sessionCookie,
          },
        });
        const result = await res.json();
        if (result.success && result.pixels?.length) {
          setPixels(result.pixels);
          setPixelId(result.pixels[0].metaPixelId);
        }
      } catch (err) {
        console.error("Pixels fetch error:", err);
      } finally {
        setLoadingPixels(false);
      }
    };
    fetchPixels();
  }, [conversionLocation]);

  // Fetch Facebook Pages
  useEffect(() => {
    if (!metaAccountId) return;

    const fetchPages = async () => {
      setLoadingPages(true);
      try {
        const sessionCookie = getSessionCookie();
        const res = await fetch(`/api/meta/facebook-pages?adAccountId=${metaAccountId}`, {
          headers: { Cookie: sessionCookie },
        });
        const result = await res.json();
        if (result.success && result.pages?.length) {
          setFacebookPages(result.pages);
          setFacebookPage(result.pages[0].metaPageId);
        }
      } catch (err) {
        console.error("Pages fetch error:", err);
      } finally {
        setLoadingPages(false);
      }
    };
    fetchPages();
  }, [metaAccountId]);

  useImperativeHandle(ref, () => ({
    getData: () => {
      const selectedPage = facebookPages.find((p) => p.metaPageId === facebookPage);

      const payload = {
        adSetName,
        performanceGoal,
        facebookPage: selectedPage?.name || facebookPage,
        facebookPageId: facebookPage,
        conversionLocation,
        costGoal: costGoal ? parseFloat(costGoal) : null,

        // Budget only sent when CBO is OFF
        ...(!campaignData?.campaignBudgetOptimization && {
          budgetType,
          ...(budgetType === "daily" && { dailyBudget: parseFloat(budgetAmount || 200) }),
          ...(budgetType === "lifetime" && { lifetimeBudget: parseFloat(budgetAmount || 200) }),
          currency: "INR",
        }),

    startTime: startTime ? startTime.toISOString() : new Date().toISOString(),
...(endDateEnabled && endTime
  ? { endTime: endTime.toISOString() }
  : (budgetType === "lifetime" || campaignData?.budget?.type === "lifetime")
    ? { endTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() }
    : {}
),
        scheduleBudget: scheduleBudget || false,
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

        ...(conversionLocation === "website" && { pixelId }),
        ...(conversionLocation === "app" && { appStore }),
      };

      console.log("Sales AdSet Payload:", payload);
      return payload;
    },
  }));

  // ────────────────────────────────────────────────
  //  SALES-SPECIFIC PERFORMANCE GOALS & OPTIONS
  // ────────────────────────────────────────────────

  const CONVERSION_LOCATION_GROUPS = [
    {
      group: "Multiple",
      description: "We'll automatically send people where they're most likely to convert.",
      options: [
        { value: "website_app", title: "Website and app" },
        { value: "website_calls", title: "Website and calls" },
      ],
    },
    {
      group: "Single",
      description: "Send people to one location where you want them to convert.",
      options: [
        { value: "website", title: "Website" },
        { value: "app", title: "App" },
        { value: "message_destinations", title: "Message destinations" },
        { value: "calls", title: "Calls" },
      ],
    },
  ];
  const showPixel =
    conversionLocation === "website" ||
    conversionLocation === "website_calls";

  const showFacebookPage =
    conversionLocation === "message_destinations" ||
    conversionLocation === "calls";


  const SALES_PERFORMANCE_GOALS = {
    website: [
      { value: "Maximise number of conversions", title: "Maximise number of conversions" },
      { value: "Maximise number of landing page views", title: "Maximise number of landing page views" },
      { value: "Maximise number of link clicks", title: "Maximise number of link clicks" },
      { value: "Maximise daily unique reach", title: "Maximise daily unique reach" },
    ],
    app: [
      { value: "Maximise number of app events", title: "Maximise number of app events" },
      { value: "Maximise number of link clicks", title: "Maximise number of link clicks" },
      { value: "Maximise daily unique reach", title: "Maximise daily unique reach" },
    ],
    message_destinations: [
      { value: "Maximise number of conversations", title: "Maximise number of conversations" },
      { value: "Maximise number of link clicks", title: "Maximise number of link clicks" },
    ],
    instagram_facebook: [
      { value: "Maximise number of profile visits", title: "Maximise number of profile visits" },
      { value: "Maximise number of Page likes", title: "Maximise number of Page likes" },
    ],
    calls: [{ value: "Maximise number of calls", title: "Maximise number of calls" }],
  };

  const APP_STORES = [
    { value: "google_play", label: "Google Play Store" },
    { value: "apple_app_store", label: "Apple App Store" },
    { value: "apple_app_store_ipad", label: "Apple App Store for iPad" },
  ];

  useEffect(() => {
    const goals = SALES_PERFORMANCE_GOALS[conversionLocation] || [];
    if (goals.length > 0) {
      setPerformanceGoal(goals[0].value);
    }
  }, [conversionLocation]);

  return (
    <div className="max-w-2xl space-y-5">
      {/* Ad set name */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 rounded-full border-2 border-green-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Ad set name</h3>
        </div>
        <input
          type="text"
          value={adSetName}
          onChange={(e) => { setAdSetName(e.target.value); onNameChange?.(e.target.value); }}
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Conversion / Sales goal section */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 rounded-full border-2 border-green-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Conversion</h3>
        </div>

        <label className="block text-sm font-semibold text-gray-900 mb-1">Conversion location</label>
        <Select value={conversionLocation} onValueChange={setConversionLocation}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {CONVERSION_LOCATION_GROUPS.flatMap(g => g.options)
                .find(o => o.value === conversionLocation)?.title || "Select location"}
            </SelectValue>
          </SelectTrigger>

          <SelectContent className="p-0">
            {CONVERSION_LOCATION_GROUPS.map((group) => (
              <div key={group.group} className="px-2 py-2">
                {/* Group Header */}
                <div className="px-2 py-1 border-b">
                  <div className="text-xs font-semibold text-gray-700 ">
                    {group.group}
                  </div>
                  <p className="text-[11px] text-gray-500 leading-tight">
                    {group.description}
                  </p>
                </div>

                {/* Group Options */}
                <div className="mt-1">
                  {group.options.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{item.title}</span>
                      </div>
                    </SelectItem>
                  ))}
                </div>

                {/* Divider */}
                {group.group === "Multiple" && (
                  <div className=" " />
                )}
              </div>
            ))}
          </SelectContent>
        </Select>


        <p className="text-xs text-gray-500 mt-2">
          Choose where people should complete a purchase or other valuable action.
        </p>

        {/* Website → Pixel */}
        {showPixel && (

          <div className="mt-6">
            <label className="block text-sm font-semibold text-gray-900 mb-1">Dataset (Pixel)</label>
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
                          {pixels
                            .find((p) => p.metaPixelId === pixelId)
                            ?.name.charAt(0)
                            .toUpperCase() || ""}
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {pixels.find((p) => p.metaPixelId === pixelId)
                            ?.name || "Select a pixel"}
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
        )}

        {/* App → App Store */}
        {conversionLocation === "app" && (
          <div className="mt-6">
            <label className="block text-sm font-semibold text-gray-900 mb-1">Mobile app store</label>
            <Select value={appStore} onValueChange={setAppStore}>
              <SelectTrigger className="w-full">
                <SelectValue>{APP_STORES.find((s) => s.value === appStore)?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {APP_STORES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Facebook Page (most sales campaigns still need identity) */}
        {showFacebookPage && (
          <div className="mt-6">
            <label className="block text-sm font-semibold text-gray-900 mb-1">Facebook Page</label>
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
        )}

      </div>

      {/* Performance goal */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 rounded-full border-2 border-green-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Performance goal</h3>
        </div>

        <label className="block text-sm font-semibold text-gray-900 mb-1">Performance goal</label>
        <Select value={performanceGoal} onValueChange={setPerformanceGoal}>
          <SelectTrigger className="w-full">
            <SelectValue>{performanceGoal}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(SALES_PERFORMANCE_GOALS[conversionLocation] || []).map((goal) => (
              <SelectItem key={goal.value} value={goal.value}>
                <div>
                  <div className="text-sm font-medium">{goal.title}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <p className="text-xs text-gray-500 mt-2">
          We'll show your ads to people most likely to take this action.
        </p>
      </div>

      {/* Cost goal */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <label className="block text-sm font-semibold text-gray-900 mb-1">
          Cost per result goal <span className="text-gray-500">(Optional)</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700">₹</span>
          <input
            type="number"
            value={costGoal}
            onChange={(e) => setCostGoal(e.target.value)}
            placeholder="e.g. 120"
            className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-700">INR</span>
        </div>
        <p className="text-xs text-gray-600 mt-2">
          Optional. Meta will try to get results at or below this average cost.
        </p>
      </div>

      {/* Budget & Schedule Section */}
      <div className="bg-white rounded-lg p-6 shadow-sm space-y-6">
        {/* ──────────────────────────────────────── */}
        {/* When Advantage+ campaign budget is ON    */}
        {/* ──────────────────────────────────────── */}
        {campaignData?.campaignBudgetOptimization ? (
          <div className="space-y-5">
            <div>
              <label className="text-sm font-semibold text-gray-900 block mb-1">
                Campaign budget
              </label>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-700">
                  You set a{" "}
                  <strong>
                    {campaignData.budget?.type === "daily"
                      ? "daily"
                      : "lifetime"}
                  </strong>
                  &nbsp; Advantage+ campaign budget of{" "}
                  <strong>₹{campaignData.budget?.amount?.toFixed(2)}</strong>.
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Budget is controlled at the campaign level. No separate budget
                  needed here.
                </p>
              </div>
            </div>

            {/* Schedule section - keep as is */}
            <div className="border-t pt-5">
              <label className="text-sm font-semibold text-gray-900 block mb-2">Schedule</label>
              <div className="flex items-center gap-2 mb-3">
                <label className="text-sm text-gray-700 w-20">Start time</label>
                <DatePicker
                  showTime
                  format="YYYY-MM-DD HH:mm"
                  style={{ width: "240px" }}
                                      defaultValue={dayjs()}   // 👈 auto current date-time
                  
                  onChange={(date) => setStartTime(date ? date.toDate() : null)}
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
                    onChange={(date) => setEndTime(date ? date.toDate() : null)}
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
          </div>
        ) : (
          /* ──────────────────────────────────────── */
          /* When Advantage+ is OFF → original budget */
          /* ──────────────────────────────────────── */
          <>
            <div>
              <label className="text-sm font-semibold text-gray-900 block mb-2">Budget</label>
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
                <span className="text-sm">₹</span>
                <input
                  type="number"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  className="w-64 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <span className="text-sm">INR</span>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                You will spend an average of ₹{parseFloat(budgetAmount).toFixed(2)} per day...
              </p>
            </div>

            {/* Schedule */}
            <div className="border-t pt-5">
              <label className="text-sm font-semibold text-gray-900 block mb-2">Schedule</label>
              <div className="flex items-center gap-2 mb-3">
                <label className="text-sm text-gray-700 w-20">Start time</label>
                <DatePicker
                  showTime
                  format="YYYY-MM-DD HH:mm"
                  style={{ width: "240px" }}
                  defaultValue={dayjs()}   // 👈 auto current date-time
                  onChange={(date) => setStartTime(date ? date.toDate() : null)}
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
                    onChange={(date) => setEndTime(date ? date.toDate() : null)}
                  />
                </div>
              )}
            </div>

            {/* Budget Scheduling */}
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
                <div className="bg-gray-50 rounded-lg p-6 flex flex-col gap-6">
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
                    <Select value="amount" >
                      <SelectTrigger className="w-72">
                        <SelectValue>Increase by amount (₹)</SelectValue>
                      </SelectTrigger>
                    </Select>

                    <span className="text-sm">₹</span>

                    <input
                      type="number"
                      value={increaseAmount}
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
          </>
        )}
      </div>

      {/* Audience Controls – same as Engagement */}
      <div className="bg-white rounded-lg p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Audience controls</h3>
          <p className="text-xs text-gray-500">Define who can see these ads</p>
        </div>

        <div>
          <label className="text-sm font-semibold block mb-1">Location</label>
          {loadingCountries ? (
            <div>Loading countries...</div>
          ) : (
            <Select
              value={selectedCountry}
              onValueChange={(iso) => {
                setSelectedCountry(iso);
                const country = countries.find((c) => c.Iso2 === iso);
                if (country) setSelectedCountryName(country.name);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>{selectedCountryName || "Select country"}</SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {countries.map((c) => (
                  <SelectItem key={c.Iso2} value={c.Iso2}>
                    {c.name} ({c.Iso2})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="border-t pt-4">
          <label className="text-sm font-semibold text-gray-900 block mb-1">
            Age Range
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Select the age range for your target audience.
          </p>

          <div className="flex gap-3 items-center">
            <Select value={minAge} onValueChange={setMinAge}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 48 }, (_, i) => i + 18).map((age) => (
                  <SelectItem key={age} value={age.toString()}>
                    {age}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-gray-500">to</span>

            <Select value={maxAge} onValueChange={setMaxAge}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 48 }, (_, i) => i + 18).map((age) => (
                  <SelectItem key={age} value={age.toString()}>
                    {age}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
});

AdSetsForm.displayName = "AdSetsForm";


/* -----------------------------
   AdForm - Updated: Multi-type carousel support (image + video mixed)
------------------------------ */
const AdForm = forwardRef(({ adAccountId, metaAccountId, onNameChange }, ref) => {
  const [adName, setAdName] = useState("New Sales ad");
  const [sendToAppStore, setSendToAppStore] = useState(false);
  const [adSetup, setAdSetup] = useState("create-ad");
  const [creativeSource, setCreativeSource] = useState("manual-upload");
  const [format, setFormat] = useState("single");
  const [multiAdvertiser, setMultiAdvertiser] = useState(true);
  const [destination, setDestination] = useState("website");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [useDisplayLink, setUseDisplayLink] = useState(false);
  const [displayLink, setDisplayLink] = useState("");
  const websiteUrlRef = useRef("");
  const displayLinkRef = useRef("");

  const [creativeTypes, setCreativeTypes] = useState([]);
  const creativeTypesRef = useRef([]);

  // ✅ Ad Creative fields
  const [primaryText, setPrimaryText] = useState("");
  const [headline, setHeadline] = useState("");
  const [description, setDescription] = useState("");
  const [callToAction, setCallToAction] = useState("shop-now");

  // ✅ selectedImages now holds mixed type items (image or video)
  // Each item: { id, hash, url, thumbnail, name, type: "image"|"video" }
  const [selectedImages, setSelectedImages] = useState([]);

  // ✅ Per-carousel-card metadata: { [index]: { headline, description, link } }
  const [cardMeta, setCardMeta] = useState({});
  const [openCardIndex, setOpenCardIndex] = useState(null);

  // ✅ Batch Drawer - now tracks which "slot" (type) we're adding for
  const [batchDrawerOpen, setBatchDrawerOpen] = useState(false);
  const [batchMediaType, setBatchMediaType] = useState(null);
  // ✅ drawerKey: increment on every open to force fresh remount (clears drawer's internal cache)
  const [drawerKey, setDrawerKey] = useState(0);

  // ✅ Preview
  const [previewOpen, setPreviewOpen] = useState(false);

  // ✅ Facebook Pages
  const [facebookPages, setFacebookPages] = useState([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [facebookPage, setFacebookPage] = useState("");

  // ✅ Instagram Accounts
  const [instagramAccounts, setInstagramAccounts] = useState([]);
  const [instagramAccountId, setInstagramAccountId] = useState("");
  const [loadingInstagram, setLoadingInstagram] = useState(false);

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
  useEffect(() => {
    if (!metaAccountId) return;
    const fetchPages = async () => {
      setLoadingPages(true);
      try {
        const sessionCookie = getSessionCookie();
        const response = await fetch(`/api/meta/facebook-pages?adAccountId=${metaAccountId}`, {
          method: "GET",
          headers: { "Content-Type": "application/json", Cookie: sessionCookie },
        });
        const result = await response.json();
        if (result.success && result.pages) {
          setFacebookPages(result.pages);
          if (result.pages.length > 0) setFacebookPage(result.pages[0].metaPageId);
        }
      } catch (error) {
        console.error("❌ [SalesAdForm] Pages Error:", error);
      } finally {
        setLoadingPages(false);
      }
    };
    fetchPages();
  }, [metaAccountId]);

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
        console.error("❌ [SalesAdForm] Instagram fetch error:", err);
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
  // Buttons never remove/deselect — only X on individual cards does that
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
        displayLink: useDisplayLink ? displayLinkRef.current : "",

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
      console.log("🔹 [AdForm] getData payload:", payload);
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
              <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
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
            <svg className="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.707a1 1 0 00-1.414 0L7 9.586V13a1 1 0 001 1h4a1 1 0 001-1V9.586l-2.293-2.293z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Identity</h3>
        </div>
        <p className="text-sm text-gray-600">The profiles that will be used in your ad.</p>

        {/* Facebook Page */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-1">Facebook Page</label>
          <p className="text-xs text-gray-500 mb-2">Your ad must be associated with a Facebook Page.</p>
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
            <label className="text-sm font-semibold text-gray-900">Instagram account</label>
            <Info className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-xs text-gray-500 mb-2">Instagram account linked to selected Facebook Page</p>
          {loadingInstagram ? (
            <div className="text-sm text-gray-500">Loading Instagram accounts...</div>
          ) : (
            <Select value={instagramAccountId} onValueChange={(v) => setInstagramAccountId(v)} disabled={instagramAccounts.length === 0}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {instagramAccountId ? (
                    <div className="flex items-center gap-2">
                      <img src={instagramAccounts.find((i) => i.instagramUserId === instagramAccountId)?.profile_picture_url} alt="Instagram" className="w-6 h-6 rounded-full" />
                      <span className="text-sm font-medium text-gray-900">
                        {instagramAccounts.find((i) => i.instagramUserId === instagramAccountId)?.username}
                      </span>
                    </div>
                  ) : ("Select Instagram account")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {instagramAccounts.length > 0 ? instagramAccounts.map((ig) => (
                  <SelectItem key={ig.instagramUserId} value={ig.instagramUserId}>
                    <div className="flex items-center gap-3">
                      <img src={ig.profile_picture_url} alt={ig.username} className="w-8 h-8 rounded-full" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{ig.username}</div>
                        <p className="text-xs text-gray-500">ID: {ig.instagramUserId}</p>
                      </div>
                    </div>
                  </SelectItem>
                )) : (
                  <div className="px-3 py-2 text-sm text-gray-500">No Instagram account found</div>
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
            <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Ad setup</h3>
        </div>

        <Select value={adSetup} onValueChange={(v) => setAdSetup(v)}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {adSetup === "create-ad" ? "Create ad" : adSetup === "existing-post" ? "Use existing post" : "Use Creative Hub mockup"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="create-ad">Create ad</SelectItem>
            <SelectItem value="existing-post">Use existing post</SelectItem>
            <SelectItem value="mockup">Use Creative Hub mockup</SelectItem>
          </SelectContent>
        </Select>

        {/* Creative Source */}
        {/* <div className="pt-4 border-t">
          <label className="text-sm font-semibold text-gray-900 mb-2 block">Creative source</label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-900">
              <input type="radio" name="creativeSource" value="manual-upload" checked={creativeSource === "manual-upload"} onChange={(e) => setCreativeSource(e.target.value)} className="accent-indigo-600" />
              Manual upload
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-900">
              <input type="radio" name="creativeSource" value="catalogue-ads" checked={creativeSource === "catalogue-ads"} onChange={(e) => setCreativeSource(e.target.value)} className="accent-indigo-600" />
              Advantage+ catalogue ads
            </label>
          </div>
        </div> */}

        {/* Format */}
        <div className="pt-4 border-t">
          <div className="flex items-center gap-1 mb-2">
            <label className="text-sm font-semibold text-gray-900">Format</label>
            <Info className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-xs text-gray-500 mb-3">Choose an ad creative layout.</p>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-900">
              <input type="radio" name="format" value="single" checked={format === "single"} onChange={(e) => setFormat(e.target.value)} className="accent-indigo-600" />
              Single image or video
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-900">
              <input type="radio" name="format" value="carousel" checked={format === "carousel"} onChange={(e) => setFormat(e.target.value)} className="accent-indigo-600" />
              Carousel
            </label>
          </div>
        </div>

        {/* Multi-advertiser ads */}
        <div className="pt-4 border-t">
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={multiAdvertiser} onChange={(e) => setMultiAdvertiser(e.target.checked)} className="accent-indigo-600 mt-1" />
            <span className="text-sm text-gray-900 leading-snug">
              <span className="font-semibold">Multi-advertiser ads</span>
              <br />
              <span className="text-xs text-gray-600">
                Your ad can appear with others in the same ad unit to help promote discoverability. Your ad creative may be resized or cropped.{" "}
                <a href="#" className="text-indigo-600 hover:text-indigo-700">About multi-advertiser ads</a>
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* 🔹 Destination Section */}
      <div className="bg-white rounded-lg p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 rounded-full border-2 border-blue-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 8a1 1 0 012 0v4a1 1 0 01-2 0V8z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Destination</h3>
        </div>
        <p className="text-sm text-gray-600">Where you send people after they click your ad. <a href="#" className="text-indigo-600 hover:underline">About destinations</a></p>
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-1">Main destination</label>
          <Select value={destination} onValueChange={(v) => setDestination(v)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="website">Website</SelectItem>
              <SelectItem value="instant-experience">Instant Experience</SelectItem>
              <SelectItem value="facebook-event">Facebook Event</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {destination === "website" && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-1 mb-1">
                <label className="text-sm font-semibold text-gray-900">* Website URL</label>
                <Info className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex items-center gap-2">
                <input type="url" placeholder="Enter the URL that people visit after your ad" value={websiteUrl} onChange={(e) => { setWebsiteUrl(e.target.value); websiteUrlRef.current = e.target.value; }} className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                <button className="p-2 border border-gray-300 rounded hover:bg-gray-50">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-md">
              <Info className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
              <p className="text-xs text-gray-600">URL parameters have been moved to <span className="font-semibold">Tracking</span>. <a href="#" className="text-indigo-600 hover:underline">Go to Tracking</a></p>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={useDisplayLink} onChange={(e) => setUseDisplayLink(e.target.checked)} className="accent-indigo-600 w-4 h-4" />
                <span className="text-sm text-gray-900">Use a display link</span>
              </label>
              {useDisplayLink && (
                <input type="text" placeholder="Enter the link to show on your ad" value={displayLink} onChange={(e) => { setDisplayLink(e.target.value); displayLinkRef.current = e.target.value; }} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              )}
            </div>
          </div>
        )}
      </div>

      {/* 🔹 Ad Creative Section */}
      <div className="bg-white rounded-lg p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 rounded-full border-2 border-blue-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 8a1 1 0 012 0v4a1 1 0 01-2 0V8z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Ad creative</h3>
        </div>
        <p className="text-sm text-gray-600">Select and optimise your ad text, media and enhancements.</p>

        {/* Common text fields */}
        <div className="space-y-4 border-t pt-4">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <label className="text-sm font-semibold text-gray-900">Primary text</label>
              <Info className="w-4 h-4 text-gray-400" />
            </div>
            <textarea value={primaryText} onChange={(e) => setPrimaryText(e.target.value)} placeholder="Tell people what your ad is about" className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" rows={3} />
          </div>
          {format === "single" && (
            <div>
              <div className="flex items-center gap-1 mb-1">
                <label className="text-sm font-semibold text-gray-900">Headline</label>
                <Info className="w-4 h-4 text-gray-400" />
              </div>
              <input type="text" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Write a short headline" className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
          )}
          {format === "single" && (
            <div>
              <div className="flex items-center gap-1 mb-1">
                <label className="text-sm font-semibold text-gray-900">Description</label>
                <Info className="w-4 h-4 text-gray-400" />
              </div>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Write a short description (optional)" className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Call to action</label>
            <p className="text-xs text-gray-500 mb-2">Choose a call-to-action button for your ad.</p>
            <Select value={callToAction} onValueChange={setCallToAction}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select button" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="no-button">No button</SelectItem>
                <SelectItem value="learn-more">Learn more</SelectItem>
                <SelectItem value="apply-now">Apply now</SelectItem>
                <SelectItem value="book-now">Book now</SelectItem>
                <SelectItem value="contact-us">Contact us</SelectItem>
                <SelectItem value="download">Download</SelectItem>
                <SelectItem value="get-directions">Get directions</SelectItem>
                <SelectItem value="get-quote">Get quote</SelectItem>
                <SelectItem value="shop-now">Shop now</SelectItem>
                <SelectItem value="sign-up">Sign up</SelectItem>
                <SelectItem value="subscribe">Subscribe</SelectItem>
                <SelectItem value="watch-more">Watch more</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ✅ Single format — only one type at a time (unchanged UX, but uses array internally) */}
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

        {/* ✅ Carousel format — MULTI-TYPE CHECKBOXES (image-card + video-card both selectable) */}
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
                      <button onClick={() => setOpenCardIndex(null)} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
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
            // existing same-type items stay, only truly new ones (by id) get appended
            // removal only happens via X button on individual cards
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