-- get_public_profile 확장: 검증 통계 + 참여 그룹 포함
-- SECURITY DEFINER로 RLS 우회 → 다른 유저 프로필 조회 가능
-- 리턴 타입 변경이므로 DROP 후 재생성
DROP FUNCTION IF EXISTS get_public_profile(UUID);

CREATE FUNCTION get_public_profile(p_user_id UUID)
RETURNS TABLE (
  id                  UUID,
  username            TEXT,
  avatar_url          TEXT,
  streak_count        INT,
  xp_total            INT,
  verification_total  INT,
  verification_rate   INT,
  joined_groups       JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.username,
    p.avatar_url,
    p.streak_count,
    p.xp_total,
    COALESCE(vs.total, 0)::INT,
    COALESCE(vs.rate, 0)::INT,
    COALESCE(gs.groups_json, '[]'::JSONB)
  FROM profiles p
  LEFT JOIN LATERAL (
    SELECT
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::INT AS total,
      CASE WHEN COUNT(*) > 0
        THEN ROUND(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*))::INT
        ELSE 0
      END AS rate
    FROM verifications
    WHERE user_id = p_user_id
  ) vs ON true
  LEFT JOIN LATERAL (
    SELECT
      JSONB_AGG(
        JSONB_BUILD_OBJECT('id', sub.gid, 'name', sub.gname)
      ) AS groups_json
    FROM (
      SELECT g.id AS gid, g.name AS gname
      FROM group_members gm
      JOIN groups g ON g.id = gm.group_id
      WHERE gm.user_id = p_user_id
      ORDER BY gm.joined_at
      LIMIT 5
    ) sub
  ) gs ON true
  WHERE p.id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION get_public_profile(UUID) TO anon, authenticated;
