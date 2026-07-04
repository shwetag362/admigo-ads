import React from "react";
import {
  X,
  MoreHorizontal,
  ThumbsUp,
  MessageCircle,
  Share2,
  Heart,
  Send,
  Bookmark,
  Play,
  Search,
  Repeat2,
  ChevronLeft,
  Edit3,
} from "lucide-react";
import Image from "next/image";

/* ─── 9:16 Wrapper — same size for ALL templates ─── */
const CardWrapper = ({ children }) => (
  <div
    className="bg-indigo-50 rounded-xl border flex items-center justify-center"
    style={{ width: "200px", height: "355px" }}
  >
    {children}
  </div>
);

/* ─── Shared Creative Image ─── */
const CreativeImage = ({ mediaSrc, isVideo }) => {
  if (!mediaSrc) {
    return (
      <div className="relative w-full h-full bg-gray-200 flex items-center justify-center">
        <span className="text-[10px] text-gray-400">No media</span>
      </div>
    );
  }
  return (
    <div className="relative w-full h-full">
      <Image src={mediaSrc} alt="Ad creative" fill className="object-cover" unoptimized />
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
            <Play size={14} color="white" />
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── FB Avatar (initial based) ─── */
const FbAvatar = ({ initial, size = "sm", bg = "bg-indigo-500" }) => {
  const sz = size === "sm" ? "w-6 h-6 text-[10px]" : size === "lg" ? "w-10 h-10 text-sm" : "w-8 h-8 text-xs";
  return (
    <div className={`${sz} ${bg} rounded-full flex items-center justify-center font-bold text-white shrink-0`}>
      {initial || "A"}
    </div>
  );
};

/* ─── IG Avatar (picture or initial fallback) ─── */
const IgAvatar = ({ picture, initial, size = "sm", ring = false }) => {
  const sz = size === "sm" ? "w-6 h-6" : "w-7 h-7";
  const inner = picture ? (
    <img src={picture} alt="ig" className="w-full h-full object-cover rounded-full" />
  ) : (
    <div className="w-full h-full bg-indigo-500 rounded-full flex items-center justify-center text-white text-[9px] font-bold">
      {initial || "A"}
    </div>
  );
  if (ring) {
    return (
      <div className={`${sz} rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-0.5 shrink-0`}>
        {inner}
      </div>
    );
  }
  return <div className={`${sz} rounded-full overflow-hidden shrink-0`}>{inner}</div>;
};

/* ══════════════════════════════════════════
   ROW 1 — 5 templates
══════════════════════════════════════════ */

/* 1. Facebook Feed */
const FacebookFeedCard = ({ mediaSrc, isVideo, fbName, fbInitial }) => (
  <CardWrapper>
    <div className="w-[176px] bg-white rounded border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      <div className="px-3 py-2 flex items-center gap-2 border-b border-gray-100">
        <FbAvatar initial={fbInitial} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-gray-900 leading-tight truncate">{fbName || "Your Page"}</p>
          <p className="text-[9px] text-gray-400">Ad · ✓</p>
        </div>
        <div className="flex items-center gap-1">
          <MoreHorizontal size={12} className="text-gray-400" />
          <X size={12} className="text-gray-400" />
        </div>
      </div>
      <div className="h-36 bg-gray-100"><CreativeImage mediaSrc={mediaSrc} isVideo={isVideo} /></div>
      <div className="px-3 py-2 flex items-center gap-3 border-t border-gray-100">
        <button className="flex items-center gap-1 text-[10px] text-gray-500"><ThumbsUp size={11} />Like</button>
        <button className="flex items-center gap-1 text-[10px] text-gray-500"><MessageCircle size={11} />Comment</button>
        <button className="flex items-center gap-1 text-[10px] text-gray-500"><Share2 size={11} />Share</button>
      </div>
    </div>
  </CardWrapper>
);

/* 2. Instagram Feed */
const InstagramFeedCard = ({ mediaSrc, isVideo, igPicture, igUsername, fbInitial }) => (
  <CardWrapper>
    <div className="w-[176px] bg-white rounded border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      <div className="px-3 py-2 flex items-center gap-2">
        <IgAvatar picture={igPicture} initial={fbInitial} size="sm" ring />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-gray-900 truncate">{igUsername || "your_account"}</p>
          <p className="text-[9px] text-gray-400">Ad</p>
        </div>
        <MoreHorizontal size={12} className="text-gray-400" />
      </div>
      <div className="h-36 bg-gray-100"><CreativeImage mediaSrc={mediaSrc} isVideo={isVideo} /></div>
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="flex gap-3">
          <Heart size={14} className="text-gray-700" />
          <MessageCircle size={14} className="text-gray-700" />
          <Repeat2 size={14} className="text-gray-700" />
          <Send size={14} className="text-gray-700" />
        </div>
        <Bookmark size={14} className="text-gray-700" />
      </div>
    </div>
  </CardWrapper>
);

/* 3. Instagram Stories */
const InstagramStoriesCard = ({ mediaSrc, isVideo, igPicture, igUsername, fbInitial }) => (
  <CardWrapper>
    <div className="w-[176px] h-[316px] bg-black rounded border border-gray-700 shadow-sm overflow-hidden relative">
      <CreativeImage mediaSrc={mediaSrc} isVideo={isVideo} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/30" />
      <div className="absolute top-2 left-2 right-2 flex gap-1">
        {[0.8, 0.2, 0, 0].map((fill, i) => (
          <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full" style={{ width: `${fill * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="absolute top-5 left-2 right-2 flex items-center gap-2">
        <IgAvatar picture={igPicture} initial={fbInitial} size="sm" ring />
        <div className="flex-1">
          <p className="text-[10px] text-white font-semibold leading-tight">{igUsername || "your_account"}</p>
          <p className="text-[8px] text-gray-300">Sponsored · 5s</p>
        </div>
        <X size={12} color="white" />
      </div>
      <div className="absolute bottom-3 left-0 right-0 flex justify-center">
        <span className="text-[9px] text-white bg-black/40 px-2 py-0.5 rounded-full">Ad</span>
      </div>
    </div>
  </CardWrapper>
);

/* 4. Facebook Stories */
const FacebookStoriesCard = ({ mediaSrc, isVideo, fbName, fbInitial }) => (
  <CardWrapper>
    <div className="w-[176px] h-[316px] bg-black rounded border border-gray-700 shadow-sm overflow-hidden relative">
      <CreativeImage mediaSrc={mediaSrc} isVideo={isVideo} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/40" />
      <div className="absolute top-2 left-2 right-2">
        <div className="flex gap-1 mb-2">
          {[0.6, 0.4].map((fill, i) => (
            <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full" style={{ width: `${fill * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <FbAvatar initial={fbInitial} size="sm" />
          <div className="flex-1">
            <p className="text-[10px] text-white font-semibold">{fbName || "Your Page"}</p>
            <p className="text-[8px] text-gray-300">Sponsored</p>
          </div>
          <X size={12} color="white" />
        </div>
      </div>
    </div>
  </CardWrapper>
);

/* 5. Instagram Explore */
const InstagramExploreCard = ({ mediaSrc, isVideo, igPicture, igUsername, fbInitial }) => (
  <CardWrapper>
    <div className="w-[176px] bg-white rounded border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
        <ChevronLeft size={14} className="text-gray-700" />
        <div className="flex-1 bg-gray-100 rounded-md px-2 py-1 flex items-center gap-1">
          <Search size={10} className="text-gray-400" />
          <span className="text-[9px] text-gray-400">Explore</span>
        </div>
      </div>
      <div className="px-3 py-2 flex items-center gap-2">
        <IgAvatar picture={igPicture} initial={fbInitial} size="sm" ring />
        <div className="flex-1">
          <p className="text-[11px] font-semibold text-gray-900 truncate">{igUsername || "your_account"}</p>
          <p className="text-[9px] text-gray-400">Ad</p>
        </div>
        <MoreHorizontal size={12} className="text-gray-400" />
      </div>
      <div className="h-36 bg-gray-100"><CreativeImage mediaSrc={mediaSrc} isVideo={isVideo} /></div>
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="flex gap-3">
          <Heart size={14} className="text-gray-700" />
          <MessageCircle size={14} className="text-gray-700" />
          <Repeat2 size={14} className="text-gray-700" />
          <Send size={14} className="text-gray-700" />
        </div>
        <Bookmark size={14} className="text-gray-700" />
      </div>
    </div>
  </CardWrapper>
);

/* ══════════════════════════════════════════
   ROW 2 — 5 templates
══════════════════════════════════════════ */

/* 6. Facebook Marketplace */
const FacebookMarketplaceCard = ({ mediaSrc, isVideo, fbName, fbInitial }) => (
  <CardWrapper>
    <div className="w-[176px] bg-white rounded border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      <div className="px-3 py-2 flex items-center gap-2 border-b border-gray-100">
        <FbAvatar initial={fbInitial} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-gray-900 truncate">{fbName || "Your Page"}</p>
          <p className="text-[9px] text-gray-400">Sponsored</p>
        </div>
        <MoreHorizontal size={12} className="text-gray-400" />
      </div>
      <div className="h-36 bg-gray-100"><CreativeImage mediaSrc={mediaSrc} isVideo={isVideo} /></div>
      <div className="px-3 py-2">
        <p className="text-[10px] font-semibold text-gray-800 truncate">{fbName || "Your Page"}</p>
        <p className="text-[9px] text-gray-400">Sponsored</p>
      </div>
    </div>
  </CardWrapper>
);

/* 7. Instagram Reels */
const InstagramReelsCard = ({ mediaSrc, isVideo, igPicture, igUsername, fbInitial }) => (
  <CardWrapper>
    <div className="w-[176px] h-[316px] bg-black rounded border border-gray-700 shadow-sm overflow-hidden relative">
      <CreativeImage mediaSrc={mediaSrc} isVideo={isVideo} />
      <div className="absolute inset-0 bg-black/10" />
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
        <span className="text-white text-[11px] font-bold">Reels</span>
        <Search size={14} className="text-white" />
      </div>
      <div className="absolute right-3 bottom-16 flex flex-col items-center gap-4 text-white">
        <div className="flex flex-col items-center gap-0.5"><Heart size={18} /><span className="text-[8px]">12K</span></div>
        <div className="flex flex-col items-center gap-0.5"><MessageCircle size={18} /><span className="text-[8px]">234</span></div>
        <Send size={18} />
        <MoreHorizontal size={18} />
      </div>
      <div className="absolute left-3 bottom-3 right-14">
        <div className="flex items-center gap-2 mb-1">
          <IgAvatar picture={igPicture} initial={fbInitial} size="sm" ring />
          <span className="text-white text-[10px] font-semibold truncate">{igUsername || "your_account"}</span>
          <span className="text-[8px] text-gray-300">· Follow</span>
        </div>
        <p className="text-[8px] text-gray-300">Ad</p>
      </div>
    </div>
  </CardWrapper>
);

/* 8. Facebook Reels */
const FacebookReelsCard = ({ mediaSrc, isVideo, fbName, fbInitial }) => (
  <CardWrapper>
    <div className="w-[176px] h-[316px] bg-black rounded border border-gray-700 shadow-sm overflow-hidden relative">
      <CreativeImage mediaSrc={mediaSrc} isVideo={isVideo} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />
      <div className="absolute top-0 left-0 right-0 px-3 py-2">
        <span className="text-white text-[11px] font-bold">Reels</span>
      </div>
      <div className="absolute right-3 bottom-20 flex flex-col items-center gap-3 text-white">
        <div className="flex flex-col items-center gap-0.5"><ThumbsUp size={16} /><span className="text-[8px]">Like</span></div>
        <div className="flex flex-col items-center gap-0.5"><MessageCircle size={16} /><span className="text-[8px]">Comment</span></div>
        <Share2 size={16} />
      </div>
      <div className="absolute bottom-0 left-0 right-0 px-3 py-3">
        <div className="flex items-center gap-2">
          <FbAvatar initial={fbInitial} size="sm" />
          <div>
            <p className="text-white text-[10px] font-semibold">{fbName || "Your Page"} ✓</p>
            <p className="text-gray-300 text-[8px]">Ad</p>
          </div>
        </div>
      </div>
      <div className="absolute top-2 right-3 w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
        <Edit3 size={10} color="white" />
      </div>
    </div>
  </CardWrapper>
);

/* 9. Ads on Facebook Reels */
const AdsFacebookReelsCard = ({ mediaSrc, isVideo, fbName, fbInitial }) => (
  <CardWrapper>
    <div className="w-[176px] bg-white rounded border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      <div className="h-36 bg-gray-300 relative flex items-center justify-center">
        <div className="w-10 h-10 rounded-full bg-gray-500/60 flex items-center justify-center"><Play size={16} color="white" /></div>
        <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-gray-400" />
        <div className="absolute top-2 left-10 w-12 h-1.5 bg-gray-400 rounded" />
      </div>
      <div className="mx-2 -mt-6 relative z-10 bg-white rounded shadow border border-gray-100 p-2 flex items-center gap-2 mb-1">
        <div className="h-10 w-10 bg-gray-100 rounded overflow-hidden relative shrink-0">
          <CreativeImage mediaSrc={mediaSrc} isVideo={isVideo} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-gray-800 truncate">{fbName || "Your Page"} · Ad</p>
          <MoreHorizontal size={10} className="text-gray-400" />
        </div>
        <X size={10} className="text-gray-400 shrink-0" />
      </div>
      <div className="px-3 pb-2 pt-1 flex items-center gap-3 border-t border-gray-100">
        <button className="flex items-center gap-1 text-[10px] text-gray-500"><ThumbsUp size={10} />Like</button>
        <button className="flex items-center gap-1 text-[10px] text-gray-500"><MessageCircle size={10} />Comment</button>
        <button className="flex items-center gap-1 text-[10px] text-gray-500"><Share2 size={10} />Share</button>
      </div>
    </div>
  </CardWrapper>
);

/* 10. Threads Feed */
const ThreadsFeedCard = ({ mediaSrc, isVideo, fbName, fbInitial }) => (
  <CardWrapper>
    <div className="w-[176px] bg-white rounded border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      <div className="px-3 py-2 flex items-center gap-2">
        <div className="flex flex-col items-center shrink-0">
          <FbAvatar initial={fbInitial} size="sm" />
          <div className="w-px h-8 bg-gray-200 mt-1" />
        </div>
        <div className="flex-1 min-w-0 pb-6">
          <p className="text-[11px] font-semibold text-gray-900 truncate">{fbName || "Your Page"}</p>
          <p className="text-[9px] text-gray-400">Ad · ✓</p>
        </div>
        <MoreHorizontal size={12} className="text-gray-400 self-start mt-1" />
      </div>
      <div className="mx-3 mb-2 h-36 bg-gray-100 rounded overflow-hidden">
        <CreativeImage mediaSrc={mediaSrc} isVideo={isVideo} />
      </div>
      <div className="px-3 pb-2 flex gap-3">
        <Heart size={13} className="text-gray-600" />
        <MessageCircle size={13} className="text-gray-600" />
        <Repeat2 size={13} className="text-gray-600" />
        <Send size={13} className="text-gray-600" />
      </div>
    </div>
  </CardWrapper>
);

/* ══════════════════════════════════════════
   ROW 3 — 4 templates
══════════════════════════════════════════ */

/* 11. Facebook Profile Feed */
const FacebookProfileFeedCard = ({ mediaSrc, isVideo, fbName, fbInitial }) => (
  <CardWrapper>
    <div className="w-[176px] bg-white rounded border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      <div className="px-3 py-2 flex items-center gap-2">
        <FbAvatar initial={fbInitial} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-gray-900 truncate">{fbName || "Your Page"}</p>
          <p className="text-[9px] text-gray-400">Ad · ✓</p>
        </div>
        <div className="flex items-center gap-1">
          <MoreHorizontal size={11} className="text-gray-400" />
          <X size={11} className="text-gray-400" />
        </div>
      </div>
      <div className="h-36 bg-gray-100"><CreativeImage mediaSrc={mediaSrc} isVideo={isVideo} /></div>
      <div className="px-3 py-2 flex items-center gap-3 border-t border-gray-100">
        <button className="flex items-center gap-1 text-[10px] text-gray-500"><ThumbsUp size={11} />Like</button>
        <button className="flex items-center gap-1 text-[10px] text-gray-500"><MessageCircle size={11} />Comment</button>
        <button className="flex items-center gap-1 text-[10px] text-gray-500"><Share2 size={11} />Share</button>
      </div>
    </div>
  </CardWrapper>
);

/* 12. Facebook In-stream Reels */
const FacebookInStreamReelsCard = ({ mediaSrc, isVideo, fbName, fbInitial }) => (
  <CardWrapper>
    <div className="w-[176px] bg-white rounded border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      <div className="px-3 py-2 flex items-center gap-2 border-b border-gray-100">
        <FbAvatar initial={fbInitial} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-gray-900 truncate">{fbName || "Your Page"}</p>
          <p className="text-[9px] text-blue-500">Sponsored ·</p>
        </div>
        <div className="flex items-center gap-1">
          <MoreHorizontal size={11} className="text-gray-400" />
          <X size={11} className="text-gray-400" />
        </div>
      </div>
      <div className="p-2 flex gap-2">
        <div className="h-14 w-14 bg-gray-100 rounded overflow-hidden relative shrink-0">
          <CreativeImage mediaSrc={mediaSrc} isVideo={isVideo} />
        </div>
        <div className="flex-1">
          <p className="text-[9px] text-gray-500 font-medium">Sponsored ·</p>
          <div className="h-1.5 bg-gray-200 rounded mt-1 w-full" />
          <div className="h-1.5 bg-gray-200 rounded mt-1 w-3/4" />
          <div className="h-1.5 bg-gray-200 rounded mt-1 w-1/2" />
        </div>
      </div>
      <div className="px-3 pb-2 flex items-center gap-3 border-t border-gray-100 pt-2">
        <button className="flex items-center gap-1 text-[10px] text-gray-500"><ThumbsUp size={11} />Like</button>
        <button className="flex items-center gap-1 text-[10px] text-gray-500"><MessageCircle size={11} />Comment</button>
        <button className="flex items-center gap-1 text-[10px] text-gray-500"><Share2 size={11} />Share</button>
      </div>
    </div>
  </CardWrapper>
);

/* 13. Instagram Profile Feed */
const InstagramProfileFeedCard = ({ mediaSrc, isVideo, igPicture, igUsername, fbInitial }) => (
  <CardWrapper>
    <div className="w-[176px] bg-white rounded border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="flex items-center gap-1">
          <IgAvatar picture={igPicture} initial={fbInitial} size="sm" ring />
          <p className="text-[9px] text-gray-500 truncate">{igUsername || "your_account"} · Ad</p>
          <MoreHorizontal size={10} className="text-gray-400 ml-auto" />
        </div>
      </div>
      <div className="h-36 bg-gray-100"><CreativeImage mediaSrc={mediaSrc} isVideo={isVideo} /></div>
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="flex gap-3">
          <Heart size={13} className="text-gray-700" />
          <MessageCircle size={13} className="text-gray-700" />
          <Repeat2 size={13} className="text-gray-700" />
          <Send size={13} className="text-gray-700" />
        </div>
        <Bookmark size={13} className="text-gray-700" />
      </div>
    </div>
  </CardWrapper>
);

/* 14. Facebook Search Results */
const FacebookSearchResultsCard = ({ mediaSrc, isVideo, fbName, fbInitial }) => (
  <CardWrapper>
    <div className="w-[176px] bg-white rounded border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
        <div className="flex-1 bg-gray-100 rounded-full px-2 py-1 flex items-center gap-1">
          <Search size={10} className="text-gray-400" />
          <span className="text-[9px] text-gray-400">Search Facebook</span>
        </div>
      </div>
      <div className="h-28 bg-gray-100"><CreativeImage mediaSrc={mediaSrc} isVideo={isVideo} /></div>
      <div className="px-3 py-2 flex items-start gap-2 border-b border-gray-100">
        <FbAvatar initial={fbInitial} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-gray-900 truncate">{fbName || "Your Page"}</p>
          <p className="text-[9px] text-gray-400">Sponsored</p>
        </div>
        <MoreHorizontal size={11} className="text-gray-400 shrink-0" />
      </div>
    </div>
  </CardWrapper>
);

/* ══════════════════════════════════════════
   PLACEMENT CONFIG
══════════════════════════════════════════ */
const ROW_1 = [
  { key: "facebook-feed",      title: "Facebook Feed",      platform: "facebook"  },
  { key: "instagram-feed",     title: "Instagram Feed",     platform: "instagram" },
  { key: "instagram-stories",  title: "Instagram Stories",  platform: "instagram" },
  { key: "facebook-stories",   title: "Facebook Stories",   platform: "facebook"  },
  { key: "instagram-explore",  title: "Instagram Explore",  platform: "instagram" },
];

const ROW_2 = [
  { key: "facebook-marketplace",   title: "Facebook Marketplace",    platform: "facebook"  },
  { key: "instagram-reels",        title: "Instagram Reels",         platform: "instagram" },
  { key: "facebook-reels",         title: "Facebook Reels",          platform: "facebook"  },
  { key: "ads-facebook-reels",     title: "Ads on Facebook Reels",   platform: "facebook"  },
  { key: "threads-feed",           title: "Threads feed",            platform: "threads"   },
];

const ROW_3 = [
  { key: "facebook-profile-feed",   title: "Facebook profile feed",   platform: "facebook"  },
  { key: "facebook-instream-reels", title: "Facebook in-stream reels",platform: "facebook"  },
  { key: "instagram-profile-feed",  title: "Instagram profile feed",  platform: "instagram" },
  { key: "facebook-search-results", title: "Facebook search results", platform: "facebook"  },
];

const CARD_MAP = {
  "facebook-feed":           FacebookFeedCard,
  "instagram-feed":          InstagramFeedCard,
  "instagram-stories":       InstagramStoriesCard,
  "facebook-stories":        FacebookStoriesCard,
  "instagram-explore":       InstagramExploreCard,
  "facebook-marketplace":    FacebookMarketplaceCard,
  "instagram-reels":         InstagramReelsCard,
  "facebook-reels":          FacebookReelsCard,
  "ads-facebook-reels":      AdsFacebookReelsCard,
  "threads-feed":            ThreadsFeedCard,
  "facebook-profile-feed":   FacebookProfileFeedCard,
  "facebook-instream-reels": FacebookInStreamReelsCard,
  "instagram-profile-feed":  InstagramProfileFeedCard,
  "facebook-search-results": FacebookSearchResultsCard,
};

/* ─── Platform Logo Badge ─── */
const PlatformBadge = ({ platform, title }) => (
  <div className="mb-2 flex items-center gap-1 text-[11px] text-gray-500 font-medium">
    {platform === "instagram" && (
      <Image src="/instalogo.webp" width={12} height={12} alt="Instagram" unoptimized />
    )}
    {platform === "facebook" && (
      <Image src="/fblogo.webp" width={12} height={12} alt="Facebook" unoptimized />
    )}
    {platform === "threads" && (
      <span className="text-[11px] font-bold text-gray-700">@</span>
    )}
    <span className="truncate">{title}</span>
    <MoreHorizontal size={11} className="text-gray-400 ml-auto shrink-0" />
  </div>
);

/* ══════════════════════════════════════════
   MAIN DRAWER
══════════════════════════════════════════ */
export default function MetaAdsDrawer({
  open,
  onClose,
  selectedImages = [],
  format,
  facebookPageName = "",
  facebookPageInitial = "A",
  instagramUsername = "",
  instagramPicture = "",
}) {
  const primaryMedia = selectedImages[0] || null;
  const mediaSrc = primaryMedia ? (primaryMedia.thumbnail || primaryMedia.url || null) : null;
  const isVideo = primaryMedia?.type === "video";

  // Props passed to every card
  const cardProps = {
    mediaSrc,
    isVideo,
    fbName: facebookPageName,
    fbInitial: facebookPageInitial || facebookPageName?.charAt(0) || "A",
    igUsername: instagramUsername,
    igPicture: instagramPicture,
  };

  const renderRow = (row) =>
    row.map((p) => {
      const CardComponent = CARD_MAP[p.key];
      return (
        <div key={p.key} className="flex flex-col" style={{ width: "200px" }}>
          <PlatformBadge platform={p.platform} title={p.title} />
          {CardComponent ? <CardComponent {...cardProps} /> : null}
        </div>
      );
    });

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      )}
      <div
        className={`fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 transition-transform duration-300 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ height: "100vh" }}
      >
        <div className="h-full flex flex-col">
          <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between shrink-0">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Advanced preview</h2>
              <p className="text-xs text-gray-500 mt-0.5 max-w-xl">
                Review how your ad will appear on different placements. We'll show one variation per impression based on predicted performance.
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors shrink-0">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50 px-10 py-6 space-y-8">
            <div><div className="flex flex-wrap gap-8 pb-2">{renderRow(ROW_1)}</div></div>
            <div className="border-t border-gray-200" />
            <div><div className="flex flex-wrap gap-8 pb-2">{renderRow(ROW_2)}</div></div>
            <div className="border-t border-gray-200" />
            <div><div className="flex flex-wrap gap-8 pb-2">{renderRow(ROW_3)}</div></div>
          </div>
        </div>
      </div>
    </>
  );
}