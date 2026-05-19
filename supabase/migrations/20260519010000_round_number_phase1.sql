-- Phase 1: 라운드 모델 도입
-- 같은 groups row를 재사용하면서 라운드를 구분하기 위한 round_number 컬럼 추가.
-- 기존 데이터는 모두 round 1로 백필. 새 INSERT 시 BEFORE INSERT 트리거가
-- groups.current_round 값을 자동으로 박는다.
-- 이전에 도입한 챌린지 재시작 시 채팅 DELETE 동작은 제거 (자산 보존 원칙).

-- 1. groups.current_round
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS current_round INT NOT NULL DEFAULT 1;

-- 2. 라운드별 데이터 테이블에 round_number 컬럼 추가
ALTER TABLE group_messages  ADD COLUMN IF NOT EXISTS round_number INT;
ALTER TABLE activity_posts  ADD COLUMN IF NOT EXISTS round_number INT;
ALTER TABLE verifications   ADD COLUMN IF NOT EXISTS round_number INT;
ALTER TABLE group_members   ADD COLUMN IF NOT EXISTS round_number INT;

-- 3. 백필 (기존 데이터 = round 1)
UPDATE group_messages  SET round_number = 1 WHERE round_number IS NULL;
UPDATE activity_posts  SET round_number = 1 WHERE round_number IS NULL;
UPDATE group_members   SET round_number = 1 WHERE round_number IS NULL;
UPDATE verifications   SET round_number = 1
  WHERE round_number IS NULL AND group_id IS NOT NULL;

-- 4. NOT NULL (항상 group_id가 있는 테이블)
ALTER TABLE group_messages ALTER COLUMN round_number SET NOT NULL;
ALTER TABLE activity_posts ALTER COLUMN round_number SET NOT NULL;
ALTER TABLE group_members  ALTER COLUMN round_number SET NOT NULL;
-- verifications.round_number는 NULL 허용 (group_id IS NULL인 개인 인증 대응)

-- 5. BEFORE INSERT 트리거: groups.current_round 값을 자동 stamp
CREATE OR REPLACE FUNCTION trg_fn_stamp_round_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.round_number IS NULL AND NEW.group_id IS NOT NULL THEN
    SELECT current_round INTO NEW.round_number
    FROM groups WHERE id = NEW.group_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_round_number_group_messages ON group_messages;
CREATE TRIGGER trg_stamp_round_number_group_messages
  BEFORE INSERT ON group_messages
  FOR EACH ROW EXECUTE FUNCTION trg_fn_stamp_round_number();

DROP TRIGGER IF EXISTS trg_stamp_round_number_activity_posts ON activity_posts;
CREATE TRIGGER trg_stamp_round_number_activity_posts
  BEFORE INSERT ON activity_posts
  FOR EACH ROW EXECUTE FUNCTION trg_fn_stamp_round_number();

DROP TRIGGER IF EXISTS trg_stamp_round_number_verifications ON verifications;
CREATE TRIGGER trg_stamp_round_number_verifications
  BEFORE INSERT ON verifications
  FOR EACH ROW EXECUTE FUNCTION trg_fn_stamp_round_number();

DROP TRIGGER IF EXISTS trg_stamp_round_number_group_members ON group_members;
CREATE TRIGGER trg_stamp_round_number_group_members
  BEFORE INSERT ON group_members
  FOR EACH ROW EXECUTE FUNCTION trg_fn_stamp_round_number();

-- 6. 챌린지 재시작 트리거에서 채팅 DELETE 제거
--    라운드 모델에서는 데이터 보존 + UI 필터로 비노출 처리.
CREATE OR REPLACE FUNCTION trg_fn_reset_on_challenge_restart()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF (OLD.challenge_start IS DISTINCT FROM NEW.challenge_start OR
      OLD.challenge_end   IS DISTINCT FROM NEW.challenge_end) THEN
    UPDATE group_members
    SET is_contributor = TRUE,
        join_day       = 0
    WHERE group_id     = NEW.id
      AND member_status IN ('ACTIVE', 'EXIT_ELIGIBLE');
    PERFORM update_crew_cache(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- 7. reopen_group RPC: 같은 그룹 row 재사용 + current_round += 1 + 알림 발송
CREATE OR REPLACE FUNCTION reopen_group(
  p_group_id        UUID,
  p_challenge_start TIMESTAMPTZ,
  p_challenge_end   TIMESTAMPTZ,
  p_recruit_start   TIMESTAMPTZ DEFAULT NULL,
  p_recruit_end     TIMESTAMPTZ DEFAULT NULL
)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_new_round  INT;
  v_group_name TEXT;
BEGIN
  UPDATE groups
  SET current_round   = current_round + 1,
      challenge_start = p_challenge_start,
      challenge_end   = p_challenge_end,
      recruit_start   = COALESCE(p_recruit_start, recruit_start),
      recruit_end     = COALESCE(p_recruit_end, recruit_end),
      crew_rate       = 0,
      crew_grade      = 'D'
  WHERE id = p_group_id
  RETURNING current_round, name INTO v_new_round, v_group_name;

  IF v_new_round IS NULL THEN
    RAISE EXCEPTION 'Group not found: %', p_group_id;
  END IF;

  -- 재오픈 알림: 해당 그룹 구독자에게 1건씩 발송
  INSERT INTO notifications (user_id, type, title, body, emoji, related_id)
  SELECT s.user_id,
         'challenge_reopened',
         '재개설된 챌린지가 있어요',
         format('"%s" 챌린지가 새로 시작됐어요. 지금 참여해보세요!', v_group_name),
         '🔔',
         p_group_id::text
  FROM challenge_reopen_subscriptions s
  WHERE s.group_id = p_group_id;

  RETURN v_new_round;
END;
$$;

REVOKE EXECUTE ON FUNCTION reopen_group(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
