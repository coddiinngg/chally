-- Keep group membership loading simple and reliable for the mobile app.
-- The previous policy queried group_members from inside its own USING clause,
-- which can trigger recursive RLS evaluation when loading joined groups.

DROP POLICY IF EXISTS "group_members_select" ON group_members;

CREATE POLICY "group_members_select" ON group_members
FOR SELECT USING (auth.uid() = user_id);
