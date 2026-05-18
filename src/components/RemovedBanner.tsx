import { useEffect } from "react";
import { useApp } from "../contexts/AppContext";

const AUTO_DISMISS_MS = 5000;

export function RemovedBanner() {
  const { recentRemovals, dismissRemoval } = useApp();
  const current = recentRemovals[0];

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => dismissRemoval(current.dbId), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [current?.dbId, dismissRemoval]);

  if (!current) return null;

  return (
    <div className="absolute top-0 left-0 right-0 z-[400] px-3 pt-3 pointer-events-none">
      <style>{`
        @keyframes rb-slide-down {
          from { opacity: 0; transform: translateY(-110%); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-2xl pointer-events-auto"
        style={{
          background: "rgba(255,51,85,0.95)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          boxShadow: "0 8px 24px rgba(255,51,85,0.35)",
          animation: "rb-slide-down 0.32s cubic-bezier(0.34,1.56,0.64,1) both",
        }}
      >
        <span className="text-[20px] leading-none shrink-0">🚪</span>
        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-[13px] leading-tight truncate">
            '{current.groupName}'에서 퇴장됐어요
          </p>
          <p className="text-white/80 text-[11px] mt-0.5">72시간 미인증으로 자동 퇴장</p>
        </div>
      </div>
    </div>
  );
}
