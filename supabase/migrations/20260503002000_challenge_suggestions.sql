CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.challenge_suggestions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT '투표중' CHECK (status IN ('투표중', '개발확정', '검토중')),
  category          TEXT NOT NULL CHECK (category IN ('운동/건강', '독서/공부', '생산성', '마음챙김', '식습관', '기타')),
  duration          TEXT NOT NULL CHECK (duration IN ('7일', '21일', '30일')),
  verify_method     TEXT,
  operator_comment  TEXT,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  votes_count       INT DEFAULT 0,
  comments_count    INT DEFAULT 0,
  agree_rate        INT DEFAULT 70,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.challenge_suggestion_votes (
  suggestion_id UUID REFERENCES public.challenge_suggestions(id) ON DELETE CASCADE NOT NULL,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (suggestion_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.challenge_suggestion_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID REFERENCES public.challenge_suggestions(id) ON DELETE CASCADE NOT NULL,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  author_name   TEXT DEFAULT '나',
  body          TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.challenge_suggestion_subscriptions (
  suggestion_id UUID REFERENCES public.challenge_suggestions(id) ON DELETE CASCADE NOT NULL,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (suggestion_id, user_id)
);

ALTER TABLE public.challenge_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_suggestion_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_suggestion_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_suggestion_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "challenge_suggestions_select" ON public.challenge_suggestions
  FOR SELECT USING (TRUE);
CREATE POLICY "challenge_suggestions_insert" ON public.challenge_suggestions
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "challenge_suggestion_votes_select" ON public.challenge_suggestion_votes
  FOR SELECT USING (TRUE);
CREATE POLICY "challenge_suggestion_votes_insert" ON public.challenge_suggestion_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "challenge_suggestion_votes_delete" ON public.challenge_suggestion_votes
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "challenge_suggestion_comments_select" ON public.challenge_suggestion_comments
  FOR SELECT USING (TRUE);
CREATE POLICY "challenge_suggestion_comments_insert" ON public.challenge_suggestion_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "challenge_suggestion_subscriptions_select" ON public.challenge_suggestion_subscriptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "challenge_suggestion_subscriptions_insert" ON public.challenge_suggestion_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "challenge_suggestion_subscriptions_delete" ON public.challenge_suggestion_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER challenge_suggestions_updated_at
  BEFORE UPDATE ON public.challenge_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.refresh_challenge_suggestion_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_id UUID;
BEGIN
  target_id := COALESCE(NEW.suggestion_id, OLD.suggestion_id);

  UPDATE public.challenge_suggestions
  SET
    votes_count = (
      SELECT COUNT(*)::INT
      FROM public.challenge_suggestion_votes
      WHERE suggestion_id = target_id
    ),
    comments_count = (
      SELECT COUNT(*)::INT
      FROM public.challenge_suggestion_comments
      WHERE suggestion_id = target_id
    )
  WHERE id = target_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE TRIGGER challenge_suggestion_votes_count
  AFTER INSERT OR DELETE ON public.challenge_suggestion_votes
  FOR EACH ROW EXECUTE FUNCTION public.refresh_challenge_suggestion_counts();

CREATE OR REPLACE TRIGGER challenge_suggestion_comments_count
  AFTER INSERT OR DELETE ON public.challenge_suggestion_comments
  FOR EACH ROW EXECUTE FUNCTION public.refresh_challenge_suggestion_counts();

INSERT INTO public.challenge_suggestions
  (id, title, description, status, category, duration, votes_count, comments_count, agree_rate, verify_method, operator_comment, created_at)
VALUES
  ('11111111-1111-4111-8111-111111111111', '매일 스트레칭 10분 챌린지', '아침마다 간단한 스트레칭으로 하루를 시작하는 챌린지예요.', '투표중', '운동/건강', '7일', 128, 2, 67, '스트레칭 완료 사진 또는 영상', NULL, NOW() - INTERVAL '3 days'),
  ('22222222-2222-4222-8222-222222222222', '하루 한 줄 독서 기록', '읽은 책의 한 줄 감상을 매일 기록하는 챌린지입니다. 꾸준한 독서 습관 형성에 도움이 돼요.', '개발확정', '독서/공부', '30일', 243, 2, 89, '책 페이지 + 한 줄 감상 사진', '많은 분들의 응원 덕분에 개발을 시작하게 됐어요. 최대한 빠르게 만들어 드릴게요!', NOW() - INTERVAL '7 days'),
  ('33333333-3333-4333-8333-333333333333', '물 2L 마시기 챌린지', '하루 권장 수분 섭취를 습관으로 만드는 챌린지예요.', '검토중', '식습관', '21일', 57, 1, 72, NULL, NULL, NOW() - INTERVAL '5 days'),
  ('44444444-4444-4444-8444-444444444444', '매일 감사 일기 쓰기', '하루 세 가지 감사한 점을 적어 긍정적인 마음을 기르는 챌린지예요.', '투표중', '마음챙김', '21일', 94, 1, 81, NULL, NULL, NOW() - INTERVAL '2 days'),
  ('55555555-5555-4555-8555-555555555555', '주 3회 홈트 루틴', '집에서 할 수 있는 간단한 홈트레이닝을 꾸준히 하는 챌린지예요.', '투표중', '운동/건강', '30일', 76, 0, 74, NULL, NULL, NOW() - INTERVAL '6 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.challenge_suggestion_comments
  (suggestion_id, user_id, author_name, body, created_at)
SELECT '11111111-1111-4111-8111-111111111111', id, '김', '정말 좋은 아이디어에요! 저도 꼭 해보고 싶어요.', NOW() - INTERVAL '2 days'
FROM auth.users
LIMIT 1
ON CONFLICT DO NOTHING;
