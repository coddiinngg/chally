-- Persist group-scoped verification activity and user reactions.

ALTER TABLE verifications ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;
ALTER TABLE verifications ADD COLUMN IF NOT EXISTS verify_type TEXT;

CREATE INDEX IF NOT EXISTS verifications_group_created
  ON verifications (group_id, verified_at DESC)
  WHERE status = 'completed';

CREATE TABLE IF NOT EXISTS activity_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  verification_id UUID REFERENCES verifications(id) ON DELETE CASCADE UNIQUE,
  verify_type     TEXT NOT NULL,
  photo_url       TEXT,
  message         TEXT NOT NULL,
  author_name     TEXT,
  author_avatar_url TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
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

ALTER TABLE activity_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_posts_select" ON activity_posts
FOR SELECT USING (TRUE);

CREATE POLICY "activity_posts_insert_own_member" ON activity_posts
FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM group_members
    WHERE group_members.group_id = activity_posts.group_id
      AND group_members.user_id = auth.uid()
  )
);

CREATE POLICY "activity_reactions_select" ON activity_reactions
FOR SELECT USING (TRUE);

CREATE POLICY "activity_reactions_insert_own" ON activity_reactions
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "activity_reactions_update_own" ON activity_reactions
FOR UPDATE USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "activity_reactions_delete_own" ON activity_reactions
FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER activity_reactions_updated_at
  BEFORE UPDATE ON activity_reactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
