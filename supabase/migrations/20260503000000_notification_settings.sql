CREATE TABLE IF NOT EXISTS public.notification_settings (
  user_id                 UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  daily_enabled           BOOLEAN DEFAULT TRUE,
  daily_time              TEXT DEFAULT '07:00',
  challenge_enabled       BOOLEAN DEFAULT TRUE,
  weekly_report_enabled   BOOLEAN DEFAULT TRUE,
  achievement_enabled     BOOLEAN DEFAULT TRUE,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_settings_select" ON public.notification_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notification_settings_insert" ON public.notification_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notification_settings_update" ON public.notification_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
