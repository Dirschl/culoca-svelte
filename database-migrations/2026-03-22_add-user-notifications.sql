BEGIN;

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  item_id uuid NULL REFERENCES public.items(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_recipient_created_at
  ON public.user_notifications(recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_notifications_recipient_unread
  ON public.user_notifications(recipient_user_id, read_at, created_at DESC);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recipients can view own notifications" ON public.user_notifications;
CREATE POLICY "Recipients can view own notifications" ON public.user_notifications
  FOR SELECT USING (auth.uid() = recipient_user_id);

DROP POLICY IF EXISTS "Recipients can update own notifications" ON public.user_notifications;
CREATE POLICY "Recipients can update own notifications" ON public.user_notifications
  FOR UPDATE USING (auth.uid() = recipient_user_id)
  WITH CHECK (auth.uid() = recipient_user_id);

DROP POLICY IF EXISTS "Actors can insert notifications" ON public.user_notifications;
CREATE POLICY "Actors can insert notifications" ON public.user_notifications
  FOR INSERT WITH CHECK (
    auth.uid() = actor_user_id
    AND recipient_user_id <> actor_user_id
  );

GRANT SELECT, UPDATE ON public.user_notifications TO authenticated;
GRANT INSERT ON public.user_notifications TO authenticated;

COMMIT;
