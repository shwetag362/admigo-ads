// "use client";
// import { useParams } from "next/navigation";
// import Link from "next/link";
// import AppPromotionsStepper from "./AppPromotions/appPromotionStepper";
// import AwarenessStepper from "./Awareness/awarenessStepper";
// import EngagementStepper from "./Engagement/engagementStepper";
// import LeadsStepper from "./Leads/leadsStepper";
// import SalesStepper from "./Sales/salesStepper";
// import TrafficStepper from "./Traffic/trafficStepper";

// export default function ObjectivePage() {
//   const { objective } = useParams();

//   switch (objective) {
//     case "AppPromotions":
//       return <AppPromotionsStepper />;
//     case "Awareness":
//       return <AwarenessStepper />;
//     case "Engagement":
//       return <EngagementStepper />;
//     case "Leads":
//       return <LeadsStepper />;
//     case "Sales":
//       return <SalesStepper />;
//     case "Traffic":
//       return <TrafficStepper />;

//     default:
//       return (


//         <div className="flex items-center justify-center h-screen bg-white text-black flex-col space-y-2">
//           <h2 className="text-2xl font-semibold">  Invalid objective type.</h2>
//           <p className="text-sm">            The objective you are trying to access does not exist.
//           </p>
//           <Link href="/dashboard/ads-manager/create-ads-manager"
//             className="text-blue-500 underline">
//             Return to Create Ads Manager

//           </Link>
//         </div>
//       );
//   }
// }


"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useMemo, Suspense } from "react";
import dynamic from "next/dynamic";
import Loader from "@/app/components/Loader";

const AppPromotionsStepper = dynamic(
  () => import("./AppPromotions/appPromotionStepper"),
  {
    loading: () => <Loader />,
    ssr: false, // Disable SSR if not needed
  }
);

const AwarenessStepper = dynamic(
  () => import("./Awareness/awarenessStepper"),
  {
    loading: () => <Loader />,
    ssr: false,
  }
);

const EngagementStepper = dynamic(
  () => import("./Engagement/engagementStepper"),
  {
    loading: () => <Loader />,
    ssr: false,
  }
);

const LeadsStepper = dynamic(
  () => import("./Leads/leadsStepper"),
  {
    loading: () => <Loader />,
    ssr: false,
  }
);

const SalesStepper = dynamic(
  () => import("./Sales/salesStepper"),
  {
    loading: () => <Loader />,
    ssr: false,
  }
);

const TrafficStepper = dynamic(
  () => import("./Traffic/trafficStepper"),
  {
    loading: () => <Loader />,
    ssr: false,
  }
);



const OBJECTIVE_COMPONENTS = {
  AppPromotions: AppPromotionsStepper,
  Awareness: AwarenessStepper,
  Engagement: EngagementStepper,
  Leads: LeadsStepper,
  Sales: SalesStepper,
  Traffic: TrafficStepper,
};

// ✅ Error component
const InvalidObjective = () => (
  <div className="flex items-center justify-center h-screen bg-white text-black flex-col space-y-2">
    <h2 className="text-2xl font-semibold">Invalid objective type.</h2>
    <p className="text-sm">
      The objective you are trying to access does not exist.
    </p>
    <Link
      href="/dashboard/ads-manager/create-ads-manager"
      className="text-blue-500 underline hover:text-blue-700 transition-colors"
    >
      Return to Create Ads Manager
    </Link>
  </div>
);

export default function ObjectivePage() {
  const { objective } = useParams();

  const Component = useMemo(() => {
    return OBJECTIVE_COMPONENTS[objective] || InvalidObjective;
  }, [objective]);

  return (
    <Suspense fallback={<Loader />}>
      <Component />
    </Suspense>
  );
}
