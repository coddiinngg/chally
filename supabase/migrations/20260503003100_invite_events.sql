CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.invite_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  event_type  TEXT NOT NULL CHECK (event_type IN ('copy_code', 'share_link', 'sms_share', 'suggested_friend_invite')),
  invite_code TEXT NOT NULL,
  target_key  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.invite_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invite_events_select_own" ON public.invite_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "invite_events_insert_own" ON public.invite_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
