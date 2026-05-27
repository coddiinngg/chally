import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Zap, Check, Lock, Target, Sparkles, Crown } from "lucide-react";
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

const CARD_SHADOW = "0 2px 8px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.04)";

// 등급 뱃지 — 메탈릭 그라데이션 + 광택 + 글로우
function GradeBadge({
  color, glow, code, level, size = 88,
  mounted, delay = 100,
}: {
  color: string;
  glow: string;
  code: string;
  level: number;
  size?: number;
  mounted: boolean;
  delay?: number;
}) {
  const codeSize = size >= 80 ? 10 : size >= 60 ? 9 : 7;
  const levelSize = size >= 80 ? 22 : size >= 60 ? 16 : 11;

  return (
    <div
      className="relative rounded-2xl flex flex-col items-center justify-center overflow-hidden"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(140deg, ${color}45 0%, ${color}1A 45%, ${color}60 100%)`,
        border: `2px solid ${color}80`,
        boxShadow: `
          inset 0 1px 0 rgba(255,255,255,0.45),
          inset 0 -1px 0 ${color}20,
          0 8px 24px ${glow},
          0 0 0 4px ${color}10
        `,
        opacity: mounted ? 1 : 0,
        transform: mounted ? "scale(1)" : "scale(0.55)",
        transition: `opacity 0.5s ease ${delay}ms, transform 0.6s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms`,
      }}
    >
      {/* 광택 라인 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%)",
          animation: `rw-shine 3.5s ease ${delay + 400}ms infinite`,
        }}
      />
      {/* 내부 highlight */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-1/2 rounded-t-2xl"
        style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.18), transparent)" }}
      />

      <span
        className="relative font-black tracking-widest leading-none"
        style={{ color, fontSize: codeSize, textShadow: "0 1px 0 rgba(255,255,255,0.3)" }}
      >
        {code}
      </span>
      <span
        className="relative font-black mt-1 leading-none"
        style={{ color, fontSize: levelSize, textShadow: "0 1px 0 rgba(255,255,255,0.35)" }}
      >
        Lv.{level}
      </span>
    </div>
  );
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
  const reachedCount = GRADES.filter(g => xpTotal >= g.minXp).length;

  return (
    <div className="flex flex-col h-full bg-[#F8F8FA] overflow-hidden">
      <style>{`
        @keyframes rw-shine { 0%{transform:translateX(-100%);opacity:0;}30%{opacity:1;}70%{opacity:1;}100%{transform:translateX(120%);opacity:0;} }
        @keyframes rw-pulse { 0%,100%{transform:scale(1);}50%{transform:scale(1.06);} }
      `}</style>

      {/* 헤더 */}
      <header
        className="shrink-0 flex items-center gap-3 px-4 pt-3 pb-3 bg-white border-b border-black/[0.05]"
        style={anim(0)}
      >
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 active:bg-slate-200 transition-colors shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </button>
        <h1 className="flex-1 text-[20px] font-black text-slate-900 tracking-tight">등급</h1>
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full relative overflow-hidden"
          style={{
            background: "linear-gradient(115deg, #FFE8EC 0%, #FFD6DC 100%)",
            boxShadow: "0 2px 8px rgba(255,51,85,0.18), inset 0 1px 0 rgba(255,255,255,0.7)",
          }}
        >
          <Zap className="w-3.5 h-3.5 text-[#FF3355]" strokeWidth={2.6} fill="#FF3355" />
          <span className="text-[13px] font-black text-[#FF3355] tabular-nums">
            {xpDisplay.toLocaleString()} XP
          </span>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto pb-10">
        <div className="px-4 pt-4 pb-2 space-y-4">

          {/* 현재 등급 메인 카드 — 챌리 빨강 그라데이션 (참가권/통계 배너와 통일) */}
          <div
            className="relative overflow-hidden rounded-2xl p-5"
            style={{
              ...anim(40),
              background: "linear-gradient(135deg, #FF3355 0%, #E8254A 50%, #C8002B 100%)",
            }}
          >
            {/* 코너 광원 */}
            <div
              className="pointer-events-none absolute -top-14 -right-14 w-52 h-52 rounded-full opacity-25"
              style={{ background: "radial-gradient(circle, #fff, transparent 70%)" }}
            />
            <div
              className="pointer-events-none absolute -bottom-12 -left-12 w-44 h-44 rounded-full opacity-15"
              style={{ background: "radial-gradient(circle, #fff, transparent 70%)" }}
            />

            <div className="relative">
              {/* 상단: 라벨 + 달성 통계 */}
              <div className="flex items-center justify-between mb-4">
                <div
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                  style={{
                    background: "rgba(255,255,255,0.18)",
                    border: "1px solid rgba(255,255,255,0.28)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <Crown className="w-3 h-3 text-white" fill="white" />
                  <p className="text-white text-[10px] font-black uppercase tracking-[0.16em]">현재 등급</p>
                </div>
                <div
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                  style={{
                    background: "rgba(255,255,255,0.18)",
                    border: "1px solid rgba(255,255,255,0.28)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <Sparkles className="w-3 h-3 text-white" strokeWidth={2.6} />
                  <span className="text-white text-[11px] font-black tabular-nums">
                    {reachedCount}/{GRADES.length}
                  </span>
                </div>
              </div>

              {/* 중앙: 흰 글래스 뱃지 + 등급 정보 */}
              <div className="flex items-center gap-4">
                <div
                  className="relative w-[84px] h-[84px] rounded-2xl flex flex-col items-center justify-center shrink-0 overflow-hidden"
                  style={{
                    background: "rgba(255,255,255,0.20)",
                    border: "2px solid rgba(255,255,255,0.45)",
                    backdropFilter: "blur(12px)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), 0 6px 18px rgba(0,0,0,0.12)",
                    opacity: mounted ? 1 : 0,
                    transform: mounted ? "scale(1)" : "scale(0.55)",
                    transition: "opacity 0.5s ease 0.1s, transform 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.1s",
                  }}
                >
                  {/* 광택 */}
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background: "linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.30) 50%, transparent 70%)",
                      animation: "rw-shine 3.5s ease 0.5s infinite",
                    }}
                  />
                  {/* 상단 highlight */}
                  <div
                    className="pointer-events-none absolute top-0 left-0 right-0 h-1/2 rounded-t-2xl"
                    style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.20), transparent)" }}
                  />
                  <span className="relative text-white text-[10px] font-black tracking-widest leading-none"
                    style={{ textShadow: "0 1px 2px rgba(0,0,0,0.15)" }}>
                    {currentGrade.code}
                  </span>
                  <span className="relative text-white text-[22px] font-black mt-1 leading-none"
                    style={{ textShadow: "0 1px 2px rgba(0,0,0,0.15)" }}>
                    Lv.{currentGrade.level}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <h2 className="text-white text-[28px] font-black leading-tight tracking-tight">
                    {currentGrade.name}
                  </h2>
                  <p className="text-white/70 text-[12px] mt-1 font-medium">
                    {nextGrade
                      ? <>다음 등급 <span className="font-black text-white">{nextGrade.name}</span></>
                      : "최고 등급 달성"}
                  </p>
                </div>
              </div>

              {/* 진행 바 */}
              <div className="mt-5">
                <div className="flex justify-between mb-1.5">
                  <span className="text-white text-[12px] font-black tabular-nums">
                    {xpDisplay.toLocaleString()} XP
                  </span>
                  <span className="text-white/60 text-[12px] font-bold tabular-nums">
                    {nextGrade ? `${nextGrade.minXp.toLocaleString()} XP` : "MAX"}
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full overflow-hidden bg-white/15">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: mounted ? `${progressPct}%` : "0%",
                      background: "linear-gradient(90deg, #ffffff, rgba(255,255,255,0.75))",
                      boxShadow: "0 0 10px rgba(255,255,255,0.45), inset 0 1px 0 rgba(255,255,255,0.6)",
                      transition: "width 1.2s cubic-bezier(0.4,0,0.2,1) 0.5s",
                    }}
                  />
                </div>
                <p className="text-white/65 text-[11px] mt-2.5 text-center font-medium">
                  {nextGrade
                    ? <>다음 등급까지 <span className="font-black text-white tabular-nums">{xpToNext.toLocaleString()} XP</span></>
                    : <span className="inline-flex items-center gap-1 font-bold text-white"><Sparkles className="w-3.5 h-3.5" strokeWidth={2.6} />모든 등급 달성</span>
                  }
                </p>
              </div>
            </div>
          </div>

          {/* 다음 도전 목표 — 다음 등급 색 옅은 그라데이션 */}
          {nextGrade && (
            <div
              className="rounded-2xl border relative overflow-hidden"
              style={{
                ...anim(140),
                background: `
                  linear-gradient(135deg, ${nextGrade.color}10 0%, #ffffff 55%, ${nextGrade.color}06 100%),
                  #ffffff
                `,
                borderColor: `${nextGrade.color}22`,
                boxShadow: `${CARD_SHADOW}, 0 0 18px ${nextGrade.color}08`,
              }}
            >
              <div
                className="pointer-events-none absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-60"
                style={{ background: `radial-gradient(circle, ${nextGrade.color}25, transparent 70%)` }}
              />

              <div className="relative p-5">
                <div
                  className="inline-flex items-center gap-1.5 mb-3.5 px-2.5 py-1.5 rounded-lg"
                  style={{
                    background: `${nextGrade.color}14`,
                    border: `1px solid ${nextGrade.color}30`,
                  }}
                >
                  <Target className="w-3 h-3" style={{ color: nextGrade.color }} strokeWidth={2.6} />
                  <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: nextGrade.color }}>
                    다음 도전 목표
                  </p>
                </div>

                <div className="flex items-center gap-4 relative z-10">
                  <GradeBadge
                    color={nextGrade.color}
                    glow={nextGrade.glow}
                    code={nextGrade.code}
                    level={nextGrade.level}
                    size={64}
                    mounted={mounted}
                    delay={200}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[20px] font-black leading-tight" style={{ color: nextGrade.color }}>
                      {nextGrade.name}
                    </h3>
                    <p className="text-[12px] text-slate-500 mt-1">
                      필요 XP <span className="font-black text-slate-800 tabular-nums">{nextGrade.minXp.toLocaleString()}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-4 relative z-10">
                  <div className="flex justify-between mb-1.5">
                    <span className="text-[12px] font-black text-slate-700 tabular-nums">{Math.round(progressPct)}%</span>
                    <span className="text-[12px] font-black tabular-nums" style={{ color: nextGrade.color }}>
                      {xpToNext.toLocaleString()} XP 남음
                    </span>
                  </div>
                  <div
                    className="w-full h-2.5 rounded-full overflow-hidden"
                    style={{ background: `${nextGrade.color}12` }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: mounted ? `${progressPct}%` : "0%",
                        background: `linear-gradient(90deg, ${nextGrade.color}, ${nextGrade.color}CC)`,
                        boxShadow: `0 0 8px ${nextGrade.glow}, inset 0 1px 0 rgba(255,255,255,0.4)`,
                        transition: "width 1.2s cubic-bezier(0.4,0,0.2,1) 0.5s",
                      }}
                    />
                  </div>
                  <p className="text-[12px] text-slate-500 mt-3 leading-relaxed">
                    챌린지를 인증하고 XP를 모아 <span className="font-black" style={{ color: nextGrade.color }}>{nextGrade.name}</span> 등급에 도전해보세요.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 등급 로드맵 */}
          <div style={anim(220)}>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 ml-1 mb-2 mt-3">등급 로드맵</p>
            <div
              className="bg-white rounded-2xl border border-black/[0.04] overflow-hidden"
              style={{ boxShadow: CARD_SHADOW }}
            >
              {GRADES.map((g, i) => {
                const reached = xpTotal >= g.minXp;
                const isCurrent = g.level === currentGrade.level;
                const isNext = nextGrade && g.level === nextGrade.level;
                return (
                  <div
                    key={g.level}
                    className="flex items-center gap-3.5 pl-5 pr-4 py-3.5 relative"
                    style={{
                      background: isCurrent
                        ? `linear-gradient(90deg, ${g.color}12 0%, ${g.color}06 100%)`
                        : reached
                          ? `linear-gradient(90deg, ${g.color}06 0%, transparent 100%)`
                          : "transparent",
                      borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.04)",
                    }}
                  >
                    {/* 좌측 컬러 라인 */}
                    {(reached || isNext) && (
                      <div
                        className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
                        style={{
                          background: reached
                            ? `linear-gradient(180deg, ${g.color}, ${g.color}99)`
                            : `${g.color}40`,
                          boxShadow: isCurrent ? `0 0 6px ${g.color}80` : "none",
                        }}
                      />
                    )}

                    <div
                      className="rounded-xl flex flex-col items-center justify-center shrink-0 relative overflow-hidden"
                      style={{
                        width: 44,
                        height: 44,
                        background: reached
                          ? `linear-gradient(140deg, ${g.color}45 0%, ${g.color}1A 45%, ${g.color}55 100%)`
                          : "linear-gradient(140deg, #F1F5F9 0%, #E2E8F0 100%)",
                        border: `2px solid ${reached ? `${g.color}70` : "#E2E8F0"}`,
                        boxShadow: isCurrent
                          ? `inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 14px ${g.glow}, 0 0 0 3px ${g.color}10`
                          : reached
                            ? `inset 0 1px 0 rgba(255,255,255,0.35)`
                            : "none",
                      }}
                    >
                      {reached && (
                        <div
                          className="pointer-events-none absolute top-0 left-0 right-0 h-1/2"
                          style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.18), transparent)" }}
                        />
                      )}
                      <span className="relative text-[7px] font-black tracking-widest leading-none"
                        style={{ color: reached ? g.color : "#94A3B8" }}>{g.code}</span>
                      <span className="relative text-[10px] font-black mt-0.5 leading-none"
                        style={{ color: reached ? g.color : "#94A3B8" }}>Lv.{g.level}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[14px] font-black"
                          style={{ color: reached ? g.color : "#94A3B8" }}>{g.name}</p>
                        {isCurrent && (
                          <span
                            className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md text-white"
                            style={{
                              background: `linear-gradient(115deg, ${g.color}, ${g.color}CC)`,
                              boxShadow: `0 2px 6px ${g.glow}`,
                              animation: "rw-pulse 2.4s ease-in-out infinite",
                            }}
                          >NOW</span>
                        )}
                        {isNext && (
                          <span
                            className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md"
                            style={{ background: `${g.color}1A`, color: g.color, border: `1px solid ${g.color}40` }}
                          >NEXT</span>
                        )}
                      </div>
                      <p className="text-[11px] mt-0.5 font-medium tabular-nums"
                        style={{ color: reached ? "#64748B" : "#CBD5E1" }}>
                        {g.minXp.toLocaleString()} XP
                      </p>
                    </div>

                    <div className="shrink-0">
                      {reached ? (
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center"
                          style={{
                            background: `linear-gradient(135deg, ${g.color}, ${g.color}CC)`,
                            boxShadow: `0 2px 6px ${g.glow}, inset 0 1px 0 rgba(255,255,255,0.4)`,
                          }}
                        >
                          <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
                          <Lock className="w-3 h-3 text-slate-300" strokeWidth={2.4} />
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
