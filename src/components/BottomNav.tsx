import { Link, useLocation } from "react-router-dom";
import { Home, Trophy, BarChart2, User } from "lucide-react";
import { cn } from "../lib/utils";

const navItems = [
  { icon: Home,      label: "홈",    href: "/" },
  { icon: Trophy,    label: "챌린지", href: "/challenge" },
  { icon: BarChart2, label: "통계",  href: "/stats" },
  { icon: User,      label: "프로필", href: "/profile" },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav
      className="shrink-0 bg-white/95 dark:bg-[#11141B]/96 backdrop-blur-md border-t border-slate-100/80 dark:border-white/[0.07] px-2 pt-1.5 z-50"
      style={{ boxShadow: "0 -1px 0 rgba(0,0,0,0.04)", paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-col items-center gap-1 py-1 px-3 transition-all duration-200",
                isActive ? "text-[#FF3355] dark:text-[#FF6B83]" : "text-slate-400 dark:text-slate-500 active:text-slate-600 dark:active:text-slate-300"
              )}
            >
              <div className={cn(
                "w-10 h-8 flex items-center justify-center rounded-xl transition-all duration-200",
                isActive ? "bg-[#FFE8EC] dark:bg-[#3A1620]" : "bg-transparent"
              )}>
                <Icon
                  className="w-5 h-5 transition-all duration-200"
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
              </div>
              <span className={cn(
                "text-[10px] leading-none tracking-tight",
                isActive ? "font-bold" : "font-medium"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
