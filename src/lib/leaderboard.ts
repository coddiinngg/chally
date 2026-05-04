import { supabase } from "./supabase";
import type { GroupLeaderboardRecord } from "../types/database";

export interface LeaderboardItem {
  rank: number;
  userId: string;
  name: string;
  seed: string;
  avatarUrl: string | null;
  streak: number;
  rate: number;
  totalDone: number;
  isMe: boolean;
}

export async function loadGroupLeaderboard(groupId: string, limit = 30): Promise<LeaderboardItem[]> {
  const { data, error } = await supabase.rpc("get_group_leaderboard", {
    p_group_id: groupId,
    p_limit: limit,
  });

  if (error) throw error;

  return ((data ?? []) as GroupLeaderboardRecord[]).map(row => ({
    rank: row.rank,
    userId: row.user_id,
    name: row.username ?? "챌리 유저",
    seed: row.user_id,
    avatarUrl: row.avatar_url,
    streak: row.streak,
    rate: row.rate,
    totalDone: row.total_done,
    isMe: row.is_me,
  }));
}
