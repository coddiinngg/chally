import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft, X, ChevronRight, CheckCircle2, ImageIcon, Share2 } from "lucide-react";
import { cn } from "../lib/utils";
import { useApp } from "../contexts/AppContext";
import { shareOrCopy } from "../lib/share";
import { supabase } from "../lib/supabase";
import { useScrollRestoration, isReturningVisit, usePersistedState, usePersistedNumber } from "../lib/useScrollRestoration";

type ViewMode = "grid" | "month" | "year";

type Photo = {
  id: string;
  label: string;
  year: number;
  month: number;
  day: number;
  grad: [string, string];
  photoUrl: string | null;
};

const GRADS: [string, string][] = [
  ["#FF3355", "#FF6680"],
  ["#38BDF8", "#0EA5E9"],
  ["#FB923C", "#F59E0B"],
  ["#A78BFA", "#7C3AED"],
  ["#34d399", "#059669"],
];

function dayLabel(year: number, month: number, day: number): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(year, month - 1, day);
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "오늘";
  if (diff === 1) return "어제";
  if (diff < 8) return `${diff}일 전`;
  return `${month}월 ${day}일`;
}

function getPinchDist(t: React.TouchList) {
  const dx = t[0].clientX - t[1].clientX;
  const dy = t[0].clientY - t[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function PhotoCard({ grad, photoUrl, size }: {
  grad: string[]; photoUrl: string | null;
  size: "xs" | "sm" | "md" | "lg";
}) {
  const ic = size === "xs" ? 10 : size === "sm" ? 16 : size === "md" ? 24 : 32;

  if (photoUrl) {
    return (
      <div className="absolute inset-0">
        <img src={photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${grad[0]}, ${grad[1]})` }}>
      <div className="absolute inset-0 opacity-25"
        style={{ backgroundImage: "radial-gradient(circle at 28% 28%, rgba(255,255,255,0.8) 0%, transparent 55%)" }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <CheckCircle2 style={{ width: ic, height: ic, color: "rgba(255,255,255,0.7)" }} strokeWidth={1.8} />
      </div>
    </div>
  );
}

export function Gallery() {
  const navigate = useNavigate();
  const { state: locationState } = useLocation() as { state: { openId?: string } | null };
  const { verificationHistory, verificationLoading } = useApp();
  const [viewMode, setViewMode] = usePersistedState<ViewMode>(
    "gl-view", "grid",
    (v): v is ViewMode => v === "grid" || v === "month" || v === "year",
  );
  const [cols, setCols] = usePersistedNumber("gl-cols", 3);
  const [filter, setFilter] = usePersistedState<string>("gl-filter", "전체");
  const [mounted, setMounted] = useState(() => isReturningVisit("gl-scroll"));
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [reactionMap, setReactionMap] = useState<Map<string, number>>(new Map());
  const wheelAcc = useRef(0);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  useScrollRestoration("gl-scroll", gridRef, !verificationLoading);

  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swiping, setSwiping]         = useState(false);
  const [scale, setScale]             = useState(1);
  const [panX, setPanX]               = useState(0);
  const [panY, setPanY]               = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isSwapping, setIsSwapping]   = useState(false);
  const [shareState, setShareState]   = useState<"idle"|"shared"|"copied">("idle");

  // 처음 열 때만 scale 애니메이션 적용 (탐색 시 제외)
  const lightboxJustOpenedRef = useRef(false);
  const lightboxJustOpenedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const touch = useRef({
    startX: 0, startY: 0,
    startPanX: 0, startPanY: 0,
    startScale: 1,
    pinchDist: 0,
    lastTap: 0,
    tapX: 0, tapY: 0,
    isPinching: false,
    startTime: 0,
  });

  useEffect(() => { if (mounted) return; const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t); }, []);

  // 인증별 좋아요 수 로드
  useEffect(() => {
    const ids = verificationHistory.filter(v => v.status === "completed").map(v => v.id);
    if (!ids.length) return;
    void (async () => {
      const { data: posts } = await supabase
        .from("activity_posts")
        .select("id, verification_id")
        .in("verification_id", ids);
      if (!posts?.length) return;
      const postIds = posts.map(p => p.id);
      const { data: reactions } = await supabase
        .from("activity_reactions")
        .select("activity_post_id")
        .in("activity_post_id", postIds);
      const countByPost = new Map<string, number>();
      (reactions ?? []).forEach(r => countByPost.set(r.activity_post_id, (countByPost.get(r.activity_post_id) ?? 0) + 1));
      const map = new Map<string, number>();
      posts.forEach(p => { if (p.verification_id) map.set(p.verification_id, countByPost.get(p.id) ?? 0); });
      setReactionMap(map);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificationHistory.length]);

  const ALL_PHOTOS: Photo[] = verificationHistory
    .filter(v => v.status === "completed")
    .map((v, i) => {
      const d = new Date(v.verified_at);
      return {
        id: v.id,
        label: "챌린지 인증",
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        day: d.getDate(),
        grad: GRADS[i % GRADS.length],
        photoUrl: v.photo_url ?? null,
      };
    });

  // 동적 필터 목록
  const labelSet = [...new Set(ALL_PHOTOS.map(p => p.label))];
  const FILTERS = ["전체", ...labelSet];

  // ctrl+wheel 줌 → viewMode 전환
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      wheelAcc.current += e.deltaY;
      if (wheelTimer.current) clearTimeout(wheelTimer.current);
      wheelTimer.current = setTimeout(() => { wheelAcc.current = 0; }, 200);
      const THRESH = 40;
      if (wheelAcc.current > THRESH) {
        wheelAcc.current = 0;
        if (viewMode === "grid") {
          if (cols < 5) setCols(c => Math.min(5, c + 1));
          else          setViewMode("month");
        } else if (viewMode === "month") {
          setViewMode("year");
        }
      } else if (wheelAcc.current < -THRESH) {
        wheelAcc.current = 0;
        if (viewMode === "year") {
          setViewMode("month");
        } else if (viewMode === "month") {
          setViewMode("grid");
          setCols(5);
        } else {
          setCols(c => Math.max(1, c - 1));
        }
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [viewMode, cols]);

  const filtered = (filter === "전체" ? ALL_PHOTOS : ALL_PHOTOS.filter(p => p.label === filter))
    .slice().sort((a, b) => {
      const da = new Date(a.year, a.month - 1, a.day).getTime();
      const db = new Date(b.year, b.month - 1, b.day).getTime();
      return db - da;
    });

  const dateKey  = (p: Photo) => `${p.year}-${String(p.month).padStart(2,"0")}-${String(p.day).padStart(2,"0")}`;
  const monthKey = (p: Photo) => `${p.year}-${String(p.month).padStart(2,"0")}`;

  const gridGroups = [...new Set(filtered.map(dateKey))].map(key => {
    const items = filtered.filter(p => dateKey(p) === key);
    const { year, month, day } = items[0];
    const label = dayLabel(year, month, day);
    return { key, label, dateStr: `${month}월 ${day}일`, items };
  });

  const monthGroups = [...new Set(filtered.map(monthKey))].map(key => {
    const items = filtered.filter(p => monthKey(p) === key);
    const [yr, mo] = key.split("-").map(Number);
    return { key, year: yr, month: mo, items };
  });

  const yearGroups = [...new Set(filtered.map(p => p.year))].sort((a, b) => b - a).map(yr => {
    const items = filtered.filter(p => p.year === yr);
    const months = [...new Set(items.map(p => p.month))].sort((a, b) => b - a).map(mo => ({
      month: mo,
      items: items.filter(p => p.month === mo),
    }));
    return { year: yr, items, months };
  });

  const cardSize: "xs"|"sm"|"md"|"lg" = cols >= 4 ? "xs" : cols === 3 ? "sm" : cols === 2 ? "md" : "lg";
  const gap = cols >= 4 ? 1 : cols === 3 ? 2 : 3;

  function openLightbox(idx: number) {
    if (lightboxJustOpenedTimer.current) clearTimeout(lightboxJustOpenedTimer.current);
    lightboxJustOpenedRef.current = true;
    setLightbox(idx); setScale(1); setPanX(0); setPanY(0); setSwipeOffset(0);
    lightboxJustOpenedTimer.current = setTimeout(() => { lightboxJustOpenedRef.current = false; }, 400);
  }

  // Stats 페이지 썸네일 탭 → 특정 사진 자동 오픈
  useEffect(() => {
    if (!locationState?.openId || !mounted) return;
    const idx = filtered.findIndex(p => p.id === locationState.openId);
    if (idx !== -1) openLightbox(idx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, locationState?.openId]);
  // 라이트박스 변경 시 썸네일 스트립 자동 스크롤
  useEffect(() => {
    if (lightbox === null || !thumbsRef.current) return;
    const container = thumbsRef.current;
    const thumbs = container.querySelectorAll<HTMLButtonElement>("button");
    const thumb = thumbs[lightbox];
    if (!thumb) return;
    const containerRect = container.getBoundingClientRect();
    const thumbRect = thumb.getBoundingClientRect();
    const thumbRelLeft = thumbRect.left - containerRect.left + container.scrollLeft;
    container.scrollTo({ left: thumbRelLeft - containerRect.width / 2 + thumbRect.width / 2, behavior: "smooth" });
  }, [lightbox]);

  function closeLightbox() {
    setLightbox(null); setScale(1); setPanX(0); setPanY(0);
  }
  function goNext() {
    if (lightbox === null || lightbox >= filtered.length - 1) return;
    lightboxJustOpenedRef.current = false;
    setIsAnimating(true);
    setSwipeOffset(-window.innerWidth);
    setTimeout(() => {
      setIsSwapping(true);
      setLightbox(l => (l ?? 0) + 1);
      setSwipeOffset(0); setScale(1); setPanX(0); setPanY(0);
      setIsAnimating(false);
      requestAnimationFrame(() => { requestAnimationFrame(() => setIsSwapping(false)); });
    }, 280);
  }
  function goPrev() {
    if (lightbox === null || lightbox <= 0) return;
    lightboxJustOpenedRef.current = false;
    setIsAnimating(true);
    setSwipeOffset(window.innerWidth);
    setTimeout(() => {
      setIsSwapping(true);
      setLightbox(l => (l ?? 0) - 1);
      setSwipeOffset(0); setScale(1); setPanX(0); setPanY(0);
      setIsAnimating(false);
      requestAnimationFrame(() => { requestAnimationFrame(() => setIsSwapping(false)); });
    }, 280);
  }

  async function shareCurrentPhoto() {
    if (!item?.photoUrl) return;
    const status = await shareOrCopy({ title: "챌리 인증 사진", text: "챌린지 인증 사진을 공유해요!", url: item.photoUrl });
    setShareState(status);
    setTimeout(() => setShareState("idle"), 1800);
  }

  function onTouchStart(e: React.TouchEvent) {
    if (isAnimating) return;
    const t = e.touches;
    if (t.length === 2) {
      touch.current.isPinching = true;
      touch.current.pinchDist  = getPinchDist(t);
      touch.current.startScale = scale;
      touch.current.startPanX  = panX;
      touch.current.startPanY  = panY;
    } else {
      touch.current.isPinching = false;
      touch.current.startX = t[0].clientX;
      touch.current.startY = t[0].clientY;
      touch.current.startPanX = panX;
      touch.current.startPanY = panY;
      touch.current.startTime = Date.now();
      const now = Date.now();
      const dx  = Math.abs(t[0].clientX - touch.current.tapX);
      const dy  = Math.abs(t[0].clientY - touch.current.tapY);
      if (now - touch.current.lastTap < 300 && dx < 30 && dy < 30) {
        if (scale > 1) { setScale(1); setPanX(0); setPanY(0); }
        else           { setScale(2.5); }
        touch.current.lastTap = 0;
      } else {
        touch.current.lastTap = now;
        touch.current.tapX    = t[0].clientX;
        touch.current.tapY    = t[0].clientY;
      }
      setSwiping(scale === 1);
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (isAnimating) return;
    const t = e.touches;
    if (t.length === 2 && touch.current.isPinching) {
      const dist     = getPinchDist(t);
      const newScale = Math.min(4, Math.max(1, touch.current.startScale * (dist / touch.current.pinchDist)));
      setScale(newScale);
      if (newScale === 1) { setPanX(0); setPanY(0); }
    } else if (t.length === 1) {
      const dx = t[0].clientX - touch.current.startX;
      const dy = t[0].clientY - touch.current.startY;
      if (scale > 1) {
        setPanX(touch.current.startPanX + dx);
        setPanY(touch.current.startPanY + dy);
      } else {
        setSwipeOffset(dx);
      }
    }
  }

  function onTouchEnd() {
    if (isAnimating) return;
    touch.current.isPinching = false;
    if (scale <= 1) {
      const elapsed = Math.max(1, Date.now() - touch.current.startTime);
      const velocity = swipeOffset / elapsed; // px/ms
      const shouldGoNext = swipeOffset < -40 || velocity < -0.35;
      const shouldGoPrev = swipeOffset >  40 || velocity >  0.35;
      if (shouldGoNext)      { goNext(); setSwiping(false); return; }
      else if (shouldGoPrev) { goPrev(); setSwiping(false); return; }
      setSwipeOffset(0);
      setSwiping(false);
    }
  }

  const item = lightbox !== null ? filtered[lightbox] : null;

  const VIEW_LABELS: Record<ViewMode, string> = {
    grid:  "인증 갤러리",
    month: "월별 보기",
    year:  "연도별 보기",
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0A0A0A] overflow-hidden">
      <style>{`
        @keyframes gl-down { from{opacity:0;transform:translateY(-10px);}to{opacity:1;transform:translateY(0);} }
        @keyframes gl-cell { from{opacity:0;transform:scale(0.88);}to{opacity:1;transform:scale(1);} }
        @keyframes gl-lb   { from{opacity:0;}to{opacity:1;} }
        @keyframes gl-bg   { from{opacity:0;}to{opacity:1;} }
        @keyframes gl-view { from{opacity:0;transform:scale(0.96);}to{opacity:1;transform:scale(1);} }
        @keyframes gl-year-in { from{opacity:0;transform:scale(0.9) translateY(20px);}to{opacity:1;transform:scale(1) translateY(0);} }
      `}</style>

      {/* 헤더 */}
      <div
        className="shrink-0 flex items-center justify-between px-4 pt-4 pb-2 border-b border-slate-100 dark:border-white/[0.06]"
        style={{ animation: "gl-down 0.4s ease both" }}
      >
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-white/10 active:bg-slate-200 dark:active:bg-white/20 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-700 dark:text-white" />
        </button>

        <div className="text-center">
          <h1 className="text-[20px] font-black text-slate-900 dark:text-white tracking-tight transition-all duration-300">
            {VIEW_LABELS[viewMode]}
          </h1>
          <p className="text-[11px] text-slate-400 dark:text-white/30 mt-0.5">{filtered.length}장</p>
        </div>

        <div className="w-10 flex items-center justify-end gap-1">
          {(["grid", "month", "year"] as ViewMode[]).map(m => (
            <button
              key={m}
              onClick={() => {
                if (m === "grid") { setViewMode("grid"); setCols(3); }
                else setViewMode(m);
              }}
              className={cn(
                "rounded-full transition-all duration-300",
                viewMode === m ? "w-3.5 h-2 bg-[#FF3355]" : "w-1.5 h-1.5 bg-white/20"
              )}
            />
          ))}
        </div>
      </div>

      {/* 필터 */}
      {FILTERS.length > 1 && (
        <div
          className="shrink-0 flex gap-2 px-4 py-2.5 overflow-x-auto no-scrollbar border-b border-white/[0.05]"
          style={{ animation: "gl-down 0.4s ease 60ms both" }}
        >
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap shrink-0 transition-all duration-200",
                filter === f ? "bg-[#FF3355] text-white shadow-[0_4px_12px_rgba(255,51,85,0.4)]" : "bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-white/50"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* 콘텐츠 영역 */}
      <div ref={gridRef} className="flex-1 overflow-y-auto">

        {/* ── 빈 상태 ── */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-8"
            style={{ animation: "gl-view 0.4s ease both" }}>
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center">
              <ImageIcon className="w-7 h-7 text-slate-300 dark:text-white/25" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="text-slate-500 dark:text-white/50 font-bold text-[15px]">아직 인증 사진이 없어요</p>
              <p className="text-slate-400 dark:text-white/25 text-[13px] mt-1 leading-relaxed">
                챌린지에 참여하고 첫 인증을 남겨보세요
              </p>
            </div>
          </div>
        )}

        {/* ── 그리드 뷰 ── */}
        {viewMode === "grid" && filtered.length > 0 && (
          <div key="grid" className="p-3 space-y-5 pb-6" style={{ animation: "gl-view 0.3s ease both" }}>
            {gridGroups.map(({ key, label, dateStr, items }, gi) => (
              <div key={key} style={{
                opacity: mounted ? 1 : 0,
                transform: mounted ? "translateY(0)" : "translateY(16px)",
                transition: `opacity 0.5s ease ${gi * 80}ms, transform 0.5s ease ${gi * 80}ms`,
              }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[12px] font-bold text-slate-400 dark:text-white/40">{label} · {dateStr}</span>
                  <div className="flex-1 h-px bg-slate-100 dark:bg-white/[0.07]" />
                  <span className="text-[11px] text-slate-300 dark:text-white/20">{items.length}</span>
                </div>
                <div className="grid" style={{
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  gap: `${gap * 4}px`,
                  transition: "grid-template-columns 0.35s cubic-bezier(0.4,0,0.2,1)",
                }}>
                  {items.map((photo, ii) => {
                    const globalIdx = filtered.indexOf(photo);
                    return (
                      <button
                        key={photo.id}
                        onClick={() => openLightbox(globalIdx)}
                        className="relative overflow-hidden active:scale-95 transition-transform duration-150"
                        style={{
                          aspectRatio: "1",
                          borderRadius: cols === 1 ? 16 : cols === 2 ? 14 : 10,
                          animation: `gl-cell 0.4s cubic-bezier(0.34,1.2,0.64,1) ${(gi * 5 + ii) * 40 + 80}ms both`,
                        }}
                      >
                        <PhotoCard grad={photo.grad} photoUrl={photo.photoUrl} size={cardSize} />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── 월별 뷰 ── */}
        {viewMode === "month" && filtered.length > 0 && (
          <div key="month" className="p-4 space-y-6 pb-6" style={{ animation: "gl-view 0.3s ease both" }}>
            {monthGroups.map(({ key, year, month, items }, mi) => (
              <div key={key} style={{
                opacity: mounted ? 1 : 0,
                transform: mounted ? "translateY(0)" : "translateY(20px)",
                transition: `opacity 0.45s ease ${mi * 60}ms, transform 0.45s ease ${mi * 60}ms`,
              }}>
                <div className="flex items-baseline gap-2 mb-2.5">
                  <span className="text-[26px] font-black text-slate-900 dark:text-white leading-none">{month}월</span>
                  <span className="text-[13px] text-slate-400 dark:text-white/40">{year}년</span>
                  <div className="flex-1" />
                  <span className="text-[12px] text-slate-400 dark:text-white/30 font-semibold">{items.length}장</span>
                </div>
                <div className="grid grid-cols-7 gap-0.5 rounded-xl overflow-hidden">
                  {items.map((photo, ii) => {
                    const globalIdx = filtered.indexOf(photo);
                    return (
                      <button
                        key={photo.id}
                        onClick={() => openLightbox(globalIdx)}
                        className="relative overflow-hidden active:opacity-70 transition-opacity"
                        style={{
                          aspectRatio: "1",
                          animation: `gl-cell 0.35s cubic-bezier(0.34,1.2,0.64,1) ${(mi * 7 + ii) * 25 + 60}ms both`,
                        }}
                      >
                        <PhotoCard grad={photo.grad} photoUrl={photo.photoUrl} size="xs" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── 연도별 뷰 ── */}
        {viewMode === "year" && filtered.length > 0 && (
          <div key="year" className="p-4 space-y-8 pb-6" style={{ animation: "gl-view 0.3s ease both" }}>
            {yearGroups.map(({ year, items, months }, yi) => (
              <div key={year} style={{
                opacity: mounted ? 1 : 0,
                transform: mounted ? "translateY(0)" : "translateY(24px)",
                transition: `opacity 0.5s ease ${yi * 80}ms, transform 0.5s ease ${yi * 80}ms`,
              }}>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-[32px] font-black text-slate-900 dark:text-white leading-none">{year}</span>
                  <span className="text-[13px] text-slate-400 dark:text-white/40">총 {items.length}장</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {months.map(({ month, items: mItems }, mi) => (
                    <button
                      key={month}
                      onClick={() => setViewMode("month")}
                      className="relative rounded-2xl overflow-hidden active:scale-95 transition-transform duration-150 bg-white/[0.06]"
                      style={{
                        aspectRatio: "0.85",
                        animation: `gl-year-in 0.4s cubic-bezier(0.34,1.2,0.64,1) ${(yi * 12 + mi) * 40 + 80}ms both`,
                      }}
                    >
                      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-px">
                        {mItems.slice(0, 4).map((p) => (
                          <div key={p.id} className="overflow-hidden relative">
                            {p.photoUrl
                              ? <img src={p.photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              : <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${p.grad[0]}, ${p.grad[1]})` }} />
                            }
                          </div>
                        ))}
                        {mItems.length < 4 && Array.from({ length: 4 - mItems.length }).map((_, ei) => (
                          <div key={`empty-${ei}`} className="bg-white/5" />
                        ))}
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      <div className="absolute bottom-0 inset-x-0 px-2 pb-2">
                        <p className="text-white text-[13px] font-black leading-none">{month}월</p>
                        <p className="text-white/50 text-[10px] mt-0.5">{mItems.length}장</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* ── 라이트박스 ── */}
      {item && lightbox !== null && (
        <div
          className="fixed inset-0 z-50 bg-white dark:bg-black"
          style={{ animation: "gl-bg 0.2s ease both" }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* 헤더 — 날짜 + 공유 + 닫기 */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 pt-4 pb-3 z-20 bg-gradient-to-b from-white/85 dark:from-black/70 to-transparent">
            <div className="flex items-center gap-2">
              <p className="text-slate-600 dark:text-white/60 text-[12px] font-bold">
                {dayLabel(item.year, item.month, item.day)} · {item.month}월 {item.day}일
              </p>
              {(reactionMap.get(item.id) ?? 0) > 0 && (
                <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-white/15 backdrop-blur-sm rounded-full px-2 py-0.5">
                  <span className="text-[12px] leading-none">👍</span>
                  <span className="text-slate-700 dark:text-white text-[11px] font-black tabular-nums">{reactionMap.get(item.id)}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={shareCurrentPhoto}
                className="flex items-center gap-1.5 px-3 h-9 rounded-full bg-slate-100 dark:bg-white/15 active:bg-slate-200 dark:active:bg-white/25 transition-colors"
              >
                <Share2 className="w-4 h-4 text-slate-700 dark:text-white/85" />
                <span className="text-slate-700 dark:text-white/85 text-[12px] font-semibold">
                  {shareState === "copied" ? "복사됨" : shareState === "shared" ? "완료" : "공유"}
                </span>
              </button>
              <button
                onClick={closeLightbox}
                className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/15 flex items-center justify-center active:bg-slate-200 dark:active:bg-white/25 transition-colors"
              >
                <X className="w-5 h-5 text-slate-700 dark:text-white" />
              </button>
            </div>
          </div>

          {/* 메인 이미지 영역 — 틀 없이 원본 비율 그대로 */}
          <div className="absolute inset-0 top-[64px] bottom-[152px] overflow-hidden">
            {/* 이전 이미지 */}
            {lightbox > 0 && (
              <div className="absolute inset-0 flex items-center justify-center px-3 opacity-70"
                style={{
                  transform: `translate3d(calc(-100% + ${swipeOffset}px), 0, 0)`,
                  transition: (swiping || isSwapping) ? "none" : "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
                  willChange: "transform",
                }}>
                {filtered[lightbox - 1].photoUrl
                  ? <img src={filtered[lightbox - 1].photoUrl!} alt="" className="block max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                  : <div className="w-[240px] h-[240px] rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${filtered[lightbox - 1].grad[0]}, ${filtered[lightbox - 1].grad[1]})` }}>
                      <CheckCircle2 className="w-12 h-12 text-white/70" strokeWidth={1.8} />
                    </div>
                }
              </div>
            )}
            {/* 현재 이미지 */}
            <div
              className="absolute inset-0 flex items-center justify-center px-3"
              style={{
                transform: `translate3d(${swipeOffset}px, 0, 0)`,
                transition: (swiping || isSwapping) ? "none" : "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
                willChange: "transform",
              }}
            >
              {item.photoUrl
                ? <img
                    src={item.photoUrl}
                    alt=""
                    className="block max-w-full max-h-full object-contain"
                    style={{
                      transform: `scale(${scale}) translate(${panX / scale}px, ${panY / scale}px)`,
                      transition: (scale === 1 && !swiping && !isSwapping) ? "transform 0.3s cubic-bezier(0.4,0,0.2,1)" : "none",
                      willChange: "transform",
                      ...(lightboxJustOpenedRef.current ? { animation: "gl-lb 0.25s ease both" } : {}),
                    }}
                    referrerPolicy="no-referrer"
                  />
                : <div
                    className="w-[260px] h-[260px] rounded-2xl flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${item.grad[0]}, ${item.grad[1]})`,
                      transform: `scale(${scale}) translate(${panX / scale}px, ${panY / scale}px)`,
                      transition: (scale === 1 && !swiping && !isSwapping) ? "transform 0.3s cubic-bezier(0.4,0,0.2,1)" : "none",
                    }}>
                    <CheckCircle2 className="w-14 h-14 text-white/70" strokeWidth={1.8} />
                  </div>
              }
              {scale > 1 && (
                <div className="absolute top-3 left-4 bg-black/35 backdrop-blur-sm rounded-full px-2 py-1">
                  <p className="text-white text-[10px] font-bold">{scale.toFixed(1)}×</p>
                </div>
              )}
            </div>
            {/* 다음 이미지 */}
            {lightbox < filtered.length - 1 && (
              <div className="absolute inset-0 flex items-center justify-center px-3 opacity-70"
                style={{
                  transform: `translate3d(calc(100% + ${swipeOffset}px), 0, 0)`,
                  transition: (swiping || isSwapping) ? "none" : "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
                  willChange: "transform",
                }}>
                {filtered[lightbox + 1].photoUrl
                  ? <img src={filtered[lightbox + 1].photoUrl!} alt="" className="block max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                  : <div className="w-[240px] h-[240px] rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${filtered[lightbox + 1].grad[0]}, ${filtered[lightbox + 1].grad[1]})` }}>
                      <CheckCircle2 className="w-12 h-12 text-white/70" strokeWidth={1.8} />
                    </div>
                }
              </div>
            )}
          </div>

          {/* 썸네일 스트립 */}
          <div
            ref={thumbsRef}
            className="absolute left-0 right-0 overflow-x-auto no-scrollbar z-20"
            style={{ bottom: 84, height: 60 }}
            onTouchStart={e => e.stopPropagation()}
            onTouchMove={e => e.stopPropagation()}
            onTouchEnd={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-1.5 px-4 h-full">
              {filtered.map((photo, i) => (
                <button
                  key={photo.id}
                  onClick={() => openLightbox(i)}
                  className="shrink-0 rounded-xl overflow-hidden transition-all duration-200"
                  style={{
                    width: 48,
                    height: 48,
                    opacity: i === lightbox ? 1 : 0.4,
                    transform: i === lightbox ? "scale(1.12)" : "scale(1)",
                    outline: i === lightbox ? "2px solid currentColor" : "2px solid transparent",
                    outlineOffset: "2px",
                    color: "var(--lb-thumb-outline)",
                  }}
                >
                  {photo.photoUrl
                    ? <img src={photo.photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    : <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${photo.grad[0]}, ${photo.grad[1]})` }} />
                  }
                </button>
              ))}
            </div>
          </div>

          {/* 하단 네비게이션 — 이전/다음 + 카운트 */}
          <div
            className="absolute bottom-0 left-0 right-0 pt-3 pb-8 z-20 bg-gradient-to-t from-white/90 via-white/55 dark:from-black/85 dark:via-black/55 to-transparent"
          >
            <div className="flex items-center justify-between px-5">
              <button
                onClick={goPrev}
                disabled={lightbox === 0}
                className="w-11 h-11 rounded-full bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 flex items-center justify-center active:bg-slate-200 dark:active:bg-white/20 transition-colors disabled:opacity-25"
              >
                <ChevronLeft className="w-5 h-5 text-slate-700 dark:text-white" />
              </button>
              <p className="text-slate-500 dark:text-white/50 text-[12px] font-semibold tabular-nums">
                {lightbox + 1} / {filtered.length}
              </p>
              <button
                onClick={goNext}
                disabled={lightbox === filtered.length - 1}
                className="w-11 h-11 rounded-full bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 flex items-center justify-center active:bg-slate-200 dark:active:bg-white/20 transition-colors disabled:opacity-25"
              >
                <ChevronRight className="w-5 h-5 text-slate-700 dark:text-white" />
              </button>
            </div>
          </div>

          <style>{`
            .dark { --lb-thumb-outline: rgba(255,255,255,0.85); }
            :root { --lb-thumb-outline: rgba(15,23,42,0.7); }
          `}</style>
        </div>
      )}
    </div>
  );
}
