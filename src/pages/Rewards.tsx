import React, { useState, useEffect } from "react";
import { ArrowLeft, Lock, X, Zap, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../contexts/AppContext";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { GRADES, getGrade, getNextGrade } from "../lib/grades";

function computeCurrentStreak(verifications: { verified_at: string; status: string }[]) {
  const completedDays = new Set(
    verifications.filter(v => v.status === "completed").map(v => v.verified_at.slice(0, 10))
  );
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!completedDays.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (completedDays.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function formatRelativeTime(iso: string) {
  const now = new Date();
  const date = new Date(iso);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 5) return "방금";
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffDays === 0) return `${diffHours}시간 전`;
  if (diffDays === 1) return "어제";
  if (diffDays < 7) return `${diffDays}일 전`;
  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

/* ── 배지 정의 ── */
interface BadgeDef {
  id: string; emoji: string; label: string;
  desc: string; hint: string;
  color: string; glow: string; total: number;
}

const BADGE_DEFS: BadgeDef[] = [
  { id: "first_verify", emoji: "⚡", label: "첫 인증",   desc: "첫 인증을 완료했어요!",           hint: "모든 시작은 첫 걸음부터",          color: "#F59E0B", glow: "rgba(245,158,11,0.4)",  total: 1   },
  { id: "done_5",       emoji: "⭐", label: "5번 달성",  desc: "누적 5회 인증을 달성했어요!",      hint: "꾸준함이 습관을 만들어요",           color: "#6366F1", glow: "rgba(99,102,241,0.4)",  total: 5   },
  { id: "streak_7",     emoji: "🔥", label: "7일 연속",  desc: "7일 연속 인증을 달성했어요!",      hint: "일주일 내내 쉬지 않았어요 🔥",        color: "#FB923C", glow: "rgba(251,146,60,0.4)",  total: 7   },
  { id: "done_30",      emoji: "🎯", label: "30회 달성", desc: "누적 30회 인증을 달성해야 해요",   hint: "조금만 더!",                       color: "#FF3355", glow: "rgba(255,51,85,0.35)",  total: 30  },
  { id: "streak_30",    emoji: "🛡️", label: "30일 연속", desc: "30일 연속 인증을 달성해야 해요",   hint: "조금만 더!",                       color: "#10B981", glow: "rgba(16,185,129,0.35)", total: 30  },
  { id: "early_bird",   emoji: "🌅", label: "새벽 기상", desc: "오전 6시 이전에 인증해야 해요",    hint: "일찍 일어나는 새가 벌레를 잡아요",   color: "#0EA5E9", glow: "rgba(14,165,233,0.35)", total: 1   },
  { id: "streak_100",   emoji: "👑", label: "전설",      desc: "100일 연속 인증을 달성해야 해요",  hint: "포기하지 마요!",                   color: "#CC0030", glow: "rgba(204,0,48,0.35)",  total: 100 },
];

interface BadgeState {
  def: BadgeDef;
  unlocked: boolean;
  current: number;
  earnedAt: string | null;
  hint: string;
}

function computeBadges(
  verifications: { verified_at: string; status: string }[],
  streak: number,
): BadgeState[] {
  const completed = verifications
    .filter(v => v.status === "completed")
    .sort((a, b) => a.verified_at.localeCompare(b.verified_at));
  const totalDone = completed.length;
  const hasEarlyBird = completed.some(v => new Date(v.verified_at).getHours() < 6);

  return BADGE_DEFS.map(def => {
    let current = 0;
    let unlocked = false;
    let earnedAt: string | null = null;
    let hint = def.hint;

    switch (def.id) {
      case "first_verify":
        current = Math.min(totalDone, 1);
        unlocked = totalDone >= 1;
        if (unlocked) earnedAt = completed[0].verified_at.slice(0, 10).replace(/-/g, ".");
        break;
      case "done_5":
        current = Math.min(totalDone, 5);
        unlocked = totalDone >= 5;
        if (unlocked) earnedAt = completed[4].verified_at.slice(0, 10).replace(/-/g, ".");
        else hint = `${5 - totalDone}번 더 달성하면 획득!`;
        break;
      case "streak_7":
        current = Math.min(streak, 7);
        unlocked = streak >= 7;
        if (!unlocked) hint = `${7 - streak}일 더 하면 달성!`;
        break;
      case "done_30":
        current = Math.min(totalDone, 30);
        unlocked = totalDone >= 30;
        if (unlocked) earnedAt = completed[29].verified_at.slice(0, 10).replace(/-/g, ".");
        else hint = `${30 - totalDone}번 더 달성하면 획득!`;
        break;
      case "streak_30":
        current = Math.min(streak, 30);
        unlocked = streak >= 30;
        if (!unlocked) hint = `${30 - streak}일 더 하면 달성!`;
        break;
      case "early_bird":
        current = hasEarlyBird ? 1 : 0;
        unlocked = hasEarlyBird;
        break;
      case "streak_100":
        current = Math.min(streak, 100);
        unlocked = streak >= 100;
        if (!unlocked) hint = `${100 - streak}일 더 도전해봐요!`;
        break;
    }

    return { def, unlocked, current, earnedAt, hint };
  });
}

/* ── 배지 상세 바텀 시트 ── */
function BadgeSheet({ badge, onClose }: { badge: BadgeState | null; onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (badge) setTimeout(() => setVisible(true), 10);
    else setVisible(false);
  }, [badge]);

  if (!badge) return null;
  const pct = Math.round((badge.current / badge.def.total) * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: visible ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0)", transition: "background 0.3s ease" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl px-5 pt-5 pb-10 relative"
        style={{ transform: visible ? "translateY(0)" : "translateY(100%)", transition: "transform 0.38s cubic-bezier(0.32,0.72,0,1)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-5" />
        <button onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 active:bg-slate-200 transition-colors">
          <X className="w-4 h-4 text-slate-500" />
        </button>

        <div className="flex flex-col items-center mb-5">
          <div
            className="w-24 h-24 rounded-3xl flex items-center justify-center mb-3 relative"
            style={{
              background: badge.unlocked ? `${badge.def.color}15` : "#F1F5F9",
              border: `2.5px solid ${badge.unlocked ? badge.def.color + "30" : "#E2E8F0"}`,
              boxShadow: badge.unlocked ? `0 8px 32px ${badge.def.glow}` : "none",
            }}
          >
            <span className={`text-5xl ${badge.unlocked ? "" : "grayscale opacity-30"}`}>{badge.def.emoji}</span>
            {badge.unlocked && (
              <div className="absolute inset-0 rounded-3xl"
                style={{ background: `radial-gradient(circle at 30% 25%, ${badge.def.color}25, transparent 65%)` }} />
            )}
          </div>
          <h2 className="text-[20px] font-black text-slate-900">{badge.def.label}</h2>
          <p className="text-[14px] text-slate-500 mt-1 text-center">{badge.def.desc}</p>
        </div>

        {badge.unlocked ? (
          <div className="flex items-center gap-2 bg-emerald-50 rounded-2xl px-4 py-3 mb-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <div>
              <p className="text-[13px] font-bold text-emerald-700">획득 완료</p>
              {badge.earnedAt && <p className="text-[12px] text-emerald-600">{badge.earnedAt} 달성</p>}
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-2xl px-4 py-3 mb-4">
            <div className="flex justify-between text-[12px] font-bold mb-2">
              <span className="text-slate-600">진행도</span>
              <span style={{ color: badge.def.color }}>{badge.current} / {badge.def.total}</span>
            </div>
            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${badge.def.color}, ${badge.def.color}99)`,
                  boxShadow: `0 0 8px ${badge.def.glow}`,
                }}
              />
            </div>
            <p className="text-[12px] text-slate-400 mt-2">{badge.hint}</p>
          </div>
        )}

        {badge.unlocked && badge.hint && (
          <div className="bg-amber-50 rounded-2xl px-4 py-3 flex items-center gap-2">
            <span className="text-lg">💛</span>
            <p className="text-[13px] text-amber-700 font-medium">{badge.hint}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── XP 카운트업 훅 ── */
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

/* ── 메인 컴포넌트 ── */
export function Rewards() {
  const navigate = useNavigate();
  const { nickname } = useApp();
  const { user, profile } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<"badges" | "history">("badges");
  const [selectedBadge, setSelectedBadge] = useState<BadgeState | null>(null);
  const [badges, setBadges] = useState<BadgeState[]>([]);
  const [history, setHistory] = useState<{ label: string; xp: number; time: string; color: string }[]>([]);
  const [streak, setStreak] = useState(0);
  const [totalDone, setTotalDone] = useState(0);
  const [todayXp, setTodayXp] = useState(0);

  const xpTotal = profile?.xp_total ?? 0;
  const currentGrade = getGrade(xpTotal);
  const nextGrade = getNextGrade(currentGrade.level);
  const nextXp = nextGrade?.minXp ?? currentGrade.minXp;
  const xpDisplay = useCountUp(xpTotal, 1200, 400);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadData();
  }, [user?.id]);

  async function loadData() {
    const today = new Date().toISOString().slice(0, 10);
    const { data: verifications } = await supabase
      .from("verifications")
      .select("verified_at, status, xp_earned")
      .eq("user_id", user!.id)
      .order("verified_at", { ascending: false });

    const all = verifications ?? [];
    const completed = all.filter(v => v.status === "completed");

    const currentStreak = computeCurrentStreak(all);
    setStreak(currentStreak);
    setTotalDone(completed.length);
    setBadges(computeBadges(all, currentStreak));

    const todaySum = completed
      .filter(v => v.verified_at.slice(0, 10) === today)
      .reduce((s, v) => s + (v.xp_earned ?? 0), 0);
    setTodayXp(todaySum);

    setHistory(
      completed.slice(0, 20).map(v => ({
        label: "챌린지 인증",
        xp: v.xp_earned ?? 0,
        time: formatRelativeTime(v.verified_at),
        color: "#10B981",
      }))
    );
  }

  const anim = (delay: number, fromY = 16): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : `translateY(${fromY}px)`,
    transition: `opacity 0.45s ease ${delay}ms, transform 0.45s cubic-bezier(0.4,0,0.2,1) ${delay}ms`,
  });

  const unlocked = badges.filter(b => b.unlocked);
  const locked = badges.filter(b => !b.unlocked);
  const nextUp = [...locked]
    .sort((a, b) => (b.current / b.def.total) - (a.current / a.def.total))
    .slice(0, 2);

  return (
    <div className="flex flex-col h-full bg-[#F8F8FA] overflow-hidden">
      <style>{`
        @keyframes badge-pop  { 0%{opacity:0;transform:scale(0.5);}60%{transform:scale(1.14);}100%{opacity:1;transform:scale(1);} }
        @keyframes rw-shine   { 0%{transform:rotate(-30deg) translateX(-120%);opacity:0;}40%{opacity:0.5;}100%{transform:rotate(-30deg) translateX(250%);opacity:0;} }
      `}</style>

      {/* ── 헤더 ── */}
      <header className="shrink-0 flex items-center gap-3 px-4 pt-5 pb-4 bg-white border-b border-black/[0.05]" style={anim(0)}>
        <button onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 active:bg-slate-200 transition-colors shrink-0">
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </button>
        <div className="flex-1">
          <p className="text-[11px] font-bold text-[#FF3355] uppercase tracking-widest">보상 & 업적</p>
          <h1 className="text-[20px] font-black text-slate-900 leading-tight">리워드</h1>
        </div>
        <div className="flex items-center gap-1.5 bg-[#FF3355]/10 px-3 py-1.5 rounded-full">
          <Zap className="w-3.5 h-3.5 text-[#FF3355]" />
          <span className="text-[13px] font-black text-[#FF3355]">{xpDisplay.toLocaleString()} XP</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-10">

        {/* ── 등급 히어로 ── */}
        <div
          className="relative overflow-hidden px-5 pt-6 pb-7"
          style={{ background: "linear-gradient(150deg, #FF3355 0%, #CC0030 55%, #A00025 100%)", ...anim(40, 0) }}
        >
          <div className="pointer-events-none absolute -top-12 -right-12 w-56 h-56 rounded-full bg-white/[0.07]" />
          <div className="pointer-events-none absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-black/[0.08]" />
          <div className="pointer-events-none absolute inset-0"
            style={{ background: "linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.09) 50%, transparent 65%)", animation: "rw-shine 4s ease 0.8s 1 both" }} />

          <div className="relative z-10 flex items-center gap-4 mb-5">
            {/* 등급 뱃지 */}
            <div
              className="shrink-0 w-[72px] h-[72px] rounded-2xl flex flex-col items-center justify-center"
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "2px solid rgba(255,255,255,0.35)",
                boxShadow: `0 0 0 6px rgba(255,255,255,0.07), 0 8px 24px ${currentGrade.glow}`,
                opacity: mounted ? 1 : 0,
                transform: mounted ? "scale(1)" : "scale(0.4)",
                transition: "opacity 0.5s ease 0.1s, transform 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.1s",
              }}
            >
              <span className="text-[9px] font-black text-white/50 tracking-widest">{currentGrade.code}</span>
              <span className="text-[10px] font-black text-white mt-0.5">Lv.{currentGrade.level}</span>
            </div>
            <div className="flex-1">
              <p className="text-white/50 text-[11px] font-bold uppercase tracking-widest mb-0.5">현재 등급</p>
              <h2 className="text-[22px] font-black text-white leading-tight">{currentGrade.name}</h2>
              <p className="text-white/60 text-[12px] mt-0.5">
                {nextGrade
                  ? <>다음 <span className="text-white/80 font-bold">{nextGrade.name}</span>까지 <span className="font-bold text-white/80">{(nextXp - xpTotal).toLocaleString()} XP</span></>
                  : <span className="text-white/80 font-bold">최고 등급 달성! 🎉</span>
                }
              </p>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1.5">
              <span className="text-[12px] font-bold text-white/70">{xpDisplay.toLocaleString()} XP</span>
              <span className="text-[12px] text-white/40">{nextGrade ? `${nextXp.toLocaleString()} XP` : "MAX"}</span>
            </div>
            <div className="w-full h-3 rounded-full bg-white/20 overflow-hidden">
              <div style={{
                width: mounted ? `${nextGrade ? Math.min(((xpTotal - currentGrade.minXp) / (nextXp - currentGrade.minXp)) * 100, 100) : 100}%` : "0%",
                height: "100%", borderRadius: 999,
                background: "linear-gradient(90deg, rgba(255,255,255,0.95), rgba(255,255,255,0.65))",
                boxShadow: "0 0 12px rgba(255,255,255,0.5)",
                transition: "width 1.4s cubic-bezier(0.4,0,0.2,1) 0.35s",
              }} />
            </div>
          </div>

          {/* 전체 등급 로드맵 미니 */}
          <div className="mt-4 flex items-center gap-1 overflow-x-auto no-scrollbar">
            {GRADES.map(g => (
              <div
                key={g.level}
                className="shrink-0 flex flex-col items-center gap-0.5"
                style={{ opacity: g.level <= currentGrade.level ? 1 : 0.35 }}
              >
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center"
                  style={{
                    background: g.level <= currentGrade.level ? g.color : "rgba(255,255,255,0.12)",
                    boxShadow: g.level === currentGrade.level ? `0 0 8px ${g.glow}` : "none",
                    border: g.level === currentGrade.level ? "1.5px solid rgba(255,255,255,0.8)" : "none",
                  }}
                >
                  <span className="text-[6px] font-black text-white">{g.level}</span>
                </div>
                <span className="text-[5.5px] font-bold text-white/50 leading-none">{g.code}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 -mt-3 space-y-3">

          {/* ── 핵심 스탯 3칸 ── */}
          <div className="grid grid-cols-3 gap-2" style={anim(100)}>
            {[
              { label: "연속 달성", value: streak,           suffix: "일",  emoji: "🔥", color: "#FB923C", bg: "#FFF7ED" },
              { label: "누적 달성", value: totalDone,         suffix: "회",  emoji: "✅", color: "#10B981", bg: "#ECFDF5" },
              { label: "획득 배지", value: unlocked.length,  suffix: "개",  emoji: "🏅", color: "#F59E0B", bg: "#FFFBEB" },
            ].map(({ label, value, suffix, emoji, color, bg }) => (
              <div key={label} className="bg-white rounded-2xl p-3.5 text-center shadow-sm border border-black/[0.04]">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ background: bg }}>
                  <span className="text-[18px]">{emoji}</span>
                </div>
                <p className="text-[20px] font-black leading-none" style={{ color }}>
                  {value}<span className="text-[11px] font-semibold text-slate-400 ml-0.5">{suffix}</span>
                </p>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">{label}</p>
              </div>
            ))}
          </div>

          {/* ── 탭 ── */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl" style={anim(160)}>
            {(["badges", "history"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all duration-200"
                style={{
                  background: tab === t ? "white" : "transparent",
                  color: tab === t ? "#FF3355" : "#94A3B8",
                  boxShadow: tab === t ? "0 2px 10px rgba(0,0,0,0.06)" : "none",
                }}>
                {t === "badges" ? "🏅 배지" : "⚡ XP 기록"}
              </button>
            ))}
          </div>

          {/* ── 배지 탭 ── */}
          {tab === "badges" && (
            <>
              {unlocked.length > 0 && (
                <div style={anim(200)}>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2.5">
                    획득한 배지 {unlocked.length}개
                  </p>
                  <div className="grid grid-cols-4 gap-3">
                    {unlocked.map((b, i) => (
                      <button
                        key={b.def.id}
                        onClick={() => setSelectedBadge(b)}
                        className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform duration-150"
                        style={{ animation: mounted ? `badge-pop 0.45s cubic-bezier(0.34,1.56,0.64,1) ${200 + i * 70}ms both` : "none" }}
                      >
                        <div
                          className="w-16 h-16 rounded-2xl flex items-center justify-center relative overflow-hidden"
                          style={{
                            background: `${b.def.color}18`,
                            border: `2px solid ${b.def.color}30`,
                            boxShadow: `0 4px 18px ${b.def.glow}`,
                          }}
                        >
                          <div className="absolute inset-0 rounded-2xl"
                            style={{ background: `radial-gradient(circle at 30% 25%, ${b.def.color}30, transparent 60%)` }} />
                          <span className="text-2xl relative z-10">{b.def.emoji}</span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-700 text-center leading-tight">{b.def.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {nextUp.length > 0 && (
                <div style={anim(320)}>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2.5">다음 도전 목표</p>
                  <div className="flex flex-col gap-2.5">
                    {nextUp.map(b => {
                      const pct = Math.round((b.current / b.def.total) * 100);
                      return (
                        <button key={b.def.id} onClick={() => setSelectedBadge(b)}
                          className="bg-white rounded-2xl p-4 flex items-center gap-4 border border-black/[0.04] shadow-sm active:scale-[0.98] transition-transform text-left w-full">
                          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                            style={{ background: `${b.def.color}12`, border: `2px solid ${b.def.color}20` }}>
                            <span className="text-2xl grayscale-[30%]">{b.def.emoji}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[14px] font-bold text-slate-800">{b.def.label}</p>
                              <span className="text-[12px] font-bold" style={{ color: b.def.color }}>{pct}%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-1.5">
                              <div className="h-full rounded-full"
                                style={{
                                  width: mounted ? `${pct}%` : "0%",
                                  background: `linear-gradient(90deg, ${b.def.color}, ${b.def.color}99)`,
                                  boxShadow: `0 0 6px ${b.def.glow}`,
                                  transition: "width 1s cubic-bezier(0.4,0,0.2,1) 0.5s",
                                }} />
                            </div>
                            <p className="text-[11px] text-slate-400">{b.hint}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={anim(420)}>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2.5">잠긴 배지</p>
                <div className="grid grid-cols-4 gap-3">
                  {locked.filter(b => !nextUp.includes(b)).map(b => (
                    <button key={b.def.id} onClick={() => setSelectedBadge(b)}
                      className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform duration-150">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center relative bg-slate-100 border-2 border-slate-100">
                        <span className="text-2xl grayscale opacity-20">{b.def.emoji}</span>
                        <div className="absolute inset-0 rounded-2xl flex items-center justify-center">
                          <Lock className="w-4 h-4 text-slate-300" />
                        </div>
                      </div>
                      <p className="text-[10px] font-bold text-slate-300 text-center leading-tight">{b.def.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {streak > 0 && (
                <div
                  className="relative overflow-hidden rounded-2xl px-5 py-4 flex items-center gap-4"
                  style={{ background: "linear-gradient(130deg, #FF3355 0%, #CC0030 100%)", ...anim(480) }}
                >
                  <div className="pointer-events-none absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/[0.07]" />
                  <span className="text-3xl shrink-0">💪</span>
                  <div className="flex-1 relative z-10">
                    <p className="text-[14px] font-black text-white leading-snug">오늘도 {streak}일째 도전 중!</p>
                    <p className="text-[12px] text-white/70 mt-0.5">
                      {streak < 30
                        ? `30일 배지까지 ${30 - streak}일 남았어요`
                        : streak < 100
                        ? `전설 배지까지 ${100 - streak}일 남았어요`
                        : "전설 달성! 대단해요 👑"}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── XP 기록 탭 ── */}
          {tab === "history" && (
            <div style={anim(180)}>
              <div className="bg-[#FF3355]/8 rounded-2xl px-4 py-3.5 mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-[#FF3355] uppercase tracking-widest mb-0.5">오늘 획득</p>
                  <p className="text-[22px] font-black text-slate-900">+{todayXp} XP</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-400 mb-0.5">누적 총계</p>
                  <p className="text-[18px] font-black text-slate-700">{xpTotal.toLocaleString()} XP</p>
                </div>
              </div>

              {history.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 flex flex-col items-center border border-black/[0.04]">
                  <span className="text-3xl mb-2">⚡</span>
                  <p className="text-[13px] text-slate-400">아직 XP 기록이 없어요</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {history.map(({ label, xp, time, color }, i) => (
                    <div
                      key={i}
                      className="bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3 border border-black/[0.04] shadow-sm"
                      style={{
                        opacity: mounted ? 1 : 0,
                        transform: mounted ? "translateX(0)" : "translateX(-14px)",
                        transition: `opacity 0.4s ease ${180 + i * 45}ms, transform 0.4s ease ${180 + i * 45}ms`,
                      }}
                    >
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-slate-50">
                        <span className="text-xl">✅</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-[13px] font-bold text-slate-800">{label}</p>
                        <p className="text-[11px] text-slate-400">{time}</p>
                      </div>
                      <span className="text-[14px] font-black" style={{ color }}>+{xp} XP</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      <BadgeSheet badge={selectedBadge} onClose={() => setSelectedBadge(null)} />
    </div>
  );
}
