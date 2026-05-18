import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, Flame, Trophy, ChevronRight } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getGrade, getNextGrade } from "../lib/grades";
import type { PublicProfileRecord } from "../types/database";
import { useScrollRestoration, isReturningVisit } from "../lib/useScrollRestoration";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
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
      // SECURITY DEFINER RPC — RLS 우회해서 다른 유저 데이터 접근
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

  return (
    <div className="relative flex flex-col flex-1 overflow-hidden bg-[#FAFAFA] dark:bg-[#090B10]">
      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 z-30 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center active:bg-white/30 transition-colors"
      >
        <ChevronLeft className="w-5 h-5 text-white" />
      </button>

      {loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-20 bg-[#FAFAFA] dark:bg-[#090B10]">
          <p className="text-[15px] font-bold text-slate-500">프로필을 불러오지 못했어요</p>
          <button onClick={() => void loadUserData(userId)}
            className="text-[13px] text-[#FF3355] font-semibold px-4 py-2 rounded-xl bg-[#FF3355]/10">
            다시 시도
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {/* 헤더 */}
        <div
          className="relative overflow-hidden"
          style={{
            background: "linear-gradient(160deg, #FF3355 0%, #CC0030 55%, #A00025 100%)",
            paddingTop: 16,
            paddingBottom: 28,
          }}
        >
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-15 pointer-events-none"
            style={{ background: "radial-gradient(circle, #fff 0%, transparent 70%)" }} />

          <div className="relative z-10 flex flex-col items-center pt-6 px-5">
            <div
              style={{
                opacity: mounted ? 1 : 0,
                transform: mounted ? "scale(1)" : "scale(0.85)",
                transition: "all 0.5s cubic-bezier(0.34,1.56,0.64,1)",
              }}
            >
              <div
                className="w-20 h-20 rounded-2xl bg-white/30 flex items-center justify-center overflow-hidden"
                style={{
                  boxShadow: "0 0 0 3px rgba(255,255,255,0.7), 0 0 0 5px rgba(255,51,85,0.4)",
                  ...(avatarUrl ? { backgroundImage: `url("${avatarUrl}")`, backgroundSize: "cover", backgroundPosition: "center" } : {}),
                }}
              >
                {!avatarUrl && !loading && (
                  <span className="text-[28px] font-black text-white">{avatarInitial}</span>
                )}
              </div>
            </div>

            <h2
              className="text-[20px] font-black text-white mt-3"
              style={{
                opacity: mounted ? 1 : 0,
                transform: mounted ? "translateY(0)" : "translateY(8px)",
                transition: "all 0.4s 0.15s ease",
              }}
            >
              {loading ? "..." : displayName}
            </h2>

            {/* 등급 뱃지 */}
            {!loading && (
              <div
                className="flex items-center gap-1.5 mt-1.5"
                style={{
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? "translateY(0)" : "translateY(6px)",
                  transition: "all 0.4s 0.2s ease",
                }}
              >
                <span
                  className="rounded-lg px-2 py-0.5 text-[10px] font-black tracking-widest uppercase"
                  style={{ background: `${grade.color}30`, border: `1px solid ${grade.color}60`, color: "white" }}
                >
                  {grade.code}
                </span>
                <span className="text-white font-bold text-[13px]">{grade.name}</span>
                <span className="text-white/40 text-[11px]">Lv.{grade.level}</span>
              </div>
            )}

            {/* XP 진행바 */}
            {!loading && nextGrade && (
              <div className="w-full mt-3 px-4"
                style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.4s 0.25s ease" }}
              >
                <div className="w-full h-1.5 bg-white/15 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(((xpTotal - grade.minXp) / (nextGrade.minXp - grade.minXp)) * 100, 100)}%`,
                      background: "rgba(255,255,255,0.8)",
                      transition: "width 1s cubic-bezier(0.4,0,0.2,1) 0.4s",
                    }}
                  />
                </div>
                <p className="text-white/35 text-[9px] text-center mt-0.5">
                  {xpTotal.toLocaleString()} / {nextGrade.minXp.toLocaleString()} XP
                </p>
              </div>
            )}

            {!loading && (
              <div
                className="flex gap-2 mt-4 w-full"
                style={{
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? "translateY(0)" : "translateY(8px)",
                  transition: "all 0.4s 0.3s ease",
                }}
              >
                {[
                  { label: "달성", val: verTotal, suffix: "회" },
                  { label: "연속", val: streak, suffix: "일" },
                  { label: "달성률", val: verRate, suffix: "%" },
                  { label: "경험치", val: xpTotal, suffix: "xp" },
                ].map(({ label, val, suffix }) => (
                  <div key={label} className="flex-1 flex flex-col items-center bg-white/20 border border-white/20 rounded-2xl py-2.5">
                    <span className="text-[17px] font-black text-white leading-none tabular-nums">
                      {val}<span className="text-[10px] font-semibold text-white/55 ml-0.5">{suffix}</span>
                    </span>
                    <span className="text-[10px] text-white/50 mt-1">{label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 ml-1 mb-3">참여 중인 챌린지</p>

          {loading ? (
            <div className="rounded-2xl bg-white dark:bg-[#12161E] border border-black/[0.04] dark:border-white/[0.07] p-8 flex flex-col items-center">
              <p className="text-[13px] text-slate-400">불러오는 중...</p>
            </div>
          ) : joinedGroups.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#12161E] border border-black/[0.04] dark:border-white/[0.07] p-8 flex flex-col items-center">
              <span className="text-3xl mb-2">🏅</span>
              <p className="text-[13px] text-slate-400">참여 챌린지 정보가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {joinedGroups.map((g, i) => (
                <div
                  key={g.id}
                  className="rounded-2xl bg-white dark:bg-[#12161E] border border-black/[0.04] dark:border-white/[0.07] px-4 py-4 flex items-center gap-3 active:bg-slate-50 dark:active:bg-white/[0.04] transition-colors cursor-pointer"
                  style={{
                    opacity: mounted ? 1 : 0,
                    transform: mounted ? "translateY(0)" : "translateY(14px)",
                    transition: `all 0.4s ${0.3 + i * 0.08}s cubic-bezier(0.4,0,0.2,1)`,
                  }}
                  onClick={() => navigate(`/challenge/group/${g.id}`)}
                >
                  <div className="w-9 h-9 rounded-xl bg-[#FFE8EC] dark:bg-[#3A1620] flex items-center justify-center shrink-0">
                    <Flame className="w-4 h-4 text-[#FF3355]" />
                  </div>
                  <p className="flex-1 font-bold text-[14px] text-slate-800 dark:text-slate-100">{g.name}</p>
                </div>
              ))}
            </div>
          )}

          {/* 참여했던 챌린지 (ACTIVE로 끝까지 참여한 종료 챌린지) */}
          {!loading && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 ml-1">참여했던 챌린지</p>
                {pastGroups.length > 0 && (
                  <span className="text-[10px] text-slate-300 mr-1">{pastGroups.length}개</span>
                )}
              </div>
              {pastGroups.length === 0 ? (
                <div className="rounded-2xl bg-white dark:bg-[#12161E] border border-black/[0.04] dark:border-white/[0.07] p-8 flex flex-col items-center">
                  <span className="text-3xl mb-2">🏆</span>
                  <p className="text-[13px] text-slate-400">아직 완주한 챌린지가 없어요</p>
                </div>
              ) : (
              <div className="space-y-3">
                {pastGroups.map((g, i) => {
                  const ratePct = Math.round((g.crew_rate ?? 0) * 100);
                  const achieved = ratePct >= 50;
                  return (
                    <div
                      key={g.id}
                      onClick={() => navigate(`/challenge/group/${g.id}/result`)}
                      className="relative rounded-2xl overflow-hidden cursor-pointer active:scale-[0.99] transition-transform"
                      style={{
                        opacity: mounted ? 1 : 0,
                        transform: mounted ? "translateY(0)" : "translateY(14px)",
                        transition: `all 0.4s ${0.4 + i * 0.06}s cubic-bezier(0.4,0,0.2,1)`,
                        background: "#1A1D24",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                      }}
                    >
                      {/* 커버 이미지 배경 */}
                      {g.cover && (
                        <img src={g.cover} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40"
                          draggable={false} />
                      )}
                      <div className="absolute inset-0" style={{
                        background: "linear-gradient(110deg, rgba(15,16,22,0.92) 0%, rgba(15,16,22,0.72) 60%, rgba(15,16,22,0.55) 100%)",
                      }} />

                      <div className="relative z-10 flex items-center gap-3 px-4 py-3.5">
                        <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-[20px] shrink-0">
                          {g.emoji ?? "🏆"}
                        </div>
                        <div className="flex-1 min-w-0">
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
                    </div>
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
