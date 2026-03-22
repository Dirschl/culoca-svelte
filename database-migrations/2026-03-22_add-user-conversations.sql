BEGIN;

CREATE TABLE IF NOT EXISTS public.user_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_key text NOT NULL UNIQUE,
  user_a_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  starter_item_id uuid NULL REFERENCES public.items(id) ON DELETE SET NULL,
  created_by_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text NULL,
  last_message_sender_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_a_last_read_at timestamptz NULL,
  user_b_last_read_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_conversations_distinct_users CHECK (user_a_id <> user_b_id),
  CONSTRAINT user_conversations_preview_length CHECK (
    last_message_preview IS NULL OR char_length(last_message_preview) <= 500
  )
);

CREATE INDEX IF NOT EXISTS idx_user_conversations_user_a_last_message
  ON public.user_conversations(user_a_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_conversations_user_b_last_message
  ON public.user_conversations(user_b_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.user_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.user_conversations(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id uuid NULL REFERENCES public.items(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_messages_body_length CHECK (char_length(trim(body)) BETWEEN 1 AND 4000)
);

CREATE INDEX IF NOT EXISTS idx_user_messages_conversation_created_at
  ON public.user_messages(conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_user_messages_sender_created_at
  ON public.user_messages(sender_user_id, created_at DESC);

ALTER TABLE public.user_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view conversations" ON public.user_conversations;
CREATE POLICY "Participants can view conversations" ON public.user_conversations
  FOR SELECT USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.user_conversations;
CREATE POLICY "Authenticated users can create conversations" ON public.user_conversations
  FOR INSERT WITH CHECK (
    auth.uid() = created_by_user_id
    AND (auth.uid() = user_a_id OR auth.uid() = user_b_id)
  );

DROP POLICY IF EXISTS "Participants can update conversations" ON public.user_conversations;
CREATE POLICY "Participants can update conversations" ON public.user_conversations
  FOR UPDATE USING (auth.uid() = user_a_id OR auth.uid() = user_b_id)
  WITH CHECK (auth.uid() = user_a_id OR auth.uid() = user_b_id);

DROP POLICY IF EXISTS "Participants can view messages" ON public.user_messages;
CREATE POLICY "Participants can view messages" ON public.user_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.user_conversations
      WHERE user_conversations.id = user_messages.conversation_id
        AND (user_conversations.user_a_id = auth.uid() OR user_conversations.user_b_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Participants can send messages" ON public.user_messages;
CREATE POLICY "Participants can send messages" ON public.user_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_user_id
    AND EXISTS (
      SELECT 1
      FROM public.user_conversations
      WHERE user_conversations.id = user_messages.conversation_id
        AND (user_conversations.user_a_id = auth.uid() OR user_conversations.user_b_id = auth.uid())
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.user_conversations TO authenticated;
GRANT SELECT, INSERT ON public.user_messages TO authenticated;

COMMIT;
