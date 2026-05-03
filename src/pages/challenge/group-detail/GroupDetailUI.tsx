import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, Share2, Flame, Crown, Copy, Check, X, Camera, MoreHorizontal, LogOut } from "lucide-react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { cn } from "../../../lib/utils";
import { useApp } from "../../../contexts/AppContext";
import { VERIFY_TYPES, type VerifyTypeKey } from "../../../lib/verifyTypes";

type ActivityItem = {
  name: string; seed: string; time: string; msg: string;
  type: "verify" | "streak" | "rank" | "comment";
  grad: [string, string];
};

const GROUPS_DETAIL: Record<string, {
  rule: string;
  leaderboard: { rank: number; name: string; seed: string; streak: number; rate: number; isMe?: boolean }[];
  activity: ActivityItem[];
}> = {
  "1": {
    rule: "매일 5,000보 이상 만보기 스크린샷 인증",
    leaderboard: [
      { rank: 1,  name: "김지수",     seed: "Felix", streak: 24, rate: 98 },
      { rank: 2,  name: "박민혁",     seed: "Aneka", streak: 18, rate: 92 },
      { rank: 3,  name: "이성민",     seed: "Jude",  streak: 15, rate: 87 },
      { rank: 4,  name: "나 (홍길동)", seed: "Kim",   streak: 8,  rate: 75, isMe: true },
      { rank: 5,  name: "최다은",     seed: "Dawn",  streak: 6,  rate: 68 },
      { rank: 6,  name: "유나연",     seed: "Luna",  streak: 5,  rate: 60 },
      { rank: 7,  name: "서준혁",     seed: "Alex",  streak: 3,  rate: 48 },
      { rank: 8,  name: "강민지",     seed: "Mina",  streak: 2,  rate: 35 },
      { rank: 9,  name: "강태양",     seed: "Bear",  streak: 1,  rate: 25 },
      { rank: 10, name: "오지현",     seed: "Lily",  streak: 0,  rate: 18 },
    ],
    activity: [
      { name: "김지수", seed: "Felix", time: "방금",    msg: "오늘 13,200보 달성! 연속 24일째 🔥", type: "verify",  grad: ["#FF3355","#FF6680"] },
      { name: "박민혁", seed: "Aneka", time: "1시간 전", msg: "18일 연속 달성 🔥",                  type: "streak",  grad: ["#FB923C","#F59E0B"] },
      { name: "이성민", seed: "Jude",  time: "3시간 전", msg: "점심시간 공원 한 바퀴 완료 ✅",       type: "verify",  grad: ["#34d399","#10B981"] },
      { name: "최다은", seed: "Dawn",  time: "5시간 전", msg: "오늘도 화이팅! 다 같이 걸어요 💪",   type: "comment", grad: ["#A78BFA","#7C3AED"] },
    ],
  },
  "2": {
    rule: "러닝 중 찍은 풍경 사진 인증",
    leaderboard: [
      { rank: 1, name: "강민준", seed: "Leo",  streak: 30, rate: 95 },
      { rank: 2, name: "오서연", seed: "Mia",  streak: 22, rate: 90 },
      { rank: 3, name: "유하늘", seed: "Zoe",  streak: 19, rate: 85 },
      { rank: 4, name: "임태현", seed: "Tom",  streak: 14, rate: 78 },
      { rank: 5, name: "박준서", seed: "Evan", streak: 0,  rate: 18 },
    ],
    activity: [
      { name: "강민준", seed: "Leo", time: "방금",    msg: "새벽 한강 러닝 완주! 오늘 풍경 미쳤다 🌅", type: "verify",  grad: ["#34d399","#0EA5E9"] },
      { name: "오서연", seed: "Mia", time: "2시간 전", msg: "퇴근 후 공원 러닝 완료 🏃",               type: "verify",  grad: ["#FF3355","#FF6680"] },
      { name: "유하늘", seed: "Zoe", time: "4시간 전", msg: "오늘 같이 달릴 분? 저녁 7시요!",          type: "comment", grad: ["#38BDF8","#0EA5E9"] },
      { name: "임태현", seed: "Tom", time: "어제",     msg: "14일 연속 달성 🏅",                        type: "streak",  grad: ["#FB923C","#F59E0B"] },
    ],
  },
  "3": {
    rule: "매일 읽는 책 표지 사진 인증",
    leaderboard: [
      { rank: 1, name: "한소희",     seed: "Ava",  streak: 8, rate: 100 },
      { rank: 2, name: "이준혁",     seed: "Dan",  streak: 6, rate: 87  },
      { rank: 3, name: "나 (홍길동)", seed: "Kim",  streak: 5, rate: 75, isMe: true },
      { rank: 4, name: "정우성",     seed: "Owen", streak: 0, rate: 12  },
    ],
    activity: [
      { name: "한소희", seed: "Ava", time: "방금",    msg: "이번 주 독서 완료! 정말 좋은 책이에요 📚", type: "verify",  grad: ["#FB923C","#F97316"] },
      { name: "이준혁", seed: "Dan", time: "1시간 전", msg: "절반 읽었어요, 오늘 다 끝낼게요",           type: "comment", grad: ["#A78BFA","#7C3AED"] },
      { name: "한소희", seed: "Ava", time: "어제",     msg: "8주 연속 완독 달성 🏅",                    type: "streak",  grad: ["#FB923C","#F59E0B"] },
      { name: "정우성", seed: "Owen",time: "어제",     msg: "오늘 시작했어요! 다들 화이팅 📖",           type: "verify",  grad: ["#34d399","#10B981"] },
    ],
  },
  "4": {
    rule: "오늘의 인상 깊은 문장 사진 인증",
    leaderboard: [
      { rank: 1, name: "송민재", seed: "Finn",  streak: 18, rate: 95 },
      { rank: 2, name: "이수진", seed: "Sue",   streak: 12, rate: 87 },
      { rank: 3, name: "조현우", seed: "Hugh",  streak: 7,  rate: 70 },
      { rank: 4, name: "박서은", seed: "Sera",  streak: 2,  rate: 40 },
    ],
    activity: [
      { name: "송민재", seed: "Finn", time: "방금",    msg: "'작은 습관이 큰 변화를 만든다' 오늘의 문장 ✍️", type: "verify",  grad: ["#A78BFA","#7C3AED"] },
      { name: "이수진", seed: "Sue",  time: "2시간 전", msg: "손글씨 필사 완료! 마음이 차분해져요",          type: "verify",  grad: ["#38BDF8","#0284C7"] },
      { name: "조현우", seed: "Hugh", time: "어제",     msg: "같이 꾸준히 해봐요 💪",                       type: "comment", grad: ["#FB923C","#F59E0B"] },
      { name: "박서은", seed: "Sera", time: "어제",     msg: "7일 연속 달성! 🎉",                           type: "streak",  grad: ["#34d399","#10B981"] },
    ],
  },
  "5": {
    rule: "오늘의 지정 포즈로 셀카 인증",
    leaderboard: [
      { rank: 1, name: "윤서아", seed: "Eva",   streak: 28, rate: 97 },
      { rank: 2, name: "김태양", seed: "Ray",   streak: 21, rate: 91 },
      { rank: 3, name: "이하은", seed: "Hazel", streak: 17, rate: 85 },
      { rank: 4, name: "박준수", seed: "Jake",  streak: 9,  rate: 72 },
      { rank: 5, name: "최유리", seed: "Ruby",  streak: 4,  rate: 50 },
    ],
    activity: [
      { name: "윤서아", seed: "Eva",   time: "방금",    msg: "오늘 포즈 도전 완료! 쑥스럽지만 재밌어요 📸", type: "verify",  grad: ["#FF3355","#FF6680"] },
      { name: "김태양", seed: "Ray",   time: "1시간 전", msg: "21일 연속 달성! 이젠 익숙해졌어요 😄",       type: "streak",  grad: ["#FB923C","#F59E0B"] },
      { name: "이하은", seed: "Hazel", time: "3시간 전", msg: "오늘 포즈 제일 어렵다 ㅋㅋ 그래도 성공!",    type: "verify",  grad: ["#A78BFA","#7C3AED"] },
      { name: "박준수", seed: "Jake",  time: "어제",     msg: "친구 같이 찍었어요~ 2배 재밌어요!",           type: "comment", grad: ["#38BDF8","#0EA5E9"] },
    ],
  },
  "6": {
    rule: "목표 장소 방문 인증 사진",
    leaderboard: [
      { rank: 1, name: "정서윤", seed: "Ella",  streak: 20, rate: 94 },
      { rank: 2, name: "최민준", seed: "Ace",   streak: 13, rate: 85 },
      { rank: 3, name: "임지수", seed: "Grace", streak: 8,  rate: 72 },
      { rank: 4, name: "박하늘", seed: "Sky",   streak: 3,  rate: 45 },
    ],
    activity: [
      { name: "정서윤", seed: "Ella",  time: "방금",    msg: "오늘 북촌 한옥마을 방문 인증! 강추 📍",       type: "verify",  grad: ["#38BDF8","#0284C7"] },
      { name: "최민준", seed: "Ace",   time: "2시간 전", msg: "성수동 카페거리 탐험 완료 ☕",               type: "verify",  grad: ["#34d399","#10B981"] },
      { name: "임지수", seed: "Grace", time: "어제",     msg: "다음에 같이 탐험 가요!! 🗺️",               type: "comment", grad: ["#A78BFA","#7C3AED"] },
      { name: "박하늘", seed: "Sky",   time: "어제",     msg: "8일 연속 달성 🎉",                          type: "streak",  grad: ["#FB923C","#F59E0B"] },
    ],
  },
};

const HERO_IMAGES: Record<string, string> = {
  "1": "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&fit=crop&q=80",
  "2": "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800&fit=crop&q=80",
  "3": "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=800&fit=crop&q=80",
  "4": "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&fit=crop&q=80",
  "5": "https://images.unsplash.com/photo-1552196563-55cd4e45efb3?w=800&fit=crop&q=80",
  "6": "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&fit=crop&q=80",
};

const ACTIVITY_IMGS: Record<string, string[]> = {
  "1": [
    "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=400&fit=crop&q=80",
    "https://images.unsplash.com/photo-1486218119243-13301ac3f579?w=400&fit=crop&q=80",
    "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&fit=crop&q=80",
    "https://images.unsplash.com/photo-1534258936925-c58bed479fcb?w=400&fit=crop&q=80",
  ],
  "2": [
    "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=400&fit=crop&q=80",
    "https://images.unsplash.com/photo-1539701938214-0d9736e1c16b?w=400&fit=crop&q=80",
    "https://images.unsplash.com/photo-1594882645126-14020914d58d?w=400&fit=crop&q=80",
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&fit=crop&q=80",
  ],
  "3": [
    "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&fit=crop&q=80",
    "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=400&fit=crop&q=80",
    "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&fit=crop&q=80",
    "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&fit=crop&q=80",
  ],
  "4": [
    "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400&fit=crop&q=80",
    "https://images.unsplash.com/photo-1471107340929-a87cd0f5b5f3?w=400&fit=crop&q=80",
    "https://images.unsplash.com/photo-1506784365847-bbad939e9335?w=400&fit=crop&q=80",
    "https://images.unsplash.com/photo-1500989145603-8e7ef71d639e?w=400&fit=crop&q=80",
  ],
  "5": [
    "https://images.unsplash.com/photo-1552196563-55cd4e45efb3?w=400&fit=crop&q=80",
    "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&fit=crop&q=80",
    "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&fit=crop&q=80",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&fit=crop&q=80",
  ],
  "6": [
    "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=400&fit=crop&q=80",
    "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&fit=crop&q=80",
    "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400&fit=crop&q=80",
    "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&fit=crop&q=80",
  ],
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
  const { state: locState } = useLocation() as { state: { tab?: "leaderboard" | "activity"; skipAnimation?: boolean; fromActivityPhoto?: boolean } | null };

  const group  = groups.find(g => g.id === groupId) ?? groups[0];
  const detail = GROUPS_DETAIL[groupId] ?? GROUPS_DETAIL["1"];

  const skipAnim = locState?.skipAnimation ?? false;
  const [mounted, setMounted]                   = useState(skipAnim);
  const [tab, setTab]                           = useState<"leaderboard" | "activity">(locState?.tab ?? "leaderboard");
  const [copied, setCopied]                     = useState(false);
  const [showInvite, setShowInvite]             = useState(false);
  const [showJoinConfirm, setShowJoinConfirm]   = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showActionMenu, setShowActionMenu]     = useState(false);
  const [scrolled, setScrolled]                 = useState(false);
  const [showMyRate, setShowMyRate]             = useState(false);
  const scrollRef                               = useRef<HTMLDivElement>(null);
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

  const inviteLink = `${INVITE_BASE}${groupId.padStart(4, "0")}`;
  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const top3     = detail.leaderboard.slice(0, 3);
  const restList = detail.leaderboard.slice(3);
  const top3Seeds = top3.map(r => r.seed);
  const vt       = VERIFY_TYPES[(group?.verifyType as VerifyTypeKey) ?? "step_walk"];
  const heroImg  = HERO_IMAGES[groupId] ?? HERO_IMAGES["1"];
  const actImgs  = ACTIVITY_IMGS[groupId] ?? ACTIVITY_IMGS["1"];
  const myRank   = detail.leaderboard.find(r => r.isMe);
  const myPhotos = verificationHistory.filter(v => v.photo_url && v.status === "completed");

  // 포디엄 순서: 2위(좌) - 1위(중앙) - 3위(우)
  const podium = [
    top3.find(r => r.rank === 2),
    top3.find(r => r.rank === 1),
    top3.find(r => r.rank === 3),
  ].filter(Boolean) as typeof top3;

  const startVerification = () => {
    beginVerification({ verifyType: group.verifyType as VerifyTypeKey });
    navigate(`/verify/guide/${group.verifyType}`);
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
          <img src={heroImg} alt={group.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
                {top3Seeds.map((seed, i) => (
                  <img key={i} src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`}
                    className="w-10 h-10 rounded-full border-2 border-white bg-slate-100 shrink-0" />
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
                <p className="text-[10px] text-slate-400 font-medium">달성률</p>
                <p className="text-[18px] font-black text-slate-900 leading-none">{group.rate}%</p>
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

        {/* ── 탭 ── */}
        <div className="mx-4 mt-5 flex gap-1 p-1 bg-white rounded-2xl border border-black/[0.04]"
          style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.5s ease 0.35s" }}>
          {(["leaderboard", "activity"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("flex-1 py-2.5 rounded-xl text-[13px] font-black transition-all duration-200 active:scale-[0.97]",
                tab === t ? "text-white" : "text-slate-400")}
              style={tab === t ? { background: PG, boxShadow: "0 4px 14px rgba(255,51,85,0.35)" } : {}}>
              {t === "leaderboard" ? "🏆  순위" : "💬  활동"}
            </button>
          ))}
        </div>

        {/* ── 내 진행 상태 (토글) ── */}
        {group.joined && myRank && (
          <div className="mx-4 mt-3">
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
          </div>
        )}

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
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${myRank.seed}`}
                        className="w-12 h-12 rounded-full bg-slate-100" />
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
                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${p.seed}`}
                            className="rounded-full bg-slate-100"
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
                    {restList.map(({ rank, name, seed, streak, rate: r, isMe }, i) => (
                      <div key={name}>
                        {i > 0 && <div className="h-px bg-slate-50 mx-4" />}
                        <div
                          className={cn("flex items-center gap-3 px-4 py-3.5 active:opacity-70 cursor-pointer",
                            isMe ? "bg-[#FFF5F7]" : "")}
                          onClick={() => !isMe && navigate(`/user/${seed}`)}>
                          <span className={cn("w-6 text-center text-[13px] font-black tabular-nums shrink-0",
                            isMe ? "text-[#FF3355]" : "text-slate-300")}>{rank}</span>
                          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`}
                            className="w-9 h-9 rounded-full bg-slate-100 shrink-0" />
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
            </div>

          ) : (
            /* ── 활동 피드 ── */
            <div className="px-4 mt-3">
              {detail.activity.length > 0 ? (
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="flex flex-col gap-2.5">
                    {detail.activity.filter((_, i) => i % 2 === 0).map((item, i) => {
                      const imgSrc = item.type === "verify" ? (actImgs[i * 2] ?? actImgs[0]) : undefined;
                      return (
                        <ActivityCard key={i} item={item} imgSrc={imgSrc}
                          aspect={i === 0 ? "tall" : "square"} mounted={mounted} delay={i * 80} groupId={groupId} />
                      );
                    })}
                  </div>
                  <div className="flex flex-col gap-2.5 mt-6">
                    {detail.activity.filter((_, i) => i % 2 === 1).map((item, i) => {
                      const imgSrc = item.type === "verify" ? (actImgs[i * 2 + 1] ?? actImgs[1]) : undefined;
                      return (
                        <ActivityCard key={i} item={item} imgSrc={imgSrc}
                          aspect={i === 0 ? "square" : "tall"} mounted={mounted} delay={i * 80 + 40} groupId={groupId} />
                      );
                    })}
                  </div>
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
        state: { imgSrc, grad: item.grad, name: item.name, seed: item.seed, time: item.time, msg: item.msg, type: item.type },
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
            onClick={e => { e.stopPropagation(); navigate(`/user/${item.seed}`); }}
          >
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${item.seed}`}
              className="w-5 h-5 rounded-full bg-white/20 shrink-0" />
            <span className="text-white text-[11px] font-black truncate">{item.name}</span>
            <span className="text-white/50 text-[10px] ml-auto shrink-0">{item.time}</span>
          </button>
          <p className="text-white/80 text-[11px] leading-snug line-clamp-2">{item.msg}</p>
        </div>
      </div>
    </div>
  );
}
