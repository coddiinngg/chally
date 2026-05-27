import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, Flame, Trophy, TrendingUp, ChevronRight, Medal } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getGrade, getNextGrade } from "../lib/grades";
import type { PublicProfileRecord } from "../types/database";
import { useScrollRestoration, isReturningVisit } from "../lib/useScrollRestoration";

const CARD_SHADOW = "0 2px 8px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.04)";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function useCountUp(target: number, duration = 900, delay = 400) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let rafId: number;
    const timeout = setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - start) / duration, 1);
        setVal(Math.round((1 - Math.pow(1 - p, 3)) * target));
        if (p < 1) { rafId = requestAnimationFrame(tick); }
      };
      rafId = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(rafId);
    };
  }, [target, duration, delay]);
  return val;
}

export function UserProfile() {
  const { seed: userId = "" } = useParams<{ seed: string }>();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(() => isReturningVisit(`usr-scroll-${userId}`));
  const [profile, setProfile] = useState<PublicProfileRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollRestoration(`usr-scroll-${userId}`, scrollRef, !loading);

  useEffect(() => {
    if (mounted) return;
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!userId) return;
    void loadUserData(userId);
  }, [userId]);

  async function loadUserData(id: string) {
    setLoading(true);
    setLoadError(false);
    try {
      const { data, error } = await supabase.rpc("get_public_profile", { p_user_id: id });
      if (error) throw error;
      setProfile(data?.[0] ?? null);
    } catch (err) {
      console.error("Failed to load user profile", err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  const displayName = profile?.username ?? "알 수 없는 사용자";
  const avatarUrl = profile?.avatar_url ?? null;
  const avatarInitial = displayName.charAt(0).toUpperCase();
  const xpTotal = profile?.xp_total ?? 0;
  const grade = getGrade(xpTotal);
  const nextGrade = getNextGrade(grade.level);
  const streak = profile?.streak_count ?? 0;
  const verTotal = profile?.verification_total ?? 0;
  const verRate = profile?.verification_rate ?? 0;
  const joinedGroups = profile?.joined_groups ?? [];
  const pastGroups   = profile?.past_groups   ?? [];

  const totalDoneAnim = useCountUp(verTotal, 900, 400);
  const streakAnim    = useCountUp(streak,   900, 500);
  const rateAnim      = useCountUp(verRate,  900, 600);

  const xpPct = nextGrade ? Math.min(((xpTotal - grade.minXp) / (nextGrade.minXp - grade.minXp)) * 100, 100) : 100;

  const slide = (delay: number): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(14px)",
    transition: `opacity 0.5s ease ${delay}ms, transform 0.5s cubic-bezier(0.4,0,0.2,1) ${delay}ms`,
  });

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[#F8F8FA] relative">
      <style>{`
        @keyframes pf-down { from{opacity:0;transform:translateY(-12px);}to{opacity:1;transform:translateY(0);} }
      `}</style>

      {/* 헤더 */}
      <div
        className="shrink-0 bg-white border-b border-black/[0.05] relative z-40"
        style={{ animation: "pf-down 0.4s ease both" }}
      >
        <div className="flex items-center gap-3 px-5 pt-3 pb-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center active:bg-slate-200 transition-colors"
            aria-label="뒤로"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="text-[20px] font-black text-slate-900 tracking-tight">프로필</h1>
        </div>
      </div>

      {loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-20 bg-[#F8F8FA]">
          <p className="text-[15px] font-bold text-slate-500">프로필을 불러오지 못했어요</p>
          <button onClick={() => void loadUserData(userId)}
            className="text-[13px] text-[#FF3355] font-semibold px-4 py-2 rounded-xl bg-[#FF3355]/10">
            다시 시도
          </button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="px-4 pt-4 pb-6 space-y-4">

          {/* 프로필 카드 */}
          <div
            className="bg-white rounded-2xl border border-black/[0.04] px-5 pt-6 pb-5 flex flex-col items-center"
            style={{ ...slide(60), boxShadow: CARD_SHADOW }}
          >
            <div
              className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden"
              style={{
                border: `2px solid ${grade.color}33`,
                ...(avatarUrl ? { backgroundImage: `url("${avatarUrl}")`, backgroundSize: "cover", backgroundPosition: "center" } : {}),
              }}
            >
              {!avatarUrl && !loading && (
                <span className="text-[30px] font-black text-slate-400">{avatarInitial}</span>
              )}
            </div>

            <h2 className="text-[22px] font-black text-slate-900 leading-tight mt-4 mb-1.5 text-center truncate max-w-full">
              {loading ? "..." : displayName}
            </h2>

            {!loading && (
              <div className="flex items-center gap-1.5 mb-3.5">
                <span
                  className="rounded-md px-1.5 py-[2px] text-[10px] font-black tracking-widest uppercase"
                  style={{ background: `${grade.color}1A`, color: grade.color }}
                >
                  {grade.code}
                </span>
                <span className="text-slate-700 font-bold text-[13px]">{grade.name}</span>
                <span className="text-slate-300 text-[12px] font-medium">Lv.{grade.level}</span>
              </div>
            )}

            {!loading && nextGrade && (
              <div className="w-full max-w-[280px]">
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: mounted ? `${xpPct}%` : "0%",
                      background: `linear-gradient(to right, ${grade.color}, ${grade.color}AA)`,
                      transition: "width 1s cubic-bezier(0.4,0,0.2,1) 0.4s",
                    }}
                  />
                </div>
                <p className="text-slate-400 text-[10px] mt-1.5 text-center tabular-nums">
                  {xpTotal.toLocaleString()} / {nextGrade.minXp.toLocaleString()} XP
                </p>
              </div>
            )}
          </div>

          {/* 벤토 통계 그리드 */}
          <div className="grid grid-cols-2 gap-3" style={slide(120)}>
            <div
              className="row-span-2 bg-white rounded-2xl border border-black/[0.04] p-5 flex flex-col justify-between min-h-[180px]"
              style={{ boxShadow: CARD_SHADOW }}
            >
              <div>
                <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center mb-3.5">
                  <Trophy className="w-5 h-5 text-amber-500" strokeWidth={2.4} />
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.14em]">총 달성</p>
              </div>
              <div>
                <p className="text-[36px] font-black text-slate-900 leading-none tabular-nums">
                  {totalDoneAnim}<span className="text-[15px] text-slate-400 ml-1 font-bold">회</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-2 font-medium">전체 인증</p>
              </div>
            </div>

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

          {/* 참여 중인 챌린지 */}
          <div style={slide(180)}>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 ml-1 mb-2 mt-3">참여 중인 챌린지</p>
            {loading ? (
              <div className="rounded-2xl bg-white border border-black/[0.04] p-8 flex flex-col items-center" style={{ boxShadow: CARD_SHADOW }}>
                <p className="text-[13px] text-slate-400">불러오는 중...</p>
              </div>
            ) : joinedGroups.length === 0 ? (
              <div className="rounded-2xl bg-white border border-black/[0.04] p-8 flex flex-col items-center" style={{ boxShadow: CARD_SHADOW }}>
                <Medal className="w-8 h-8 text-slate-300 mb-2" strokeWidth={2} />
                <p className="text-[13px] text-slate-400">참여 챌린지 정보가 없습니다</p>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden bg-white border border-black/[0.04]" style={{ boxShadow: CARD_SHADOW }}>
                {joinedGroups.map((g, i) => (
                  <div key={g.id}>
                    {i > 0 && <div className="h-px bg-slate-100 mx-5" />}
                    <button
                      onClick={() => navigate(`/challenge/group/${g.id}`)}
                      className="w-full flex items-center gap-3.5 px-5 py-4 active:bg-slate-50 transition-colors"
                    >
                      <div className="w-11 h-11 rounded-xl bg-[#FFE8EC] flex items-center justify-center shrink-0">
                        <Flame className="w-5 h-5 text-[#FF3355]" strokeWidth={2.4} />
                      </div>
                      <p className="flex-1 text-left text-[14px] font-bold text-slate-800 truncate">{g.name}</p>
                      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 참여했던 챌린지 */}
          {!loading && (
            <div style={slide(240)}>
              <div className="flex items-center justify-between mb-2 mt-3 ml-1 mr-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">참여했던 챌린지</p>
                {pastGroups.length > 0 && (
                  <span className="text-[10px] text-slate-300">{pastGroups.length}개</span>
                )}
              </div>
              {pastGroups.length === 0 ? (
                <div className="rounded-2xl bg-white border border-black/[0.04] p-8 flex flex-col items-center" style={{ boxShadow: CARD_SHADOW }}>
                  <Trophy className="w-8 h-8 text-slate-300 mb-2" strokeWidth={2} />
                  <p className="text-[13px] text-slate-400">아직 완주한 챌린지가 없어요</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {pastGroups.map(g => {
                    const ratePct = Math.round((g.crew_rate ?? 0) * 100);
                    const achieved = ratePct >= 50;
                    return (
                      <button
                        key={g.id}
                        onClick={() => navigate(`/challenge/group/${g.id}/result`)}
                        className="w-full relative rounded-2xl overflow-hidden active:scale-[0.99] transition-transform"
                        style={{ background: "#1A1D24", boxShadow: CARD_SHADOW }}
                      >
                        {g.cover && (
                          <img src={g.cover} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" draggable={false} />
                        )}
                        <div className="absolute inset-0" style={{
                          background: "linear-gradient(110deg, rgba(15,16,22,0.92) 0%, rgba(15,16,22,0.72) 60%, rgba(15,16,22,0.55) 100%)",
                        }} />
                        <div className="relative z-10 flex items-center gap-3 px-4 py-3.5">
                          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-[20px] shrink-0">
                            {g.emoji ?? "🏆"}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-white font-black text-[14px] truncate">{g.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-white/55">
                                {g.challenge_end ? fmtDate(g.challenge_end) : ""} 종료
                              </span>
                              <span className="text-[10px] font-black tabular-nums"
                                style={{ color: achieved ? "#FF6680" : "#94A3B8" }}>
                                크루 {ratePct}%
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Trophy className="w-3.5 h-3.5 text-white/40" />
                            <ChevronRight className="w-4 h-4 text-white/40" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
