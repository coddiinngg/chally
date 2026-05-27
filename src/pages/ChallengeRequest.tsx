import React, { useState, useEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft, Search, ChevronUp, ChevronDown, MessageCircle, Share2,
  Bell, Plus, X, Flame, CheckCircle, Clock, Send, Heart, ArrowRight, ImageIcon,
  Dumbbell, BookOpen, Zap, Salad, Sparkles, Vote, Wrench, Eye, Calendar, Camera, Pencil, Mail, PartyPopper, Check,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { shareOrCopy } from "../lib/share";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import type { ChallengeSuggestionCommentRecord, ChallengeSuggestionRecord } from "../types/database";
import { useScrollRestoration, usePersistedState } from "../lib/useScrollRestoration";

/* ── 타입 ── */
type Status   = "투표중" | "개발확정" | "검토중";
type Category = "운동/건강" | "독서/공부" | "생산성" | "마음챙김" | "식습관" | "기타";
type Duration = "7일" | "21일" | "30일";
type Tab      = "전체" | "모으는중" | "만드는중" | "내건의";

interface Suggestion {
  id: string; title: string; desc: string;
  status: Status; category: Category; duration: Duration;
  votes: number; comments: number; agreeRate: number; daysAgo: string;
  isMine?: boolean; operatorComment?: string; verifyMethod?: string;
  commentList: { id: string; name: string; text: string }[];
  progress: number;
  hasCheered?: boolean;
  notifyOn?: boolean;
}


const CAT_ICON: Record<string, LucideIcon> = {
  "운동/건강": Dumbbell, "독서/공부": BookOpen, "생산성": Zap, "마음챙김": Heart, "식습관": Salad, "기타": Sparkles,
};

const STATUS_META: Record<Status, { label: string; Icon: LucideIcon; color: string; bg: string }> = {
  "투표중":   { label: "모으는 중", Icon: Vote,   color: "#FF3355", bg: "rgba(255,51,85,0.07)" },
  "개발확정": { label: "만드는 중", Icon: Wrench, color: "#059669", bg: "#ecfdf5" },
  "검토중":   { label: "검토 중",   Icon: Eye,    color: "#78716c", bg: "#fafaf9" },
};

function relativeDay(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.max(0, Math.floor(diff / 86400000));
  if (days === 0) return "오늘";
  if (days < 7) return `${days}일 전`;
  return `${Math.floor(days / 7)}주 전`;
}

function mapSuggestion(
  row: ChallengeSuggestionRecord,
  comments: ChallengeSuggestionCommentRecord[],
  userId?: string,
  votedIds = new Set<string>(),
  subscribedIds = new Set<string>(),
): Suggestion {
  return {
    id: row.id,
    title: row.title,
    desc: row.description,
    status: row.status,
    category: row.category,
    duration: row.duration,
    votes: row.votes_count,
    comments: row.comments_count,
    agreeRate: row.agree_rate,
    daysAgo: relativeDay(row.created_at),
    isMine: !!userId && row.created_by === userId,
    operatorComment: row.operator_comment ?? undefined,
    verifyMethod: row.verify_method ?? undefined,
    commentList: comments
      .filter(c => c.suggestion_id === row.id)
      .map(c => ({ id: c.id, name: c.author_name ?? "나", text: c.body })),
    progress: row.votes_count,
    hasCheered: votedIds.has(row.id),
    notifyOn: subscribedIds.has(row.id),
  };
}

/* ── 전역 CSS ── */
const G = `
  @keyframes g-up    { from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)} }
  @keyframes g-fade  { from{opacity:0}to{opacity:1} }
  @keyframes g-pop   { 0%{transform:scale(0.5);opacity:0}65%{transform:scale(1.12)}100%{transform:scale(1);opacity:1} }
  @keyframes g-heart { 0%,100%{transform:scale(1)}30%{transform:scale(0.85)}60%{transform:scale(1.25)}80%{transform:scale(0.95)} }
  @keyframes g-slide-l { from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)} }
  @keyframes g-slide-r { from{opacity:0;transform:translateX(-24px)}to{opacity:1;transform:translateX(0)} }
  @keyframes g-exp   { from{opacity:0;max-height:0}to{opacity:1;max-height:200px} }
  .no-sb::-webkit-scrollbar{display:none}.no-sb{-ms-overflow-style:none;scrollbar-width:none}
`;

/* ════════════════════════════════════════
   카드
════════════════════════════════════════ */
function NoteCard({
  s, idx, onDetail, onCheer,
}: { s: Suggestion; idx: number; onDetail: (id: string) => void; onCheer: (id: string, next: boolean) => void }) {
  const [heartAnim, setHeartAnim] = useState(false);
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[s.status];
  const cheered = !!s.hasCheered;
  const voteCount = s.progress;
  const pct = Math.min((voteCount / 200) * 100, 100);
  const isHot = s.votes >= 100;

  function handleCheer(e: React.MouseEvent) {
    e.stopPropagation();
    onCheer(s.id, !cheered);
    setHeartAnim(true);
    setTimeout(() => setHeartAnim(false), 500);
  }

  const entry: React.CSSProperties = {
    animation: `g-up 0.4s cubic-bezier(0.22,1,0.36,1) ${80 + idx * 60}ms both`,
  };

  /* 투표 중 — 메인 카드 */
  if (s.status === "투표중") {
    return (
      <div
        className="bg-white rounded-2xl overflow-hidden"
        style={{ ...entry, boxShadow: "0 2px 16px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)" }}
      >
        <div className="p-4">
          {/* 상단 메타 */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full"
                style={{ color: meta.color, background: meta.bg }}
              >
                <meta.Icon className="w-3 h-3" strokeWidth={2.4} />
                {meta.label}
              </span>
              {isHot && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-500">
                  <Flame className="w-3 h-3" strokeWidth={2.4} fill="currentColor" />
                  인기
                </span>
              )}
              {s.isMine && (
                <span className="text-[11px] px-2 py-1 rounded-full bg-violet-50 text-violet-500 font-bold">내 건의</span>
              )}
            </div>
            <button
              onTouchStart={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
              className="text-[12px] text-slate-400 px-2 py-1 rounded-lg active:bg-slate-50 transition-colors"
            >
              {open ? "접기" : "더보기"}
            </button>
          </div>

          {/* 제목 */}
          <button className="w-full text-left mb-3" onClick={() => onDetail(s.id)}>
            <h3 className="text-[16px] font-bold text-slate-900 leading-snug">{s.title}</h3>
          </button>

          {/* 펼침 내용 */}
          {open && (
            <div className="mb-3 pb-3 border-b border-slate-100" style={{ animation: "g-fade 0.2s ease both" }}>
              <p className="text-[13px] text-slate-500 leading-relaxed mb-2">{s.desc}</p>
              <div className="flex gap-1.5 flex-wrap">
                {(() => {
                  const CatIcon = CAT_ICON[s.category] ?? Sparkles;
                  return (
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
                      <CatIcon className="w-3 h-3" strokeWidth={2.2} />
                      {s.category}
                    </span>
                  );
                })()}
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
                  <Calendar className="w-3 h-3" strokeWidth={2.2} />
                  {s.duration}
                </span>
                {s.verifyMethod && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
                    <Camera className="w-3 h-3" strokeWidth={2.2} />
                    {s.verifyMethod}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 진행 바 */}
          <div className="mb-3.5">
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="text-[12px] text-slate-500">
                <span className="font-bold text-slate-800">{Math.max(200 - voteCount, 0)}명</span> 더 응원하면 만들어져요!
              </span>
              <span className="text-[11px] text-slate-400">{voteCount}/200</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  background: "linear-gradient(90deg, #FF3355, #ff8099)",
                  transition: "width 0.6s cubic-bezier(0.22,1,0.36,1)",
                }}
              />
            </div>
          </div>

          {/* 액션 */}
          <div className="flex gap-2">
            <button
              onTouchStart={e => e.stopPropagation()}
              onClick={handleCheer}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-[14px] transition-colors"
              style={{
                background: cheered ? "#FF3355" : "rgba(255,51,85,0.06)",
                color: cheered ? "white" : "#FF3355",
                border: cheered ? "none" : "1.5px solid rgba(255,51,85,0.15)",
              }}
            >
              <Heart
                className="w-4 h-4"
                fill={cheered ? "white" : "none"}
                style={{ animation: heartAnim ? "g-heart 0.45s ease" : "none" }}
              />
              {cheered ? "응원 중!" : "응원하기"} · {voteCount}
            </button>
            <button
              onTouchStart={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onDetail(s.id); }}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 text-slate-500 text-[13px] active:bg-slate-200 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />{s.comments}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* 개발확정 / 검토중 — 작은 카드 */
  return (
    <button
      onClick={() => onDetail(s.id)}
      className="w-full text-left bg-white rounded-xl active:scale-[0.98] transition-transform"
      style={{ ...entry, boxShadow: "0 1px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)" }}
    >
      <div className="px-4 py-3.5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: meta.bg }}>
          <meta.Icon className="w-4 h-4" style={{ color: meta.color }} strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[11px] font-bold" style={{ color: meta.color }}>{meta.label}</span>
            {s.isMine && <span className="text-[11px] text-violet-400 font-bold">· 내 건의</span>}
          </div>
          <h3 className="text-[14px] font-bold text-slate-800 leading-snug truncate">{s.title}</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">{s.votes}명 응원 · {s.daysAgo}</p>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-300 -rotate-90 shrink-0" />
      </div>
    </button>
  );
}

/* ════════════════════════════════════════
   목록 뷰
════════════════════════════════════════ */
function ListView({
  suggestions, loading, onNew, onDetail, onCheer,
}: {
  suggestions: Suggestion[];
  loading: boolean;
  onNew: () => void;
  onDetail: (id: string) => void;
  onCheer: (id: string, next: boolean) => void;
}) {
  const [tab, setTab] = usePersistedState<Tab>(
    "cr-tab", "전체",
    (v): v is Tab => v === "전체" || v === "모으는중" || v === "만드는중" || v === "내건의",
  );
  const [query, setQuery] = useState("");
  const listScrollRef = useRef<HTMLDivElement>(null);
  useScrollRestoration("cr-list-scroll", listScrollRef, !loading);

  const tabs: { key: Tab; label: string; Icon?: LucideIcon }[] = [
    { key: "전체",     label: "전체" },
    { key: "모으는중", label: "모으는 중", Icon: Vote },
    { key: "만드는중", label: "만드는 중", Icon: Wrench },
    { key: "내건의",   label: "내 건의" },
  ];

  const filtered = suggestions.filter(s => {
    if (tab === "모으는중" && s.status !== "투표중")   return false;
    if (tab === "만드는중" && s.status !== "개발확정") return false;
    if (tab === "내건의"   && !s.isMine)              return false;
    if (query && !s.title.includes(query) && !s.desc.includes(query)) return false;
    return true;
  });

  const voting    = filtered.filter(s => s.status === "투표중");
  const confirmed = filtered.filter(s => s.status === "개발확정");
  const reviewing = filtered.filter(s => s.status === "검토중");

  return (
    <div className="flex flex-col flex-1 overflow-hidden" style={{ background: "#f7f6f3" }}>
      <style>{G}</style>

      {/* 상단 헤드 */}
      <div className="px-4 pt-3 pb-3 bg-white" style={{ animation: "g-fade 0.3s ease both" }}>
        {/* 검색 */}
        <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            value={query} onChange={e => setQuery(e.target.value)}
            placeholder="어떤 챌린지를 찾고 있나요?"
            className="flex-1 bg-transparent text-[14px] text-slate-700 placeholder-slate-400 outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")} className="active:scale-90 transition-transform">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div
        className="flex gap-1.5 px-4 py-2.5 overflow-x-auto no-sb bg-white border-b border-slate-100"
        style={{ animation: "g-fade 0.3s ease 0.05s both" }}
      >
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[13px] font-bold transition-all active:scale-95 ${
              tab === t.key
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {t.Icon && <t.Icon className="w-3.5 h-3.5" strokeWidth={2.2} />}
            {t.label}
          </button>
        ))}
      </div>

      {/* 목록 */}
      <div ref={listScrollRef} className="flex-1 overflow-y-auto no-sb px-4 pt-4 pb-32">
        {loading && (
          <p className="text-center text-[12px] text-slate-400 font-semibold py-4">건의함을 불러오는 중...</p>
        )}
        {tab === "전체" ? (
          <>
            {voting.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-[12px] font-bold text-slate-500 uppercase tracking-wide">응원 모으는 중</span>
                  <span className="text-[11px] text-[#FF3355] font-bold bg-[#FF3355]/8 px-2 py-0.5 rounded-full">{voting.length}</span>
                </div>
                <div className="flex flex-col gap-3">
                  {voting.map((s, i) => <React.Fragment key={s.id}><NoteCard s={s} idx={i} onDetail={onDetail} onCheer={onCheer} /></React.Fragment>)}
                </div>
              </div>
            )}
            {confirmed.length > 0 && (
              <div className="mb-5">
                <p className="text-[12px] font-bold text-slate-500 uppercase tracking-wide mb-2.5">지금 만들고 있어요</p>
                <div className="flex flex-col gap-2">
                  {confirmed.map((s, i) => <React.Fragment key={s.id}><NoteCard s={s} idx={i} onDetail={onDetail} onCheer={onCheer} /></React.Fragment>)}
                </div>
              </div>
            )}
            {reviewing.length > 0 && (
              <div className="mb-5">
                <p className="text-[12px] font-bold text-slate-500 uppercase tracking-wide mb-2.5">운영팀이 보고 있어요</p>
                <div className="flex flex-col gap-2">
                  {reviewing.map((s, i) => <React.Fragment key={s.id}><NoteCard s={s} idx={i} onDetail={onDetail} onCheer={onCheer} /></React.Fragment>)}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((s, i) => <React.Fragment key={s.id}><NoteCard s={s} idx={i} onDetail={onDetail} onCheer={onCheer} /></React.Fragment>)}
          </div>
        )}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ animation: "g-fade 0.3s ease both" }}>
            <div className="text-5xl">🤔</div>
            <p className="text-[15px] font-bold text-slate-700">아직 여기 아무것도 없네요</p>
            <p className="text-[13px] text-slate-400">첫 번째 건의를 남겨보는 건 어떨까요?</p>
          </div>
        )}
      </div>

      {/* 하단 건의 버튼 */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-6 bg-gradient-to-t from-[#f7f6f3] via-[#f7f6f3]/95 to-transparent pointer-events-none">
        <button
          onClick={onNew}
          className="w-full py-4 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2 active:scale-[0.97] transition-transform pointer-events-auto"
          style={{
            background: "#1e293b",
            color: "white",
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
          }}
        >
          <Pencil className="w-4 h-4" strokeWidth={2.2} />
          건의하고 싶은 챌린지가 있어요
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   건의 폼 — 대화형 마법사
════════════════════════════════════════ */
const WIZARD_STEPS = [
  {
    key: "name",
    question: "어떤 챌린지를\n만들고 싶으세요?",
    hint: "챌린지 이름을 간단하게 적어주세요",
    placeholder: "예) 매일 스트레칭 10분 챌린지",
    type: "input" as const,
  },
  {
    key: "reason",
    question: "왜 이 챌린지가\n필요한가요?",
    hint: "어떤 습관을 만들고 싶은지, 어떤 점이 좋은지 알려주세요",
    placeholder: "아침마다 스트레칭하면 몸도 마음도 가벼워지거든요...",
    type: "textarea" as const,
  },
  {
    key: "details",
    question: "마지막으로\n조금만 더요!",
    hint: "카테고리와 기간을 선택해주세요",
    type: "details" as const,
  },
];

type Category2 = Category;
type Duration2 = Duration;

function NewRequestView({ onBack, onCreate }: { onBack: () => void; onCreate: (params: {
  title: string;
  description: string;
  category: Category;
  duration: Duration;
  verifyMethod?: string | null;
  coverFile?: File | null;
}) => Promise<void> }) {
  const [step, setStep]         = useState(0);
  const [dir, setDir]           = useState<"forward" | "back">("forward");
  const [name, setName]         = useState("");
  const [reason, setReason]     = useState("");
  const [duration, setDuration] = useState<Duration2 | null>(null);
  const [category, setCategory] = useState<Category2 | null>(null);
  const [verifyMethod, setVerifyMethod] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const current = WIZARD_STEPS[step];
  const isLast  = step === WIZARD_STEPS.length - 1;

  const canNext =
    step === 0 ? name.trim().length > 0 :
    step === 1 ? reason.trim().length > 0 :
    category !== null && duration !== null;

  async function goNext() {
    if (!canNext) return;
    if (isLast) {
      if (!category || !duration) return;
      setSubmitting(true);
      setError("");
      try {
        await onCreate({
          title: name.trim(),
          description: reason.trim(),
          category,
          duration,
          verifyMethod: verifyMethod.trim() || null,
          coverFile,
        });
        setSubmitted(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "건의 저장에 실패했어요.");
      } finally {
        setSubmitting(false);
      }
      return;
    }
    setDir("forward");
    setStep(s => s + 1);
  }

  function goBack() {
    if (step === 0) { onBack(); return; }
    setDir("back");
    setStep(s => s - 1);
  }

  const slideAnim = dir === "forward" ? "g-slide-l 0.28s cubic-bezier(0.22,1,0.36,1) both"
                                       : "g-slide-r 0.28s cubic-bezier(0.22,1,0.36,1) both";

  if (submitted) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-6 bg-white gap-6 relative overflow-hidden">
        <style>{`
          @keyframes letter-fly {
            0%   { opacity: 0; transform: translateY(220px) scale(0.75) rotate(12deg); }
            45%  { opacity: 1; transform: translateY(-18px) scale(1.1) rotate(-4deg); }
            70%  { transform: translateY(8px) scale(0.96) rotate(2deg); }
            100% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
          }
          @keyframes success-in {
            from { opacity: 0; transform: translateY(24px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        {/* 배경 장식 */}
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(255,51,85,0.06) 0%, transparent 70%)" }} />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(255,51,85,0.04) 0%, transparent 70%)" }} />

        {/* 편지 날아오르기 */}
        <div style={{ animation: "letter-fly 0.95s cubic-bezier(0.34,1.56,0.64,1) both" }}>
          <div className="w-24 h-24 rounded-3xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(255,51,85,0.08), rgba(255,51,85,0.04))",
              border: "2px solid rgba(255,51,85,0.12)",
              boxShadow: "0 12px 40px rgba(255,51,85,0.15)",
            }}>
            <Mail className="w-12 h-12 text-[#FF3355]" strokeWidth={1.8} />
          </div>
        </div>

        {/* 텍스트 */}
        <div className="text-center" style={{ animation: "success-in 0.5s ease 0.55s both", opacity: 0 }}>
          <h2 className="text-[22px] font-black text-slate-900 mb-3 leading-snug">
            챌린지가 성공적으로<br />요청되었어요!
          </h2>
          <p className="text-[14px] text-slate-500 leading-relaxed inline-flex flex-col items-center">
            <span>운영팀이 검토 후 개발 여부를</span>
            <span className="inline-flex items-center gap-1">알림으로 알려드릴게요 <Bell className="w-4 h-4 text-slate-500" strokeWidth={2.2} /></span>
          </p>
        </div>

        {/* 돌아가기 버튼 */}
        <button
          onClick={onBack}
          className="w-full py-3.5 rounded-2xl font-bold text-[15px] active:scale-[0.97] transition-transform"
          style={{
            animation: "success-in 0.5s ease 0.75s both",
            opacity: 0,
            background: "linear-gradient(135deg, #FF3355, #C8002B)",
            color: "white",
            boxShadow: "0 8px 24px rgba(255,51,85,0.25)",
          }}
        >
          건의함으로 돌아가기
        </button>
      </div>
    );
  }

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    const url = URL.createObjectURL(file);
    setCoverPreview(url);
  }

  function removeCover() {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview("");
  }

  const durations: Duration2[]  = ["7일", "21일", "30일"];
  const categories: Category2[] = ["운동/건강", "독서/공부", "생산성", "마음챙김", "식습관", "기타"];

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-white">
      {/* 진행 도트 */}
      <div className="flex items-center justify-center gap-2 pt-3 pb-2">
        {WIZARD_STEPS.map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === step ? 20 : 6,
              height: 6,
              background: i === step ? "#1e293b" : i < step ? "#94a3b8" : "#e2e8f0",
            }}
          />
        ))}
      </div>

      {/* 슬라이드 영역 */}
      <div key={step} className="flex-1 overflow-y-auto no-sb px-5 pt-6 pb-8" style={{ animation: slideAnim }}>
        {/* 질문 */}
        <h2 className="text-[24px] font-bold text-slate-900 leading-snug mb-1.5" style={{ whiteSpace: "pre-line" }}>
          {current.question}
        </h2>
        <p className="text-[13px] text-slate-400 mb-6">{current.hint}</p>

        {/* 인풋 타입별 */}
        {current.type === "input" && (
          <input
            autoFocus
            value={name} onChange={e => setName(e.target.value)}
            placeholder={current.placeholder}
            className="w-full text-[16px] text-slate-800 placeholder-slate-300 outline-none pb-3 border-b-2 border-slate-200 focus:border-slate-900 transition-colors bg-transparent"
          />
        )}

        {current.type === "textarea" && (
          <div>
            <textarea
              autoFocus
              value={reason} onChange={e => setReason(e.target.value.slice(0, 200))}
              placeholder={current.placeholder}
              rows={5}
              className="w-full text-[15px] text-slate-800 placeholder-slate-300 outline-none resize-none bg-transparent border-b-2 border-slate-200 focus:border-slate-900 transition-colors pb-2"
            />
            <div className="flex justify-end mt-1">
              <span className={`text-[12px] ${reason.length > 160 ? "text-slate-700" : "text-slate-300"}`}>
                {reason.length} / 200
              </span>
            </div>
          </div>
        )}

        {current.type === "details" && (
          <div className="space-y-6">
            {/* 카테고리 */}
            <div>
              <p className="text-[13px] font-semibold text-slate-600 mb-2.5">카테고리 <span className="text-[#FF3355]">*</span></p>
              <div className="grid grid-cols-3 gap-2">
                {categories.map(c => {
                  const CatIcon = CAT_ICON[c] ?? Sparkles;
                  return (
                    <button
                      key={c}
                      onClick={() => setCategory(category === c ? null : c)}
                      className={`inline-flex items-center justify-center gap-1 py-2.5 rounded-xl text-[12px] font-semibold border transition-all active:scale-95 ${
                        category === c
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-600 border-slate-200"
                      }`}
                    >
                      <CatIcon className="w-3.5 h-3.5" strokeWidth={2.2} />
                      {c.split("/")[0]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 기간 */}
            <div>
              <p className="text-[13px] font-semibold text-slate-600 mb-2.5">챌린지 기간 <span className="text-[#FF3355]">*</span></p>
              <div className="flex gap-2">
                {durations.map(d => (
                  <button
                    key={d}
                    onClick={() => setDuration(duration === d ? null : d)}
                    className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold border transition-all active:scale-95 ${
                      duration === d
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-600 border-slate-200"
                    }`}
                  >{d}</button>
                ))}
              </div>
            </div>

            {/* 인증 방법 */}
            <div>
              <p className="text-[13px] font-semibold text-slate-600 mb-1">인증 방법 <span className="text-slate-400 font-normal">(선택)</span></p>
              <input
                value={verifyMethod}
                onChange={e => setVerifyMethod(e.target.value)}
                placeholder="예) 완료 사진 또는 영상"
                className="w-full text-[15px] text-slate-800 placeholder-slate-300 outline-none pb-3 border-b-2 border-slate-200 focus:border-slate-900 transition-colors bg-transparent"
              />
            </div>

            {/* 커버 사진 */}
            <div>
              <p className="text-[13px] font-semibold text-slate-600 mb-2">커버 사진 <span className="text-slate-400 font-normal">(선택)</span></p>
              {coverPreview ? (
                <div className="relative w-full h-40 rounded-2xl overflow-hidden">
                  <img src={coverPreview} alt="커버 미리보기" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={removeCover}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 w-full h-32 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer text-slate-400 active:bg-slate-50 transition-colors">
                  <ImageIcon className="w-6 h-6" />
                  <span className="text-[13px]">사진 선택</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
                </label>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 네비 버튼 */}
      <div className="px-5 pb-8 pt-3 flex gap-3 bg-white border-t border-slate-100">
        {error && <p className="absolute left-5 right-5 -top-8 text-center text-[12px] text-red-500 font-semibold">{error}</p>}
        {step > 0 && (
          <button
            onClick={goBack}
            className="px-5 py-3.5 rounded-2xl bg-slate-100 text-slate-600 font-bold text-[14px] active:scale-[0.97] transition-transform"
          >
            이전
          </button>
        )}
        <button
          onClick={goNext}
          disabled={!canNext || submitting}
          className={`flex-1 py-3.5 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2 active:scale-[0.97] transition-all ${
            canNext ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400"
          }`}
        >
          {submitting ? "저장 중..." : isLast ? <>건의 제출하기 <Mail className="w-4 h-4" strokeWidth={2.2} /></> : <>다음 <ArrowRight className="w-4 h-4" /></>}
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   상세 뷰
════════════════════════════════════════ */
function DetailView({
  suggestion, onBack, onCheer, onComment, onSubscribe,
}: {
  suggestion: Suggestion;
  onBack: () => void;
  onCheer: (id: string, next: boolean) => Promise<void> | void;
  onComment: (id: string, body: string) => Promise<void>;
  onSubscribe: (id: string, next: boolean) => Promise<void> | void;
}) {
  const [heartAnim, setHeartAnim] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [barW, setBarW]           = useState(0);

  const meta      = STATUS_META[suggestion.status];
  const cheered = !!suggestion.hasCheered;
  const notifyOn = !!suggestion.notifyOn;
  const comments = suggestion.commentList;
  const voteCount = suggestion.votes;
  const pct       = Math.min((voteCount / 200) * 100, 100);

  useEffect(() => {
    const t = setTimeout(() => setBarW(Math.min((suggestion.progress / 200) * 100, 100)), 100);
    return () => clearTimeout(t);
  }, []);

  function handleCheer() {
    void onCheer(suggestion.id, !cheered);
    setHeartAnim(true);
    setTimeout(() => setHeartAnim(false), 500);
  }

  async function submitComment() {
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    await onComment(suggestion.id, commentText.trim());
    setCommentText("");
    setSubmittingComment(false);
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-white" style={{ animation: "g-fade 0.3s ease both" }}>
      <div className="flex-1 overflow-y-auto no-sb pb-28">
        <div className="px-4 pt-4">

          {/* 상태 */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 text-[13px] font-bold px-3 py-1.5 rounded-full"
              style={{ color: meta.color, background: meta.bg }}
            >
              <meta.Icon className="w-3.5 h-3.5" strokeWidth={2.4} />
              {meta.label}
            </span>
            {(() => {
              const CatIcon = CAT_ICON[suggestion.category] ?? Sparkles;
              return (
                <span className="inline-flex items-center gap-1 text-[12px] text-slate-400 bg-slate-100 px-2.5 py-1.5 rounded-full">
                  <CatIcon className="w-3 h-3" strokeWidth={2.2} />
                  {suggestion.category}
                </span>
              );
            })()}
            <span className="inline-flex items-center gap-1 text-[12px] text-slate-400 bg-slate-100 px-2.5 py-1.5 rounded-full">
              <Calendar className="w-3 h-3" strokeWidth={2.2} />
              {suggestion.duration}
            </span>
          </div>

          <h1 className="text-[22px] font-bold text-slate-900 leading-snug mb-2">{suggestion.title}</h1>
          <p className="text-[14px] text-slate-500 leading-relaxed">{suggestion.desc}</p>

          {suggestion.verifyMethod && (
            <p className="text-[13px] text-slate-400 mt-2 mb-1">
              <span className="font-semibold text-slate-500">인증 방법</span> — {suggestion.verifyMethod}
            </p>
          )}

          <p className="text-[12px] text-slate-400 mt-1 mb-5">{suggestion.daysAgo} 건의</p>

          {/* 통계 */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            {[
              { label: "응원",   value: `${voteCount}명`, accent: true },
              { label: "댓글",   value: `${comments.length}개`, accent: false },
              { label: "공감률", value: `${suggestion.agreeRate}%`, accent: false },
            ].map(s => (
              <div
                key={s.label}
                className="rounded-xl p-3 text-center"
                style={{ background: s.accent ? "rgba(255,51,85,0.05)" : "#f8f9fa" }}
              >
                <p className="text-[18px] font-bold leading-none mb-1" style={{ color: s.accent ? "#FF3355" : "#475569" }}>
                  {s.value}
                </p>
                <p className="text-[11px] text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>

          {/* 진행 바 (투표중) */}
          {suggestion.status === "투표중" && (
            <div className="mb-5 rounded-xl bg-slate-50 p-4">
              <div className="flex justify-between text-[12px] mb-2">
                <span className="text-slate-600">
                  <span className="font-bold text-slate-800">{Math.max(200 - voteCount, 0)}명</span> 더 응원하면 만들어져요!
                </span>
                <span className="text-slate-400">{Math.round(pct)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${barW}%`,
                    background: "linear-gradient(90deg, #FF3355, #ff8099)",
                    transition: "width 0.8s cubic-bezier(0.22,1,0.36,1)",
                  }}
                />
              </div>
            </div>
          )}

          {/* 개발 확정 */}
          {suggestion.status === "개발확정" && (
            <div className="rounded-xl p-4 mb-5 bg-emerald-50 border border-emerald-100">
              <div className="flex items-center gap-2 mb-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <p className="text-[14px] font-bold text-emerald-800">지금 만들고 있어요!</p>
              </div>
              <p className="text-[13px] text-emerald-700 leading-relaxed mb-3 inline-flex items-center gap-1">출시되면 제일 먼저 알려드릴게요 <PartyPopper className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2.4} /></p>
              <button
                onClick={() => void onSubscribe(suggestion.id, !notifyOn)}
                className={`w-full py-2.5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.97] ${
                  notifyOn ? "bg-emerald-600 text-white" : "bg-white text-emerald-700 border border-emerald-200"
                }`}
              >
                <Bell className="w-4 h-4" />
                {notifyOn ? <>알림 신청됨 <Check className="w-3.5 h-3.5" strokeWidth={2.6} /></> : "출시 알림 받기"}
              </button>
            </div>
          )}

          {/* 운영자 코멘트 */}
          {suggestion.operatorComment && (
            <div className="rounded-xl p-4 mb-5 bg-amber-50 border border-amber-100">
              <p className="text-[11px] font-bold text-amber-500 uppercase tracking-wide mb-1.5">운영팀 코멘트</p>
              <p className="text-[13px] text-amber-900 leading-relaxed">"{suggestion.operatorComment}"</p>
              <p className="text-[11px] text-amber-400 mt-2">운영팀 · 2일 전</p>
            </div>
          )}

          {/* 응원 버튼 */}
          {suggestion.status === "투표중" && (
            <button
              onClick={handleCheer}
              className="w-full py-4 rounded-2xl font-bold text-[16px] flex items-center justify-center gap-2 mb-5 transition-colors active:opacity-80"
              style={{
                background: cheered ? "#FF3355" : "rgba(255,51,85,0.06)",
                color: cheered ? "white" : "#FF3355",
                border: cheered ? "none" : "1.5px solid rgba(255,51,85,0.18)",
              }}
            >
              <Heart
                className="w-5 h-5"
                fill={cheered ? "white" : "none"}
                style={{ animation: heartAnim ? "g-heart 0.45s ease" : "none" }}
              />
              {cheered ? `응원 중이에요! · ${voteCount}` : `응원하기 · ${voteCount}명`}
            </button>
          )}

          {/* 댓글 */}
          <div>
            <p className="text-[13px] font-bold text-slate-500 mb-3">댓글 {comments.length}</p>
            <div className="flex flex-col gap-3 mb-4">
              {comments.map((c, i) => (
                <div key={c.id} className="flex items-start gap-2.5" style={{ animation: `g-fade 0.2s ease ${i * 40}ms both` }}>
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[13px] font-bold text-slate-500 shrink-0">
                    {c.name}
                  </div>
                  <div className="flex-1 bg-slate-50 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                    <p className="text-[13px] text-slate-700 leading-relaxed">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 댓글 입력 */}
      <div className="px-4 pb-6 pt-3 border-t border-slate-100 bg-white">
        <div
          className="flex items-center gap-2 rounded-2xl px-4 py-2.5 transition-all"
          style={{ background: "#f8f9fa", border: commentText ? "1.5px solid #1e293b" : "1.5px solid #ebebeb" }}
        >
          <input
            value={commentText} onChange={e => setCommentText(e.target.value)}
            placeholder="응원 한마디 남겨요 :)"
            className="flex-1 bg-transparent text-[14px] text-slate-700 placeholder-slate-400 outline-none"
            onKeyDown={e => e.key === "Enter" && submitComment()}
          />
          <button
            onClick={submitComment}
            disabled={submittingComment}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 ${
              commentText.trim() ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-400"
            }`}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   메인
════════════════════════════════════════ */
type View = "list" | "new" | "detail";

export function ChallengeRequest() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [view, setView]         = useState<View>("list");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [shareState, setShareState] = useState<"idle" | "shared" | "copied">("idle");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const suggestion = detailId ? suggestions.find(s => s.id === detailId) : null;

  useEffect(() => {
    void loadSuggestions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function loadSuggestions() {
    setLoading(true);
    setLoadError("");
    const { data: suggestionRows, error } = await supabase
      .from("challenge_suggestions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setLoadError(error.message);
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const ids = (suggestionRows ?? []).map(s => s.id);
    const [{ data: commentRows }, { data: voteRows }, { data: subscriptionRows }] = await Promise.all([
      ids.length
        ? supabase.from("challenge_suggestion_comments").select("*").in("suggestion_id", ids).order("created_at", { ascending: true })
        : Promise.resolve({ data: [] as ChallengeSuggestionCommentRecord[] }),
      user && ids.length
        ? supabase.from("challenge_suggestion_votes").select("suggestion_id").eq("user_id", user.id).in("suggestion_id", ids)
        : Promise.resolve({ data: [] as { suggestion_id: string }[] }),
      user && ids.length
        ? supabase.from("challenge_suggestion_subscriptions").select("suggestion_id").eq("user_id", user.id).in("suggestion_id", ids)
        : Promise.resolve({ data: [] as { suggestion_id: string }[] }),
    ]);

    const votedIds = new Set((voteRows ?? []).map(v => v.suggestion_id));
    const subscribedIds = new Set((subscriptionRows ?? []).map(v => v.suggestion_id));
    setSuggestions((suggestionRows ?? []).map(row =>
      mapSuggestion(row, commentRows ?? [], user?.id, votedIds, subscribedIds)
    ));
    setLoading(false);
  }

  function requireUser() {
    if (!user) {
      navigate("/login");
      return false;
    }
    return true;
  }

  async function createSuggestion(params: {
    title: string;
    description: string;
    category: Category;
    duration: Duration;
    verifyMethod?: string | null;
    coverFile?: File | null;
  }) {
    if (!user) throw new Error("로그인 후 건의할 수 있어요.");

    let coverUrl: string | null = null;
    if (params.coverFile) {
      const ext = params.coverFile.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("suggestion-covers")
        .upload(path, params.coverFile, { contentType: params.coverFile.type });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage
        .from("suggestion-covers")
        .getPublicUrl(path);
      coverUrl = publicUrl;
    }

    const { data, error } = await supabase
      .from("challenge_suggestions")
      .insert({
        title: params.title,
        description: params.description,
        category: params.category,
        duration: params.duration,
        verify_method: params.verifyMethod,
        cover_url: coverUrl,
        created_by: user.id,
      })
      .select("*")
      .single();
    if (error) throw error;
    setSuggestions(prev => [
      mapSuggestion(data, [], user.id),
      ...prev,
    ]);
  }

  async function toggleCheer(id: string, next: boolean) {
    if (!requireUser()) return;
    setSuggestions(prev => prev.map(s => s.id === id ? {
      ...s,
      hasCheered: next,
      votes: Math.max(0, s.votes + (next ? 1 : -1)),
      progress: Math.max(0, s.progress + (next ? 1 : -1)),
    } : s));

    const { error } = next
      ? await supabase.from("challenge_suggestion_votes").insert({ suggestion_id: id, user_id: user!.id })
      : await supabase.from("challenge_suggestion_votes").delete().eq("suggestion_id", id).eq("user_id", user!.id);
    if (error) {
      await loadSuggestions();
      return;
    }
  }

  async function addComment(id: string, body: string) {
    if (!user) {
      navigate("/login");
      return;
    }
    const { data, error } = await supabase
      .from("challenge_suggestion_comments")
      .insert({
        suggestion_id: id,
        user_id: user.id,
        author_name: profile?.username ?? "나",
        body,
      })
      .select("*")
      .single();
    if (error) throw error;
    setSuggestions(prev => prev.map(s => s.id === id ? {
      ...s,
      comments: s.comments + 1,
      commentList: [...s.commentList, { id: data.id, name: data.author_name ?? "나", text: data.body }],
    } : s));
  }

  async function toggleSubscription(id: string, next: boolean) {
    if (!requireUser()) return;
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, notifyOn: next } : s));
    const { error } = next
      ? await supabase.from("challenge_suggestion_subscriptions").insert({ suggestion_id: id, user_id: user!.id })
      : await supabase.from("challenge_suggestion_subscriptions").delete().eq("suggestion_id", id).eq("user_id", user!.id);
    if (error) await loadSuggestions();
  }

  function handleBack() {
    if (view === "list") navigate(-1);
    else setView("list");
  }

  async function shareSuggestion() {
    if (!suggestion) return;
    const status = await shareOrCopy({
      title: suggestion.title,
      text: `챌리에서 "${suggestion.title}" 챌린지를 응원해 주세요.`,
      url: `${window.location.origin}/challenge/request?suggestion=${suggestion.id}`,
    });
    setShareState(status);
    setTimeout(() => setShareState("idle"), 1800);
  }

  const titles: Record<View, string> = { list: "건의함", new: "건의하기", detail: "건의 내용" };

  return (
    <div className="flex flex-col h-full bg-white">
      <header className="shrink-0 bg-white px-4 pt-3 pb-2.5 flex items-center justify-between border-b border-slate-100">
        <button
          onClick={handleBack}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 active:bg-slate-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h1 className="text-[20px] font-black text-slate-900 tracking-tight">{titles[view]}</h1>
        <div className="w-9 h-9 flex items-center justify-center">
          {view === "detail" && (
            <button
              onClick={shareSuggestion}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 active:bg-slate-200 transition-colors"
              title={shareState === "idle" ? "공유" : "공유 완료"}
            >
              {shareState === "idle" ? <Share2 className="w-4 h-4 text-slate-600" /> : <CheckCircle className="w-4 h-4 text-emerald-600" />}
            </button>
          )}
        </div>
      </header>

      {loadError && view === "list" && (
        <p className="bg-red-50 px-4 py-2 text-center text-[12px] font-semibold text-red-500">{loadError}</p>
      )}
      {view === "list"   && <ListView suggestions={suggestions} loading={loading} onNew={() => setView("new")} onDetail={id => { setDetailId(id); setView("detail"); }} onCheer={toggleCheer} />}
      {view === "new"    && <NewRequestView onBack={() => setView("list")} onCreate={createSuggestion} />}
      {view === "detail" && suggestion && <DetailView suggestion={suggestion} onBack={() => setView("list")} onCheer={toggleCheer} onComment={addComment} onSubscribe={toggleSubscription} />}
    </div>
  );
}
