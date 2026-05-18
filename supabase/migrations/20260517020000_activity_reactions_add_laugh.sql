-- 활동 사진 리액션 이모지에 😂 추가
-- 채팅(group_message_reactions)에는 이미 😂가 포함돼 있지만,
-- 피드(activity_reactions)에는 빠져있어 일관성 맞춤.

alter table public.activity_reactions drop constraint if exists activity_reactions_emoji_check;
alter table public.activity_reactions add constraint activity_reactions_emoji_check
  check (emoji = any (array['❤️','🔥','👍','😂','😮','🎉']));
