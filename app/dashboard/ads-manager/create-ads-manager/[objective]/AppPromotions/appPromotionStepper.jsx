"use client";
import { useState, useRef, forwardRef, useEffect, useImperativeHandle } from "react";
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
    Smartphone,
    MonitorSmartphone,
    Gamepad2,
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

export default function AppPromotionStepper() {
    const searchParams = useSearchParams();
    const [step, setStep] = useState(0);
    const router = useRouter();
    const adAccountId = searchParams.get("adAccountId");
    const metaAccountId = searchParams.get("metaAccountId");
    console.log("Meta Account ID (from URL query):", metaAccountId);
    const [campaignData, setCampaignData] = useState({});
    const [adSetData, setAdSetData] = useState({});
    const [draftId, setDraftId] = useState(null);
    const [metaCampaignId, setMetaCampaignId] = useState(null);
    const [metaAdSetId, setMetaAdSetId] = useState(null);
    const [loading, setLoading] = useState(false);

    const objective = "APP_PROMOTION";

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
        const loadingToast = notify.loading("Processing..."); // ✅ Show loading toast

        try {
            if (step === 0 && campaignFormRef.current?.getData) {
                const data = campaignFormRef.current.getData();
                setCampaignData(data);

                const campaignPayload = {
                    step: "campaign",
                    data: {
                        adAccountId: adAccountId,
                        name: data.campaignName,
                        objective: "APP_PROMOTION",
                        buyingType: (data.buyingType || "AUCTION").toUpperCase(),
                        specialAdCategories: data.specialAdCategories || [],

                        ...(data.budgetStrategy === "campaign" && {
                            campaignBudgetOptimization: true,
                            bidStrategy: data.bidStrategy || "LOWEST_COST_WITHOUT_CAP",

                            ...(data.budget?.type === "daily"
                                ? { dailyBudget: parseFloat(data.budget?.amount || "200") }
                                : { lifetimeBudget: parseFloat(data.budget?.amount || "200") }
                            ),
                            ...(data.scheduleBudget && data.startTime && data.endTime && {
                                startTime: data.startTime,
                                endTime: data.endTime
                            }),

                            ...(data.scheduleBudget && {
                                budgetIncrease: {
                                    amount: parseFloat(data.budgetIncreaseAmount || "50")
                                }
                            })
                        }),

                        ...(data.budgetStrategy === "adset" && {
                            campaignBudgetOptimization: false,
                            ...(data.adSetBudgetSharing && {
                                adSetBudgetSharing: true,
                                bidStrategy: data.bidStrategy || "LOWEST_COST_WITHOUT_CAP"
                            }),
                            ...(!data.adSetBudgetSharing && {
                                adSetBudgetSharing: false
                            })
                        })
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

                notify.dismiss(loadingToast); // ✅ Dismiss loading

                if (result.success) {
                    setDraftId(result.draftId);
                    setMetaCampaignId(result.metaCampaignId);
                    notify.success(result.message || "Campaign created successfully!"); // ✅ Success toast
                    setStep(1);
                } else {
                    // ✅ Show error from API response
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
                        performanceGoal: data.performanceGoal || "Maximize number of app installs",
                        optimizationGoal: "APP_INSTALLS",
                        conversionLocation: data.conversionLocation || "app",
                        facebookPage: data.facebookPage || "",
                        facebookPageId: data.facebookPageId || "",

                        budgetType: data.budget?.type || "daily",
                        dailyBudget: data.budget?.amount || 200,
                        currency: data.budget?.currency || "INR",

                        ...(data.costGoal && {
                            costPerResult: data.costGoal,
                        }),

                        startTime: data.startTime || new Date().toISOString(),
                        ...(data.endTime && { endTime: data.endTime }),

                        // ✅ FIXED - schedulePeriod Sales jaisi tarah
                        ...(data.schedulePeriod && {
                            scheduleStartTime: data.schedulePeriod.startTime,
                            ...(data.schedulePeriod.endTime && {
                                scheduleEndTime: data.schedulePeriod.endTime,
                            }),
                        }),
                        scheduleBudget: data.scheduleBudget || false,

                        specialAdCategories: campaignData.specialAdCategories || [],

                        ...(data.conversionLocation === "app" && {
                            appStore: data.appStore || "google_play",
                            applicationId: data.applicationId || "",
                        }),

                        targeting: {
                            geo_locations: {
                                countries: data.audienceControls?.location === "india" ? ["IN"] : ["IN"],
                            },
                            age_min: parseInt(data.audienceControls?.minimumAge) || 18,
                            age_max: 65,
                            genders: [1, 2],
                            ...(data.audienceControls?.languages !== "all" && {
                                locales: [data.audienceControls.languages],
                            }),
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

                notify.dismiss(loadingToast); // ✅ Dismiss loading

                if (result.success) {
                    setMetaAdSetId(result.metaAdSetId);
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

            const adPayload = {
                step: "ad",
                data: {
                    adSetDraftId: metaAdSetId,
                    facebookPage: data.identity?.facebookPage || "",
                    instagramAccount: data.identity?.instagramAccount || null,
                    adSetup: data.adSetup || "create-ad",
                    format: data.format || "single",
                    multiAdvertiser: data.multiAdvertiser || false,
                    destination: "app",
                    creativeData: {
                        name: data.adName || "New App Promotion ad",
                        type: data.creative?.type || data.format,
                        primaryText: data.creative?.primaryText || "",
                        headline: data.creative?.headline || "",
                        callToAction: data.creative?.callToAction?.toUpperCase().replace(/-/g, "_") || "INSTALL_NOW",
                        ...(data.creative?.type === "image-ad" && data.creative?.images?.length > 0 && {
                            image_hash: data.creative.images[0].hash
                        }),
                        ...(data.creative?.type === "video-ad" && {
                            video_id: data.creative?.videoId
                        }),
                        ...(data.format === "carousel" && {
                            carouselCards: (data.creative?.carouselCards || []).map((card) => ({
                                image_hash: card.hash,
                                headline: card.headline || "",
                                description: card.description || "",
                                call_to_action: {
                                    type: data.creative?.callToAction?.toUpperCase().replace(/-/g, "_") || "INSTALL_NOW"
                                }
                            }))
                        })
                    }
                }
            };

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
        { label: "New AppPromotion campaign", icon: Folder, bg: "bg-[#E0E7FF]" },
        { label: "New AppPromotion ad set", icon: Layers, bg: "bg-[#E0E7FF]" },
        { label: "New AppPromotion ad", icon: MonitorPlay, bg: "bg-[#E0E7FF]" },
    ];

    const renderStep = () => {
        switch (step) {
            case 0:
                return <CampaignForm ref={campaignFormRef} />;
            case 1:
                return <AdSetsForm ref={adSetFormRef} adAccountId={adAccountId} metaAccountId={metaAccountId} campaignData={campaignData} />;
            case 2:
                return <AdForm ref={adFormRef} adAccountId={adAccountId} metaAccountId={metaAccountId} />;
            default:
                return null;
        }
    };

    return (
        <div className="flex h-full py-2 bg-[#f9f9fb]">
            <aside className="w-80 h-full border-r fixed overflow-hidden bg-white shadow-sm">
                <div>
                    {steps.map((item, index) => {
                        const Icon = item.icon;
                        return (
                            <div
                                key={index}
                                onClick={() => setStep(index)}
                                className={`flex items-center justify-between px-4 py-3 cursor-pointer border-b transition-all ${step === index ? `${item.bg} font-medium` : "hover:bg-indigo-50 bg-white"}`}
                            >
                                <div className="flex items-center gap-3">
                                    <Icon size={18} className={`${step === index ? "text-indigo-700" : "text-gray-600"}`} />
                                    <span className={`text-[15px] ${step === index ? "text-indigo-800" : "text-gray-700"}`}>
                                        {item.label}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
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

const CampaignForm = forwardRef((props, ref) => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const urlBuyingType = searchParams.get('buyingType') || 'auction';

    const [campaignName, setCampaignName] = useState("New AppPromotion campaign");
    const [buyingType, setBuyingType] = useState(urlBuyingType);
    const [objective, setObjective] = useState("AppPromotions");
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
            description: "Recommended for maximum app installs and events.",
        },
        {
            id: "LOWEST_COST_WITH_BID_CAP",
            label: "Lowest cost with bid cap",
            description: "Control max bid while getting competitive results.",
        },
        {
            id: "COST_CAP",
            label: "Cost cap (Target cost per result)",
            description: "Target average cost per install or event.",
        }
    ];

    const buyingTypes = [
        { id: "auction", label: "Auction" },
        { id: "reservation", label: "Reservation" },
    ];

    const categories = [
        {
            id: "FINANCIAL_PRODUCTS_SERVICES",
            label: "Financial products and services",
            description: "Ads for credit cards, financing, accounts, investments, insurance.",
            icon: Banknote,
        },
        {
            id: "EMPLOYMENT",
            label: "Employment",
            description: "Ads for jobs, internships, certifications.",
            icon: Briefcase,
        },
        {
            id: "HOUSING",
            label: "Housing",
            description: "Ads for property, home insurance, mortgages.",
            icon: Home,
        },
        {
            id: "ISSUES_ELECTIONS_POLITICS",
            label: "Social issues, elections or politics",
            description: "Ads about social issues, elections, politics.",
            icon: Megaphone,
        },
    ];

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
        setSelectedCategories(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const objectivesFiltered =
        buyingType === "reservation"
            ? objectives.filter(obj => ["Awareness", "Engagement"].includes(obj.id))
            : objectives;

    useImperativeHandle(ref, () => ({
        getData: () => {
            const payload = {
                campaignName,
                buyingType,
                objective: "APP_PROMOTION",
                budgetStrategy,
                specialAdCategories: selectedCategories
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
                    payload.budgetIncrease = {
                        amount: parseFloat(budgetIncreaseAmount)
                    };
                }
            }

            if (budgetStrategy === "adset") {
                payload.campaignBudgetOptimization = false;
                payload.adSetBudgetSharing = adSetBudgetSharing;
                if (adSetBudgetSharing) {
                    payload.bidStrategy = bidStrategy;
                }
            }

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
                        onChange={(e) => setCampaignName(e.target.value)}
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

                {/* Budget Section */}
                <div className="bg-white rounded-lg p-6 shadow-sm">
                    <h3 className="text-base font-semibold text-gray-900 mb-3">Budget</h3>

                    <div className="bg-black/1 border border-blue-100 rounded-lg p-4 mb-4">
                        <label className="text-sm font-semibold text-gray-900 flex items-center gap-1 mb-3">
                            Budget strategy <Info className="w-4 h-4 text-gray-400" />
                        </label>
                        <div className="space-y-3">
                            <label className={`flex items-start gap-3 p-3 rounded-md cursor-pointer transition-all ${budgetStrategy === "campaign" ? "bg-white border border-indigo-300 shadow-sm" : "hover:bg-gray-50 border border-transparent"}`}>
                                <input type="radio" name="budgetStrategy" value="campaign" checked={budgetStrategy === "campaign"} onChange={() => setBudgetStrategy("campaign")} className="mt-1 accent-indigo-600" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Campaign budget</p>
                                    <p className="text-xs text-gray-600 leading-snug">Automatically distribute your budget... <a href="#" className="text-indigo-600 hover:text-indigo-700">About campaign budget</a></p>
                                </div>
                            </label>
                            <label className={`flex items-start gap-3 p-3 rounded-md cursor-pointer transition-all ${budgetStrategy === "adset" ? "bg-white border border-indigo-300 shadow-sm" : "hover:bg-gray-50 border border-transparent"}`}>
                                <input type="radio" name="budgetStrategy" value="adset" checked={budgetStrategy === "adset"} onChange={() => setBudgetStrategy("adset")} className="mt-1 accent-indigo-600" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Ad set budget</p>
                                    <p className="text-xs text-gray-600 leading-snug">Set different bid strategies or budget schedules for each ad set.</p>
                                </div>
                            </label>
                        </div>
                    </div>

                    {budgetStrategy === "campaign" && (
                        <div className="space-y-4 border-t pt-4">
                            <div>
                                <div className="flex items-center gap-1 mb-2">
                                    <label className="text-sm font-semibold text-gray-900">Budget</label>
                                    <Info className="w-4 h-4 text-gray-400" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Select value={budgetType} onValueChange={setBudgetType}>
                                        <SelectTrigger className="w-70"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="daily">Daily budget</SelectItem>
                                            <SelectItem value="lifetime">Lifetime budget</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <span className="text-sm text-gray-700">₹</span>
                                    <input type="number" value={budgetAmount} onChange={e => setBudgetAmount(e.target.value)} className="w-70 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                    <span className="text-sm text-gray-700">INR</span>
                                </div>
                            </div>

                            <div className="pt-4 border-t">
                                <div className="flex items-center gap-1 mb-2">
                                    <label className="text-sm font-semibold text-gray-900">Campaign bid strategy</label>
                                    <Info className="w-4 h-4 text-gray-400" />
                                </div>
                                <Select value={bidStrategy} onValueChange={setBidStrategy}>
                                    <SelectTrigger className="w-full">
                                        {bidStrategies.find(s => s.id === bidStrategy)?.label || "Select bid strategy"}
                                    </SelectTrigger>
                                    <SelectContent>
                                        {bidStrategies.map(s => (
                                            <SelectItem key={s.id} value={s.id}>
                                                <div className="flex flex-col text-left">
                                                    <span>{s.label}</span>
                                                    <span className="text-xs text-gray-500">{s.description}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-gray-600 mt-2">{bidStrategies.find(s => s.id === bidStrategy)?.description}</p>
                            </div>

                            <div className="pt-4 border-t">
                                <div className="flex items-center gap-1 mb-2">
                                    <label className="text-sm font-semibold text-gray-900">Budget scheduling</label>
                                    <Info className="w-4 h-4 text-gray-400" />
                                </div>
                                <p className="text-sm text-gray-600 mb-3">Increase your budget during specific days or times.</p>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <input type="checkbox" id="scheduleBudget" checked={scheduleBudget} disabled={budgetType === "daily"} onChange={e => setScheduleBudget(e.target.checked)} className="accent-indigo-600 w-4 h-4" />
                                        <label htmlFor="scheduleBudget" className="text-sm text-gray-900">Schedule budget increases</label>
                                    </div>
                                </div>
                                {budgetType === "daily" && <p className="text-xs text-gray-500 mt-1">Budget scheduling is only available for lifetime budgets.</p>}
                                {scheduleBudget && (
                                    <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-semibold text-gray-900">Time period for budget increase</h4>
                                            <ChevronDown className="w-4 h-4 text-gray-600" />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-900 block mb-2">Time Period</label>
                                            <RangePicker
                                                showTime={{ format: "HH:mm" }}
                                                format="YYYY-MM-DD HH:mm"
                                                style={{ width: "100%" }}
                                                onChange={(dates) => {
                                                    if (dates?.[0] && dates?.[1]) {
                                                        setScheduleStartEnd({
                                                            startTime: dates[0].toISOString(),
                                                            endTime: dates[1].toISOString()
                                                        });
                                                    }
                                                }}
                                            />
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Select defaultValue="value">
                                                <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="value">Increase daily budget by value amount (₹)</SelectItem>
                                                    <SelectItem value="percent">Increase daily budget by percentage</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <span className="text-sm text-gray-700">₹</span>
                                            <input type="number" value={budgetIncreaseAmount} onChange={e => setBudgetIncreaseAmount(e.target.value)} className="w-60 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                            <span className="text-sm text-gray-700">INR</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {budgetStrategy === "adset" && (
                        <>
                            <div className="pt-4 border-t mb-4">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input type="checkbox" checked={adSetBudgetSharing} onChange={e => setAdSetBudgetSharing(e.target.checked)} className="accent-indigo-600 w-4 h-4 mt-0.5" />
                                    <div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-sm font-medium text-gray-900">Share some of your budget with other ad sets</span>
                                            <Info className="w-4 h-4 text-gray-400" />
                                        </div>
                                        <p className="text-xs text-gray-600 mt-1 leading-snug">We'll share up to 20% of your ad set budget with other ad sets...</p>
                                    </div>
                                </label>
                            </div>

                            {adSetBudgetSharing && (
                                <div className="pt-4 border-t">
                                    <div className="flex items-center gap-1 mb-2">
                                        <label className="text-sm font-semibold text-gray-900">Campaign bid strategy</label>
                                        <Info className="w-4 h-4 text-gray-400" />
                                    </div>
                                    <Select value={bidStrategy} onValueChange={setBidStrategy}>
                                        <SelectTrigger className="w-full">
                                            {bidStrategies.find(s => s.id === bidStrategy)?.label || "Select bid strategy"}
                                        </SelectTrigger>
                                        <SelectContent>
                                            {bidStrategies.map(s => (
                                                <SelectItem key={s.id} value={s.id}>
                                                    <div className="flex flex-col text-left">
                                                        <span>{s.label}</span>
                                                        <span className="text-xs text-gray-500">{s.description}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-gray-600 mt-2">{bidStrategies.find(s => s.id === bidStrategy)?.description}</p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Special Ad Categories */}
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
                        Declare if your ads are related to financial products and services, employment, housing, or social issues, elections or politics to help prevent ad rejections.
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
   Step 2: Ad Set Targeting - UPDATED WITH ENGAGEMENT LOGIC
------------------------------ */
const AdSetsForm = forwardRef(({ adAccountId, metaAccountId, campaignData = {} }, ref) => {
    const [adSetName, setAdSetName] = useState("New AppPromotion ad set");
    const [mobileAppStore, setMobileAppStore] = useState("Google Play Store");
    const [appName, setAppName] = useState("");
    const [isCountryChecked, setIsCountryChecked] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState("United States");
    const [performanceGoal, setPerformanceGoal] = useState("Maximise number of app installs");
    const [costGoal, setCostGoal] = useState("");
    const [endDateEnabled, setEndDateEnabled] = useState(false);
    const [budgetType, setBudgetType] = useState("daily");
    const [budgetAmount, setBudgetAmount] = useState("200.00");
    const [scheduleBudget, setScheduleBudget] = useState(false);
    const [startTime, setStartTime] = useState(null);
    const [endTime, setEndTime] = useState(null);
    const [scheduleStartTime, setScheduleStartTime] = useState(null);
    const [scheduleEndTime, setScheduleEndTime] = useState(null);
    const [minimumAge, setMinimumAge] = useState("18");
    const [countries, setCountries] = useState([]);
    const [loadingCountries, setLoadingCountries] = useState(false);
    const [selectedCountryCode, setSelectedCountryCode] = useState("IN");
    const [selectedCountryName, setSelectedCountryName] = useState("India");

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
                const response = await fetch("https://countriesnow.space/api/v0.1/countries/iso");
                const result = await response.json();
                if (result.error === false && result.data) {
                    const sortedCountries = result.data.sort((a, b) => a.name.localeCompare(b.name));
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

    useImperativeHandle(ref, () => ({
        getData: () => {
            const payload = {
                adSetName,
                performanceGoal,
                mobileAppStore,
                appName,
                costGoal: costGoal ? parseFloat(costGoal) : null,

                // ✅ Budget only when Campaign Budget OFF
                ...(!campaignData?.campaignBudgetOptimization && {
                    budgetType: budgetType,
                    ...(budgetType === "daily" && {
                        dailyBudget: parseFloat(budgetAmount || 200),
                    }),
                    ...(budgetType === "lifetime" && {
                        lifetimeBudget: parseFloat(budgetAmount || 200),
                    }),
                    currency: "INR",
                }),

                // ✅ Schedule handling
                startTime: startTime ? startTime.toISOString() : new Date().toISOString(),
                ...(endDateEnabled && endTime && { endTime: endTime.toISOString() }),

                scheduleBudget: scheduleBudget || false,
                ...(scheduleBudget && scheduleStartTime && {
                    schedulePeriod: {
                        startTime: scheduleStartTime.toISOString(),
                        ...(scheduleEndTime && {
                            endTime: scheduleEndTime.toISOString(),
                        }),
                    },
                }),

                scheduleBudget: scheduleBudget || false,

                // ✅ Schedule period for budget scheduling
                ...(scheduleBudget && scheduleStartTime && {
                    schedulePeriod: {
                        startTime: scheduleStartTime.toISOString(),
                        ...(scheduleEndTime && {
                            endTime: scheduleEndTime.toISOString(),
                        }),
                    },
                }),

                audienceControls: {
                    location: selectedCountryCode,
                    locationName: selectedCountryName,
                    minimumAge: parseInt(minimumAge) || 18,
                },
            };

            console.log("App Promotion Ad Set Data:", payload);
            return payload;
        },
    }));

    return (
        <div className="max-w-2xl space-y-5">
            {/* 🔹 Ad set name section */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full border-2 border-green-500 flex items-center justify-center">
                            <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
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
                    onChange={(e) => setAdSetName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
            </div>
            {/* 🔹App Promotion Section  */}
            <div className="bg-white rounded-lg p-6 shadow-sm space-y-6">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded-full border-2 border-green-500 flex items-center justify-center">
                        <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                            />
                        </svg>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">App promotion</h3>
                </div>
                {/* Mobile App Store */}
                <div>
                    <label className="text-sm font-semibold text-gray-900 block mb-1">Mobile app store</label>
                    <Select value={mobileAppStore} onValueChange={(v) => setMobileAppStore(v)}>
                        <SelectTrigger className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Google Play Store">Google Play Store</SelectItem>
                            <SelectItem value="Apple App Store (iOS 13.7 or earlier)">
                                Apple App Store (iOS 13.7 or earlier)
                            </SelectItem>
                            <SelectItem value="Apple App Store for iPad">Apple App Store for iPad</SelectItem>
                            <SelectItem value="Facebook Canvas">Facebook Canvas</SelectItem>
                            <SelectItem value="Amazon Appstore">Amazon Appstore</SelectItem>
                            <SelectItem value="Games">Games</SelectItem>
                            <SelectItem value="Meta Quest App Store">Meta Quest App Store</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* App Name Input */}
                <div>
                    <label className="text-sm font-semibold text-gray-900 block mb-1">App name</label>
                    <input
                        type="text"
                        placeholder="Enter app name, app ID or exact app store URL"
                        value={appName}
                        onChange={(e) => setAppName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                </div>

                {/* Checkbox and Country Dropdown */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={isCountryChecked}
                            onChange={(e) => setIsCountryChecked(e.target.checked)}
                            className="accent-indigo-600 w-4 h-4"
                        />
                        <span className="text-sm text-gray-900">
                            Find your app by selecting a country where its available.
                        </span>
                    </label>

                    {isCountryChecked && (
                        <Select value={selectedCountry} onValueChange={(v) => setSelectedCountry(v)}>
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="United States">United States</SelectItem>
                                <SelectItem value="India">India</SelectItem>
                                <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                                <SelectItem value="Canada">Canada </SelectItem>
                                <SelectItem value="Australia">Australia </SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                </div>

                {/* performance Goal */}
                <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1">Performance goal</label>
                    <p className="text-xs text-gray-500 mb-2">
                        How you measure success for your ads.{" "}
                        <a href="#" className="text-indigo-600 hover:underline">
                            About performance goals
                        </a>
                    </p>

                    <Select value={performanceGoal} onValueChange={(v) => setPerformanceGoal(v)}>
                        <SelectTrigger className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Maximise number of app installs">
                                Maximise number of app installs
                            </SelectItem>
                            <SelectItem value="Maximise app engagement">Maximise app engagement</SelectItem>
                            <SelectItem value="Maximise app events">Maximise app events</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Cost Goal */}
                <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1">
                        Cost per result goal <span className="text-gray-500">(Optional)</span>
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

            {/* 🔹 Budget and Schedule Section - SAME AS ENGAGEMENT */}
            <div className="bg-white rounded-lg p-6 shadow-sm space-y-6">
                {/* When Advantage+ campaign budget is ON */}
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
                                        {campaignData.budget?.type === "daily" ? "daily" : "lifetime"}
                                    </strong>
                                    &nbsp; Advantage+ campaign budget of{" "}
                                    <strong>₹{campaignData.budget?.amount?.toFixed(2)}</strong>.
                                </p>
                                <p className="text-xs text-gray-500 mt-2">
                                    Budget is controlled at the campaign level. No separate budget needed here.
                                </p>
                            </div>
                        </div>

                        {/* Schedule section */}
                        <div className="border-t pt-5">
                            <label className="text-sm font-semibold text-gray-900 block mb-2">Schedule</label>
                            <div className="flex items-center gap-2 mb-3">
                                <label className="text-sm text-gray-700 w-20">Start time</label>
                                <DatePicker
                                    showTime
                                    format="YYYY-MM-DD HH:mm"
                                    style={{ width: "240px" }}
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
                                <label className="text-sm font-semibold text-gray-900">Budget scheduling</label>
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
                                    <div>
                                        <label className="text-sm font-medium text-gray-900 block mb-2">
                                            Time Period
                                        </label>
                                        <RangePicker
                                            showTime={{ format: "HH:mm" }}
                                            format="YYYY-MM-DD HH:mm"
                                            style={{ width: "100%" }}
                                            onChange={(dates) => {
                                                if (dates && dates.length === 2) {
                                                    setScheduleStartTime(dates[0] ? dates[0].toDate() : null);
                                                    setScheduleEndTime(dates[1] ? dates[1].toDate() : null);
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
                                                <SelectItem value="percent">
                                                    Increase daily budget by percentage
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <span className="text-sm text-gray-700">₹</span>
                                        <input
                                            type="number"
                                            defaultValue="50.00"
                                            className="w-60 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        />
                                        <span className="text-sm text-gray-700">INR</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* When Advantage+ is OFF → original budget controls */
                    <>
                        {/* Budget */}
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
                                You will spend an average of ₹{parseFloat(budgetAmount).toFixed(2)} per day.
                            </p>
                        </div>

                        {/* Schedule */}
                        <div className="border-t pt-4">
                            <label className="text-sm font-semibold text-gray-900 block mb-2">Schedule</label>
                            <div className="flex items-center gap-2 mb-3">
                                <label className="text-sm text-gray-700 w-20">Start time</label>
                                <DatePicker
                                    showTime
                                    format="YYYY-MM-DD HH:mm"
                                    style={{ width: "240px" }}
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
                                <label className="text-sm font-semibold text-gray-900">Budget scheduling</label>
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
                                    <div>
                                        <label className="text-sm font-medium text-gray-900 block mb-2">
                                            Time Period
                                        </label>
                                        <RangePicker
                                            showTime={{ format: "HH:mm" }}
                                            format="YYYY-MM-DD HH:mm"
                                            style={{ width: "100%" }}
                                            onChange={(dates) => {
                                                if (dates && dates.length === 2) {
                                                    setScheduleStartTime(dates[0] ? dates[0].toDate() : null);
                                                    setScheduleEndTime(dates[1] ? dates[1].toDate() : null);
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
                                                <SelectItem value="percent">
                                                    Increase daily budget by percentage
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <span className="text-sm text-gray-700">₹</span>
                                        <input
                                            type="number"
                                            defaultValue="50.00"
                                            className="w-60 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        />
                                        <span className="text-sm text-gray-700">INR</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* 🔹 Audience Controls Section */}
            <div className="bg-white rounded-lg p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">Audience controls</h3>
                    <p className="text-xs text-gray-500">
                        Set criteria for where ads for this campaign can be delivered.
                    </p>
                </div>

                {/* Location - WITH API INTEGRATION */}
                <div>
                    <label className="text-sm font-semibold text-gray-900 block mb-1">Location</label>
                    <p className="text-xs text-gray-500 mb-2">
                        Choose where your ads will be shown.
                    </p>
                    {loadingCountries ? (
                        <div className="text-sm text-gray-500">Loading countries...</div>
                    ) : (
                        <Select
                            value={selectedCountryCode}
                            onValueChange={(iso2) => {
                                setSelectedCountryCode(iso2);
                                const country = countries.find((c) => c.Iso2 === iso2);
                                if (country) {
                                    setSelectedCountryName(country.name);
                                }
                            }}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue>{selectedCountryName || "Select location"}</SelectValue>
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                                {countries.map((country) => (
                                    <SelectItem key={country.Iso2} value={country.Iso2}>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-900">{country.name}</span>
                                            <span className="text-xs text-gray-500">({country.Iso2})</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <div className="mt-3 flex items-start gap-2 p-1">
                        <Info className="w-4 h-4 mt-0.5" />
                        <p className="text-xs text-gray-400 leading-snug">
                            To run ads in India, you need to declare if your ads are related to securities and investments.
                        </p>
                    </div>
                </div>

                {/* Age Range */}
                <div className="border-t pt-4">
                    <label className="text-sm font-semibold text-gray-900 block mb-1">Minimum age</label>
                    <Select value={minimumAge} onValueChange={setMinimumAge}>
                        <SelectTrigger className="w-40">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="18">18</SelectItem>
                            <SelectItem value="21">21</SelectItem>
                            <SelectItem value="25">25</SelectItem>
                            <SelectItem value="30">30</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="border-t pt-4">
                    <label className="text-sm font-semibold text-gray-900 block mb-1">Languages</label>
                    <Select defaultValue="all">
                        <SelectTrigger className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All languages</SelectItem>
                            <SelectItem value="english">English</SelectItem>
                            <SelectItem value="hindi">Hindi</SelectItem>
                            <SelectItem value="spanish">Spanish</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    );
});
AdSetsForm.displayName = "AdSetsForm";
/* -----------------------------
   Step 3: Ad Creative
------------------------------ */

function AdForm() {
    const [adName, setAdName] = useState("New App Promotion ad");
    const [facebookPage, setFacebookPage] = useState("Niya Bags");
    const [sendToAppStore, setSendToAppStore] = useState(false);
    const [adSetup, setAdSetup] = useState("create-ad");
    const [creativeSource, setCreativeSource] = useState("manual-upload");
    const [format, setFormat] = useState("single");
    const [multiAdvertiser, setMultiAdvertiser] = useState(true);
    const [destination, setDestination] = useState("app");
    const [creativeType, setCreativeType] = useState("");
    const [carouselCardType, setCarouselCardType] = useState("");

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
                    onChange={(e) => setAdName(e.target.value)}
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

                    <Select value={facebookPage} onValueChange={setFacebookPage}>
                        <SelectTrigger className="w-full">
                            <SelectValue>
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-200 text-cyan-800 font-semibold text-sm">
                                        {facebookPage.charAt(0)}
                                    </div>
                                    <span className="text-sm font-medium text-gray-900">
                                        {facebookPage}
                                    </span>
                                </div>
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Niya Bags">Niya Bags</SelectItem>
                            <SelectItem value="Style Studio">Style Studio</SelectItem>
                            <SelectItem value="Glow Essentials">Glow Essentials</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="mt-3 flex items-start gap-2">
                        <input
                            type="checkbox"
                            checked={sendToAppStore}
                            onChange={(e) => setSendToAppStore(e.target.checked)}
                            className="accent-indigo-600 mt-1"
                        />
                        <label className="text-sm text-gray-900 leading-snug">
                            Send people to the app store when they click your profile picture.
                        </label>
                    </div>
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

                {/* Dropdowns */}
                <Select value={adSetup} onValueChange={setAdSetup}>
                    <SelectTrigger className="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="create-ad">Create ad</SelectItem>
                        <SelectItem value="existing-post">Use existing post</SelectItem>
                        <SelectItem value="mockup">Use Creative Hub mockup</SelectItem>
                    </SelectContent>
                </Select>

                <div className="pt-4 border-t">
                    <label className="text-sm font-semibold text-gray-900 mb-2 block">
                        Creative source
                    </label>
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm text-gray-900">
                            <input
                                type="radio"
                                name="creativeSource"
                                value="manual-upload"
                                checked={creativeSource === "manual-upload"}
                                onChange={(e) => setCreativeSource(e.target.value)}
                                className="accent-indigo-600"
                            />
                            Manual upload
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-900">
                            <input
                                type="radio"
                                name="creativeSource"
                                value="catalogue-ads"
                                checked={creativeSource === "catalogue-ads"}
                                onChange={(e) => setCreativeSource(e.target.value)}
                                className="accent-indigo-600"
                            />
                            Advantage+ catalogue ads
                        </label>
                    </div>
                </div>

                {/* Format */}
                <div className="pt-4 border-t">
                    <div className="flex items-center gap-1 mb-2">
                        <label className="text-sm font-semibold text-gray-900">Format</label>
                        <Info className="w-4 h-4 text-gray-400" />
                    </div>
                    <p className="text-xs text-gray-500 mb-3">
                        Choose an ad creative layout.
                    </p>
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
                    </div>
                </div>
            </div>

            {/* 🔹 Destination Section */}
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
                    <h3 className="text-sm font-semibold text-gray-900">Destination</h3>
                </div>

                <p className="text-sm text-gray-600">
                    Tell us where to send people immediately after they tap or click your ad.{" "}
                    <a href="#" className="text-indigo-600 hover:underline">
                        Learn more
                    </a>
                </p>

                {/* Destination Options */}
                <div className="space-y-3">
                    {/* App Option */}
                    <label
                        className={`flex items-start gap-3 p-4 border rounded-md cursor-pointer transition-all ${destination === "app"
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-300 hover:border-gray-400"
                            }`}
                    >
                        <input
                            type="radio"
                            name="destination"
                            value="app"
                            checked={destination === "app"}
                            onChange={(e) => setDestination(e.target.value)}
                            className="mt-1 accent-indigo-600"
                        />
                        <div>
                            <div className="flex items-center gap-2 font-medium text-gray-900 text-sm">
                                <Smartphone className="w-4 h-4 text-gray-500" />
                                App
                            </div>
                            <p className="text-sm text-gray-600 mt-0.5">Send people to your app.</p>
                        </div>
                    </label>

                    {/* Instant Experience Option */}
                    <label
                        className={`flex items-start gap-3 p-4 border rounded-md cursor-pointer transition-all ${destination === "instant"
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-300 hover:border-gray-400"
                            }`}
                    >
                        <input
                            type="radio"
                            name="destination"
                            value="instant"
                            checked={destination === "instant"}
                            onChange={(e) => setDestination(e.target.value)}
                            className="mt-1 accent-indigo-600"
                        />
                        <div>
                            <div className="flex items-center gap-2 font-medium text-gray-900 text-sm">
                                <MonitorSmartphone className="w-4 h-4 text-gray-500" />
                                Instant Experience
                            </div>
                            <p className="text-sm text-gray-600 mt-0.5">
                                Send people to a fast-loading, mobile-optimised experience.
                            </p>
                        </div>
                    </label>

                    {/* Playable Source Option */}
                    <label
                        className={`flex items-start gap-3 p-4 border rounded-md cursor-pointer transition-all ${destination === "playable"
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-300 hover:border-gray-400"
                            }`}
                    >
                        <input
                            type="radio"
                            name="destination"
                            value="playable"
                            checked={destination === "playable"}
                            onChange={(e) => setDestination(e.target.value)}
                            className="mt-1 accent-indigo-600"
                        />
                        <div>
                            <div className="flex items-center gap-2 font-medium text-gray-900 text-sm">
                                <Gamepad2 className="w-4 h-4 text-gray-500" />
                                Playable source
                            </div>
                            <p className="text-sm text-gray-600 mt-0.5">
                                Send people to play an interactive demo of your app.
                            </p>
                        </div>
                    </label>
                </div>

                {/* Conditional Fields */}
                {destination === "app" && (
                    <div className="space-y-4 mt-3 border-t pt-4">
                        <div>
                            <label className="text-sm font-medium text-gray-900">
                                Deferred deep link · <span className="text-gray-500">Optional</span>
                            </label>
                            <input
                                type="text"
                                placeholder="Enter the deferred deep link URL"
                                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded text-sm"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-900">
                                Custom store listing
                            </label>
                            <input
                                type="text"
                                placeholder="Enter custom store listing ID"
                                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded text-sm"
                            />
                        </div>
                    </div>
                )}

                {destination === "instant" && (
                    <div className="space-y-4 mt-3 border-t pt-4">
                        <div>
                            <label className="text-sm font-medium text-gray-900">
                                Instant Experience name
                            </label>
                            <input
                                type="text"
                                placeholder="Search or create Instant Experience"
                                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded text-sm"
                            />
                        </div>
                        <button className="px-4 py-2 border text-sm border-gray-300 rounded hover:bg-gray-50">
                            + Create new Instant Experience
                        </button>
                    </div>
                )}

                {destination === "playable" && (
                    <div className="space-y-4 mt-3 border-t pt-4">
                        <div className="p-3 bg-gray-50 border border-gray-200 text-xs text-gray-600 rounded">
                            Playables are available for Instagram, Facebook, and Audience Network
                            placements. For others, users will be sent to an app store after
                            clicking your ad.
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-900">
                                Deferred deep link · <span className="text-gray-500">Optional</span>
                            </label>
                            <input
                                type="text"
                                placeholder="Enter the deferred deep link URL"
                                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded text-sm"
                            />
                        </div>
                    </div>
                )}
            </div>


            {/* 🔹 Ad Creative Section */}
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
                    <h3 className="text-sm font-semibold text-gray-900">Ad creative</h3>
                </div>

                <p className="text-sm text-gray-600">
                    Select and optimise your ad text, media and enhancements.
                </p>

                {/* 🖼️ Single Image or Video */}
                {format === "single" && (
                    <div className="space-y-4 border-t pt-4">
                        {/* Set up creative dropdown */}
                        <label className="block text-sm font-semibold text-gray-900 mb-1">
                            Set up creative
                        </label>
                        <Select onValueChange={setCreativeType} value={creativeType}>
                            <SelectTrigger className="w-64">
                                <SelectValue placeholder="Set up creative" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="image-ad">Image ad</SelectItem>
                                <SelectItem value="video-ad">Video ad</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Image ad upload */}
                        {creativeType === "image-ad" && (
                            <div className="border-t pt-4 space-y-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <Info className="w-4 h-4 text-gray-600" />
                                    <h4 className="text-sm font-semibold text-gray-900">
                                        Image ad setup
                                    </h4>
                                </div>
                                <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-indigo-400 transition cursor-pointer">
                                    <p className="text-sm text-gray-600">Click to upload image</p>
                                </div>
                            </div>
                        )}

                        {/* Video ad upload */}
                        {creativeType === "video-ad" && (
                            <div className="border-t pt-4 space-y-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <Info className="w-4 h-4 text-gray-600" />
                                    <h4 className="text-sm font-semibold text-gray-900">
                                        Video ad setup
                                    </h4>
                                </div>
                                <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-indigo-400 transition cursor-pointer">
                                    <p className="text-sm text-gray-600">Click to upload video</p>
                                </div>
                            </div>
                        )}

                        {/* Primary Text */}
                        <div>
                            <div className="flex items-center gap-1 mb-1">
                                <label className="text-sm font-semibold text-gray-900">
                                    Primary text
                                </label>
                                <Info className="w-4 h-4 text-gray-400" />
                            </div>
                            <textarea
                                placeholder="Tell people what your ad is about"
                                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                rows={2}
                            ></textarea>
                        </div>

                        {/* Call to Action */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-1">
                                Call to action
                            </label>
                            <p className="text-xs text-gray-500 mb-2">
                                Choose a call-to-action button for your ad.
                            </p>

                            <Select defaultValue="learn-more">
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
                                    <SelectItem value="send-whatsapp-message">
                                        Send WhatsApp message
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}

                {/* 🎠 Carousel */}
                {format === "carousel" && (
                    <div className="space-y-4 border-t pt-4">
                        {/* Carousel cards */}
                        <div>
                            <div className="flex items-center gap-1 mb-1">
                                <label className="text-sm font-semibold text-gray-900">
                                    Carousel cards
                                </label>
                                <Info className="w-4 h-4 text-gray-400" />
                            </div>
                            <p className="text-xs text-gray-500 mb-2">0 of 10 cards added</p>

                            <Select onValueChange={setCarouselCardType} value={carouselCardType}>
                                <SelectTrigger className="w-64">
                                    <SelectValue placeholder="Add cards" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="image-card">Image card</SelectItem>
                                    <SelectItem value="video-card">Video card</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Image Card */}
                        {carouselCardType === "image-card" && (
                            <div className="border-t pt-4 space-y-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <Info className="w-4 h-4 text-gray-600" />
                                    <h4 className="text-sm font-semibold text-gray-900">
                                        Image card setup
                                    </h4>
                                </div>
                                <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-indigo-400 transition cursor-pointer">
                                    <p className="text-sm text-gray-600">Click to upload image</p>
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-gray-900 block mb-1">
                                        Headline
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Write a short headline for this card"
                                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Video Card */}
                        {carouselCardType === "video-card" && (
                            <div className="border-t pt-4 space-y-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <Info className="w-4 h-4 text-gray-600" />
                                    <h4 className="text-sm font-semibold text-gray-900">
                                        Video card setup
                                    </h4>
                                </div>
                                <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-indigo-400 transition cursor-pointer">
                                    <p className="text-sm text-gray-600">Click to upload video</p>
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-gray-900 block mb-1">
                                        Headline
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Write a short headline for this video card"
                                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Primary Text */}
                        <div>
                            <div className="flex items-center gap-1 mb-1">
                                <label className="text-sm font-semibold text-gray-900">
                                    Primary text
                                </label>
                                <Info className="w-4 h-4 text-gray-400" />
                            </div>
                            <textarea
                                placeholder="Tell people what your ad is about"
                                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                rows={2}
                            ></textarea>
                        </div>

                        {/* Call to Action */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-1">
                                Call to action
                            </label>
                            <p className="text-xs text-gray-500 mb-2">
                                Choose a call-to-action button for your ad.
                            </p>

                            <Select defaultValue="learn-more">
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
                                    <SelectItem value="send-whatsapp-message">
                                        Send WhatsApp message
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}






