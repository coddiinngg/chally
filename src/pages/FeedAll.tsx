import React, { useEffect, useState, useRef, useLayoutEffect } from "react";
import { ArrowLeft, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { VERIFY_TYPES, type VerifyTypeKey } from "../lib/verifyTypes";
import { formatActivityTime, loadActivityFeed, reactionCache, type ActivityFeedItem } from "../lib/activity";
import { useScrollRestoration } from "../lib/useScrollRestoration";
import { supabase } from "../lib/supabase";

let feedCache: ActivityFeedItem[] | null = null;
let feedCacheTime = 0;
const FEED_CACHE_TTL = 60_000;

export function invalidateFeedCache() {
  feedCache = null;
  feedCacheTime = 0;
}

const REACTIONS = ["❤️", "🔥", "👍", "😂", "😮", "🎉"];

// ── 3열 그리드 카드 ──
function FeedGridCard({ item, onClick }: { item: ActivityFeedItem; onClick: () => void }) {
  const vt = VERIFY_TYPES[(item.verify_type as VerifyTypeKey) ?? "step_walk"] ?? VERIFY_TYPES.step_walk;
  return (
    <div
      className="relative aspect-square rounded-xl overflow-hidden cursor-pointer active:scale-[0.97] transition-transform border border-black/[0.04] dark:border-white/[0.07]"
      onClick={onClick}
    >
      {item.photo_url ? (
        <img src={item.photo_url} alt={item.message} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${vt.bgGrad[0]}, ${vt.bgGrad[1]})` }} />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
      <div className="absolute top-1.5 right-1.5 bg-black/30 backdrop-blur-sm px-1 py-0.5 rounded-full">
        <span className="text-[9px]">{vt.emoji}</span>
      </div>
      <div className="absolute bottom-0 left-0 right-0 px-2 pb-1.5">
        <img
          src={item.author_avatar_url ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.user_id}`}
          alt={item.author_name ?? ""}
          className="w-4 h-4 rounded-md bg-white/20 object-cover mb-0.5"
        />
        <p className="text-white text-[9px] font-black truncate leading-none">{item.author_name ?? "챌리 유저"}</p>
      </div>
    </div>
  );
}

// ── 세로 스크롤 뷰어 (홈 피드뷰어와 동일한 UX) ──
function FeedViewerOverlay({
  items,
  startIdx,
  userId,
  onClose,
}: {
  items: ActivityFeedItem[];
  startIdx: number;
  userId: string | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [reactionsMap, setReactionsMap] = useState<Record<string, { emoji: string | null; count: number }>>(() => {
    const map: Record<string, { emoji: string | null; count: number }> = {};
    items.forEach(item => {
      const cached = reactionCache.get(item.id);
      map[item.id] = {
        emoji: (cached?.myReaction as string | null) ?? (item.myReaction as string | null) ?? null,
        count: cached?.count ?? item.reactionCount ?? 0,
      };
    });
    return map;
  });
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  useLayoutEffect(() => {
    const target = itemRefs.current[startIdx];
    if (target) target.scrollIntoView({ block: "start" });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleReact(postId: string, emoji: string) {
    if (!userId) { navigate("/login"); return; }
    const prev = reactionsMap[postId] ?? { emoji: null, count: 0 };
    const isSame = prev.emoji === emoji;
    const nextEmoji = isSame ? null : emoji;
    const nextCount = isSame ? Math.max(0, prev.count - 1) : (prev.emoji ? prev.count : prev.count + 1);
    setReactionsMap(m => ({ ...m, [postId]: { emoji: nextEmoji, count: nextCount } }));
    reactionCache.set(postId, { count: nextCount, myReaction: nextEmoji });
    setPickerFor(null);
    const mutation = nextEmoji
      ? supabase.from("activity_reactions").upsert({ activity_post_id: postId, user_id: userId, emoji: nextEmoji as "❤️" | "🔥" | "👍" | "😂" | "😮" | "🎉" })
      : supabase.from("activity_reactions").delete().eq("activity_post_id", postId).eq("user_id", userId);
    const { error } = await mutation;
    if (error) {
      setReactionsMap(m => ({ ...m, [postId]: prev }));
      reactionCache.set(postId, { count: prev.count, myReaction: prev.emoji });
    }
  }

  return (
    <div
      className="fixed inset-0 bg-white dark:bg-black z-50"
      style={{ animation: "fvall-in 0.2s ease both" }}
      onClick={() => pickerFor && setPickerFor(null)}
    >
      <style>{`
        @keyframes fvall-in { from{opacity:0} to{opacity:1} }
        @keyframes fvall-picker { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <button
        onClick={onClose}
        className="fixed top-4 left-4 w-10 h-10 rounded-full flex items-center justify-center z-[51] bg-black/10 dark:bg-black/50 border border-black/10 dark:border-white/15 active:scale-90 transition-transform"
        style={{ backdropFilter: "blur(8px)" }}
      >
        <ArrowLeft className="w-5 h-5 text-slate-800 dark:text-white" />
      </button>

      <div ref={scrollRef} className="h-full overflow-y-scroll no-scrollbar" style={{ scrollBehavior: "auto" }}>
        {items.map((item, idx) => {
          const postId = item.id;
          const rxState = reactionsMap[postId] ?? { emoji: null, count: 0 };
          const isPickerOpen = pickerFor === postId;
          const vt = VERIFY_TYPES[(item.verify_type as VerifyTypeKey) ?? "step_walk"] ?? VERIFY_TYPES.step_walk;
          return (
            <div key={item.id} ref={el => { itemRefs.current[idx] = el; }} className="w-full flex flex-col">
              {/* 유저 정보 */}
              <div
                className="shrink-0 flex items-center gap-3 px-5 bg-white dark:bg-[#0d0d0d] border-b border-black/[0.06] dark:border-white/[0.06]"
                style={{ height: 64 }}
              >
                <button
                  className="flex items-center gap-3 active:opacity-70 transition-opacity"
                  onClick={() => navigate(`/user/${item.user_id}`)}
                >
                  <img
                    src={item.author_avatar_url ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.user_id}`}
                    alt={item.author_name ?? ""}
                    className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/10 object-cover shrink-0 border border-black/10 dark:border-white/15"
                    draggable={false}
                  />
                  <div className="text-left">
                    <p className="text-slate-900 dark:text-white font-black text-[14px] leading-tight">{item.author_name ?? "챌리 유저"}</p>
                    <p className="text-slate-400 dark:text-white/40 text-[11px] leading-none mt-0.5">{formatActivityTime(item.created_at)}</p>
                  </div>
                </button>
                <div className="ml-auto shrink-0">
                  <span className="text-[14px]">{vt.emoji}</span>
                </div>
              </div>

              {/* 사진 */}
              <div className="w-full flex items-center justify-center bg-slate-100 dark:bg-black">
                {item.photo_url ? (
                  <img
                    src={item.photo_url}
                    alt={item.message}
                    style={{ display: "block", width: "100%", height: "auto", maxHeight: "80dvh", objectFit: "contain" }}
                    referrerPolicy="no-referrer"
                    draggable={false}
                  />
                ) : (
                  <div style={{ width: "100%", aspectRatio: "1", background: `linear-gradient(135deg, ${vt.bgGrad[0]}, ${vt.bgGrad[1]})` }} />
                )}
              </div>

              {/* 캡션 */}
              {item.message && (
                <div className="px-5 py-3 bg-white dark:bg-[#0d0d0d] border-t border-black/[0.04] dark:border-white/[0.04]">
                  <p className="text-slate-700 dark:text-white/75 text-[13px] leading-relaxed">{item.message}</p>
                </div>
              )}

              {/* 반응 */}
              <div
                className="shrink-0 flex items-center justify-center relative bg-white dark:bg-[#0d0d0d] border-t border-black/[0.06] dark:border-white/[0.06]"
                style={{ height: 64 }}
                onClick={e => e.stopPropagation()}
              >
                {isPickerOpen && (
                  <div
                    className="absolute bottom-full mb-1 flex gap-1 rounded-2xl px-2 py-1.5 bg-slate-100 dark:bg-[#1e1e1e] border border-black/10 dark:border-white/10"
                    style={{ animation: "fvall-picker 0.15s ease both" }}
                  >
                    {REACTIONS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => void handleReact(postId, emoji)}
                        className={`w-10 h-10 flex items-center justify-center text-[22px] rounded-xl active:scale-90 transition-transform ${rxState.emoji === emoji ? "bg-black/[0.08] dark:bg-white/[0.12]" : ""}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setPickerFor(isPickerOpen ? null : postId)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full active:scale-95 transition-all border ${rxState.emoji ? "border-[#FF3355]/40 bg-[#FF3355]/[0.15]" : "border-black/10 dark:border-white/[0.12] bg-black/[0.06] dark:bg-white/[0.07]"}`}
                >
                  <span className="text-[20px] leading-none">{rxState.emoji ?? "👍"}</span>
                  <span className="text-slate-800 dark:text-white font-black text-[14px] tabular-nums">{rxState.count}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FeedAll() {
  const navigate = useNavigate();
  const { user } = useAuth();
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
