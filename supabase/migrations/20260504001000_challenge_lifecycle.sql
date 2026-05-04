-- Challenge lifecycle fields
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS recruit_start   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recruit_end     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS challenge_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS challenge_end   TIMESTAMPTZ;

-- Last verification per group member (48h/72h/96h 체크용)
ALTER TABLE group_members
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

-- 기본 그룹 날짜 설정 (시뮬레이션: 오늘 2026-05-04 기준)
-- 그룹1: 걷기 — 2주 진행중 (04.28~05.11, D-4 마감임박 = 05.07)
UPDATE groups SET
  recruit_start   = '2026-04-25 00:00:00+09',
  recruit_end     = '2026-04-27 23:59:59+09',
  challenge_start = '2026-04-28 00:00:00+09',
  challenge_end   = '2026-05-11 23:59:59+09'
WHERE legacy_id = '1';

-- 그룹2: 러닝 — 2주 진행중 (노션 시뮬레이션: 05.04~05.18)
UPDATE groups SET
  recruit_start   = '2026-05-01 00:00:00+09',
  recruit_end     = '2026-05-03 23:59:59+09',
  challenge_start = '2026-05-04 00:00:00+09',
  challenge_end   = '2026-05-18 23:59:59+09'
WHERE legacy_id = '2';

-- 그룹3: 독서 — 2주 마감임박 (04.25~05.08, D-4 = 05.04 오늘부터)
UPDATE groups SET
  recruit_start   = '2026-04-22 00:00:00+09',
  recruit_end     = '2026-04-24 23:59:59+09',
  challenge_start = '2026-04-25 00:00:00+09',
  challenge_end   = '2026-05-08 23:59:59+09'
WHERE legacy_id = '3';

-- 그룹4: 필사 — 2주 마감임박 (04.25~05.08, rate:58% → 참가 가능)
UPDATE groups SET
  recruit_start   = '2026-04-22 00:00:00+09',
  recruit_end     = '2026-04-24 23:59:59+09',
  challenge_start = '2026-04-25 00:00:00+09',
  challenge_end   = '2026-05-08 23:59:59+09'
WHERE legacy_id = '4';

-- 그룹5: 포즈 — 2주 마감임박 (04.25~05.08, rate:88% → 숨김)
UPDATE groups SET
  recruit_start   = '2026-04-22 00:00:00+09',
  recruit_end     = '2026-04-24 23:59:59+09',
  challenge_start = '2026-04-25 00:00:00+09',
  challenge_end   = '2026-05-08 23:59:59+09'
WHERE legacy_id = '5';

-- 그룹6: 장소 — 2주 진행중 (04.28~05.11)
UPDATE groups SET
  recruit_start   = '2026-04-25 00:00:00+09',
  recruit_end     = '2026-04-27 23:59:59+09',
  challenge_start = '2026-04-28 00:00:00+09',
  challenge_end   = '2026-05-11 23:59:59+09'
WHERE legacy_id = '6';
