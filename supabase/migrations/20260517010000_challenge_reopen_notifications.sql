-- 재개설 알림 발송 트리거
-- 새 그룹이 생성되면, 동일 verify_type을 가진 그룹에 구독한 사용자들에게 알림을 INSERT.
-- 구독 row는 보존(같은 사용자가 향후 재개설에도 다시 알림 받을 수 있도록).
-- 매칭은 verify_type만 사용(category 무시) — 걷기 구독자에게 러닝 알림이 가지 않도록.

-- 1. notifications.type 체크 제약에 'challenge_reopened' 추가
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array[
    'goal','badge','group','rank','streak',
    'member_warning','member_removed',
    'challenge_start','challenge_end','challenge_dday','daily_reminder',
    'challenge_reopened'
  ]));

-- 2. 트리거 함수
create or replace function public.notify_reopen_subscribers()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  insert into public.notifications (user_id, type, title, body, emoji, related_id)
  select distinct s.user_id,
         'challenge_reopened',
         '재개설된 챌린지가 있어요',
         format('"%s" 챌린지가 새로 시작됐어요. 지금 참여해보세요!', new.name),
         '🔔',
         new.id::text
    from public.challenge_reopen_subscriptions s
    join public.groups g on g.id = s.group_id
   where g.verify_type = new.verify_type
     and g.id <> new.id;
  return new;
end;
$$;

-- 3. AFTER INSERT 트리거
drop trigger if exists trg_notify_reopen_subscribers on public.groups;
create trigger trg_notify_reopen_subscribers
  after insert on public.groups
  for each row
  execute function public.notify_reopen_subscribers();
