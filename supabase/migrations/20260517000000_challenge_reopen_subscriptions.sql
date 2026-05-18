-- 챌린지 재개설 알림 신청 테이블
-- 마감임박 단계 또는 종료 후 5일 이내에 사용자가 신청 가능.
-- 관리자가 동일 카테고리/verify_type으로 신규 그룹 생성 시 알림을 발송할 때 활용.

create table if not exists public.challenge_reopen_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  group_id    uuid not null references public.groups(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique(user_id, group_id)
);

create index if not exists idx_reopen_subs_user
  on public.challenge_reopen_subscriptions(user_id);

create index if not exists idx_reopen_subs_group
  on public.challenge_reopen_subscriptions(group_id);

alter table public.challenge_reopen_subscriptions enable row level security;

-- 본인 행만 조회/생성/삭제
drop policy if exists "reopen_subs_select_own"
  on public.challenge_reopen_subscriptions;
create policy "reopen_subs_select_own"
  on public.challenge_reopen_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "reopen_subs_insert_own"
  on public.challenge_reopen_subscriptions;
create policy "reopen_subs_insert_own"
  on public.challenge_reopen_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "reopen_subs_delete_own"
  on public.challenge_reopen_subscriptions;
create policy "reopen_subs_delete_own"
  on public.challenge_reopen_subscriptions
  for delete using (auth.uid() = user_id);
