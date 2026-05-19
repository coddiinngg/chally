export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          avatar_url: string | null;
          plan_type: 'free' | 'premium';
          streak_count: number;
          participation_tickets: number;
          xp_total: number;
          invite_code: string | null;
          referred_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          avatar_url?: string | null;
          plan_type?: 'free' | 'premium';
          streak_count?: number;
          participation_tickets?: number;
          xp_total?: number;
          invite_code?: string | null;
          referred_by?: string | null;
        };
        Update: Partial<Omit<Database['public']['Tables']['profiles']['Insert'], 'id'>>;
        Relationships: [];
      };
      account_deletion_requests: {
        Row: {
          id: string;
          user_id: string;
          status: 'pending' | 'completed' | 'cancelled';
          requested_at: string;
          completed_at: string | null;
          note: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          status?: 'pending' | 'completed' | 'cancelled';
          requested_at?: string;
          completed_at?: string | null;
          note?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      verifications: {
        Row: {
          id: string;
          user_id: string;
          group_id: string | null;
          verify_type: string | null;
          verified_at: string;
          photo_url: string | null;
          status: 'completed' | 'skipped';
          xp_earned: number;
          round_number: number | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          group_id?: string | null;
          verify_type?: string | null;
          verified_at?: string;
          photo_url?: string | null;
          status?: 'completed' | 'skipped';
          xp_earned?: number;
        };
        Update: Partial<Pick<Database['public']['Tables']['verifications']['Insert'], 'group_id' | 'verify_type' | 'photo_url' | 'status' | 'xp_earned'>>;
        Relationships: [];
      };
      groups: {
        Row: {
          id: string;
          legacy_id: string | null;
          name: string;
          emoji: string;
          description: string | null;
          category: string | null;
          member_count: number;
          rule: string | null;
          goal: string | null;
          verify_type: string;
          cover: string | null;
          max_members: number;
          is_public: boolean;
          created_by: string | null;
          created_at: string;
          recruit_start: string | null;
          recruit_end: string | null;
          challenge_start: string | null;
          challenge_end: string | null;
          crew_rate: number;
          crew_grade: string;
          current_round: number;
        };
        Insert: {
          id?: string;
          legacy_id?: string | null;
          name: string;
          emoji?: string;
          description?: string | null;
          category?: string | null;
          member_count?: number;
          rule?: string | null;
          goal?: string | null;
          verify_type?: string;
          cover?: string | null;
          max_members?: number;
          is_public?: boolean;
          created_by?: string | null;
          recruit_start?: string | null;
          recruit_end?: string | null;
          challenge_start?: string | null;
          challenge_end?: string | null;
          crew_rate?: number;
          crew_grade?: string;
          current_round?: number;
        };
        Update: Partial<Omit<Database['public']['Tables']['groups']['Insert'], 'created_by' | 'id'>>;
        Relationships: [];
      };
      group_members: {
        Row: {
          id: string;
          group_id: string;
          user_id: string;
          role: 'admin' | 'member';
          joined_at: string;
          last_verified_at: string | null;
          is_contributor: boolean;
          member_status: 'ACTIVE' | 'EXIT_ELIGIBLE' | 'REMOVED' | 'LEFT';
          exit_deadline: string | null;
          removed_at: string | null;
          join_day: number;
          benefit_claimed_at: string | null;
          round_number: number;
        };
        Insert: {
          id?: string;
          group_id: string;
          user_id: string;
          role?: 'admin' | 'member';
          last_verified_at?: string | null;
          is_contributor?: boolean;
          member_status?: 'ACTIVE' | 'EXIT_ELIGIBLE' | 'REMOVED' | 'LEFT';
          exit_deadline?: string | null;
          removed_at?: string | null;
          join_day?: number;
          benefit_claimed_at?: string | null;
        };
        Update: Pick<Database['public']['Tables']['group_members']['Insert'], 'role' | 'member_status' | 'benefit_claimed_at'>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: 'goal' | 'badge' | 'group' | 'rank' | 'streak';
          title: string;
          body: string;
          emoji: string | null;
          actionable: boolean;
          action_done: boolean;
          read_at: string | null;
          created_at: string;
          related_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: 'goal' | 'badge' | 'group' | 'rank' | 'streak';
          title: string;
          body: string;
          emoji?: string | null;
          actionable?: boolean;
          action_done?: boolean;
          read_at?: string | null;
          related_id?: string | null;
        };
        Update: Partial<Pick<Database['public']['Tables']['notifications']['Row'], 'read_at' | 'action_done'>>;
        Relationships: [];
      };
      notification_settings: {
        Row: {
          user_id: string;
          daily_enabled: boolean;
          daily_time: string;
          challenge_enabled: boolean;
          weekly_report_enabled: boolean;
          achievement_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          daily_enabled?: boolean;
          daily_time?: string;
          challenge_enabled?: boolean;
          weekly_report_enabled?: boolean;
          achievement_enabled?: boolean;
        };
        Update: Partial<Omit<Database['public']['Tables']['notification_settings']['Insert'], 'user_id'>>;
        Relationships: [];
      };
      challenge_suggestions: {
        Row: {
          id: string;
          title: string;
          description: string;
          status: '투표중' | '개발확정' | '검토중';
          category: '운동/건강' | '독서/공부' | '생산성' | '마음챙김' | '식습관' | '기타';
          duration: '7일' | '21일' | '30일';
          verify_method: string | null;
          cover_url: string | null;
          operator_comment: string | null;
          created_by: string | null;
          votes_count: number;
          comments_count: number;
          agree_rate: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description: string;
          status?: '투표중' | '개발확정' | '검토중';
          category: '운동/건강' | '독서/공부' | '생산성' | '마음챙김' | '식습관' | '기타';
          duration: '7일' | '21일' | '30일';
          verify_method?: string | null;
          cover_url?: string | null;
          operator_comment?: string | null;
          created_by?: string | null;
          votes_count?: number;
          comments_count?: number;
          agree_rate?: number;
        };
        Update: Partial<Omit<Database['public']['Tables']['challenge_suggestions']['Insert'], 'id' | 'created_by'>>;
        Relationships: [];
      };
      challenge_suggestion_votes: {
        Row: {
          suggestion_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          suggestion_id: string;
          user_id: string;
        };
        Update: never;
        Relationships: [];
      };
      challenge_suggestion_comments: {
        Row: {
          id: string;
          suggestion_id: string;
          user_id: string;
          author_name: string | null;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          suggestion_id: string;
          user_id: string;
          author_name?: string | null;
          body: string;
        };
        Update: never;
        Relationships: [];
      };
      challenge_suggestion_subscriptions: {
        Row: {
          suggestion_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          suggestion_id: string;
          user_id: string;
        };
        Update: never;
        Relationships: [];
      };
      referrals: {
        Row: {
          id: string;
          inviter_id: string;
          referred_id: string;
          invite_code: string;
          xp_awarded: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          inviter_id: string;
          referred_id: string;
          invite_code: string;
          xp_awarded?: number;
        };
        Update: never;
        Relationships: [];
      };
      challenge_reopen_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          group_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          group_id: string;
        };
        Update: never;
        Relationships: [];
      };
      friend_invites: {
        Row: {
          id: string;
          invited_by: string;
          target_key: string;
          target_name: string;
          target_handle: string | null;
          invite_code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          invited_by: string;
          target_key: string;
          target_name: string;
          target_handle?: string | null;
          invite_code: string;
        };
        Update: never;
        Relationships: [];
      };
      invite_events: {
        Row: {
          id: string;
          user_id: string;
          event_type: 'copy_code' | 'share_link' | 'sms_share' | 'suggested_friend_invite';
          invite_code: string;
          target_key: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_type: 'copy_code' | 'share_link' | 'sms_share' | 'suggested_friend_invite';
          invite_code: string;
          target_key?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      activity_posts: {
        Row: {
          id: string;
          group_id: string;
          user_id: string;
          verification_id: string | null;
          verify_type: string;
          photo_url: string | null;
          message: string;
          author_name: string | null;
          author_avatar_url: string | null;
          created_at: string;
          round_number: number;
        };
        Insert: {
          id?: string;
          group_id: string;
          user_id: string;
          verification_id?: string | null;
          verify_type: string;
          photo_url?: string | null;
          message: string;
          author_name?: string | null;
          author_avatar_url?: string | null;
        };
        Update: Partial<Pick<Database['public']['Tables']['activity_posts']['Insert'], 'message' | 'author_name' | 'author_avatar_url'>>;
        Relationships: [];
      };
      activity_reactions: {
        Row: {
          activity_post_id: string;
          user_id: string;
          emoji: '❤️' | '🔥' | '👍' | '😂' | '😮' | '🎉';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          activity_post_id: string;
          user_id: string;
          emoji: '❤️' | '🔥' | '👍' | '😂' | '😮' | '🎉';
        };
        Update: Pick<Database['public']['Tables']['activity_reactions']['Insert'], 'emoji'>;
        Relationships: [];
      };
      group_messages: {
        Row: {
          id: string;
          group_id: string;
          user_id: string;
          body: string;
          author_name: string | null;
          author_avatar_url: string | null;
          created_at: string;
          round_number: number;
        };
        Insert: {
          id?: string;
          group_id: string;
          user_id: string;
          body: string;
          author_name?: string | null;
          author_avatar_url?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      group_message_reactions: {
        Row: {
          message_id: string;
          user_id: string;
          emoji: '❤️' | '😂' | '🔥' | '👍' | '😮' | '🎉';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          message_id: string;
          user_id: string;
          emoji: '❤️' | '😂' | '🔥' | '👍' | '😮' | '🎉';
        };
        Update: Pick<Database['public']['Tables']['group_message_reactions']['Insert'], 'emoji'>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      claim_participation_benefit: {
        Args: { p_group_id: string };
        Returns: {
          granted_tickets: number;
          participation_tickets: number;
          benefit_claimed_at: string;
          already_claimed: boolean;
        }[];
      };
      get_crew_status: {
        Args: { p_group_id: string };
        Returns: {
          crew_rate: number;
          crew_grade: string;
          contributor_count: number;
          active_count: number;
          removed_count: number;
          my_status: string | null;
          my_is_contributor: boolean;
          my_exit_deadline: string | null;
        }[];
      };
      get_group_leaderboard: {
        Args: {
          p_group_id: string;
          p_limit?: number;
        };
        Returns: {
          rank: number;
          user_id: string;
          username: string | null;
          avatar_url: string | null;
          total_done: number;
          recent_done: number;
          rate: number;
          streak: number;
          is_me: boolean;
        }[];
      };
      get_public_profile: {
        Args: {
          p_user_id: string;
        };
        Returns: {
          id: string;
          username: string | null;
          avatar_url: string | null;
          streak_count: number;
          xp_total: number;
          verification_total: number;
          verification_rate: number;
          joined_groups: { id: string; name: string }[];
          past_groups: {
            id: string;
            name: string;
            emoji: string;
            cover: string | null;
            crew_rate: number;
            crew_grade: string;
            challenge_end: string | null;
          }[];
        }[];
      };
      join_group_with_ticket: {
        Args: { p_group_id: string };
        Returns: {
          joined: boolean;
          participation_tickets: number;
          member_status: string;
        }[];
      };
      leave_group: {
        Args: { p_group_id: string };
        Returns: boolean;
      };
      request_account_deletion: {
        Args: Record<never, never>;
        Returns: string;
      };
      search_public_profiles: {
        Args: {
          p_query: string;
          p_limit?: number;
        };
        Returns: {
          id: string;
          username: string | null;
          avatar_url: string | null;
        }[];
      };
      update_profile_basic: {
        Args: {
          p_username: string | null;
          p_avatar_url: string | null;
        };
        Returns: void;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

// 편의 타입
export type Profile    = Database['public']['Tables']['profiles']['Row'];
export type AccountDeletionRequest = Database['public']['Tables']['account_deletion_requests']['Row'];
export type Verification = Database['public']['Tables']['verifications']['Row'];
export type Group      = Database['public']['Tables']['groups']['Row'];
export type GroupMember = Database['public']['Tables']['group_members']['Row'];
export type NotificationRecord = Database['public']['Tables']['notifications']['Row'];
export type NotificationSettingsRecord = Database['public']['Tables']['notification_settings']['Row'];
export type ChallengeSuggestionRecord = Database['public']['Tables']['challenge_suggestions']['Row'];
export type ChallengeSuggestionCommentRecord = Database['public']['Tables']['challenge_suggestion_comments']['Row'];
export type ReferralRecord = Database['public']['Tables']['referrals']['Row'];
export type FriendInviteRecord = Database['public']['Tables']['friend_invites']['Row'];
export type InviteEventRecord = Database['public']['Tables']['invite_events']['Row'];
export type ActivityPostRecord = Database['public']['Tables']['activity_posts']['Row'];
export type ActivityReactionRecord = Database['public']['Tables']['activity_reactions']['Row'];
export type GroupMessageRecord = Database['public']['Tables']['group_messages']['Row'];
export type GroupMessageReactionRecord = Database['public']['Tables']['group_message_reactions']['Row'];
export type GroupLeaderboardRecord = Database['public']['Functions']['get_group_leaderboard']['Returns'][number];
export type PublicProfileRecord = Database['public']['Functions']['get_public_profile']['Returns'][number];
export type PublicProfileSearchRecord = Database['public']['Functions']['search_public_profiles']['Returns'][number];
