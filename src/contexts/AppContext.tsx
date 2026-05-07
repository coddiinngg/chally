import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import type { VerifyTypeKey } from "../lib/verifyTypes";
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
  rate: number;
  status: string;
  statusColor: string;
  category: string;
  joined: boolean;
  rule: string;
  goal: string;
  verifyType: VerifyTypeKey;
  myRank: number;
  myRate: number;
  myStreak: number;
  cover: string;
  recruitStart: string | null;
  recruitEnd: string | null;
  challengeStart: string | null;
  challengeEnd: string | null;
}

const DEFAULT_GROUPS: Group[] = [
  { id: "1", title: "매일 5,000보 걷기",  desc: "걸음 수 인증으로 함께 건강해져요",    members: 38, rate: 72, status: "인기",    statusColor: "#FF3355", category: "운동", joined: false, verifyType: "step_walk",      rule: "매일 5,000보 이상 만보기 스크린샷 인증",         goal: "오늘 5,000보 달성",   myRank: 4,  myRate: 75, myStreak: 8,  cover: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&fit=crop", recruitStart: "2026-04-25T00:00:00+09:00", recruitEnd: "2026-04-27T23:59:59+09:00", challengeStart: "2026-04-28T00:00:00+09:00", challengeEnd: "2026-05-11T23:59:59+09:00" },
  { id: "2", title: "러닝 크루",       desc: "러닝하며 최애 풍경을 함께 공유해요",  members: 24, rate: 80, status: "진행중",  statusColor: "#10B981", category: "운동", joined: false, verifyType: "run_scenery",    rule: "러닝 중 찍은 풍경 사진 인증",                   goal: "러닝 풍경 사진 찍기", myRank: 12, myRate: 50, myStreak: 2,  cover: "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800&fit=crop", recruitStart: "2026-05-01T00:00:00+09:00", recruitEnd: "2026-05-03T23:59:59+09:00", challengeStart: "2026-05-04T00:00:00+09:00", challengeEnd: "2026-05-18T23:59:59+09:00" },
  { id: "3", title: "일일 독서 클럽", desc: "매일 읽는 책 표지를 함께 모아요",     members: 15, rate: 65, status: "진행중",  statusColor: "#10B981", category: "학습", joined: false, verifyType: "book_cover",     rule: "매일 읽는 책 표지 사진 인증",                   goal: "책 30분 읽기",        myRank: 3,  myRate: 75, myStreak: 5,  cover: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=800&fit=crop", recruitStart: "2026-04-22T00:00:00+09:00", recruitEnd: "2026-04-24T23:59:59+09:00", challengeStart: "2026-04-25T00:00:00+09:00", challengeEnd: "2026-05-08T23:59:59+09:00" },
  { id: "4", title: "필사 챌린지",    desc: "곱씹게 되는 문장을 함께 모아요",     members: 11, rate: 58, status: "마감임박", statusColor: "#F59E0B", category: "학습", joined: false, verifyType: "quote_photo",    rule: "오늘의 인상 깊은 문장 사진 인증",               goal: "인상 문장 필사",      myRank: 6,  myRate: 60, myStreak: 3,  cover: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&fit=crop", recruitStart: "2026-04-22T00:00:00+09:00", recruitEnd: "2026-04-24T23:59:59+09:00", challengeStart: "2026-04-25T00:00:00+09:00", challengeEnd: "2026-05-08T23:59:59+09:00" },
  { id: "5", title: "포즈 챌린지",    desc: "오늘의 지정 포즈에 도전해요",        members: 42, rate: 88, status: "인기",    statusColor: "#FF3355", category: "생활", joined: false, verifyType: "celeb_pose",     rule: "오늘의 지정 포즈로 셀카 인증",                  goal: "오늘의 포즈 찍기",    myRank: 20, myRate: 40, myStreak: 1,  cover: "https://images.unsplash.com/photo-1552196563-55cd4e45efb3?w=800&fit=crop", recruitStart: "2026-04-22T00:00:00+09:00", recruitEnd: "2026-04-24T23:59:59+09:00", challengeStart: "2026-04-25T00:00:00+09:00", challengeEnd: "2026-05-08T23:59:59+09:00" },
  { id: "6", title: "장소 탐험대",    desc: "목표 장소에서 인증샷을 찍어요",      members: 19, rate: 63, status: "진행중",  statusColor: "#10B981", category: "생활", joined: false, verifyType: "location_photo", rule: "목표 장소 방문 인증 사진",                       goal: "장소 방문 인증",      myRank: 9,  myRate: 55, myStreak: 4,  cover: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&fit=crop", recruitStart: "2026-04-25T00:00:00+09:00", recruitEnd: "2026-04-27T23:59:59+09:00", challengeStart: "2026-04-28T00:00:00+09:00", challengeEnd: "2026-05-11T23:59:59+09:00" },
];

function legacyGroupId(row: DbGroup) {
  return row.legacy_id ?? row.id;
}

function mapDbGroup(row: DbGroup, joinedDbIds: Set<string>): Group {
  return {
    id: legacyGroupId(row),
    dbId: row.id,
    title: row.name,
    desc: row.description ?? "",
    members: row.member_count,
    rate: row.rate,
    status: row.status,
    statusColor: row.status_color,
    category: row.category ?? "기타",
    joined: joinedDbIds.has(row.id),
    rule: row.rule ?? "",
    goal: row.goal ?? "",
    verifyType: row.verify_type as VerifyTypeKey,
    myRank: row.my_rank,
    myRate: row.my_rate,
    myStreak: row.my_streak,
    cover: row.cover ?? "",
    recruitStart: row.recruit_start ?? null,
    recruitEnd: row.recruit_end ?? null,
    challengeStart: row.challenge_start ?? null,
    challengeEnd: row.challenge_end ?? null,
  };
}

/* ── 알림 타입 ── */
export type NotifType = "goal" | "badge" | "group" | "rank" | "streak";

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

interface AppContextType {
  theme: "light" | "dark" | "system";
  setTheme: (t: "light" | "dark" | "system") => void;
  nickname: string;
  setNickname: (n: string) => void;
  recoveryTickets: number;
  useRecoveryTicket: () => boolean;
  // Verification
  verifyType: VerifyTypeKey | null;
  setVerifyType: (t: VerifyTypeKey | null) => void;
  verificationGroupId: string | null;
  verificationImageUrl: string | null;
  verificationImageFile: File | null;
  verificationHistory: DbVerification[];
  beginVerification: (params: { verifyType?: VerifyTypeKey | null; groupId?: string | null }) => void;
  setVerificationImage: (file: File | null) => void;
  completeCurrentVerification: (serverPhotoUrl?: string | null) => void;
  clearVerification: () => void;
  refreshVerifications: () => Promise<void>;
  // Groups
  groups: Group[];
  groupsLoading: boolean;
  groupsLoadError: boolean;
  joinGroup: (id: string) => void;
  leaveGroup: (id: string) => void;
  selectedGroupId: string;
  setSelectedGroupId: (id: string) => void;
  // Notifications
  notifications: AppNotification[];
  notificationsLoading: boolean;
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
  const [recoveryTickets, setRecoveryTickets] = useState(2);
  const [verifyType, setVerifyType] = useState<VerifyTypeKey | null>(null);
  const [verificationGroupId, setVerificationGroupId] = useState<string | null>(null);
  const [verificationImageUrl, setVerificationImageUrl] = useState<string | null>(null);
  const [verificationImageFile, setVerificationImageFile] = useState<File | null>(null);
  const [verificationHistory, setVerificationHistory] = useState<DbVerification[]>([]);
  const [groups, setGroups] = useState<Group[]>(DEFAULT_GROUPS);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsLoadError, setGroupsLoadError] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const verificationImageUrlRef = useRef<string | null>(null);
  const pendingGroupOps = useRef(new Set<string>()); // 진행 중인 그룹 가입/탈퇴 요청 중복 방지

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
      setRecoveryTickets(profile.recovery_tickets);
      return;
    }

    if (!user) {
      setNickname("이름");
      setRecoveryTickets(2);
    }
  }, [user, profile]);

  useEffect(() => {
    let cancelled = false;

    async function loadVerifications() {
      if (!user) {
        setVerificationHistory([]);
        return;
      }

      const { data, error } = await supabase
        .from("verifications")
        .select("*")
        .order("verified_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error("Failed to load verifications", error);
        setVerificationHistory([]);
        return;
      }

      setVerificationHistory(data ?? []);
    }

    void loadVerifications();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    void reloadNotifications();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  function useRecoveryTicket() {
    if (recoveryTickets <= 0) return false;
    setRecoveryTickets(current => {
      const nextValue = current - 1;
      if (user && nextValue >= 0) {
        void supabase
          .from("profiles")
          .update({ recovery_tickets: nextValue })
          .eq("id", user.id)
          .then(({ error }) => {
            if (error) console.error("Failed to update recovery tickets", error);
            void refreshProfile(); // 성공/실패 모두 DB값으로 동기화
          });
      }
      return nextValue;
    });
    return true;
  }

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

    if (error) return;
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
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
  }

  async function markAllNotifsRead() {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (!unreadIds.length) return;
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds);
  }

  async function handleNotifAction(id: string, accepted = true) {
    const target = notifications.find(n => n.id === id);
    if (accepted && target?.type === "group" && target.relatedId) {
      joinGroup(target.relatedId);
    }
    setNotifications(prev => prev.map(n => n.id === id ? {
      ...n,
      read: true,
      actionDone: true,
      actionResult: accepted ? "accepted" : "rejected",
    } : n));
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString(), action_done: true })
      .eq("id", id);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadGroups() {
      setGroupsLoading(true);
      const { data: dbGroups, error: groupsError } = await supabase
        .from("groups")
        .select("*")
        .order("legacy_id", { ascending: true, nullsFirst: false });

      if (cancelled) return;

      if (groupsError) {
        console.error("Failed to load groups", groupsError);
        setGroupsLoadError(true);
        setGroups([]);
        setGroupsLoading(false);
        return;
      }
      if (!dbGroups?.length) {
        setGroups([]);
        setGroupsLoading(false);
        return;
      }

      const joinedDbIds = new Set<string>();

      if (user) {
        const { data: memberships, error: membershipsError } = await supabase
          .from("group_members")
          .select("group_id")
          .eq("user_id", user.id);

        if (cancelled) return;

        if (membershipsError) {
          console.error("Failed to load group memberships", membershipsError);
        } else {
          memberships?.forEach(item => joinedDbIds.add(item.group_id));
        }
      }

      setGroupsLoadError(false);
      setGroups(dbGroups.map(row => mapDbGroup(row, joinedDbIds)));
      setGroupsLoading(false);
    }

    void loadGroups();
    return () => { cancelled = true; };
  }, [user?.id]);

  function joinGroup(id: string) {
    const target = groups.find(g => g.id === id || g.dbId === id);
    const appId = target?.id ?? id;
    const dbId = target?.dbId;

    if (pendingGroupOps.current.has(appId)) return; // 중복 요청 방지

    setGroups(prev => {
      if (prev.some(g => (g.id === appId || g.dbId === id) && g.joined)) return prev;
      return prev.map(g => (g.id === appId || g.dbId === id) ? { ...g, joined: true, members: g.members + 1 } : g);
    });

    if (!user || !dbId) return;

    pendingGroupOps.current.add(appId);
    void supabase
      .from("group_members")
      .insert({ group_id: dbId, user_id: user.id })
      .then(({ error }) => {
        pendingGroupOps.current.delete(appId);
        if (!error) return;
        if (error.code === "23505") {
          // 이미 가입됨 — optimistic +1 되돌리기
          setGroups(prev => prev.map(g => g.id === appId ? { ...g, joined: true, members: Math.max(0, g.members - 1) } : g));
          return;
        }
        console.error("Failed to join group", error);
        setGroups(prev => prev.map(g => g.id === appId ? { ...g, joined: false, members: Math.max(0, g.members - 1) } : g));
      });
  }

  function leaveGroup(id: string) {
    const target = groups.find(g => g.id === id || g.dbId === id);
    const appId = target?.id ?? id;
    const dbId = target?.dbId;

    if (pendingGroupOps.current.has(appId)) return; // 중복 요청 방지

    setGroups(prev => {
      if (!prev.some(g => (g.id === appId || g.dbId === id) && g.joined)) return prev;
      return prev.map(g => (g.id === appId || g.dbId === id) ? { ...g, joined: false, members: Math.max(0, g.members - 1) } : g);
    });

    if (!user || !dbId) return;

    pendingGroupOps.current.add(appId);
    void supabase
      .from("group_members")
      .delete()
      .eq("group_id", dbId)
      .eq("user_id", user.id)
      .then(({ error }) => {
        pendingGroupOps.current.delete(appId);
        if (!error) return;
        console.error("Failed to leave group", error);
        setGroups(prev => prev.map(g => g.id === appId ? { ...g, joined: true, members: g.members + 1 } : g));
      });
  }

  return (
    <AppContext.Provider value={{
      theme, setTheme,
      nickname, setNickname,
      recoveryTickets, useRecoveryTicket,
      verifyType, setVerifyType,
      verificationGroupId, verificationImageUrl, verificationImageFile, verificationHistory, beginVerification, setVerificationImage, completeCurrentVerification, clearVerification, refreshVerifications,
      groups, groupsLoading, groupsLoadError, joinGroup, leaveGroup, selectedGroupId, setSelectedGroupId,
      notifications, notificationsLoading, markNotifRead, markAllNotifsRead, handleNotifAction, reloadNotifications,
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
