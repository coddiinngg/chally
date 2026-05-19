-- 챌린지 재시작(challenge_start/end 변경) 시 이전 회차 그룹 채팅을 삭제한다.
-- group_message_reactions는 ON DELETE CASCADE로 함께 정리된다.

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

    IF NEW.challenge_start IS NOT NULL THEN
      DELETE FROM group_messages
      WHERE group_id   = NEW.id
        AND created_at < NEW.challenge_start;
    END IF;

    PERFORM update_crew_cache(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- 일회성: 현재 challenge_start 이전에 작성된 잔여 메시지 정리
DELETE FROM group_messages gm
USING groups g
WHERE gm.group_id   = g.id
  AND g.challenge_start IS NOT NULL
  AND gm.created_at < g.challenge_start;
