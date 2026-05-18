-- ============================================================
-- 복구권(recovery_tickets) → 참가권(participation_tickets) 마이그레이션
-- - profiles.recovery_tickets → participation_tickets (default 5)
-- - 이미 participation_tickets가 있으면 값을 유지
-- - group_members.benefit_claimed_at 추가 (등급별 참가권 지급 멱등성)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'recovery_tickets'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'participation_tickets'
  ) THEN
    ALTER TABLE public.profiles
      RENAME COLUMN recovery_tickets TO participation_tickets;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'participation_tickets'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN participation_tickets INT DEFAULT 5;
  END IF;
END;
$$;

ALTER TABLE public.profiles
  ALTER COLUMN participation_tickets SET DEFAULT 5;

UPDATE public.profiles
  SET participation_tickets = 5
  WHERE participation_tickets IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN participation_tickets SET NOT NULL;

ALTER TABLE public.group_members
  ADD COLUMN IF NOT EXISTS benefit_claimed_at TIMESTAMPTZ;
