CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.referrals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id   UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  referred_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  invite_code  TEXT NOT NULL,
  xp_awarded   INT DEFAULT 50,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  CHECK (inviter_id <> referred_id)
);

CREATE TABLE IF NOT EXISTS public.friend_invites (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invited_by     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  target_key     TEXT NOT NULL,
  target_name    TEXT NOT NULL,
  target_handle  TEXT,
  invite_code    TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (invited_by, target_key)
);

CREATE OR REPLACE FUNCTION public.default_invite_code(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'CHALLY-' || upper(substr(replace(p_user_id::text, '-', ''), 1, 8));
$$;

UPDATE public.profiles
SET invite_code = public.default_invite_code(id)
WHERE invite_code IS NULL;

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrals_select_related" ON public.referrals
  FOR SELECT USING (auth.uid() = inviter_id OR auth.uid() = referred_id);

CREATE POLICY "friend_invites_select_own" ON public.friend_invites
  FOR SELECT USING (auth.uid() = invited_by);

CREATE POLICY "friend_invites_insert_own" ON public.friend_invites
  FOR INSERT WITH CHECK (auth.uid() = invited_by);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  ref_code TEXT;
  inviter UUID;
BEGIN
  ref_code := NULLIF(NEW.raw_user_meta_data->>'ref', '');

  SELECT id INTO inviter
  FROM public.profiles
  WHERE invite_code = ref_code
  LIMIT 1;

  INSERT INTO public.profiles (id, username, avatar_url, invite_code, referred_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    public.default_invite_code(NEW.id),
    CASE WHEN inviter IS NOT NULL AND inviter <> NEW.id THEN inviter ELSE NULL END
  );

  IF inviter IS NOT NULL AND inviter <> NEW.id THEN
    INSERT INTO public.referrals (inviter_id, referred_id, invite_code, xp_awarded)
    VALUES (inviter, NEW.id, ref_code, 50)
    ON CONFLICT (referred_id) DO NOTHING;

    UPDATE public.profiles
    SET xp_total = COALESCE(xp_total, 0) + 50
    WHERE id IN (inviter, NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
