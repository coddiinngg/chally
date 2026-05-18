import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Zap, Check, Lock, Sparkles, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { GRADES, getGrade, getNextGrade } from "../lib/grades";
import { useScrollRestoration, isReturningVisit } from "../lib/useScrollRestoration";

function useCountUp(target: number, duration: number, delay: number) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start: number | null = null;
    let frame: number;
    const timer = setTimeout(() => {
      const step = (ts: number) => {
        if (!start) start = ts;
        const pct = Math.min((ts - start) / duration, 1);
        setVal(Math.round((1 - Math.pow(1 - pct, 3)) * target));
        if (pct < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }, delay);
    return () => { clearTimeout(timer); cancelAnimationFrame(frame); };
  }, [target, duration, delay]);
  return val;
}

export function Rewards() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [mounted, setMounted] = useState(() => isReturningVisit("rw-scroll"));
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollRestoration("rw-scroll", scrollRef);

  const xpTotal = profile?.xp_total ?? 0;
  const currentGrade = getGrade(xpTotal);
  const nextGrade = getNextGrade(currentGrade.level);
  const xpDisplay = useCountUp(xpTotal, 1200, 400);

  useEffect(() => {
    if (mounted) return;
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const anim = (delay: number, fromY = 16): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : `translateY(${fromY}px)`,
    transition: `opacity 0.45s ease ${delay}ms, transform 0.45s cubic-bezier(0.4,0,0.2,1) ${delay}ms`,
  });

  const xpToNext = nextGrade ? Math.max(0, nextGrade.minXp - xpTotal) : 0;
  const progressPct = nextGrade
    ? Math.min(((xpTotal - currentGrade.minXp) / (nextGrade.minXp - currentGrade.minXp)) * 100, 100)
    : 100;

  return (
    <div className="flex flex-col h-full bg-[#F8F8FA] overflow-hidden">
      <style>{`
        @keyframes rw-shine { 0%{transform:rotate(-30deg) translateX(-120%);opacity:0;}40%{opacity:0.5;}100%{transform:rotate(-30deg) translateX(250%);opacity:0;} }
      `}</style>

      {/* ── 헤더 ── */}
      <header className="shrink-0 flex items-center gap-3 px-4 pt-4 pb-3 bg-white border-b border-black/[0.05]" style={anim(0)}>
        <button onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 active:bg-slate-200 transition-colors shrink-0">
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </button>
        <div className="flex-1">
          <p className="text-[11px] font-bold text-[#FF3355] uppercase tracking-widest">My Level</p>
          <h1 className="text-[20px] font-black text-slate-900 leading-tight tracking-tight">등급</h1>
        </div>
        <div className="flex items-center gap-1.5 bg-[#FF3355]/10 px-3 py-1.5 rounded-full">
          <Zap className="w-3.5 h-3.5 text-[#FF3355]" />
          <span className="text-[13px] font-black text-[#FF3355]">{xpDisplay.toLocaleString()} XP</span>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar pb-10">

        {/* ── 현재 등급 히어로 ── */}
        <div
          className="relative overflow-hidden px-5 pt-7 pb-7"
          style={{
            background: `linear-gradient(150deg, ${currentGrade.color} 0%, ${currentGrade.color}cc 60%, ${currentGrade.color}99 100%)`,
            ...anim(40, 0),
          }}
        >
          <div className="pointer-events-none absolute -top-12 -right-12 w-56 h-56 rounded-full bg-white/[0.07]" />
          <div className="pointer-events-none absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-black/[0.08]" />
          <div className="pointer-events-none absolute inset-0"
            style={{ background: "linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.09) 50%, transparent 65%)", animation: "rw-shine 4s ease 0.8s 1 both" }} />

          <div className="relative z-10 flex items-center gap-4 mb-5">
            <div
              className="shrink-0 w-[76px] h-[76px] rounded-2xl flex flex-col items-center justify-center"
              style={{
                background: "rgba(255,255,255,0.18)",
                border: "2px solid rgba(255,255,255,0.4)",
                boxShadow: `0 0 0 6px rgba(255,255,255,0.07), 0 8px 24px ${currentGrade.glow}`,
                opacity: mounted ? 1 : 0,
                transform: mounted ? "scale(1)" : "scale(0.4)",
                transition: "opacity 0.5s ease 0.1s, transform 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.1s",
              }}
            >
              <span className="text-[9px] font-black text-white/55 tracking-widest">{currentGrade.code}</span>
              <span className="text-[20px] font-black text-white leading-none mt-1">Lv.{currentGrade.level}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white/55 text-[11px] font-bold uppercase tracking-widest mb-0.5">현재 등급</p>
              <h2 className="text-[24px] font-black text-white leading-tight">{currentGrade.name}</h2>
              <p className="text-white/65 text-[12px] mt-1">
                {nextGrade
                  ? <>다음 등급까지 <span className="font-black text-white">{xpToNext.toLocaleString()} XP</span></>
                  : <span className="font-bold text-white">최고 등급 달성 🎉</span>
                }
              </p>
            </div>
          </div>

          <div className="relative z-10">
            <div className="flex justify-between mb-1.5">
              <span className="text-[12px] font-bold text-white/80">{xpDisplay.toLocaleString()} XP</span>
              <span className="text-[12px] text-white/50">{nextGrade ? `${nextGrade.minXp.toLocaleString()} XP` : "MAX"}</span>
            </div>
            <div className="w-full h-3 rounded-full bg-white/20 overflow-hidden">
              <div style={{
                width: mounted ? `${progressPct}%` : "0%",
                height: "100%", borderRadius: 999,
                background: "linear-gradient(90deg, rgba(255,255,255,0.95), rgba(255,255,255,0.65))",
                boxShadow: "0 0 12px rgba(255,255,255,0.5)",
                transition: "width 1.4s cubic-bezier(0.4,0,0.2,1) 0.35s",
              }} />
            </div>
          </div>
        </div>

        <div className="px-4 -mt-3 space-y-3">

          {/* ── 다음 도전 목표 ── */}
          {nextGrade && (
            <div
              className="bg-white rounded-3xl p-5 border border-[#FF3355]/15 shadow-[0_4px_20px_rgba(255,51,85,0.08)] relative overflow-hidden"
              style={anim(140)}
            >
              <div className="pointer-events-none absolute -top-8 -right-8 w-32 h-32 rounded-full"
                style={{ background: `radial-gradient(circle, ${nextGrade.color}18, transparent 70%)` }} />
              <div className="pointer-events-none absolute top-0 left-0 w-1 h-full"
                style={{ background: "linear-gradient(180deg, #FF3355, #FF6680)" }} />

              <div className="flex items-center gap-1.5 mb-3">
                <Target className="w-3.5 h-3.5 text-[#FF3355]" />
                <p className="text-[11px] font-bold text-[#FF3355] uppercase tracking-widest">다음 도전 목표</p>
              </div>

              <div className="flex items-center gap-4 mb-4 relative z-10">
                <div
                  className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0"
                  style={{
                    background: `${nextGrade.color}15`,
                    border: `2px solid ${nextGrade.color}40`,
                    boxShadow: `0 4px 18px ${nextGrade.glow}`,
                  }}
                >
                  <span className="text-[8px] font-black tracking-widest" style={{ color: nextGrade.color }}>{nextGrade.code}</span>
                  <span className="text-[15px] font-black mt-0.5" style={{ color: nextGrade.color }}>Lv.{nextGrade.level}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[20px] font-black text-slate-900 leading-tight">{nextGrade.name}</h3>
                  <p className="text-[12px] text-slate-400 mt-1">
                    필요 XP <span className="font-black text-slate-700">{nextGrade.minXp.toLocaleString()}</span>
                  </p>
                </div>
              </div>

              <div className="relative z-10">
                <div className="flex justify-between mb-1.5">
                  <span className="text-[12px] font-bold text-slate-500">{Math.round(progressPct)}%</span>
                  <span className="text-[12px] font-bold" style={{ color: nextGrade.color }}>
                    {xpToNext.toLocaleString()} XP 남음
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: mounted ? `${progressPct}%` : "0%",
                      background: `linear-gradient(90deg, ${nextGrade.color}, ${nextGrade.color}99)`,
                      boxShadow: `0 0 8px ${nextGrade.glow}`,
                      transition: "width 1.2s cubic-bezier(0.4,0,0.2,1) 0.5s",
                    }}
                  />
                </div>
                <p className="text-[12px] text-slate-400 mt-3 leading-relaxed">
                  챌린지를 인증하고 XP를 모아 <span className="font-black text-[#FF3355]">{nextGrade.name}</span> 등급에 도전해보세요.
                </p>
              </div>
            </div>
          )}

          {/* ── 전체 등급 로드맵 ── */}
          <div style={anim(220)}>
            <div className="flex items-center gap-1.5 ml-1 mb-2.5">
              <Sparkles className="w-3.5 h-3.5 text-[#FF3355]" />
              <p className="text-[11px] font-bold text-[#FF3355] uppercase tracking-widest">등급 로드맵</p>
            </div>
            <div className="bg-white rounded-3xl border border-black/[0.04] shadow-[0_2px_14px_rgba(0,0,0,0.05)] overflow-hidden">
              {GRADES.map((g, i) => {
                const reached = xpTotal >= g.minXp;
                const isCurrent = g.level === currentGrade.level;
                const isNext = nextGrade && g.level === nextGrade.level;
                return (
                  <div
                    key={g.level}
                    className="flex items-center gap-3 px-4 py-3 relative"
                    style={{
                      background: isCurrent ? `${g.color}08` : "transparent",
                      borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.04)",
                    }}
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0"
                      style={{
                        background: reached ? `${g.color}18` : "#F1F5F9",
                        border: `2px solid ${reached ? `${g.color}40` : "#E2E8F0"}`,
                        boxShadow: isCurrent ? `0 4px 14px ${g.glow}` : "none",
                      }}
                    >
                      <span className="text-[7px] font-black tracking-widest leading-none"
                        style={{ color: reached ? g.color : "#94A3B8" }}>{g.code}</span>
                      <span className="text-[10px] font-black mt-0.5 leading-none"
                        style={{ color: reached ? g.color : "#94A3B8" }}>Lv.{g.level}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[14px] font-black"
                          style={{ color: reached ? "#0F172A" : "#94A3B8" }}>{g.name}</p>
                        {isCurrent && (
                          <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md text-white"
                            style={{ background: g.color }}>NOW</span>
                        )}
                        {isNext && (
                          <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md"
                            style={{ background: `${g.color}18`, color: g.color }}>NEXT</span>
                        )}
                      </div>
                      <p className="text-[11px] mt-0.5"
                        style={{ color: reached ? "#64748B" : "#CBD5E1" }}>
                        {g.minXp.toLocaleString()} XP
                      </p>
                    </div>
                    <div className="shrink-0">
                      {reached ? (
                        <div className="w-7 h-7 rounded-full flex items-center justify-center"
                          style={{ background: `${g.color}18` }}>
                          <Check className="w-3.5 h-3.5" style={{ color: g.color }} />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center">
                          <Lock className="w-3 h-3 text-slate-300" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
