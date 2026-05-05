-- Group-scoped daily verification uniqueness.
-- Users may verify once per day per joined group, while standalone verifications
-- remain limited to once per day.

DROP INDEX IF EXISTS verifications_user_day;

CREATE UNIQUE INDEX IF NOT EXISTS verifications_user_group_day
  ON verifications (user_id, group_id, ((verified_at AT TIME ZONE 'Asia/Seoul')::date))
  WHERE status = 'completed'
    AND group_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS verifications_user_standalone_day
  ON verifications (user_id, ((verified_at AT TIME ZONE 'Asia/Seoul')::date))
  WHERE status = 'completed'
    AND group_id IS NULL;
