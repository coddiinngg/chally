import type React from "react";
import { CheckCircle2, Trophy, Users, Star, Flame, Bell, BellRing, AlertTriangle, LogOut, Zap, Flag, Timer } from "lucide-react";
import type { NotifType } from "../contexts/AppContext";

/** 알림 타입별 아이콘/색상. 알림 페이지·홈 알림 피크에서 공통 사용. */
export const NOTIF_ICON: Record<NotifType, React.ElementType> = {
  goal:               CheckCircle2,
  badge:              Star,
  group:              Users,
  rank:               Trophy,
  streak:             Flame,
  member_warning:     AlertTriangle,
  member_removed:     LogOut,
  challenge_start:    Zap,
  challenge_end:      Flag,
  challenge_dday:     Timer,
  daily_reminder:     Bell,
  challenge_reopened: BellRing,
};

export const NOTIF_COLOR: Record<NotifType, string> = {
  goal:               "#10B981",
  badge:              "#F59E0B",
  group:              "#6366F1",
  rank:               "#F97316",
  streak:             "#FB923C",
  member_warning:     "#D97706",
  member_removed:     "#FF3355",
  challenge_start:    "#FF3355",
  challenge_end:      "#6366F1",
  challenge_dday:     "#F97316",
  daily_reminder:     "#0EA5E9",
  challenge_reopened: "#FF3355",
};

export const NOTIF_BG: Record<NotifType, string> = {
  goal:               "#ECFDF5",
  badge:              "#FFFBEB",
  group:              "#EEF2FF",
  rank:               "#FFF7ED",
  streak:             "#FFF7ED",
  member_warning:     "#FFFBEB",
  member_removed:     "#FFF1F2",
  challenge_start:    "#FFF0F3",
  challenge_end:      "#EEF2FF",
  challenge_dday:     "#FFF7ED",
  daily_reminder:     "#F0F9FF",
  challenge_reopened: "#FFF0F3",
};
