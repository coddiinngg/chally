import { supabase } from "./supabase";
import type { ActivityPostRecord, ActivityReactionRecord } from "../types/database";

/* 전역 반응 캐시 — ActivityPhoto에서 업데이트하면 피드/갤러리에 즉시 반영 */
export const reactionCache = new Map<string, { count: number; myReaction: string | null }>();

export type ActivityEmoji = ActivityReactionRecord["emoji"];

export type AuthorMemberStatus = "ACTIVE" | "EXIT_ELIGIBLE" | "LEFT" | "REMOVED" | null;

export interface ActivityFeedItem extends ActivityPostRecord {
  reactionCount: number;
  myReaction: ActivityEmoji | null;
  authorMemberStatus: AuthorMemberStatus;
}

export function formatActivityTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export async function loadActivityFeed(params: {
  groupId?: string | null;
  userId?: string | null;
  limit?: number;
  /** true이면 그룹의 challenge_start ~ challenge_end 기간 내 인증만 (groupId 있을 때만 작동) */
  withinChallengePeriod?: boolean;
}) {
  const { groupId = null, userId = null, limit = 30, withinChallengePeriod = false } = params;

  // 그룹 컨텍스트일 때는 현재 라운드(current_round)만 노출.
  // withinChallengePeriod는 라운드 모델 도입 이전의 날짜 기반 필터로,
  // round_number 도입 후에는 사실상 round_number 필터가 그 역할을 대체한다.
  let currentRound: number | null = null;
  let challengeStart: string | null = null;
  let challengeEnd:   string | null = null;
  if (groupId) {
    const { data: g } = await supabase
      .from("groups")
      .select("current_round, challenge_start, challenge_end")
      .eq("id", groupId)
      .maybeSingle();
    currentRound = g?.current_round ?? 1;
    if (withinChallengePeriod) {
      challengeStart = g?.challenge_start ?? null;
      challengeEnd   = g?.challenge_end   ?? null;
    }
  }

  let query = supabase
    .from("activity_posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (groupId) query = query.eq("group_id", groupId);
  if (currentRound !== null) query = query.eq("round_number", currentRound);
  if (challengeStart) query = query.gte("created_at", challengeStart);
  if (challengeEnd)   query = query.lte("created_at", challengeEnd);

  const { data: posts, error } = await query;
  if (error) throw error;

  const ids = (posts ?? []).map(post => post.id);
  if (!ids.length) return [] as ActivityFeedItem[];

  // 작성자 멤버 상태 (그룹 컨텍스트일 때만, 현재 라운드 기준)
  const memberStatusMap = new Map<string, AuthorMemberStatus>();
  if (groupId && currentRound !== null) {
    const authorIds = Array.from(new Set((posts ?? []).map(p => p.user_id)));
    if (authorIds.length) {
      const { data: members } = await supabase
        .from("group_members")
        .select("user_id, member_status")
        .eq("group_id", groupId)
        .eq("round_number", currentRound)
        .in("user_id", authorIds);
      (members ?? []).forEach(m => {
        memberStatusMap.set(m.user_id, m.member_status as AuthorMemberStatus);
      });
    }
  }

  const { data: reactions, error: reactionsError } = await supabase
    .from("activity_reactions")
    .select("activity_post_id, user_id, emoji")
    .in("activity_post_id", ids);

  if (reactionsError) throw reactionsError;

  const countByPost = new Map<string, number>();
  const myByPost = new Map<string, ActivityEmoji>();

  (reactions ?? []).forEach(reaction => {
    countByPost.set(reaction.activity_post_id, (countByPost.get(reaction.activity_post_id) ?? 0) + 1);
    if (userId && reaction.user_id === userId) {
      myByPost.set(reaction.activity_post_id, reaction.emoji as ActivityEmoji);
    }
  });

  return (posts ?? []).map(post => ({
    ...post,
    reactionCount: countByPost.get(post.id) ?? 0,
    myReaction: myByPost.get(post.id) ?? null,
    authorMemberStatus: groupId ? (memberStatusMap.get(post.user_id) ?? null) : null,
  }));
}
