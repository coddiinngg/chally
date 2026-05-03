import React, { useState, useEffect, useRef } from "react";
import { Bell, BellRing, Camera, Flame, Send, Crown, ChevronRight, Zap, Lightbulb, SmilePlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../contexts/AppContext";
import { VERIFY_TYPES, type VerifyTypeKey } from "../lib/verifyTypes";
import { useGuestGuard } from "../contexts/GuestGuardContext";

const MEDAL = ["🥇", "🥈", "🥉"];
const rateColor = (r: number) => r >= 80 ? "#10B981" : r >= 50 ? "#F59E0B" : "#FF3355";


const GROUP_RANKERS: Record<string, { rank: number; name: string; streak: number; rate: number; seed: string; isMe: boolean }[]> = {
  "1": [
    { rank: 1, name: "sm", streak: 12, rate: 92, seed: "sm",     isMe: false },
    { rank: 2, name: "ms", streak:  8, rate: 84, seed: "ms",     isMe: false },
    { rank: 3, name: "나", streak:  5, rate: 75, seed: "MyUser", isMe: true  },
  ],
  "2": [
    { rank: 1, name: "sm", streak: 15, rate: 96, seed: "sm",     isMe: false },
    { rank: 2, name: "나", streak:  3, rate: 50, seed: "MyUser", isMe: true  },
    { rank: 3, name: "ms", streak:  1, rate: 40, seed: "ms",     isMe: false },
  ],
  "3": [
    { rank: 1, name: "ms", streak: 10, rate: 90, seed: "ms",     isMe: false },
    { rank: 2, name: "나", streak:  7, rate: 75, seed: "MyUser", isMe: true  },
    { rank: 3, name: "sm", streak:  4, rate: 60, seed: "sm",     isMe: false },
  ],
  "4": [
    { rank: 1, name: "sm", streak:  8, rate: 88, seed: "sm",     isMe: false },
    { rank: 2, name: "나", streak:  4, rate: 60, seed: "MyUser", isMe: true  },
    { rank: 3, name: "ms", streak:  2, rate: 45, seed: "ms",     isMe: false },
  ],
  "5": [
    { rank: 1, name: "ms", streak: 18, rate: 97, seed: "ms",     isMe: false },
    { rank: 2, name: "sm", streak: 10, rate: 85, seed: "sm",     isMe: false },
    { rank: 3, name: "나", streak:  1, rate: 40, seed: "MyUser", isMe: true  },
  ],
  "6": [
    { rank: 1, name: "sm", streak:  9, rate: 88, seed: "sm",     isMe: false },
    { rank: 2, name: "나", streak:  6, rate: 55, seed: "MyUser", isMe: true  },
    { rank: 3, name: "ms", streak:  3, rate: 42, seed: "ms",     isMe: false },
  ],
};

interface ChatMsg {
  id: string; sender: string; text: string;
  seed: string; time: string; isMe?: boolean;
  type?: "achievement";
  achieverName?: string;
  streak?: number;
}

const EMOJI_REACTIONS = ["❤️", "😂", "🔥", "👍", "😮", "🎉"];

const GROUP_CHATS: Record<string, ChatMsg[]> = {
  "1": [
    { id: "1",  sender: "sm",     text: "오늘 아침 산책 인증 완료! 👟",        seed: "sm",     time: "07:32" },
    { id: "1a", sender: "system", text: "", seed: "", time: "07:40", type: "achievement", achieverName: "sm", streak: 12 },
    { id: "2",  sender: "ms",     text: "저도 오늘 8,000보 넘겼어요 😄",        seed: "ms",     time: "08:10" },
    { id: "3",  sender: "나",     text: "오늘도 같이 열심히 걸어봐요!",          seed: "MyUser", time: "09:00", isMe: true },
  ],
  "2": [
    { id: "1",  sender: "sm",     text: "새벽 5km 완주! 풍경 진짜 예뻤어요 🌅", seed: "sm",     time: "06:20" },
    { id: "1a", sender: "system", text: "", seed: "", time: "06:30", type: "achievement", achieverName: "sm", streak: 15 },
    { id: "2",  sender: "나",     text: "멋진 풍경이네요! 저도 따라갈게요",       seed: "MyUser", time: "08:00", isMe: true },
    { id: "3",  sender: "ms",     text: "오늘 같이 달릴 분? 저녁 7시요!",        seed: "ms",     time: "09:30" },
  ],
  "3": [
    { id: "1",  sender: "ms",     text: "오늘 책 표지 인증 완료 📚 추천 너무 좋아요!", seed: "ms",     time: "08:15" },
    { id: "2",  sender: "나",     text: "좋은 책 추천해주세요~ 다 읽었어요 😊",        seed: "MyUser", time: "10:00", isMe: true },
    { id: "3",  sender: "sm",     text: "저는 이번 주 목표 달성 🎉",                   seed: "sm",     time: "10:42" },
  ],
  "4": [
    { id: "1",  sender: "sm",     text: "오늘 필사한 문장 올렸어요 ✍️",         seed: "sm",     time: "09:00" },
    { id: "2",  sender: "나",     text: "저도 오늘 인상 깊은 문장 찾았어요!",    seed: "MyUser", time: "10:10", isMe: true },
    { id: "3",  sender: "ms",     text: "같이 꾸준히 해봐요 화이팅 💪",         seed: "ms",     time: "11:00" },
  ],
  "5": [
    { id: "1",  sender: "ms",     text: "오늘 포즈 도전했어요 ㅎㅎ 쑥스럽지만 재밌어요 📸", seed: "ms",     time: "10:05" },
    { id: "2",  sender: "sm",     text: "진짜 웃겨요 ㅋㅋㅋ 저도 곧 올릴게요",               seed: "sm",     time: "10:30" },
    { id: "3",  sender: "나",     text: "같이 도전! 오늘 포즈 재밌었어요 😄",                seed: "MyUser", time: "11:20", isMe: true },
  ],
  "6": [
    { id: "1",  sender: "sm",     text: "오늘 북촌 한옥마을 다녀왔어요 📍 강추!", seed: "sm",     time: "13:00" },
    { id: "2",  sender: "나",     text: "저도 오늘 카페거리 인증했어요~",          seed: "MyUser", time: "14:00", isMe: true },
    { id: "3",  sender: "ms",     text: "다음에 같이 탐험 가요!! 🗺️",            seed: "ms",     time: "14:20" },
  ],
};

const SLIDE_COUNT = 3;

// 컴포넌트 외부 — 리마운트 시에도 유지되어 중복 애니메이션 방지
let lastAnimatedGroupId: string | null = null;

interface FeedItem {
  id: string;
  user: string;
  seed: string;
  time: string;
  caption: string;
  groupTitle: string;
  verifyEmoji: string;
  img: string;
  aspect: "tall" | "square";
}

const FEED_ITEMS: FeedItem[] = [
  {
    id: "1", user: "sm", seed: "sm", time: "방금 전",
    caption: "오늘도 8,200보 달성! 연속 12일째 🔥",
    groupTitle: "매일 5,000보 걷기", verifyEmoji: "👟", aspect: "tall",
    img: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=400&fit=crop",
  },
  {
    id: "2", user: "ms", seed: "ms", time: "5분 전",
    caption: "이번 주 독서 인증 완료 📚",
    groupTitle: "일일 독서 클럽", verifyEmoji: "📚", aspect: "square",
    img: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&fit=crop",
  },
  {
    id: "3", user: "sm", seed: "sm", time: "11분 전",
    caption: "새벽 한강 러닝 완주! 오늘 풍경 미쳤다 🌅",
    groupTitle: "러닝 크루", verifyEmoji: "🏃", aspect: "square",
    img: "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=400&fit=crop",
  },
  {
    id: "4", user: "ms", seed: "ms", time: "19분 전",
    caption: "'작은 습관이 큰 변화를 만든다' 오늘의 문장 ✍️",
    groupTitle: "필사 챌린지", verifyEmoji: "✍️", aspect: "tall",
    img: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400&fit=crop",
  },
  {
    id: "5", user: "sm", seed: "sm", time: "25분 전",
    caption: "오늘의 포즈 도전 완료 ㅎㅎ 쑥스럽지만 재밌어요 📸",
    groupTitle: "포즈 챌린지", verifyEmoji: "📸", aspect: "square",
    img: "https://images.unsplash.com/photo-1552196563-55cd4e45efb3?w=400&fit=crop",
  },
  {
    id: "6", user: "ms", seed: "ms", time: "34분 전",
    caption: "오늘 광화문 광장 방문 인증! 역시 멋있다 📍",
    groupTitle: "장소 탐험대", verifyEmoji: "📍", aspect: "tall",
    img: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=400&fit=crop",
  },
];

export function Home() {
  const navigate = useNavigate();
  const { nickname, beginVerification, groups, selectedGroupId, setSelectedGroupId, notifications } = useApp();
  const myGroups = groups.filter(g => g.joined);
  const [slideIdx, setSlideIdx]               = useState(0);
  const [chats, setChats]                     = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput]             = useState("");
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [btnFlash, setBtnFlash]               = useState(false);
  const [notifMode, setNotifMode]             = useState(false);
  const { guardAction } = useGuestGuard();
  const [reactions, setReactions]           = useState<Record<string, string>>({});
  const [emojiPickerFor, setEmojiPickerFor] = useState<string | null>(null);

  const chatEndRef      = useRef<HTMLDivElement>(null);
  const chatScrollRef   = useRef<HTMLDivElement>(null);
  const longPressTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const btnFlashTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animFrameRef    = useRef<number | null>(null);
  const isAnimatingRef  = useRef(false);
  const rateDisplayRef  = useRef<HTMLSpanElement>(null);
  const notifModeRef    = useRef(false);
  notifModeRef.current  = notifMode;
  const ignoreTapRef    = useRef(false);
  const startX          = useRef(0);
  const startY         = useRef(0);
  const dragging       = useRef(false);
  const isHoriz        = useRef<boolean | null>(null);
  const moved          = useRef(false);

  // 타이머 cleanup (unmount 시)
  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      if (btnFlashTimer.current)  clearTimeout(btnFlashTimer.current);
      if (animFrameRef.current)   cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // 앱 시작·그룹 변경 시 퍼센트 카운트업 — DOM 직접 조작으로 re-render 없이 60fps
  const groupRate = (myGroups.find(g => g.id === selectedGroupId) ?? myGroups[0])?.rate ?? 0;
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

  // 그룹이 바뀌면 채팅 초기화
  useEffect(() => {
    setChats(GROUP_CHATS[selectedGroupId] ?? GROUP_CHATS["1"]);
    setChatInput("");
  }, [selectedGroupId]);

  // 참여 중인 그룹 목록이 바뀌면 selectedGroupId 유효성 확인
  useEffect(() => {
    if (myGroups.length > 0 && !myGroups.find(g => g.id === selectedGroupId)) {
      setSelectedGroupId(myGroups[0].id);
    }
  }, [myGroups.length, selectedGroupId]);

  const selectedGroup = myGroups.find(g => g.id === selectedGroupId) ?? myGroups[0];
  const rankers       = GROUP_RANKERS[selectedGroupId] ?? GROUP_RANKERS["1"];

  function parseMinutes(time: string): number {
    if (time === "방금 전") return 0;
    const m = time.match(/^(\d+)분/);
    return m ? parseInt(m[1]) : 999;
  }
  const recentFeed  = FEED_ITEMS.filter(item => parseMinutes(item.time) <= 30);

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
  function addReaction(msgId: string, emoji: string) {
    setReactions(prev => {
      const next = { ...prev };
      if (next[msgId] === emoji) delete next[msgId]; // 같은 이모지 탭 → 제거
      else next[msgId] = emoji;
      return next;
    });
    setEmojiPickerFor(null);
  }

  function selectGroup(id: string) {
    setSelectedGroupId(id);
    setShowGroupPicker(false);
    setNotifMode(false);
    setBtnFlash(true);
    if (btnFlashTimer.current) clearTimeout(btnFlashTimer.current);
    btnFlashTimer.current = setTimeout(() => setBtnFlash(false), 600);
  }

  function sendChat() {
    const text = chatInput.trim();
    if (!text) return;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2,"0"), mm = String(now.getMinutes()).padStart(2,"0");
    setChats(p => [...p, { id: Date.now().toString(), sender: "나", text, seed: "MyUser", time: `${hh}:${mm}`, isMe: true }]);
    setChatInput("");
    setTimeout(() => {
      const el = chatScrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  const slideTx = (i: number) => `translate3d(${(i - slideIdx) * 100}%, 0, 0)`;
  const trans = "transform 0.42s cubic-bezier(0.4, 0, 0.2, 1)";
  const recentNotifs = notifications.slice(0, 5);
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-white relative">
      <style>{`
        @keyframes hm-in     { from{opacity:0;transform:translateY(-10px);}to{opacity:1;transform:translateY(0);} }
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
      `}</style>

      {/* 헤더 */}
      <header className="shrink-0 bg-white z-10 px-6 pt-4 pb-1.5 relative"
        style={{ animation: "hm-in 0.4s ease both", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FF3355] flex items-center justify-center text-white font-black text-[16px] shrink-0 shadow-[0_4px_12px_rgba(255,51,85,0.35)]">
              {nickname.charAt(0)}
            </div>
            <div>
              <p className="text-slate-900 font-black text-[17px] leading-none">{nickname} 님</p>
            </div>
          </div>
          {/* 헤더 중앙 챌리 로고 */}
          <img
            src="/chally-logo-nobg.png"
            alt="Chally"
            className="absolute left-1/2 -translate-x-1/2 h-8 w-auto object-contain opacity-75 pointer-events-none select-none"
            draggable={false}
          />
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

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col">
        <div className="px-4 pt-2 shrink-0">

          {/* ── 슬라이드 카드 ── */}
          <div
            className="relative w-full overflow-hidden select-none rounded-2xl"
            style={{ aspectRatio: "2/3", boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 0 0 1.5px rgba(255,51,85,0.25)", outline: "none" }}
            onTouchStart={e => touchBegin(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchMove={e  => touchMove(e.touches[0].clientX,  e.touches[0].clientY)}
            onTouchEnd={e   => touchEnd(e.changedTouches[0].clientX)}
            onMouseDown={e  => touchBegin(e.clientX, e.clientY)}
            onMouseMove={e  => touchMove(e.clientX,  e.clientY)}
            onMouseUp={e    => touchEnd(e.clientX)}
            onMouseLeave={() => { dragging.current = false; isHoriz.current = null; }}
          >

            {/* ─── 슬라이드 1 ─── */}
            <div className="absolute inset-0 overflow-hidden"
              style={{ transform: slideTx(0), transition: trans, willChange: "transform" }}>

              {myGroups.length === 0 ? (
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
                      {myGroups.map(g => (
                        <button key={g.id} onClick={() => selectGroup(g.id)}
                          className="shrink-0 flex flex-col items-start px-3 py-2.5 rounded-xl transition-all active:scale-95"
                          style={{
                            background: g.id === selectedGroupId ? "rgba(255,51,85,0.9)" : "rgba(255,255,255,0.15)",
                            backdropFilter: "blur(8px)",
                            border: g.id === selectedGroupId ? "1px solid rgba(255,51,85,0.5)" : "1px solid rgba(255,255,255,0.2)",
                            minWidth: 130,
                          }}>
                          <p className="text-white font-black text-[13px] leading-tight truncate w-full">{g.title}</p>
                          <p className="text-white/60 text-[10px] mt-0.5">{g.members}명 · #{g.myRank}위</p>
                        </button>
                      ))}
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
                      {podium.map(({ rank, name, seed, streak, rate, isMe }, i) => {
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
                              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`} alt={name}
                                className="rounded-full bg-slate-100 border-2"
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
                        {rest.map(({ rank, name, seed, streak, rate, isMe }, i) => (
                          <div key={rank}>
                            {i > 0 && <div className="h-px bg-slate-100 mx-3" />}
                            <div className={`flex items-center gap-2.5 px-3 py-2.5 active:opacity-70 transition-opacity cursor-pointer ${isMe ? "bg-[#FFF5F7]" : ""}`}
                              onClick={() => !isMe && navigate(`/user/${seed}`)}>
                              <span className="w-5 text-center text-[12px] font-black tabular-nums shrink-0"
                                style={{ color: isMe ? "#FF3355" : "rgba(160,160,160,0.7)" }}>{rank}</span>
                              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`} alt={name}
                                className="w-7 h-7 rounded-full bg-slate-100 shrink-0" draggable={false} />
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
                    <span className="text-slate-400 text-[11px]">5명 온라인</span>
                  </div>
                </div>
              </div>

              <div ref={chatScrollRef}
                className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-3 bg-slate-50"
                onScroll={() => setEmojiPickerFor(null)}
                onClick={() => emojiPickerFor && setEmojiPickerFor(null)}>
                {chats.map((msg) => {
                  if (msg.type === "achievement") {
                    return (
                      <div key={msg.id} className="flex justify-center my-1">
                        <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
                          style={{ background: "linear-gradient(135deg,rgba(251,191,36,0.12),rgba(249,115,22,0.12))", border: "1px solid rgba(251,191,36,0.3)" }}>
                          <Flame className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" />
                          <span className="text-amber-700 text-[11px] font-bold">{msg.achieverName} · {msg.streak}일 연속 달성! 🎉</span>
                        </div>
                      </div>
                    );
                  }
                  const isPickerOpen = emojiPickerFor === msg.id;
                  return (
                    <div key={msg.id} className={`flex gap-2 items-end ${msg.isMe ? "flex-row-reverse" : "flex-row"}`}>
                      {!msg.isMe && (
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.seed}`} alt={msg.sender}
                          className="w-7 h-7 rounded-full bg-slate-200 shrink-0 mb-5 cursor-pointer active:opacity-70 transition-opacity" draggable={false}
                          onClick={() => navigate(`/user/${msg.seed}`)} />
                      )}
                      <div className={`flex flex-col gap-0.5 max-w-[68%] ${msg.isMe ? "items-end" : "items-start"}`}>
                        {!msg.isMe && (
                          <span className="text-slate-400 text-[10px] font-semibold px-1 cursor-pointer active:text-slate-600 transition-colors"
                            onClick={() => navigate(`/user/${msg.seed}`)}>
                            {msg.sender}
                          </span>
                        )}
                        {/* 이모지 피커 */}
                        {isPickerOpen && (
                          <div className={`flex gap-1 mb-1 ${msg.isMe ? "justify-end" : "justify-start"}`}
                            onTouchStart={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                            <div className="flex gap-1 bg-white rounded-2xl px-2 py-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.15)] border border-slate-100"
                              style={{ animation: "picker-in 0.15s ease both" }}>
                              {EMOJI_REACTIONS.map(emoji => (
                                <button key={emoji}
                                  className="w-8 h-8 flex items-center justify-center text-[17px] rounded-xl active:bg-slate-100 transition-colors"
                                  onTouchStart={e => e.stopPropagation()}
                                  onClick={() => addReaction(msg.id, emoji)}>
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* 말풍선 + 반응 버튼 */}
                        <div className={`flex items-center gap-1.5 ${msg.isMe ? "flex-row-reverse" : "flex-row"}`}>
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
                          {/* 반응 추가 버튼 — 상대방 메시지에만 */}
                          {!msg.isMe && <button
                            className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                            style={{ background: isPickerOpen ? "rgba(255,51,85,0.12)" : "rgba(0,0,0,0.06)" }}
                            onTouchStart={e => e.stopPropagation()}
                            onMouseDown={e => e.stopPropagation()}
                            onClick={e => { e.stopPropagation(); setEmojiPickerFor(isPickerOpen ? null : msg.id); }}>
                            <SmilePlus className="w-3.5 h-3.5" style={{ color: isPickerOpen ? "#FF3355" : "#94a3b8" }} />
                          </button>}
                        </div>
                        {/* 이모지 반응 — 하나만 */}
                        {reactions[msg.id] && (
                          <button
                            className={`mt-0.5 px-2 py-0.5 rounded-full text-[14px] active:scale-90 transition-transform`}
                            style={{ background: "white", border: "1.5px solid rgba(255,51,85,0.25)", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}
                            onTouchStart={e => e.stopPropagation()}
                            onClick={e => { e.stopPropagation(); addReaction(msg.id, reactions[msg.id]); }}>
                            {reactions[msg.id]}
                          </button>
                        )}
                        <span className="text-slate-400 text-[10px] px-1">{msg.time}</span>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

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

        {/* 인증하기 버튼 */}
        <div className="px-4 pb-3 pt-2 shrink-0">
          <button
            onClick={() => guardAction(() => {
              if (selectedGroup) {
                const vType = selectedGroup.verifyType as VerifyTypeKey;
                beginVerification({ verifyType: vType });
                navigate(`/verify/guide/${vType}`);
              } else {
                navigate("/challenge");
              }
            })}
            className="relative w-full h-[68px] rounded-[20px] flex items-center px-5 gap-4 text-white active:scale-[0.97] transition-all duration-200 overflow-hidden"
            style={{ background: "linear-gradient(115deg, #FF5C7A 0%, #FF3355 45%, #C8002B 100%)", boxShadow: "0 8px 24px rgba(255,51,85,0.22), 0 1px 0 rgba(255,255,255,0.12) inset", animation: btnFlash ? "btn-flash 0.6s cubic-bezier(0.4,0,0.2,1) both" : undefined }}>
            {/* 배경 광택 원 */}
            {/* 카메라 아이콘 */}
            <div className="shrink-0 w-10 h-10 rounded-[14px] flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)", border: "1px solid rgba(255,255,255,0.2)" }}>
              <Camera className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            {/* 텍스트 */}
            <div className="flex flex-col gap-0.5 flex-1">
              <span className="font-black text-[16px] leading-none tracking-tight">오늘 인증하기</span>
              <span className="text-white/55 text-[12px] font-medium leading-none truncate">
                {selectedGroup
                  ? `${VERIFY_TYPES[(selectedGroup.verifyType as VerifyTypeKey) ?? "step_walk"]?.emoji} ${selectedGroup.goal}`
                  : "챌린지에 참여하고 인증해보세요"}
              </span>
            </div>
            {/* 화살표 */}
            <ChevronRight className="w-5 h-5 text-white/40 shrink-0" strokeWidth={2.5} />
          </button>
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
            <button
              onClick={() => navigate("/feed")}
              className="text-[12px] font-bold text-slate-400 active:text-slate-600 transition-colors"
            >
              전체보기
            </button>
          </div>

          {/* 벤토 비대칭 그리드 */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* 왼쪽 컬럼 */}
            <div className="flex flex-col gap-2.5">
              {recentFeed.filter((_, i) => i % 2 === 0).map((item) => (
                <FeedCard key={item.id} item={item} />
              ))}
            </div>
            {/* 오른쪽 컬럼 — 위로 오프셋 */}
            <div className="flex flex-col gap-2.5 mt-6">
              {recentFeed.filter((_, i) => i % 2 === 1).map((item) => (
                <FeedCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

function FeedCard({ item }: { item: FeedItem; key?: React.Key }) {
  const navigate = useNavigate();

  function goToPhoto() {
    navigate("/challenge/group/feed/activity", {
      state: {
        imgSrc: item.img,
        grad: ["#FF3355", "#FF6680"] as [string, string],
        name: item.user,
        seed: item.seed,
        time: item.time,
        msg: item.caption,
        type: "verify",
      },
    });
  }

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden shadow-sm active:scale-[0.97] transition-transform cursor-pointer border border-black/[0.04]"
      onClick={goToPhoto}
    >
      {/* 이미지 */}
      <div className={`relative ${item.aspect === "tall" ? "aspect-[3/4]" : "aspect-square"}`}>
        <img
          src={item.img}
          alt={item.caption}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        {/* 그라데이션 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        {/* 시간 배지 */}
        <div className="absolute top-2.5 left-2.5 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full">
          <span className="text-[9px] text-white font-bold">{item.time}</span>
        </div>
        {/* 그룹 배지 */}
        <div className="absolute top-2.5 right-2.5 bg-black/30 backdrop-blur-sm px-1.5 py-0.5 rounded-full">
          <span className="text-[10px]">{item.verifyEmoji}</span>
        </div>
        {/* 하단 유저 + 캡션 */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <button
            className="flex items-center gap-1.5 mb-1 w-full active:opacity-70 transition-opacity"
            onClick={e => { e.stopPropagation(); navigate(`/user/${item.seed}`); }}
          >
            <img
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${item.seed}`}
              alt={item.user}
              className="w-5 h-5 rounded-full bg-white/20 shrink-0"
            />
            <span className="text-white text-[11px] font-black truncate">{item.user}</span>
          </button>
          <p className="text-white/75 text-[11px] leading-snug line-clamp-2">{item.caption}</p>
        </div>
      </div>
    </div>
  );
}
