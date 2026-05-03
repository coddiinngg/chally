-- Connect the app's fixed challenge IDs to real Supabase groups.

ALTER TABLE groups ADD COLUMN IF NOT EXISTS legacy_id TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS member_count INT DEFAULT 0;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS rate INT DEFAULT 0;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS status TEXT DEFAULT '진행중';
ALTER TABLE groups ADD COLUMN IF NOT EXISTS status_color TEXT DEFAULT '#10B981';
ALTER TABLE groups ADD COLUMN IF NOT EXISTS rule TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS goal TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS verify_type TEXT DEFAULT 'step_walk';
ALTER TABLE groups ADD COLUMN IF NOT EXISTS my_rank INT DEFAULT 0;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS my_rate INT DEFAULT 0;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS my_streak INT DEFAULT 0;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS cover TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'groups_legacy_id_key'
      AND conrelid = 'groups'::regclass
  ) THEN
    ALTER TABLE groups ADD CONSTRAINT groups_legacy_id_key UNIQUE (legacy_id);
  END IF;
END $$;

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

INSERT INTO groups (
  id,
  legacy_id,
  name,
  emoji,
  description,
  category,
  member_count,
  rate,
  status,
  status_color,
  rule,
  goal,
  verify_type,
  my_rank,
  my_rate,
  my_streak,
  cover,
  max_members,
  is_public
) VALUES
(
  '10000000-0000-4000-8000-000000000001',
  '1',
  '매일 5,000보 걷기',
  '👟',
  '걸음 수 인증으로 함께 건강해져요',
  '운동',
  38,
  72,
  '인기',
  '#FF3355',
  '매일 5,000보 이상 만보기 스크린샷 인증',
  '오늘 5,000보 달성',
  'step_walk',
  4,
  75,
  8,
  'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&fit=crop',
  50,
  TRUE
),
(
  '10000000-0000-4000-8000-000000000002',
  '2',
  '러닝 크루',
  '🏃',
  '러닝하며 최애 풍경을 함께 공유해요',
  '운동',
  24,
  80,
  '진행중',
  '#10B981',
  '러닝 중 찍은 풍경 사진 인증',
  '러닝 풍경 사진 찍기',
  'run_scenery',
  12,
  50,
  2,
  'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800&fit=crop',
  50,
  TRUE
),
(
  '10000000-0000-4000-8000-000000000003',
  '3',
  '일일 독서 클럽',
  '📚',
  '매일 읽는 책 표지를 함께 모아요',
  '학습',
  15,
  65,
  '진행중',
  '#10B981',
  '매일 읽는 책 표지 사진 인증',
  '책 30분 읽기',
  'book_cover',
  3,
  75,
  5,
  'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=800&fit=crop',
  50,
  TRUE
),
(
  '10000000-0000-4000-8000-000000000004',
  '4',
  '필사 챌린지',
  '✍️',
  '곱씹게 되는 문장을 함께 모아요',
  '학습',
  11,
  58,
  '마감임박',
  '#F59E0B',
  '오늘의 인상 깊은 문장 사진 인증',
  '인상 문장 필사',
  'quote_photo',
  6,
  60,
  3,
  'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&fit=crop',
  50,
  TRUE
),
(
  '10000000-0000-4000-8000-000000000005',
  '5',
  '포즈 챌린지',
  '📸',
  '오늘의 지정 포즈에 도전해요',
  '생활',
  42,
  88,
  '인기',
  '#FF3355',
  '오늘의 지정 포즈로 셀카 인증',
  '오늘의 포즈 찍기',
  'celeb_pose',
  20,
  40,
  1,
  'https://images.unsplash.com/photo-1552196563-55cd4e45efb3?w=800&fit=crop',
  50,
  TRUE
),
(
  '10000000-0000-4000-8000-000000000006',
  '6',
  '장소 탐험대',
  '📍',
  '목표 장소에서 인증샷을 찍어요',
  '생활',
  19,
  63,
  '진행중',
  '#10B981',
  '목표 장소 방문 인증 사진',
  '장소 방문 인증',
  'location_photo',
  9,
  55,
  4,
  'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&fit=crop',
  50,
  TRUE
)
ON CONFLICT (legacy_id) DO UPDATE SET
  name = EXCLUDED.name,
  emoji = EXCLUDED.emoji,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  member_count = GREATEST(groups.member_count, EXCLUDED.member_count),
  rate = EXCLUDED.rate,
  status = EXCLUDED.status,
  status_color = EXCLUDED.status_color,
  rule = EXCLUDED.rule,
  goal = EXCLUDED.goal,
  verify_type = EXCLUDED.verify_type,
  my_rank = EXCLUDED.my_rank,
  my_rate = EXCLUDED.my_rate,
  my_streak = EXCLUDED.my_streak,
  cover = EXCLUDED.cover,
  max_members = EXCLUDED.max_members,
  is_public = EXCLUDED.is_public;
