import React, { useEffect, useState, useRef } from "react";
import { ArrowLeft, Zap } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { loadActivityFeed, type ActivityFeedItem } from "../lib/activity";
import { useScrollRestoration } from "../lib/useScrollRestoration";
import { FeedGridCard, FeedViewerOverlay } from "../components/FeedViewer";

let feedCache: ActivityFeedItem[] | null = null;
let feedCacheTime = 0;
const FEED_CACHE_TTL = 60_000;

export function invalidateFeedCache() {
  feedCache = null;
  feedCacheTime = 0;
}

export function FeedAll() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const viewerRestoredRef = useRef(false);
  const [items, setItems] = useState<ActivityFeedItem[]>(() =>
    feedCache !== null && Date.now() - feedCacheTime < FEED_CACHE_TTL ? feedCache! : []
  );
  const [loading, setLoading] = useState(() =>
    !(feedCache !== null && Date.now() - feedCacheTime < FEED_CACHE_TTL)
  );
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIdx, setViewerIdx] = useState(0);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  useScrollRestoration("fd-scroll", mainScrollRef, !loading);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const valid = feedCache !== null && Date.now() - feedCacheTime < FEED_CACHE_TTL;
      if (valid) {
        if (!cancelled) { setItems(feedCache!); setLoading(false); }
        return;
      }
      setLoading(true);
      try {
        const posts = await loadActivityFeed({ userId: user?.id ?? null, limit: 100 });
        feedCache = posts;
        feedCacheTime = Date.now();
        if (!cancelled) setItems(posts);
      } catch (error) {
        console.error("Failed to load feed", error);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [user?.id]);

  // 프로필에서 뒤로가기로 돌아왔을 때, 보던 뷰어를 같은 사진으로 복원 (items 준비 후 한 번만)
  useEffect(() => {
    if (viewerRestoredRef.current || items.length === 0) return;
    const st = location.state as { reopenViewerIdx?: number } | null;
    if (st && typeof st.reopenViewerIdx === "number") {
      viewerRestoredRef.current = true;
      setViewerIdx(st.reopenViewerIdx);
      setViewerOpen(true);
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
  }, [items, location, navigate]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#090B10]">
      {/* 헤더 */}
      <header className="shrink-0 bg-white dark:bg-[#090B10] px-4 pt-3 pb-2.5 border-b border-slate-100 dark:border-white/[0.06]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 dark:bg-white/[0.07] active:bg-slate-200 dark:active:bg-white/[0.12] transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#FF3355,#CC0030)" }}>
              <Zap className="w-3.5 h-3.5 text-white fill-white" />
            </div>
            <h1 className="text-[20px] font-black text-slate-900 dark:text-white tracking-tight">실시간 인증 피드</h1>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>
      </header>

      {/* 3열 그리드 */}
      <div ref={mainScrollRef} className="flex-1 overflow-y-auto no-scrollbar px-3 pt-3 pb-6">
        {loading && items.length === 0 && (
          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: 18 }, (_, i) => (
              <div key={i} className="aspect-square rounded-xl bg-slate-100 dark:bg-white/[0.06] animate-pulse" />
            ))}
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-[14px] font-black text-slate-500 dark:text-slate-400">아직 인증 피드가 없어요</p>
            <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-1">첫 그룹 인증을 완료하면 여기에 표시돼요.</p>
          </div>
        )}
        {items.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5">
            {items.map((item, i) => (
              <React.Fragment key={item.id}>
                <FeedGridCard
                  item={item}
                  onClick={() => { setViewerIdx(i); setViewerOpen(true); }}
                />
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* 세로 스크롤 뷰어 */}
      {viewerOpen && (
        <FeedViewerOverlay
          items={items}
          startIdx={viewerIdx}
          userId={user?.id ?? null}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </div>
  );
}
