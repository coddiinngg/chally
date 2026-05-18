-- join_group_with_ticket: RETURNS TABLE의 participation_tickets 출력 변수와
-- profiles.participation_tickets 컬럼 이름이 충돌해 "ambiguous" 에러 발생.
-- SELECT/UPDATE 쿼리에 테이블 alias를 적용하고, UPDATE RHS는 v_tickets 변수 직접 사용.
CREATE OR REPLACE FUNCTION public.join_group_with_ticket(p_group_id uuid)
RETURNS TABLE(joined boolean, participation_tickets integer, member_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- alias p 사용: RETURNS TABLE의 participation_tickets 변수와 컬럼명 충돌 방지
  SELECT p.participation_tickets INTO v_tickets
  FROM public.profiles p
  WHERE p.id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '프로필을 찾을 수 없습니다.';
  END IF;

  SELECT * INTO v_existing
  FROM public.group_members gm
  WHERE gm.group_id = p_group_id
    AND gm.user_id = v_uid
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

  -- RHS를 v_tickets으로 지정: RETURNING profiles.participation_tickets 대신
  -- 변수를 직접 계산해 컬럼명 모호성 제거
  UPDATE public.profiles
  SET participation_tickets = v_tickets - 1
  WHERE id = v_uid;

  v_tickets := v_tickets - 1;

  INSERT INTO public.group_members (group_id, user_id, member_status)
  VALUES (p_group_id, v_uid, 'ACTIVE');

  RETURN QUERY SELECT TRUE, v_tickets, 'ACTIVE'::TEXT;
END;
$function$;
