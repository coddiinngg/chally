import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Flame, TrendingUp, TrendingDown, Minus, Target, Calendar, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../contexts/AppContext";
import type { Verification } from "../types/database";
import { useScrollRestoration, isReturningVisit, usePersistedNumber } from "../lib/useScrollRestoration";

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const daysFromMonday = (next.getDay() + 6) % 7;
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - daysFromMonday);
  return next;
}

function formatMonthDay(date: Date) {
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function diffDays(start: Date, end: Date) {
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

interface WeekData {
  label: string;
  startDate: string;
  endDate: string;
  days: boolean[];
  totalDone: number;
  totalXP: number;
  prevTotalXP: number;
}

function buildWeekData(label: string, weekStart: Date, verifications: Verification[]): WeekData {
  const previousWeekStart = addDays(weekStart, -7);

  const days = Array.from({ length: 7 }, (_, i) => {
    const dayStart = addDays(weekStart, i);
    const dayEnd = addDays(weekStart, i + 1);
    return verifications.some(v => {
      const d = new Date(v.verified_at);
      return d >= dayStart && d < dayEnd;
    });
  });

  const totalXP = verifications
    .filter(v => {
      const index = diffDays(weekStart, new Date(v.verified_at));
      return index >= 0 && index < 7;
    })
    .reduce((sum, v) => sum + v.xp_earned, 0);

  const prevTotalXP = verifications
    .filter(v => {
      const index = diffDays(previousWeekStart, new Date(v.verified_at));
      return index >= 0 && index < 7;
    })
    .reduce((sum, v) => sum + v.xp_earned, 0);

  return {
    label,
    startDate: formatMonthDay(weekStart),
    endDate: formatMonthDay(addDays(weekStart, 6)),
    days,
    totalDone: days.filter(Boolean).length,
    totalXP,
    prevTotalXP,
  };
}

function useCountUp(target: number, duration = 900, delay = 0) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf: number;
    const t = setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - start) / duration, 1);
        setVal(Math.round((1 - Math.pow(1 - p, 3)) * target));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); };
  }, [target, duration, delay]);
  return val;
}

function Trend({ curr, prev }: { curr: number; prev: number }) {
  const diff = curr - prev;
  if (diff > 0) return (
    <div className="flex items-center gap-0.5 text-emerald-500">
      <TrendingUp className="w-3 h-3" />
      <span className="text-[10px] font-black">+{diff} XP</span>
    </div>
  );
  if (diff < 0) return (
    <div className="flex items-center gap-0.5 text-red-400">
      <TrendingDown className="w-3 h-3" />
      <span className="text-[10px] font-black">{diff} XP</span>
    </div>
  );
  return (
    <div className="flex items-center gap-0.5 text-slate-400">
      <Minus className="w-3 h-3" />
      <span className="text-[10px] font-black">0 XP</span>
    </div>
  );
}

export function WeeklyReport() {
  const navigate = useNavigate();
  const { nickname, verificationHistory } = useApp();
  const [weekIdx, setWeekIdx] = usePersistedNumber("wr-week-idx", 0);
  const [mounted, setMounted] = useState(() => isReturningVisit("wr-scroll"));
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollRestoration("wr-scroll", scrollRef);

  const completed = verificationHistory.filter(v => v.status === "completed");
  const currentWeekStart = startOfWeek(new Date());
  const weeks = [
    buildWeekData("이번 주", currentWeekStart, completed),
    buildWeekData("지난 주", addDays(currentWeekStart, -7), completed),
  ];

  useEffect(() => {
    if (mounted) return;
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const week = weeks[weekIdx];
  const overallRate = Math.round((week.totalDone / 7) * 100);
  const xpCounted = useCountUp(mounted ? week.totalXP : 0, 1000, 500);
  const xpDiff = week.totalXP - week.prevTotalXP;

  const streakDays = (() => {
    let s = 0;
    for (let i = week.days.length - 1; i >= 0; i--) {
      if (!week.days[i]) break;
      s++;
    }
    return s;
  })();

  return (
    <div className="flex flex-col h-full bg-[#F8F8FA] overflow-hidden">
      <style>{`
        @keyframes wr-in { from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);} }
      `}</style>

      {/* 헤더 */}
      <div
        className="shrink-0 flex items-center px-4 pt-4 pb-3 bg-white border-b border-black/[0.05]"
        style={{ animation: "wr-in 0.4s ease both" }}
      >
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 active:bg-slate-200 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-700" />
        </button>
        <div className="flex-1 ml-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#FF3355]">통계</p>
          <h1 className="text-[20px] font-black text-slate-900 tracking-tight">주간 리포트</h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekIdx(i => Math.min(weeks.length - 1, i + 1))}
            disabled={weekIdx === weeks.length - 1}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 disabled:opacity-30 active:bg-slate-200 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <span className="text-[13px] font-bold text-slate-700 w-14 text-center">{week.label}</span>
          <button
            onClick={() => setWeekIdx(i => Math.max(0, i - 1))}
            disabled={weekIdx === 0}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 disabled:opacity-30 active:bg-slate-200 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto pb-8">

        {/* 히어로 배너 */}
        <div
          className="relative overflow-hidden mx-4 mt-4 rounded-3xl p-5"
          style={{
            background: "linear-gradient(160deg, #FF3355 0%, #CC0030 55%, #A00025 100%)",
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 0.5s ease 60ms, transform 0.5s cubic-bezier(0.34,1.56,0.64,1) 60ms",
          }}
        >
          <div className="pointer-events-none absolute -top-8 -right-8 w-44 h-44 rounded-full bg-white/[0.07]" />
          <div className="pointer-events-none absolute bottom-0 left-0 w-32 h-32 rounded-full bg-black/[0.06]" />

          <div className="relative z-10 flex items-end justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar className="w-3.5 h-3.5 text-white/50" />
                <span className="text-[11px] text-white/50 font-bold">
                  {week.startDate} – {week.endDate}
                </span>
              </div>
              <p className="text-white/60 text-[12px] font-bold uppercase tracking-widest mb-1">인증 달성률</p>
              <div className="flex items-baseline gap-1.5 mb-3">
                <span className="text-[48px] font-black text-white leading-none">{overallRate}</span>
                <span className="text-[18px] text-white/70 font-bold">%</span>
                {xpDiff > 0 && (
                  <span className="text-[12px] font-black text-emerald-300 ml-1">▲ {xpDiff} XP</span>
                )}
              </div>
              <div className="w-48 h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: mounted ? `${overallRate}%` : "0%",
                    background: "rgba(255,255,255,0.85)",
                    boxShadow: "0 0 8px rgba(255,255,255,0.3)",
                    transition: "width 1.2s cubic-bezier(0.4,0,0.2,1) 0.3s",
                  }}
                />
              </div>
              <p className="text-white/40 text-[11px] mt-1.5">{week.totalDone}일 / 7일 인증 완료</p>
            </div>
          </div>
        </div>

        <div className="px-4 space-y-4 mt-4">

          {/* 핵심 지표 */}
          <div
            className="grid grid-cols-3 gap-2"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(12px)",
              transition: "opacity 0.5s ease 280ms, transform 0.5s ease 280ms",
            }}
          >
            {[
              { icon: Target, label: "인증한 날",  value: week.totalDone, suffix: "일",  color: "#FF3355", bg: "#FFF0F3" },
              { icon: Zap,    label: "획득 XP",    value: xpCounted,      suffix: " XP", color: "#f59e0b", bg: "#fffbeb" },
              { icon: Flame,  label: "연속 인증",  value: streakDays,     suffix: "일",  color: "#6366f1", bg: "#eef2ff" },
            ].map(({ icon: Icon, label, value, suffix, color, bg }) => (
              <div key={label} className="bg-white rounded-2xl p-3.5 border border-black/[0.04] text-center">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ background: bg }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <p className="text-[18px] font-black leading-none text-slate-900">
                  {value}<span className="text-[10px] font-semibold text-slate-400 ml-0.5">{suffix}</span>
                </p>
                <p className="text-[10px] text-slate-400 mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* 요일별 인증 현황 */}
          <div
            className="bg-white rounded-2xl p-4 border border-black/[0.04]"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(12px)",
              transition: "opacity 0.5s ease 360ms, transform 0.5s ease 360ms",
              boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
            }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-3">요일별 인증</p>
            <div className="flex gap-1.5">
              {DAYS.map((d, i) => (
                <div key={d} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-lg transition-all duration-500"
                    style={{
                      height: 40,
                      background: week.days[i]
                        ? "linear-gradient(160deg, #FF3355, #CC0030)"
                        : "rgba(0,0,0,0.05)",
                      boxShadow: week.days[i] ? "0 2px 8px rgba(255,51,85,0.25)" : "none",
                      transitionDelay: `${i * 60 + 400}ms`,
                    }}
                  >
                    {week.days[i] && (
                      <div className="flex items-center justify-center h-full">
                        <span className="text-white text-[12px]">✓</span>
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] text-slate-400 font-semibold">{d}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 지난 주 대비 XP */}
          <div
            className="bg-white rounded-2xl p-4 border border-black/[0.04]"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(12px)",
              transition: "opacity 0.5s ease 480ms, transform 0.5s ease 480ms",
            }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-3">지난 주 대비</p>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: "#FF3355" }} />
              <span className="text-[13px] text-slate-600 flex-1 font-medium">XP 획득량</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] text-slate-400 font-semibold">{week.prevTotalXP} XP</span>
                <span className="text-slate-200">→</span>
                <span className="text-[13px] font-black text-[#FF3355]">{week.totalXP} XP</span>
                <Trend curr={week.totalXP} prev={week.prevTotalXP} />
              </div>
            </div>
          </div>

          {/* 다음 주 응원 */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(110deg, #1A1A2E, #16213E)",
              border: "1px solid rgba(255,255,255,0.08)",
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(12px)",
              transition: "opacity 0.5s ease 560ms, transform 0.5s ease 560ms",
            }}
          >
            <div className="p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-1">다음 주 도전</p>
              <p className="text-white font-black text-[16px] mb-3">{nickname}님, 계속 이어가요!</p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-white/10">
                  <Target className="w-4 h-4 text-[#FF3355]" />
                </div>
                <div className="flex-1">
                  <p className="text-white/80 text-[12px] font-bold">매일 인증 챌린지</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-white/30 text-[11px]">{overallRate}% →</span>
                    <span className="text-[11px] font-black text-[#FF3355]">
                      {Math.min(100, Math.round(overallRate + (100 - overallRate) / 2))}%
                    </span>
                    <span className="text-[10px] text-white/30">목표</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
