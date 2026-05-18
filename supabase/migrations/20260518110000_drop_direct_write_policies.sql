-- ============================================================
-- 직접 write 정책 제거
-- 모든 client write는 RPC(update_profile_basic, join_group_with_ticket,
-- leave_group, claim_participation_benefit, request_account_deletion)
-- 또는 service_role(Edge Function: verify-photo)을 거치도록 단일화.
-- ============================================================

DROP POLICY IF EXISTS "profiles_update"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert"        ON public.profiles;

DROP POLICY IF EXISTS "verifications_insert"   ON public.verifications;
DROP POLICY IF EXISTS "verifications_update"   ON public.verifications;
DROP POLICY IF EXISTS "verifications_delete"   ON public.verifications;

DROP POLICY IF EXISTS "groups_insert"          ON public.groups;
DROP POLICY IF EXISTS "groups_update"          ON public.groups;
DROP POLICY IF EXISTS "groups_delete"          ON public.groups;

DROP POLICY IF EXISTS "group_members_insert"   ON public.group_members;
DROP POLICY IF EXISTS "group_members_update"   ON public.group_members;
DROP POLICY IF EXISTS "group_members_delete"   ON public.group_members;
