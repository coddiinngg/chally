import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import { Bell, BellRing, Camera, Flame, Send, Crown, ChevronRight, Zap, Lightbulb, SmilePlus, Trophy, ArrowRight, X, ChevronLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useApp } from "../contexts/AppContext";
import { useAuth } from "../contexts/AuthContext";
import { VERIFY_TYPES, type VerifyTypeKey } from "../lib/verifyTypes";
import { useGuestGuard } from "../contexts/GuestGuardContext";
import { formatActivityTime, loadActivityFeed, reactionCache, type ActivityFeedItem, type ActivityEmoji } from "../lib/activity";
import { loadGroupLeaderboard, type LeaderboardItem } from "../lib/leaderboard";
import { formatChatTime, loadGroupMessages, type GroupChatMessage, type MessageEmoji } from "../lib/chat";
import { supabase } from "../lib/supabase";
import type { GroupMessageRecord } from "../types/database";
import { getBenefitGrade } from "../lib/challengeUtils";

const MEDAL = ["🥇", "🥈", "🥉"];
const rateColor = (r: number) => r >= 80 ? "#10B981" : r >= 50 ? "#F59E0B" : "#FF3355";

interface InAppToastItem {
  id: string;
  emoji: string;
  text: string;
}

interface ChatMsg {
  id: string; sender: string; text: string;
  seed: string; time: string; isMe?: boolean;
  type?: "achievement";
  achieverName?: string;
  streak?: number;
  dbMessage?: GroupChatMessage;
}

const EMOJI_REACTIONS: MessageEmoji[] = ["❤️", "😂", "🔥", "👍", "😮", "🎉"];

const SLIDE_COUNT = 3;

// 컴포넌트 외부 — 리마운트 시에도 유지되어 중복 재로드·애니메이션 방지
let lastAnimatedGroupId: string | null = null;
// 피드 캐시 — 뒤로가기 시 깜박임 방지
let feedCache: ActivityFeedItem[] | null = null;
// 리더보드 캐시 — 뒤로가기 시 flash 방지
let leaderboardCacheMap: Record<string, LeaderboardItem[]> = {};
// 스크롤 위치 저장 — 뒤로가기 시 복원
let savedScrollTop = 0;
// 슬라이드 인덱스 저장 — 뒤로가기 시 슬라이드(메인/순위/채팅) 복원
let savedSlideIdx = 0;
// 그룹별 읽지 않은 채팅 카운트 — 세션 내 유지
let chatUnreadCountMap: Record<string, number> = {};
// 채팅 메시지 캐시 — 뒤로가기 시 빈 화면 방지
type ChatCacheEntry = { messages: ChatMsg[]; reactions: Record<string, MessageEmoji> };
let chatMessagesCache: Record<string, ChatCacheEntry> = {};
// 최초 마운트 여부 — 헤더 진입 애니메이션 재생 방지
let homeMountedOnce = false;

interface FeedItem {
  id: string;
  postId?: string;
  user: string;
  seed: string;
  time: string;
  caption: string;
  groupTitle: string;
  verifyEmoji: string;
  img: string;
  aspect: "tall" | "square";
  reactionCount?: number;
  myReaction?: string | null;
  avatarUrl?: string | null;
}

export function Home() {
  // 뒤로가기 복귀 시 헤더 애니메이션 재생 방지
  const isReturnVisit = homeMountedOnce;

  const navigate = useNavigate();
  const location = useLocation();
  const { nickname, beginVerification, groups, groupsLoading, groupsLoadError, selectedGroupId, setSelectedGroupId, notifications, latestNotification, confirmedEndedIds, confirmEndedGroup } = useApp();
  const { user } = useAuth();
  const myGroups = groups.filter(g => g.joined && !confirmedEndedIds.has(g.id));

  // 뒤로가기 복귀 시 채팅 캐시에서 초기화 (빈 화면 방지)
  const initGroupDbId = (myGroups.find(g => g.id === selectedGroupId) ?? myGroups[0])?.dbId;
  const initChatCache = initGroupDbId ? chatMessagesCache[initGroupDbId] : undefined;

  const [slideIdx, setSlideIdx]               = useState(() => savedSlideIdx);
  const [chats, setChats]                     = useState<ChatMsg[]>(() => initChatCache?.messages ?? []);
  const [chatInput, setChatInput]             = useState("");
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [btnFlash, setBtnFlash]               = useState(false);
  const [notifMode, setNotifMode]             = useState(false);
  const { guardAction } = useGuestGuard();
  const [reactions, setReactions]           = useState<Record<string, MessageEmoji>>(() => initChatCache?.reactions ?? {});
  const [emojiPickerFor, setEmojiPickerFor] = useState<string | null>(null);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>(feedCache ?? []);
  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardItem[]>(
    selectedGroupId ? (leaderboardCacheMap[selectedGroupId] ?? []) : []
  );
  const [chatAtBottom, setChatAtBottom]     = useState(true);
  const [lastReadMsgId, setLastReadMsgId]   = useState<string | null>(null);
  const [, setUnreadTick]                   = useState(0);
  const [chatSendError, setChatSendError]   = useState(false);
  // FeedViewer — location.state 기반: 히스토리 엔트리로 관리하여 뒤로가기가 자연스럽게 닫힘
  const feedViewerOpen = typeof location.state?.feedViewer === "number";
  const feedViewerIdx  = (location.state?.feedViewer as number | undefined) ?? 0;
  const chatSendErrTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [inAppToasts, setInAppToasts]       = useState<InAppToastItem[]>([]);
  const toastTimers                         = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // 그룹별 1위 userId 추적 — 변경 시 인앱 토스트
  const prevRank1Ref = useRef<Record<string, string>>({});

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const chatEndRef      = useRef<HTMLDivElement>(null);
  const chatScrollRef   = useRef<HTMLDivElement>(null);
  const lastReadSetRef  = useRef(false);
  const longPressTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const btnFlashTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animFrameRef    = useRef<number | null>(null);
  const isAnimatingRef  = useRef(false);
  const rateDisplayRef  = useRef<HTMLSpanElement>(null);
  const notifModeRef    = useRef(false);
  notifModeRef.current  = notifMode;
  const slideIdxRef     = useRef(slideIdx);
  const selGroupIdRef   = useRef(selectedGroupId);
  slideIdxRef.current   = slideIdx;
  selGroupIdRef.current = selectedGroupId;
  // slideIdx 변경 시 모듈 변수에 저장 — 다른 페이지 다녀와도 같은 슬라이드 유지
  useEffect(() => { savedSlideIdx = slideIdx; }, [slideIdx]);
  const ignoreTapRef    = useRef(false);
  const startX          = useRef(0);
  const startY         = useRef(0);
  const dragging       = useRef(false);
  const isHoriz        = useRef<boolean | null>(null);
  const moved          = useRef(false);

  // 타이머 cleanup (unmount 시)
  useEffect(() => {
    homeMountedOnce = true; // 최초 마운트 완료 — 이후 복귀 시 헤더 애니메이션 스킵
    return () => {
      if (longPressTimer.current)   clearTimeout(longPressTimer.current);
      if (btnFlashTimer.current)    clearTimeout(btnFlashTimer.current);
      if (animFrameRef.current)     cancelAnimationFrame(animFrameRef.current);
      if (chatSendErrTimer.current) clearTimeout(chatSendErrTimer.current);
      toastTimers.current.forEach(t => clearTimeout(t));
      // 언마운트 시 스크롤 위치 저장
      if (scrollContainerRef.current) savedScrollTop = scrollContainerRef.current.scrollTop;
    };
  }, []);

  const showInAppToast = useCallback((emoji: string, text: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setInAppToasts(prev => [...prev.slice(-2), { id, emoji, text }]);
    const t = setTimeout(() => {
      setInAppToasts(prev => prev.filter(n => n.id !== id));
      toastTimers.current.delete(id);
    }, 4200);
    toastTimers.current.set(id, t);
  }, []);

  // 마운트 시 스크롤 위치 복원 (paint 전 동기 실행)
  useLayoutEffect(() => {
    if (savedScrollTop > 0 && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = savedScrollTop;
    }
  }, []);

  // 서버 알림 도착 → 인앱 토스트 (챌린지 관련 타입만)
  useEffect(() => {
    if (!latestNotification) return;
    if (!["group", "streak", "rank", "member_warning", "member_removed"].includes(latestNotification.type)) return;
    showInAppToast(latestNotification.emoji ?? "🔔", latestNotification.body);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestNotification?.id]);

  useEffect(() => {
    if (feedCache) return; // 캐시 있으면 재요청 생략 — 뒤로가기 시 깜박임 방지
    let cancelled = false;
    async function loadHomeFeed() {
      try {
        const posts = await loadActivityFeed({ userId: user?.id ?? null, limit: 20 });
        if (!cancelled) { setActivityFeed(posts); feedCache = posts; }
      } catch (error) {
        console.error("Failed to load home activity feed", error);
        if (!cancelled) setActivityFeed([]);
      }
    }
    void loadHomeFeed();
    return () => { cancelled = true; };
  }, [user?.id]);

  // 앱 시작·그룹 변경 시 퍼센트 카운트업 — DOM 직접 조작으로 re-render 없이 60fps
  const groupRate = (myGroups.find(g => g.id === selectedGroupId) ?? myGroups[0])?.crewRate ?? 0;
  useEffect(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    const el = rateDisplayRef.current;
    if (!el) return;
    if (groupRate === 0) { el.textContent = "0"; return; }
    // 같은 그룹으로 재진입(홈 탭 재방문)이면 애니메이션 생략
    if (lastAnimatedGroupId === selectedGroupId) {
      el.textContent = String(groupRate);
      return;
    }
    lastAnimatedGroupId = selectedGroupId;
    isAnimatingRef.current = true;
    el.textContent = "1";
    const start = performance.now();
    const duration = 800;
    function step(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      if (el) el.textContent = String(Math.max(1, Math.round(eased * groupRate)));
      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        isAnimatingRef.current = false;
      }
    }
    animFrameRef.current = requestAnimationFrame(step);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      isAnimatingRef.current = false;
    };
  // groupRate는 selectedGroupId에 종속되므로 별도 dep 불필요
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId]);

  // groupRate가 변경됐을 때 애니메이션 미실행 중이면 DOM 동기화
  useEffect(() => {
    const el = rateDisplayRef.current;
    if (el && !isAnimatingRef.current) el.textContent = String(groupRate);
  }, [groupRate]);

  const selectedGroup = myGroups.find(g => g.id === selectedGroupId) ?? myGroups[0];
  const isExitEligible = !!selectedGroup?.isExitEligible;
  const isChallengeEnded = !!(
    selectedGroup?.challengeEnd &&
    new Date(selectedGroup.challengeEnd) < new Date()
  );
  const isChallengeRecruit = !!(
    selectedGroup?.recruitEnd &&
    new Date(selectedGroup.recruitEnd) > new Date()
  );

  useEffect(() => {
    setChatInput("");
    let cancelled = false;
    const selectedDbId = selectedGroup?.dbId ?? null;

    function mapDbMessage(message: GroupMessageRecord, myReaction: MessageEmoji | null = null): ChatMsg {
      return {
        id: message.id,
        sender: message.author_name ?? "챌리 유저",
        text: message.body,
        seed: message.user_id,
        time: formatChatTime(message.created_at),
        isMe: message.user_id === user?.id,
        dbMessage: { ...message, myReaction },
      };
    }

    async function loadChat() {
      if (!selectedDbId || !user) {
        setChats([]);
        return;
      }

      try {
        const messages = await loadGroupMessages({ groupId: selectedDbId, userId: user.id, limit: 50 });
        if (cancelled) return;
        const mappedMessages = messages.length ? messages.map(m => mapDbMessage(m, m.myReaction)) : [];
        const mappedReactions: Record<string, MessageEmoji> = Object.fromEntries(
          messages
            .filter(m => m.myReaction && EMOJI_REACTIONS.includes(m.myReaction as MessageEmoji))
            .map(m => [m.id, m.myReaction as MessageEmoji])
        );
        setChats(mappedMessages);
        setReactions(mappedReactions);
        // 로드 완료 후 캐시 저장 — 뒤로가기 복귀 시 즉시 표시
        if (selectedDbId) chatMessagesCache[selectedDbId] = { messages: mappedMessages, reactions: mappedReactions };
      } catch (error) {
        console.error("Failed to load group messages", error);
        if (!cancelled) setChats([]);
      }
    }

    void loadChat();

    const channel = selectedDbId && user
      ? supabase
        .channel(`group-messages:${selectedDbId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${selectedDbId}` },
          (payload) => {
            const message = payload.new as GroupMessageRecord;
            setChats(prev => {
              if (prev.some(item => item.id === message.id)) return prev;
              return [...prev, mapDbMessage(message)];
            });
            setTimeout(() => {
              const el = chatScrollRef.current;
              if (el) el.scrollTop = el.scrollHeight;
            }, 50);
          }
        )
        .subscribe()
      : null;

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel).catch(err => console.error("removeChannel failed:", err));
    };
  }, [selectedGroup?.dbId, selectedGroupId, user?.id]);

  // 전체 그룹 미읽음 채팅 카운트 실시간 추적
  const myGroupsDbKey = myGroups.map(g => g.dbId ?? "").join(",");
  useEffect(() => {
    if (!user || myGroups.length === 0) return;
    const channels = myGroups.flatMap(g => {
      if (!g.dbId) return [];
      const ch = supabase
        .channel(`unread:${g.dbId}`)
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${g.dbId}` },
          (payload) => {
            const msg = payload.new as GroupMessageRecord;
            if (msg.user_id === user.id) return;
            const isReading = slideIdxRef.current === 2 && selGroupIdRef.current === g.id;
            if (!isReading) {
              chatUnreadCountMap[g.id] = (chatUnreadCountMap[g.id] ?? 0) + 1;
              setUnreadTick(t => t + 1);
            }
          }
        )
        .subscribe();
      return [ch];
    });
    return () => { channels.forEach(ch => supabase.removeChannel(ch).catch(err => console.error("removeChannel failed:", err))); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myGroupsDbKey, user?.id]);

  // 참여 중인 그룹 목록이 바뀌면 selectedGroupId 유효성 확인
  useEffect(() => {
    if (myGroups.length > 0 && !myGroups.find(g => g.id === selectedGroupId)) {
      setSelectedGroupId(myGroups[0].id);
    }
  }, [myGroups.length, selectedGroupId]);

  const rankers       = leaderboardRows.length
    ? leaderboardRows.map(row => ({
      rank: row.rank,
      name: row.name,
      streak: row.streak,
      rate: row.rate,
      seed: row.userId,
      avatarUrl: row.avatarUrl,
      isMe: row.isMe,
    }))
    : [];

  useEffect(() => {
    let cancelled = false;
    async function loadRanking() {
      if (!selectedGroup?.dbId) {
        setLeaderboardRows([]);
        return;
      }
      try {
        const rows = await loadGroupLeaderboard(selectedGroup.dbId, 10);
        if (!cancelled) {
          setLeaderboardRows(rows);
          if (selectedGroupId) leaderboardCacheMap[selectedGroupId] = rows;
          // 1위 변경 감지 → 인앱 토스트
          if (rows.length > 0 && selectedGroup.dbId) {
            const newTop = rows[0];
            const prev   = prevRank1Ref.current[selectedGroup.dbId];
            if (prev && prev !== newTop.userId) {
              showInAppToast("👑", `${newTop.name}님이 1위에 올랐어요!`);
            }
            prevRank1Ref.current[selectedGroup.dbId] = newTop.userId;
          }
        }
      } catch (error) {
        console.error("Failed to load home leaderboard", error);
        if (!cancelled) setLeaderboardRows([]);
      }
    }
    void loadRanking();
    return () => { cancelled = true; };
  }, [selectedGroup?.dbId, user?.id]);

  const dbFeedItems: FeedItem[] = activityFeed.map((post, index) => {
    const vt = VERIFY_TYPES[(post.verify_type as VerifyTypeKey) ?? "step_walk"] ?? VERIFY_TYPES.step_walk;
    return {
      id: post.id,
      postId: post.id,
      user: post.author_name ?? "챌리 유저",
      seed: post.user_id,
      time: formatActivityTime(post.created_at),
      caption: post.message,
      groupTitle: vt.label,
      verifyEmoji: vt.emoji,
      img: post.photo_url ?? "",
      aspect: index % 3 === 0 ? "tall" : "square",
      reactionCount: post.reactionCount,
      myReaction: post.myReaction,
      avatarUrl: post.author_avatar_url,
    };
  });
  const recentFeed  = dbFeedItems;

  /* ── 스와이프: 수평/수직 판별 ── */
  function touchBegin(x: number, y: number) {
    if (ignoreTapRef.current) { ignoreTapRef.current = false; return; }
    startX.current = x; startY.current = y;
    dragging.current = true; isHoriz.current = null; moved.current = false;
  }
  function touchMove(x: number, y: number) {
    if (!dragging.current) return;
    const dx = Math.abs(x - startX.current), dy = Math.abs(y - startY.current);
    if (isHoriz.current === null && (dx > 5 || dy > 5)) isHoriz.current = dx > dy;
    if (isHoriz.current && dx > 8) moved.current = true;
  }
  function touchEnd(x: number) {
    if (ignoreTapRef.current) { ignoreTapRef.current = false; dragging.current = false; return; }
    if (!dragging.current) return;
    dragging.current = false;
    if (isHoriz.current === false) return; // 수직 스와이프는 무시
    const dx = x - startX.current;
    if (!moved.current) {
      if (slideIdx === 0 && !showGroupPicker) {
        if (notifModeRef.current) {
          if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
          if (rateDisplayRef.current) rateDisplayRef.current.textContent = String(groupRate);
          setNotifMode(false);
        } else if (myGroups.length > 0) {
          navigate(`/challenge/group/${selectedGroupId}`);
        }
      }
      return;
    }
    if (dx < -50 && slideIdx < SLIDE_COUNT - 1) setSlideIdx(i => i + 1);
    if (dx >  50 && slideIdx > 0)               setSlideIdx(i => i - 1);
  }

  function startLongPress(msgId: string) {
    longPressTimer.current = setTimeout(() => setEmojiPickerFor(msgId), 500);
  }
  function cancelLongPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }
  function addReaction(msgId: string, emoji: MessageEmoji) {
    const msg = chats.find(item => item.id === msgId);
    if (!msg?.dbMessage || !user) {
      setEmojiPickerFor(null);
      return;
    }

    const prev = reactions[msgId] ?? null;
    setReactions(prev => {
      const next = { ...prev };
      if (next[msgId] === emoji) delete next[msgId]; // 같은 이모지 탭 → 제거
      else next[msgId] = emoji;
      return next;
    });
    setEmojiPickerFor(null);

    const nextEmoji = prev === emoji ? null : emoji;
    const mutation = nextEmoji
      ? supabase.from("group_message_reactions").upsert({ message_id: msgId, user_id: user.id, emoji: nextEmoji })
      : supabase.from("group_message_reactions").delete().eq("message_id", msgId).eq("user_id", user.id);

    void mutation.then(({ error }) => {
      if (!error) return;
      console.error("Failed to save message reaction", error);
      setReactions(current => {
        const next = { ...current };
        if (prev) next[msgId] = prev;
        else delete next[msgId];
        return next;
      });
    });
  }

  function selectGroup(id: string) {
    setSelectedGroupId(id);
    setShowGroupPicker(false);
    setNotifMode(false);
    setBtnFlash(true);
    if (btnFlashTimer.current) clearTimeout(btnFlashTimer.current);
    btnFlashTimer.current = setTimeout(() => setBtnFlash(false), 600);
  }

  async function sendChat() {
    const text = chatInput.trim();
    if (!text) return;
    if (!selectedGroup?.dbId || !user) return;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2,"0"), mm = String(now.getMinutes()).padStart(2,"0");
    const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setChats(p => [...p, { id: tempId, sender: nickname, text, seed: user.id, time: `${hh}:${mm}`, isMe: true }]);
    setChatInput("");
    setTimeout(() => {
      const el = chatScrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);

    const { data, error } = await supabase
      .from("group_messages")
      .insert({
        group_id: selectedGroup.dbId,
        user_id: user.id,
        body: text,
        author_name: nickname,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Failed to send group message", error);
      setChats(prev => prev.filter(msg => msg.id !== tempId));
      setChatInput(text);
      setChatSendError(true);
      if (chatSendErrTimer.current) clearTimeout(chatSendErrTimer.current);
      chatSendErrTimer.current = setTimeout(() => setChatSendError(false), 3000);
      return;
    }

    setChats(prev => prev.map(msg => msg.id === tempId ? {
      id: data.id,
      sender: data.author_name ?? nickname,
      text: data.body,
      seed: data.user_id,
      time: formatChatTime(data.created_at),
      isMe: true,
      dbMessage: { ...data, myReaction: null },
    } : msg));
  }

  /* 채팅 탭 진입 시 읽음 마커 설정 + 하단 스크롤 + 미읽음 카운트 초기화 */
  useEffect(() => {
    if (slideIdx === 2 && chats.length > 0 && !lastReadSetRef.current) {
      lastReadSetRef.current = true;
      setLastReadMsgId(chats[chats.length - 1].id);
      // 슬라이드 전환 애니메이션(420ms) 후 하단으로 스크롤
      setTimeout(() => {
        const el = chatScrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
        setChatAtBottom(true);
      }, 460);
    }
    if (slideIdx !== 2) lastReadSetRef.current = false;
    if (slideIdx === 2 && selectedGroupId && (chatUnreadCountMap[selectedGroupId] ?? 0) > 0) {
      chatUnreadCountMap[selectedGroupId] = 0;
      setUnreadTick(t => t + 1);
    }
  }, [slideIdx, chats.length, selectedGroupId]);

  const slideTx = (i: number) => `translate3d(${(i - slideIdx) * 100}%, 0, 0)`;
  const trans = "transform 0.42s cubic-bezier(0.4, 0, 0.2, 1)";
  const recentNotifs = notifications.slice(0, 5);
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-white relative">
      <style>{`
        @keyframes hm-in     { from{opacity:0;transform:translateY(-10px);}to{opacity:1;transform:translateY(0);} }
        @keyframes sheet-up  { from{transform:translateY(100%);}to{transform:translateY(0);} }
        @keyframes picker-in { from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);} }
        @keyframes btn-flash { 0%{opacity:1} 30%{opacity:0.6;transform:scale(0.98)} 60%{opacity:1;transform:scale(1.01)} 100%{opacity:1;transform:scale(1)} }
        @keyframes notif-drop {
          from { opacity: 0; transform: translateY(-14px) scale(0.93); }
          to   { opacity: 1; transform: translateY(0)     scale(1); }
        }
        @keyframes badge-pulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.12); }
        }
        @keyframes toast-slide-in {
          from { opacity: 0; transform: translateY(-10px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)     scale(1); }
        }
        @keyframes ee-flame-rise {
          0%   { transform: translateY(0) scale(1) rotate(-2deg); opacity: 0.9; }
          50%  { transform: translateY(-8px) scale(1.08) rotate(2deg); opacity: 1; }
          100% { transform: translateY(0) scale(1) rotate(-2deg); opacity: 0.9; }
        }
        @keyframes ee-border-pulse {
          0%, 100% { box-shadow: 0 4px 24px rgba(0,0,0,0.08), 0 0 0 2px rgba(255,80,40,0.85), 0 0 24px rgba(255,80,40,0.35); }
          50%      { box-shadow: 0 4px 24px rgba(0,0,0,0.08), 0 0 0 3px rgba(255,140,40,1), 0 0 36px rgba(255,80,40,0.6); }
        }
        @keyframes ee-button-glow {
          0%, 100% { box-shadow: 0 8px 24px rgba(255,80,40,0.45), 0 0 0 0 rgba(255,140,40,0.6), 0 1px 0 rgba(255,255,255,0.12) inset; }
          50%      { box-shadow: 0 12px 32px rgba(255,80,40,0.65), 0 0 0 4px rgba(255,140,40,0), 0 1px 0 rgba(255,255,255,0.18) inset; }
        }
        @keyframes ee-ribbon-shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      {/* 헤더 */}
      <header className="shrink-0 bg-white z-10 px-6 pt-3 pb-1 relative"
        style={{ animation: isReturnVisit ? "none" : "hm-in 0.4s ease both", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FF3355] flex items-center justify-center text-white font-black text-[16px] shrink-0 shadow-[0_4px_12px_rgba(255,51,85,0.35)]">
              {nickname.charAt(0)}
            </div>
            <div>
              <p className="text-slate-900 font-black text-[17px] leading-none">{nickname} 님</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/challenge/request")}
              className="relative w-9 h-9 flex items-center justify-center rounded-full bg-[#FF3355]/10 active:bg-[#FF3355]/20 transition-colors">
              <Lightbulb className="w-5 h-5 text-[#FF3355]" />
            </button>
            <button onClick={() => navigate("/notifications")}
              className="relative w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 active:bg-slate-200 transition-colors">
              <Bell className="w-5 h-5 text-slate-500" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#FF3355]" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* 인앱 토스트 알림 */}
      {inAppToasts.length > 0 && (
        <div className="absolute top-[68px] left-4 right-4 z-50 flex flex-col gap-1.5 pointer-events-none">
          {inAppToasts.map(t => (
            <div
              key={t.id}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl"
              style={{
                background: "rgba(15,15,20,0.88)",
                backdropFilter: "blur(16px)",
                border: "1px solid rgba(255,255,255,0.10)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
                animation: "toast-slide-in 0.32s cubic-bezier(0.34,1.56,0.64,1) both",
              }}
            >
              <span className="text-[18px] leading-none shrink-0">{t.emoji}</span>
              <span className="text-white text-[13px] font-semibold leading-snug">{t.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* 본문 */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto no-scrollbar flex flex-col">
        <div className="px-4 pt-2 shrink-0">

          {/* ── 슬라이드 카드 ── */}
          <div
            className="relative w-full overflow-hidden select-none rounded-2xl"
            style={{
              aspectRatio: "2/3",
              boxShadow: isExitEligible
                ? undefined
                : "0 4px 24px rgba(0,0,0,0.08), 0 0 0 1.5px rgba(255,51,85,0.25)",
              outline: "none",
              animation: isExitEligible ? "ee-border-pulse 1.4s ease-in-out infinite" : undefined,
            }}
            onTouchStart={e => touchBegin(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchMove={e  => touchMove(e.touches[0].clientX,  e.touches[0].clientY)}
            onTouchEnd={e   => touchEnd(e.changedTouches[0].clientX)}
            onMouseDown={e  => touchBegin(e.clientX, e.clientY)}
            onMouseMove={e  => touchMove(e.clientX,  e.clientY)}
            onMouseUp={e    => touchEnd(e.clientX)}
            onMouseLeave={() => { dragging.current = false; isHoriz.current = null; }}
          >

            {/* ─── EXIT_ELIGIBLE 경고 오버레이 (48h 미인증 — 불꽃 + 리본) ─── */}
            {isExitEligible && (
              <>
                {/* 상단 리본 */}
                <div className="absolute top-0 left-0 right-0 z-30 px-4 pt-3 pointer-events-none">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{
                      background: "linear-gradient(90deg, rgba(255,80,40,0.95) 0%, rgba(255,140,40,0.95) 50%, rgba(255,80,40,0.95) 100%)",
                      backgroundSize: "200% 100%",
                      animation: "ee-ribbon-shimmer 2.4s linear infinite",
                      boxShadow: "0 4px 16px rgba(255,80,40,0.5)",
                    }}>
                    <span className="text-[18px] leading-none"
                      style={{ animation: "ee-flame-rise 1.2s ease-in-out infinite", display: "inline-block" }}>🔥</span>
                    <div className="flex-1">
                      <p className="text-white font-black text-[12px] leading-tight">48시간 미인증 경고</p>
                      <p className="text-white/85 text-[10px] leading-tight">지금 인증하지 않으면 자동 퇴장돼요</p>
                    </div>
                  </div>
                </div>
                {/* 하단 좌측 큰 불꽃 */}
                <span className="absolute bottom-4 left-4 z-30 text-[44px] leading-none pointer-events-none"
                  style={{ animation: "ee-flame-rise 1.1s ease-in-out infinite", filter: "drop-shadow(0 0 12px rgba(255,140,40,0.8))" }}>
                  🔥
                </span>
                {/* 하단 우측 작은 불꽃 */}
                <span className="absolute bottom-6 right-6 z-30 text-[28px] leading-none pointer-events-none"
                  style={{ animation: "ee-flame-rise 1.4s ease-in-out infinite", animationDelay: "0.3s", filter: "drop-shadow(0 0 10px rgba(255,80,40,0.7))" }}>
                  🔥
                </span>
              </>
            )}

            {/* ─── 슬라이드 1 ─── */}
            <div className="absolute inset-0 overflow-hidden"
              style={{ transform: slideTx(0), transition: trans, willChange: "transform" }}>

              {groupsLoading && myGroups.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900">
                  <div className="flex gap-1.5">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-2 h-2 rounded-full bg-white/40"
                        style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                    ))}
                  </div>
                  <p className="text-white/50 text-[13px] font-semibold">그룹 정보를 불러오는 중...</p>
                </div>
              ) : groupsLoadError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-50 px-8 text-center">
                  <span className="text-4xl">📡</span>
                  <p className="text-slate-700 font-black text-[16px]">그룹 정보를 불러오지 못했어요</p>
                  <p className="text-slate-400 text-[13px]">네트워크 연결을 확인하고 다시 시도해주세요</p>
                </div>
              ) : myGroups.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-50">
                  <span className="text-4xl">🏃</span>
                  <p className="text-slate-700 font-black text-[16px]">참여 중인 그룹이 없어요</p>
                  <p className="text-slate-400 text-[13px]">챌린지 탭에서 그룹에 참여해보세요</p>
                  <button onClick={() => navigate("/challenge")}
                    className="mt-1 px-5 py-2.5 rounded-2xl text-white font-bold text-[14px] active:scale-95 transition-transform"
                    style={{ background: "linear-gradient(135deg,#FF3355,#C8002B)" }}>
                    그룹 둘러보기
                  </button>
                </div>
              ) : isChallengeEnded ? (
              <div
                className="absolute inset-0 overflow-hidden cursor-pointer"
                onClick={() => {
                  if (selectedGroup) { if (selectedGroup) confirmEndedGroup(selectedGroup.id); }
                  navigate(`/challenge/group/${selectedGroupId}/result`);
                }}
              >
                <img
                  src={selectedGroup?.cover}
                  alt={selectedGroup?.title ?? ""}
                  className="absolute inset-0 w-full h-full object-cover"
                  draggable={false}
                />
                <div className="absolute inset-0" style={{
                  background: (selectedGroup?.crewRate ?? 0) >= 50
                    ? "linear-gradient(180deg,rgba(255,51,85,0.50) 0%,rgba(0,0,0,0.70) 60%,rgba(0,0,0,0.92) 100%)"
                    : "linear-gradient(180deg,rgba(30,30,40,0.60) 0%,rgba(0,0,0,0.75) 60%,rgba(0,0,0,0.92) 100%)",
                }} />

                {/* 배지 */}
                <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                  style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)" }}>
                  <span className="text-[11px] font-bold text-white/70">챌린지 종료</span>
                </div>

                {/* 중앙 달성률 */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <span className="text-[68px] leading-none">
                    {(selectedGroup?.crewRate ?? 0) >= 50 ? "🏆" : "💪"}
                  </span>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-white font-black text-[72px] leading-none tabular-nums italic"
                      style={{ textShadow: "0 4px 24px rgba(0,0,0,0.6)" }}>
                      {selectedGroup?.crewRate ?? 0}
                    </span>
                    <span className="text-white font-black text-[32px] italic opacity-80">%</span>
                  </div>
                  <p className="text-white font-black text-[20px]">
                    챌린지 {(selectedGroup?.crewRate ?? 0) >= 50 ? "달성 🎉" : "미달성 😢"}
                  </p>
                </div>

                {/* 하단 그룹명 + CTA */}
                <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
                  <h2 className="font-black text-[22px] text-white leading-tight mb-2">
                    {selectedGroup?.title ?? ""}
                  </h2>
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl w-fit"
                    style={{
                      background: (selectedGroup?.crewRate ?? 0) >= 50 ? "#FF3355" : "rgba(255,255,255,0.15)",
                      backdropFilter: "blur(8px)",
                    }}>
                    {(selectedGroup?.crewRate ?? 0) >= 50
                      ? <><Trophy className="w-4 h-4 text-white" /><span className="text-white font-bold text-[13px]">결과 보기</span></>
                      : <><ArrowRight className="w-4 h-4 text-white" /><span className="text-white font-bold text-[13px]">결과 보기</span></>
                    }
                  </div>
                </div>
              </div>

              ) : (<>

              {/* 배경: 그룹 대표 이미지 */}
              <div className="absolute inset-0 overflow-hidden bg-slate-900">
                <img
                  src={selectedGroup?.cover}
                  alt={selectedGroup?.title ?? ""}
                  className="absolute inset-0 w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  draggable={false}
                  style={{
                    transform: notifMode ? "scale(1.05)" : "scale(1)",
                    transition: "transform 0.6s cubic-bezier(0.4,0,0.2,1)",
                  }}
                />
                <div className="absolute inset-0"
                  style={{
                    background: notifMode
                      ? "linear-gradient(180deg,rgba(0,0,0,0.50) 0%,rgba(0,0,0,0.35) 40%,rgba(0,0,0,0.62) 100%)"
                      : "linear-gradient(180deg,rgba(0,0,0,0.28) 0%,rgba(0,0,0,0.42) 40%,rgba(0,0,0,0.70) 100%)",
                    transition: "background 0.5s ease",
                  }}
                />
              </div>

              {/* 알림 배지 — 우측 상단, 탭하면 notifMode 토글 */}
              <button
                className="absolute z-20 active:scale-90 transition-all duration-300"
                style={{
                  top: 14, right: 14,
                  opacity: notifMode ? 0 : 1,
                  transform: notifMode ? "scale(0.6)" : "scale(1)",
                  pointerEvents: notifMode ? "none" : "auto",
                }}
                onTouchStart={e => { e.stopPropagation(); ignoreTapRef.current = true; }}
                onTouchEnd={e => { e.stopPropagation(); }}
                onMouseDown={e => { e.stopPropagation(); ignoreTapRef.current = true; }}
                onMouseUp={e => e.stopPropagation()}
                onClick={() => setNotifMode(true)}
              >
                <div className="relative w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.25)" }}>
                  <BellRing className="w-5 h-5 text-white" />
                  <span
                    className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center text-white text-[11px] font-black tabular-nums"
                    style={{
                      background: "#FF3355",
                      boxShadow: "0 2px 8px rgba(255,51,85,0.5)",
                      animation: "badge-pulse 1.8s ease-in-out infinite",
                    }}
                  >
                    {unreadCount}
                  </span>
                </div>
              </button>

              {/* 퍼센트 — 기본: 카드 세로 중앙 / 알림 모드: 우측 상단으로 이동 */}
              <div
                className="absolute z-10 flex items-baseline pointer-events-none select-none"
                style={{
                  top: notifMode ? "4%" : "50%",
                  right: notifMode ? "5%" : "50%",
                  transform: notifMode ? "translateX(0)" : "translate(50%, -50%)",
                  transition: "top 0.55s cubic-bezier(0.4,0,0.2,1), right 0.55s cubic-bezier(0.4,0,0.2,1), transform 0.55s cubic-bezier(0.4,0,0.2,1)",
                }}
              >
                <span
                  ref={rateDisplayRef}
                  className="text-white font-black tabular-nums leading-none italic"
                  style={{
                    fontSize: notifMode ? "44px" : "92px",
                    letterSpacing: "-0.04em",
                    textShadow: "0 4px 24px rgba(0,0,0,0.55)",
                    transition: "font-size 0.55s cubic-bezier(0.4,0,0.2,1)",
                  }}
                >
                  {groupRate}
                </span>
                <span
                  className="text-white font-black leading-none ml-0.5 italic"
                  style={{
                    fontSize: notifMode ? "20px" : "36px",
                    opacity: 0.85,
                    transition: "font-size 0.55s cubic-bezier(0.4,0,0.2,1)",
                  }}
                >
                  %
                </span>
              </div>

              {/* 알림 리스트 (notifMode에서만 표시) */}
              {notifMode && (
                <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-center gap-2 px-4"
                  style={{ paddingTop: "18%", paddingBottom: "28%" }}>
                  {recentNotifs.length === 0 ? (
                    <div className="flex justify-center">
                      <span className="text-white/50 text-[13px] font-semibold">최근 알림이 없어요</span>
                    </div>
                  ) : recentNotifs.map((n, i) => (
                    <div
                      key={n.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-2xl"
                      style={{
                        background: "rgba(0,0,0,0.42)",
                        backdropFilter: "blur(8px)",
                        border: "1px solid rgba(255,255,255,0.10)",
                        animation: "notif-drop 0.2s ease-out forwards",
                        animationDelay: `${i * 0.04}s`,
                        opacity: 0,
                      }}
                    >
                      <span className="text-[15px] leading-none shrink-0">{n.emoji ?? "🔔"}</span>
                      <span className="text-white text-[12px] font-semibold leading-none flex-1">{n.body}</span>
                      <span className="text-white/40 text-[10px] font-medium shrink-0">{n.time}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 하단 텍스트 + 그룹 피커 */}
              <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 z-20"
                onTouchStart={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>

                {showGroupPicker && (
                  <div className="mb-3" style={{ animation: "picker-in 0.2s ease both" }}>
                    <div className="flex gap-2 pb-1 overflow-x-auto no-scrollbar">
                      {myGroups.map(g => {
                        const groupUnread = chatUnreadCountMap[g.id] ?? 0;
                        return (
                        <button key={g.id} onClick={() => selectGroup(g.id)}
                          className="relative shrink-0 flex flex-col items-start px-3 py-2.5 rounded-xl transition-all active:scale-95"
                          style={{
                            background: g.id === selectedGroupId ? "rgba(255,51,85,0.9)" : "rgba(255,255,255,0.15)",
                            backdropFilter: "blur(8px)",
                            border: g.id === selectedGroupId ? "1px solid rgba(255,51,85,0.5)" : "1px solid rgba(255,255,255,0.2)",
                            minWidth: 130,
                          }}>
                          <p className="text-white font-black text-[13px] leading-tight truncate w-full">{g.title}</p>
                          <p className="text-white/60 text-[10px] mt-0.5">{g.members}명 참여 중</p>
                          {groupUnread > 0 && (
                            <div className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center"
                              style={{ background: "#FF3355", boxShadow: "0 2px 6px rgba(255,51,85,0.55)" }}>
                              <span className="text-[10px] font-black text-white leading-none px-1">
                                {groupUnread > 99 ? "99+" : groupUnread}
                              </span>
                            </div>
                          )}
                        </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-1.5">
                  <button onClick={() => setShowGroupPicker(v => !v)}
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 active:scale-90 transition-all"
                    style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(4px)" }}>
                    <ChevronRight className="w-4 h-4 text-white transition-transform duration-200"
                      style={{ transform: showGroupPicker ? "rotate(90deg)" : "rotate(0deg)" }} />
                  </button>
                  <h2 className="font-black text-[22px] text-white leading-tight tracking-tight">
                    {showGroupPicker ? "그룹 선택" : (selectedGroup?.title ?? "그룹 없음")}
                  </h2>
                </div>

                <div className="pl-9 h-5 flex items-center">
                  {showGroupPicker ? (
                    <p className="text-white/50 text-[12px] font-medium">참여 중인 그룹을 선택하세요</p>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="shrink-0 text-[10px] font-bold text-white/70 bg-white/15 px-2 py-0.5 rounded-full">그룹 평균</span>
                      <p className="text-white/70 text-[12px] font-semibold truncate">{selectedGroup?.goal ?? ""}</p>
                      <span className="shrink-0 text-white/40 text-[12px]">· {selectedGroup?.members ?? 0}명</span>
                    </div>
                  )}
                </div>
              </div>
              </>)}
            </div>

            {/* ─── 슬라이드 2: 그룹 내 순위 ─── */}
            <div className="absolute inset-0 overflow-hidden flex flex-col bg-white"
              style={{ transform: slideTx(1), transition: trans, willChange: "transform" }}>

              {myGroups.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2">
                  <span className="text-4xl">🏆</span>
                  <p className="text-slate-700 font-black text-[15px]">순위 정보가 없어요</p>
                  <p className="text-slate-400 text-[12px]">그룹에 참여하면 순위를 확인할 수 있어요</p>
                </div>
              ) : (<>

              {/* 헤더 */}
              <div className="px-4 pt-4 pb-2 shrink-0">
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">그룹 내 순위</p>
                <p className="text-slate-900 font-black text-[16px] leading-tight truncate">{selectedGroup?.title ?? ""}</p>
              </div>

              {rankers.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 px-6 text-center">
                  <span className="text-4xl">🏆</span>
                  <p className="text-slate-700 font-black text-[15px]">아직 순위가 없어요</p>
                  <p className="text-slate-400 text-[12px]">그룹 멤버가 인증하면 순위가 표시돼요</p>
                </div>
              ) : (<>
              {/* 포디엄 top 3 — 2위·1위·3위 순 */}
              {(() => {
                const top3 = rankers.slice(0, 3);
                const rest = rankers.slice(3);
                const podium = [
                  top3.find(r => r.rank === 2),
                  top3.find(r => r.rank === 1),
                  top3.find(r => r.rank === 3),
                ].filter(Boolean) as typeof rankers;
                return (
                  <>
                    <div className="px-3 shrink-0 flex gap-2 items-end">
                      {podium.map(({ rank, name, seed, avatarUrl, streak, rate, isMe }, i) => {
                        const is1st = rank === 1;
                        return (
                          <div key={rank}
                            className="flex-1 flex flex-col items-center rounded-2xl py-3 active:opacity-70 transition-opacity cursor-pointer"
                            style={{
                              height: is1st ? 148 : 122,
                              background: isMe ? "linear-gradient(160deg,rgba(255,51,85,0.08),white)" : "#F8F8FA",
                              border: isMe ? "1.5px solid rgba(255,51,85,0.22)" : "1px solid rgba(0,0,0,0.06)",
                            }}
                            onClick={() => !isMe && navigate(`/user/${seed}`)}>
                            <span className="text-[18px] mb-1.5 leading-none">{MEDAL[rank - 1]}</span>
                            <div className="relative mb-1.5">
                              <img src={avatarUrl ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`} alt={name}
                                className="rounded-full bg-slate-100 border-2 object-cover"
                                style={{ width: is1st ? 44 : 36, height: is1st ? 44 : 36, borderColor: isMe ? "#FF3355" : "transparent" }}
                                draggable={false} />
                              {is1st && <Crown className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                            </div>
                            <p className={`text-[10px] font-black truncate w-full text-center px-1 mb-0.5 ${isMe ? "text-[#FF3355]" : "text-slate-700"}`}>{name}</p>
                            <span className="text-[12px] font-black tabular-nums" style={{ color: rateColor(rate) }}>{rate}%</span>
                            <div className="flex items-center gap-0.5 mt-0.5">
                              <Flame className="w-2.5 h-2.5 text-orange-400 fill-orange-300" />
                              <span className="text-[9px] text-slate-400">{streak}일</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 4위~ 리스트 */}
                    {rest.length > 0 && (
                      <div className="flex-1 overflow-y-auto overscroll-contain mx-3 mt-2 mb-3 rounded-2xl bg-[#F8F8FA] border border-black/[0.05]">
                        {rest.map(({ rank, name, seed, avatarUrl, streak, rate, isMe }, i) => (
                          <div key={rank}>
                            {i > 0 && <div className="h-px bg-slate-100 mx-3" />}
                            <div className={`flex items-center gap-2.5 px-3 py-2.5 active:opacity-70 transition-opacity cursor-pointer ${isMe ? "bg-[#FFF5F7]" : ""}`}
                              onClick={() => !isMe && navigate(`/user/${seed}`)}>
                              <span className="w-5 text-center text-[12px] font-black tabular-nums shrink-0"
                                style={{ color: isMe ? "#FF3355" : "rgba(160,160,160,0.7)" }}>{rank}</span>
                              <img src={avatarUrl ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`} alt={name}
                                className="w-7 h-7 rounded-full bg-slate-100 shrink-0 object-cover" draggable={false} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                  <p className={`text-[12px] font-bold truncate ${isMe ? "text-[#FF3355]" : "text-slate-700"}`}>{name}</p>
                                  {isMe && <span className="text-[8px] font-black text-white bg-[#FF3355] px-1 py-0.5 rounded-full shrink-0">나</span>}
                                </div>
                                <div className="flex items-center gap-0.5">
                                  <Flame className="w-2.5 h-2.5 text-orange-400 fill-orange-300" />
                                  <span className="text-[10px] text-slate-400">{streak}일</span>
                                </div>
                              </div>
                              <span className="text-[12px] font-black tabular-nums shrink-0" style={{ color: rateColor(rate) }}>{rate}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
              </>)}
              </>)}
            </div>

            {/* ─── 슬라이드 3: 그룹 채팅 ─── */}
            <div className="absolute inset-0 overflow-hidden flex flex-col bg-white"
              style={{ transform: slideTx(2), transition: trans, willChange: "transform" }}>

              {myGroups.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2">
                  <span className="text-4xl">💬</span>
                  <p className="text-slate-700 font-black text-[15px]">채팅이 없어요</p>
                  <p className="text-slate-400 text-[12px]">그룹에 참여하면 채팅할 수 있어요</p>
                </div>
              ) : (<>

              <div className="px-5 pt-6 pb-3 shrink-0"
                style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mb-1">그룹 채팅</p>
                <div className="flex items-center justify-between">
                  <p className="text-slate-900 font-black text-[19px]">{selectedGroup?.title ?? ""}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-slate-400 text-[11px]">{selectedGroup?.members ?? 0}명 참여</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 relative overflow-hidden">
              <div ref={chatScrollRef}
                className="h-full overflow-y-auto overscroll-contain px-4 py-3 space-y-3 bg-slate-50"
                onScroll={e => {
                  setEmojiPickerFor(null);
                  const el = e.currentTarget;
                  setChatAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
                }}
                onClick={() => emojiPickerFor && setEmojiPickerFor(null)}>
                {chats.length === 0 && (
                  <div className="h-full min-h-[220px] flex flex-col items-center justify-center gap-2 text-center">
                    <span className="text-4xl">💬</span>
                    <p className="text-slate-700 font-black text-[15px]">아직 메시지가 없어요</p>
                    <p className="text-slate-400 text-[12px]">첫 메시지를 남겨 그룹 대화를 시작해보세요</p>
                  </div>
                )}
                {chats.map((msg, idx) => {
                  const isReadMarker = lastReadMsgId && idx > 0 && chats[idx - 1].id === lastReadMsgId && !msg.isMe;
                    const isPickerOpen = emojiPickerFor === msg.id;
                    return (
                      <React.Fragment key={msg.id}>
                        {isReadMarker && (
                          <div className="flex items-center gap-2 my-1">
                            <div className="flex-1 h-px bg-slate-200" />
                            <span className="text-[10px] text-slate-400 shrink-0 px-1">여기까지 보셨습니다</span>
                            <div className="flex-1 h-px bg-slate-200" />
                          </div>
                        )}
                        {msg.type === "achievement" ? (
                          <div className="flex justify-center my-1">
                            <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
                              style={{ background: "linear-gradient(135deg,rgba(251,191,36,0.12),rgba(249,115,22,0.12))", border: "1px solid rgba(251,191,36,0.3)" }}>
                              <Flame className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" />
                              <span className="text-amber-700 text-[11px] font-bold">{msg.achieverName} · {msg.streak}일 연속 달성! 🎉</span>
                            </div>
                          </div>
                        ) : (
                          <div className={`flex gap-2 items-end ${msg.isMe ? "flex-row-reverse" : "flex-row"}`}>
                            {!msg.isMe && (
                              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.seed}`} alt={msg.sender}
                                className="w-7 h-7 rounded-full bg-slate-200 shrink-0 mb-5 cursor-pointer active:opacity-70 transition-opacity" draggable={false}
                                onClick={() => navigate(`/user/${msg.dbMessage?.user_id ?? msg.seed}`)} />
                            )}
                            <div className={`flex flex-col gap-0.5 max-w-[68%] ${msg.isMe ? "items-end" : "items-start"}`}>
                              {!msg.isMe && (
                                <span className="text-slate-400 text-[10px] font-semibold px-1 cursor-pointer active:text-slate-600 transition-colors"
                                  onClick={() => navigate(`/user/${msg.dbMessage?.user_id ?? msg.seed}`)}>
                                  {msg.sender}
                                </span>
                              )}
                              <div className={`flex items-center gap-1.5 ${msg.isMe ? "flex-row-reverse" : "flex-row"} relative`}>
                                <div className="px-3 py-2 text-[13px] leading-snug select-none"
                                  style={{ background: msg.isMe ? "#FF3355" : "white",
                                    color: msg.isMe ? "white" : "#1e293b",
                                    borderRadius: msg.isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                                    boxShadow: msg.isMe ? "none" : "0 1px 4px rgba(0,0,0,0.07)" }}
                                  onTouchStart={() => startLongPress(msg.id)}
                                  onTouchEnd={cancelLongPress}
                                  onTouchMove={cancelLongPress}>
                                  {msg.text}
                                </div>
                                {!msg.isMe && <button
                                  className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                                  style={{ background: isPickerOpen ? "rgba(255,51,85,0.12)" : "rgba(0,0,0,0.06)" }}
                                  onTouchStart={e => e.stopPropagation()}
                                  onMouseDown={e => e.stopPropagation()}
                                  onClick={e => { e.stopPropagation(); setEmojiPickerFor(isPickerOpen ? null : msg.id); }}>
                                  <SmilePlus className="w-3.5 h-3.5" style={{ color: isPickerOpen ? "#FF3355" : "#94a3b8" }} />
                                </button>}
                              </div>
                              {isPickerOpen && (
                                <div
                                  className={`absolute ${msg.isMe ? "right-0" : "left-0"} bottom-full mb-1 z-50`}
                                  onTouchStart={e => e.stopPropagation()}
                                  onClick={e => e.stopPropagation()}
                                >
                                  <div className="flex gap-1 bg-white rounded-2xl px-2 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.18)] border border-slate-100"
                                    style={{ animation: "picker-in 0.15s ease both" }}>
                                    {EMOJI_REACTIONS.map(emoji => (
                                      <button key={emoji}
                                        className="w-8 h-8 flex items-center justify-center text-[17px] rounded-xl active:bg-slate-100 transition-colors"
                                        onClick={() => addReaction(msg.id, emoji)}>
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {reactions[msg.id] && (
                                <button
                                  className="mt-0.5 px-2 py-0.5 rounded-full text-[14px] active:scale-90 transition-transform"
                                  style={{ background: "white", border: "1.5px solid rgba(255,51,85,0.25)", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}
                                  onTouchStart={e => e.stopPropagation()}
                                  onClick={e => { e.stopPropagation(); addReaction(msg.id, reactions[msg.id]); }}>
                                  {reactions[msg.id]}
                                </button>
                              )}
                              <span className="text-slate-400 text-[10px] px-1">{msg.time}</span>
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                <div ref={chatEndRef} />
              </div>

              {/* 스크롤 아래로 버튼 — 입력창 바로 위 */}
              {!chatAtBottom && (
                <button
                  className="absolute left-1/2 -translate-x-1/2 bottom-3 w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-transform z-20"
                  style={{ background: "rgba(0,0,0,0.12)", backdropFilter: "blur(4px)" }}
                  onTouchStart={e => e.stopPropagation()}
                  onClick={() => {
                    const el = chatScrollRef.current;
                    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
                  }}
                >
                  <ArrowRight className="w-3 h-3 text-slate-500 rotate-90" />
                </button>
              )}
              </div>{/* relative wrapper 닫기 */}

              {chatSendError && (
                <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-2xl text-white text-[13px] font-semibold pointer-events-none whitespace-nowrap"
                  style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", animation: "picker-in 0.2s ease both" }}>
                  메시지 전송에 실패했어요
                </div>
              )}
              <div className="shrink-0 px-3 py-3 flex items-center gap-2 bg-white"
                style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                <input type="text" value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendChat()}
                  onTouchStart={e => e.stopPropagation()}
                  onFocus={() => {
                    setTimeout(() => {
                      const el = chatScrollRef.current;
                      if (el) el.scrollTop = el.scrollHeight;
                    }, 300);
                  }}
                  placeholder="메시지 입력..."
                  className="flex-1 h-9 px-3.5 rounded-full text-[13px] text-slate-700 placeholder-slate-300 focus:outline-none"
                  style={{ background: "#F4F4F6", border: "1px solid rgba(0,0,0,0.08)", color: "#1e293b" }} />
                <button onClick={sendChat} onTouchStart={e => e.stopPropagation()}
                  className="w-9 h-9 rounded-full bg-[#FF3355] flex items-center justify-center shrink-0 active:scale-90 transition-transform"
                  style={{ boxShadow: "0 4px 12px rgba(255,51,85,0.3)" }}>
                  <Send className="w-4 h-4 text-white" />
                </button>
              </div>
              </>)}
            </div>

          </div>{/* 카드 끝 */}

          {/* 점 인디케이터 */}
          <div className="flex justify-center gap-2 pt-3 pb-1">
            {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
              <button key={i} onClick={() => setSlideIdx(i)}
                style={{
                  height: 6, borderRadius: 999, border: "none", cursor: "pointer", padding: 0,
                  width: i === slideIdx ? 18 : 6,
                  background: i === slideIdx ? "#FF3355" : "rgba(128,128,128,0.35)",
                  transition: "width 0.35s cubic-bezier(0.4,0,0.2,1), background-color 0.35s ease",
                }} />
            ))}
          </div>

        </div>{/* px-4 끝 */}

        {/* 인증하기 / 확인하기 버튼 */}
        <div className="px-4 pb-3 pt-2 shrink-0">
          {isChallengeRecruit ? (
            <div
              className="relative w-full h-[68px] rounded-[20px] flex items-center px-5 gap-4 overflow-hidden"
              style={{ background: "linear-gradient(115deg,#3B82F6,#6366F1)", boxShadow: "0 8px 24px rgba(99,102,241,0.22)" }}>
              <div className="shrink-0 w-10 h-10 rounded-[14px] flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)", border: "1px solid rgba(255,255,255,0.2)" }}>
                <span className="text-[18px] leading-none">⏳</span>
              </div>
              <div className="flex flex-col gap-0.5 flex-1">
                <span className="text-white font-black text-[16px] leading-none tracking-tight">챌린지 시작을 기다리는 중이에요</span>
                <span className="text-white/55 text-[12px] font-medium leading-none truncate">
                  {selectedGroup?.title} · 모집중
                </span>
              </div>
            </div>
          ) : isChallengeEnded ? (
            <button
              onClick={() => {
                if (selectedGroup) { if (selectedGroup) confirmEndedGroup(selectedGroup.id); }
                navigate(`/challenge/group/${selectedGroupId}/result`);
              }}
              className="relative w-full h-[68px] rounded-[20px] flex items-center px-5 gap-4 text-white active:scale-[0.97] transition-all duration-200 overflow-hidden"
              style={{ background: "linear-gradient(115deg,#64748B,#475569)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
              <div className="shrink-0 w-10 h-10 rounded-[14px] flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)", border: "1px solid rgba(255,255,255,0.2)" }}>
                <span className="text-[18px] leading-none">🏁</span>
              </div>
              <div className="flex flex-col gap-0.5 flex-1">
                <span className="font-black text-[16px] leading-none tracking-tight">확인하기</span>
                <span className="text-white/55 text-[12px] font-medium leading-none truncate">
                  {selectedGroup?.title} · 챌린지 종료
                </span>
              </div>
              <ChevronRight className="w-5 h-5 text-white/40 shrink-0" strokeWidth={2.5} />
            </button>
          ) : (
            <button
              onClick={() => guardAction(() => {
                if (selectedGroup) {
                  const vType = selectedGroup.verifyType as VerifyTypeKey;
                  beginVerification({ verifyType: vType, groupId: selectedGroup.dbId ?? null });
                  navigate(`/verify/guide/${vType}`);
                } else {
                  navigate("/challenge");
                }
              })}
              className="relative w-full h-[68px] rounded-[20px] flex items-center px-5 gap-4 text-white active:scale-[0.97] transition-all duration-200 overflow-hidden"
              style={{
                background: isExitEligible
                  ? "linear-gradient(115deg, #FF8A40 0%, #FF5020 50%, #C8002B 100%)"
                  : "linear-gradient(115deg, #FF5C7A 0%, #FF3355 45%, #C8002B 100%)",
                boxShadow: isExitEligible
                  ? undefined
                  : "0 8px 24px rgba(255,51,85,0.22), 0 1px 0 rgba(255,255,255,0.12) inset",
                animation: isExitEligible
                  ? "ee-button-glow 1.4s ease-in-out infinite"
                  : btnFlash ? "btn-flash 0.6s cubic-bezier(0.4,0,0.2,1) both" : undefined,
              }}>
              <div className="shrink-0 w-10 h-10 rounded-[14px] flex items-center justify-center relative"
                style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)", border: "1px solid rgba(255,255,255,0.2)" }}>
                {isExitEligible ? (
                  <span className="text-[20px] leading-none"
                    style={{ animation: "ee-flame-rise 1.0s ease-in-out infinite", display: "inline-block" }}>🔥</span>
                ) : (
                  <Camera className="w-5 h-5 text-white" strokeWidth={2} />
                )}
              </div>
              <div className="flex flex-col gap-0.5 flex-1">
                <span className="font-black text-[16px] leading-none tracking-tight">
                  {isExitEligible ? "지금 인증하기!" : "오늘 인증하기"}
                </span>
                <span className="text-white/85 text-[12px] font-medium leading-none truncate">
                  {isExitEligible
                    ? "48시간 안에 인증하지 않으면 퇴장돼요"
                    : selectedGroup
                      ? `${VERIFY_TYPES[(selectedGroup.verifyType as VerifyTypeKey) ?? "step_walk"]?.emoji} ${selectedGroup.goal}`
                      : "챌린지에 참여하고 인증해보세요"}
                </span>
              </div>
              <ChevronRight className="w-5 h-5 text-white/60 shrink-0" strokeWidth={2.5} />
            </button>
          )}
        </div>

        {/* ── 실시간 인증 피드 ── */}
        <div className="mx-4 mt-8 border-t border-slate-200" />
        <div className="px-4 pb-6 pt-1 mt-8">

          {/* 헤더 */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#FF3355,#CC0030)" }}>
                <Zap className="w-3.5 h-3.5 text-white fill-white" />
              </div>
              <h3 className="text-[17px] font-black text-slate-900">실시간 인증 피드</h3>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            {recentFeed.length > 0 && (
              <button
                onClick={() => navigate("/feed")}
                className="flex items-center gap-1 text-[12px] font-bold text-[#FF3355] active:text-[#CC0030] transition-colors"
              >
                전체보기
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 2열 × 10행 정사각형 세로 그리드 */}
          {recentFeed.length === 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 20 }, (_, i) => (
                <div key={i} className="aspect-square rounded-2xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 20 }, (_, idx) => {
                const item = recentFeed[idx];
                return item ? (
                  <FeedCard
                    key={item.id}
                    item={item}
                    onTap={() => navigate(".", { state: { feedViewer: idx }, replace: feedViewerOpen })}
                  />
                ) : (
                  <div key={`empty-${idx}`} className="aspect-square rounded-2xl bg-slate-100" />
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* ── 피드 뷰어 오버레이 ── */}
      {feedViewerOpen && (
        <FeedViewer
          items={recentFeed}
          startIdx={feedViewerIdx}
          userId={user?.id ?? null}
          onClose={() => navigate(-1)}
        />
      )}

    </div>
  );
}

function FeedCard({ item, onTap }: { item: FeedItem; onTap: () => void; key?: React.Key }) {
  return (
    <div
      className="aspect-square rounded-2xl overflow-hidden shadow-sm active:scale-[0.97] transition-transform cursor-pointer border border-black/[0.04] relative"
      onClick={onTap}
    >
      {item.img ? (
        <img
          src={item.img}
          alt={item.caption}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-[#FF3355] to-[#FF6680]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
      <div className="absolute top-1.5 right-1.5 bg-black/30 backdrop-blur-sm px-1 py-0.5 rounded-full">
        <span className="text-[9px]">{item.verifyEmoji}</span>
      </div>
      <div className="absolute bottom-0 left-0 right-0 px-2 pb-2">
        <img
          src={item.avatarUrl ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.seed}`}
          alt={item.user}
          className="w-4 h-4 rounded-full bg-white/20 object-cover mb-0.5"
        />
        <p className="text-white text-[9px] font-black truncate leading-none">{item.user}</p>
      </div>
    </div>
  );
}

const FEED_REACTIONS: ActivityEmoji[] = ["❤️", "🔥", "👍", "😂", "😮", "🎉"];

function FeedViewer({
  items,
  startIdx,
  userId,
  onClose,
}: {
  items: FeedItem[];
  startIdx: number;
  userId: string | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemRefs  = useRef<(HTMLDivElement | null)[]>([]);
  const [reactionsMap, setReactionsMap] = useState<Record<string, { emoji: ActivityEmoji | null; count: number }>>(() => {
    const map: Record<string, { emoji: ActivityEmoji | null; count: number }> = {};
    items.forEach(item => {
      const id = item.postId ?? item.id;
      const cached = reactionCache.get(id);
      map[id] = {
        emoji: (cached?.myReaction as ActivityEmoji | null) ?? (item.myReaction as ActivityEmoji | null) ?? null,
        count: cached?.count ?? item.reactionCount ?? 0,
      };
    });
    return map;
  });
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  useLayoutEffect(() => {
    const target = itemRefs.current[startIdx];
    if (target) target.scrollIntoView({ block: "start" });
  }, []);

  async function handleReact(postId: string, emoji: ActivityEmoji) {
    if (!userId) { navigate("/login"); return; }
    const prev = reactionsMap[postId] ?? { emoji: null, count: 0 };
    const isSame = prev.emoji === emoji;
    const nextEmoji = isSame ? null : emoji;
    const nextCount = isSame ? Math.max(0, prev.count - 1) : (prev.emoji ? prev.count : prev.count + 1);
    setReactionsMap(m => ({ ...m, [postId]: { emoji: nextEmoji, count: nextCount } }));
    reactionCache.set(postId, { count: nextCount, myReaction: nextEmoji });
    setPickerFor(null);

    const mutation = nextEmoji
      ? supabase.from("activity_reactions").upsert({ activity_post_id: postId, user_id: userId, emoji: nextEmoji })
      : supabase.from("activity_reactions").delete().eq("activity_post_id", postId).eq("user_id", userId);
    const { error } = await mutation;
    if (error) {
      setReactionsMap(m => ({ ...m, [postId]: prev }));
      reactionCache.set(postId, { count: prev.count, myReaction: prev.emoji });
    }
  }

  return (
    <div
      className="fixed inset-0 bg-white dark:bg-black"
      style={{ zIndex: 200, animation: "fv-in 0.2s ease both" }}
      onClick={() => pickerFor && setPickerFor(null)}
    >
      <style>{`
        @keyframes fv-in { from{opacity:0} to{opacity:1} }
        @keyframes fv-picker { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* 뒤로가기 버튼 (고정, 항상 표시) */}
      <button
        onClick={onClose}
        className="fixed top-4 left-4 w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-transform bg-black/10 dark:bg-black/50 border border-black/10 dark:border-white/15"
        style={{ zIndex: 210, backdropFilter: "blur(8px)" }}
      >
        <ChevronLeft className="w-5 h-5 text-slate-800 dark:text-white" />
      </button>

      {/* 세로 자유 스크롤 피드 */}
      <div ref={scrollRef} className="h-full overflow-y-scroll no-scrollbar" style={{ scrollBehavior: "auto" }}>
        {items.map((item, idx) => {
          const postId = item.postId ?? item.id;
          const rxState = reactionsMap[postId] ?? { emoji: null, count: 0 };
          const isPickerOpen = pickerFor === postId;
          return (
            <div
              key={item.id}
              ref={el => { itemRefs.current[idx] = el; }}
              className="w-full flex flex-col"
            >
              {/* ── 상단: 유저 정보 (고정 높이) ── */}
              <div
                className="shrink-0 flex items-center gap-3 px-5 bg-white dark:bg-[#0d0d0d] border-b border-black/[0.06] dark:border-white/[0.06]"
                style={{ height: 64 }}
              >
                <button
                  className="flex items-center gap-3 active:opacity-70 transition-opacity"
                  onClick={() => navigate(`/user/${item.seed}`)}
                >
                  <img
                    src={item.avatarUrl ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.seed}`}
                    alt={item.user}
                    className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/10 object-cover shrink-0 border border-black/10 dark:border-white/15"
                    draggable={false}
                  />
                  <div className="text-left">
                    <p className="text-slate-900 dark:text-white font-black text-[14px] leading-tight">{item.user}</p>
                    <p className="text-slate-400 dark:text-white/40 text-[11px] leading-none mt-0.5">{item.time}</p>
                  </div>
                </button>
              </div>

              {/* ── 중앙: 사진 — 원본 비율, 최대 화면폭 × 최대 높이 제한 ── */}
              <div className="w-full flex items-center justify-center bg-slate-100 dark:bg-black">
                {item.img ? (
                  <img
                    src={item.img}
                    alt={item.caption}
                    style={{
                      display: "block",
                      width: "100%",
                      height: "auto",
                      maxHeight: "80dvh",
                      objectFit: "contain",
                    }}
                    referrerPolicy="no-referrer"
                    draggable={false}
                  />
                ) : (
                  <div style={{ width: "100%", aspectRatio: "1", background: "linear-gradient(135deg,#FF3355,#FF6680)" }} />
                )}
              </div>

              {/* ── 하단: 이모지 반응 (고정 높이) ── */}
              <div
                className="shrink-0 flex items-center justify-center relative bg-white dark:bg-[#0d0d0d] border-t border-black/[0.06] dark:border-white/[0.06]"
                style={{ height: 64 }}
                onClick={e => e.stopPropagation()}
              >
                {isPickerOpen && (
                  <div
                    className="absolute bottom-full mb-1 flex gap-1 rounded-2xl px-2 py-1.5 bg-slate-100 dark:bg-[#1e1e1e] border border-black/10 dark:border-white/10"
                    style={{ animation: "fv-picker 0.15s ease both" }}
                  >
                    {FEED_REACTIONS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => void handleReact(postId, emoji)}
                        className={`w-10 h-10 flex items-center justify-center text-[22px] rounded-xl active:scale-90 transition-transform ${rxState.emoji === emoji ? "bg-black/[0.08] dark:bg-white/[0.12]" : ""}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setPickerFor(isPickerOpen ? null : postId)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full active:scale-95 transition-all border ${rxState.emoji ? "border-[#FF3355]/40 bg-[#FF3355]/[0.15]" : "border-black/10 dark:border-white/12 bg-black/[0.06] dark:bg-white/[0.07]"}`}
                >
                  <span className="text-[20px] leading-none">{rxState.emoji ?? "👍"}</span>
                  <span className="text-slate-800 dark:text-white font-black text-[14px] tabular-nums">{rxState.count}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
