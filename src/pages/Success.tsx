import React, { useState, useEffect } from "react";
import { Share2, ArrowRight, Loader2, X, Sparkles, PartyPopper, Flame } from "lucide-react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useApp } from "../contexts/AppContext";
import { useAuth } from "../contexts/AuthContext";
import { VERIFY_TYPES, type VerifyTypeKey } from "../lib/verifyTypes";
import { shareOrCopy } from "../lib/share";
import { ShareCard, buildShareImage } from "./verify/ShareCard";
import { invalidateFeedCache } from "./FeedAll";

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
  const [searchParams] = useSearchParams();
  const demoMode = searchParams.get("demo") === "1";
  const { verifyType, verificationImageUrl, groups, completeCurrentVerification, nickname } = useApp();
  const { profile } = useAuth();
  const serverPhotoUrl = (location.state as { photoUrl?: string | null } | null)?.photoUrl;
  const [mounted, setMounted] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "sharing" | "done">("idle");
  const [showShareCard, setShowShareCard] = useState(false);

  // Demo 모드: 더미 사진 + 더미 챌린지
  const demoSeed = React.useMemo(() => Math.floor(Math.random() * 1000), []);
  const demoPhotoUrl = `https://picsum.photos/seed/chally-success-${demoSeed}/720/960`;

  // completeCurrentVerification()이 clearVerification()을 호출해 verifyType이 null이 되므로
  // 마운트 시점의 값을 미리 캡처
  const [capturedKey] = useState<VerifyTypeKey>(() => {
    if (demoMode) return "run_scenery";
    return (verifyType as VerifyTypeKey) ?? "step_walk";
  });
  const [capturedImageUrl] = useState<string | null>(() => {
    if (demoMode) return demoPhotoUrl;
    return serverPhotoUrl ?? verificationImageUrl;
  });
  const [capturedGroup] = useState(() => {
    if (demoMode) return null;
    return groups.find(g => g.verifyType === ((verifyType as VerifyTypeKey) ?? "step_walk")) ?? null;
  });

  // 공유 카드 편집 설정 — ShareCard에서 제목/다크모드 변경 시 동기화
  const [cardTitle, setCardTitle] = useState(() => {
    if (demoMode) return "아침 러닝 30분";
    const vt0 = VERIFY_TYPES[(verifyType as VerifyTypeKey) ?? "step_walk"];
    const grp  = groups.find(g => g.verifyType === ((verifyType as VerifyTypeKey) ?? "step_walk")) ?? null;
    return grp?.title ?? vt0?.label ?? "";
  });
  const [cardIsDark, setCardIsDark] = useState(true);

  const vt = VERIFY_TYPES[capturedKey];

  // 로컬 상태 완료 처리 (한 번만) — DB 저장은 Edge Function이 이미 완료
  useEffect(() => {
    if (demoMode) return;
    completeCurrentVerification(serverPhotoUrl);
    invalidateFeedCache();
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
    if (shareState === "sharing") return;
    setShareState("sharing");
    const username = profile?.username ?? nickname ?? "챌리유저";
    try {
      if (capturedImageUrl) {
        const file = await buildShareImage(capturedImageUrl, cardTitle, username, cardIsDark);
        if (file && navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            title: `${cardTitle} 챌린지 인증`,
            text: `${cardTitle} 챌린지를 완료했어요!`,
            files: [file],
          });
          setShareState("done");
          setTimeout(() => setShareState("idle"), 2000);
          return;
        }
      }
      // 사진 없거나 파일 공유 미지원 → URL fallback
      await shareOrCopy({
        title: "챌리 인증 완료",
        text: `${vt.emoji} ${cardTitle} 챌린지를 완료했어요!`,
        url: serverPhotoUrl ?? window.location.origin,
      });
      setShareState("done");
      setTimeout(() => setShareState("idle"), 1800);
    } catch {
      setShareState("idle");
    }
  }

  // 스트릭 (데모: 7일, 실제: profile.streak_count)
  const streakCount = demoMode ? 7 : (profile?.streak_count ?? 0);

  return (
    <>
    <div className="flex flex-col h-full bg-white relative overflow-hidden">
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
        @keyframes suc-float-a {
          0%,100% { transform: translate(-20%, -15%) scale(1); }
          50%     { transform: translate(-15%, -10%) scale(1.08); }
        }
        @keyframes suc-float-b {
          0%,100% { transform: translate(20%, 25%) scale(1); }
          50%     { transform: translate(15%, 20%) scale(1.1); }
        }
        @keyframes suc-float-c {
          0%,100% { transform: translate(40%, -20%) scale(1); }
          50%     { transform: translate(35%, -15%) scale(1.06); }
        }
        .suc-headline-grad {
          background: linear-gradient(135deg,#FF3355 0%, #FF6680 50%, #FFA07A 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          filter: drop-shadow(0 4px 16px rgba(255,51,85,0.25));
        }
      `}</style>

      {/* ── 데코 오로라 블롭 ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute rounded-full"
          style={{
            width: 360, height: 360, top: -120, left: -120,
            background: "radial-gradient(circle, rgba(255,51,85,0.22) 0%, rgba(255,51,85,0) 70%)",
            filter: "blur(20px)",
            animation: "suc-float-a 9s ease-in-out infinite",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 420, height: 420, bottom: -160, right: -140,
            background: "radial-gradient(circle, rgba(255,102,128,0.18) 0%, rgba(255,102,128,0) 70%)",
            filter: "blur(24px)",
            animation: "suc-float-b 11s ease-in-out infinite",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 260, height: 260, top: "40%", right: -100,
            background: "radial-gradient(circle, rgba(255,160,122,0.14) 0%, rgba(255,160,122,0) 70%)",
            filter: "blur(20px)",
            animation: "suc-float-c 13s ease-in-out infinite",
          }}
        />
      </div>

      <Confetti dots={dots} />

      {/* 닫기 */}
      <button
        onClick={() => navigate("/")}
        className="absolute top-12 left-4 z-20 w-10 h-10 rounded-full bg-black/10 flex items-center justify-center text-slate-500 active:scale-90 transition-all"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex-1 min-h-0 overflow-hidden pt-14 pb-3 px-6 relative z-10 flex flex-col items-center">

        {/* ── 체크 아이콘 ── */}
        <div className="mb-3" style={pop(80)}>
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
              className="w-24 h-24 rounded-full flex items-center justify-center relative z-10"
              style={{
                background: "linear-gradient(135deg,#FF3355,#FF6680)",
                boxShadow: "0 16px 40px -8px rgba(255,51,85,0.4)",
                animation: mounted ? "suc-bounce 0.6s cubic-bezier(0.34,1.56,0.64,1) 80ms both" : "none",
              }}
            >
              <vt.Icon className="w-11 h-11 text-white" strokeWidth={2.2} />
            </div>
            <div className="absolute -top-1 -right-1" style={{ animation: mounted ? "suc-bounce 0.5s ease 350ms both" : "none" }}>
              <PartyPopper className="w-5 h-5 text-amber-400" strokeWidth={2.4} />
            </div>
            <div className="absolute -bottom-1 -left-1" style={{ animation: mounted ? "suc-bounce 0.5s ease 450ms both" : "none" }}>
              <Sparkles className="w-4 h-4 text-amber-300" strokeWidth={2.4} />
            </div>
          </div>
        </div>

        {/* ── 스트릭 펄 (있을 때만) ── */}
        {streakCount > 0 && (
          <div
            className="mb-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full"
            style={{
              ...slide(180),
              background: "linear-gradient(135deg, rgba(255,51,85,0.12), rgba(255,160,122,0.10))",
              border: "1px solid rgba(255,51,85,0.25)",
              boxShadow: "0 4px 12px -4px rgba(255,51,85,0.2)",
            }}
          >
            <Flame className="w-3.5 h-3.5" style={{ color: "#FF3355" }} fill="#FF3355" strokeWidth={2} />
            <span className="text-[12px] font-black tabular-nums" style={{ color: "#FF3355" }}>
              {streakCount}일 연속 인증
            </span>
          </div>
        )}

        {/* ── 헤드라인 ── */}
        <div className="text-center mb-3" style={slide(220)}>
          <h1 className="suc-headline-grad text-[34px] font-black leading-tight mb-1.5 tracking-tight inline-flex items-center justify-center gap-2">
            인증 완료!
            <Flame className="w-7 h-7 text-[#FF3355]" fill="#FF3355" strokeWidth={2} />
          </h1>
          <p className="text-slate-500 text-[14px] leading-relaxed">
            <span className="font-bold text-slate-700">"{capturedGroup?.title ?? vt.label}"</span> 챌린지 달성!<br />
            꾸준함이 습관을 만듭니다.
          </p>
        </div>

        {/* ── 인증 사진 (있을 때만) — 탭하면 공유 카드 열림. 잘리지 않도록 원본 비율 유지 ── */}
        {capturedImageUrl && (
          <div className="flex-1 min-h-0 w-full flex justify-center items-center mb-1" style={slide(300)}>
            <button
              className="relative rounded-2xl overflow-hidden h-full w-fit max-w-full active:scale-[0.98] transition-transform block"
              style={{
                border: "1px solid rgba(255,51,85,0.12)",
              }}
              onClick={() => setShowShareCard(true)}
            >
              <img
                src={capturedImageUrl}
                alt="인증 사진"
                className="h-full w-auto max-w-full object-contain block bg-slate-100"
              />
              {/* 오버레이 배지 */}
              <div
                className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{ background: "linear-gradient(135deg,#FF3355,#FF6680)", boxShadow: "0 4px 12px rgba(255,51,85,0.4)" }}
              >
                <vt.Icon className="w-3.5 h-3.5 text-white" strokeWidth={2.4} />
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
      <div className="shrink-0 px-6 pb-10 pt-3 bg-white relative z-10">
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
          disabled={shareState === "sharing"}
          className="w-full h-10 flex items-center justify-center gap-1.5 text-slate-400 text-[14px] font-medium active:text-slate-600 transition-colors disabled:opacity-50"
        >
          {shareState === "sharing"
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Share2 className="w-4 h-4" />
          }
          {shareState === "sharing" ? "이미지 준비 중..." : shareState === "done" ? "공유 완료" : "인증 카드 공유하기"}
        </button>
      </div>
    </div>

    {/* ── 인증 공유 카드 오버레이 ── */}
    {showShareCard && capturedImageUrl && (
      <ShareCard
        imageUrl={capturedImageUrl}
        defaultTitle={cardTitle}
        onClose={() => setShowShareCard(false)}
        onSave={(t, dark) => { setCardTitle(t); setCardIsDark(dark); }}
      />
    )}
    </>
  );
}
