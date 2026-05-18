-- ============================================================
-- account_deletion_requests 감사 로그 보존
-- user_id FK: ON DELETE CASCADE → SET NULL
-- 사용자가 삭제돼도 "언제 삭제됐는지" row가 남도록 변경
-- ============================================================

ALTER TABLE public.account_deletion_requests
  DROP CONSTRAINT IF EXISTS account_deletion_requests_user_id_fkey;

ALTER TABLE public.account_deletion_requests
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.account_deletion_requests
  ADD CONSTRAINT account_deletion_requests_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
