import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Trophy, Zap, Flame, Users, ArrowRight, ChevronLeft } from "lucide-react";
import { useApp } from "../../contexts/AppContext";
import { useAuth } from "../../contexts/AuthContext";
import { getBenefitGrade } from "../../lib/challengeUtils";
import { loadGroupLeaderboard } from "../../lib/leaderboard";
import { cn } from "../../lib/utils";

interface Stats {
  myVerifyCount: number;
  myStreak: number;
  myRate: number;
  crewRate: number;
}

export function ChallengeResult() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate    = useNavigate();
  const { groups }  = useApp();
  const { user }    = useAuth();

  const group = groups.find(g => g.id === groupId);

  const [stats, setStats]     = useState<Stats | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!user || !group?.dbId) {
      setStats({
        myVerifyCount: 0,
        myStreak: group?.myStreak ?? 0,
        myRate: group?.myRate ?? 0,
        crewRate: group?.rate ?? 0,
      });
      return;
    }
    async function load() {
      try {
        // 리더보드 RPC로 내 실제 인증 횟수·달성률·스트릭 조회
        const rows = await loadGroupLeaderboard(group!.dbId!, 100);
        const me = rows.find(r => r.isMe);
        setStats({
          myVerifyCount: me?.totalDone ?? 0,
          myStreak:      me?.streak    ?? 0,
          myRate:        me?.rate      ?? 0,
          crewRate:      group!.rate,
        });
      } catch {
        setStats({
          myVerifyCount: 0,
          myStreak:  group!.myStreak,
          myRate:    group!.myRate,
          crewRate:  group!.rate,
        });
      }
    }
    void load();
  }, [user, group?.dbId]);

  const achieved = (stats?.crewRate ?? group?.rate ?? 0) >= 50;
  const grade    = stats ? getBenefitGrade(stats.myRate, stats.crewRate) : "D";

  const slide = (delay: number): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(20px)",
    transition: `opacity 0.5s ease ${delay}ms, transform 0.5s cubic-bezier(0.4,0,0.2,1) ${delay}ms`,
  });

  const GRADE_META: Record<string, { label: string; color: string; desc: string }> = {
    A: { label: "A등급", color: "#FF3355", desc: "최대 혜택 수령 자격" },
    B: { label: "B등급", color: "#F97316", desc: "상위 혜택 수령 자격" },
    C: { label: "C등급", color: "#F59E0B", desc: "기본 혜택 수령 자격" },
    D: { label: "D등급", color: "#94A3B8", desc: "혜택 수령 불가" },
  };
  const gradeMeta = GRADE_META[grade] ?? GRADE_META.D;

  return (
    <div className="flex flex-col h-full bg-[#FAFAFA] overflow-hidden">
      <style>{`
        @keyframes cr-pop  { 0%{opacity:0;transform:scale(0.7)}60%{transform:scale(1.08)}100%{opacity:1;transform:scale(1)} }
        @keyframes cr-glow {
          0%,100% { box-shadow: 0 0 0 0 rgba(255,51,85,0.3); }
          50%      { box-shadow: 0 0 0 20px rgba(255,51,85,0); }
        }
        @keyframes cr-shine {
          from { transform: translateX(-100%) skewX(-20deg); }
          to   { transform: translateX(220%) skewX(-20deg); }
        }
      `}</style>

      {/* ── 배경 커버 이미지 ── */}
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={group?.cover}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
        <div className="absolute inset-0" style={{
          background: achieved
            ? "linear-gradient(180deg, rgba(255,51,85,0.55) 0%, rgba(0,0,0,0.75) 60%, #0F0F0F 100%)"
            : "linear-gradient(180deg, rgba(30,30,40,0.65) 0%, rgba(0,0,0,0.80) 60%, #0F0F0F 100%)",
        }} />
      </div>

      {/* ── top bar ── */}
      <div className="relative z-10 shrink-0 flex items-center justify-between px-5 pt-12 pb-2">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-all"
          style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <img src="/chally-logo-nobg.png" alt="Chally" className="h-7 opacity-80" draggable={false} />
        <div className="w-10" />
      </div>

      {/* ── 대형 이모지 + 상태 ── */}
      <div className="relative z-10 flex flex-col items-center pt-8 pb-4" style={slide(80)}>
        <div
          className="w-28 h-28 rounded-full flex items-center justify-center text-[54px] mb-4"
          style={{
            background: achieved ? "rgba(255,51,85,0.2)" : "rgba(100,116,139,0.2)",
            border: `2px solid ${achieved ? "rgba(255,51,85,0.4)" : "rgba(100,116,139,0.3)"}`,
            animation: mounted ? "cr-pop 0.6s cubic-bezier(0.34,1.56,0.64,1) 80ms both" : "none",
          }}
        >
          {achieved ? "🏆" : "💪"}
        </div>
        <h1 className="text-white font-black text-[28px] leading-none">
          챌린지 {achieved ? "달성" : "미달성"}
        </h1>
        <p className="text-white/60 text-[13px] mt-1.5 font-medium">
          {group?.title ?? "챌린지"}
        </p>
      </div>

      {/* ── 스크롤 영역 ── */}
      <div className="flex-1 overflow-y-auto relative z-10 pb-32 no-scrollbar">
        <div className="px-5 pt-2 flex flex-col gap-3">

          {/* ─ 크루 달성률 배너 ─ */}
          <div className="rounded-3xl overflow-hidden" style={slide(160)}>
            <div
              className="relative flex items-center justify-between px-5 py-5"
              style={{
                background: achieved
                  ? "linear-gradient(135deg, rgba(255,51,85,0.18), rgba(255,102,128,0.10))"
                  : "rgba(255,255,255,0.08)",
                border: `1px solid ${achieved ? "rgba(255,51,85,0.3)" : "rgba(255,255,255,0.12)"}`,
              }}
            >
              {/* shine sweep */}
              <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
                <div className="absolute top-0 bottom-0 w-1/3 opacity-10"
                  style={{
                    background: "linear-gradient(90deg, transparent, white, transparent)",
                    animation: mounted ? "cr-shine 2s ease 0.4s both" : "none",
                  }} />
              </div>

              <div>
                <p className="text-white/60 text-[11px] font-bold uppercase tracking-widest">크루 달성률</p>
                <p className="text-white font-black text-[40px] leading-none tabular-nums italic mt-0.5">
                  {stats?.crewRate ?? group?.rate ?? 0}
                  <span className="text-[20px] font-black ml-0.5">%</span>
                </p>
                <p className="text-white/50 text-[11px] mt-0.5">
                  {achieved ? "목표 달성! 크루가 함께 해냈어요 🎉" : "아쉽게 목표에 못 미쳤어요"}
                </p>
              </div>

              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{
                  background: achieved ? "rgba(255,51,85,0.2)" : "rgba(100,116,139,0.15)",
                  border: `1px solid ${achieved ? "rgba(255,51,85,0.3)" : "rgba(100,116,139,0.2)"}`,
                }}
              >
                <Users className="w-7 h-7" style={{ color: achieved ? "#FF3355" : "#94A3B8" }} />
              </div>
            </div>
          </div>

          {/* ─ 내 기록 ─ */}
          <div style={slide(240)}>
            <p className="text-white/40 text-[11px] font-bold uppercase tracking-widest px-1 mb-2">내 기록</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "인증 횟수",   value: `${stats?.myVerifyCount ?? 0}회`,  Icon: Trophy, color: "#FF3355" },
                { label: "연속 인증",   value: `${stats?.myStreak ?? 0}일`,       Icon: Flame,  color: "#F97316" },
                { label: "내 달성률",   value: `${stats?.myRate ?? 0}%`,          Icon: Zap,    color: "#F59E0B" },
              ].map(({ label, value, Icon, color }) => (
                <div key={label}
                  className="flex flex-col items-center py-4 rounded-2xl"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.09)" }}>
                  <Icon className="w-5 h-5 mb-1.5" style={{ color }} />
                  <p className="text-white font-black text-[18px] tabular-nums leading-none">{value}</p>
                  <p className="text-white/45 text-[10px] mt-1 font-medium">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ─ 베네핏 등급 ─ */}
          <div
            className="rounded-3xl px-5 py-4 flex items-center justify-between"
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.09)",
              ...slide(320),
            }}
          >
            <div>
              <p className="text-white/40 text-[11px] font-bold uppercase tracking-widest mb-0.5">베네핏 등급</p>
              <p className="font-black text-[22px]" style={{ color: gradeMeta.color }}>{gradeMeta.label}</p>
              <p className="text-white/50 text-[12px] mt-0.5">{gradeMeta.desc}</p>
            </div>
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-[26px]"
              style={{ background: `${gradeMeta.color}22`, border: `1.5px solid ${gradeMeta.color}44` }}
            >
              {grade}
            </div>
          </div>

          {/* ─ 안내 텍스트 ─ */}
          <div
            className="rounded-3xl px-5 py-4 text-center"
            style={{
              background: achieved ? "rgba(255,51,85,0.08)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${achieved ? "rgba(255,51,85,0.2)" : "rgba(255,255,255,0.08)"}`,
              ...slide(400),
            }}
          >
            {achieved ? (
              <p className="text-white/70 text-[13px] leading-relaxed">
                챌리가 참가권을 드려요!<br />
                <span className="text-white font-bold">리워드 탭</span>에서 혜택을 확인하고<br />
                다음 챌린지에도 참여해보세요 🎉
              </p>
            ) : (
              <p className="text-white/70 text-[13px] leading-relaxed">
                이번엔 아쉬웠지만 괜찮아요!<br />
                <span className="text-white font-bold">다른 챌린지</span>에 도전하면서<br />
                습관을 계속 이어가세요 🔥
              </p>
            )}
          </div>

        </div>
      </div>

      {/* ── 하단 버튼 ── */}
      <div className="absolute bottom-0 left-0 right-0 z-10 px-5 pb-10 pt-4"
        style={{ background: "linear-gradient(to top, #0F0F0F 70%, transparent)" }}>
        {achieved ? (
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => navigate("/rewards")}
              className="w-full h-14 flex items-center justify-center gap-2 rounded-2xl text-white font-bold text-[16px] active:scale-[0.98] transition-transform relative overflow-hidden"
              style={{ background: "linear-gradient(135deg,#FF3355,#FF6680)", boxShadow: "0 8px 24px -4px rgba(255,51,85,0.45)" }}
            >
              <Trophy className="w-5 h-5" />
              챌린지 참가권 받기
            </button>
            <button
              onClick={() => navigate("/")}
              className="w-full h-11 flex items-center justify-center gap-1.5 text-white/50 text-[14px] font-medium active:text-white/70 transition-colors"
            >
              홈으로
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => navigate("/challenge")}
              className="w-full h-14 flex items-center justify-center gap-2 rounded-2xl font-bold text-[16px] active:scale-[0.98] transition-transform"
              style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", color: "#FFFFFF" }}
            >
              <Flame className="w-5 h-5 text-orange-400" />
              다른 챌린지 탐색하기
            </button>
            <button
              onClick={() => navigate("/")}
              className="w-full h-11 flex items-center justify-center gap-1.5 text-white/50 text-[14px] font-medium active:text-white/70 transition-colors"
            >
              홈으로
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
