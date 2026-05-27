import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, Share2, Flame, Crown, Copy, Check, X, Camera, MoreHorizontal, LogOut, ShieldCheck, ShieldOff, Clock, Trophy, Calendar, Rocket, Dumbbell, MessageCircle, DoorOpen, Hand, Flag, Hourglass, CheckCircle2 } from "lucide-react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { cn } from "../../../lib/utils";
import { useApp } from "../../../contexts/AppContext";
import { useAuth } from "../../../contexts/AuthContext";
import { supabase } from "../../../lib/supabase";
import { VERIFY_TYPES, type VerifyTypeKey } from "../../../lib/verifyTypes";
import { formatActivityTime, loadActivityFeed, type ActivityFeedItem } from "../../../lib/activity";
import { getPhase, getBenefitGrade, phaseLabel } from "../../../lib/challengeUtils";
import { useScrollRestoration } from "../../../lib/useScrollRestoration";

const PHASE_COLORS: Record<string, string> = {
  "모집중":   "#3B82F6",
  "진행중":   "#10B981",
  "마감임박": "#F59E0B",
  "종료":     "#94A3B8",
};

function fmtPeriod(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const fmt = (d: string) => {
    const dt = new Date(d);
    return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
  };
  return `${fmt(start)} ~ ${fmt(end)}`;
}
import { loadGroupLeaderboard, type LeaderboardItem } from "../../../lib/leaderboard";

interface CrewStatus {
  crew_rate: number;
  crew_grade: string;
  contributor_count: number;
  active_count: number;
  removed_count: number;
  my_status: string | null;
  my_is_contributor: boolean;
  my_exit_deadline: string | null;
}

type ActivityItem = {
  id?: string;
  userId?: string;
  name: string; seed: string; time: string; msg: string;
  type: "verify" | "streak" | "rank" | "comment";
  grad: [string, string];
  photoUrl?: string | null;
  avatarUrl?: string | null;
  reactionCount?: number;
  myReaction?: string | null;
};

const INVITE_BASE = "https://chally.app/join/GROUP-";
const PG = "linear-gradient(115deg,#FF3355,#FF6680)";
const PS = "0 8px 24px -4px rgba(255,51,85,0.4)";

// 페이지 복귀 시 깜빡임을 막기 위한 메모리 캐시 (모듈 단위)
const activityCache    = new Map<string, ActivityFeedItem[]>();
const leaderboardCache = new Map<string, LeaderboardItem[]>();
const crewStatusCache  = new Map<string, CrewStatus | null>();

const rateColor = (r: number) =>
  r >= 80 ? "#10B981" : r >= 50 ? "#F59E0B" : "#FF3355";

const gradeColor = (g: string) =>
  g === "A" ? "#10B981" : g === "B" ? "#F59E0B" : g === "C" ? "#3B82F6" : "#94A3B8";

function localDateKey(value: Date | string = new Date()) {
  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function groupNoticeKey(kind: "start" | "low-rate", groupKey: string, userKey: string, dayKey: string, scope = "") {
  return `chally-gd-notice-v1-${kind}-${userKey}-${groupKey}-${scope}-${dayKey}`;
}

function hasStoredNotice(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function storeNotice(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Ignore private-mode/quota errors; the banner can still be dismissed in memory.
  }
}

export function GroupDetailUI() {
  const navigate = useNavigate();
  const { groupId = "1" } = useParams<{ groupId: string }>();
  const { groups, groupsLoading, joinGroup, leaveGroup, markGroupLeft, beginVerification, verificationHistory } = useApp();
  const { user } = useAuth();
  const { state: locState } = useLocation() as { state: { tab?: "leaderboard" | "activity" | "gallery"; skipAnimation?: boolean; fromActivityPhoto?: boolean } | null };

  const group = groups.find(g => g.id === groupId);
  const initialDbId = group?.dbId ?? null;
  const scrollKeyInit = `gd-scroll-${groupId}`;
  const hasCachedActivity = !!initialDbId && activityCache.has(initialDbId);
  const isReturning = hasCachedActivity || sessionStorage.getItem(scrollKeyInit) !== null;

  const [activityPosts, setActivityPosts] = useState<ActivityFeedItem[]>(() => {
    if (!initialDbId) return [];
    return activityCache.get(initialDbId) ?? [];
  });
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityFirstLoaded, setActivityFirstLoaded] = useState(hasCachedActivity);
  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardItem[]>(() => {
    if (!initialDbId) return [];
    return leaderboardCache.get(initialDbId) ?? [];
  });
  const [crewStatus, setCrewStatus] = useState<CrewStatus | null>(() => {
    if (!initialDbId) return null;
    return crewStatusCache.get(initialDbId) ?? null;
  });

  const skipAnim = (locState?.skipAnimation ?? false) || isReturning;
  const tabKey                                  = `gd-tab-${groupId}`;
  const [mounted, setMounted]                   = useState(skipAnim);
  const [tab, setTab]                           = useState<"leaderboard" | "activity" | "gallery">(() => {
    if (locState?.tab) return locState.tab;
    const saved = sessionStorage.getItem(tabKey);
    if (saved === "leaderboard" || saved === "activity" || saved === "gallery") return saved;
    return "activity";
  });
  const [lightbox, setLightbox]                 = useState<{ url: string; name: string; seed: string; avatarUrl?: string | null; time: string } | null>(null);
  const [copied, setCopied]                     = useState(false);
  const [showInvite, setShowInvite]             = useState(false);
  const [showJoinConfirm, setShowJoinConfirm]   = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showActionMenu, setShowActionMenu]     = useState(false);
  const [scrolled, setScrolled]                 = useState(false);
  const [showMyRate, setShowMyRate]             = useState(false);
  const [showStartBanner, setShowStartBanner]   = useState(false);
  const [showLowRateAlert, setShowLowRateAlert] = useState(false);
  const [showLeave72h, setShowLeave72h]         = useState(false);
  const scrollRef                               = useRef<HTMLDivElement>(null);
  const tabBarRef                               = useRef<HTMLDivElement>(null);
  const scrollKey                               = `gd-scroll-${groupId}`;

  useScrollRestoration(scrollKey, scrollRef, !!group && activityFirstLoaded);

  useEffect(() => {
    sessionStorage.setItem(tabKey, tab);
  }, [tab, tabKey]);

  useEffect(() => {
    if (skipAnim) return;
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const groupDbId = group?.dbId ?? null;
  const phase = getPhase(group?.challengeStart ?? null, group?.challengeEnd ?? null, group?.recruitEnd ?? null);
  const noticeGroupKey = groupDbId ?? groupId;
  const noticeUserKey = user?.id ?? "guest";
  // 조회 전용 상태 (REMOVED/LEFT) — 리액션 등 액션 차단용
  const isViewerOnly = !!(group?.isRemoved || group?.isLeft || crewStatus?.my_status === "REMOVED");

  // 챌린지 시작 안내 배너: 참여중이고 오늘이 챌린지 시작일인 경우에만 노출.
  useEffect(() => {
    if (!group?.joined || !group?.challengeStart) {
      setShowStartBanner(false);
      return;
    }

    const todayKey = localDateKey();
    const startDayKey = localDateKey(group.challengeStart);
    const bannerKey = groupNoticeKey("start", noticeGroupKey, noticeUserKey, todayKey, startDayKey);

    setShowStartBanner(startDayKey === todayKey && !hasStoredNotice(bannerKey));
  }, [group?.joined, group?.challengeStart, noticeGroupKey, noticeUserKey]);

  // 저조한 크루 알림: 챌린지 진행 중이고 달성률 39% 이하인 경우 하루 1회 노출.
  useEffect(() => {
    if (!group?.joined || (phase !== "active" && phase !== "closing") || (group?.crewRate ?? 100) > 39) {
      setShowLowRateAlert(false);
      return;
    }

    const todayKey = localDateKey();
    const alertKey = groupNoticeKey("low-rate", noticeGroupKey, noticeUserKey, todayKey);

    setShowLowRateAlert(current => {
      if (current) return true;
      const shouldShow = !hasStoredNotice(alertKey);
      if (shouldShow) storeNotice(alertKey);
      return shouldShow;
    });
  }, [group?.joined, group?.crewRate, phase, noticeGroupKey, noticeUserKey]);

  // 48시간 미인증 체크: 진행 중 챌린지 + 현재 챌린지 기간 인증만 확인
  useEffect(() => {
    if (!group?.joined || !groupDbId) return;
    if (phase !== "active" && phase !== "closing") return;
    const challengeStart = group.challengeStart ? new Date(group.challengeStart) : null;
    const groupVerifs = verificationHistory.filter(
      v => v.group_id === groupDbId &&
           v.status === "completed" &&
           (!challengeStart || new Date(v.verified_at) >= challengeStart)
    );
    if (!groupVerifs.length) return;
    const lastVerif = groupVerifs[0];
    const elapsed = Date.now() - new Date(lastVerif.verified_at).getTime();
    const hours48 = 48 * 60 * 60 * 1000;
    const popup48Key = `leave48-${groupId}-${lastVerif.id}`;
    if (elapsed >= hours48 && !sessionStorage.getItem(popup48Key)) {
      setShowLeave72h(true);
    }
  }, [group?.joined, groupDbId, verificationHistory, groupId, phase, group?.challengeStart]);

  const inviteLink = `${INVITE_BASE}${groupId.padStart(4, "0")}`;
  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const leaderboard = leaderboardRows.length ? leaderboardRows.map(row => ({
    rank: row.rank,
    name: row.name,
    seed: row.seed,
    userId: row.userId,
    avatarUrl: row.avatarUrl,
    streak: row.streak,
    rate: row.rate,
    isMe: row.isMe,
  })) : [];
  const top3     = leaderboard.slice(0, 3);
  const restList = leaderboard.slice(3);
  const vt       = VERIFY_TYPES[(group?.verifyType as VerifyTypeKey) ?? "step_walk"];
  const heroImg  = group?.cover ?? "";
  const myRank   = leaderboard.find(r => r.isMe);

  useEffect(() => {
    let cancelled = false;
    async function loadGroupActivity() {
      if (!groupDbId) {
        setActivityPosts([]);
        return;
      }
      const cached = activityCache.get(groupDbId);
      // 캐시가 있으면 로딩 표시 없이 백그라운드에서 갱신
      if (!cached) setActivityLoading(true);
      try {
        const posts = await loadActivityFeed({ groupId: groupDbId, userId: user?.id ?? null, limit: 40, withinChallengePeriod: true });
        if (!cancelled) {
          setActivityPosts(posts);
          activityCache.set(groupDbId, posts);
        }
      } catch (error) {
        console.error("Failed to load group activity", error);
        if (!cancelled && !cached) setActivityPosts([]);
      } finally {
        if (!cancelled) {
          setActivityLoading(false);
          setActivityFirstLoaded(true);
        }
      }
    }
    void loadGroupActivity();
    return () => { cancelled = true; };
  }, [groupDbId, user?.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadLeaderboard() {
      if (!groupDbId) {
        setLeaderboardRows([]);
        return;
      }
      try {
        const rows = await loadGroupLeaderboard(groupDbId, 30);
        if (!cancelled) {
          setLeaderboardRows(rows);
          leaderboardCache.set(groupDbId, rows);
        }
      } catch (error) {
        console.error("Failed to load leaderboard", error);
        if (!cancelled && !leaderboardCache.has(groupDbId)) setLeaderboardRows([]);
      }
    }
    void loadLeaderboard();
    return () => { cancelled = true; };
  }, [groupDbId, user?.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadCrewStatus() {
      if (!groupDbId || !user) { setCrewStatus(null); return; }
      const { data, error } = await supabase.rpc("get_crew_status", { p_group_id: groupDbId });
      if (cancelled) return;
      if (error || !data?.length) { setCrewStatus(null); return; }
      const status = data[0] as CrewStatus;
      setCrewStatus(status);
      crewStatusCache.set(groupDbId, status);
      // REMOVED 감지: AppContext 동기화만 수행. 페이지는 유지(조회만 가능 상태로 전환됨).
      if (status.my_status === "REMOVED" && !group?.isRemoved) {
        markGroupLeft(groupDbId);
      }
    }
    void loadCrewStatus();
    return () => { cancelled = true; };
  }, [groupDbId, user?.id]);

  if (groupsLoading && !group) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-[#090B10]">
        <div className="w-8 h-8 rounded-full border-2 border-[#FF3355] border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!group) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 bg-white dark:bg-[#090B10]">
        <p className="text-[15px] font-bold text-slate-500">그룹을 찾을 수 없어요</p>
        <button onClick={() => navigate("/challenge")} className="text-[13px] text-[#FF3355] font-semibold">챌린지 목록으로</button>
      </div>
    );
  }

  const authorLabel = (raw: string | null, status: string | null) => {
    const base = raw ?? "챌리 유저";
    if (status === "LEFT")    return `${base} · 탈퇴됨`;
    if (status === "REMOVED") return `${base} · 퇴장됨`;
    return base;
  };

  const dbActivity: ActivityItem[] = activityPosts.map((post, index) => ({
    id: post.id,
    userId: post.user_id,
    name: authorLabel(post.author_name, post.authorMemberStatus),
    seed: post.user_id,
    time: formatActivityTime(post.created_at),
    msg: post.message,
    type: "verify",
    grad: [["#FF3355", "#FF6680"], ["#38BDF8", "#0EA5E9"], ["#34d399", "#059669"]][index % 3] as [string, string],
    photoUrl: post.photo_url,
    avatarUrl: post.author_avatar_url,
    reactionCount: post.reactionCount,
    myReaction: post.myReaction,
  }));
  const activityItems = dbActivity;

  const galleryItems = activityPosts.filter(post => post.photo_url).map(post => ({
    url: post.photo_url ?? "",
    name: authorLabel(post.author_name, post.authorMemberStatus),
    seed: post.user_id,
    avatarUrl: post.author_avatar_url,
    time: formatActivityTime(post.created_at),
  }));
  const visibleGalleryItems = galleryItems;
  const challengeStart = group?.challengeStart ? new Date(group.challengeStart) : null;
  const challengeEnd   = group?.challengeEnd   ? new Date(group.challengeEnd)   : null;
  const myPhotos = verificationHistory.filter(v =>
    v.photo_url &&
    v.status === "completed" &&
    v.group_id === groupDbId &&
    (!challengeStart || new Date(v.verified_at) >= challengeStart) &&
    (!challengeEnd   || new Date(v.verified_at) <= challengeEnd)
  );

  // 포디엄 순서: 2위(좌) - 1위(중앙) - 3위(우)
  const podium = [
    top3.find(r => r.rank === 2),
    top3.find(r => r.rank === 1),
    top3.find(r => r.rank === 3),
  ].filter(Boolean) as typeof top3;

  const startVerification = () => {
    beginVerification({ verifyType: group.verifyType as VerifyTypeKey, groupId: group.dbId ?? null });
    navigate(`/verify/guide/${group.verifyType}`);
  };

  const handleTabClick = (t: "activity" | "leaderboard" | "gallery") => {
    setTab(t);
    tabBarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleBack = () => {
    if (locState?.fromActivityPhoto) {
      navigate("/challenge", { replace: true });
      return;
    }
    navigate(-1);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#F2F2F7] relative">
      <style>{`
        @keyframes sheet-up  { from{opacity:0;transform:translateY(100%);}to{opacity:1;transform:translateY(0);} }
        @keyframes fade-in   { from{opacity:0;}to{opacity:1;} }
        @keyframes noti-drop { from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);} }
      `}</style>

      {/* ── 스크롤 시 컴팩트 바 ── */}
      <div className="absolute top-0 left-0 right-0 z-30 transition-all duration-300"
        style={{
          opacity: scrolled ? 1 : 0,
          transform: scrolled ? "translateY(0)" : "translateY(-100%)",
          background: "rgba(26,10,20,0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}>
        <div className="flex items-center gap-3 px-4 pt-3 pb-3">
          <button onClick={handleBack}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 shrink-0 active:bg-white/20 transition-colors">
            <ChevronLeft className="w-4 h-4 text-white" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-white font-black text-[15px] leading-tight truncate">{group.title}</p>
            {phase !== "recruit" && <p className="text-white/45 text-[10px] font-semibold mt-0.5">크루 달성률 {group.crewRate}%</p>}
          </div>
          {group.joined && phase === "ended" && (
            <button onClick={() => navigate(`/challenge/group/${groupId}/result`)}
              className="h-9 px-3 rounded-full text-[12px] font-black text-white shrink-0 active:scale-95 transition-transform flex items-center gap-1"
              style={{ background: PG }}>
              <Trophy className="w-3.5 h-3.5" />
              결과
            </button>
          )}
        </div>
      </div>

      {/* ── 전체 스크롤 영역 ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto"
        onScroll={() => setScrolled((scrollRef.current?.scrollTop ?? 0) > 260)}>

        {/* ── 히어로 ── */}
        <section className="relative w-full overflow-hidden" style={{ aspectRatio: "1/1" }}>
          {heroImg ? (
            <img src={heroImg} alt={group.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-800 via-slate-700 to-[#FF3355]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />

          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-4 pb-2 z-10">
            <button onClick={handleBack}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-sm active:bg-black/50 transition-colors">
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <button onClick={() => setShowActionMenu(true)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-sm active:bg-black/50 transition-colors">
              <MoreHorizontal className="text-white" style={{ width: 20, height: 20 }} />
            </button>
          </div>

          <div className="absolute bottom-0 left-0 right-0 px-6 pb-14 z-10">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {(() => {
                const phaseText = phaseLabel(phase);
                const phaseColor = PHASE_COLORS[phaseText] ?? "#94A3B8";
                return (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold"
                    style={{ background: `${phaseColor}CC`, color: "white" }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    {phaseText}
                  </span>
                );
              })()}
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold text-white/80 bg-white/15 backdrop-blur-sm">
                <vt.Icon className="w-3 h-3" strokeWidth={2.2} />
                {vt.label}
              </span>
              {group.joined && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold text-white bg-white/20 backdrop-blur-sm">
                  <Check className="w-3 h-3" /> 참여 중
                </span>
              )}
            </div>
            <h2 className="text-[28px] font-black text-white tracking-tight leading-tight">{group.title}</h2>
            <p className="text-white/75 mt-1.5 text-[13px] leading-relaxed">{group.desc}</p>
            {fmtPeriod(group.challengeStart, group.challengeEnd) && (
              <p className="text-white/45 mt-2 text-[11px] font-semibold inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" strokeWidth={2.2} />
                {fmtPeriod(group.challengeStart, group.challengeEnd)}
              </p>
            )}
          </div>
        </section>

        {/* ── 스탯 카드 (히어로 오버랩) ── */}
        <section className="px-4 relative z-10" style={{ marginTop: -40 }}>
          <div className="bg-white rounded-2xl p-5 space-y-4"
            style={{
              boxShadow: "0 10px 40px -10px rgba(0,0,0,0.15)",
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(12px)",
              transition: "opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s",
            }}>
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2.5 shrink-0">
                {top3.map((p, i) => (
                  <img key={i} src={p.avatarUrl ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.seed}`}
                    className="w-10 h-10 rounded-xl border-2 border-white bg-slate-100 shrink-0 object-cover" />
                ))}
                {group.members > 3 && (
                  <div className="w-10 h-10 rounded-xl border-2 border-white bg-slate-100 flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-black text-slate-500">+{group.members - 3}</span>
                  </div>
                )}
              </div>
              <div className="flex-1" />
              <div className="text-right">
                <p className="text-[10px] text-slate-400 font-medium">참여 중</p>
                <p className="text-[18px] font-black text-[#FF3355] leading-none">{group.members.toLocaleString()}명</p>
              </div>
              <div className="w-px h-8 bg-slate-100 shrink-0" />
              <div className="text-right shrink-0">
                <p className="text-[10px] text-slate-400 font-medium">크루 달성률</p>
                <div className="flex items-center justify-end mt-0.5">
                  <p className="text-[18px] font-black leading-none" style={{ color: rateColor(group.crewRate) }}>{group.crewRate}%</p>
                </div>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl px-3.5 py-3 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#FFE8EC] flex items-center justify-center shrink-0">
                <vt.Icon className="w-4 h-4 text-[#FF3355]" strokeWidth={2.2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-slate-400 font-semibold">인증 방식</p>
                <p className="text-[13px] font-black text-slate-900 truncate">{vt.label}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── 퇴장/탈퇴 상태 배너 (조회 전용 안내) ── */}
        {(group.isRemoved || group.isLeft || crewStatus?.my_status === "REMOVED") && (
          <div className="mx-4 mt-4 rounded-2xl overflow-hidden bg-slate-50 border border-slate-200"
            style={{ animation: "noti-drop 0.3s ease both" }}>
            <div className="px-4 py-3.5 flex items-start gap-3">
              {group.isRemoved || crewStatus?.my_status === "REMOVED"
                ? <DoorOpen className="w-5 h-5 mt-0.5 shrink-0 text-slate-500" strokeWidth={2.2} />
                : <Hand className="w-5 h-5 mt-0.5 shrink-0 text-slate-500" strokeWidth={2.2} />
              }
              <div className="flex-1 min-w-0">
                <p className="text-slate-700 font-black text-[13px] mb-0.5">
                  {group.isRemoved || crewStatus?.my_status === "REMOVED" ? "이 그룹에서 퇴장됐어요" : "이 그룹에서 탈퇴했어요"}
                </p>
                <p className="text-slate-500 text-[12px] leading-relaxed">
                  챌린지 진행은 볼 수 있지만, 인증·리액션·재참여는 할 수 없어요.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── 챌린지 시작 안내 배너 ── */}
        {showStartBanner && (
          <div className="mx-4 mt-4 rounded-2xl overflow-hidden"
            style={{ background: "linear-gradient(115deg,#FF3355,#FF6680)", boxShadow: "0 4px 16px rgba(255,51,85,0.25)", animation: "noti-drop 0.3s ease both" }}>
            <div className="px-4 py-4 flex items-start gap-3">
              <Rocket className="w-6 h-6 mt-0.5 shrink-0 text-white" strokeWidth={2} />
              <div className="flex-1 min-w-0">
                <p className="text-white font-black text-[14px] leading-snug mb-1">챌린지가 시작됐어요!</p>
                <p className="text-white/80 text-[12px] leading-relaxed">
                  그룹 챌린지 100%를 달성하기 위해서는 내 달성률이 80% 이상이어야 해요. 내 달성률이 100%라면 특별 보상을 획득할 수 있어요.
                </p>
              </div>
              <button
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-white/20 active:bg-white/30 transition-colors"
                onClick={() => {
                  if (group.challengeStart) {
                    const todayKey = localDateKey();
                    const startDayKey = localDateKey(group.challengeStart);
                    storeNotice(groupNoticeKey("start", noticeGroupKey, noticeUserKey, todayKey, startDayKey));
                  }
                  setShowStartBanner(false);
                }}>
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </div>
        )}

        {/* ── 크루 달성률 격려 배너 ── */}
        {showLowRateAlert && (
          <div className="mx-4 mt-4 rounded-2xl overflow-hidden bg-amber-50 border border-amber-100"
            style={{ animation: "noti-drop 0.3s ease both" }}>
            <div className="px-4 py-3.5 flex items-start gap-3">
              <Dumbbell className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" strokeWidth={2.2} />
              <div className="flex-1 min-w-0">
                <p className="text-amber-700 font-black text-[13px] mb-0.5">함께 100%를 향해 가요 ({group.crewRate}%)</p>
                <p className="text-amber-600 text-[12px] leading-relaxed">오늘 인증으로 크루 달성률을 한 칸 더 올려봐요!</p>
              </div>
              <button
                className="shrink-0 w-6 h-6 flex items-center justify-center"
                onClick={() => {
                  storeNotice(groupNoticeKey("low-rate", noticeGroupKey, noticeUserKey, localDateKey()));
                  setShowLowRateAlert(false);
                }}>
                <X className="w-4 h-4 text-amber-400" />
              </button>
            </div>
            <div className="px-4 pb-3">
              <button
                className="w-full py-2 rounded-xl bg-amber-100 text-amber-700 text-[13px] font-bold active:bg-amber-200 transition-colors"
                onClick={() => {
                  storeNotice(groupNoticeKey("low-rate", noticeGroupKey, noticeUserKey, localDateKey()));
                  setShowLowRateAlert(false);
                  startVerification();
                }}>
                지금 인증하기
              </button>
            </div>
          </div>
        )}

        {/* ── 내 진행 상태 (토글) — 챌린지 시작 후에만 ── */}
        {group.joined && myRank && (phase === "active" || phase === "closing" || phase === "ended") && (
          <div className="mx-4 mt-4">
            <button
              onClick={() => setShowMyRate(v => !v)}
              className="w-full bg-white rounded-2xl px-4 py-3 flex items-center gap-3 active:bg-slate-50 transition-colors"
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <div className="w-10 h-10 rounded-xl bg-[#FFE8EC] flex items-center justify-center shrink-0">
                <span className="text-[15px] font-black text-[#FF3355]">{myRank.rank}</span>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[12px] font-black text-slate-900">내 진행 상태</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-slate-400">달성 {myRank.rate}%</span>
                  <span className="text-slate-200">·</span>
                  <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                    <Flame className="w-3 h-3 text-orange-400 fill-orange-300 inline" /> {myRank.streak}일 연속
                  </span>
                </div>
              </div>
              <ChevronLeft
                className="w-4 h-4 text-slate-300 transition-transform duration-200 shrink-0"
                style={{ transform: showMyRate ? "rotate(-90deg)" : "rotate(180deg)" }}
              />
            </button>

            {showMyRate && (
              <div className="mt-2 bg-white rounded-2xl overflow-hidden"
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)", animation: "noti-drop 0.2s ease both" }}>
                <div className="px-4 py-4">
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="rounded-xl bg-slate-50 px-3 py-3 text-center">
                      <p className="text-[20px] font-black text-slate-900 leading-none">{myRank.rate}%</p>
                      <p className="text-[10px] text-slate-400 mt-1">달성률</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-3 text-center">
                      <p className="text-[20px] font-black text-slate-900 leading-none">{myRank.streak}</p>
                      <p className="text-[10px] text-slate-400 mt-1">연속일</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-3 text-center">
                      <p className="text-[20px] font-black text-slate-900 leading-none">{myRank.rank}</p>
                      <p className="text-[10px] text-slate-400 mt-1">내 순위</p>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${myRank.rate}%`, background: PG }} />
                  </div>
                </div>
              </div>
            )}

            {/* ── 베네핏 등급 안내 ── */}
            <div className="mt-2 bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3"
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex flex-col items-center justify-center shrink-0">
                <span className="text-[16px] font-black" style={{ color: ["#FF3355","#F59E0B","#10B981","#94a3b8"][["A","B","C","D"].indexOf(getBenefitGrade(myRank.rate, group.crewRate))] }}>
                  {getBenefitGrade(myRank.rate, group.crewRate)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-black text-slate-900">예상 베네핏 등급</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {getBenefitGrade(myRank.rate, group.crewRate) === "A" && "내 달성률 100% — 특별 보상 3개"}
                  {getBenefitGrade(myRank.rate, group.crewRate) === "B" && "내 달성률 80%+ — 보상 2개"}
                  {getBenefitGrade(myRank.rate, group.crewRate) === "C" && "내 달성률 50%+ — 보상 1개"}
                  {getBenefitGrade(myRank.rate, group.crewRate) === "D" && (group.crewRate < 50 ? "크루 달성률 부족 (50% 미만)" : "내 달성률 50% 미만")}
                </p>
              </div>
              <div className="text-[10px] text-slate-400 shrink-0">크루 {group.crewRate}%</div>
            </div>
          </div>
        )}

        {/* ── 탭 (sticky) ── */}
        <div ref={tabBarRef} className="sticky top-0 z-20 px-4 pt-4 pb-2 bg-[#F2F2F7]"
          style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.5s ease 0.35s" }}>
          <div className="flex gap-1 p-1 bg-white rounded-2xl border border-black/[0.04]"
            style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            {([
              { key: "activity",    label: "활동",   Icon: MessageCircle },
              { key: "leaderboard", label: "순위",   Icon: Trophy },
              { key: "gallery",     label: "갤러리", Icon: Camera },
            ] as const).map(({ key: t, label, Icon }) => (
              <button key={t} onClick={() => handleTabClick(t)}
                className={cn("flex-1 py-2.5 rounded-xl text-[12px] font-black transition-all duration-200 active:scale-[0.97] inline-flex items-center justify-center gap-1.5",
                  tab === t ? "text-white" : "text-slate-400")}
                style={tab === t ? { background: PG, boxShadow: "0 4px 14px rgba(255,51,85,0.35)" } : {}}>
                <Icon className="w-3.5 h-3.5" strokeWidth={2.4} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── 탭 컨텐츠 ── */}
        <div className="pb-6">
          {tab === "leaderboard" ? (
            <div className="px-4 mt-3 space-y-2.5">
              {/* 내 정보 카드 */}
              {myRank ? (
                <div className="bg-white rounded-2xl overflow-hidden"
                  style={{ border: "1.5px solid rgba(255,51,85,0.18)" }}>
                  {/* 상단: 기본 정보 */}
                  <div className="px-4 pt-3.5 pb-3 flex items-center gap-3">
                    <div className="relative shrink-0">
                      <img src={myRank.avatarUrl ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${myRank.seed}`}
                        className="w-12 h-12 rounded-xl bg-slate-100 object-cover" />
                      <span className="absolute -bottom-1 -right-1 text-[9px] font-black text-white bg-[#FF3355] px-1.5 py-0.5 rounded-full leading-none">나</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-black text-slate-900 truncate">{myRank.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 mb-1.5">
                        <span className="text-[11px] text-slate-400">달성 {myRank.rate}%</span>
                        <span className="text-slate-200 text-[11px]">·</span>
                        <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                          <Flame className="w-3 h-3 text-orange-400 fill-orange-300 inline" /> {myRank.streak}일 연속
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${myRank.rate}%`, background: PG }} />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] text-slate-400 font-medium">순위</p>
                      <p className="text-[22px] font-black text-[#FF3355] leading-none">{myRank.rank}위</p>
                    </div>
                  </div>

                  {/* 하단: 내 인증 사진 스트립 */}
                  <div className="border-t border-slate-50">
                    {myPhotos.length > 0 ? (
                      <div className="flex gap-1.5 px-3 py-3 overflow-x-auto"
                        style={{ scrollbarWidth: "none" }}>
                        {myPhotos.slice(0, 10).map((v, i) => (
                          <button
                            key={v.id}
                            className="shrink-0 relative rounded-xl overflow-hidden active:opacity-80 transition-opacity"
                            style={{ width: 72, height: 72 }}
                            onClick={() => navigate(`/challenge/group/${groupId}/activity`, {
                              state: {
                                imgSrc: v.photo_url,
                                grad: ["#FF3355", "#FF6680"] as [string, string],
                                name: myRank.name,
                                seed: myRank.seed,
                                time: new Date(v.verified_at).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" }),
                                msg: "내 인증 사진",
                                type: "verify",
                                canReact: !isViewerOnly,
                              },
                            })}
                          >
                            <img src={v.photo_url!} alt={`인증 ${i + 1}`}
                              className="w-full h-full object-cover bg-slate-100" />
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-1.5 pb-1">
                              <p className="text-white text-[8px] font-bold leading-none">
                                {new Date(v.verified_at).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 px-4 py-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                          <Camera className="w-4 h-4 text-slate-300" />
                        </div>
                        <p className="text-[12px] text-slate-400">아직 인증 사진이 없어요</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : group.joined ? (
                <div className="bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3"
                  style={{ border: "1.5px solid rgba(255,51,85,0.12)" }}>
                  <div className="w-12 h-12 rounded-full bg-[#FFE8EC] flex items-center justify-center shrink-0">
                    <span className="text-[20px]">🙋</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-black text-slate-700">순위 집계 중이에요</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">첫 인증 후 순위가 나타나요</p>
                  </div>
                </div>
              ) : null}

              {/* 포디엄 + 리스트 통합 카드 */}
              {leaderboard.length > 0 ? (
                <div className="rounded-2xl overflow-hidden">

                {/* 포디엄 영역 */}
                <div style={{ background: "white", borderBottom: "1px solid rgba(255,51,85,0.1)" }}>
                  <div className="flex items-end px-4 pt-7 gap-2">
                    {podium.map((p) => {
                      const is1st = p.rank === 1;
                      const is3rd = p.rank === 3;
                      const avatarSize = is1st ? 62 : is3rd ? 42 : 48;
                      const topPad = is1st ? 0 : is3rd ? 44 : 24;
                      return (
                        <div key={p.rank}
                          className="flex flex-col items-center pb-5 cursor-pointer active:opacity-70 transition-opacity"
                          style={{ flex: is1st ? "1.2" : "1", paddingTop: topPad }}
                          onClick={() => !p.isMe && navigate(`/user/${p.seed}`)}>
                          {is1st ? (
                            <Crown className="w-5 h-5 text-amber-400 fill-amber-400 mb-2" />
                          ) : (
                            <div className="w-6 h-6 rounded-full flex items-center justify-center mb-2.5"
                              style={{ background: "rgba(255,51,85,0.1)" }}>
                              <span className="text-[11px] font-black text-[#FF3355]">{p.rank}</span>
                            </div>
                          )}
                          <img
                            src={p.avatarUrl ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.seed}`}
                            className="rounded-full bg-slate-100 object-cover"
                            style={{
                              width: avatarSize,
                              height: avatarSize,
                              border: is1st ? "3px solid #FF3355" : "2px solid rgba(255,51,85,0.25)",
                              boxShadow: is1st ? "0 4px 16px rgba(255,51,85,0.25)" : "none",
                            }}
                          />
                          <p className={cn("font-black text-center w-full truncate px-1",
                            is1st ? "text-[13px] mt-2.5 text-slate-900" : "text-[11px] mt-2 text-slate-700")}>
                            {p.name}
                          </p>
                          <p className={cn("font-black tabular-nums mt-0.5 text-[#FF3355]",
                            is1st ? "text-[18px]" : "text-[14px]")}>
                            {p.rate}%
                          </p>
                          <div className="flex items-center gap-0.5 mt-0.5">
                            <Flame className="w-2.5 h-2.5 text-orange-400 fill-orange-300" />
                            <span className="text-[10px] text-slate-400">{p.streak}일</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 4위~ 리스트 */}
                {restList.length > 0 && (
                  <div className="bg-white">
                    {restList.map(({ rank, name, seed, avatarUrl, streak, rate: r, isMe }, i) => (
                      <div key={seed}>
                        {i > 0 && <div className="h-px bg-slate-50 mx-4" />}
                        <div
                          className={cn("flex items-center gap-3 px-4 py-3.5 active:opacity-70 cursor-pointer",
                            isMe ? "bg-[#FFF5F7]" : "")}
                          onClick={() => !isMe && navigate(`/user/${seed}`)}>
                          <span className={cn("w-6 text-center text-[13px] font-black tabular-nums shrink-0",
                            isMe ? "text-[#FF3355]" : "text-slate-300")}>{rank}</span>
                          <img src={avatarUrl ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`}
                            className="w-9 h-9 rounded-xl bg-slate-100 shrink-0 object-cover" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className={cn("text-[13px] font-bold truncate",
                                isMe ? "text-[#FF3355]" : "text-slate-800")}>{name}</p>
                              {isMe && (
                                <span className="text-[9px] font-black text-white bg-[#FF3355] px-1.5 py-0.5 rounded-full shrink-0">나</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Flame className="w-2.5 h-2.5 text-orange-400 fill-orange-300" />
                              <span className="text-[11px] text-slate-400">{streak}일 연속</span>
                            </div>
                          </div>
                          <span className="text-[14px] font-black tabular-nums shrink-0"
                            style={{ color: rateColor(r) }}>{r}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              ) : (
                <div className="bg-white rounded-2xl px-5 py-8 text-center border border-black/[0.04]">
                  <div className="w-12 h-12 rounded-2xl bg-[#FFE8EC] flex items-center justify-center mx-auto mb-3">
                    <Crown className="w-5 h-5 text-[#FF3355]" />
                  </div>
                  <p className="text-[14px] font-black text-slate-900">아직 순위가 없어요</p>
                  <p className="text-[12px] text-slate-400 mt-1 leading-relaxed">그룹 멤버가 인증하면 순위가 표시돼요.</p>
                </div>
              )}
            </div>

          ) : tab === "activity" ? (
            /* ── 활동 피드 ── */
            <div className="px-4 mt-3">
              {activityItems.length > 0 ? (
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="flex flex-col gap-2.5">
                    {activityItems.filter((_, i) => i % 2 === 0).map((item, i) => {
                      const imgSrc = item.photoUrl ?? undefined;
                      return (
                        <ActivityCard key={item.id ?? i} item={item} imgSrc={imgSrc}
                          aspect={i === 0 ? "tall" : "square"} mounted={mounted} delay={i * 80} groupId={groupId} canReact={!isViewerOnly} />
                      );
                    })}
                  </div>
                  <div className="flex flex-col gap-2.5 mt-6">
                    {activityItems.filter((_, i) => i % 2 === 1).map((item, i) => {
                      const imgSrc = item.photoUrl ?? undefined;
                      return (
                        <ActivityCard key={item.id ?? i} item={item} imgSrc={imgSrc}
                          aspect={i === 0 ? "square" : "tall"} mounted={mounted} delay={i * 80 + 40} groupId={groupId} canReact={!isViewerOnly} />
                      );
                    })}
                  </div>
                </div>
              ) : activityLoading ? (
                <div className="bg-white rounded-2xl px-5 py-8 text-center border border-black/[0.04]">
                  <p className="text-[13px] font-bold text-slate-400">활동을 불러오는 중이에요</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl px-5 py-8 text-center border border-black/[0.04]">
                  <div className="w-12 h-12 rounded-2xl bg-[#FFE8EC] flex items-center justify-center mx-auto mb-3">
                    <Camera className="w-5 h-5 text-[#FF3355]" />
                  </div>
                  <p className="text-[14px] font-black text-slate-900">아직 활동이 없어요</p>
                  <p className="text-[12px] text-slate-400 mt-1 leading-relaxed">첫 인증을 남기면 이곳에 기록돼요.</p>
                </div>
              )}
            </div>

          ) : (
            /* ── 그룹 갤러리 ── */
            <div className="px-4 mt-3">
              {/* 헤더 */}
              <div className="flex items-center justify-between mb-3">
                <p className="text-[12px] font-black text-slate-400">
                  총 <span className="text-[#FF3355]">{visibleGalleryItems.length}</span>개의 인증 사진
                </p>
                <span className="text-[11px] text-slate-400">{group.members}명 참여 중</span>
              </div>

              {visibleGalleryItems.length > 0 ? (
                <div className="grid grid-cols-3 gap-1">
                  {visibleGalleryItems.map((item, i) => (
                    <button key={i} onClick={() => setLightbox(item)}
                      className="relative aspect-square rounded-xl overflow-hidden active:opacity-80 transition-opacity"
                      style={{ opacity: mounted ? 1 : 0, transition: `opacity 0.35s ease ${i * 30}ms` }}>
                      <img src={item.url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      {/* 바텀 그라데이션 + 아바타 */}
                      <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none"
                        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent)" }} />
                      <img src={item.avatarUrl ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.seed}`} alt=""
                        className="absolute bottom-1.5 left-1.5 w-5 h-5 rounded-md bg-white border border-white/60 object-cover" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-2xl px-5 py-8 text-center border border-black/[0.04]">
                  <div className="w-12 h-12 rounded-2xl bg-[#FFE8EC] flex items-center justify-center mx-auto mb-3">
                    <Camera className="w-5 h-5 text-[#FF3355]" />
                  </div>
                  <p className="text-[14px] font-black text-slate-900">아직 인증 사진이 없어요</p>
                  <p className="text-[12px] text-slate-400 mt-1 leading-relaxed">사진 인증이 완료되면 갤러리에 표시돼요.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── FAB: 단일 주요 액션 ── */}
      <div className="shrink-0 px-4 pb-8 pt-3 bg-[#F2F2F7] border-t border-black/[0.04]">
        {/* 종료됨 + (참여중이었거나/REMOVED/LEFT) → 결과 확인하기 */}
        {phase === "ended" && (group.joined || group.isRemoved || group.isLeft || crewStatus?.my_status === "REMOVED") ? (
          <button
            onClick={() => navigate(`/challenge/group/${groupId}/result`)}
            className="w-full h-14 flex items-center justify-center gap-2.5 rounded-2xl text-white font-black text-[16px] active:scale-[0.98] transition-transform"
            style={{ background: "linear-gradient(115deg,#FF5C7A,#FF3355)", boxShadow: PS }}>
            <Trophy className="w-5 h-5" />
            결과 확인하기
          </button>

        /* 강퇴됨 (진행 중) */
        ) : crewStatus?.my_status === "REMOVED" || group.isRemoved ? (
          <div className="w-full h-14 flex items-center justify-center gap-2 rounded-2xl bg-slate-100 border border-black/[0.06]">
            <DoorOpen className="w-4 h-4 text-slate-400" strokeWidth={2.2} />
            <span className="text-[15px] font-black text-slate-400">퇴장됨 · 조회만 가능</span>
          </div>

        /* 탈퇴됨 (영구 — 재참여 불가) */
        ) : group.isLeft ? (
          <div className="w-full h-14 flex items-center justify-center gap-2 rounded-2xl bg-slate-100 border border-black/[0.06]">
            <Hand className="w-4 h-4 text-slate-400" strokeWidth={2.2} />
            <span className="text-[15px] font-black text-slate-400">탈퇴됨 · 조회만 가능</span>
          </div>

        /* 비참여 + 종료됨 */
        ) : phase === "ended" ? (
          <div className="w-full h-14 flex items-center justify-center gap-2 rounded-2xl bg-slate-100 border border-black/[0.06]">
            <Flag className="w-4 h-4 text-slate-400" strokeWidth={2.2} />
            <span className="text-[15px] font-black text-slate-400">챌린지가 종료됐어요</span>
          </div>

        /* 참여중 + 모집중 → 아직 시작 전 */
        ) : group.joined && phase === "recruit" ? (
          <div className="w-full h-16 flex items-center justify-center gap-2.5 rounded-2xl bg-blue-50 border border-blue-100">
            <Hourglass className="w-[18px] h-[18px] text-blue-400" strokeWidth={2.2} />
            <div className="flex flex-col items-start gap-1">
              <span className="text-[16px] font-black text-blue-400 leading-none">챌린지 시작을 기다리는 중이에요</span>
              {group.challengeStart && (
                <span className="text-[13px] font-bold text-blue-300 leading-none">
                  오픈까지 D-{Math.max(0, Math.ceil((new Date(group.challengeStart).getTime() - Date.now()) / 86_400_000))}
                </span>
              )}
            </div>
          </div>

        /* 참여중 → 인증하기 */
        ) : group.joined ? (
          <button
            onClick={startVerification}
            className="w-full h-14 flex items-center justify-center gap-2.5 rounded-2xl text-white font-black text-[16px] active:scale-[0.98] transition-transform"
            style={{ background: PG, boxShadow: PS }}>
            <Camera className="w-5 h-5" />
            오늘 인증하기
          </button>

        /* 미참여 → 참여하기 */
        ) : (
          <button
            onClick={() => setShowJoinConfirm(true)}
            className="w-full h-14 flex items-center justify-center gap-2 rounded-2xl text-white font-black text-[16px] active:scale-[0.98] transition-transform"
            style={{ background: PG, boxShadow: PS }}>
            <CheckCircle2 className="w-5 h-5" strokeWidth={2.4} />
            챌린지 참여하기
          </button>
        )}
      </div>

      {/* ── 갤러리 라이트박스 ── */}
      {lightbox && (
        <div className="absolute inset-0 z-50 flex flex-col"
          style={{ background: "rgba(0,0,0,0.92)", animation: "fade-in 0.18s ease both" }}
          onClick={() => setLightbox(null)}>
          {/* 닫기 */}
          <div className="flex items-center justify-between px-4 pt-5 pb-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <img src={lightbox.avatarUrl ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${lightbox.seed}`} alt=""
                className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 object-cover" />
              <div>
                <p className="text-white font-black text-[13px] leading-none">{lightbox.name}</p>
                <p className="text-white/45 text-[11px] mt-0.5">{lightbox.time}</p>
              </div>
            </div>
            <button onClick={() => setLightbox(null)}
              className="w-9 h-9 rounded-full flex items-center justify-center active:opacity-60"
              style={{ background: "rgba(255,255,255,0.12)" }}>
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
          {/* 사진 */}
          <div className="flex-1 flex items-center justify-center px-4 pb-8" onClick={e => e.stopPropagation()}>
            <img src={lightbox.url} alt="" className="w-full max-h-full object-contain rounded-2xl"
              style={{ boxShadow: "0 16px 48px rgba(0,0,0,0.5)" }} referrerPolicy="no-referrer" />
          </div>
        </div>
      )}

      {/* ── 액션 메뉴 ── */}
      {showActionMenu && (
        <div className="absolute inset-0 z-50 flex items-start justify-end px-4 pt-16" onClick={() => setShowActionMenu(false)}
          style={{ background: "rgba(0,0,0,0.22)", animation: "fade-in 0.16s ease both" }}>
          <div className="w-52 rounded-2xl bg-white overflow-hidden border border-black/[0.06]"
            style={{ boxShadow: "0 16px 40px rgba(15,23,42,0.18)", animation: "noti-drop 0.18s ease both" }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => { setShowActionMenu(false); setShowInvite(true); }}
              className="w-full h-12 px-4 flex items-center gap-3 text-left active:bg-slate-50 transition-colors">
              <Share2 className="w-4 h-4 text-slate-500" />
              <span className="text-[13px] font-bold text-slate-700">그룹 초대</span>
            </button>
            {group.joined && phase !== "ended" && (
              <>
                <div className="h-px bg-slate-100 mx-4" />
                <button onClick={() => { setShowActionMenu(false); setShowLeaveConfirm(true); }}
                  className="w-full h-12 px-4 flex items-center gap-3 text-left active:bg-slate-50 transition-colors">
                  <LogOut className="w-4 h-4 text-[#FF3355]" />
                  <span className="text-[13px] font-bold text-[#FF3355]">그룹 탈퇴</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── 초대 링크 시트 ── */}
      {showInvite && (
        <div className="absolute inset-0 z-50 flex items-end" onClick={() => setShowInvite(false)}
          style={{ background: "rgba(0,0,0,0.5)", animation: "fade-in 0.2s ease both" }}>
          <div className="w-full bg-white rounded-t-3xl p-6" onClick={e => e.stopPropagation()}
            style={{ animation: "sheet-up 0.35s cubic-bezier(0.4,0,0.2,1) both" }}>
            <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-5" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[18px] font-black text-slate-900">그룹 초대</h3>
              <button onClick={() => setShowInvite(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <p className="text-[13px] text-slate-500 mb-4 leading-relaxed">아래 링크를 공유하면 친구를 이 그룹으로 초대할 수 있어요</p>
            <div className="flex gap-2">
              <div className="flex-1 h-12 px-4 rounded-2xl bg-slate-100 flex items-center overflow-hidden">
                <span className="text-[13px] text-slate-600 font-semibold truncate">{inviteLink}</span>
              </div>
              <button onClick={handleCopy}
                className="h-12 px-4 rounded-2xl flex items-center gap-1.5 text-[13px] font-black text-white active:scale-95 transition-all"
                style={{
                  background: copied ? "#10B981" : PG,
                  boxShadow: copied ? "0 8px 20px -4px rgba(16,185,129,0.5)" : "0 8px 20px -4px rgba(255,51,85,0.4)",
                  transition: "all 0.3s ease",
                }}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "복사됨" : "복사"}
              </button>
            </div>
            <div className="pb-2" />
          </div>
        </div>
      )}

      {/* ── 참여 확인 시트 ── */}
      {showJoinConfirm && (
        <div className="absolute inset-0 z-50 flex items-end" onClick={() => setShowJoinConfirm(false)}
          style={{ background: "rgba(0,0,0,0.5)", animation: "fade-in 0.2s ease both" }}>
          <div className="w-full bg-white rounded-t-3xl p-6" onClick={e => e.stopPropagation()}
            style={{ animation: "sheet-up 0.35s cubic-bezier(0.4,0,0.2,1) both" }}>
            <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-5" />
            <h3 className="text-[18px] font-black text-slate-900 mb-1">그룹 참여하기</h3>
            <p className="text-[13px] text-slate-500 mb-5 leading-relaxed">
              <span className="font-bold text-slate-700">{group.title}</span>에 참여하시겠어요?{" "}
              목표를 달성하지 못하면 그룹 순위에 영향을 줍니다.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowJoinConfirm(false)}
                className="flex-1 h-12 rounded-2xl bg-slate-100 text-slate-500 font-bold text-[14px]">취소</button>
              <button onClick={() => { joinGroup(groupId); setShowJoinConfirm(false); }}
                className="flex-1 h-12 rounded-2xl text-white font-black text-[14px] active:scale-95 transition-all"
                style={{ background: PG, boxShadow: "0 8px 20px -4px rgba(255,51,85,0.5)" }}>
                참여하기
              </button>
            </div>
            <div className="pb-2" />
          </div>
        </div>
      )}

      {/* ── 48시간 미인증 탈퇴 여부 팝업 ── */}
      {showLeave72h && (
        <div className="absolute inset-0 z-50 flex items-end"
          style={{ background: "rgba(0,0,0,0.5)", animation: "fade-in 0.2s ease both" }}>
          <div className="w-full bg-white rounded-t-3xl p-6"
            style={{ animation: "sheet-up 0.35s cubic-bezier(0.4,0,0.2,1) both" }}>
            <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-5" />
            <div className="text-center mb-5">
              <span className="text-[40px]">😥</span>
              <h3 className="text-[18px] font-black text-slate-900 mt-2">챌린지에 참여하고 있나요?</h3>
              <p className="text-[13px] text-slate-400 mt-2 leading-relaxed">
                48시간 동안 인증이 없었어요.<br />계속 참여하시겠어요?
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const lastVerif = verificationHistory.filter(v => v.group_id === groupDbId && v.status === "completed" && (!challengeStart || new Date(v.verified_at) >= challengeStart))[0];
                  if (lastVerif) sessionStorage.setItem(`leave48-${groupId}-${lastVerif.id}`, "1");
                  setShowLeave72h(false);
                  leaveGroup(groupId);
                  sessionStorage.removeItem("ch-scroll");
                  navigate("/challenge");
                }}
                className="flex-1 h-12 rounded-2xl bg-slate-100 text-slate-500 font-bold text-[14px]">
                탈퇴
              </button>
              <button
                onClick={() => {
                  const lastVerif = verificationHistory.filter(v => v.group_id === groupDbId && v.status === "completed" && (!challengeStart || new Date(v.verified_at) >= challengeStart))[0];
                  if (lastVerif) sessionStorage.setItem(`leave48-${groupId}-${lastVerif.id}`, "1");
                  setShowLeave72h(false);
                  startVerification();
                }}
                className="flex-[2] h-12 rounded-2xl text-white font-black text-[14px] active:scale-95 transition-all"
                style={{ background: PG, boxShadow: "0 8px 20px -4px rgba(255,51,85,0.5)" }}>
                지금 인증하기
              </button>
            </div>
            <div className="pb-2" />
          </div>
        </div>
      )}

      {/* ── 탈퇴 확인 시트 ── */}
      {showLeaveConfirm && (
        <div className="absolute inset-0 z-50 flex items-end" onClick={() => setShowLeaveConfirm(false)}
          style={{ background: "rgba(0,0,0,0.5)", animation: "fade-in 0.2s ease both" }}>
          <div className="w-full bg-white rounded-t-3xl p-6" onClick={e => e.stopPropagation()}
            style={{ animation: "sheet-up 0.35s cubic-bezier(0.4,0,0.2,1) both" }}>
            <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-5" />
            <div className="text-center mb-5">
              <div className="inline-flex w-16 h-16 rounded-2xl bg-slate-100 items-center justify-center">
                <DoorOpen className="w-8 h-8 text-slate-500" strokeWidth={2} />
              </div>
              <h3 className="text-[18px] font-black text-slate-900 mt-2">탈퇴 하시겠습니까?</h3>
              <p className="text-[13px] text-slate-500 mt-2 leading-relaxed">
                <span className="font-bold text-red-500">탈퇴 후 다시 참여할 수 없어요.</span><br />
                <span className="font-bold text-slate-600">{group.title}</span>에서 정말 나가시겠어요?
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 h-12 rounded-2xl bg-slate-100 text-slate-500 font-bold text-[14px]">취소</button>
              <button onClick={() => { leaveGroup(groupId); setShowLeaveConfirm(false); sessionStorage.removeItem("ch-scroll"); navigate("/challenge"); }}
                className="flex-1 h-12 rounded-2xl text-white font-black text-[14px] active:scale-95 transition-all"
                style={{ background: PG, boxShadow: "0 8px 20px -4px rgba(255,51,85,0.5)" }}>
                탈퇴하기
              </button>
            </div>
            <div className="pb-2" />
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityCard({
  item, imgSrc, aspect, mounted, delay, groupId, canReact = true,
}: {
  item: ActivityItem; imgSrc?: string; aspect: "tall" | "square";
  mounted: boolean; delay: number; groupId: string; canReact?: boolean; key?: React.Key;
}) {
  const navigate = useNavigate();
  const TypeIcon  = item.type === "verify" ? Camera : item.type === "streak" ? Flame : item.type === "rank" ? Trophy : MessageCircle;
  const typeLabel = item.type === "verify" ? "인증" : item.type === "streak" ? "연속달성" : item.type === "rank" ? "순위" : "댓글";
  const typeBg    = item.type === "verify" ? "#FFF0F3" : item.type === "streak" ? "#FFF7ED" : "#F1F5F9";
  const typeColor = item.type === "verify" ? "#FF3355" : item.type === "streak" ? "#FB923C" : "#64748B";

  return (
    <div
      className="rounded-2xl overflow-hidden bg-white border border-black/[0.04] shadow-sm active:scale-[0.97] transition-transform cursor-pointer"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? "none" : "translateY(12px)",
        transition: `opacity 0.4s ease ${delay}ms, transform 0.4s ease ${delay}ms`,
      }}
      onClick={() => navigate(`/challenge/group/${groupId}/activity`, {
        state: {
          postId: item.id,
          userId: item.userId,
          imgSrc,
          grad: item.grad,
          name: item.name,
          seed: item.seed,
          time: item.time,
          msg: item.msg,
          type: item.type,
          reactionCount: item.reactionCount,
          myReaction: item.myReaction,
          canReact,
        },
      })}
    >
      <div className={`relative ${aspect === "tall" ? "aspect-[3/4]" : "aspect-square"}`}>
        {imgSrc ? (
          <img src={imgSrc} alt={item.msg} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-full" style={{ background: `linear-gradient(135deg,${item.grad[0]},${item.grad[1]})` }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full inline-flex items-center gap-1"
          style={{ background: typeBg + "CC", backdropFilter: "blur(4px)" }}>
          <TypeIcon className="w-2.5 h-2.5" style={{ color: typeColor }} strokeWidth={2.4} />
          <span className="text-[9px] font-black" style={{ color: typeColor }}>{typeLabel}</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <button
            className="flex items-center gap-1.5 mb-1 w-full active:opacity-70 transition-opacity"
            onClick={e => { e.stopPropagation(); navigate(`/user/${item.userId ?? item.seed}`); }}
          >
            <img src={item.avatarUrl ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.seed}`}
              className="w-5 h-5 rounded-full bg-white/20 shrink-0 object-cover" />
            <span className="text-white text-[11px] font-black truncate">{item.name}</span>
            <span className="text-white/50 text-[10px] ml-auto shrink-0">{item.time}</span>
          </button>
          <p className="text-white/80 text-[11px] leading-snug line-clamp-2">{item.msg}</p>
        </div>
      </div>
    </div>
  );
}
