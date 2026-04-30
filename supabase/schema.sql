-- ============================================================
-- Chally Supabase Schema
-- Supabase 대시보드 > SQL Editor에서 실행하세요
-- ============================================================

-- UUID 확장 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 목표
CREATE TABLE IF NOT EXISTS goals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title           TEXT NOT NULL,
  category        TEXT NOT NULL,  -- exercise, health, reading, other
  icon_name       TEXT DEFAULT 'Target',
  frequency       TEXT DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly')),
  frequency_days  INT[] DEFAULT '{1,2,3,4,5,6,7}',  -- 1=월, 7=일
  reminder_time   TIME,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 인증 기록
CREATE TABLE IF NOT EXISTS verifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id     UUID REFERENCES goals(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  photo_url   TEXT,
  status      TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'skipped')),
  xp_earned   INT DEFAULT 10
);

-- 챌린지 그룹
CREATE TABLE IF NOT EXISTS groups (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  emoji       TEXT DEFAULT '🏋️',
  description TEXT,
  category    TEXT,
  max_members INT DEFAULT 50,
  is_public   BOOLEAN DEFAULT TRUE,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
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

-- 건너뛰기 기록
CREATE TABLE IF NOT EXISTS snooze_records (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id    UUID REFERENCES goals(id) ON DELETE CASCADE NOT NULL,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reason     TEXT,
  snoozed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE notifications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE snooze_records ENABLE ROW LEVEL SECURITY;

-- Notifications: 자신의 알림만 조회/수정, 서버(service role)만 INSERT
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- Profiles: 자신의 프로필만 접근
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Goals: 자신의 목표만 CRUD
CREATE POLICY "goals_select" ON goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "goals_insert" ON goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "goals_update" ON goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "goals_delete" ON goals FOR DELETE USING (auth.uid() = user_id);

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

-- Group members: 같은 그룹 멤버는 조회 가능, 자신만 가입/탈퇴
CREATE POLICY "group_members_select" ON group_members FOR SELECT USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid()
  )
);
CREATE POLICY "group_members_insert" ON group_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "group_members_delete" ON group_members FOR DELETE USING (auth.uid() = user_id);

-- Snooze records: 자신의 기록만 CRUD
CREATE POLICY "snooze_select" ON snooze_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "snooze_insert" ON snooze_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "snooze_delete" ON snooze_records FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- 회원가입 시 자동으로 profiles 생성
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
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

-- ============================================================
-- 보안 패치: 하루 중복 인증 방지 (DB 레벨, KST 기준)
-- ============================================================

-- !! 기존 인덱스가 있으면 먼저 삭제 후 재생성하세요:
-- DROP INDEX IF EXISTS verifications_goal_user_day;

-- KST(UTC+9) 기준으로 날짜를 추출합니다.
-- 이전 방식(verified_at::date)은 UTC 기준이라 KST 00:00~08:59 인증이
-- "전날"로 저장돼 같은 KST 날짜에 2회 인증이 가능했습니다.
CREATE UNIQUE INDEX IF NOT EXISTS verifications_goal_user_day
  ON verifications (goal_id, user_id, ((verified_at AT TIME ZONE 'Asia/Seoul')::date))
  WHERE status = 'completed';

-- ============================================================
-- Rate Limiting: 인증 시도 횟수 추적
-- ============================================================

-- verify_attempts: Gemini API 호출마다 기록 (성공/실패 무관)
-- Edge Function이 service role로 INSERT, 유저는 자신 것만 SELECT 가능
CREATE TABLE IF NOT EXISTS verify_attempts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  goal_id      UUID REFERENCES goals(id) ON DELETE SET NULL,
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

-- ============================================================
-- STORAGE BUCKET (Supabase 대시보드 > Storage에서 설정)
-- ============================================================
-- 버킷명: 'verifications' (공개)
-- 버킷명: 'avatars' (공개)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('verifications', 'verifications', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
