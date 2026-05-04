import React, { useState, useEffect } from "react";
import { Share2, ArrowRight } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useApp } from "../contexts/AppContext";
import { VERIFY_TYPES, type VerifyTypeKey } from "../lib/verifyTypes";
import { shareOrCopy } from "../lib/share";
import { ShareCard } from "./verify/ShareCard";

const CONFETTI_COLORS = ["#FF3355", "#ff6680", "#ffb3c0", "#f97316", "#fbbf24", "#34d399", "#a78bfa"];

interface Dot {
  x: number; size: number; color: string; delay: number; drift: number;
}

function Confetti({ dots }: { dots: Dot[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {dots.map((d, i) => (
        <div
          key={i}
          className="absolute rounded-sm"
          style={{
            left: `${d.x}%`, top: `-${d.size}px`,
            width: d.size, height: d.size * 1.4,
            background: d.color,
            animation: `confettiFall 2.8s ease-in ${d.delay}ms both`,
            transform: `rotate(${d.drift}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export function Success() {
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyType, verificationImageUrl, groups, completeCurrentVerification } = useApp();
  const serverPhotoUrl = (location.state as { photoUrl?: string | null } | null)?.photoUrl;
  const [mounted, setMounted] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "shared" | "copied">("idle");
  const [showShareCard, setShowShareCard] = useState(false);

  // completeCurrentVerification()이 clearVerification()을 호출해 verifyType이 null이 되므로
  // 마운트 시점의 값을 미리 캡처
  const [capturedKey] = useState<VerifyTypeKey>(() => (verifyType as VerifyTypeKey) ?? "step_walk");
  const [capturedImageUrl] = useState<string | null>(() => verificationImageUrl);
  const [capturedGroup] = useState(() => groups.find(g => g.verifyType === ((verifyType as VerifyTypeKey) ?? "step_walk")) ?? null);

  const vt = VERIFY_TYPES[capturedKey];

  // 로컬 상태 완료 처리 (한 번만) — DB 저장은 Edge Function이 이미 완료
  useEffect(() => {
    completeCurrentVerification(serverPhotoUrl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const [dots] = useState<Dot[]>(() =>
    Array.from({ length: 32 }, () => ({
      x: Math.random() * 100,
      size: 4 + Math.random() * 8,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      delay: Math.random() * 900,
      drift: -30 + Math.random() * 60,
    }))
  );

  const slide = (delay: number): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(18px)",
    transition: `opacity 0.5s ease ${delay}ms, transform 0.5s cubic-bezier(0.4,0,0.2,1) ${delay}ms`,
  });

  const pop = (delay: number): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "scale(1)" : "scale(0.6)",
    transition: `opacity 0.5s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms, transform 0.5s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms`,
  });

  async function shareVerification() {
    const status = await shareOrCopy({
      title: "챌리 인증 완료",
      text: `${vt.emoji} ${capturedGroup?.title ?? vt.label} 챌린지를 완료했어요!`,
      url: serverPhotoUrl ?? window.location.origin,
    });
    setShareState(status);
    setTimeout(() => setShareState("idle"), 1800);
  }

  return (
    <>
    <div className="flex flex-col h-full bg-[#F5F6FA] relative overflow-hidden">
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes suc-bounce {
          0%   { transform: scale(0.3); opacity: 0; }
          55%  { transform: scale(1.15); }
          70%  { transform: scale(0.93); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes suc-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,51,85,0.3); }
          50%       { box-shadow: 0 0 0 18px rgba(255,51,85,0); }
        }
      `}</style>

      <Confetti dots={dots} />

      {/* 닫기 */}
      <button
        onClick={() => navigate("/")}
        className="absolute top-12 right-4 z-20 w-10 h-10 rounded-full bg-black/10 flex items-center justify-center text-slate-500 active:scale-90 transition-all text-lg"
      >
        ✕
      </button>

      <div className="flex-1 overflow-y-auto pt-14 pb-4 px-6 relative z-10 flex flex-col items-center">

        {/* ── 체크 아이콘 ── */}
        <div className="mb-5" style={pop(80)}>
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: "rgba(255,51,85,0.12)",
                transform: "scale(1.4)",
                animation: mounted ? "suc-glow 2s ease-in-out infinite 0.5s" : "none",
              }}
            />
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-[44px] relative z-10"
              style={{
                background: "linear-gradient(135deg,#FF3355,#FF6680)",
                boxShadow: "0 16px 40px -8px rgba(255,51,85,0.4)",
                animation: mounted ? "suc-bounce 0.6s cubic-bezier(0.34,1.56,0.64,1) 80ms both" : "none",
              }}
            >
              {vt.emoji}
            </div>
            <div className="absolute -top-1 -right-1 text-xl" style={{ animation: mounted ? "suc-bounce 0.5s ease 350ms both" : "none" }}>🎉</div>
            <div className="absolute -bottom-1 -left-1 text-lg" style={{ animation: mounted ? "suc-bounce 0.5s ease 450ms both" : "none" }}>✨</div>
          </div>
        </div>

        {/* ── 헤드라인 ── */}
        <div className="text-center mb-5" style={slide(220)}>
          <h1 className="text-[30px] font-black text-slate-900 leading-tight mb-1.5">
            인증 완료! 🔥
          </h1>
          <p className="text-slate-500 text-[14px] leading-relaxed">
            <span className="font-bold text-slate-700">"{capturedGroup?.title ?? vt.label}"</span> 챌린지 달성!<br />
            꾸준함이 습관을 만듭니다.
          </p>
        </div>

        {/* ── 인증 사진 (있을 때만) — 탭하면 공유 카드 열림 ── */}
        {capturedImageUrl && (
          <div className="w-full max-w-sm mb-4" style={slide(300)}>
            <button
              className="relative rounded-2xl overflow-hidden aspect-[4/3] w-full active:scale-[0.98] transition-transform"
              onClick={() => setShowShareCard(true)}
            >
              <img
                src={capturedImageUrl}
                alt="인증 사진"
                className="w-full h-full object-cover"
              />
              {/* 오버레이 배지 */}
              <div
                className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{ background: "linear-gradient(135deg,#FF3355,#FF6680)", boxShadow: "0 4px 12px rgba(255,51,85,0.4)" }}
              >
                <span className="text-[13px]">{vt.emoji}</span>
                <span className="text-white font-bold text-[12px]">{vt.label} 인증</span>
              </div>
              {/* 탭 힌트 */}
              <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full"
                style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}>
                <Share2 className="w-3 h-3 text-white" />
                <span className="text-white text-[10px] font-bold">공유</span>
              </div>
            </button>
          </div>
        )}

      </div>

      {/* ── 하단 버튼 ── */}
      <div className="shrink-0 px-6 pb-10 pt-3 bg-[#F5F6FA] relative z-10">
        <button
          onClick={() => navigate("/")}
          className="w-full h-14 flex items-center justify-center gap-2 rounded-2xl text-white font-bold text-[16px] active:scale-[0.98] transition-transform mb-3"
          style={{
            background: "linear-gradient(135deg,#FF3355,#FF6680)",
            boxShadow: "0 8px 24px -4px rgba(255,51,85,0.35)",
          }}
        >
          홈으로
          <ArrowRight className="w-5 h-5" />
        </button>
        <button
          onClick={shareVerification}
          className="w-full h-10 flex items-center justify-center gap-1.5 text-slate-400 text-[14px] font-medium active:text-slate-600 transition-colors"
        >
          <Share2 className="w-4 h-4" />
          {shareState === "copied" ? "공유 링크 복사됨" : shareState === "shared" ? "공유 완료" : "인증 사진 공유하기"}
        </button>
      </div>
    </div>

    {/* ── 인증 공유 카드 오버레이 ── */}
    {showShareCard && capturedImageUrl && (
      <ShareCard
        imageUrl={capturedImageUrl}
        defaultTitle={capturedGroup?.title ?? vt.label}
        onClose={() => setShowShareCard(false)}
      />
    )}
    </>
  );
}
