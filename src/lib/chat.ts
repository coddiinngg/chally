import { supabase } from "./supabase";
import type { GroupMessageRecord, GroupMessageReactionRecord } from "../types/database";

export type MessageEmoji = GroupMessageReactionRecord["emoji"];

export interface GroupChatMessage extends GroupMessageRecord {
  myReaction: MessageEmoji | null;
}

export function formatChatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export async function loadGroupMessages(params: {
  groupId: string;
  userId?: string | null;
  limit?: number;
}) {
  const { groupId, userId = null, limit = 50 } = params;

  const { data: groupRow } = await supabase
    .from("groups")
    .select("current_round")
    .eq("id", groupId)
    .maybeSingle();
  const currentRound = groupRow?.current_round ?? 1;

  const { data: rows, error } = await supabase
    .from("group_messages")
    .select("*")
    .eq("group_id", groupId)
    .eq("round_number", currentRound)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const messages = [...(rows ?? [])].reverse();
  const ids = messages.map(message => message.id);
  if (!ids.length) return [] as GroupChatMessage[];

  const { data: reactions, error: reactionsError } = await supabase
    .from("group_message_reactions")
    .select("message_id, user_id, emoji")
    .in("message_id", ids);

  if (reactionsError) throw reactionsError;

  const myByMessage = new Map<string, MessageEmoji>();
  (reactions ?? []).forEach(reaction => {
    if (userId && reaction.user_id === userId) {
      myByMessage.set(reaction.message_id, reaction.emoji as MessageEmoji);
    }
  });

  return messages.map(message => ({
    ...message,
    myReaction: myByMessage.get(message.id) ?? null,
  }));
}
