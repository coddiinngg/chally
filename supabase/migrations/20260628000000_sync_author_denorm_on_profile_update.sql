-- 프로필(아바타/닉네임) 변경 시 denormalized 스냅샷 동기화
--
-- activity_posts / group_messages 는 작성 시점의 author_name/author_avatar_url 을
-- 컬럼에 저장한다(프로필 RLS상 타인 프로필을 직접 조회할 수 없어 denormalize 함).
-- 그래서 유저가 아바타/닉네임을 바꿔도 과거에 올린 인증글·갤러리·채팅에는
-- 옛 아바타/이름이 그대로 남는다.
--
-- profiles UPDATE 후, 해당 유저의 모든 스냅샷을 최신값으로 갱신하는 트리거를 둔다.

CREATE OR REPLACE FUNCTION public.sync_author_denorm_on_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.avatar_url IS DISTINCT FROM OLD.avatar_url
     OR NEW.username IS DISTINCT FROM OLD.username THEN

    UPDATE public.activity_posts
       SET author_name       = NEW.username,
           author_avatar_url = NEW.avatar_url
     WHERE user_id = NEW.id;

    UPDATE public.group_messages
       SET author_name       = NEW.username,
           author_avatar_url = NEW.avatar_url
     WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_author_denorm ON public.profiles;
CREATE TRIGGER trg_sync_author_denorm
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_author_denorm_on_profile_update();

-- 기존 스냅샷 백필: 이미 올라간 글/메시지의 아바타·이름을 현재 프로필값으로 맞춘다.
UPDATE public.activity_posts ap
   SET author_name       = p.username,
       author_avatar_url = p.avatar_url
  FROM public.profiles p
 WHERE ap.user_id = p.id
   AND (ap.author_name IS DISTINCT FROM p.username
        OR ap.author_avatar_url IS DISTINCT FROM p.avatar_url);

UPDATE public.group_messages gm
   SET author_name       = p.username,
       author_avatar_url = p.avatar_url
  FROM public.profiles p
 WHERE gm.user_id = p.id
   AND (gm.author_name IS DISTINCT FROM p.username
        OR gm.author_avatar_url IS DISTINCT FROM p.avatar_url);
