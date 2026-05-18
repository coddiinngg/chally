-- ============================================================
-- 출시 전 쓰기 권한 보강
-- - 클라이언트 직접 쓰기 범위를 줄이고 신뢰 값은 RPC에서만 변경
-- - 참가권 차감 + 그룹 가입, 자발적 탈퇴, 혜택 수령을 서버 원자 처리
-- - 계정 삭제 요청 접수 테이블/RPC 추가
-- ============================================================

-- 1. 계정 삭제 요청
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'completed', 'cancelled')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  note         TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS account_deletion_requests_one_pending
  ON public.account_deletion_requests (user_id)
  WHERE status = 'pending';

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "account_deletion_requests_select_own" ON public.account_deletion_requests;
CREATE POLICY "account_deletion_requests_select_own"
  ON public.account_deletion_requests
  FOR SELECT
  USING (auth.uid() = user_id);

-- 2. 클라이언트 직접 쓰기 정책 축소
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "verifications_insert" ON public.verifications;
DROP POLICY IF EXISTS "verifications_update" ON public.verifications;
DROP POLICY IF EXISTS "verifications_delete" ON public.verifications;
DROP POLICY IF EXISTS "groups_insert" ON public.groups;
DROP POLICY IF EXISTS "groups_update" ON public.groups;
DROP POLICY IF EXISTS "groups_delete" ON public.groups;
DROP POLICY IF EXISTS "group_members_insert" ON public.group_members;
DROP POLICY IF EXISTS "group_members_update" ON public.group_members;
DROP POLICY IF EXISTS "group_members_delete" ON public.group_members;

-- 3. 프로필 기본 정보 수정 RPC
CREATE OR REPLACE FUNCTION public.update_profile_basic(
  p_username TEXT,
  p_avatar_url TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  UPDATE public.profiles
  SET username   = NULLIF(BTRIM(p_username), ''),
      avatar_url = COALESCE(p_avatar_url, avatar_url)
  WHERE id = v_uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_profile_basic(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_profile_basic(TEXT, TEXT) TO authenticated;

-- 4. 참가권 차감 + 그룹 가입 RPC
CREATE OR REPLACE FUNCTION public.join_group_with_ticket(p_group_id UUID)
RETURNS TABLE (
  joined BOOLEAN,
  participation_tickets INT,
  member_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_tickets INT;
  v_existing public.group_members%ROWTYPE;
  v_group public.groups%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT * INTO v_group
  FROM public.groups
  WHERE id = p_group_id
    AND is_public = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '존재하지 않는 그룹입니다.';
  END IF;

  IF v_group.challenge_end IS NOT NULL AND v_group.challenge_end < NOW() THEN
    RAISE EXCEPTION '이미 종료된 챌린지입니다.';
  END IF;

  SELECT participation_tickets INTO v_tickets
  FROM public.profiles
  WHERE id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '프로필을 찾을 수 없습니다.';
  END IF;

  SELECT * INTO v_existing
  FROM public.group_members
  WHERE group_id = p_group_id
    AND user_id = v_uid
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.member_status IN ('ACTIVE', 'EXIT_ELIGIBLE') THEN
      RETURN QUERY SELECT TRUE, v_tickets, v_existing.member_status;
      RETURN;
    END IF;

    RAISE EXCEPTION '이미 탈퇴했거나 퇴장된 그룹에는 다시 참여할 수 없습니다.';
  END IF;

  IF COALESCE(v_tickets, 0) <= 0 THEN
    RAISE EXCEPTION '보유한 참가권이 없습니다.';
  END IF;

  UPDATE public.profiles
  SET participation_tickets = participation_tickets - 1
  WHERE id = v_uid
  RETURNING profiles.participation_tickets INTO v_tickets;

  INSERT INTO public.group_members (group_id, user_id, member_status)
  VALUES (p_group_id, v_uid, 'ACTIVE');

  RETURN QUERY SELECT TRUE, v_tickets, 'ACTIVE'::TEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.join_group_with_ticket(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_group_with_ticket(UUID) TO authenticated;

-- 5. 자발적 탈퇴 RPC
CREATE OR REPLACE FUNCTION public.leave_group(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_rows INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  UPDATE public.group_members
  SET member_status = 'LEFT',
      exit_deadline = NULL
  WHERE group_id = p_group_id
    AND user_id = v_uid
    AND member_status IN ('ACTIVE', 'EXIT_ELIGIBLE');

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows > 0 THEN
    PERFORM public.update_crew_cache(p_group_id);
  END IF;

  RETURN v_rows > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.leave_group(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_group(UUID) TO authenticated;

-- 6. 챌린지 결과 혜택 수령 RPC
CREATE OR REPLACE FUNCTION public.claim_participation_benefit(p_group_id UUID)
RETURNS TABLE (
  granted_tickets INT,
  participation_tickets INT,
  benefit_claimed_at TIMESTAMPTZ,
  already_claimed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_member public.group_members%ROWTYPE;
  v_group public.groups%ROWTYPE;
  v_days INT;
  v_done INT;
  v_my_rate INT;
  v_grant INT := 0;
  v_claimed_at TIMESTAMPTZ;
  v_tickets INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT * INTO v_group
  FROM public.groups
  WHERE id = p_group_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '존재하지 않는 그룹입니다.';
  END IF;

  SELECT * INTO v_member
  FROM public.group_members
  WHERE group_id = p_group_id
    AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '참여 기록이 없습니다.';
  END IF;

  IF v_member.benefit_claimed_at IS NOT NULL THEN
    SELECT participation_tickets INTO v_tickets
    FROM public.profiles
    WHERE id = v_uid;

    RETURN QUERY SELECT
      0,
      COALESCE(v_tickets, 0),
      v_member.benefit_claimed_at,
      TRUE;
    RETURN;
  END IF;

  IF v_group.challenge_start IS NOT NULL
     AND v_group.challenge_end IS NOT NULL
     AND v_member.joined_at < (
       v_group.challenge_start
       + ((EXTRACT(EPOCH FROM (v_group.challenge_end - v_group.challenge_start)) / 2) * INTERVAL '1 second')
     ) THEN
    v_days := GREATEST(1, ROUND(EXTRACT(EPOCH FROM (v_group.challenge_end - v_group.challenge_start)) / 86400)::INT);

    SELECT COUNT(DISTINCT (verified_at AT TIME ZONE 'Asia/Seoul')::date)::INT
      INTO v_done
    FROM public.verifications
    WHERE group_id = p_group_id
      AND user_id = v_uid
      AND status = 'completed'
      AND verified_at >= v_group.challenge_start
      AND verified_at <= v_group.challenge_end;

    v_my_rate := LEAST(100, ROUND(COALESCE(v_done, 0)::DOUBLE PRECISION / v_days * 100)::INT);

    IF COALESCE(v_group.crew_rate, 0) >= 0.5 THEN
      IF v_my_rate >= 100 THEN
        v_grant := 3;
      ELSIF v_my_rate >= 80 THEN
        v_grant := 2;
      ELSIF v_my_rate >= 50 THEN
        v_grant := 1;
      END IF;
    END IF;
  END IF;

  v_claimed_at := NOW();

  UPDATE public.group_members
  SET benefit_claimed_at = v_claimed_at
  WHERE id = v_member.id;

  UPDATE public.profiles
  SET participation_tickets = participation_tickets + v_grant
  WHERE id = v_uid
  RETURNING profiles.participation_tickets INTO v_tickets;

  RETURN QUERY SELECT v_grant, COALESCE(v_tickets, 0), v_claimed_at, FALSE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_participation_benefit(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_participation_benefit(UUID) TO authenticated;

-- 7. 계정 삭제 요청 RPC
CREATE OR REPLACE FUNCTION public.request_account_deletion()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_request_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT id INTO v_request_id
  FROM public.account_deletion_requests
  WHERE user_id = v_uid
    AND status = 'pending'
  ORDER BY requested_at DESC
  LIMIT 1;

  IF v_request_id IS NOT NULL THEN
    RETURN v_request_id;
  END IF;

  INSERT INTO public.account_deletion_requests (user_id)
  VALUES (v_uid)
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_account_deletion() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_account_deletion() TO authenticated;
