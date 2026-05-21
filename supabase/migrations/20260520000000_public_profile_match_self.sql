-- ============================================================
-- get_public_profile: 셀프 프로필(Profile.tsx)과 통계 산식 통일
--
-- 변경:
--   verification_total: 모든 인증 → status='completed' 만
--                       (Profile.tsx의 totalDone과 동일)
--   verification_rate:  lifetime 성공률 → 최근 30일 인증일수 / 30 * 100
--                       (Profile.tsx의 successRate와 동일, KST 일자 기준)
--
-- 컬럼명/시그니처는 그대로 유지 — 프론트 수정 없이 값만 일치
-- ============================================================

CREATE OR REPLACE FUNCTION get_public_profile(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  username TEXT,
  avatar_url TEXT,
  streak_count INT,
  xp_total INT,
  verification_total INT,
  verification_rate INT,
  joined_groups JSONB,
  past_groups JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH user_profile AS (
    SELECT
      p.id,
      p.username,
      p.avatar_url,
      p.streak_count,
      p.xp_total
    FROM profiles p
    WHERE p.id = p_user_id
  ),
  ver_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE status = 'completed')::INT AS total_done,
      COUNT(DISTINCT ((verified_at AT TIME ZONE 'Asia/Seoul')::date))
        FILTER (
          WHERE status = 'completed'
            AND verified_at >= NOW() - INTERVAL '30 days'
        )::INT AS recent_days_30
    FROM verifications
    WHERE user_id = p_user_id
  ),
  joined AS (
    SELECT JSONB_AGG(JSONB_BUILD_OBJECT('id', g.id, 'name', g.name) ORDER BY g.name) AS list
    FROM group_members gm
    JOIN groups g ON g.id = gm.group_id
    WHERE gm.user_id     = p_user_id
      AND gm.member_status IN ('ACTIVE', 'EXIT_ELIGIBLE')
      AND (g.challenge_end IS NULL OR g.challenge_end > NOW())
  ),
  past AS (
    SELECT JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'id', g.id,
        'name', g.name,
        'emoji', g.emoji,
        'cover', g.cover,
        'crew_rate', g.crew_rate,
        'crew_grade', g.crew_grade,
        'challenge_end', g.challenge_end
      ) ORDER BY g.challenge_end DESC
    ) AS list
    FROM group_members gm
    JOIN groups g ON g.id = gm.group_id
    WHERE gm.user_id     = p_user_id
      AND gm.member_status IN ('ACTIVE', 'EXIT_ELIGIBLE')
      AND g.challenge_end IS NOT NULL
      AND g.challenge_end <= NOW()
  )
  SELECT
    up.id,
    up.username,
    up.avatar_url,
    up.streak_count,
    up.xp_total,
    COALESCE((SELECT total_done FROM ver_stats), 0),
    LEAST(100, ROUND(
      COALESCE((SELECT recent_days_30 FROM ver_stats), 0)::NUMERIC / 30 * 100
    ))::INT,
    COALESCE((SELECT list FROM joined), '[]'::JSONB),
    COALESCE((SELECT list FROM past),   '[]'::JSONB)
  FROM user_profile up;
$$;

GRANT EXECUTE ON FUNCTION get_public_profile(UUID) TO anon, authenticated;
