import { Search, Users, ChevronDown,
         Activity, BookOpen, Apple, Sparkles, Trophy, Bell, BellRing } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "../lib/utils";
import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useApp } from "../contexts/AppContext";
import { useGuestGuard } from "../contexts/GuestGuardContext";
import { getPhase, shouldHide, canJoin, phaseLabel, isLateJoiner, daysSinceEnd, canRequestReopenNotify } from "../lib/challengeUtils";
import { VERIFY_TYPES, type VerifyTypeKey } from "../lib/verifyTypes";
import type { Group } from "../contexts/AppContext";
import { useScrollRestoration, isReturningVisit, usePersistedState } from "../lib/useScrollRestoration";

function fmtDate(d: string): string {
  const dt = new Date(d);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

function sortPriority(g: Group): number {
  // LEFT/REMOVED는 영구 — 항상 최하단 비활성 카드
  if (g.isRemoved) return 6;
  if (g.isLeft)    return 6;
  const phase = getPhase(g.challengeStart, g.challengeEnd, g.recruitEnd);
  if (g.joined) {
    if (phase === "ended") return 3;
    return 0;
  }
  if (phase === "ended") return 4;
  if (phase === "active" || phase === "closing") return 1;
  return 2;
}

// 진행중 챌린지 자동 스크롤 티커
function LiveTicker({ items }: { items: Group[] }) {
  const ref1 = useRef<HTMLDivElement>(null);
  const [dur, setDur] = useState(0);

  useLayoutEffect(() => {
    if (!ref1.current) return;
    const w = ref1.current.scrollWidth / 2;
    if (w > 0) setDur(w / 45);
  }, [items.length]);

  if (items.length === 0) return null;

  function Chip({ g }: { g: Group; key?: React.Key }) {
    const emoji = VERIFY_TYPES[(g.verifyType as VerifyTypeKey)]?.emoji ?? "🏃";
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full shrink-0"
        style={{ background: "rgba(255,51,85,0.06)", border: "1px solid rgba(255,51,85,0.13)" }}>
        <span className="text-[10px] leading-none">{emoji}</span>
        <span className="text-[10px] font-semibold text-slate-500 leading-none whitespace-nowrap">{g.title}</span>
      </span>
    );
  }

  function Sep() {
    return <span className="text-[8px] text-slate-300 leading-none shrink-0 self-center">●</span>;
  }

  const withSeps = (list: Group[], suffix: string) =>
    list.flatMap((g, i) => [
      <Chip key={`${g.id}${suffix}`} g={g} />,
      <Sep key={`sep${suffix}${i}`} />,
    ]);

  const anim1 = dur > 0 ? `ticker-l ${dur.toFixed(1)}s linear infinite` : "none";
  const anim2 = dur > 0 ? `ticker-l ${dur.toFixed(1)}s linear -${(dur / 2).toFixed(1)}s infinite` : "none";

  return (
    <div className="overflow-hidden py-2 flex flex-col gap-1.5"
      style={{ borderTop: "1px solid rgba(0,0,0,0.05)", background: "rgba(255,255,255,0.85)" }}>
      <style>{`@keyframes ticker-l{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
      <div className="overflow-hidden">
        <div ref={ref1} className="flex items-center gap-2 w-max" style={{ animation: anim1 }}>
          {withSeps(items, "-a")}
          {withSeps(items, "-b")}
        </div>
      </div>
      <div className="overflow-hidden">
        <div className="flex items-center gap-2 w-max" style={{ animation: anim2 }}>
          {withSeps(items, "-c")}
          {withSeps(items, "-d")}
        </div>
      </div>
    </div>
  );
}

const CAT_META: Record<string, { icon: React.ElementType; bg: string; color: string; glow: string; grad: string; cardGrad: string; iconColor: string }> = {
  "운동": { icon: Activity,  bg: "bg-orange-50",  color: "text-orange-400", glow: "rgba(255,51,85,0.15)",  grad: "linear-gradient(135deg,#FB923C,#F59E0B)", cardGrad: "linear-gradient(140deg,#FF3355 0%,#CC0030 60%,#8B001F 100%)", iconColor: "#FB923C" },
  "식단": { icon: Apple,     bg: "bg-green-50",   color: "text-green-500",  glow: "rgba(255,51,85,0.15)",  grad: "linear-gradient(135deg,#22C55E,#16A34A)", cardGrad: "linear-gradient(140deg,#FF3355 0%,#CC0030 60%,#8B001F 100%)", iconColor: "#22C55E" },
  "학습": { icon: BookOpen,  bg: "bg-blue-50",    color: "text-blue-400",   glow: "rgba(255,51,85,0.15)",  grad: "linear-gradient(135deg,#38BDF8,#0EA5E9)", cardGrad: "linear-gradient(140deg,#FF3355 0%,#CC0030 60%,#8B001F 100%)", iconColor: "#38BDF8" },
  "생활": { icon: Sparkles,  bg: "bg-purple-50",  color: "text-purple-400", glow: "rgba(255,51,85,0.15)",  grad: "linear-gradient(135deg,#A855F7,#7C3AED)", cardGrad: "linear-gradient(140deg,#FF3355 0%,#CC0030 60%,#8B001F 100%)", iconColor: "#A855F7" },
};

const STATUS_STYLE: Record<string, string> = {
  "모집중":   "text-blue-600 bg-blue-50",
  "진행중":   "text-emerald-600 bg-emerald-50",
  "마감임박": "text-amber-600 bg-amber-50",
  "종료":     "text-slate-400 bg-slate-100",
};

const CATS = ["전체", "운동", "식단", "학습", "생활"];

function CatTag({ category }: { category: string }) {
  const meta = CAT_META[category] ?? { icon: Sparkles, iconColor: "#FF3355" };
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FFF0F3] text-[#CC0030]">
      <Icon className="w-3 h-3" style={{ color: meta.iconColor }} strokeWidth={2} />
      {category}
    </span>
  );
}

export function Challenge() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    groups, groupsLoading, joinGroup, leaveGroup, setSelectedGroupId,
    refreshGroups, confirmedEndedIds, confirmEndedGroup, participationTickets,
    reopenNotifyIds, toggleReopenNotify,
  } = useApp();
  const { guardAction } = useGuestGuard();
  const [activeCat, setActiveCat] = usePersistedState<string>("ch-cat", "전체");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [filterMode, setFilterMode] = usePersistedState<"전체" | "참여중" | "지난">(
    "ch-filter", "전체",
    (v): v is "전체" | "참여중" | "지난" => v === "전체" || v === "참여중" || v === "지난",
  );
  const [showDropdown, setShowDropdown] = useState(false);
  const [mounted, setMounted] = useState(() => isReturningVisit("ch-scroll"));
  const [joinTarget, setJoinTarget] = useState<{ id: string; title: string; desc: string; members: number; challengeStart: string | null; challengeEnd: string | null } | null>(null);
  const [leaveTarget, setLeaveTarget] = useState<{ id: string; title: string } | null>(null);
  const [removedToast, setRemovedToast] = useState(!!(location.state as { removedGroupId?: string } | null)?.removedGroupId);

  // 페이지 방문마다 그룹 데이터 최신화
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void refreshGroups(); }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollRestoration("ch-scroll", scrollRef, !groupsLoading);

  const liveUnjoined = groups.filter(g => {
    if (g.joined || g.isRemoved || g.isLeft) return false;
    const phase = getPhase(g.challengeStart, g.challengeEnd, g.recruitEnd);
    return phase === "active" || phase === "closing";
  });

  useEffect(() => {
    if (mounted) return;
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!removedToast) return;
    const t = setTimeout(() => setRemovedToast(false), 4000);
    return () => clearTimeout(t);
  }, [removedToast]);

  const slide = (delay: number): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(18px)",
    transition: `opacity 0.5s ease ${delay}ms, transform 0.5s cubic-bezier(0.4,0,0.2,1) ${delay}ms`,
  });

  const filtered = groups
    .filter((g) => {
      const phase = getPhase(g.challengeStart, g.challengeEnd, g.recruitEnd);

      // "지난 챌린지" 모드: ACTIVE로 끝까지 참여한 ended 그룹만 (LEFT/REMOVED 제외)
      if (filterMode === "지난") {
        return g.joined && phase === "ended" && !g.isRemoved && !g.isLeft;
      }

      // "참여중" 모드: 현재 active/closing/recruit인 내 그룹만 (ended/LEFT/REMOVED 제외)
      if (filterMode === "참여중") {
        return g.joined && phase !== "ended" && !g.isRemoved && !g.isLeft;
      }

      // "전체" 모드:
      // 강퇴/탈퇴됨 → 항상 표시 (하단 고정)
      if (g.isRemoved || g.isLeft) return true;

      if (phase === "ended") {
        // 참여했던 그룹: 확인 완료 + 3일 초과 → 숨김
        if (g.joined && confirmedEndedIds.has(g.id) && daysSinceEnd(g.challengeEnd) > 3) return false;
        // 참여했던 그룹: 확인 전 또는 3일 이내 → 표시
        if (g.joined) return true;
        // 미참여 종료 챌린지: 5일 이내 → 재개설 알림 신청용으로 표시
        if (canRequestReopenNotify(phase, g.challengeEnd)) return true;
        return false;
      }

      // 마감임박 shouldHide (미참여만): 알림 신청 가능 단계라면 카드는 노출
      if (!g.joined && shouldHide(phase, g.crewRate) && !canRequestReopenNotify(phase, g.challengeEnd)) return false;

      return true;
    })
    .filter((g) => activeCat === "전체" || g.category === activeCat)
    .filter((g) => !searchQuery || g.title.includes(searchQuery) || g.desc.includes(searchQuery))
    .sort((a, b) => sortPriority(a) - sortPriority(b));

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[#F8F8FA]" onClick={() => setShowDropdown(false)}>
      <style>{`
        @keyframes ch-down  { from{opacity:0;transform:translateY(-12px);}to{opacity:1;transform:translateY(0);} }
        @keyframes ch-scale { from{opacity:0;transform:scale(0.96);}to{opacity:1;transform:scale(1);} }
        @keyframes ch-sheet { from{transform:translateY(100%);}to{transform:translateY(0);} }
        @keyframes ch-toast { from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);} }
      `}</style>

      {/* 퇴장 안내 토스트 */}
      {removedToast && (
        <div
          className="fixed bottom-24 left-4 right-4 z-[300] flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{
            background: "rgba(255,51,85,0.95)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 8px 24px rgba(255,51,85,0.35)",
            animation: "ch-toast 0.3s cubic-bezier(0.34,1.56,0.64,1) both",
          }}
        >
          <span className="text-[18px] leading-none shrink-0">🚪</span>
          <div>
            <p className="text-white font-black text-[13px] leading-tight">그룹에서 퇴장됐어요</p>
            <p className="text-white/75 text-[11px] mt-0.5">72시간 미인증으로 인해 자동 퇴장 처리됐어요.</p>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div
        className="shrink-0 bg-white border-b border-black/[0.05] relative z-50"
        style={{ animation: "ch-down 0.4s ease both" }}
      >
        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowDropdown(v => !v)}
              className="flex items-center gap-1.5 active:opacity-70 transition-opacity"
            >
              <h1 className="text-[20px] font-black text-slate-900 tracking-tight">
                {filterMode === "전체" ? "전체 챌린지" : filterMode === "참여중" ? "참여중인 챌린지" : "지난 챌린지"}
              </h1>
              <ChevronDown
                className="w-5 h-5 text-slate-400 mt-0.5 transition-transform duration-200"
                style={{ transform: showDropdown ? "rotate(180deg)" : "rotate(0deg)" }}
              />
            </button>
            {showDropdown && (
              <div
                className="absolute top-full left-0 mt-2 w-44 rounded-2xl bg-white overflow-hidden z-50"
                style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.12)", animation: "ch-down 0.18s ease both" }}
              >
                {(["전체", "참여중", "지난"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => { setFilterMode(mode); setShowDropdown(false); }}
                    className={cn(
                      "w-full px-4 py-3 text-left text-[14px] font-bold transition-colors",
                      filterMode === mode ? "text-[#FF3355] bg-[#FFF0F3]" : "text-slate-700 active:bg-slate-50"
                    )}
                  >
                    {mode === "전체" ? "전체 챌린지" : mode === "참여중" ? "참여중인 챌린지" : "지난 챌린지"}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSearch(v => !v)}
              className={cn(
                "w-9 h-9 flex items-center justify-center rounded-full transition-colors",
                showSearch ? "bg-[#FF3355] text-white" : "bg-slate-100 text-slate-500 active:bg-slate-200"
              )}
            >
              <Search style={{ width: 17, height: 17 }} />
            </button>
          </div>
        </div>
        {showSearch && (
          <div className="px-4 pb-3" style={{ animation: "ch-down 0.2s ease both" }}>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="챌린지 검색..."
              autoFocus
              className="w-full h-10 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-[14px] focus:outline-none focus:border-[#FF3355] transition-colors"
            />
          </div>
        )}
      </div>

      {/* 카테고리 필터 */}
      <div className="flex gap-2 px-4 py-2.5 bg-white border-b border-black/[0.04] overflow-x-auto no-scrollbar"
        style={slide(0)}>
        {CATS.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCat(cat)}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap transition-all duration-200 shrink-0",
              activeCat === cat
                ? "bg-[#FF3355] text-white shadow-[0_4px_12px_rgba(255,51,85,0.3)]"
                : "bg-slate-100 text-slate-500 active:bg-slate-200"
            )}
          >
            {cat !== "전체" && (() => {
              const meta = CAT_META[cat];
              const Icon = meta.icon;
              return <Icon className="w-3 h-3" />;
            })()}
            {cat}
          </button>
        ))}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {/* 통계 배너 */}
        <div className="px-4 pt-3 pb-1" style={slide(60)}>
          <div
            className="relative overflow-hidden rounded-2xl px-4 py-3 flex items-center justify-between"
            style={{ background: "linear-gradient(115deg, #FF3355 0%, #C8002B 100%)", boxShadow: "0 6px 20px rgba(255,51,85,0.25)" }}
          >
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20"
              style={{ background: "radial-gradient(circle, #fff 0%, transparent 70%)" }} />
            <div className="relative">
              <p className="text-white/55 text-[10px] font-bold uppercase tracking-[0.18em] mb-0.5">현재 진행 중</p>
              <p className="text-white text-[22px] font-black leading-tight tracking-tight">{groups.length}<span className="text-[14px] font-semibold text-white/70 ml-1">개 그룹</span></p>
            </div>
            <div className="relative flex items-center gap-4">
              <div className="text-center">
                <p className="text-white text-[18px] font-black leading-none tabular-nums">
                  {groups.reduce((s, g) => s + g.members, 0)}
                </p>
                <p className="text-white/50 text-[10px] mt-0.5 font-medium">참여자</p>
              </div>
              <div className="w-px h-8 bg-white/15" />
              <div className="text-center">
                <p className="text-white text-[18px] font-black leading-none tabular-nums">
                  {groups.length > 0 ? Math.round(groups.reduce((s, g) => s + g.crewRate, 0) / groups.length) : 0}%
                </p>
                <p className="text-white/50 text-[10px] mt-0.5 font-medium">평균 달성</p>
              </div>
            </div>
          </div>
        </div>

        {/* 라이브 티커 */}
        <div className="px-4 pt-2 pb-0">
          <LiveTicker items={liveUnjoined} />
        </div>

        {/* 전체 그룹 리스트 */}
        <div className="px-4 pt-3 pb-6 space-y-2.5">
          {filtered.map((g, i) => {
            const { id, title, desc, members, crewRate, category, joined: isJoined } = g;
            const phase = getPhase(g.challengeStart, g.challengeEnd, g.recruitEnd);
            const joinable = canJoin(phase, crewRate);
            const label = phaseLabel(phase);
            const tagStyle = STATUS_STYLE[label] ?? "text-slate-500 bg-slate-100";
            const isEnded = phase === "ended";
            const isConfirmed = confirmedEndedIds.has(id);

            // 강퇴/탈퇴는 조회만 가능 — 약간 흐릿하게 표시하되 진입은 허용
            const isInactive = g.isRemoved || g.isLeft;

            const canNotifyReopen = canRequestReopenNotify(phase, g.challengeEnd) && !!g.dbId;
            const notifyOn = !!g.dbId && reopenNotifyIds.has(g.dbId);

            return (
              <div
                key={id}
                className={cn(
                  "bg-white rounded-2xl border border-black/[0.04] overflow-hidden transition-all duration-150 active:scale-[0.99] cursor-pointer",
                  isInactive && "opacity-70"
                )}
                style={{ ...slide(i * 55 + 200), boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.04)" }}
                onClick={() => navigate(`/challenge/group/${id}`)}
              >
                <div className="block p-4 pb-3">
                  {/* 상단: 카테고리 + 상태 + 참여중 */}
                  <div className="flex items-center justify-between mb-2">
                    <CatTag category={category} />
                    <div className="flex items-center gap-1.5">
                      {isJoined && !isEnded && (
                        <span className="text-[11px] font-black text-[#FF3355] bg-[#FFE8EC] px-2 py-0.5 rounded-full">참여중</span>
                      )}
                      <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full", tagStyle)}>
                        {label}
                      </span>
                    </div>
                  </div>

                  {/* 제목 + 설명 */}
                  <h3 className="font-black text-[16px] text-slate-900 leading-snug mb-0.5">{title}</h3>
                  <p className="text-[13px] text-slate-400 mb-2.5 leading-relaxed">{desc}</p>

                  {/* 크루 달성률 바 */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: mounted ? `${crewRate}%` : "0%",
                          transition: `width 1s cubic-bezier(0.4,0,0.2,1) ${i * 70 + 300}ms`,
                          background: isEnded ? "#CBD5E1" : "linear-gradient(to right, #FF3355, #FF6680)",
                          boxShadow: isEnded ? "none" : "0 0 8px rgba(255,51,85,0.3)",
                        }}
                      />
                    </div>
                    <span className={cn("text-[14px] font-black shrink-0 tabular-nums w-10 text-right",
                      isEnded ? "text-slate-300" : "text-[#FF3355]"
                    )}>{crewRate}%</span>
                  </div>

                  {/* 멤버 수 + 챌린지 기간 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-slate-400">
                      <Users className="w-3.5 h-3.5" />
                      <span className="text-[12px]">{members}명 참여 중</span>
                    </div>
                    {g.challengeStart && g.challengeEnd && (
                      <span className="text-[11px] text-slate-300 font-medium">
                        {fmtDate(g.challengeStart)} ~ {fmtDate(g.challengeEnd)}
                      </span>
                    )}
                  </div>

                  {/* 크루 달성률 저조 경고 — 챌린지 진행 중일 때만 */}
                  {crewRate <= 39 && (phase === "active" || phase === "closing") && !g.isLeft && !g.isRemoved && (
                    <div className="mt-2 px-3 py-2 bg-red-50 rounded-xl">
                      <p className="text-[11px] text-red-500 font-semibold">앞으로 매일 인증해야 챌린지를 달성할 수 있어요!</p>
                    </div>
                  )}
                </div>

                {/* ── 하단 버튼 영역 ── */}
                <div className="px-4 pb-4 pt-1.5">
                  {/* 참여중 + 진행중 → 탈퇴 버튼 */}
                  {isJoined && !isEnded ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); guardAction(() => setLeaveTarget({ id, title })); }}
                      className="w-full py-2.5 rounded-xl text-[13px] font-bold bg-slate-100 text-slate-400 transition-all duration-200 active:scale-[0.98]"
                    >
                      참여 중 · 탈퇴
                    </button>

                  /* 참여했던 그룹 + 종료됨 + 결과 미확인 → 결과 확인하기 */
                  ) : isJoined && isEnded && !isConfirmed ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/challenge/group/${id}/result`);
                      }}
                      className="w-full py-2.5 rounded-xl text-[13px] font-black text-white transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-1.5"
                      style={{ background: "linear-gradient(115deg,#FF5C7A,#FF3355)", boxShadow: "0 6px 16px -4px rgba(255,51,85,0.45)" }}
                    >
                      <Trophy className="w-3.5 h-3.5" />
                      결과 확인하기
                    </button>

                  /* 참여했던 그룹 + 종료됨 + 결과 확인 완료 → 확인 완료 (disabled) */
                  ) : isJoined && isEnded && isConfirmed ? (
                    <div className="w-full py-2.5 rounded-xl text-[13px] font-bold text-slate-300 bg-slate-50 text-center border border-slate-100">
                      ✓ 결과 확인 완료
                    </div>

                  /* 강퇴됨 */
                  ) : g.isRemoved ? (
                    <div className="w-full py-2.5 rounded-xl text-[13px] font-bold bg-slate-100 text-slate-400 text-center">
                      🚪 퇴장됨 · 조회만 가능
                    </div>

                  /* 탈퇴됨 (영구 — 재참여 불가) */
                  ) : g.isLeft ? (
                    <div className="w-full py-2.5 rounded-xl text-[13px] font-bold bg-slate-100 text-slate-400 text-center">
                      👋 탈퇴됨 · 조회만 가능
                    </div>

                  /* 참여 가능 → 참여하기 */
                  ) : joinable ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        guardAction(() => setJoinTarget({ id, title, desc, members, challengeStart: g.challengeStart, challengeEnd: g.challengeEnd }));
                      }}
                      className="w-full py-2.5 rounded-xl text-[13px] font-bold text-white transition-all duration-200 active:scale-[0.98]"
                      style={{ background: "linear-gradient(115deg,#FF5C7A,#FF3355)", boxShadow: "0 6px 16px -4px rgba(255,51,85,0.45)" }}
                    >
                      참여하기
                    </button>

                  /* 참여 불가 */
                  ) : (
                    <div className="w-full py-2.5 rounded-xl text-[13px] font-bold bg-slate-100 text-slate-300 text-center">
                      {phase === "ended" ? "종료된 챌린지" : phase === "recruit" ? "모집 준비중" : "참가 불가"}
                    </div>
                  )}

                  {/* 재개설 알림 신청 (마감임박 + 종료 후 5일 이내) */}
                  {canNotifyReopen && g.dbId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        guardAction(() => toggleReopenNotify(g.dbId!));
                      }}
                      className={cn(
                        "w-full mt-1 py-1 rounded-lg text-[12px] font-bold transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-1.5",
                        notifyOn
                          ? "text-[#FF3355] bg-[#FFF0F3]"
                          : "text-slate-500 active:bg-slate-50",
                      )}
                    >
                      {notifyOn ? (
                        <>
                          <BellRing className="w-3.5 h-3.5" />
                          재개설 알림 신청됨
                        </>
                      ) : (
                        <>
                          <Bell className="w-3.5 h-3.5" />
                          재개설 알림 신청
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 탈퇴 확인 바텀 시트 */}
      {leaveTarget && (
        <div className="fixed inset-0 z-[200] flex items-end" onClick={() => setLeaveTarget(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full bg-white rounded-t-3xl px-5 pt-5"
            style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))", animation: "ch-sheet 0.3s cubic-bezier(0.32,0.72,0,1) both", boxShadow: "0 -8px 40px rgba(0,0,0,0.12)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-9 h-1 rounded-full bg-slate-200 mx-auto mb-5" />
            <div className="mb-5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">그룹 탈퇴</p>
              <h2 className="text-[20px] font-black text-slate-900 leading-snug mb-1">{leaveTarget.title}</h2>
              <p className="text-[13px] font-bold text-red-500 leading-relaxed">탈퇴 후 다시 참여할 수 없어요.</p>
            </div>
            <div className="h-px bg-slate-100 mb-5" />
            <p className="text-[14px] text-slate-500 text-center mb-5">정말 탈퇴할까요?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setLeaveTarget(null)}
                className="flex-[2] py-3.5 rounded-2xl bg-slate-100 text-slate-500 text-[14px] font-bold active:bg-slate-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => { leaveGroup(leaveTarget.id); setLeaveTarget(null); }}
                className="flex-1 py-3.5 rounded-2xl text-white text-[14px] font-bold active:opacity-90 transition-opacity"
                style={{ background: "linear-gradient(115deg,#FF5C7A,#FF3355)", boxShadow: "0 6px 16px -4px rgba(255,51,85,0.45)" }}
              >
                탈퇴
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 참여 확인 바텀 시트 */}
      {joinTarget && (
        <div className="fixed inset-0 z-[200] flex items-end" onClick={() => setJoinTarget(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full bg-white rounded-t-3xl px-5 pt-5"
            style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))", animation: "ch-sheet 0.3s cubic-bezier(0.32,0.72,0,1) both", boxShadow: "0 -8px 40px rgba(0,0,0,0.12)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-9 h-1 rounded-full bg-slate-200 mx-auto mb-5" />
            <div className="mb-5">
              <p className="text-[11px] font-bold text-[#FF3355] uppercase tracking-widest mb-1">그룹 참여</p>
              <h2 className="text-[20px] font-black text-slate-900 leading-snug mb-1">{joinTarget.title}</h2>
              <p className="text-[13px] text-slate-400 leading-relaxed mb-3">{joinTarget.desc}</p>
              <div className="flex items-center gap-1.5 text-slate-400">
                <Users className="w-3.5 h-3.5" />
                <span className="text-[13px]">현재 {joinTarget.members}명 참여 중</span>
              </div>
            </div>
            {isLateJoiner(joinTarget.challengeStart, joinTarget.challengeEnd, new Date().toISOString()) && (
              <div className="mb-4 px-4 py-3 bg-amber-50 rounded-2xl border border-amber-100">
                <p className="text-[12px] text-amber-700 font-semibold leading-snug">
                  이 챌린지를 지금 참가해도 챌린지 참가권을 얻지 못해요.
                </p>
              </div>
            )}
            {participationTickets <= 0 && (
              <div className="mb-4 px-4 py-3 bg-rose-50 rounded-2xl border border-rose-100">
                <p className="text-[12px] text-rose-700 font-semibold leading-snug">
                  보유한 참가권이 없어요. 다른 챌린지를 완수해서 참가권을 모아보세요.
                </p>
              </div>
            )}
            <div className="h-px bg-slate-100 mb-5" />
            <p className="text-[14px] text-slate-500 text-center mb-5">
              {participationTickets > 0 ? `참가권 1장을 사용해 참여할까요? (보유 ${participationTickets}장)` : "이 그룹에 참여할까요?"}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setJoinTarget(null)}
                className="flex-1 py-3.5 rounded-2xl bg-slate-100 text-slate-500 text-[14px] font-bold active:bg-slate-200 transition-colors"
              >
                취소
              </button>
              <button
                disabled={participationTickets <= 0}
                onClick={() => { joinGroup(joinTarget.id); setSelectedGroupId(joinTarget.id); setJoinTarget(null); navigate("/"); }}
                className="flex-[2] py-3.5 rounded-2xl text-white text-[14px] font-bold active:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed disabled:active:opacity-40"
                style={{ background: "linear-gradient(115deg,#FF5C7A,#FF3355)", boxShadow: "0 6px 16px -4px rgba(255,51,85,0.45)" }}
              >
                참여하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
