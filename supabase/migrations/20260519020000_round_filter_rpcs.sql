-- Phase 2: 핵심 RPC들이 current_round/round_number를 기준으로 동작하도록 갱신.
-- calculate_crew_rate, get_group_leaderboard, get_crew_status.
-- 인증/멤버 모두 같은 라운드 데이터만 분자/분모에 반영.

-- ================================================================
-- 1. calculate_crew_rate: round 필터 추가
-- ================================================================
CREATE OR REPLACE FUNCTION calculate_crew_rate(p_group_id UUID)
RETURNS DOUBLE PRECISION
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  WITH dur AS (
    SELECT
      GREATEST(1,
        ROUND(EXTRACT(EPOCH FROM (challenge_end - challenge_start)) / 86400)::INT
      ) AS days,
      challenge_start,
      challenge_end,
      current_round
    FROM groups
    WHERE id = p_group_id
      AND challenge_start IS NOT NULL
      AND challenge_end   IS NOT NULL
  ),
  active_contributors AS (
    SELECT gm.user_id
    FROM group_members gm
    JOIN dur d ON TRUE
    WHERE gm.group_id       = p_group_id
      AND gm.round_number   = d.current_round
      AND gm.is_contributor = TRUE
      AND gm.member_status NOT IN ('REMOVED', 'LEFT')
  ),
  all_contributors AS (
    SELECT gm.user_id
    FROM group_members gm
    JOIN dur d ON TRUE
    WHERE gm.group_id       = p_group_id
      AND gm.round_number   = d.current_round
      AND gm.is_contributor = TRUE
  ),
  done AS (
    SELECT v.user_id,
           COUNT(DISTINCT (v.verified_at AT TIME ZONE 'Asia/Seoul')::date)::INT AS cnt
    FROM verifications v
    JOIN all_contributors c ON c.user_id = v.user_id
    JOIN dur d ON TRUE
    WHERE v.group_id     = p_group_id
      AND v.round_number = d.current_round
      AND v.status       = 'completed'
      AND v.verified_at >= d.challenge_start
      AND v.verified_at <= d.challenge_end
    GROUP BY v.user_id
  )
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM dur)                 THEN 0.0
    WHEN NOT EXISTS (SELECT 1 FROM active_contributors) THEN 0.0
    ELSE LEAST(1.0,
      COALESCE((SELECT SUM(cnt) FROM done), 0)::DOUBLE PRECISION
      / NULLIF(
          (SELECT COUNT(*) FROM active_contributors)::DOUBLE PRECISION
          * (SELECT days FROM dur),
          0
        )
    )
  END;
$$;

-- ================================================================
-- 2. get_group_leaderboard: round 필터 추가
-- ================================================================
CREATE OR REPLACE FUNCTION get_group_leaderboard(p_group_id UUID, p_limit INT DEFAULT 30)
RETURNS TABLE (
  rank INT,
  user_id UUID,
  username TEXT,
  avatar_url TEXT,
  total_done INT,
  recent_done INT,
  rate INT,
  streak INT,
  is_me BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH dur AS (
    SELECT
      GREATEST(1, ROUND(EXTRACT(EPOCH FROM (challenge_end - challenge_start)) / 86400)::INT) AS days,
      challenge_start,
      challenge_end,
      current_round
    FROM groups
    WHERE id = p_group_id
      AND challenge_start IS NOT NULL
      AND challenge_end   IS NOT NULL
  ),
  completed AS (
    SELECT
      v.user_id,
      ((v.verified_at AT TIME ZONE 'Asia/Seoul')::date) AS day
    FROM verifications v
    JOIN dur d ON TRUE
    WHERE v.group_id     = p_group_id
      AND v.round_number = d.current_round
      AND v.status       = 'completed'
      AND v.verified_at >= d.challenge_start
      AND v.verified_at <= d.challenge_end
  ),
  member_stats AS (
    SELECT
      gm.user_id,
      p.username,
      p.avatar_url,
      COUNT(c.day)::INT AS total_done,
      COUNT(c.day) FILTER (WHERE c.day >= ((NOW() AT TIME ZONE 'Asia/Seoul')::date - 6))::INT AS recent_done
    FROM group_members gm
    JOIN dur d ON TRUE
    JOIN profiles p ON p.id = gm.user_id
    LEFT JOIN completed c ON c.user_id = gm.user_id
    WHERE gm.group_id     = p_group_id
      AND gm.round_number = d.current_round
      AND gm.member_status IN ('ACTIVE', 'EXIT_ELIGIBLE')
    GROUP BY gm.user_id, p.username, p.avatar_url
  ),
  ranked AS (
    SELECT
      DENSE_RANK() OVER (ORDER BY ms.total_done DESC, ms.user_id ASC)::INT AS rank,
      ms.user_id,
      ms.username,
      ms.avatar_url,
      ms.total_done,
      ms.recent_done,
      LEAST(100, ROUND(
        (ms.total_done::NUMERIC / GREATEST(1, COALESCE((SELECT days FROM dur), 7))) * 100
      ))::INT AS rate,
      ms.recent_done::INT AS streak,
      auth.uid() = ms.user_id AS is_me
    FROM member_stats ms
  )
  SELECT *
  FROM ranked
  ORDER BY rank ASC, total_done DESC, streak DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 30), 100));
$$;

GRANT EXECUTE ON FUNCTION get_group_leaderboard(UUID, INT) TO anon, authenticated;

-- ================================================================
-- 3. get_crew_status: round 필터 추가
-- ================================================================
CREATE OR REPLACE FUNCTION get_crew_status(p_group_id UUID)
RETURNS TABLE (
  crew_rate         DOUBLE PRECISION,
  crew_grade        TEXT,
  contributor_count INT,
  active_count      INT,
  removed_count     INT,
  my_status         TEXT,
  my_is_contributor BOOLEAN,
  my_exit_deadline  TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  RETURN QUERY
  SELECT
    g.crew_rate,
    g.crew_grade,
    COUNT(*) FILTER (WHERE gm.is_contributor)::INT,
    COUNT(*) FILTER (WHERE gm.member_status = 'ACTIVE')::INT,
    COUNT(*) FILTER (WHERE gm.member_status = 'REMOVED')::INT,
    MAX(CASE WHEN gm.user_id = v_uid THEN gm.member_status END),
    COALESCE(BOOL_OR(CASE WHEN gm.user_id = v_uid AND gm.is_contributor THEN TRUE END), FALSE),
    MAX(CASE WHEN gm.user_id = v_uid THEN gm.exit_deadline END)
  FROM groups g
  LEFT JOIN group_members gm
    ON gm.group_id     = g.id
   AND gm.round_number = g.current_round
  WHERE g.id = p_group_id
  GROUP BY g.crew_rate, g.crew_grade;
END;
$$;

GRANT EXECUTE ON FUNCTION get_crew_status(UUID) TO authenticated;
