ALTER TABLE public.challenge_suggestions
  ADD COLUMN IF NOT EXISTS cover_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('suggestion-covers', 'suggestion-covers', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "suggestion_covers_public_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'suggestion-covers');

CREATE POLICY "suggestion_covers_owner_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'suggestion-covers'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "suggestion_covers_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'suggestion-covers'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
