import { supabase } from "./supabase";
import type { ActivityPostRecord, ActivityReactionRecord } from "../types/database";

export type ActivityEmoji = ActivityReactionRecord["emoji"];

export interface ActivityFeedItem extends ActivityPostRecord {
  reactionCount: number;
  myReaction: ActivityEmoji | null;
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
}) {
  const { groupId = null, userId = null, limit = 30 } = params;
  let query = supabase
    .from("activity_posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (groupId) query = query.eq("group_id", groupId);

  const { data: posts, error } = await query;
  if (error) throw error;

  const ids = (posts ?? []).map(post => post.id);
  if (!ids.length) return [] as ActivityFeedItem[];

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
  }));
}
