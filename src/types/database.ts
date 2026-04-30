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
          recovery_tickets: number;
          xp_total: number;
          joined_group_ids: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          avatar_url?: string | null;
          plan_type?: 'free' | 'premium';
          streak_count?: number;
          recovery_tickets?: number;
          xp_total?: number;
          joined_group_ids?: string[];
        };
        Update: Partial<Omit<Database['public']['Tables']['profiles']['Insert'], 'id'>>;
        Relationships: [];
      };
      goals: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          category: string;
          icon_name: string | null;
          frequency: 'daily' | 'weekly';
          frequency_days: number[] | null;
          reminder_time: string | null;
          status: 'active' | 'completed' | 'paused';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          category: string;
          icon_name?: string | null;
          frequency?: 'daily' | 'weekly';
          frequency_days?: number[] | null;
          reminder_time?: string | null;
          status?: 'active' | 'completed' | 'paused';
        };
        Update: Partial<Omit<Database['public']['Tables']['goals']['Insert'], 'user_id' | 'id'>>;
        Relationships: [];
      };
      verifications: {
        Row: {
          id: string;
          goal_id: string;
          user_id: string;
          verified_at: string;
          photo_url: string | null;
          status: 'completed' | 'skipped';
          xp_earned: number;
        };
        Insert: {
          id?: string;
          goal_id: string;
          user_id: string;
          verified_at?: string;
          photo_url?: string | null;
          status?: 'completed' | 'skipped';
          xp_earned?: number;
        };
        Update: Partial<Pick<Database['public']['Tables']['verifications']['Insert'], 'photo_url' | 'status' | 'xp_earned'>>;
        Relationships: [];
      };
      groups: {
        Row: {
          id: string;
          name: string;
          emoji: string;
          description: string | null;
          category: string | null;
          max_members: number;
          is_public: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          emoji?: string;
          description?: string | null;
          category?: string | null;
          max_members?: number;
          is_public?: boolean;
          created_by?: string | null;
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
        };
        Insert: {
          id?: string;
          group_id: string;
          user_id: string;
          role?: 'admin' | 'member';
        };
        Update: Pick<Database['public']['Tables']['group_members']['Insert'], 'role'>;
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
      snooze_records: {
        Row: {
          id: string;
          goal_id: string;
          user_id: string;
          reason: string | null;
          snoozed_at: string;
        };
        Insert: {
          id?: string;
          goal_id: string;
          user_id: string;
          reason?: string | null;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

// 편의 타입
export type Profile    = Database['public']['Tables']['profiles']['Row'];
export type Goal       = Database['public']['Tables']['goals']['Row'];
export type Verification = Database['public']['Tables']['verifications']['Row'];
export type Group      = Database['public']['Tables']['groups']['Row'];
export type GroupMember = Database['public']['Tables']['group_members']['Row'];
export type SnoozeRecord = Database['public']['Tables']['snooze_records']['Row'];
export type NotificationRecord = Database['public']['Tables']['notifications']['Row'];
