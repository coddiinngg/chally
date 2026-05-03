import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, X, ChevronRight, CheckCircle2, ImageIcon } from "lucide-react";
import { cn } from "../lib/utils";
import { useApp } from "../contexts/AppContext";

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

function PhotoCard({ grad, label, photoUrl, size }: {
  grad: string[]; label: string; photoUrl: string | null;
  size: "xs" | "sm" | "md" | "lg";
}) {
  const fs = size === "xs" ? "text-[7px]" : size === "sm" ? "text-[10px]" : size === "md" ? "text-[13px]" : "text-[15px]";
  const ic = size === "xs" ? 10 : size === "sm" ? 16 : size === "md" ? 24 : 32;

  if (photoUrl) {
    return (
      <div className="absolute inset-0">
        <img src={photoUrl} alt={label} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        <div className="absolute bottom-0 left-0 right-0 px-1 pb-1 pt-4"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent)" }}>
          <p className={cn("text-white font-bold truncate leading-tight", fs)}>{label}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${grad[0]}, ${grad[1]})` }}>
      <div className="absolute inset-0 opacity-25"
        style={{ backgroundImage: "radial-gradient(circle at 28% 28%, rgba(255,255,255,0.8) 0%, transparent 55%)" }} />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <CheckCircle2 style={{ width: ic, height: ic, color: "rgba(255,255,255,0.7)" }} strokeWidth={1.8} />
      </div>
      <div className="absolute bottom-0 left-0 right-0 px-1 pb-1 pt-3"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent)" }}>
        <p className={cn("text-white font-bold truncate leading-tight", fs)}>{label}</p>
      </div>
    </div>
  );
}

export function Gallery() {
  const navigate = useNavigate();
  const { verificationHistory } = useApp();
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [cols, setCols] = useState(3);
  const [filter, setFilter] = useState("전체");
  const [mounted, setMounted] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const wheelAcc = useRef(0);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swiping, setSwiping]         = useState(false);
  const [scale, setScale]             = useState(1);
  const [panX, setPanX]               = useState(0);
  const [panY, setPanY]               = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const touch = useRef({
    startX: 0, startY: 0,
    startPanX: 0, startPanY: 0,
    startScale: 1,
    pinchDist: 0,
    lastTap: 0,
    tapX: 0, tapY: 0,
    isPinching: false,
  });

  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t); }, []);

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
    setLightbox(idx); setScale(1); setPanX(0); setPanY(0); setSwipeOffset(0);
  }
  function closeLightbox() {
    setLightbox(null); setScale(1); setPanX(0); setPanY(0);
  }
  function goNext() {
    if (lightbox === null || lightbox >= filtered.length - 1) return;
    setIsAnimating(true);
    setSwipeOffset(-window.innerWidth);
    setTimeout(() => { setLightbox(l => (l ?? 0) + 1); setSwipeOffset(0); setScale(1); setPanX(0); setPanY(0); setIsAnimating(false); }, 280);
  }
  function goPrev() {
    if (lightbox === null || lightbox <= 0) return;
    setIsAnimating(true);
    setSwipeOffset(window.innerWidth);
    setTimeout(() => { setLightbox(l => (l ?? 0) - 1); setSwipeOffset(0); setScale(1); setPanX(0); setPanY(0); setIsAnimating(false); }, 280);
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
      if (swipeOffset < -60)     { goNext(); setSwiping(false); return; }
      else if (swipeOffset > 60) { goPrev(); setSwiping(false); return; }
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
    <div className="flex flex-col h-full bg-[#0A0A0A] overflow-hidden">
      <style>{`
        @keyframes gl-down { from{opacity:0;transform:translateY(-10px);}to{opacity:1;transform:translateY(0);} }
        @keyframes gl-cell { from{opacity:0;transform:scale(0.88);}to{opacity:1;transform:scale(1);} }
        @keyframes gl-lb   { from{opacity:0;transform:scale(0.94);}to{opacity:1;transform:scale(1);} }
        @keyframes gl-bg   { from{opacity:0;}to{opacity:1;} }
        @keyframes gl-view { from{opacity:0;transform:scale(0.96);}to{opacity:1;transform:scale(1);} }
        @keyframes gl-year-in { from{opacity:0;transform:scale(0.9) translateY(20px);}to{opacity:1;transform:scale(1) translateY(0);} }
      `}</style>

      {/* 헤더 */}
      <div
        className="shrink-0 flex items-center justify-between px-4 pt-12 pb-3 border-b border-white/[0.06]"
        style={{ animation: "gl-down 0.4s ease both" }}
      >
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>

        <div className="text-center">
          <h1 className="text-[16px] font-black text-white transition-all duration-300">
            {VIEW_LABELS[viewMode]}
          </h1>
          <p className="text-[11px] text-white/30 mt-0.5">{filtered.length}장</p>
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
                filter === f ? "bg-[#FF3355] text-white shadow-[0_4px_12px_rgba(255,51,85,0.4)]" : "bg-white/10 text-white/50"
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
            <div className="w-16 h-16 rounded-2xl bg-white/[0.06] flex items-center justify-center">
              <ImageIcon className="w-7 h-7 text-white/25" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="text-white/50 font-bold text-[15px]">아직 인증 사진이 없어요</p>
              <p className="text-white/25 text-[13px] mt-1 leading-relaxed">
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
                  <span className="text-[12px] font-bold text-white/40">{label} · {dateStr}</span>
                  <div className="flex-1 h-px bg-white/[0.07]" />
                  <span className="text-[11px] text-white/20">{items.length}</span>
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
                        <PhotoCard grad={photo.grad} label={photo.label} photoUrl={photo.photoUrl} size={cardSize} />
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
                  <span className="text-[26px] font-black text-white leading-none">{month}월</span>
                  <span className="text-[13px] text-white/40">{year}년</span>
                  <div className="flex-1" />
                  <span className="text-[12px] text-white/30 font-semibold">{items.length}장</span>
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
                        <PhotoCard grad={photo.grad} label={photo.label} photoUrl={photo.photoUrl} size="xs" />
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
                  <span className="text-[32px] font-black text-white leading-none">{year}</span>
                  <span className="text-[13px] text-white/40">총 {items.length}장</span>
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
          className="fixed inset-0 z-50 flex flex-col bg-black"
          style={{ animation: "gl-bg 0.2s ease both" }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div
            className="shrink-0 flex items-center justify-between px-5 pt-12 pb-4 z-10"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)" }}
          >
            <div>
              <p className="text-white/40 text-[11px] font-bold">
                {dayLabel(item.year, item.month, item.day)} · {item.month}월 {item.day}일
              </p>
              <p className="text-white text-[15px] font-bold mt-0.5">{item.label}</p>
            </div>
            <button
              onClick={closeLightbox}
              className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center active:bg-white/25 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          <div className="flex-1 relative flex items-center justify-center overflow-hidden">
            {lightbox > 0 && (
              <div className="absolute inset-0 flex items-center justify-center"
                style={{ transform: `translateX(calc(-100% + ${swipeOffset}px))`, opacity: swipeOffset > 0 ? 1 : 0, transition: "none" }}>
                <div className="w-4/5 aspect-square rounded-3xl overflow-hidden">
                  <PhotoCard grad={filtered[lightbox - 1].grad} label={filtered[lightbox - 1].label} photoUrl={filtered[lightbox - 1].photoUrl} size="lg" />
                </div>
              </div>
            )}
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                transform: `translateX(${swipeOffset}px)`,
                transition: swiping ? "none" : "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
              }}
            >
              <div
                className="w-4/5 aspect-square rounded-3xl overflow-hidden relative"
                style={{
                  transform: `scale(${scale}) translate(${panX / scale}px, ${panY / scale}px)`,
                  transition: scale === 1 && !swiping ? "transform 0.3s cubic-bezier(0.34,1.2,0.64,1)" : "none",
                  boxShadow: "0 30px 80px rgba(0,0,0,0.7)",
                  animation: "gl-lb 0.35s cubic-bezier(0.34,1.2,0.64,1) both",
                }}
              >
                <PhotoCard grad={item.grad} label={item.label} photoUrl={item.photoUrl} size="lg" />
                {scale === 1 && (
                  <div className="absolute top-3 right-3 bg-black/30 backdrop-blur-sm rounded-full px-2 py-1">
                    <p className="text-white/60 text-[10px] font-semibold">두 손가락으로 확대</p>
                  </div>
                )}
                {scale > 1 && (
                  <div className="absolute top-3 left-3 bg-black/30 backdrop-blur-sm rounded-full px-2 py-1">
                    <p className="text-white text-[10px] font-bold">{scale.toFixed(1)}×</p>
                  </div>
                )}
              </div>
            </div>
            {lightbox < filtered.length - 1 && (
              <div className="absolute inset-0 flex items-center justify-center"
                style={{ transform: `translateX(calc(100% + ${swipeOffset}px))`, opacity: swipeOffset < 0 ? 1 : 0, transition: "none" }}>
                <div className="w-4/5 aspect-square rounded-3xl overflow-hidden">
                  <PhotoCard grad={filtered[lightbox + 1].grad} label={filtered[lightbox + 1].label} photoUrl={filtered[lightbox + 1].photoUrl} size="lg" />
                </div>
              </div>
            )}
          </div>

          <div
            className="shrink-0 pb-14 pt-4 z-10"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)" }}
          >
            <div className="flex items-center justify-between px-8 mb-5">
              <button
                onClick={goPrev}
                disabled={lightbox === 0}
                className="w-12 h-12 rounded-full bg-white/10 border border-white/10 flex items-center justify-center active:bg-white/20 transition-colors disabled:opacity-20"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
              <div className="flex items-center gap-1.5 overflow-hidden max-w-[160px]">
                {filtered.map((_, i) => {
                  const dist = Math.abs(i - lightbox);
                  if (dist > 4) return null;
                  return (
                    <button key={i} onClick={() => openLightbox(i)} style={{
                      width: i === lightbox ? 22 : dist <= 1 ? 6 : 4,
                      height: i === lightbox ? 6 : dist <= 1 ? 6 : 4,
                      borderRadius: 999,
                      background: i === lightbox ? "#FF3355" : "rgba(255,255,255,0.25)",
                      transition: "all 0.25s cubic-bezier(0.34,1.2,0.64,1)",
                      flexShrink: 0,
                    }} />
                  );
                })}
              </div>
              <button
                onClick={goNext}
                disabled={lightbox === filtered.length - 1}
                className="w-12 h-12 rounded-full bg-white/10 border border-white/10 flex items-center justify-center active:bg-white/20 transition-colors disabled:opacity-20"
              >
                <ChevronRight className="w-5 h-5 text-white" />
              </button>
            </div>
            <p className="text-center text-white/30 text-[12px] font-semibold">
              {lightbox + 1} / {filtered.length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
