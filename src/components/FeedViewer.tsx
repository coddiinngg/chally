import { useState, useRef, useLayoutEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { VERIFY_TYPES, type VerifyTypeKey } from "../lib/verifyTypes";
import { formatActivityTime, reactionCache, type ActivityFeedItem } from "../lib/activity";
import { supabase } from "../lib/supabase";

const REACTIONS = ["❤️", "🔥", "👍", "😂", "😮", "🎉"];

// ── 3열 그리드 카드 ──
export function FeedGridCard({ item, onClick }: { item: ActivityFeedItem; onClick: () => void }) {
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

// ── 세로 스크롤 뷰어 ──
export function FeedViewerOverlay({
  items,
  startIdx,
  userId,
  onClose,
  canReact = true,
}: {
  items: ActivityFeedItem[];
  startIdx: number;
  userId: string | null;
  onClose: () => void;
  canReact?: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 작성자 프로필로 이동: 현재 history 항목에 뷰어 복원 정보를 남겨, 프로필에서 뒤로가기 시 이 뷰어로 정확히 복귀하도록 한다.
  function goToAuthor(idx: number, authorId: string) {
    navigate(location.pathname + location.search, {
      replace: true,
      state: { ...(location.state as Record<string, unknown> | null), reopenViewerIdx: idx },
    });
    navigate(`/user/${authorId}`);
  }

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
    if (!canReact) return;
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

              {/* 유저 정보 + 태그 (사진 바로 아래) */}
              <div className="px-4 py-2.5 bg-white dark:bg-[#0d0d0d]">
                <div className="flex items-center gap-2.5">
                  <button
                    className="shrink-0 active:opacity-70 transition-opacity"
                    onClick={() => goToAuthor(idx, item.user_id)}
                  >
                    <img
                      src={item.author_avatar_url ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.user_id}`}
                      alt={item.author_name ?? ""}
                      className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-white/10 object-cover border border-black/10 dark:border-white/15"
                      draggable={false}
                    />
                  </button>

                  <div className="flex-1 min-w-0">
                    {/* 이름 + 시간 */}
                    <button
                      className="flex items-baseline gap-1.5 min-w-0 active:opacity-70 transition-opacity"
                      onClick={() => goToAuthor(idx, item.user_id)}
                    >
                      <span className="text-slate-900 dark:text-white font-black text-[14px] leading-tight truncate">{item.author_name ?? "챌리 유저"}</span>
                      <span className="text-slate-400 dark:text-white/40 text-[11px] shrink-0">{formatActivityTime(item.created_at)}</span>
                    </button>

                    {/* 태그 (이름 바로 아래) */}
                    <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.08] text-slate-600 dark:text-white/70 text-[11px] font-bold max-w-full">
                      <span className="text-[12px] leading-none">{vt.emoji}</span>
                      <span className="truncate">{vt.label}</span>
                    </span>
                  </div>

                  {/* 반응 (사용자 사진 줄 기준 세로 중앙) */}
                  <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
                    {isPickerOpen && (
                      <div
                        className="absolute bottom-full right-0 mb-1 flex gap-1 rounded-2xl px-2 py-1.5 bg-slate-100 dark:bg-[#1e1e1e] border border-black/10 dark:border-white/10"
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
                      onClick={() => { if (canReact) setPickerFor(isPickerOpen ? null : postId); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all border ${canReact ? "active:scale-95" : "opacity-60"} ${rxState.emoji ? "border-[#FF3355]/40 bg-[#FF3355]/[0.15]" : "border-black/10 dark:border-white/[0.12] bg-black/[0.06] dark:bg-white/[0.07]"}`}
                    >
                      <span className="text-[17px] leading-none">{rxState.emoji ?? "👍"}</span>
                      <span className="text-slate-800 dark:text-white font-black text-[14px] tabular-nums">{rxState.count}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 카드 구분 간격 */}
              <div className="h-2.5 bg-slate-100 dark:bg-white/[0.06]" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
