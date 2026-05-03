import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";

export function Layout({ showNav = true }: { showNav?: boolean }) {
  return (
    <div
      className="app-shell relative flex flex-1 w-full flex-col bg-white dark:bg-[#090B10] text-slate-900 dark:text-slate-100 font-display overflow-hidden max-w-md mx-auto"
    >
      <Outlet />
      {showNav && <BottomNav />}
    </div>
  );
}
