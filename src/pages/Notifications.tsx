import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, CheckCircle2, Trophy, Users, Star, Flame, Bell, Check, X, AlertTriangle, LogOut, Zap, Flag, Timer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";
import { useApp, type NotifType, type AppNotification } from "../contexts/AppContext";
import { useScrollRestoration, isReturningVisit } from "../lib/useScrollRestoration";

const TYPE_ICON: Record<NotifType, React.ElementType> = {
  goal:            CheckCircle2,
  badge:           Star,
  group:           Users,
  rank:            Trophy,
  streak:          Flame,
  member_warning:  AlertTriangle,
  member_removed:  LogOut,
  challenge_start: Zap,
  challenge_end:   Flag,
  challenge_dday:  Timer,
  daily_reminder:  Bell,
};

const TYPE_COLOR: Record<NotifType, string> = {
  goal:            "#10B981",
  badge:           "#F59E0B",
  group:           "#6366F1",
  rank:            "#F97316",
  streak:          "#FB923C",
  member_warning:  "#D97706",
  member_removed:  "#FF3355",
  challenge_start: "#FF3355",
  challenge_end:   "#6366F1",
  challenge_dday:  "#F97316",
  daily_reminder:  "#0EA5E9",
};

const TYPE_BG: Record<NotifType, string> = {
  goal:            "#ECFDF5",
  badge:           "#FFFBEB",
  group:           "#EEF2FF",
  rank:            "#FFF7ED",
  streak:          "#FFF7ED",
  member_warning:  "#FFFBEB",
  member_removed:  "#FFF1F2",
  challenge_start: "#FFF0F3",
  challenge_end:   "#EEF2FF",
  challenge_dday:  "#FFF7ED",
  daily_reminder:  "#F0F9FF",
};

export function Notifications() {
  const navigate = useNavigate();
  const { notifications, notificationsLoading, markNotifRead, markAllNotifsRead, handleNotifAction } = useApp();
  const [mounted, setMounted] = useState(() => isReturningVisit("nt-scroll"));
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollRestoration("nt-scroll", scrollRef, !notificationsLoading);

  useEffect(() => {
    if (mounted) return;
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;
  const unread = notifications.filter(n => !n.read);
  const read   = notifications.filter(n => n.read);

  return (
    <div className="flex flex-col h-full bg-[#F8F8FA] overflow-hidden">
      <style>{`@keyframes nf-in { from{opacity:0;transform:translateX(-10px);}to{opacity:1;transform:translateX(0);} }`}</style>

      {/* 헤더 */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-3 bg-white border-b border-black/[0.05]">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 active:bg-slate-200 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-700" />
        </button>
        <div className="flex items-center gap-2">
          <h1 className="text-[17px] font-black text-slate-900">알림</h1>
          {unreadCount > 0 && (
            <span className="bg-[#FF3355] text-white text-[11px] font-black px-2 py-0.5 rounded-full min-w-[20px] text-center">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 ? (
          <button
            onClick={() => void markAllNotifsRead()}
            className="text-[12px] font-bold text-[#FF3355]"
          >
            모두 읽음
          </button>
        ) : (
          <div className="w-14" />
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">

        {/* 읽지 않은 알림 */}
        {unread.length > 0 && (
          <div className="px-4 pt-4 pb-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 ml-1 mb-2">새 알림</p>
            <div className="space-y-2">
              {unread.map((n, i) => (
                <NotifCard
                  key={n.id}
                  n={n}
                  index={i}
                  mounted={mounted}
                  isUnread
                  onRead={() => void markNotifRead(n.id)}
                  onAccept={() => void handleNotifAction(n.id, true)}
                  onReject={() => void handleNotifAction(n.id, false)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 읽은 알림 */}
        {read.length > 0 && (
          <div className="px-4 pt-4 pb-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 ml-1 mb-2">이전 알림</p>
            <div className="space-y-1.5">
              {read.map((n, i) => (
                <NotifCard
                  key={n.id}
                  n={n}
                  index={i + unread.length}
                  mounted={mounted}
                  isUnread={false}
                  onRead={() => void markNotifRead(n.id)}
                  onAccept={() => void handleNotifAction(n.id, true)}
                  onReject={() => void handleNotifAction(n.id, false)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 비어있음 */}
        {!notificationsLoading && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
              <Bell className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-[15px] font-bold text-slate-400">알림이 없어요</p>
          </div>
        )}

        {/* 로딩 */}
        {notificationsLoading && notifications.length === 0 && (
          <div className="flex justify-center py-24">
            <div className="w-6 h-6 rounded-full border-2 border-[#FF3355] border-t-transparent animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}

function NotifCard({
  n, index, mounted, isUnread, onRead, onAccept, onReject, key: _key,
}: {
  n: AppNotification;
  index: number;
  mounted: boolean;
  isUnread: boolean;
  onRead: () => void;
  onAccept: () => void;
  onReject: () => void;
  key?: React.Key;
}) {
  const Icon = TYPE_ICON[n.type];

  if (isUnread) {
    return (
      <div
        className="w-full bg-white rounded-2xl px-4 py-3.5 border border-[#FFD6DC] text-left"
        style={{
          opacity: mounted ? 1 : 0,
          animation: `nf-in 0.35s ease ${index * 50}ms both`,
          boxShadow: "0 2px 12px rgba(255,51,85,0.08)",
        }}
      >
        <button
          className="w-full flex items-start gap-3 active:opacity-70 transition-opacity"
          onClick={onRead}
        >
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: TYPE_BG[n.type] }}
          >
            {n.emoji ? (
              <span className="text-lg">{n.emoji}</span>
            ) : (
              <Icon style={{ color: TYPE_COLOR[n.type], width: 18, height: 18 }} />
            )}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-[13px] font-black text-slate-900">{n.title}</p>
              <div className="w-2 h-2 rounded-full bg-[#FF3355] shrink-0" />
            </div>
            <p className="text-[12px] text-slate-500 leading-snug">{n.body}</p>
            <p className="text-[11px] text-slate-400 mt-1 font-semibold">{n.time}</p>
          </div>
        </button>
        {n.actionable && !n.actionDone && (
          <div className="flex gap-2 mt-3" style={{ paddingLeft: 52 }}>
            <button
              onClick={onAccept}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#FF3355] text-white text-[13px] font-bold active:scale-95 transition-all"
              style={{ boxShadow: "0 4px 12px rgba(255,51,85,0.3)" }}
            >
              <Check className="w-3.5 h-3.5" />
              수락
            </button>
            <button
              onClick={onReject}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-100 text-slate-500 text-[13px] font-bold active:scale-95 transition-all"
            >
              <X className="w-3.5 h-3.5" />
              거절
            </button>
          </div>
        )}
        {n.actionable && n.actionDone && (
          <p className="text-[11px] text-slate-400 mt-2 font-semibold" style={{ paddingLeft: 52 }}>
            {n.actionResult === "rejected" ? "거절 완료" : "수락 완료"}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex items-start gap-3 bg-white rounded-2xl px-4 py-3 border border-black/[0.04]"
      style={{
        opacity: mounted ? 0.85 : 0,
        transform: mounted ? "translateX(0)" : "translateX(-8px)",
        transition: `opacity 0.4s ease ${index * 40 + 100}ms, transform 0.4s ease ${index * 40 + 100}ms`,
      }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 opacity-60"
        style={{ background: TYPE_BG[n.type] }}
      >
        {n.emoji ? (
          <span className="text-base">{n.emoji}</span>
        ) : (
          <Icon style={{ color: TYPE_COLOR[n.type], width: 16, height: 16 }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-bold text-slate-500">{n.title}</p>
        <p className="text-[12px] text-slate-400 leading-snug mt-0.5">{n.body}</p>
        <p className="text-[10px] text-slate-300 mt-0.5 font-semibold">{n.time}</p>
      </div>
    </div>
  );
}
