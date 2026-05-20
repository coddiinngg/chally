import React, { useState, useEffect, useRef } from "react";
import { Bell, LogOut, Ticket, Pencil, ChevronRight, Award, UserPlus, Moon, Sun, Smartphone, Trash2, AlertTriangle, Trophy, Flame, TrendingUp } from "lucide-react";
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

const CARD_SHADOW = "0 2px 8px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.04)";

export function Profile() {
  const navigate = useNavigate();
  const { nickname, theme, setTheme, participationTickets, verificationHistory, groupsLoading } = useApp();
  const { signOut, profile } = useAuth();
  const { guardAction } = useGuestGuard();
  const [mounted, setMounted] = useState(() => isReturningVisit("pf-scroll"));
  const [signOutError, setSignOutError] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
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

  const xpAnim = useCountUp(totalDone, 900, 400);
  const streakAnim = useCountUp(currentStreak, 900, 500);
  const rateAnim = useCountUp(successRate, 900, 600);
  const ticketAnim = useCountUp(participationTickets, 900, 700);

  const xpPct = nextGrade ? Math.min(((xpTotal - grade.minXp) / (nextGrade.minXp - grade.minXp)) * 100, 100) : 100;

  useEffect(() => {
    if (mounted) return;
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  async function requestAccountDeletion() {
    if (deleteLoading) return;
    setDeleteLoading(true);
    setDeleteError("");
    const { error } = await supabase.functions.invoke("delete-account", { method: "POST" });
    if (error) {
      setDeleteLoading(false);
      setDeleteError(error.message ?? "계정 삭제 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
      return;
    }
    try {
      await signOut();
    } catch {
      // signOut 실패해도 계정 자체는 이미 삭제됨. 다음 자동 토큰 갱신에서 invalid해질 것.
    }
    navigate("/login", { replace: true });
  }

  const slide = (delay: number): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(14px)",
    transition: `opacity 0.5s ease ${delay}ms, transform 0.5s cubic-bezier(0.4,0,0.2,1) ${delay}ms`,
  });

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[#F8F8FA] relative">
      <style>{`
        @keyframes pf-down  { from{opacity:0;transform:translateY(-12px);}to{opacity:1;transform:translateY(0);} }
        @keyframes pf-sheet { from{transform:translateY(100%);}to{transform:translateY(0);} }
      `}</style>

      {signOutError && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl text-white text-[13px] font-semibold pointer-events-none whitespace-nowrap"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}>
          로그아웃에 실패했어요. 다시 시도해주세요.
        </div>
      )}

      {/* 헤더 */}
      <div
        className="shrink-0 bg-white border-b border-black/[0.05] relative z-40"
        style={{ animation: "pf-down 0.4s ease both" }}
      >
        <div className="flex items-center justify-between px-5 pt-3 pb-3">
          <h1 className="text-[20px] font-black text-slate-900 tracking-tight">프로필</h1>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="px-4 pt-4 pb-6 space-y-4">

          {/* 프로필 카드 — 중앙 정렬 (스픽 영감) */}
          <div
            className="bg-white rounded-2xl border border-black/[0.04] px-5 pt-6 pb-5 flex flex-col items-center"
            style={{ ...slide(60), boxShadow: CARD_SHADOW }}
          >
            {/* 아바타 + 편집 버튼 */}
            <div className="relative">
              <div
                className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden"
                style={{
                  border: `2px solid ${grade.color}33`,
                  ...(avatarUrl ? { backgroundImage: `url("${avatarUrl}")`, backgroundSize: "cover", backgroundPosition: "center" } : {}),
                }}
              >
                {!avatarUrl && (
                  <span className="text-[30px] font-black text-slate-400">{avatarInitial}</span>
                )}
              </div>
              <button
                onClick={() => guardAction(() => navigate("/profile/edit"))}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-all bg-white"
                style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.14)", border: "1.5px solid #FF3355" }}
              >
                <Pencil className="w-3 h-3 text-[#FF3355]" />
              </button>
            </div>

            {/* 닉네임 */}
            <h2 className="text-[22px] font-black text-slate-900 leading-tight mt-4 mb-1.5 text-center truncate max-w-full">
              {nickname}
            </h2>

            {/* 등급 메타 */}
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

            {/* XP 진행 바 */}
            {nextGrade && (
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
            {/* 달성 (큰 타일, row-span-2) */}
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

          {/* 참가권 — 챌린지 탭 톤의 빨강 포인트 배너 */}
          <div
            className="relative overflow-hidden rounded-2xl px-5 py-4 flex items-center justify-between"
            style={{
              ...slide(180),
              background: "linear-gradient(115deg, #FF3355 0%, #C8002B 100%)",
              boxShadow: "0 6px 20px rgba(255,51,85,0.25)",
            }}
          >
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20 pointer-events-none"
              style={{ background: "radial-gradient(circle, #fff 0%, transparent 70%)" }} />
            <div className="relative">
              <p className="text-white/55 text-[10px] font-bold uppercase tracking-[0.18em] mb-1">보유한 참가권</p>
              <p className="text-white text-[28px] font-black leading-none tracking-tight tabular-nums">
                {ticketAnim}<span className="text-[14px] font-semibold text-white/70 ml-1">장</span>
              </p>
              <p className="text-white/60 text-[11px] mt-2 font-medium">그룹 참가 시 사용</p>
            </div>
            <div className="relative rounded-2xl flex items-center justify-center"
              style={{ width: 52, height: 52, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(6px)" }}>
              <Ticket className="w-6 h-6 text-white" strokeWidth={2} />
            </div>
          </div>

          {/* 설정 */}
          <div style={slide(240)}>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 ml-1 mb-2 mt-3">설정</p>
            <div
              className="rounded-2xl overflow-hidden bg-white border border-black/[0.04]"
              style={{ boxShadow: CARD_SHADOW }}
            >
              {[
                { icon: Bell,     bg: "bg-[#FFE8EC]", color: "text-[#FF3355]", label: "알림 설정", desc: "인증 · 채팅 · 이벤트 알림을 조정해보세요", onClick: () => guardAction(() => navigate("/settings/notifications")) },
                { icon: Award,    bg: "bg-amber-50",  color: "text-amber-500", label: "등급",     desc: `현재 ${grade.name} · Lv.${grade.level}`,                       onClick: () => guardAction(() => navigate("/rewards")) },
                { icon: UserPlus, bg: "bg-sky-50",    color: "text-sky-500",   label: "친구 초대", desc: "함께 챌린지하면 더 즐거워요",                                  onClick: () => guardAction(() => navigate("/friends/invite")) },
              ].map(({ icon: Icon, bg, color, label, desc, onClick }, i) => (
                <div key={label}>
                  {i > 0 && <div className="h-px bg-slate-100 mx-5" />}
                  <button
                    onClick={onClick}
                    className="w-full flex items-center gap-3.5 px-5 py-4 active:bg-slate-50 transition-colors"
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
                      <Icon className={`w-5 h-5 ${color}`} strokeWidth={2.2} />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-[14px] font-bold text-slate-800 leading-tight">{label}</p>
                      <p className="text-[12px] text-slate-400 mt-0.5 leading-tight truncate">{desc}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                  </button>
                </div>
              ))}

              {/* 테마 설정 */}
              <div className="h-px bg-slate-100 mx-5" />
              <div className="px-5 py-4">
                <div className="flex items-center gap-3.5 mb-3.5">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-slate-100">
                    {theme === "dark" ? <Moon className="w-5 h-5 text-slate-500" strokeWidth={2.2} />
                      : theme === "system" ? <Smartphone className="w-5 h-5 text-slate-500" strokeWidth={2.2} />
                      : <Sun className="w-5 h-5 text-slate-500" strokeWidth={2.2} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-slate-800 leading-tight">화면 모드</p>
                    <p className="text-[12px] text-slate-400 mt-0.5 leading-tight">
                      현재: {theme === "dark" ? "다크" : theme === "system" ? "시스템" : "라이트"}
                    </p>
                  </div>
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
                        background: "linear-gradient(115deg,#FF5C7A,#FF3355)",
                        color: "white",
                        boxShadow: "0 4px 12px rgba(255,51,85,0.25)",
                      } : {
                        background: "var(--c-control-bg)",
                        color: "var(--c-control-text)",
                      }}
                    >
                      <Icon className="w-4 h-4" strokeWidth={2.2} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 계정 */}
          <div style={slide(300)}>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 ml-1 mb-2 mt-3">계정</p>
            <div
              className="rounded-2xl overflow-hidden bg-white border border-black/[0.04]"
              style={{ boxShadow: CARD_SHADOW }}
            >
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
                className="w-full flex items-center gap-3.5 px-5 py-4 active:bg-slate-50 transition-colors"
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-slate-100">
                  <LogOut className="w-5 h-5 text-slate-400" strokeWidth={2.2} />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-[14px] font-bold text-slate-500 leading-tight">로그아웃</p>
                  <p className="text-[12px] text-slate-400 mt-0.5 leading-tight">다음에 또 만나요</p>
                </div>
              </button>
              <div className="h-px bg-slate-100 mx-5" />
              <button
                onClick={() => guardAction(() => setShowDeleteConfirm(true))}
                className="w-full flex items-center gap-3.5 px-5 py-4 active:bg-rose-50 transition-colors"
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-rose-50">
                  <Trash2 className="w-5 h-5 text-rose-500" strokeWidth={2.2} />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-[14px] font-bold text-rose-500 leading-tight">계정 삭제</p>
                  <p className="text-[12px] text-rose-400/80 mt-0.5 leading-tight">모든 데이터가 영구 삭제돼요</p>
                </div>
              </button>
            </div>
          </div>

          <p className="text-center text-[11px] text-slate-300 pt-2">챌리 v1.0.0</p>
        </div>
      </div>

      {showDeleteConfirm && (
        <div
          className="absolute inset-0 z-[120] flex items-end"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => !deleteLoading && setShowDeleteConfirm(false)}
        >
          <div
            className="w-full rounded-t-3xl bg-white px-5 pt-5"
            style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))", boxShadow: "0 -8px 40px rgba(0,0,0,0.16)", animation: "pf-sheet 0.3s cubic-bezier(0.32,0.72,0,1) both" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-9 h-1 rounded-full bg-slate-200 mx-auto mb-5" />
            <div className="flex items-start gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
              </div>
              <div className="min-w-0">
                <h3 className="text-[18px] font-black text-slate-900">정말 계정을 삭제할까요?</h3>
                <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">
                  삭제하면 프로필, 인증 기록, 사진, 활동 내역이 즉시 모두 사라져요. 한 번 삭제하면 복구할 수 없어요.
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
                className="flex-1 py-3.5 rounded-2xl bg-slate-100 text-slate-500 text-[14px] font-bold disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={requestAccountDeletion}
                disabled={deleteLoading}
                className="flex-[1.5] py-3.5 rounded-2xl bg-rose-500 text-white text-[14px] font-bold disabled:opacity-60"
              >
                {deleteLoading ? "삭제 중..." : "삭제하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
