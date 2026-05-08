-- ============================================================
-- 멤버 상태 변경 알림
-- notifications.type에 'member_warning', 'member_removed' 추가
-- update_member_statuses()가 상태 전이 시 알림 INSERT
-- ============================================================

-- 1. notifications type CHECK 확장
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'goal', 'badge', 'group', 'rank', 'streak',
    'member_warning', 'member_removed'
  ));

-- 2. update_member_statuses 재작성 (알림 INSERT 포함)
CREATE OR REPLACE FUNCTION update_member_statuses(p_group_id UUID DEFAULT NULL)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INT := 0;
  v_cnt     INT;
BEGIN
  -- ── ACTIVE → EXIT_ELIGIBLE + 퇴장경고 알림 ─────────────────
  WITH changed AS (
    UPDATE group_members
    SET member_status = 'EXIT_ELIGIBLE',
        exit_deadline = NOW() + INTERVAL '2 hours'
    WHERE member_status   = 'ACTIVE'
      AND is_contributor  = TRUE
      AND COALESCE(last_verified_at, joined_at) < NOW() - INTERVAL '48 hours'
      AND (p_group_id IS NULL OR group_id = p_group_id)
    RETURNING user_id, group_id
  )
  INSERT INTO notifications (user_id, type, title, body, emoji, related_id)
  SELECT
    c.user_id,
    'member_warning',
    '퇴장경고',
    '48시간 이상 미인증으로 퇴장경고 상태가 됐어요. 2시간 내 인증하지 않으면 ' || g.name || '에서 퇴장돼요.',
    '⚠️',
    c.group_id::TEXT
  FROM changed c
  JOIN groups g ON g.id = c.group_id;

  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_updated := v_updated + v_cnt;

  -- ── EXIT_ELIGIBLE → REMOVED + 퇴장 알림 ─────────────────────
  WITH changed AS (
    UPDATE group_members
    SET member_status = 'REMOVED',
        removed_at    = NOW(),
        exit_deadline = NULL
    WHERE member_status  = 'EXIT_ELIGIBLE'
      AND exit_deadline  IS NOT NULL
      AND exit_deadline  < NOW()
      AND (p_group_id IS NULL OR group_id = p_group_id)
    RETURNING user_id, group_id
  )
  INSERT INTO notifications (user_id, type, title, body, emoji, related_id)
  SELECT
    c.user_id,
    'member_removed',
    '그룹에서 퇴장됐어요',
    g.name || '에서 자동으로 퇴장 처리됐어요.',
    '🚪',
    c.group_id::TEXT
  FROM changed c
  JOIN groups g ON g.id = c.group_id;

  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_updated := v_updated + v_cnt;

  RETURN v_updated;
END;
$$;

REVOKE EXECUTE ON FUNCTION update_member_statuses(UUID) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION update_member_statuses(UUID) TO service_role;
