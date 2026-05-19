-- Phase 2: group_members 라운드 유니크 키 + RPC 갱신
-- LEFT/REMOVED는 그 라운드 안에서만 영구. 다음 라운드는 새 row로 재참여 가능.

-- 1. UNIQUE 키 갱신: (group_id, user_id) → (group_id, user_id, round_number)
ALTER TABLE group_members
  DROP CONSTRAINT IF EXISTS group_members_group_id_user_id_key;

ALTER TABLE group_members
  ADD CONSTRAINT group_members_group_user_round_key
  UNIQUE (group_id, user_id, round_number);

-- 2. join_group_with_ticket: 현재 라운드 기준 멤버십만 검사
CREATE OR REPLACE FUNCTION public.join_group_with_ticket(p_group_id uuid)
RETURNS TABLE(joined boolean, participation_tickets integer, member_status text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $function$
DECLARE
  v_uid      UUID := auth.uid();
  v_tickets  INT;
  v_existing public.group_members%ROWTYPE;
  v_group    public.groups%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT * INTO v_group
  FROM public.groups g
  WHERE g.id = p_group_id
    AND g.is_public = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '존재하지 않는 그룹입니다.';
  END IF;

  IF v_group.challenge_end IS NOT NULL AND v_group.challenge_end < NOW() THEN
    RAISE EXCEPTION '이미 종료된 챌린지입니다.';
  END IF;

  SELECT p.participation_tickets INTO v_tickets
  FROM public.profiles p
  WHERE p.id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '프로필을 찾을 수 없습니다.';
  END IF;

  -- 현재 라운드 row만 검사. 과거 라운드 LEFT/REMOVED는 재참여 차단 사유가 아님.
  SELECT * INTO v_existing
  FROM public.group_members gm
  WHERE gm.group_id     = p_group_id
    AND gm.user_id      = v_uid
    AND gm.round_number = v_group.current_round
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.member_status IN ('ACTIVE', 'EXIT_ELIGIBLE') THEN
      RETURN QUERY SELECT TRUE, v_tickets, v_existing.member_status;
      RETURN;
    END IF;

    RAISE EXCEPTION '이번 라운드는 이미 탈퇴했거나 퇴장됐어요. 다음 라운드에 다시 참여할 수 있어요.';
  END IF;

  IF COALESCE(v_tickets, 0) <= 0 THEN
    RAISE EXCEPTION '보유한 참가권이 없습니다.';
  END IF;

  UPDATE public.profiles
  SET participation_tickets = v_tickets - 1
  WHERE id = v_uid;

  v_tickets := v_tickets - 1;

  -- round_number는 BEFORE INSERT 트리거가 groups.current_round를 stamp
  INSERT INTO public.group_members (group_id, user_id, member_status)
  VALUES (p_group_id, v_uid, 'ACTIVE');

  RETURN QUERY SELECT TRUE, v_tickets, 'ACTIVE'::TEXT;
END;
$function$;

-- 3. leave_group: 현재 라운드 row만 LEFT 처리
CREATE OR REPLACE FUNCTION public.leave_group(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_uid           UUID := auth.uid();
  v_rows          INT;
  v_current_round INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT current_round INTO v_current_round
  FROM public.groups WHERE id = p_group_id;

  UPDATE public.group_members
  SET member_status = 'LEFT',
      exit_deadline = NULL
  WHERE group_id     = p_group_id
    AND user_id      = v_uid
    AND round_number = v_current_round
    AND member_status IN ('ACTIVE', 'EXIT_ELIGIBLE');

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows > 0 THEN
    PERFORM public.update_crew_cache(p_group_id);
  END IF;

  RETURN v_rows > 0;
END;
$$;

-- 4. claim_participation_benefit: 미수령 라운드 중 가장 오래된 것부터 수령
--    과거 라운드 미수령분도 수령 가능 (자산 보존 원칙).
--    NOTE: 과거 라운드 정확한 기간 정보는 현재 모델에선 groups row의 최신 값만 사용함.
--    회차별 기간 스냅샷이 필요하면 Phase 3에서 추가.
CREATE OR REPLACE FUNCTION public.claim_participation_benefit(p_group_id UUID)
RETURNS TABLE (
  granted_tickets INT,
  participation_tickets INT,
  benefit_claimed_at TIMESTAMPTZ,
  already_claimed BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_member    public.group_members%ROWTYPE;
  v_group     public.groups%ROWTYPE;
  v_days      INT;
  v_done      INT;
  v_my_rate   INT;
  v_grant     INT := 0;
  v_claimed_at TIMESTAMPTZ;
  v_tickets   INT;
  v_has_any   BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT * INTO v_group FROM public.groups WHERE id = p_group_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '존재하지 않는 그룹입니다.';
  END IF;

  SELECT * INTO v_member
  FROM public.group_members
  WHERE group_id           = p_group_id
    AND user_id            = v_uid
    AND benefit_claimed_at IS NULL
  ORDER BY round_number ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    SELECT TRUE INTO v_has_any
    FROM public.group_members
    WHERE group_id = p_group_id AND user_id = v_uid
    LIMIT 1;

    IF NOT v_has_any THEN
      RAISE EXCEPTION '참여 기록이 없습니다.';
    END IF;

    SELECT * INTO v_member
    FROM public.group_members
    WHERE group_id = p_group_id AND user_id = v_uid
    ORDER BY round_number DESC
    LIMIT 1;

    SELECT participation_tickets INTO v_tickets
    FROM public.profiles WHERE id = v_uid;

    RETURN QUERY SELECT 0, COALESCE(v_tickets, 0), v_member.benefit_claimed_at, TRUE;
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
    WHERE group_id     = p_group_id
      AND user_id      = v_uid
      AND round_number = v_member.round_number
      AND status       = 'completed';

    v_my_rate := LEAST(100, ROUND(COALESCE(v_done, 0)::DOUBLE PRECISION / v_days * 100)::INT);

    IF COALESCE(v_group.crew_rate, 0) >= 0.5 THEN
      IF   v_my_rate >= 100 THEN v_grant := 3;
      ELSIF v_my_rate >= 80  THEN v_grant := 2;
      ELSIF v_my_rate >= 50  THEN v_grant := 1;
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

-- 5. update_member_statuses(cron): 현재 라운드 row만 처리
CREATE OR REPLACE FUNCTION update_member_statuses(p_group_id UUID DEFAULT NULL)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_updated INT := 0;
  v_cnt     INT;
BEGIN
  WITH changed AS (
    UPDATE group_members gm
    SET member_status = 'EXIT_ELIGIBLE',
        exit_deadline = NOW() + INTERVAL '24 hours'
    FROM groups g
    WHERE gm.group_id        = g.id
      AND gm.round_number    = g.current_round
      AND gm.member_status   = 'ACTIVE'
      AND gm.is_contributor  = TRUE
      AND COALESCE(gm.last_verified_at, gm.joined_at) < NOW() - INTERVAL '48 hours'
      AND (p_group_id IS NULL OR gm.group_id = p_group_id)
    RETURNING gm.user_id, gm.group_id, gm.exit_deadline
  )
  INSERT INTO notifications (user_id, type, title, body, emoji, related_id)
  SELECT c.user_id, 'member_warning', '퇴장경고',
         '48시간 이상 미인증으로 퇴장경고 상태가 됐어요. 24시간 이내에 인증하지 않으면 ' || g.name || '에서 퇴장돼요.',
         '⚠️', c.group_id::TEXT
  FROM changed c JOIN groups g ON g.id = c.group_id;

  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_updated := v_updated + v_cnt;

  WITH changed AS (
    UPDATE group_members gm
    SET member_status = 'REMOVED',
        removed_at    = NOW(),
        exit_deadline = NULL
    FROM groups g
    WHERE gm.group_id       = g.id
      AND gm.round_number   = g.current_round
      AND gm.member_status  = 'EXIT_ELIGIBLE'
      AND gm.exit_deadline IS NOT NULL
      AND gm.exit_deadline  < NOW()
      AND (p_group_id IS NULL OR gm.group_id = p_group_id)
    RETURNING gm.user_id, gm.group_id
  )
  INSERT INTO notifications (user_id, type, title, body, emoji, related_id)
  SELECT c.user_id, 'member_removed', '그룹에서 퇴장됐어요',
         g.name || '에서 72시간 미인증으로 자동 퇴장 처리됐어요.',
         '🚪', c.group_id::TEXT
  FROM changed c JOIN groups g ON g.id = c.group_id;

  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_updated := v_updated + v_cnt;

  RETURN v_updated;
END;
$$;
