import React, { useState, useEffect, useRef } from "react";
import { Bell, LogOut, Ticket, Pencil, ChevronRight, Award, UserPlus, Moon, Sun, Smartphone, Trash2, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../contexts/AppContext";
import { useAuth } from "../contexts/AuthContext";
import { useGuestGuard } from "../contexts/GuestGuardContext";
import { getGrade, getNextGrade } from "../lib/grades";
import { useScrollRestoration, isReturningVisit } from "../lib/useScrollRestoration";
import { supabase } from "../lib/supabase";

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

// stats는 컴포넌트 내부에서 context 기반으로 계산

function StatBadge({ label, targetVal, suffix, delay }: { label: string; targetVal: number; suffix: string; delay: number; key?: React.Key }) {
  const val = useCountUp(targetVal, 900, delay);
  return (
    <div className="flex-1 rounded-2xl p-3 text-center bg-black/20 border border-white/[0.08] backdrop-blur-sm">
      <p className="text-[22px] font-black text-white leading-none tabular-nums">
        {val}<span className="text-[11px] font-semibold text-white/50 ml-0.5">{suffix}</span>
      </p>
      <p className="text-[10px] text-white/45 mt-1 font-medium">{label}</p>
    </div>
  );
}

export function Profile() {
  const navigate = useNavigate();
  const { nickname, theme, setTheme, participationTickets, verificationHistory, groupsLoading } = useApp();
  const { signOut, profile } = useAuth();
  const { guardAction } = useGuestGuard();
  const [mounted, setMounted] = useState(() => isReturningVisit("pf-scroll"));
  const [signOutError, setSignOutError] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteRequested, setDeleteRequested] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollRestoration("pf-scroll", scrollRef, !groupsLoading);
  const xpTotal = profile?.xp_total ?? 0;
  const grade = getGrade(xpTotal);
  const nextGrade = getNextGrade(grade.level);
  const avatarUrl = profile?.avatar_url ?? null;
  const avatarInitial = (nickname || "?").charAt(0).toUpperCase();

  const totalDone = verificationHistory.filter((v) => v.status === "completed").length;
  const currentStreak = profile?.streak_count ?? 0;
  const uniqueDaysLast30 = new Set(
    verificationHistory
      .filter(v => v.status === "completed" && (Date.now() - new Date(v.verified_at).getTime()) < 30 * 86400000)
      .map(v => v.verified_at.slice(0, 10))
  ).size;
  const successRate = Math.round(uniqueDaysLast30 / 30 * 100);
  const stats = [
    { label: "달성",   targetVal: totalDone,     suffix: "회", delay: 400 },
    { label: "연속",   targetVal: currentStreak, suffix: "일", delay: 550 },
    { label: "성공률", targetVal: successRate,    suffix: "%",  delay: 700 },
  ];

  useEffect(() => {
    if (mounted) return;
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  async function requestAccountDeletion() {
    if (deleteLoading) return;
    setDeleteLoading(true);
    setDeleteError("");
    const { error } = await supabase.rpc("request_account_deletion");
    setDeleteLoading(false);
    if (error) {
      setDeleteError(error.message);
      return;
    }
    setShowDeleteConfirm(false);
    setDeleteRequested(true);
    setTimeout(() => setDeleteRequested(false), 3500);
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[#FAFAFA] dark:bg-[#090B10] relative">
      {signOutError && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl text-white text-[13px] font-semibold pointer-events-none whitespace-nowrap"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}>
          로그아웃에 실패했어요. 다시 시도해주세요.
        </div>
      )}
      {deleteRequested && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl text-white text-[13px] font-semibold pointer-events-none whitespace-nowrap"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}>
          계정 삭제 요청이 접수됐어요.
        </div>
      )}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">

      {/* 히어로 헤더 */}
      <div
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(155deg, #FF5570 0%, #FF3355 35%, #C8002B 70%, #8B001F 100%)",
          paddingTop: 20,
          paddingBottom: 20,
        }}
      >
        {/* 배경 장식 */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-20 pointer-events-none"
          style={{ background: "radial-gradient(circle, #fff 0%, transparent 70%)" }} />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full opacity-10 pointer-events-none"
          style={{ background: "radial-gradient(circle, #fff 0%, transparent 70%)" }} />

        <div className="relative z-10 px-5">
          {/* 아바타 + 캐릭터 행 */}
          <div className="flex items-end justify-between mb-3">
            {/* 아바타 */}
            <div
              className="relative"
              style={{
                opacity: mounted ? 1 : 0,
                transform: mounted ? "translateY(0) scale(1)" : "translateY(14px) scale(0.88)",
                transition: "all 0.6s cubic-bezier(0.34,1.56,0.64,1)",
              }}
            >
              <div
                className="absolute -inset-1 rounded-full"
                style={{ background: "conic-gradient(from 0deg, rgba(255,255,255,0.8), rgba(255,255,255,0.3), rgba(255,255,255,0.8))", borderRadius: "50%" }}
              />
              <div
                className="relative w-20 h-20 rounded-full bg-white/20 flex items-center justify-center overflow-hidden"
                style={{
                  boxShadow: "0 0 0 2px rgba(255,255,255,0.9), 0 0 0 4px rgba(255,51,85,0.5)",
                  ...(avatarUrl ? { backgroundImage: `url("${avatarUrl}")`, backgroundSize: "cover", backgroundPosition: "center" } : {}),
                }}
              >
                {!avatarUrl && (
                  <span className="text-[28px] font-black text-white">{avatarInitial}</span>
                )}
              </div>
              <button
                onClick={() => guardAction(() => navigate("/profile/edit"))}
                className="absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center active:scale-90 transition-all bg-white"
                style={{ boxShadow: "0 4px 10px rgba(0,0,0,0.2)", border: "2px solid #FF3355" }}
              >
                <Pencil className="w-2.5 h-2.5 text-[#FF3355]" />
              </button>
            </div>

            {/* 이름 + 레벨 (가운데) */}
            <div
              className="flex-1 flex flex-col items-center px-2"
              style={{
                opacity: mounted ? 1 : 0,
                transform: mounted ? "translateY(0)" : "translateY(8px)",
                transition: "all 0.5s 0.15s cubic-bezier(0.4,0,0.2,1)",
              }}
            >
              <h2 className="text-[18px] font-black text-white text-center">{nickname}</h2>
              {/* 등급 뱃지 */}
              <div className="flex items-center gap-1.5 mt-1.5">
                <span
                  className="rounded-lg px-2 py-0.5 text-[10px] font-black tracking-widest uppercase"
                  style={{
                    background: `${grade.color}30`,
                    border: `1px solid ${grade.color}60`,
                    color: "white",
                  }}
                >
                  {grade.code}
                </span>
                <span className="text-white font-bold text-[13px]">{grade.name}</span>
                <span className="text-white/40 text-[11px]">Lv.{grade.level}</span>
              </div>
              {/* XP 진행 바 */}
              {nextGrade && (
                <div className="w-full mt-2 px-2">
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
            </div>

          </div>

          {/* 통계 */}
          <div
            className="w-full flex gap-2"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(10px)",
              transition: "all 0.5s 0.25s cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            {stats.map((s) => (
              <StatBadge key={s.label} label={s.label} targetVal={s.targetVal} suffix={s.suffix} delay={s.delay} />
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-5 space-y-4">

        {/* 참가권 카드 */}
        <div
          className="rounded-3xl p-5 relative overflow-hidden flex items-center justify-between bg-white dark:bg-[#12161E] border border-black/[0.04] dark:border-white/[0.07] shadow-[0_4px_20px_rgba(255,51,85,0.08)]"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(14px)",
            transition: "all 0.5s 0.35s cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          <div className="relative z-10">
            <p className="text-[11px] text-slate-400 mb-1">보유한 참가권</p>
            <div className="flex items-baseline gap-1">
              <span className="text-[36px] font-black text-slate-900 dark:text-white leading-none tabular-nums">{participationTickets}</span>
              <span className="text-[14px] text-slate-400 ml-1 font-semibold">개</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">그룹 참가 시 사용</p>
          </div>
          <div className="relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center bg-[#FFE8EC] dark:bg-[#3A1620] border border-[#FFD6DC] dark:border-[#FF3355]/30">
            <Ticket className="w-7 h-7 text-[#FF3355]" />
          </div>
        </div>

        {/* 설정 */}
        <div
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(14px)",
            transition: "all 0.5s 0.45s cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 ml-1 mb-2">설정</p>
          <div className="rounded-2xl overflow-hidden bg-white dark:bg-[#12161E] border border-black/[0.04] dark:border-white/[0.07]">
            {[
              { icon: Bell,         bg: "bg-[#FFE8EC]", color: "text-[#FF3355]", label: "알림 설정",    onClick: () => guardAction(() => navigate("/settings/notifications")) },
              { icon: Award,        bg: "bg-amber-50",  color: "text-amber-500", label: "등급",         onClick: () => guardAction(() => navigate("/rewards")) },
              { icon: UserPlus,     bg: "bg-sky-50",    color: "text-sky-500",   label: "친구 초대",    onClick: () => guardAction(() => navigate("/friends/invite")) },
            ].map(({ icon: Icon, bg, color, label, onClick }, i) => (
              <div key={label}>
                {i > 0 && <div className="h-px bg-slate-100 mx-4" />}
                <button
                  onClick={onClick}
                  className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-slate-50 dark:active:bg-white/[0.04] transition-colors"
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <span className="flex-1 text-left text-[14px] font-semibold text-slate-800 dark:text-slate-100">{label}</span>
                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                </button>
              </div>
            ))}

            {/* 테마 설정 */}
            <div className="h-px bg-slate-100 dark:bg-white/[0.06] mx-4" />
            <div className="px-4 py-3.5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-slate-100 dark:bg-white/[0.06]">
                  {theme === "dark" ? <Moon className="w-4 h-4 text-slate-500 dark:text-slate-300" />
                    : theme === "system" ? <Smartphone className="w-4 h-4 text-slate-500 dark:text-slate-300" />
                    : <Sun className="w-4 h-4 text-slate-500 dark:text-slate-300" />}
                </div>
                <span className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">화면 모드</span>
              </div>
              <div className="flex gap-2">
                {([
                  { value: "light",  label: "라이트", icon: Sun },
                  { value: "dark",   label: "다크",   icon: Moon },
                  { value: "system", label: "시스템", icon: Smartphone },
                ] as const).map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className="flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold transition-all duration-200 active:scale-95"
                    style={theme === value ? {
                      background: "linear-gradient(115deg,#E84861,#C9223D)",
                      color: "white",
                      boxShadow: "0 2px 8px rgba(255,51,85,0.18)",
                    } : {
                      background: "var(--c-control-bg)",
                      color: "var(--c-control-text)",
                    }}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 ml-1 mb-2 mt-5">계정</p>
          <div className="rounded-2xl overflow-hidden bg-white dark:bg-[#12161E] border border-black/[0.04] dark:border-white/[0.07]">
            <button
              onClick={() => guardAction(() => setShowDeleteConfirm(true))}
              className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-rose-50 dark:active:bg-white/[0.04] transition-colors"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-rose-50 dark:bg-rose-950/30">
                <Trash2 className="w-4 h-4 text-rose-500" />
              </div>
              <span className="flex-1 text-left text-[14px] font-semibold text-rose-500">계정 삭제 요청</span>
            </button>
            <div className="h-px bg-slate-100 dark:bg-white/[0.06] mx-4" />
            <button
              onClick={async () => {
                try {
                  await signOut();
                  navigate("/login");
                } catch {
                  setSignOutError(true);
                  setTimeout(() => setSignOutError(false), 3000);
                }
              }}
              className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-slate-50 dark:active:bg-white/[0.04] transition-colors"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-slate-100 dark:bg-white/[0.06]">
                <LogOut className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              </div>
              <span className="flex-1 text-left text-[14px] font-semibold text-slate-500 dark:text-slate-400">로그아웃</span>
            </button>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-300 pb-2">챌리 v1.0.0</p>
      </div>
      </div>

      {showDeleteConfirm && (
        <div
          className="absolute inset-0 z-[120] flex items-end"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => !deleteLoading && setShowDeleteConfirm(false)}
        >
          <div
            className="w-full rounded-t-3xl bg-white dark:bg-[#12161E] px-5 pt-5"
            style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))", boxShadow: "0 -8px 40px rgba(0,0,0,0.16)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-9 h-1 rounded-full bg-slate-200 dark:bg-white/10 mx-auto mb-5" />
            <div className="flex items-start gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
              </div>
              <div className="min-w-0">
                <h3 className="text-[18px] font-black text-slate-900 dark:text-white">계정 삭제를 요청할까요?</h3>
                <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  요청이 접수되면 운영자가 계정과 관련 데이터를 확인 후 삭제 처리합니다. 처리 전까지는 같은 계정으로 계속 로그인할 수 있어요.
                </p>
              </div>
            </div>
            {deleteError && (
              <p className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-[12px] font-semibold text-rose-500">
                {deleteError}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteLoading}
                className="flex-1 py-3.5 rounded-2xl bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-300 text-[14px] font-bold disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={requestAccountDeletion}
                disabled={deleteLoading}
                className="flex-[1.5] py-3.5 rounded-2xl bg-rose-500 text-white text-[14px] font-bold disabled:opacity-60"
              >
                {deleteLoading ? "요청 중..." : "삭제 요청"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
