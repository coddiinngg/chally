import React, { useState, useEffect, useRef } from "react";
import { TrendingUp, Flame, Calendar, Trophy, ChevronRight, ChevronLeft, Users, Award, Zap, Sparkles } from "lucide-react";
import { useApp } from "../contexts/AppContext";
import { useAuth } from "../contexts/AuthContext";
import { useScrollRestoration, isReturningVisit, usePersistedNumber } from "../lib/useScrollRestoration";

const CARD_SHADOW = "0 2px 8px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.04)";

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

const HEAT_COLORS = [
  "bg-slate-100",
  "bg-[#FFD6DC]",
  "bg-[#FF9DB2]",
  "bg-[#FF3355]",
];

function Ring({ pct, size = 96 }: { pct: number; size?: number }) {
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const [dash, setDash] = useState(circ);
  useEffect(() => {
    const t = setTimeout(() => setDash(circ * (1 - pct)), 350);
    return () => clearTimeout(t);
  }, [pct, circ]);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <defs>
        <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF3355" />
          <stop offset="100%" stopColor="#FF6680" />
        </linearGradient>
      </defs>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F1F1F1" strokeWidth={7} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="url(#ringGrad)" strokeWidth={7}
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={dash}
        style={{ transition: "stroke-dashoffset 1.3s cubic-bezier(0.4,0,0.2,1)" }} />
    </svg>
  );
}

function CalendarHeatmap({
  mounted,
  calData,
  year,
  month,
  today,
  isCurrentMonth,
}: {
  mounted: boolean;
  calData: Record<number, number>;
  year: number;
  month: number;
  today: number;
  isCurrentMonth: boolean;
}) {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dow = ["일", "월", "화", "수", "목", "금", "토"];

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {dow.map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-slate-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />;
          const level = calData[day] ?? 0;
          const isFuture = isCurrentMonth && day > today;
          const isToday = isCurrentMonth && day === today;
          return (
            <div
              key={day}
              className={[
                "aspect-square rounded-lg flex items-center justify-center text-[11px] font-bold transition-all duration-300",
                isFuture ? "bg-slate-50 text-slate-300" : HEAT_COLORS[level],
                isToday ? "ring-2 ring-[#FF3355] ring-offset-1" : "",
                level >= 2 ? "text-white" : level === 1 ? "text-[#FF3355]" : "text-slate-400",
              ].join(" ")}
              style={{
                opacity: mounted ? 1 : 0,
                transform: mounted ? "scale(1)" : "scale(0.6)",
                transition: `opacity 0.3s ease ${i * 15}ms, transform 0.3s cubic-bezier(0.34,1.56,0.64,1) ${i * 15}ms`,
              }}
            >
              {day}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-1.5 mt-3 justify-end">
        <span className="text-[10px] text-slate-400">적음</span>
        {HEAT_COLORS.map((c, i) => (
          <div key={i} className={`w-4 h-4 rounded ${c}`} />
        ))}
        <span className="text-[10px] text-slate-400">많음</span>
      </div>
    </div>
  );
}

export function Stats() {
  const { verificationHistory, verificationLoading, groups } = useApp();
  const { profile } = useAuth();
  const [mounted, setMounted] = useState(() => isReturningVisit("st-scroll"));
  const [calOffset, setCalOffset] = usePersistedNumber("st-cal-offset", 0);
  const calendarRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollRestoration("st-scroll", scrollRef, !verificationLoading);
  const completedVerifications = verificationHistory.filter(item => item.status === "completed");
  const now = new Date();
  const calendarDate = new Date(now.getFullYear(), now.getMonth() + calOffset, 1);
  const calYear = calendarDate.getFullYear();
  const calMonthIndex = calendarDate.getMonth();
  const isCurrentMonth = calOffset === 0;
  const calToday = isCurrentMonth ? now.getDate() : new Date(calYear, calMonthIndex + 1, 0).getDate();

  // 월간 히트맵 데이터
  const calData: Record<number, number> = {};

  // 주간 데이터
  const startOfWeek = new Date();
  const currentDay = startOfWeek.getDay();
  const daysFromMonday = (currentDay + 6) % 7;
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - daysFromMonday);

  const weeklyCounts = Array.from({ length: 7 }, () => 0);
  const previousWeekCounts = Array.from({ length: 7 }, () => 0);
  const previousWeekStart = new Date(startOfWeek);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);

  completedVerifications.forEach(item => {
    const verifiedAt = new Date(item.verified_at);

    // 주간
    const diffMs = verifiedAt.getTime() - startOfWeek.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays < 7) weeklyCounts[diffDays] += 1;

    const prevDiffMs = verifiedAt.getTime() - previousWeekStart.getTime();
    const prevDiffDays = Math.floor(prevDiffMs / (1000 * 60 * 60 * 24));
    if (prevDiffDays >= 0 && prevDiffDays < 7) previousWeekCounts[prevDiffDays] += 1;

    // 월간 히트맵
    if (verifiedAt.getFullYear() === calYear && verifiedAt.getMonth() === calMonthIndex && verifiedAt.getDate() <= calToday) {
      calData[verifiedAt.getDate()] = Math.min((calData[verifiedAt.getDate()] ?? 0) + 1, 3);
    }
  });

  const maxWeeklyCount = Math.max(...weeklyCounts, 0);
  const weeklyTotalDone = weeklyCounts.reduce((sum, count) => sum + count, 0);
  const previousWeeklyTotalDone = previousWeekCounts.reduce((sum, count) => sum + count, 0);
  const weeklyDiff = weeklyTotalDone - previousWeeklyTotalDone;
  const bars = weeklyCounts.map((count, idx) => ({
    day: ["월", "화", "수", "목", "금", "토", "일"][idx],
    hi: count === maxWeeklyCount && count > 0,
    count,
  }));
  const bestBar = maxWeeklyCount > 0 ? bars.find(item => item.hi) ?? null : null;

  // 연속 스트릭 (날짜 기준)
  const completedDaySet = new Set(
    completedVerifications.map(item => {
      const d = new Date(item.verified_at);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    })
  );
  let maxStreak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  if (!completedDaySet.has(fmt(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (completedDaySet.has(fmt(cursor))) {
    maxStreak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const totalDone = completedVerifications.length;
  const doneDays = Object.values(calData).filter(v => v > 0).length;
  const daysInMonth = new Date(calYear, calMonthIndex + 1, 0).getDate();
  const missedDays = Math.max(0, calToday - doneDays);
  const remainingDays = isCurrentMonth ? daysInMonth - calToday : 0;
  // 달성률: 이번 달 오늘까지 중 인증 있는 날 비율
  const successRate = calToday > 0 ? Math.round((doneDays / calToday) * 100) : 0;

  // 참여 중인 챌린지 수 (ACTIVE/EXIT_ELIGIBLE) — LEFT/REMOVED는 제외
  const joinedCount = groups.filter(g => g.joined).length;

  // 프로필 벤토용 통계
  const currentStreak = profile?.streak_count ?? 0;
  const uniqueDaysLast30 = new Set(
    completedVerifications
      .filter(v => Date.now() - new Date(v.verified_at).getTime() < 30 * 86400000)
      .map(v => v.verified_at.slice(0, 10))
  ).size;
  const last30Rate = Math.round((uniqueDaysLast30 / 30) * 100);
  const xpAnim = useCountUp(totalDone, 900, 100);
  const streakAnim = useCountUp(currentStreak, 900, 200);
  const rateAnim = useCountUp(last30Rate, 900, 300);

  const MONTH_NAMES = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
  const calMonth = `${calYear}년 ${MONTH_NAMES[calMonthIndex]}`;

  useEffect(() => {
    if (mounted) return;
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  const slide = (delay: number): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(16px)",
    transition: `opacity 0.5s ease ${delay}ms, transform 0.5s cubic-bezier(0.4,0,0.2,1) ${delay}ms`,
  });

  if (verificationLoading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-3 bg-[#F8F8FA]">
        <div className="flex gap-1.5">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-slate-300"
              style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
          ))}
        </div>
        <p className="text-slate-400 text-[13px] font-semibold">통계 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[#F8F8FA]">
      <style>{`
        @keyframes st-fade { from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);} }
        @keyframes st-pop  { 0%{opacity:0;transform:scale(0.85);}60%{transform:scale(1.04);}100%{opacity:1;transform:scale(1);} }
      `}</style>

      {/* 헤더 */}
      <header
        className="shrink-0 flex items-center justify-between px-5 pt-3 pb-2 bg-white border-b border-black/[0.05]"
        style={{ animation: "st-fade 0.4s ease both" }}
      >
        <h1 className="text-[20px] font-black text-slate-900 tracking-tight">통계</h1>
        <button
          type="button"
          onClick={() => calendarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#FFE8EC] active:scale-95 transition-all"
          aria-label="월간 인증 현황으로 이동"
        >
          <Calendar className="w-4 h-4 text-[#FF3355]" />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-3 pb-5 space-y-4">

        {/* 주간 차트 */}
        <div className="rounded-3xl p-5 relative overflow-hidden bg-white border border-black/[0.04] shadow-[0_4px_20px_rgba(0,0,0,0.05)]"
          style={{ animation: "st-fade 0.45s ease 60ms both" }}>
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-[11px] text-slate-400 mb-1">이번 주 인증</p>
              <div className="flex items-baseline gap-2">
                <span className="text-[40px] font-black text-slate-900 leading-none">{weeklyTotalDone}</span>
                <span className="text-[14px] text-slate-400">회</span>
                {weeklyDiff !== 0 && (
                  <span className={`flex items-center gap-0.5 rounded-lg px-2 py-0.5 text-[11px] font-bold ${weeklyDiff > 0 ? "text-emerald-600 bg-emerald-50" : "text-slate-500 bg-slate-100"}`}>
                    <TrendingUp className="w-3 h-3" /> {weeklyDiff > 0 ? `+${weeklyDiff}` : weeklyDiff}회
                  </span>
                )}
              </div>
            </div>
          </div>
          {weeklyTotalDone > 0 ? (
            <div className="flex items-end gap-1.5" style={{ height: 100 }}>
              {bars.map(({ day, hi, count }, idx) => (
                <div key={day} className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-full relative rounded-lg overflow-hidden bg-slate-100 flex flex-col-reverse gap-[3px] p-1.5" style={{ height: 80 }}>
                    {Array.from({ length: count }).map((_, i) => (
                      <div key={i} className="w-full rounded-[3px] shrink-0"
                        style={{
                          height: 7,
                          background: hi ? "linear-gradient(90deg, #FF6680 0%, #FF3355 100%)" : "rgba(255,51,85,0.45)",
                          opacity: mounted ? 1 : 0,
                          transform: mounted ? "translateY(0)" : "translateY(6px)",
                          transition: "opacity 0.35s ease, transform 0.35s cubic-bezier(0.4,0,0.2,1)",
                          transitionDelay: `${idx * 50 + i * 70 + 100}ms`,
                        }} />
                    ))}
                  </div>
                  <span className="text-[9px] text-slate-300 leading-none">{count > 0 ? `${count}회` : "\u00A0"}</span>
                  <span className={`text-[10px] font-bold ${hi ? "text-[#FF3355]" : "text-slate-400"}`}>{day}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[100px] rounded-2xl bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center text-center px-6">
              <p className="text-[12px] text-slate-400 leading-relaxed">이번 주 인증 기록이 아직 없어요. 챌린지에 참여해 첫 인증을 남겨보세요.</p>
            </div>
          )}
        </div>

        {/* 프로필 벤토 — 총 달성 / 연속 / 성공률 */}
        <div className="grid grid-cols-2 gap-3" style={slide(140)}>
          {/* 달성 (큰 타일, row-span-2) */}
          <div
            className="row-span-2 bg-white rounded-2xl border border-black/[0.04] p-5 flex flex-col justify-between min-h-[180px]"
            style={{ boxShadow: CARD_SHADOW }}
          >
            <div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center mb-3.5">
                <Trophy className="w-5 h-5 text-amber-500" strokeWidth={2.4} />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.14em]">총 인증</p>
            </div>
            <div>
              <p className="text-[36px] font-black text-slate-900 leading-none tabular-nums">
                {xpAnim}<span className="text-[15px] text-slate-400 ml-1 font-bold">회</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-2 font-medium">전체 인증</p>
            </div>
          </div>

          {/* 연속 */}
          <div
            className="bg-white rounded-2xl border border-black/[0.04] p-4 flex items-center gap-3"
            style={{ boxShadow: CARD_SHADOW }}
          >
            <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
              <Flame className="w-5 h-5 text-orange-500" strokeWidth={2.4} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.14em] mb-1">연속</p>
              <p className="text-[22px] font-black text-slate-900 leading-none tabular-nums">
                {streakAnim}<span className="text-[12px] text-slate-400 ml-1 font-bold">일</span>
              </p>
            </div>
          </div>

          {/* 성공률 */}
          <div
            className="bg-white rounded-2xl border border-black/[0.04] p-4 flex items-center gap-3"
            style={{ boxShadow: CARD_SHADOW }}
          >
            <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-emerald-500" strokeWidth={2.4} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.14em] mb-1">성공률</p>
              <p className="text-[22px] font-black text-slate-900 leading-none tabular-nums">
                {rateAnim}<span className="text-[12px] text-slate-400 ml-1 font-bold">%</span>
              </p>
            </div>
          </div>
        </div>

        {/* 인사이트 */}
        <div className="rounded-2xl px-4 py-3.5 flex items-center gap-3 bg-[#FFF5F7] border border-[#FFD6DC]"
          style={{ animation: "st-fade 0.45s ease 320ms both" }}>
          <div className="w-8 h-8 rounded-xl bg-[#FFE8EC] flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-[#FF3355]" />
          </div>
          <p className="text-[13px] text-slate-600 leading-relaxed">
            {bestBar
              ? <><span className="text-[#FF3355] font-bold">{bestBar.day}요일</span>에 인증이 가장 많았어요. 이 패턴을 유지하면 챌린지 순위가 쭉쭉 올라갈 거예요.</>
              : <>아직 누적 인증이 없어요. 챌린지에 참여해 오늘 첫 인증을 남겨보세요.</>}
          </p>
        </div>

        {/* 미니 통계 — 벤토 스타일 */}
        <div className="grid grid-cols-2 gap-3" style={{ animation: "st-fade 0.45s ease 380ms both" }}>
          {[
            { Icon: Users, label: "참여 챌린지", value: joinedCount, suffix: "개", iconBg: "bg-violet-50", iconColor: "text-violet-500" },
            { Icon: Award, label: "최고 연속",   value: maxStreak,   suffix: "일", iconBg: "bg-rose-50",   iconColor: "text-rose-500" },
          ].map(({ Icon, label, value, suffix, iconBg, iconColor }) => (
            <div key={label}
              className="bg-white rounded-2xl border border-black/[0.04] p-4 flex flex-col gap-2.5"
              style={{ boxShadow: CARD_SHADOW }}>
              <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${iconColor}`} strokeWidth={2.4} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.14em] mb-1">{label}</p>
                <p className="text-[18px] font-black text-slate-900 leading-none tabular-nums">
                  {value}<span className="text-[11px] text-slate-400 ml-1 font-bold">{suffix}</span>
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* 월간 히트맵 달력 */}
        <div
          ref={calendarRef}
          className="bg-white rounded-3xl p-5 border border-black/[0.04] shadow-[0_4px_20px_rgba(0,0,0,0.05)]"
          style={slide(440)}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-0.5">월간 인증 현황</p>
              <h3 className="text-[16px] font-black text-slate-900">{calMonth}</h3>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setCalOffset((offset) => offset - 1)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 active:bg-slate-100 transition-colors"
                aria-label="이전 달 보기"
              >
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              </button>
              <button
                type="button"
                onClick={() => setCalOffset((offset) => Math.min(0, offset + 1))}
                disabled={calOffset === 0}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-40 disabled:active:bg-slate-50"
                aria-label="다음 달 보기"
              >
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
          <CalendarHeatmap
            mounted={mounted}
            calData={calData}
            year={calYear}
            month={calMonthIndex}
            today={calToday}
            isCurrentMonth={isCurrentMonth}
          />
          <div className="mt-4 pt-4 border-t border-slate-100 flex gap-4">
            <div className="flex-1 text-center">
              <p className="text-[22px] font-black text-[#FF3355] leading-none">{doneDays}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">인증일</p>
            </div>
            <div className="w-px bg-slate-100" />
            <div className="flex-1 text-center">
              <p className="text-[22px] font-black text-slate-700 leading-none">{missedDays}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">미인증</p>
            </div>
            <div className="w-px bg-slate-100" />
            <div className="flex-1 text-center">
              <p className="text-[22px] font-black text-slate-300 leading-none">{remainingDays}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">남은 날</p>
            </div>
          </div>
        </div>

        {/* 달성률 + 연속 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-3xl p-4 flex flex-col items-center justify-center bg-white border border-black/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
            style={{ minHeight: 150, animation: "st-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) 200ms both" }}>
            <div className="relative">
              <Ring pct={successRate / 100} size={90} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[20px] font-black text-slate-900">{successRate}%</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 font-semibold">이번 달 달성률</p>
          </div>
          <div className="rounded-3xl p-5 relative overflow-hidden bg-white border border-black/[0.04] shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex flex-col items-center justify-center"
            style={{ minHeight: 150, animation: "st-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) 280ms both" }}>
            <Zap className="w-7 h-7 mb-2" style={{ color: "#FF3355", fill: "#FF6680" }} />
            <p className="text-[36px] font-black text-slate-900 leading-none tabular-nums">{maxStreak}</p>
            <p className="text-[11px] text-slate-400 mt-2 font-semibold">일 연속</p>
          </div>
        </div>

        <div className="h-4" />
      </div>
    </div>
  );
}
