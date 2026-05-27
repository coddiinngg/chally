import React, { useState, useEffect } from "react";
import { X, Camera, CheckCircle2, Lightbulb } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../contexts/AppContext";
import { VERIFY_TYPES, type VerifyTypeKey } from "../../lib/verifyTypes";

export function VerifyGuide() {
  const navigate = useNavigate();
  const { type } = useParams<{ type: string }>();
  const { setVerifyType, theme } = useApp();
  const [mounted, setMounted] = useState(false);

  const key = (type as VerifyTypeKey) ?? "step_walk";
  const vt  = VERIFY_TYPES[key] ?? VERIFY_TYPES["step_walk"];
  const d   = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    setVerifyType(key);
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, [key, setVerifyType]);

  const fade = (delay: number): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(14px)",
    transition: `opacity 0.45s ease ${delay}ms, transform 0.45s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
  });

  const bg      = d ? "#0A0A0F" : "#F2F2F7";
  const cardBg  = d ? "#13161E" : "white";
  const divider = d ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";
  const textPri = d ? "white" : "#0f172a";
  const textSec = d ? "rgba(255,255,255,0.4)" : "#94a3b8";
  const textMd  = d ? "rgba(255,255,255,0.72)" : "#334155";
  const shadow  = d ? "none" : "0 2px 12px rgba(0,0,0,0.06)";

  return (
    <div className="flex flex-col h-full" style={{ background: bg }}>
      <style>{`
        @keyframes guide-in { from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:translateY(0);} }
      `}</style>

      {/* ── 헤더 ── */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-3.5"
        style={{ background: cardBg, borderBottom: `1px solid ${divider}`, animation: "guide-in 0.3s ease both" }}>
        <button onClick={() => navigate("/")}
          className="w-9 h-9 flex items-center justify-center rounded-full active:opacity-60 transition-opacity"
          style={{ background: d ? "rgba(255,255,255,0.08)" : "#F2F2F7" }}>
          <X className="w-4 h-4" style={{ color: textPri }} />
        </button>
        <p className="text-[16px] font-black" style={{ color: textPri }}>인증 가이드</p>
        {/* 플로우 표시: 선택 → 가이드 → 촬영 */}
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: d ? "rgba(255,255,255,0.2)" : "#e2e8f0" }} />
          <div className="w-4 h-1.5 rounded-full" style={{ background: "linear-gradient(90deg,#FF3355,#FF6680)" }} />
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: d ? "rgba(255,255,255,0.2)" : "#e2e8f0" }} />
        </div>
      </div>

      {/* ── 스크롤 본문 ── */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4 space-y-3">

        {/* ① 히어로 카드 */}
        <div className="rounded-3xl overflow-hidden relative"
          style={{ ...fade(40), background: cardBg, boxShadow: shadow }}>
          {/* 장식 원들 */}
          <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full pointer-events-none"
            style={{ background: `radial-gradient(circle, rgba(255,51,85,${d ? 0.12 : 0.08}) 0%, transparent 70%)` }} />
          <div className="absolute -bottom-8 -left-8 w-28 h-28 rounded-full pointer-events-none"
            style={{ background: `radial-gradient(circle, rgba(255,102,128,${d ? 0.1 : 0.06}) 0%, transparent 70%)` }} />

          <div className="relative px-6 pt-7 pb-6">
            {/* 아이콘 */}
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: d ? "rgba(255,51,85,0.12)" : "#FFF0F3" }}>
              <vt.Icon className="w-11 h-11" style={{ color: "#FF3355" }} strokeWidth={2} />
            </div>

            {/* 라벨 */}
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-black text-white mb-3"
              style={{ background: "linear-gradient(115deg,#FF3355,#FF6680)" }}>
              {vt.label}
            </span>

            {/* 제목 */}
            <h2 className="text-[24px] font-black leading-tight mb-1.5" style={{ color: textPri }}>
              {vt.desc}
            </h2>
            <p className="text-[13px]" style={{ color: textSec }}>
              사진으로 오늘의 챌린지를 인증해요
            </p>
          </div>
        </div>

        {/* ② 촬영 방법 — 타임라인 */}
        <div className="rounded-3xl p-5" style={{ ...fade(120), background: cardBg, boxShadow: shadow }}>
          <p className="text-[12px] font-black mb-5" style={{ color: "#FF3355" }}>촬영 방법</p>
          <div className="space-y-0">
            {vt.guide.map((step, i) => {
              const isLast = i === vt.guide.length - 1;
              return (
                <div key={i} className="flex gap-3.5">
                  {/* 타임라인 컬럼 */}
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-black text-white shrink-0"
                      style={{ background: "linear-gradient(135deg,#FF3355,#FF6680)", boxShadow: "0 2px 8px rgba(255,51,85,0.3)" }}>
                      {i + 1}
                    </div>
                    {!isLast && (
                      <div className="w-px mt-1.5 mb-0" style={{ height: 28, background: `linear-gradient(to bottom, rgba(255,51,85,0.3), rgba(255,51,85,0.06))` }} />
                    )}
                  </div>
                  {/* 텍스트 */}
                  <p className={`text-[13px] leading-snug flex-1 ${isLast ? "" : "pb-5"}`}
                    style={{ color: textMd, paddingTop: 4 }}>
                    {step}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ③ AI 확인 항목 — 가로 스크롤 칩 */}
        <div className="rounded-3xl p-5" style={{ ...fade(200), background: cardBg, boxShadow: shadow }}>
          <div className="flex items-center justify-between mb-3.5">
            <p className="text-[12px] font-black" style={{ color: "#FF3355" }}>AI가 확인해요</p>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: d ? "rgba(255,51,85,0.12)" : "#FFF0F3", color: "#FF3355" }}>
              {vt.checklist.length}가지
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {vt.checklist.map((item, i) => (
              <div key={i} className="flex items-center gap-1.5 px-3 py-2 rounded-full"
                style={{
                  background: d ? "rgba(255,51,85,0.08)" : "#FFF5F7",
                  border: `1px solid ${d ? "rgba(255,51,85,0.2)" : "rgba(255,51,85,0.18)"}`,
                }}>
                <CheckCircle2 className="w-3 h-3 shrink-0" style={{ color: "#FF3355" }} strokeWidth={2.5} />
                <span className="text-[11px] font-semibold whitespace-nowrap"
                  style={{ color: d ? "rgba(255,255,255,0.7)" : "#475569" }}>
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ④ 팁 */}
        <div className="flex items-start gap-3 px-5 py-4 rounded-3xl"
          style={{ ...fade(270), background: cardBg, boxShadow: shadow }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: d ? "rgba(251,191,36,0.12)" : "#FFFBEB" }}>
            <Lightbulb className="w-4 h-4 text-amber-500" strokeWidth={2.2} />
          </div>
          <p className="text-[12px] leading-relaxed flex-1 pt-1" style={{ color: textSec }}>{vt.tip}</p>
        </div>

      </div>

      {/* ── 촬영 시작 버튼 ── */}
      <div className="shrink-0 px-4 pb-8 pt-3" style={{ background: bg }}>
        <button
          onClick={() => navigate("/verify/camera")}
          className="w-full h-14 flex items-center justify-center gap-2.5 rounded-2xl text-white font-black text-[16px] active:scale-[0.97] transition-transform"
          style={{ background: "linear-gradient(115deg,#FF3355,#FF6680)", boxShadow: "0 8px 24px -4px rgba(255,51,85,0.4)" }}>
          <Camera className="w-5 h-5" />
          촬영 시작
        </button>
      </div>
    </div>
  );
}
