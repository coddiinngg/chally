import React, { useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { RemovedBanner } from "./RemovedBanner";

const TAB_PATHS = ["/", "/challenge", "/stats", "/profile"];

export function Layout({ showNav = true }: { showNav?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const x = e.touches[0].clientX;
    const w = window.innerWidth;
    if (x < w * 0.25 || x > w * 0.75) {
      touchStartX.current = x;
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const idx = TAB_PATHS.indexOf(location.pathname);
    if (idx === -1) return;
    if (dx < 0 && idx < TAB_PATHS.length - 1) navigate(TAB_PATHS[idx + 1]);
    else if (dx > 0 && idx > 0) navigate(TAB_PATHS[idx - 1]);
  };

  return (
    <div
      className="app-shell relative flex flex-1 w-full flex-col bg-white dark:bg-[#090B10] text-slate-900 dark:text-slate-100 font-display overflow-hidden max-w-md mx-auto"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <Outlet />
      <RemovedBanner />
      {showNav && <BottomNav />}
    </div>
  );
}
