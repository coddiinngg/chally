import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import type { VerifyTypeKey } from "../lib/verifyTypes";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import type {
  Goal as DbGoal,
  Verification as DbVerification,
  SnoozeRecord,
  NotificationRecord,
} from "../types/database";

/* ── 그룹 타입 ── */
export interface Group {
  id: string;
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
}

const DEFAULT_GROUPS: Group[] = [
  { id: "1", title: "매일 5,000보 걷기",  desc: "걸음 수 인증으로 함께 건강해져요",    members: 38, rate: 72, status: "인기",    statusColor: "#FF3355", category: "운동", joined: false, verifyType: "step_walk",      rule: "매일 5,000보 이상 만보기 스크린샷 인증",         goal: "오늘 5,000보 달성",   myRank: 4,  myRate: 75, myStreak: 8,  cover: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&fit=crop" },
  { id: "2", title: "러닝 크루",       desc: "러닝하며 최애 풍경을 함께 공유해요",  members: 24, rate: 80, status: "진행중",  statusColor: "#10B981", category: "운동", joined: false, verifyType: "run_scenery",    rule: "러닝 중 찍은 풍경 사진 인증",                   goal: "러닝 풍경 사진 찍기", myRank: 12, myRate: 50, myStreak: 2,  cover: "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800&fit=crop" },
  { id: "3", title: "일일 독서 클럽", desc: "매일 읽는 책 표지를 함께 모아요",     members: 15, rate: 65, status: "진행중",  statusColor: "#10B981", category: "학습", joined: false, verifyType: "book_cover",     rule: "매일 읽는 책 표지 사진 인증",                   goal: "책 30분 읽기",        myRank: 3,  myRate: 75, myStreak: 5,  cover: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=800&fit=crop" },
  { id: "4", title: "필사 챌린지",    desc: "곱씹게 되는 문장을 함께 모아요",     members: 11, rate: 58, status: "마감임박", statusColor: "#F59E0B", category: "학습", joined: false, verifyType: "quote_photo",    rule: "오늘의 인상 깊은 문장 사진 인증",               goal: "인상 문장 필사",      myRank: 6,  myRate: 60, myStreak: 3,  cover: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&fit=crop" },
  { id: "5", title: "포즈 챌린지",    desc: "오늘의 지정 포즈에 도전해요",        members: 42, rate: 88, status: "인기",    statusColor: "#FF3355", category: "생활", joined: false, verifyType: "celeb_pose",     rule: "오늘의 지정 포즈로 셀카 인증",                  goal: "오늘의 포즈 찍기",    myRank: 20, myRate: 40, myStreak: 1,  cover: "https://images.unsplash.com/photo-1552196563-55cd4e45efb3?w=800&fit=crop" },
  { id: "6", title: "장소 탐험대",    desc: "목표 장소에서 인증샷을 찍어요",      members: 19, rate: 63, status: "진행중",  statusColor: "#10B981", category: "생활", joined: false, verifyType: "location_photo", rule: "목표 장소 방문 인증 사진",                       goal: "장소 방문 인증",      myRank: 9,  myRate: 55, myStreak: 4,  cover: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&fit=crop" },
];

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
  };
}

/* ── 카테고리 메타 ── */
export const CATEGORY_META: Record<string, { color: string; colorRgb: string; label: string }> = {
  exercise: { color: "#FF3355", colorRgb: "255,51,85",  label: "운동" },
  study:    { color: "#3b82f6", colorRgb: "59,130,246", label: "공부" },
  reading:  { color: "#FB923C", colorRgb: "251,146,60", label: "독서" },
  habit:    { color: "#a855f7", colorRgb: "168,85,247", label: "습관" },
  hobby:    { color: "#22c55e", colorRgb: "34,197,94",  label: "취미" },
  etc:      { color: "#38BDF8", colorRgb: "56,189,248", label: "기타" },
};

/* ── Goal 타입 ── */
export interface Goal {
  id: string;
  title: string;
  color: string;
  colorRgb: string;
  category: string;
  frequency: string;
  notifyTime: string;
  streak: number;
  progress: number;
  completedToday: boolean;
  skippedToday: boolean;
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

function mapDbGoalToAppGoal(
  goal: DbGoal,
  verifications: DbVerification[],
  snoozes: SnoozeRecord[],
): Goal {
  const meta = CATEGORY_META[goal.category] ?? CATEGORY_META.etc;
  const todayKey = dateKey(new Date());
  const completedToday = verifications.some(item => item.status === "completed" && dateKey(item.verified_at) === todayKey);
  const skippedToday = snoozes.some(item => dateKey(item.snoozed_at) === todayKey);
  const completedCount = verifications.filter(item => item.status === "completed").length;

  return {
    id: goal.id,
    title: goal.title,
    color: meta.color,
    colorRgb: meta.colorRgb,
    category: goal.category,
    frequency: goal.frequency,
    notifyTime: goal.reminder_time?.slice(0, 5) ?? "09:00",
    streak: computeCurrentStreak(verifications),
    progress: Math.min(completedCount * 10, 100),
    completedToday,
    skippedToday: !completedToday && skippedToday,
  };
}

interface AppContextType {
  theme: "light" | "dark" | "system";
  setTheme: (t: "light" | "dark" | "system") => void;
  nickname: string;
  setNickname: (n: string) => void;
  recoveryTickets: number;
  useRecoveryTicket: () => boolean;
  // Goals
  goals: Goal[];
  completeGoalToday: (id: string) => void;
  skipGoalToday: (id: string) => void;
  verifyingGoalId: string | null;
  setVerifyingGoalId: (id: string | null) => void;
  verifyType: VerifyTypeKey | null;
  setVerifyType: (t: VerifyTypeKey | null) => void;
  verificationImageUrl: string | null;
  verificationImageFile: File | null;
  verificationHistory: DbVerification[];
  beginVerification: (params: { goalId?: string | null; verifyType?: VerifyTypeKey | null }) => void;
  setVerificationImage: (file: File | null) => void;
  completeCurrentVerification: (serverPhotoUrl?: string | null) => void;
  clearVerification: () => void;
  refreshGoals: () => Promise<void>;
  // Groups
  groups: Group[];
  joinGroup: (id: string) => void;
  leaveGroup: (id: string) => void;
  selectedGroupId: string;
  setSelectedGroupId: (id: string) => void;
  // Notifications
  notifications: AppNotification[];
  notificationsLoading: boolean;
  markNotifRead: (id: string) => Promise<void>;
  markAllNotifsRead: () => Promise<void>;
  handleNotifAction: (id: string) => Promise<void>;
  reloadNotifications: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, profile, refreshProfile } = useAuth();
  const [theme, setTheme] = useState<"light" | "dark" | "system">("light");

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
  const [goals, setGoals] = useState<Goal[]>([]);
  const [verifyingGoalId, setVerifyingGoalId] = useState<string | null>(null);
  const [verifyType, setVerifyType] = useState<VerifyTypeKey | null>(null);
  const [verificationImageUrl, setVerificationImageUrl] = useState<string | null>(null);
  const [verificationImageFile, setVerificationImageFile] = useState<File | null>(null);
  const [verificationHistory, setVerificationHistory] = useState<DbVerification[]>([]);
  const [groups, setGroups] = useState<Group[]>(DEFAULT_GROUPS);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const verificationImageUrlRef = useRef<string | null>(null);

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

    async function loadRemoteGoals() {
      if (!user) {
        setGoals([]);
        setVerificationHistory([]);
        return;
      }

      const [{ data: goalsData, error: goalsError }, { data: verificationData, error: verificationsError }, { data: snoozeData, error: snoozeError }] = await Promise.all([
        supabase.from("goals").select("*").order("created_at", { ascending: true }),
        supabase.from("verifications").select("*").order("verified_at", { ascending: false }),
        supabase.from("snooze_records").select("*").order("snoozed_at", { ascending: false }),
      ]);

      if (cancelled) return;

      if (goalsError || verificationsError || snoozeError) {
        console.error("Failed to load remote goals", { goalsError, verificationsError, snoozeError });
        setGoals([]);
        setVerificationHistory([]);
        return;
      }

      setGoals([]);

      setVerificationHistory(verificationData ?? []);
      const nextGoals = (goalsData ?? []).map(goal => {
        const goalVerifications = (verificationData ?? []).filter(item => item.goal_id === goal.id);
        const goalSnoozes = (snoozeData ?? []).filter(item => item.goal_id === goal.id);
        return mapDbGoalToAppGoal(goal, goalVerifications, goalSnoozes);
      });
      setGoals(nextGoals);
    }

    void loadRemoteGoals();
    return () => {
      cancelled = true;
    };
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
            else void refreshProfile();
          });
      }
      return nextValue;
    });
    return true;
  }

  function completeGoalToday(id: string) {
    setGoals(prev => prev.map(g =>
      g.id === id
        ? g.completedToday
          ? g
          : { ...g, completedToday: true, skippedToday: false, streak: g.streak + 1, progress: Math.min(g.progress + 10, 100) }
        : g
    ));
  }

  function skipGoalToday(id: string) {
    setGoals(prev => prev.map(g =>
      g.id === id && !g.completedToday ? { ...g, skippedToday: true } : g
    ));

    if (user) {
      void supabase
        .from("snooze_records")
        .insert({
          goal_id: id,
          user_id: user.id,
        })
        .then(({ error }) => {
          if (error) console.error("Failed to record snooze", error);
        });
    }
  }

  function beginVerification({ goalId = null, verifyType = null }: { goalId?: string | null; verifyType?: VerifyTypeKey | null }) {
    setVerifyingGoalId(goalId);
    setVerifyType(verifyType);
    setVerificationImageFile(null);
    replaceVerificationImageUrl(null);
  }

  function setVerificationImage(file: File | null) {
    setVerificationImageFile(file);
    replaceVerificationImageUrl(file ? URL.createObjectURL(file) : null);
  }

  function clearVerification() {
    setVerifyingGoalId(null);
    setVerifyType(null);
    setVerificationImageFile(null);
    replaceVerificationImageUrl(null);
  }

  /**
   * 인증 완료 처리.
   * DB 저장/XP 지급은 Edge Function(verify-photo)이 이미 처리했으므로
   * 여기서는 로컬 상태만 낙관적으로 업데이트하고 DB를 재로딩합니다.
   */
  function completeCurrentVerification(serverPhotoUrl?: string | null) {
    const goalId = verifyingGoalId;
    const localImageUrl = verificationImageUrl;

    if (goalId) {
      completeGoalToday(goalId);
      setVerificationHistory(prev => [
        {
          id: `local-${Date.now()}`,
          goal_id: goalId,
          user_id: user?.id ?? "guest",
          verified_at: new Date().toISOString(),
          photo_url: serverPhotoUrl ?? localImageUrl,
          status: "completed",
          xp_earned: 10,
        },
        ...prev,
      ]);
    }

    clearVerification();

    // DB에서 최신 데이터를 백그라운드로 재로딩 (XP 반영 등)
    void refreshGoals();
  }

  async function refreshGoals() {
    if (!user) return;

    const [{ data: goalsData, error: goalsError }, { data: verificationData, error: verificationsError }, { data: snoozeData, error: snoozeError }] = await Promise.all([
      supabase.from("goals").select("*").order("created_at", { ascending: true }),
      supabase.from("verifications").select("*").order("verified_at", { ascending: false }),
      supabase.from("snooze_records").select("*").order("snoozed_at", { ascending: false }),
    ]);

    if (goalsError || verificationsError || snoozeError) return;

    setVerificationHistory(verificationData ?? []);
    const nextGoals = (goalsData ?? []).map(goal => {
      const goalVerifications = (verificationData ?? []).filter(item => item.goal_id === goal.id);
      const goalSnoozes = (snoozeData ?? []).filter(item => item.goal_id === goal.id);
      return mapDbGoalToAppGoal(goal, goalVerifications, goalSnoozes);
    });
    setGoals(nextGoals);
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

  async function handleNotifAction(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true, actionDone: true } : n));
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString(), action_done: true })
      .eq("id", id);
  }

  // 로그인 시 DB에서 참여 그룹 불러오기
  useEffect(() => {
    if (!user) {
      setGroups(DEFAULT_GROUPS);
      return;
    }
    async function loadJoinedGroups() {
      const { data } = await supabase
        .from("profiles")
        .select("joined_group_ids")
        .eq("id", user!.id)
        .single();
      const joined: string[] = data?.joined_group_ids ?? [];
      setGroups(DEFAULT_GROUPS.map(g => ({ ...g, joined: joined.includes(g.id) })));
    }
    void loadJoinedGroups();
  }, [user?.id]);

  function joinGroup(id: string) {
    setGroups(prev => {
      const next = prev.map(g => g.id === id ? { ...g, joined: true } : g);
      if (user) {
        const joinedIds = next.filter(g => g.joined).map(g => g.id);
        void supabase.from("profiles").update({ joined_group_ids: joinedIds }).eq("id", user.id);
      }
      return next;
    });
  }

  function leaveGroup(id: string) {
    setGroups(prev => {
      const next = prev.map(g => g.id === id ? { ...g, joined: false } : g);
      if (user) {
        const joinedIds = next.filter(g => g.joined).map(g => g.id);
        void supabase.from("profiles").update({ joined_group_ids: joinedIds }).eq("id", user.id);
      }
      return next;
    });
  }

  return (
    <AppContext.Provider value={{
      theme, setTheme,
      nickname, setNickname,
      recoveryTickets, useRecoveryTicket,
      goals, completeGoalToday, skipGoalToday,
      verifyingGoalId, setVerifyingGoalId,
      verifyType, setVerifyType,
      verificationImageUrl, verificationImageFile, verificationHistory, beginVerification, setVerificationImage, completeCurrentVerification, clearVerification, refreshGoals,
      groups, joinGroup, leaveGroup, selectedGroupId, setSelectedGroupId,
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
