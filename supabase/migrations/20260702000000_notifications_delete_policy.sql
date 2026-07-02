-- 알림 삭제 허용: 본인 알림만 DELETE 가능
-- (기존엔 SELECT/UPDATE 정책만 있어 클라이언트에서 삭제 불가였음)

CREATE POLICY "notifications_delete" ON notifications
  FOR DELETE USING (auth.uid() = user_id);
