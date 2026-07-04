// app/api/events-manager/pixel/setup/route.js
// Pixel base code, event snippets, and setup method configuration

import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

// ─── Inlined Meta API helpers ─────────────────────────────────────────────────

async function metaGet(path, accessToken, params = {}) {
  const url = new URL(`https://graph.facebook.com/v19.0${path}`);
  url.searchParams.set("access_token", accessToken);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  const res  = await fetch(url.toString());
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

function apiOk(data, status = 200) {
  return Response.json({ success: true, ...data }, { status });
}

function apiError(message, status = 500) {
  return Response.json({ success: false, error: message }, { status });
}

// ─── Session + pixel ownership resolver ──────────────────────────────────────
/**
 * Resolves pixel from session using either:
 *  - x-pixel-db-id header (existing behaviour), OR
 *  - ?adAccountId=<uuid> query param → picks first pixel under that ad account
 *
 * Returns: { pixel, adAccount, accessToken }  — or throws with a message.
 */
async function resolvePixelFromSession(request) {
  // 1. Auth check
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    throw Object.assign(new Error("Unauthorized — please sign in"), { status: 401 });
  }

  // 2. Read pixel DB id from header  AND  adAccountId from query param
  const pixelDbId    = request.headers.get("x-pixel-db-id");
  const { searchParams } = new URL(request.url);
  const adAccountId  = searchParams.get("adAccountId");

  if (!pixelDbId && !adAccountId) {
    throw Object.assign(
      new Error("Missing x-pixel-db-id header or adAccountId query param"),
      { status: 400 }
    );
  }

  // 3. Load the requesting user with their ad-account chain
  //    - If pixelDbId is provided → filter pixels by that id (original behaviour)
  //    - If only adAccountId is provided → load all pixels under that account
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      metaAdAccounts: {
        // When adAccountId is given, scope the join to just that account
        where: adAccountId && !pixelDbId ? { id: adAccountId } : undefined,
        include: {
          facebookAccount: true,
          pixels: pixelDbId
            ? { where: { id: pixelDbId } }   // specific pixel
            : { take: 1 },                    // first pixel of the ad account
        },
      },
    },
  });

  if (!user) {
    throw Object.assign(new Error("User not found"), { status: 401 });
  }

  // 4. Find the ad account that owns the target pixel
  let foundPixel     = null;
  let foundAdAccount = null;

  for (const acc of user.metaAdAccounts) {
    // When adAccountId param is used, enforce ownership explicitly
    if (adAccountId && acc.id !== adAccountId) continue;

    if (acc.pixels?.length > 0) {
      foundPixel     = acc.pixels[0];
      foundAdAccount = acc;
      break;
    }
  }

  if (!foundPixel || !foundAdAccount) {
    const hint = pixelDbId
      ? `Pixel ${pixelDbId} not found or you do not have access`
      : `No pixels found for ad account ${adAccountId}`;
    throw Object.assign(new Error(hint), { status: 403 });
  }

  // 5. Resolve the access token (pixel-level → ad account → Facebook account)
  const accessToken =
    foundPixel.accessToken           ||
    foundAdAccount.accessToken       ||
    foundAdAccount.facebookAccount?.accessToken;

  if (!accessToken) {
    throw Object.assign(
      new Error("No valid Meta access token found — please reconnect your Facebook account"),
      { status: 401 }
    );
  }

  // 6. Check token expiry
  const tokenExpiry = foundAdAccount.facebookAccount?.tokenExpiresAt;
  if (tokenExpiry && new Date(tokenExpiry) < new Date()) {
    throw Object.assign(
      new Error("Meta access token has expired — please reconnect your Facebook account"),
      { status: 401 }
    );
  }

  return { pixel: foundPixel, adAccount: foundAdAccount, accessToken };
}

// ─── GET /api/events-manager/pixel/setup ─────────────────────────────────────
// Headers:      x-pixel-db-id  (existing)
// Query param:  ?adAccountId=<uuid>  (new — picks first pixel of that account)
// Returns:      pixel base code, all event snippets, setup method options
export async function GET(request) {
  try {
    const { pixel, accessToken } = await resolvePixelFromSession(request);

    // Fetch live data from Meta (non-fatal — falls back to DB values on failure)
    const metaPixel = await metaGet(`/${pixel.metaPixelId}`, accessToken, {
      fields: "id,name,last_fired_time,is_unavailable,creation_time,event_stats",
    }).catch((err) => {
      console.warn("[pixel/setup] Meta API fetch failed (non-fatal):", err.message);
      return {};
    });

    return apiOk({
      pixel: {
        id                     : pixel.id,
        metaPixelId            : pixel.metaPixelId,
        name                   : pixel.name,
        status                 : pixel.status,
        lastFiredTime          : metaPixel.last_fired_time  ?? pixel.lastFiredTime,
        isUnavailable          : metaPixel.is_unavailable   ?? pixel.isUnavailable,
        eventStats             : metaPixel.event_stats      ?? [],
        advancedMatchingEnabled: pixel.advancedMatchingEnabled,
        automaticEventsEnabled : pixel.automaticEventsEnabled,
        cookiesEnabled         : pixel.cookiesEnabled ?? true,
        eventMatchQualityScore : pixel.eventMatchQualityScore,
        totalEventsReceived    : pixel.totalEventsReceived,
      },
      setup: {
        base_code     : buildBaseCode(pixel.metaPixelId),
        noscript_tag  : buildNoscriptTag(pixel.metaPixelId),
        event_snippets: EVENT_SNIPPETS,
        setup_methods : SETUP_METHODS,
      },
    });
  } catch (err) {
    console.error("[pixel/setup] GET error:", err.message);
    return apiError(err.message, err.status ?? 500);
  }
}

// ─── PATCH /api/events-manager/pixel/setup ───────────────────────────────────
// Headers:      x-pixel-db-id  (existing)
// Query param:  ?adAccountId=<uuid>  (new)
// Body:         { advanced_matching_enabled?, automatic_events_enabled? }
export async function PATCH(request) {
  try {
    const { pixel } = await resolvePixelFromSession(request);

    const body = await request.json().catch(() => ({}));
    const { advanced_matching_enabled, automatic_events_enabled } = body;

    // Build only the fields that were actually sent
    const updateData = {};
    if (advanced_matching_enabled != null) updateData.advancedMatchingEnabled = advanced_matching_enabled;
    if (automatic_events_enabled  != null) updateData.automaticEventsEnabled  = automatic_events_enabled;

    if (Object.keys(updateData).length === 0) {
      return apiError("No valid fields provided to update", 400);
    }

    const updated = await prisma.metaPixel.update({
      where: { id: pixel.id },
      data : updateData,
    });

    console.log(`[pixel/setup] PATCH — pixel ${pixel.id} updated:`, updateData);

    return apiOk({
      message: "Pixel settings updated successfully",
      pixel  : {
        id                     : updated.id,
        advancedMatchingEnabled: updated.advancedMatchingEnabled,
        automaticEventsEnabled : updated.automaticEventsEnabled,
      },
    });
  } catch (err) {
    console.error("[pixel/setup] PATCH error:", err.message);
    return apiError(err.message, err.status ?? 500);
  }
}

// ─── Code generators ──────────────────────────────────────────────────────────

function buildBaseCode(pixelId) {
  return `<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');
</script>
<!-- End Meta Pixel Code -->`;
}

function buildNoscriptTag(pixelId) {
  return `<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"/></noscript>`;
}

// ─── Standard event snippets ──────────────────────────────────────────────────
const EVENT_SNIPPETS = {
  PageView: `fbq('track', 'PageView');`,

  ViewContent: `fbq('track', 'ViewContent', {
  content_ids: ['PRODUCT_ID'],
  content_type: 'product',
  content_name: 'Product Name',
  value: 29.99,
  currency: 'USD'
});`,

  AddToCart: `fbq('track', 'AddToCart', {
  content_ids: ['PRODUCT_ID'],
  content_type: 'product',
  value: 29.99,
  currency: 'USD'
});`,

  InitiateCheckout: `fbq('track', 'InitiateCheckout', {
  content_ids: ['PRODUCT_ID'],
  num_items: 1,
  value: 29.99,
  currency: 'USD'
});`,

  Purchase: `// Generate a unique eventID and pass it to BOTH Pixel and CAPI for deduplication
const eventId = 'evt_' + Date.now() + '_' + Math.random().toString(36).slice(2);

fbq('track', 'Purchase', {
  content_ids: ['PRODUCT_ID'],
  content_type: 'product',
  value: 99.99,
  currency: 'USD',
  num_items: 1,
  order_id: 'ORDER_123'
}, { eventID: eventId });`,

  Lead: `fbq('track', 'Lead', {
  content_name: 'Contact Form',
  value: 0,
  currency: 'USD'
});`,

  CompleteRegistration: `fbq('track', 'CompleteRegistration', {
  content_name: 'Account Sign Up',
  status: true
});`,

  Search: `fbq('track', 'Search', {
  search_string: 'YOUR_SEARCH_TERM',
  content_ids: ['RESULT_1', 'RESULT_2']
});`,

  Subscribe: `fbq('track', 'Subscribe', {
  value: 9.99,
  currency: 'USD',
  predicted_ltv: 119.88
});`,

  StartTrial: `fbq('track', 'StartTrial', {
  value: 0,
  currency: 'USD',
  predicted_ltv: 99.00
});`,

  Contact: `fbq('track', 'Contact');`,

  Schedule: `fbq('track', 'Schedule');`,

  CustomEvent: `fbq('trackCustom', 'YOUR_CUSTOM_EVENT_NAME', {
  custom_param_1: 'value1',
  custom_param_2: 42
});`,
};

// ─── Setup method options ─────────────────────────────────────────────────────
const SETUP_METHODS = [
  {
    id         : "manual",
    label      : "Manual Installation",
    description: "Copy-paste the pixel base code directly into your website's <head> tag. Works with any tech stack.",
    icon       : "📋",
    recommended: false,
  },
  {
    id         : "partner",
    label      : "Partner Integration",
    description: "No-code setup via official integrations — Shopify, WooCommerce, Webflow, Squarespace, and more.",
    icon       : "🔌",
    recommended: true,
  },
  {
    id         : "gtm",
    label      : "Google Tag Manager",
    description: "Deploy via GTM tag templates. No code changes needed on your site — just a GTM workspace.",
    icon       : "🏷️",
    recommended: false,
  },
  {
    id         : "capi",
    label      : "Conversions API (Server-Side)",
    description: "Send events directly from your server to Meta. Bypasses browser ad blockers for more reliable data.",
    icon       : "⚡",
    recommended: false,
  },
  {
    id         : "signals_gateway",
    label      : "Signals Gateway",
    description: "Enterprise cloud-based multi-domain server-side routing. Best for large-scale deployments.",
    icon       : "🌐",
    recommended: false,
  },
];