import React, { useState, useEffect, useRef } from "react";
import { X, CheckCircle2, XCircle, Camera, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../contexts/AppContext";
import { VERIFY_TYPES, type VerifyTypeKey } from "../../lib/verifyTypes";
import { verifyPhotoWithAI, type VerifyResult } from "../../lib/verifyAI";

type Phase = "analyzing" | "passed" | "failed" | "error";

export function Upload() {
  const navigate = useNavigate();
  const { verificationImageUrl, verificationImageFile, verifyType, theme } = useApp();
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<Phase>("analyzing");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const calledRef = useRef(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [key] = useState<VerifyTypeKey>(() => (verifyType as VerifyTypeKey) ?? "step_walk");
  const vt = VERIFY_TYPES[key] ?? VERIFY_TYPES["step_walk"];

  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    if (!verificationImageFile) { navigate("/verify/camera"); return; }

    const abortCtrl = new AbortController();
    let rafId: number;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    const startTime = Date.now();
    const tick = () => {
      if (stopped) return;
      const p = Math.min((Date.now() - startTime) / 4000, 1);
      setProgress(Math.round((1 - Math.pow(1 - p, 2.2)) * 88));
      if (p < 1) { rafId = requestAnimationFrame(tick); }
      else {
        let slow = 88;
        intervalId = setInterval(() => {
          if (stopped) { clearInterval(intervalId!); return; }
          slow = Math.min(slow + 0.15, 97);
          setProgress(Math.round(slow));
        }, 200);
      }
    };
    rafId = requestAnimationFrame(tick);

    verifyPhotoWithAI(verificationImageFile, key, abortCtrl.signal)
      .then(res => {
        stopped = true;
        cancelAnimationFrame(rafId);
        if (intervalId) clearInterval(intervalId);
        setResult(res);
        setProgress(100);
        if (res.passed) {
          setPhase("passed");
          successTimerRef.current = setTimeout(() => navigate("/success", { state: { photoUrl: res.photoUrl } }), 900);
        } else {
          setPhase("failed");
        }
      })
      .catch((err: unknown) => {
        stopped = true;
        cancelAnimationFrame(rafId);
        if (intervalId) clearInterval(intervalId);
        setErrorMessage(err instanceof Error ? err.message : String(err));
        setPhase("error");
      });

    return () => {
      stopped = true;
      abortCtrl.abort();
      cancelAnimationFrame(rafId);
      if (intervalId) clearInterval(intervalId);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const d = isDark;
  const isAnalyzing = phase === "analyzing";
  const isPassed = phase === "passed";
  const isFailed = phase === "failed";

  /* ── 공통 배경 래퍼 ── */
  const Bg = ({ children, glow }: { children: React.ReactNode; glow: string }) => (
    <div className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: d ? "#080A0F" : "#F8F8FA", transition: "background 0.25s" }}>
      {verificationImageUrl && (
        <>
          <img src={verificationImageUrl} alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: d ? 0.18 : 0.07 }} />
          <div className="absolute inset-0"
            style={{ backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }} />
        </>
      )}
      <div className="pointer-events-none absolute inset-0" style={{ background: d ? glow : "none" }} />
      {children}
      <style>{`
        @keyframes upl-scan {
          0%   { top: 6%;  opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { top: 92%; opacity: 0; }
        }
        @keyframes upl-pop {
          from { transform: scale(0.4); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
        @keyframes upl-dot {
          0%,100% { opacity: 0.3; transform: scale(0.8); }
          50%     { opacity: 1;   transform: scale(1.2); }
        }
        @keyframes upl-slide {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );

  /* ── 상단 바 ── */
  const TopBar = ({ accent }: { accent?: string }) => (
    <div className="relative z-10 flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
      <button onClick={() => navigate(-1)}
        className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
          d ? "bg-white/10 text-white/60 active:bg-white/20" : "bg-slate-100 text-slate-500 active:bg-slate-200"
        }`}>
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
        style={{
          background: `${accent ?? "#FF3355"}${d ? "20" : "12"}`,
          border: `1px solid ${accent ?? "#FF3355"}35`,
        }}>
        <span className="text-[13px]">{vt.emoji}</span>
        <span className={`text-[12px] font-semibold ${d ? "text-white" : "text-slate-700"}`}>{vt.label}</span>
      </div>
      <div className="w-9" />
    </div>
  );

  /* ── 분석 중 / 통과 ── */
  if (isAnalyzing || isPassed) {
    return (
      <Bg glow={isPassed
        ? "radial-gradient(ellipse at 50% 35%, rgba(52,211,153,0.2) 0%, transparent 60%)"
        : "radial-gradient(ellipse at 50% 35%, rgba(255,51,85,0.12) 0%, transparent 60%)"
      }>
        <TopBar />

        <div className="flex-1 flex flex-col items-center justify-center gap-7 px-8 relative z-10">
          {/* 사진 프레임 */}
          <div className="relative w-full max-w-[240px] aspect-[3/4]">
            <div className="absolute inset-0 rounded-2xl overflow-hidden"
              style={{ boxShadow: d ? "none" : "0 8px 32px rgba(0,0,0,0.15)" }}>
              <img src={verificationImageUrl ?? ""} alt="" className="w-full h-full object-cover"
                style={{ filter: d ? "brightness(0.9)" : "brightness(1)" }} />
              {isPassed && (
                <div className="absolute inset-0 bg-emerald-400/15 transition-opacity duration-700" />
              )}
            </div>

            {/* 스캔 라인 */}
            {isAnalyzing && (
              <div className="absolute left-2 right-2 h-[2px] rounded-full z-10 pointer-events-none"
                style={{
                  background: "linear-gradient(to right, transparent, #FF3355, #FF6680, transparent)",
                  boxShadow: "0 0 12px #FF3355",
                  animation: "upl-scan 1.8s ease-in-out infinite",
                }} />
            )}

            {/* 브래킷 */}
            {["top-2 left-2 border-t-2 border-l-2 rounded-tl-lg",
              "top-2 right-2 border-t-2 border-r-2 rounded-tr-lg",
              "bottom-2 left-2 border-b-2 border-l-2 rounded-bl-lg",
              "bottom-2 right-2 border-b-2 border-r-2 rounded-br-lg",
            ].map((cls, i) => (
              <div key={i} className={`absolute w-6 h-6 z-10 transition-colors duration-500 ${cls}`}
                style={{ borderColor: isPassed ? "#34d399" : "#FF3355" }} />
            ))}

            {/* 통과 아이콘 */}
            {isPassed && (
              <div className="absolute inset-0 flex items-center justify-center z-20">
                <div className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg,#34d399,#059669)", boxShadow: "0 0 40px rgba(52,211,153,0.5)", animation: "upl-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) both" }}>
                  <CheckCircle2 className="w-8 h-8 text-white" strokeWidth={2.5} />
                </div>
              </div>
            )}
          </div>

          {/* 상태 텍스트 */}
          {isPassed ? (
            <p className="font-black text-[22px]" style={{ color: d ? "white" : "#0f172a" }}>인증 완료! 🎉</p>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <p className="font-semibold text-[15px]" style={{ color: d ? "white" : "#334155" }}>AI 분석 중</p>
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full"
                    style={{ background: d ? "rgba(255,255,255,0.5)" : "#FF3355", animation: `upl-dot 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          )}

          {/* 진행률 바 */}
          {isAnalyzing && (
            <div className="w-full max-w-[240px] h-[3px] rounded-full overflow-hidden"
              style={{ background: d ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }}>
              <div className="h-full rounded-full transition-all duration-150"
                style={{ width: `${progress}%`, background: "linear-gradient(90deg,#FF3355,#FF6680)" }} />
            </div>
          )}
        </div>
      </Bg>
    );
  }

  /* ── 실패 화면 ── */
  if (isFailed && result) {
    return (
      <Bg glow="radial-gradient(ellipse at 50% 20%, rgba(239,68,68,0.1) 0%, transparent 55%)">
        <TopBar accent="#ef4444" />

        <div className="flex-1 overflow-y-auto relative z-10">

          {/* ① 실패 요약 */}
          <div className="px-5 pt-2 pb-5 flex items-start gap-4"
            style={{ animation: "upl-slide 0.4s ease both" }}>
            <div className="relative shrink-0 w-[72px] h-[88px] rounded-2xl overflow-hidden"
              style={{ boxShadow: `0 0 0 1.5px rgba(239,68,68,${d ? 0.4 : 0.3})` }}>
              <img src={verificationImageUrl ?? ""} alt="" className="w-full h-full object-cover"
                style={{ filter: d ? "brightness(0.5) saturate(0.3)" : "brightness(0.75) saturate(0.4)" }} />
              <div className="absolute inset-0 bg-red-500/20" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-red-500/80 flex items-center justify-center"
                  style={{ animation: "upl-pop 0.35s cubic-bezier(0.34,1.56,0.64,1) 0.1s both" }}>
                  <XCircle className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
              </div>
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <p className="font-black text-[19px] leading-tight mb-1.5"
                style={{ color: d ? "white" : "#0f172a" }}>인증 실패</p>
              <p className="text-[13px] leading-relaxed"
                style={{ color: d ? "rgba(255,255,255,0.5)" : "#64748b" }}>{result.reason}</p>
            </div>
          </div>

          {/* ② 통과 못한 항목 */}
          {result.failedChecks.length > 0 && (
            <div className="mx-5 mb-5 rounded-2xl overflow-hidden"
              style={{
                background: d ? "rgba(239,68,68,0.07)" : "rgba(239,68,68,0.05)",
                border: `1px solid rgba(239,68,68,${d ? 0.18 : 0.2})`,
                animation: "upl-slide 0.4s ease 80ms both",
              }}>
              <div className="px-4 pt-3.5 pb-1">
                <p className="text-red-400 text-[10px] font-black uppercase tracking-[0.16em]" style={{ opacity: d ? 0.8 : 1 }}>통과 못한 항목</p>
              </div>
              <div className="px-4 pb-3.5 space-y-2.5 mt-2">
                {result.failedChecks.map((check, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <XCircle className="w-4 h-4 text-red-400 shrink-0" strokeWidth={2.5} />
                    <span className="text-[13px] font-medium"
                      style={{ color: d ? "rgba(255,255,255,0.75)" : "#475569" }}>{check}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ③ 구분선 */}
          <div className="mx-5 mb-4 flex items-center gap-3"
            style={{ animation: "upl-slide 0.4s ease 140ms both" }}>
            <div className="flex-1 h-px" style={{ background: d ? "rgba(255,255,255,0.1)" : "#e2e8f0" }} />
            <div className="flex items-center gap-1.5 shrink-0">
              <AlertCircle className="w-3 h-3" style={{ color: d ? "rgba(255,255,255,0.3)" : "#94a3b8" }} />
              <span className="text-[11px] font-bold tracking-wide"
                style={{ color: d ? "rgba(255,255,255,0.3)" : "#94a3b8" }}>AI 인증 기준</span>
            </div>
            <div className="flex-1 h-px" style={{ background: d ? "rgba(255,255,255,0.1)" : "#e2e8f0" }} />
          </div>

          {/* ④ 예시 사진 + AI 체크리스트 */}
          <div className="mx-5 mb-4 rounded-2xl overflow-hidden"
            style={{ animation: "upl-slide 0.4s ease 180ms both", boxShadow: d ? "0 8px 24px rgba(0,0,0,0.3)" : "0 4px 20px rgba(0,0,0,0.1)" }}>
            <div className="relative" style={{ aspectRatio: "16/9" }}>
              <img src={vt.exampleImg} alt="통과 예시" className="w-full h-full object-cover"
                referrerPolicy="no-referrer" />
              <div className="absolute inset-0"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.2) 55%, transparent 100%)" }} />
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ background: "#FF3355CC", backdropFilter: "blur(4px)" }}>
                <CheckCircle2 className="w-3 h-3 text-white" strokeWidth={3} />
                <span className="text-white text-[10px] font-black">통과 예시</span>
              </div>
              <div className="absolute bottom-3 left-3 right-3">
                <p className="text-white/60 text-[11px] font-medium">"{vt.desc}"에 해당하는 사진이에요</p>
              </div>
            </div>

            {/* AI 전체 체크리스트 */}
            <div className="px-4 py-4" style={{ background: d ? "#0D0F18" : "#f8fafc" }}>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] mb-3"
                style={{ color: d ? "rgba(255,255,255,0.35)" : "#94a3b8" }}>
                AI가 확인하는 {vt.checklist.length}가지
              </p>
              <div className="grid grid-cols-2 gap-2">
                {vt.checklist.map((item, i) => {
                  const isFail = result.failedChecks.includes(item);
                  return (
                    <div key={i} className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                      style={{
                        background: isFail
                          ? (d ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.06)")
                          : (d ? "rgba(52,211,153,0.07)" : "rgba(52,211,153,0.08)"),
                        border: isFail
                          ? `1px solid rgba(239,68,68,${d ? 0.25 : 0.2})`
                          : `1px solid rgba(52,211,153,${d ? 0.2 : 0.25})`,
                      }}>
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${isFail ? "bg-red-500" : "bg-emerald-500"}`}>
                        {isFail
                          ? <X className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                          : <CheckCircle2 className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                        }
                      </div>
                      <span className={`text-[11px] font-semibold leading-tight ${
                        isFail
                          ? (d ? "text-red-300" : "text-red-500")
                          : (d ? "text-white/65" : "text-slate-600")
                      }`}>
                        {item}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ⑤ 촬영 팁 */}
          <div className="mx-5 mb-4 flex items-start gap-3 px-4 py-3.5 rounded-2xl"
            style={{
              background: d ? "rgba(255,255,255,0.04)" : "white",
              border: `1px solid ${d ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}`,
              boxShadow: d ? "none" : "0 1px 4px rgba(0,0,0,0.04)",
              animation: "upl-slide 0.4s ease 240ms both",
            }}>
            <span className="text-[18px] shrink-0 mt-0.5">💡</span>
            <p className="text-[12px] leading-relaxed"
              style={{ color: d ? "rgba(255,255,255,0.45)" : "#64748b" }}>{vt.tip}</p>
          </div>

          <div className="h-4" />
        </div>

        {/* ⑥ 버튼 */}
        <div className="shrink-0 px-5 pb-10 pt-3 relative z-10 flex flex-col gap-2">
          <button onClick={() => navigate("/verify/camera")}
            className="w-full h-[52px] flex items-center justify-center gap-2 rounded-2xl text-white font-bold text-[15px] active:scale-[0.98] transition-transform"
            style={{ background: "linear-gradient(135deg,#FF3355,#FF6680)", boxShadow: "0 8px 24px -4px rgba(255,51,85,0.35)" }}>
            <Camera className="w-4 h-4" />
            다시 찍기
          </button>
          <button onClick={() => navigate("/")}
            className="w-full h-10 text-[13px] active:opacity-60 transition-opacity"
            style={{ color: d ? "rgba(255,255,255,0.35)" : "#94a3b8" }}>
            홈으로
          </button>
        </div>
      </Bg>
    );
  }

  /* ── 오류 화면 ── */
  return (
    <Bg glow="radial-gradient(ellipse at 50% 35%, rgba(251,191,36,0.1) 0%, transparent 60%)">
      <TopBar />
      <div className="flex-1 flex flex-col items-center justify-center px-8 relative z-10 gap-4">
        <p className="text-[36px]">⚠️</p>
        <p className="font-bold text-[17px] text-center" style={{ color: d ? "white" : "#0f172a" }}>분석 중 오류가 발생했어요</p>
        <p className="text-[12px] text-center leading-relaxed" style={{ color: d ? "rgba(255,255,255,0.4)" : "#94a3b8" }}>
          {errorMessage || "네트워크를 확인하고 다시 시도해주세요"}
        </p>
        <button onClick={() => navigate("/verify/camera")}
          className="mt-2 px-8 py-3 rounded-2xl text-white font-semibold text-[14px]"
          style={{ background: "linear-gradient(135deg,#FF3355,#FF6680)" }}>
          다시 찍기
        </button>
      </div>
    </Bg>
  );
}
