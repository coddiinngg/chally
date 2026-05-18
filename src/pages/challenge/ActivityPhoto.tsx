import { useState, useRef } from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { reactionCache, type ActivityEmoji } from "../../lib/activity";

interface ActivityPhotoState {
  postId?: string;
  userId?: string;
  imgSrc?: string;
  grad: [string, string];
  name: string;
  seed: string;
  time: string;
  msg: string;
  type: string;
  reactionCount?: number;
  myReaction?: string | null;
  avatarUrl?: string | null;
  canReact?: boolean;
}

const REACTIONS: ActivityEmoji[] = ["❤️", "🔥", "👍", "😂", "😮", "🎉"];

export function ActivityPhoto() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { state } = useLocation() as { state: ActivityPhotoState | null };

  const [liked, setLiked]           = useState<ActivityEmoji | null>((state?.myReaction as ActivityEmoji | null | undefined) ?? null);
  const [likeCount, setLikeCount]   = useState(state?.reactionCount ?? 0);
  const [showPicker, setShowPicker] = useState(false);
  const [noPostToast, setNoPostToast] = useState(false);
  const [blockedToast, setBlockedToast] = useState(false);
  const noPostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!state) {
    navigate(-1);
    return null;
  }

  const { postId, userId, imgSrc, grad, name, seed, time, msg, avatarUrl } = state;
  const canReact = state.canReact !== false;

  function showBlocked() {
    setShowPicker(false);
    setBlockedToast(true);
    if (blockedTimerRef.current) clearTimeout(blockedTimerRef.current);
    blockedTimerRef.current = setTimeout(() => setBlockedToast(false), 2500);
  }

  async function handleReact(emoji: ActivityEmoji) {
    if (!canReact) { showBlocked(); return; }
    if (!postId) {
      setShowPicker(false);
      setNoPostToast(true);
      if (noPostTimerRef.current) clearTimeout(noPostTimerRef.current);
      noPostTimerRef.current = setTimeout(() => setNoPostToast(false), 2500);
      return;
    }
    if (!user) { navigate("/login"); return; }

    const prevLiked = liked;
    const prevCount = likeCount;

    if (liked === emoji) {
      const nextCount = Math.max(0, likeCount - 1);
      setLiked(null);
      setLikeCount(nextCount);
      reactionCache.set(postId, { count: nextCount, myReaction: null });
      const { error } = await supabase
        .from("activity_reactions")
        .delete()
        .eq("activity_post_id", postId)
        .eq("user_id", user.id);
      if (error) { setLiked(prevLiked); setLikeCount(prevCount); reactionCache.set(postId, { count: prevCount, myReaction: prevLiked }); }
    } else {
      const nextCount = liked ? likeCount : likeCount + 1;
      setLiked(emoji);
      setLikeCount(nextCount);
      reactionCache.set(postId, { count: nextCount, myReaction: emoji });
      const { error } = await supabase
        .from("activity_reactions")
        .upsert({ activity_post_id: postId, user_id: user.id, emoji });
      if (error) { setLiked(prevLiked); setLikeCount(prevCount); reactionCache.set(postId, { count: prevCount, myReaction: prevLiked }); }
    }
    setShowPicker(false);
  }

  return (
    <div
      className="flex flex-col h-full bg-black overflow-hidden relative"
      onClick={() => showPicker && setShowPicker(false)}
    >
      {/* 배경 이미지 또는 그라데이션 — 오버레이 없음 */}
      <div className="absolute inset-0">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={msg}
            className="w-full h-full object-contain"
            referrerPolicy="no-referrer"
            draggable={false}
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: `linear-gradient(135deg, ${grad[0]}, ${grad[1]})` }}
          />
        )}
        {/* 하단 텍스트 가독성용 약한 그라데이션만 */}
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{ height: 220, background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)" }}
        />
      </div>

      {/* 상단 뒤로가기 */}
      <div className="relative z-10 flex items-center px-4 pt-4 pb-2 shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-sm active:bg-black/50 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* 하단 정보 */}
      <div className="relative z-10 mt-auto shrink-0 px-5 pb-10 pt-6">
        {/* 유저 정보 + 이모지 버튼 (같은 행, 좌우 배치) */}
        <div className="flex items-end justify-between mb-2.5">
          {/* 유저 정보 */}
          <button
            className="flex items-center gap-2.5 active:opacity-70 transition-opacity"
            onClick={() => navigate(`/user/${userId ?? seed}`)}
          >
            <img
              src={avatarUrl ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`}
              alt={name}
              className="w-10 h-10 rounded-full border-2 border-white/40 bg-white/10 shrink-0"
              draggable={false}
            />
            <div className="text-left">
              <p className="text-white font-black text-[15px] leading-tight">{name}</p>
              <p className="text-white/55 text-[12px]">{time}</p>
            </div>
          </button>

          {/* 이모지 버튼 — 맨 오른쪽 */}
          <div className="relative" onClick={e => e.stopPropagation()}>
            {showPicker && (
              <div
                className="absolute bottom-full right-0 mb-2 flex gap-1 bg-black/65 backdrop-blur-md rounded-2xl px-2 py-1.5 border border-white/15"
                style={{ animation: "ap-up 0.15s ease both" }}
              >
                {REACTIONS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => handleReact(emoji)}
                    className="w-9 h-9 flex items-center justify-center text-[20px] rounded-xl active:scale-90 transition-transform"
                    style={{ background: liked === emoji ? "rgba(255,255,255,0.25)" : "transparent" }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => canReact ? setShowPicker(v => !v) : showBlocked()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl transition-all active:scale-95"
              style={{
                background: liked ? "rgba(255,51,85,0.5)" : "rgba(255,255,255,0.15)",
                backdropFilter: "blur(8px)",
                border: liked ? "1px solid rgba(255,51,85,0.6)" : "1px solid rgba(255,255,255,0.2)",
                opacity: canReact ? 1 : 0.55,
              }}
            >
              <span className="text-[20px] leading-none">{liked ?? "👍"}</span>
              <span className="text-white font-black text-[14px] tabular-nums">{likeCount}</span>
            </button>
          </div>
        </div>

        {/* 메시지 */}
        <p className="text-white/90 text-[14px] leading-relaxed font-medium">{msg}</p>
      </div>

      {noPostToast && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-2xl text-white text-[13px] font-semibold pointer-events-none whitespace-nowrap z-50"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", animation: "ap-up 0.2s ease both" }}>
          리액션을 남길 수 없는 게시물이에요
        </div>
      )}

      {blockedToast && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-2xl text-white text-[13px] font-semibold pointer-events-none whitespace-nowrap z-50"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", animation: "ap-up 0.2s ease both" }}>
          그룹에서 나간 상태라 리액션을 남길 수 없어요
        </div>
      )}

      <style>{`
        @keyframes ap-up { from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);} }
      `}</style>
    </div>
  );
}
