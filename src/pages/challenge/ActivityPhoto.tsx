import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate, useLocation, useParams } from "react-router-dom";

interface ActivityPhotoState {
  imgSrc?: string;
  grad: [string, string];
  name: string;
  seed: string;
  time: string;
  msg: string;
  type: string;
}

const REACTIONS = ["❤️", "🔥", "👍", "😮", "🎉"];

export function ActivityPhoto() {
  const navigate = useNavigate();
  const { groupId } = useParams<{ groupId: string }>();
  const { state } = useLocation() as { state: ActivityPhotoState | null };

  const [liked, setLiked]           = useState<string | null>(null);
  const [likeCount, setLikeCount]   = useState(Math.floor(Math.random() * 20) + 3);
  const [showPicker, setShowPicker] = useState(false);

  if (!state) {
    navigate(-1);
    return null;
  }

  const { imgSrc, grad, name, seed, time, msg } = state;

  function handleReact(emoji: string) {
    if (liked === emoji) {
      setLiked(null);
      setLikeCount(c => c - 1);
    } else {
      if (!liked) setLikeCount(c => c + 1);
      setLiked(emoji);
    }
    setShowPicker(false);
  }

  return (
    <div className="flex flex-col h-full bg-black overflow-hidden relative">
      {/* 배경 이미지 또는 그라데이션 */}
      <div className="absolute inset-0">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={msg}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            draggable={false}
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: `linear-gradient(135deg, ${grad[0]}, ${grad[1]})` }}
          />
        )}
        {/* 상단 페이드 */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/80" />
      </div>

      {/* 상단 네비 */}
      <div className="relative z-10 flex items-center px-4 pt-5 pb-2 shrink-0">
        <button
          onClick={() => {
            if (!groupId || groupId === "feed") { navigate(-1); return; }
            navigate(`/challenge/group/${groupId}`, {
              replace: true,
              state: { tab: "activity", skipAnimation: true, fromActivityPhoto: true },
            });
          }}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-sm active:bg-black/50 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* 하단 정보 영역 */}
      <div className="relative z-10 mt-auto shrink-0 px-5 pb-10">
        {/* 유저 정보 */}
        <button
          className="flex items-center gap-2.5 mb-3 active:opacity-70 transition-opacity"
          onClick={() => navigate(`/user/${seed}`)}
        >
          <img
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`}
            alt={name}
            className="w-10 h-10 rounded-full border-2 border-white/40 bg-white/10 shrink-0"
            draggable={false}
          />
          <div className="text-left">
            <p className="text-white font-black text-[15px] leading-tight">{name}</p>
            <p className="text-white/50 text-[12px]">{time}</p>
          </div>
        </button>

        {/* 메시지 */}
        <p className="text-white text-[15px] leading-relaxed font-medium mb-5">{msg}</p>

        {/* 반응 영역 */}
        <div className="flex items-center gap-3">
          {/* 반응 피커 토글 버튼 */}
          <div className="relative">
            {showPicker && (
              <div
                className="absolute bottom-full mb-2 left-0 flex gap-1 bg-white/15 backdrop-blur-md rounded-2xl px-2 py-1.5 border border-white/20"
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
              onClick={() => setShowPicker(v => !v)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl transition-all active:scale-95"
              style={{
                background: liked ? "rgba(255,51,85,0.4)" : "rgba(255,255,255,0.15)",
                backdropFilter: "blur(8px)",
                border: liked ? "1px solid rgba(255,51,85,0.5)" : "1px solid rgba(255,255,255,0.2)",
              }}
            >
              <span className="text-[20px] leading-none">{liked ?? "👍"}</span>
              <span className="text-white font-black text-[14px] tabular-nums">{likeCount}</span>
            </button>
          </div>

          {/* 현재 선택된 반응 표시 (있을 때) */}
          {liked && (
            <p className="text-white/60 text-[12px] font-medium">
              내가 반응했어요
            </p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes ap-up { from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);} }
      `}</style>
    </div>
  );
}
