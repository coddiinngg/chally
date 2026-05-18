import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { VERIFY_TYPE_KEYS, type VerifyTypeKey } from "../lib/verifyTypes";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import type {
  Verification as DbVerification,
  Group as DbGroup,
  NotificationRecord,
} from "../types/database";

/* ── 그룹 타입 ── */
export interface Group {
  id: string;
  dbId?: string;
  title: string;
  desc: string;
  members: number;
  category: string;
  joined: boolean;
  isRemoved: boolean;       // 강제 퇴장 (REMOVED)
  isLeft: boolean;          // 자발적 탈퇴 (LEFT) — 재참여 불가
  isExitEligible: boolean;  // 48h 미인증 경고 (EXIT_ELIGIBLE) — 인증하면 ACTIVE 복귀
  rule: string;
  goal: string;
  verifyType: VerifyTypeKey;
  cover: string;
  recruitStart: string | null;
  recruitEnd: string | null;
  challengeStart: string | null;
  challengeEnd: string | null;
  crewRate: number;
  crewGrade: string;
}


function legacyGroupId(row: DbGroup) {
  return row.legacy_id ?? row.id;
}

function mapDbGroup(
  row: DbGroup,
  joinedDbIds: Set<string>,
  removedDbIds: Set<string>,
  leftDbIds: Set<string>,
  exitEligibleDbIds: Set<string>,
): Group {
  return {
    id: legacyGroupId(row),
    dbId: row.id,
    title: row.name,
    desc: row.description ?? "",
    members: row.member_count,
    category: row.category ?? "기타",
    joined: joinedDbIds.has(row.id),
    isRemoved: removedDbIds.has(row.id),
    isLeft: leftDbIds.has(row.id),
    isExitEligible: exitEligibleDbIds.has(row.id),
    rule: row.rule ?? "",
    goal: row.goal ?? "",
    verifyType: (VERIFY_TYPE_KEYS.includes(row.verify_type as VerifyTypeKey)
      ? row.verify_type
      : "step_walk") as VerifyTypeKey,

    cover: row.cover ?? "",
    recruitStart: row.recruit_start ?? null,
    recruitEnd: row.recruit_end ?? null,
    challengeStart: row.challenge_start ?? null,
    challengeEnd: row.challenge_end ?? null,
    crewRate: Math.round((row.crew_rate ?? 0) * 100),
    crewGrade: row.crew_grade ?? "D",
  };
}

/* ── 알림 타입 ── */
export type NotifType = "goal" | "badge" | "group" | "rank" | "streak" | "member_warning" | "member_removed" | "challenge_start" | "challenge_end" | "challenge_dday" | "daily_reminder" | "challenge_reopened";

export interface AppNotification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  time: string;
  read: boolean;
  emoji?: string;
  actionable: boolean;
  actionDone: boolean;
  actionResult?: "accepted" | "rejected";
  relatedId?: string | null;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d === 1) return "어제";
  if (d < 7) return `${d}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

function mapDbNotif(row: NotificationRecord): AppNotification {
  return {
    id: row.id,
    type: row.type as NotifType,
    title: row.title,
    body: row.body,
    time: formatRelativeTime(row.created_at),
    read: row.read_at !== null,
    emoji: row.emoji ?? undefined,
    actionable: row.actionable,
    actionDone: row.action_done,
    relatedId: row.related_id,
  };
}

function dateKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function computeCurrentStreak(verifications: DbVerification[]) {
  const completedDays = new Set(
    verifications
      .filter(item => item.status === "completed")
      .map(item => dateKey(item.verified_at))
  );

  const cursor = startOfToday();
  if (!completedDays.has(dateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (completedDays.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/* ── 종료 확인 localStorage 헬퍼 ── */
const CONFIRMED_ENDED_KEY = "chally-confirmed-ended";

function loadConfirmedEnded(): Set<string> {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(CONFIRMED_ENDED_KEY) ?? "[]") as string[]);
  } catch {
    return new Set<string>();
  }
}

interface AppContextType {
  theme: "light" | "dark" | "system";
  setTheme: (t: "light" | "dark" | "system") => void;
  nickname: string;
  setNickname: (n: string) => void;
  participationTickets: number;
  // Verification
  verifyType: VerifyTypeKey | null;
  setVerifyType: (t: VerifyTypeKey | null) => void;
  verificationGroupId: string | null;
  verificationImageUrl: string | null;
  verificationImageFile: File | null;
  verificationHistory: DbVerification[];
  verificationLoading: boolean;
  beginVerification: (params: { verifyType?: VerifyTypeKey | null; groupId?: string | null }) => void;
  setVerificationImage: (file: File | null) => void;
  completeCurrentVerification: (serverPhotoUrl?: string | null) => void;
  clearVerification: () => void;
  refreshVerifications: () => Promise<void>;
  // Groups
  groups: Group[];
  groupsLoading: boolean;
  groupsLoadError: boolean;
  refreshGroups: () => Promise<void>;
  joinGroup: (id: string) => void;
  leaveGroup: (id: string) => void;
  markGroupLeft: (dbId: string) => void;
  selectedGroupId: string;
  setSelectedGroupId: (id: string) => void;
  // 종료 확인
  confirmedEndedIds: Set<string>;
  confirmEndedGroup: (id: string) => void;
  // 재개설 알림 신청 — group_id (uuid/dbId) 기준
  reopenNotifyIds: Set<string>;
  toggleReopenNotify: (dbId: string) => void;
  // Notifications
  notifications: AppNotification[];
  notificationsLoading: boolean;
  latestNotification: AppNotification | null;
  markNotifRead: (id: string) => Promise<void>;
  markAllNotifsRead: () => Promise<void>;
  handleNotifAction: (id: string, accepted?: boolean) => Promise<void>;
  reloadNotifications: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, profile, refreshProfile } = useAuth();
  const [theme, setThemeState] = useState<"light" | "dark" | "system">(() => {
    if (typeof window === "undefined") return "light";
    const saved = window.localStorage.getItem("chally-theme");
    return saved === "dark" || saved === "system" || saved === "light" ? saved : "light";
  });

  const setTheme = (nextTheme: "light" | "dark" | "system") => {
    setThemeState(nextTheme);
    window.localStorage.setItem("chally-theme", nextTheme);
  };

  useEffect(() => {
    const apply = (isDark: boolean) =>
      document.documentElement.classList.toggle("dark", isDark);

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      apply(mq.matches);
      const handler = (e: MediaQueryListEvent) => apply(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    } else {
      apply(theme === "dark");
    }
  }, [theme]);

  const [nickname, setNickname] = useState("이름");
  const [participationTickets, setParticipationTickets] = useState(5);
  const [verifyType, setVerifyType] = useState<VerifyTypeKey | null>(null);
  const [verificationGroupId, setVerificationGroupId] = useState<string | null>(null);
  const [verificationImageUrl, setVerificationImageUrl] = useState<string | null>(null);
  const [verificationImageFile, setVerificationImageFile] = useState<File | null>(null);
  const [verificationHistory, setVerificationHistory] = useState<DbVerification[]>([]);
  const [verificationLoading, setVerificationLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsLoadError, setGroupsLoadError] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [confirmedEndedIds, setConfirmedEndedIds] = useState<Set<string>>(loadConfirmedEnded);
  const [reopenNotifyIds, setReopenNotifyIds] = useState<Set<string>>(() => new Set());
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [latestNotification, setLatestNotification] = useState<AppNotification | null>(null);
  const verificationImageUrlRef = useRef<string | null>(null);
  const pendingGroupOps = useRef(new Set<string>());

  useEffect(() => {
    return () => {
      if (verificationImageUrlRef.current) {
        URL.revokeObjectURL(verificationImageUrlRef.current);
      }
    };
  }, []);

  function replaceVerificationImageUrl(nextUrl: string | null) {
    if (verificationImageUrlRef.current) {
      URL.revokeObjectURL(verificationImageUrlRef.current);
    }
    verificationImageUrlRef.current = nextUrl;
    setVerificationImageUrl(nextUrl);
  }

  useEffect(() => {
    if (user && profile) {
      setNickname(profile.username ?? "이름");
      setParticipationTickets(profile.participation_tickets);
      return;
    }
    if (!user) {
      setNickname("이름");
      setParticipationTickets(5);
    }
  }, [user, profile]);

  useEffect(() => {
    let cancelled = false;

    async function loadVerifications() {
      if (!user) {
        setVerificationHistory([]);
        setVerificationLoading(false);
        return;
      }
      setVerificationLoading(true);
      const { data, error } = await supabase
        .from("verifications")
        .select("*")
        .order("verified_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        console.error("Failed to load verifications", error);
        setVerificationHistory([]);
        setVerificationLoading(false);
        return;
      }
      setVerificationHistory(data ?? []);
      setVerificationLoading(false);
    }

    void loadVerifications();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    void reloadNotifications();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // 재개설 알림 신청 목록 로드
  useEffect(() => {
    if (!user) { setReopenNotifyIds(new Set()); return; }
    let cancelled = false;
    void supabase
      .from("challenge_reopen_subscriptions")
      .select("group_id")
      .eq("user_id", user.id)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { console.error("Failed to load reopen subscriptions", error); return; }
        setReopenNotifyIds(new Set((data ?? []).map(r => r.group_id)));
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  // 새 알림 Realtime 구독
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifs:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const incoming = mapDbNotif(payload.new as NotificationRecord);
          setNotifications(prev => [incoming, ...prev]);
          setLatestNotification(incoming);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel).catch(err => console.error("removeChannel failed:", err)); };
  }, [user?.id]);

  function beginVerification({ verifyType = null, groupId = null }: { verifyType?: VerifyTypeKey | null; groupId?: string | null }) {
    setVerifyType(verifyType);
    setVerificationGroupId(groupId);
    setVerificationImageFile(null);
    replaceVerificationImageUrl(null);
  }

  function setVerificationImage(file: File | null) {
    setVerificationImageFile(file);
    replaceVerificationImageUrl(file ? URL.createObjectURL(file) : null);
  }

  function clearVerification() {
    setVerifyType(null);
    setVerificationGroupId(null);
    setVerificationImageFile(null);
    replaceVerificationImageUrl(null);
  }

  function completeCurrentVerification(serverPhotoUrl?: string | null) {
    const localImageUrl = verificationImageUrl;
    setVerificationHistory(prev => [
      {
        id: `local-${Date.now()}`,
        user_id: user?.id ?? "guest",
        verified_at: new Date().toISOString(),
        photo_url: serverPhotoUrl ?? localImageUrl,
        status: "completed",
        xp_earned: 10,
      },
      ...prev,
    ]);
    clearVerification();
    void refreshVerifications();
  }

  async function refreshVerifications() {
    if (!user) return;
    const { data, error } = await supabase
      .from("verifications")
      .select("*")
      .order("verified_at", { ascending: false });
    if (error) {
      console.error("Failed to refresh verifications", error);
      return;
    }
    setVerificationHistory(data ?? []);
    void refreshProfile();
  }

  async function reloadNotifications() {
    if (!user) { setNotifications([]); return; }
    setNotificationsLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifications((data ?? []).map(mapDbNotif));
    setNotificationsLoading(false);
  }

  async function markNotifRead(id: string) {
    const original = notifications.find(n => n.id === id);
    setNotifications(p => p.map(n => n.id === id ? { ...n, read: true } : n));
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("Failed to mark notification as read", error);
      if (original) setNotifications(p => p.map(n => n.id === id ? original : n));
    }
  }

  async function markAllNotifsRead() {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (!unreadIds.length) return;
    const snapshot = notifications;
    setNotifications(p => p.map(n => ({ ...n, read: true })));
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds);
    if (error) {
      console.error("Failed to mark all notifications as read", error);
      setNotifications(snapshot);
    }
  }

  async function handleNotifAction(id: string, accepted = true) {
    const original = notifications.find(n => n.id === id);
    if (accepted && original?.type === "group" && original.relatedId) {
      joinGroup(original.relatedId);
    }
    setNotifications(p => p.map(n => n.id === id ? {
      ...n,
      read: true,
      actionDone: true,
      actionResult: accepted ? "accepted" : "rejected",
    } : n));
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString(), action_done: true })
      .eq("id", id);
    if (error) {
      console.error("Failed to update notification action", error);
      if (original) setNotifications(p => p.map(n => n.id === id ? original : n));
    }
  }

  /* ── 그룹 로드 (refreshGroups) ── */
  const refreshGroups = useCallback(async () => {
    setGroupsLoading(true);
    const { data: dbGroups, error: groupsError } = await supabase
      .from("groups")
      .select("*")
      .order("legacy_id", { ascending: true, nullsFirst: false });

    if (groupsError) {
      console.error("Failed to load groups", groupsError);
      setGroupsLoadError(true);
      setGroupsLoading(false);
      return;
    }
    if (!dbGroups?.length) {
      setGroups([]);
      setGroupsLoading(false);
      return;
    }

    const joinedDbIds        = new Set<string>();
    const removedDbIds       = new Set<string>();
    const leftDbIds          = new Set<string>();
    const exitEligibleDbIds  = new Set<string>();

    if (user) {
      const { data: memberships, error: membershipsError } = await supabase
        .from("group_members")
        .select("group_id, member_status")
        .eq("user_id", user.id);

      if (membershipsError) {
        console.error("Failed to load group memberships", membershipsError);
        setGroupsLoadError(true);
        setGroupsLoading(false);
        return;
      }
      memberships?.forEach(item => {
        if (item.member_status === "REMOVED") {
          removedDbIds.add(item.group_id);
        } else if (item.member_status === "LEFT") {
          leftDbIds.add(item.group_id);
        } else if (item.member_status === "EXIT_ELIGIBLE") {
          exitEligibleDbIds.add(item.group_id);
          joinedDbIds.add(item.group_id);
        } else {
          joinedDbIds.add(item.group_id);
        }
      });
    }

    setGroupsLoadError(false);
    setGroups(dbGroups.map(row => mapDbGroup(row, joinedDbIds, removedDbIds, leftDbIds, exitEligibleDbIds)));
    setGroupsLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    void refreshGroups();
  }, [refreshGroups]);

  /* ── 그룹 가입 ── */
  function joinGroup(id: string) {
    const target = groups.find(g => g.id === id || g.dbId === id);
    const appId = target?.id ?? id;
    const dbId = target?.dbId;

    // LEFT/REMOVED는 영구 — 어떤 상황에서도 현재 챌린지 재참여 불가
    if (target?.isRemoved || target?.isLeft) return;
    if (pendingGroupOps.current.has(appId)) return;
    // 참가권 0장이면 합류 차단 (UI에서도 막지만 방어적으로 한 번 더)
    if (participationTickets <= 0) return;

    if (!user || !dbId) return;

    // 참가권 1장 차감 (낙관적)
    const prevTickets = participationTickets;
    const nextTickets = prevTickets - 1;
    setGroups(prev => {
      if (prev.some(g => (g.id === appId || g.dbId === id) && g.joined)) return prev;
      return prev.map(g => (g.id === appId || g.dbId === id)
        ? { ...g, joined: true, members: g.members + 1 }
        : g
      );
    });
    setParticipationTickets(nextTickets);

    pendingGroupOps.current.add(appId);
    void supabase
      .rpc("join_group_with_ticket", { p_group_id: dbId })
      .then(({ data, error }) => {
        pendingGroupOps.current.delete(appId);
        if (!error) {
          const row = data?.[0];
          if (row?.participation_tickets !== undefined) {
            setParticipationTickets(row.participation_tickets);
          }
          void refreshProfile();
          void refreshGroups();
          return;
        }
        console.error("Failed to join group", error);
        // 그룹/참가권 모두 롤백
        setGroups(prev => prev.map(g => g.id === appId
          ? { ...g, joined: false, members: Math.max(0, g.members - 1) }
          : g
        ));
        setParticipationTickets(prevTickets);
      });
  }

  /* ── 강퇴 처리 (시스템) ── */
  function markGroupLeft(dbId: string) {
    setGroups(prev => prev.map(g => g.dbId === dbId
      ? { ...g, joined: false, isRemoved: true, members: Math.max(0, g.members - 1) }
      : g));
  }

  /* ── 그룹 탈퇴 (자발적 → LEFT 상태) ── */
  function leaveGroup(id: string) {
    const target = groups.find(g => g.id === id || g.dbId === id);
    const appId = target?.id ?? id;
    const dbId = target?.dbId;

    if (pendingGroupOps.current.has(appId)) return;
    if (!user || !dbId) return;

    // 낙관적 업데이트: joined → false, isLeft → true
    setGroups(prev => {
      if (!prev.some(g => (g.id === appId || g.dbId === id) && g.joined)) return prev;
      return prev.map(g =>
        (g.id === appId || g.dbId === id)
          ? { ...g, joined: false, isLeft: true, members: Math.max(0, g.members - 1) }
          : g
      );
    });

    pendingGroupOps.current.add(appId);
    void supabase
      .rpc("leave_group", { p_group_id: dbId })
      .then(({ data, error }) => {
        pendingGroupOps.current.delete(appId);
        if (!error && data) {
          void refreshGroups();
          return;
        }
        console.error("Failed to leave group", error);
        // 롤백
        setGroups(prev => prev.map(g =>
          g.id === appId ? { ...g, joined: true, isLeft: false, members: g.members + 1 } : g
        ));
      });
  }

  /* ── 종료 챌린지 확인 완료 ── */
  function confirmEndedGroup(id: string) {
    setConfirmedEndedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem(CONFIRMED_ENDED_KEY, JSON.stringify([...next]));
      } catch { /* ignore */ }
      return next;
    });
  }

  /* ── 재개설 알림 신청 토글 (DB 동기화 + optimistic) ── */
  function toggleReopenNotify(dbId: string) {
    if (!user) return;
    const wasOn = reopenNotifyIds.has(dbId);

    // optimistic
    setReopenNotifyIds(prev => {
      const next = new Set(prev);
      if (wasOn) next.delete(dbId);
      else       next.add(dbId);
      return next;
    });

    const op = wasOn
      ? supabase.from("challenge_reopen_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("group_id", dbId)
      : supabase.from("challenge_reopen_subscriptions")
          .insert({ user_id: user.id, group_id: dbId });

    void op.then(({ error }) => {
      if (!error) return;
      console.error("Failed to toggle reopen subscription", error);
      // 롤백
      setReopenNotifyIds(prev => {
        const next = new Set(prev);
        if (wasOn) next.add(dbId);
        else       next.delete(dbId);
        return next;
      });
    });
  }

  return (
    <AppContext.Provider value={{
      theme, setTheme,
      nickname, setNickname,
      participationTickets,
      verifyType, setVerifyType,
      verificationGroupId, verificationImageUrl, verificationImageFile, verificationHistory, verificationLoading,
      beginVerification, setVerificationImage, completeCurrentVerification, clearVerification, refreshVerifications,
      groups, groupsLoading, groupsLoadError, refreshGroups,
      joinGroup, leaveGroup, markGroupLeft, selectedGroupId, setSelectedGroupId,
      confirmedEndedIds, confirmEndedGroup,
      reopenNotifyIds, toggleReopenNotify,
      notifications, notificationsLoading, latestNotification,
      markNotifRead, markAllNotifsRead, handleNotifAction, reloadNotifications,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be within AppProvider");
  return ctx;
}
