-- groups.auto_kick_enabled: 그룹 단위로 미인증 자동 강퇴(EXIT_ELIGIBLE -> REMOVED) on/off.
-- 기본값 TRUE = 기존 동작 유지. FALSE인 그룹은 update_member_statuses가 건너뛴다 (테스트용 등).
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS auto_kick_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- update_member_statuses: auto_kick_enabled = FALSE 그룹은 경고/퇴장 모두 면제.
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
      AND g.auto_kick_enabled = TRUE
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
      AND g.auto_kick_enabled = TRUE
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
