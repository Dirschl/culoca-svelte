BEGIN;

CREATE TABLE IF NOT EXISTS public.item_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  actor_user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  owner_user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  source text NULL,
  session_id text NULL,
  ip_hash text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_item_events_item_created_at
  ON public.item_events(item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_item_events_actor_created_at
  ON public.item_events(actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_item_events_owner_created_at
  ON public.item_events(owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_item_events_type_created_at
  ON public.item_events(event_type, created_at DESC);

ALTER TABLE public.item_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow insert item events" ON public.item_events;
CREATE POLICY "Allow insert item events" ON public.item_events
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Actors can view own item events" ON public.item_events;
CREATE POLICY "Actors can view own item events" ON public.item_events
  FOR SELECT USING (auth.uid() = actor_user_id);

DROP POLICY IF EXISTS "Owners can view events for own items" ON public.item_events;
CREATE POLICY "Owners can view events for own items" ON public.item_events
  FOR SELECT USING (auth.uid() = owner_user_id);

GRANT INSERT ON public.item_events TO anon, authenticated;
GRANT SELECT ON public.item_events TO authenticated;

COMMIT;
