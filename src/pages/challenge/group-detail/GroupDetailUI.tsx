import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, Share2, Flame, Crown, Copy, Check, X, Camera, MoreHorizontal, LogOut, AlertTriangle } from "lucide-react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { cn } from "../../../lib/utils";
import { useApp } from "../../../contexts/AppContext";
import { useAuth } from "../../../contexts/AuthContext";
import { VERIFY_TYPES, type VerifyTypeKey } from "../../../lib/verifyTypes";
import { formatActivityTime, loadActivityFeed, type ActivityFeedItem } from "../../../lib/activity";
import { getPhase, getBenefitGrade } from "../../../lib/challengeUtils";
import { loadGroupLeaderboard, type LeaderboardItem } from "../../../lib/leaderboard";

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

const rateColor = (r: number) =>
  r >= 80 ? "#10B981" : r >= 50 ? "#F59E0B" : "#FF3355";

export function GroupDetailUI() {
  const navigate = useNavigate();
  const { groupId = "1" } = useParams<{ groupId: string }>();
  const { groups, joinGroup, leaveGroup, beginVerification, verificationHistory } = useApp();
  const { user } = useAuth();
  const { state: locState } = useLocation() as { state: { tab?: "leaderboard" | "activity" | "gallery"; skipAnimation?: boolean; fromActivityPhoto?: boolean } | null };

  const group  = groups.find(g => g.id === groupId) ?? groups[0];
  const [activityPosts, setActivityPosts] = useState<ActivityFeedItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardItem[]>([]);

  const skipAnim = locState?.skipAnimation ?? false;
  const [mounted, setMounted]                   = useState(skipAnim);
  const [tab, setTab]                           = useState<"leaderboard" | "activity" | "gallery">(locState?.tab ?? "activity");
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

  useEffect(() => {
    if (skipAnim) return;
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!skipAnim || !scrollRef.current) return;
    const saved = sessionStorage.getItem(scrollKey);
    if (saved) {
      scrollRef.current.scrollTop = parseInt(saved);
      sessionStorage.removeItem(scrollKey);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (scrollRef.current) {
        sessionStorage.setItem(scrollKey, String(scrollRef.current.scrollTop));
      }
    };
  }, []);

  const groupDbId = group?.dbId ?? null;
  const phase = getPhase(group.challengeStart, group.challengeEnd, group.recruitEnd);

  // 챌린지 시작 안내 배너: 참여중이고 오늘이 챌린지 시작일인 경우
  useEffect(() => {
    if (!group.joined || !group.challengeStart) return;
    const start = new Date(group.challengeStart);
    const now = new Date();
    const isStartDay = start.toDateString() === now.toDateString();
    const bannerKey = `start-banner-${groupId}`;
    if (isStartDay && !sessionStorage.getItem(bannerKey)) {
      setShowStartBanner(true);
    }
  }, [group.joined, group.challengeStart, groupId]);

  // 저조한 크루 알림: 달성률 39% 이하이고 참여중인 경우
  useEffect(() => {
    if (!group.joined || group.rate > 39) return;
    const alertKey = `low-rate-alert-${groupId}-${new Date().toDateString()}`;
    if (!sessionStorage.getItem(alertKey)) {
      setShowLowRateAlert(true);
    }
  }, [group.joined, group.rate, groupId]);

  // 72시간 미인증 체크: 이 그룹의 마지막 인증이 72시간 초과인 경우
  useEffect(() => {
    if (!group.joined || !groupDbId) return;
    const groupVerifs = verificationHistory.filter(
      v => v.group_id === groupDbId && v.status === "completed"
    );
    if (!groupVerifs.length) return;
    const lastVerif = groupVerifs[0]; // already sorted by desc
    const elapsed = Date.now() - new Date(lastVerif.verified_at).getTime();
    const hours72 = 72 * 60 * 60 * 1000;
    const popup72Key = `leave72-${groupId}-${lastVerif.id}`;
    if (elapsed >= hours72 && !sessionStorage.getItem(popup72Key)) {
      setShowLeave72h(true);
    }
  }, [group.joined, groupDbId, verificationHistory, groupId]);

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
      setActivityLoading(true);
      try {
        const posts = await loadActivityFeed({ groupId: groupDbId, userId: user?.id ?? null, limit: 40 });
        if (!cancelled) setActivityPosts(posts);
      } catch (error) {
        console.error("Failed to load group activity", error);
        if (!cancelled) setActivityPosts([]);
      } finally {
        if (!cancelled) setActivityLoading(false);
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
        if (!cancelled) setLeaderboardRows(rows);
      } catch (error) {
        console.error("Failed to load leaderboard", error);
        if (!cancelled) setLeaderboardRows([]);
      }
    }
    void loadLeaderboard();
    return () => { cancelled = true; };
  }, [groupDbId, user?.id]);

  const dbActivity: ActivityItem[] = activityPosts.map((post, index) => ({
    id: post.id,
    userId: post.user_id,
    name: post.author_name ?? "챌리 유저",
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
    name: post.author_name ?? "챌리 유저",
    seed: post.user_id,
    avatarUrl: post.author_avatar_url,
    time: formatActivityTime(post.created_at),
  }));
  const visibleGalleryItems = galleryItems;
  const myPhotos = verificationHistory.filter(v => v.photo_url && v.status === "completed");

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
            <p className="text-white/45 text-[10px] font-semibold mt-0.5">달성률 {group.rate}%</p>
          </div>
          {group.joined ? (
            <button onClick={startVerification}
              className="w-9 h-9 flex items-center justify-center rounded-full shrink-0 active:scale-95 transition-transform"
              style={{ background: PG }}>
              <Camera className="w-4 h-4 text-white" />
            </button>
          ) : (
            <button onClick={() => setShowJoinConfirm(true)}
              className="h-9 px-3 rounded-full text-[12px] font-black text-white shrink-0 active:scale-95 transition-transform"
              style={{ background: PG }}>
              참여
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
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold"
                style={{ background: `${group.statusColor}CC`, color: "white" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                {group.status}
              </span>
              <span className="px-3 py-1 rounded-full text-[11px] font-bold text-white/80 bg-white/15 backdrop-blur-sm">
                {vt.emoji} {vt.label}
              </span>
              {group.joined && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold text-white bg-white/20 backdrop-blur-sm">
                  <Check className="w-3 h-3" /> 참여 중
                </span>
              )}
            </div>
            <h2 className="text-[28px] font-black text-white tracking-tight leading-tight">{group.title}</h2>
            <p className="text-white/75 mt-1.5 text-[13px] leading-relaxed">{group.desc}</p>
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
                    className="w-10 h-10 rounded-full border-2 border-white bg-slate-100 shrink-0 object-cover" />
                ))}
                <div className="w-10 h-10 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-black text-slate-500">+{Math.max(0, group.members - 3)}</span>
                </div>
              </div>
              <div className="flex-1" />
              <div className="text-right">
                <p className="text-[10px] text-slate-400 font-medium">참여 중</p>
                <p className="text-[18px] font-black text-[#FF3355] leading-none">{group.members.toLocaleString()}명</p>
              </div>
              <div className="w-px h-8 bg-slate-100 shrink-0" />
              <div className="text-right shrink-0">
                <p className="text-[10px] text-slate-400 font-medium">크루 달성률</p>
                <p className="text-[18px] font-black leading-none" style={{ color: rateColor(group.rate) }}>{group.rate}%</p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl px-3.5 py-3 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#FFE8EC] flex items-center justify-center shrink-0">
                <span className="text-[16px]">{vt.emoji}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-slate-400 font-semibold">인증 방식</p>
                <p className="text-[13px] font-black text-slate-900 truncate">{vt.label}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── 챌린지 시작 안내 배너 ── */}
        {showStartBanner && (
          <div className="mx-4 mt-4 rounded-2xl overflow-hidden"
            style={{ background: "linear-gradient(115deg,#FF3355,#FF6680)", boxShadow: "0 4px 16px rgba(255,51,85,0.25)", animation: "noti-drop 0.3s ease both" }}>
            <div className="px-4 py-4 flex items-start gap-3">
              <span className="text-2xl mt-0.5 shrink-0">🚀</span>
              <div className="flex-1 min-w-0">
                <p className="text-white font-black text-[14px] leading-snug mb-1">챌린지가 시작됐어요!</p>
                <p className="text-white/80 text-[12px] leading-relaxed">
                  그룹 챌린지 100%를 달성하기 위해서는 내 달성률이 80% 이상이어야 해요. 내 달성률이 100%라면 특별 보상을 획득할 수 있어요.
                </p>
              </div>
              <button
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-white/20 active:bg-white/30 transition-colors"
                onClick={() => {
                  sessionStorage.setItem(`start-banner-${groupId}`, "1");
                  setShowStartBanner(false);
                }}>
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </div>
        )}

        {/* ── 저조한 크루 달성률 경고 배너 ── */}
        {showLowRateAlert && (
          <div className="mx-4 mt-4 rounded-2xl overflow-hidden bg-red-50 border border-red-100"
            style={{ animation: "noti-drop 0.3s ease both" }}>
            <div className="px-4 py-3.5 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-red-600 font-black text-[13px] mb-0.5">크루 달성률이 낮아요 ({group.rate}%)</p>
                <p className="text-red-500 text-[12px] leading-relaxed">앞으로 매일 인증해야 챌린지를 달성할 수 있어요!</p>
              </div>
              <button
                className="shrink-0 w-6 h-6 flex items-center justify-center"
                onClick={() => {
                  sessionStorage.setItem(`low-rate-alert-${groupId}-${new Date().toDateString()}`, "1");
                  setShowLowRateAlert(false);
                }}>
                <X className="w-4 h-4 text-red-300" />
              </button>
            </div>
            <div className="px-4 pb-3">
              <button
                className="w-full py-2 rounded-xl bg-red-100 text-red-600 text-[13px] font-bold active:bg-red-200 transition-colors"
                onClick={() => {
                  sessionStorage.setItem(`low-rate-alert-${groupId}-${new Date().toDateString()}`, "1");
                  setShowLowRateAlert(false);
                  startVerification();
                }}>
                지금 인증하기
              </button>
            </div>
          </div>
        )}

        {/* ── 내 진행 상태 (토글) ── */}
        {group.joined && myRank && (
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
                <span className="text-[16px] font-black" style={{ color: ["#FF3355","#F59E0B","#10B981","#94a3b8"][["A","B","C","D"].indexOf(getBenefitGrade(myRank.rate, group.rate))] }}>
                  {getBenefitGrade(myRank.rate, group.rate)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-black text-slate-900">예상 베네핏 등급</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {getBenefitGrade(myRank.rate, group.rate) === "A" && "내 달성률 100% — 특별 보상 3개"}
                  {getBenefitGrade(myRank.rate, group.rate) === "B" && "내 달성률 80%+ — 보상 2개"}
                  {getBenefitGrade(myRank.rate, group.rate) === "C" && "내 달성률 50%+ — 보상 1개"}
                  {getBenefitGrade(myRank.rate, group.rate) === "D" && (group.rate < 50 ? "크루 달성률 부족 (50% 미만)" : "내 달성률 50% 미만")}
                </p>
              </div>
              <div className="text-[10px] text-slate-400 shrink-0">크루 {group.rate}%</div>
            </div>
          </div>
        )}

        {/* ── 탭 (sticky) ── */}
        <div ref={tabBarRef} className="sticky top-0 z-20 px-4 pt-4 pb-2 bg-[#F2F2F7]"
          style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.5s ease 0.35s" }}>
          <div className="flex gap-1 p-1 bg-white rounded-2xl border border-black/[0.04]"
            style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            {([
              { key: "activity",    label: "💬  활동" },
              { key: "leaderboard", label: "🏆  순위" },
              { key: "gallery",     label: "📸  갤러리" },
            ] as const).map(({ key: t, label }) => (
              <button key={t} onClick={() => handleTabClick(t)}
                className={cn("flex-1 py-2.5 rounded-xl text-[12px] font-black transition-all duration-200 active:scale-[0.97]",
                  tab === t ? "text-white" : "text-slate-400")}
                style={tab === t ? { background: PG, boxShadow: "0 4px 14px rgba(255,51,85,0.35)" } : {}}>
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
                  style={{ border: "1.5px solid rgba(255,51,85,0.18)", boxShadow: "0 4px 16px rgba(255,51,85,0.08)" }}>
                  {/* 상단: 기본 정보 */}
                  <div className="px-4 pt-3.5 pb-3 flex items-center gap-3">
                    <div className="relative shrink-0">
                      <img src={myRank.avatarUrl ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${myRank.seed}`}
                        className="w-12 h-12 rounded-full bg-slate-100 object-cover" />
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
                  style={{ border: "1.5px solid rgba(255,51,85,0.12)", boxShadow: "0 4px 16px rgba(255,51,85,0.06)" }}>
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
                <div className="rounded-2xl overflow-hidden"
                  style={{ boxShadow: "0 8px 32px rgba(255,51,85,0.15)" }}>

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
                      <div key={name}>
                        {i > 0 && <div className="h-px bg-slate-50 mx-4" />}
                        <div
                          className={cn("flex items-center gap-3 px-4 py-3.5 active:opacity-70 cursor-pointer",
                            isMe ? "bg-[#FFF5F7]" : "")}
                          onClick={() => !isMe && navigate(`/user/${seed}`)}>
                          <span className={cn("w-6 text-center text-[13px] font-black tabular-nums shrink-0",
                            isMe ? "text-[#FF3355]" : "text-slate-300")}>{rank}</span>
                          <img src={avatarUrl ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`}
                            className="w-9 h-9 rounded-full bg-slate-100 shrink-0 object-cover" />
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
                          aspect={i === 0 ? "tall" : "square"} mounted={mounted} delay={i * 80} groupId={groupId} />
                      );
                    })}
                  </div>
                  <div className="flex flex-col gap-2.5 mt-6">
                    {activityItems.filter((_, i) => i % 2 === 1).map((item, i) => {
                      const imgSrc = item.photoUrl ?? undefined;
                      return (
                        <ActivityCard key={item.id ?? i} item={item} imgSrc={imgSrc}
                          aspect={i === 0 ? "square" : "tall"} mounted={mounted} delay={i * 80 + 40} groupId={groupId} />
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
                        className="absolute bottom-1.5 left-1.5 w-5 h-5 rounded-full bg-white border border-white/60 object-cover" />
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
        {group.joined ? (
          <button
            onClick={startVerification}
            className="w-full h-14 flex items-center justify-center gap-2.5 rounded-2xl text-white font-black text-[16px] active:scale-[0.98] transition-transform"
            style={{ background: PG, boxShadow: PS }}>
            <Camera className="w-5 h-5" />
            {vt.emoji} 오늘의 인증하기
          </button>
        ) : (
          <button
            onClick={() => setShowJoinConfirm(true)}
            className="w-full h-14 flex items-center justify-center gap-2 rounded-2xl text-white font-black text-[16px] active:scale-[0.98] transition-transform"
            style={{ background: PG, boxShadow: PS }}>
            ✅ 챌린지 참여하기
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
                className="w-9 h-9 rounded-full bg-white/10 border border-white/20 object-cover" />
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
            {group.joined && (
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

      {/* ── 72시간 미인증 탈퇴 여부 팝업 ── */}
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
                72시간 동안 인증이 없었어요.<br />계속 참여하시겠어요?
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const lastVerif = verificationHistory.filter(v => v.group_id === groupDbId && v.status === "completed")[0];
                  if (lastVerif) sessionStorage.setItem(`leave72-${groupId}-${lastVerif.id}`, "1");
                  setShowLeave72h(false);
                  leaveGroup(groupId);
                  navigate("/challenge");
                }}
                className="flex-1 h-12 rounded-2xl bg-slate-100 text-slate-500 font-bold text-[14px]">
                탈퇴
              </button>
              <button
                onClick={() => {
                  const lastVerif = verificationHistory.filter(v => v.group_id === groupDbId && v.status === "completed")[0];
                  if (lastVerif) sessionStorage.setItem(`leave72-${groupId}-${lastVerif.id}`, "1");
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
              <span className="text-[40px]">🚪</span>
              <h3 className="text-[18px] font-black text-slate-900 mt-2">탈퇴 하시겠습니까?</h3>
              <p className="text-[13px] text-slate-400 mt-1 leading-relaxed">
                <span className="font-bold text-slate-600">{group.title}</span>에서 나가면<br />달성 기록이 초기화될 수 있어요.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 h-12 rounded-2xl bg-slate-100 text-slate-500 font-bold text-[14px]">취소</button>
              <button onClick={() => { leaveGroup(groupId); setShowLeaveConfirm(false); }}
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
  item, imgSrc, aspect, mounted, delay, groupId,
}: {
  item: ActivityItem; imgSrc?: string; aspect: "tall" | "square";
  mounted: boolean; delay: number; groupId: string; key?: React.Key;
}) {
  const navigate = useNavigate();
  const typeEmoji = item.type === "verify" ? "📸" : item.type === "streak" ? "🔥" : item.type === "rank" ? "🏆" : "💬";
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
        <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full"
          style={{ background: typeBg + "CC", backdropFilter: "blur(4px)" }}>
          <span className="text-[9px] font-black" style={{ color: typeColor }}>{typeEmoji} {typeLabel}</span>
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
