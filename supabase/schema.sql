-- ============================================================
-- Chally Supabase Schema
-- Supabase 대시보드 > SQL Editor에서 실행하세요
-- ============================================================

-- UUID 확장 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

-- 사용자 프로필 (auth.users 확장)
CREATE TABLE IF NOT EXISTS profiles (
  id               UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username         TEXT UNIQUE,
  avatar_url       TEXT,
  plan_type        TEXT DEFAULT 'free' CHECK (plan_type IN ('free', 'premium')),
  streak_count     INT  DEFAULT 0,
  recovery_tickets INT  DEFAULT 2,
  xp_total         INT  DEFAULT 0,
  joined_group_ids TEXT[] DEFAULT '{}',
  invite_code      TEXT UNIQUE,
  referred_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 인증 기록
CREATE TABLE IF NOT EXISTS verifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  group_id    UUID REFERENCES groups(id) ON DELETE SET NULL,
  verify_type TEXT,
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  photo_url   TEXT,
  status      TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'skipped')),
  xp_earned   INT DEFAULT 10
);

-- 챌린지 그룹
CREATE TABLE IF NOT EXISTS groups (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  legacy_id    TEXT UNIQUE,
  name         TEXT NOT NULL,
  emoji        TEXT DEFAULT '🏋️',
  description  TEXT,
  category     TEXT,
  member_count INT DEFAULT 0,
  rate         INT DEFAULT 0,
  status       TEXT DEFAULT '진행중',
  status_color TEXT DEFAULT '#10B981',
  rule         TEXT,
  goal         TEXT,
  verify_type  TEXT DEFAULT 'step_walk',
  my_rank      INT DEFAULT 0,
  my_rate      INT DEFAULT 0,
  my_streak    INT DEFAULT 0,
  cover        TEXT,
  max_members  INT DEFAULT 50,
  is_public    BOOLEAN DEFAULT TRUE,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 그룹 멤버
CREATE TABLE IF NOT EXISTS group_members (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id   UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role       TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (group_id, user_id)
);

-- 알림
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('goal', 'badge', 'group', 'rank', 'streak')),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  emoji       TEXT,
  actionable  BOOLEAN DEFAULT FALSE,
  action_done BOOLEAN DEFAULT FALSE,
  read_at     TIMESTAMPTZ,
  related_id  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_created
  ON notifications (user_id, created_at DESC);

-- 알림 설정
CREATE TABLE IF NOT EXISTS notification_settings (
  user_id                 UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  daily_enabled           BOOLEAN DEFAULT TRUE,
  daily_time              TEXT DEFAULT '07:00',
  challenge_enabled       BOOLEAN DEFAULT TRUE,
  weekly_report_enabled   BOOLEAN DEFAULT TRUE,
  achievement_enabled     BOOLEAN DEFAULT TRUE,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- 챌린지 건의
CREATE TABLE IF NOT EXISTS challenge_suggestions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT '투표중' CHECK (status IN ('투표중', '개발확정', '검토중')),
  category          TEXT NOT NULL CHECK (category IN ('운동/건강', '독서/공부', '생산성', '마음챙김', '식습관', '기타')),
  duration          TEXT NOT NULL CHECK (duration IN ('7일', '21일', '30일')),
  verify_method     TEXT,
  operator_comment  TEXT,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  votes_count       INT DEFAULT 0,
  comments_count    INT DEFAULT 0,
  agree_rate        INT DEFAULT 70,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS challenge_suggestion_votes (
  suggestion_id UUID REFERENCES challenge_suggestions(id) ON DELETE CASCADE NOT NULL,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (suggestion_id, user_id)
);

CREATE TABLE IF NOT EXISTS challenge_suggestion_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID REFERENCES challenge_suggestions(id) ON DELETE CASCADE NOT NULL,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  author_name   TEXT DEFAULT '나',
  body          TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS challenge_suggestion_subscriptions (
  suggestion_id UUID REFERENCES challenge_suggestions(id) ON DELETE CASCADE NOT NULL,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (suggestion_id, user_id)
);

-- 친구 초대 / 추천 보상
CREATE TABLE IF NOT EXISTS referrals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id   UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  referred_id  UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  invite_code  TEXT NOT NULL,
  xp_awarded   INT DEFAULT 50,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  CHECK (inviter_id <> referred_id)
);

CREATE TABLE IF NOT EXISTS friend_invites (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invited_by     UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  target_key     TEXT NOT NULL,
  target_name    TEXT NOT NULL,
  target_handle  TEXT,
  invite_code    TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (invited_by, target_key)
);

CREATE TABLE IF NOT EXISTS invite_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  event_type  TEXT NOT NULL CHECK (event_type IN ('copy_code', 'share_link', 'sms_share', 'suggested_friend_invite')),
  invite_code TEXT NOT NULL,
  target_key  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_posts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id          UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  user_id           UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  verification_id   UUID REFERENCES verifications(id) ON DELETE CASCADE UNIQUE,
  verify_type       TEXT NOT NULL,
  photo_url         TEXT,
  message           TEXT NOT NULL,
  author_name       TEXT,
  author_avatar_url TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activity_posts_group_created
  ON activity_posts (group_id, created_at DESC);

CREATE INDEX IF NOT EXISTS activity_posts_user_created
  ON activity_posts (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS activity_reactions (
  activity_post_id UUID REFERENCES activity_posts(id) ON DELETE CASCADE NOT NULL,
  user_id          UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  emoji            TEXT NOT NULL CHECK (emoji IN ('❤️', '🔥', '👍', '😮', '🎉')),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (activity_post_id, user_id)
);

CREATE INDEX IF NOT EXISTS activity_reactions_post
  ON activity_reactions (activity_post_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE notifications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_suggestion_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_suggestion_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_suggestion_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members  ENABLE ROW LEVEL SECURITY;

-- Notifications: 자신의 알림만 조회/수정, 서버(service role)만 INSERT
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- Notification settings: 자신의 설정만 조회/저장
CREATE POLICY "notification_settings_select" ON notification_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notification_settings_insert" ON notification_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notification_settings_update" ON notification_settings FOR UPDATE USING (auth.uid() = user_id);

-- Challenge suggestions: 공개 조회, 로그인 유저 작성/응원/댓글/구독
CREATE POLICY "challenge_suggestions_select" ON challenge_suggestions FOR SELECT USING (TRUE);
CREATE POLICY "challenge_suggestions_insert" ON challenge_suggestions FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "challenge_suggestion_votes_select" ON challenge_suggestion_votes FOR SELECT USING (TRUE);
CREATE POLICY "challenge_suggestion_votes_insert" ON challenge_suggestion_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "challenge_suggestion_votes_delete" ON challenge_suggestion_votes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "challenge_suggestion_comments_select" ON challenge_suggestion_comments FOR SELECT USING (TRUE);
CREATE POLICY "challenge_suggestion_comments_insert" ON challenge_suggestion_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "challenge_suggestion_subscriptions_select" ON challenge_suggestion_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "challenge_suggestion_subscriptions_insert" ON challenge_suggestion_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "challenge_suggestion_subscriptions_delete" ON challenge_suggestion_subscriptions FOR DELETE USING (auth.uid() = user_id);

-- Referrals: 관련 사용자만 조회, 친구 초대 클릭은 본인만 저장
CREATE POLICY "referrals_select_related" ON referrals FOR SELECT USING (auth.uid() = inviter_id OR auth.uid() = referred_id);

CREATE POLICY "friend_invites_select_own" ON friend_invites FOR SELECT USING (auth.uid() = invited_by);
CREATE POLICY "friend_invites_insert_own" ON friend_invites FOR INSERT WITH CHECK (auth.uid() = invited_by);

CREATE POLICY "invite_events_select_own" ON invite_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "invite_events_insert_own" ON invite_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Activity posts/reactions: 활동은 공개 조회, 리액션은 본인만 변경
CREATE POLICY "activity_posts_select" ON activity_posts FOR SELECT USING (TRUE);
CREATE POLICY "activity_posts_insert_own_member" ON activity_posts FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM group_members
    WHERE group_members.group_id = activity_posts.group_id
      AND group_members.user_id = auth.uid()
  )
);

CREATE POLICY "activity_reactions_select" ON activity_reactions FOR SELECT USING (TRUE);
CREATE POLICY "activity_reactions_insert_own" ON activity_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "activity_reactions_update_own" ON activity_reactions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "activity_reactions_delete_own" ON activity_reactions FOR DELETE USING (auth.uid() = user_id);

-- Profiles: 자신의 프로필만 접근
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Verifications: 자신의 인증만 CRUD
CREATE POLICY "verifications_select" ON verifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "verifications_insert" ON verifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "verifications_update" ON verifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "verifications_delete" ON verifications FOR DELETE USING (auth.uid() = user_id);

-- Groups: 공개 그룹은 모두 조회, 생성자만 수정/삭제
CREATE POLICY "groups_select" ON groups FOR SELECT USING (is_public = TRUE OR auth.uid() = created_by);
CREATE POLICY "groups_insert" ON groups FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "groups_update" ON groups FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "groups_delete" ON groups FOR DELETE USING (auth.uid() = created_by);

-- Group members: 자신의 가입 기록만 조회, 자신만 가입/탈퇴
CREATE POLICY "group_members_select" ON group_members FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "group_members_insert" ON group_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "group_members_delete" ON group_members FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- 그룹 가입/탈퇴 시 노출용 참여 수 반영
CREATE OR REPLACE FUNCTION adjust_group_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE groups
    SET member_count = member_count + 1
    WHERE id = NEW.group_id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    UPDATE groups
    SET member_count = GREATEST(0, member_count - 1)
    WHERE id = OLD.group_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS group_members_adjust_count_insert ON group_members;
CREATE TRIGGER group_members_adjust_count_insert
AFTER INSERT ON group_members
FOR EACH ROW EXECUTE FUNCTION adjust_group_member_count();

DROP TRIGGER IF EXISTS group_members_adjust_count_delete ON group_members;
CREATE TRIGGER group_members_adjust_count_delete
AFTER DELETE ON group_members
FOR EACH ROW EXECUTE FUNCTION adjust_group_member_count();

-- 회원가입 시 자동으로 profiles 생성
CREATE OR REPLACE FUNCTION default_invite_code(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'CHALLY-' || upper(substr(replace(p_user_id::text, '-', ''), 1, 8));
$$;

UPDATE profiles
SET invite_code = default_invite_code(id)
WHERE invite_code IS NULL;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  ref_code TEXT;
  inviter UUID;
BEGIN
  ref_code := NULLIF(NEW.raw_user_meta_data->>'ref', '');

  SELECT id INTO inviter
  FROM profiles
  WHERE invite_code = ref_code
  LIMIT 1;

  INSERT INTO profiles (id, username, avatar_url, invite_code, referred_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    default_invite_code(NEW.id),
    CASE WHEN inviter IS NOT NULL AND inviter <> NEW.id THEN inviter ELSE NULL END
  );

  IF inviter IS NOT NULL AND inviter <> NEW.id THEN
    INSERT INTO referrals (inviter_id, referred_id, invite_code, xp_awarded)
    VALUES (inviter, NEW.id, ref_code, 50)
    ON CONFLICT (referred_id) DO NOTHING;

    UPDATE profiles
    SET xp_total = COALESCE(xp_total, 0) + 50
    WHERE id IN (inviter, NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- profiles.updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER notification_settings_updated_at
  BEFORE UPDATE ON notification_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER challenge_suggestions_updated_at
  BEFORE UPDATE ON challenge_suggestions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION refresh_challenge_suggestion_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_id UUID;
BEGIN
  target_id := COALESCE(NEW.suggestion_id, OLD.suggestion_id);

  UPDATE challenge_suggestions
  SET
    votes_count = (
      SELECT COUNT(*)::INT
      FROM challenge_suggestion_votes
      WHERE suggestion_id = target_id
    ),
    comments_count = (
      SELECT COUNT(*)::INT
      FROM challenge_suggestion_comments
      WHERE suggestion_id = target_id
    )
  WHERE id = target_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE TRIGGER challenge_suggestion_votes_count
  AFTER INSERT OR DELETE ON challenge_suggestion_votes
  FOR EACH ROW EXECUTE FUNCTION refresh_challenge_suggestion_counts();

CREATE OR REPLACE TRIGGER challenge_suggestion_comments_count
  AFTER INSERT OR DELETE ON challenge_suggestion_comments
  FOR EACH ROW EXECUTE FUNCTION refresh_challenge_suggestion_counts();

CREATE OR REPLACE TRIGGER activity_reactions_updated_at
  BEFORE UPDATE ON activity_reactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 보안 패치: 하루 중복 인증 방지 (DB 레벨, KST 기준)
-- ============================================================

-- KST 기준 중복 인증 방지 인덱스 (사용자+날짜 기준)
CREATE UNIQUE INDEX IF NOT EXISTS verifications_user_day
  ON verifications (user_id, ((verified_at AT TIME ZONE 'Asia/Seoul')::date))
  WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS verifications_group_created
  ON verifications (group_id, verified_at DESC)
  WHERE status = 'completed';

-- ============================================================
-- Rate Limiting: 인증 시도 횟수 추적
-- ============================================================

-- verify_attempts: Gemini API 호출마다 기록 (성공/실패 무관)
-- Edge Function이 service role로 INSERT, 유저는 자신 것만 SELECT 가능
CREATE TABLE IF NOT EXISTS verify_attempts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS verify_attempts_user_date
  ON verify_attempts (user_id, attempted_at);

ALTER TABLE verify_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "verify_attempts_select" ON verify_attempts
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- XP 원자적 증가 함수 (Edge Function에서 호출)
-- ============================================================
CREATE OR REPLACE FUNCTION increment_user_xp(p_user_id UUID, p_amount INT DEFAULT 10)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET xp_total = COALESCE(xp_total, 0) + p_amount
  WHERE id = p_user_id;
END;
$$;

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
  WITH completed AS (
    SELECT
      v.user_id,
      ((v.verified_at AT TIME ZONE 'Asia/Seoul')::date) AS day
    FROM verifications v
    WHERE v.group_id = p_group_id
      AND v.status = 'completed'
  ),
  member_stats AS (
    SELECT
      gm.user_id,
      p.username,
      p.avatar_url,
      COUNT(c.day)::INT AS total_done,
      COUNT(c.day) FILTER (WHERE c.day >= ((NOW() AT TIME ZONE 'Asia/Seoul')::date - 6))::INT AS recent_done
    FROM group_members gm
    JOIN profiles p ON p.id = gm.user_id
    LEFT JOIN completed c ON c.user_id = gm.user_id
    WHERE gm.group_id = p_group_id
    GROUP BY gm.user_id, p.username, p.avatar_url
  ),
  ranked AS (
    SELECT
      DENSE_RANK() OVER (
        ORDER BY
          ms.recent_done DESC,
          ms.total_done DESC,
          ms.user_id ASC
      )::INT AS rank,
      ms.user_id,
      ms.username,
      ms.avatar_url,
      ms.total_done,
      ms.recent_done,
      LEAST(100, ROUND((ms.recent_done::NUMERIC / 7) * 100))::INT AS rate,
      ms.recent_done::INT AS streak,
      auth.uid() = ms.user_id AS is_me
    FROM member_stats ms
  )
  SELECT *
  FROM ranked
  ORDER BY rank ASC, recent_done DESC, total_done DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 30), 100));
$$;

GRANT EXECUTE ON FUNCTION get_group_leaderboard(UUID, INT) TO anon, authenticated;

-- ============================================================
-- STORAGE BUCKET (Supabase 대시보드 > Storage에서 설정)
-- ============================================================
-- 버킷명: 'verifications' (공개)
-- 버킷명: 'avatars' (공개)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('verifications', 'verifications', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "avatars_public_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_owner_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
