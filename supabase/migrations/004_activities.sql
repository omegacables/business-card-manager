-- 004: Activity log (アポ・商談・会話履歴) + LINE forwarding inbox
-- Apply via Supabase Dashboard SQL Editor or `supabase db push`.
--
-- NOTE: production has drifted from 001 — profiles.id is TEXT there,
-- not UUID. The DO block below reads the actual column types and creates
-- matching FK columns, so this runs on either schema.

DO $$
DECLARE
  v_profiles_type TEXT;
  v_cards_type TEXT;
BEGIN
  SELECT data_type INTO v_profiles_type
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id';
  SELECT data_type INTO v_cards_type
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'business_cards' AND column_name = 'id';

  v_profiles_type := CASE WHEN v_profiles_type = 'uuid' THEN 'UUID' ELSE 'TEXT' END;
  v_cards_type    := CASE WHEN v_cards_type    = 'uuid' THEN 'UUID' ELSE 'TEXT' END;

  -- 1. Activities: one row per interaction with a contact
  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS activities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id %s NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      card_id %s NOT NULL REFERENCES business_cards(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'note'
        CHECK (type IN ('meeting', 'call', 'email', 'line', 'note', 'task')),
      title TEXT,
      content TEXT,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      source TEXT NOT NULL DEFAULT 'manual'
        CHECK (source IN ('manual', 'line', 'calendar', 'ai')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )$f$, v_profiles_type, v_cards_type);

  -- 2. LINE inbox: temporary buffer for forwarded messages,
  --    flushed into one activity when the user sends 「記録 <名前>」
  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS line_inbox (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id %s NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )$f$, v_profiles_type);
END $$;

CREATE INDEX IF NOT EXISTS idx_activities_card
  ON activities (card_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_user
  ON activities (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_line_inbox_user
  ON line_inbox (user_id, created_at DESC);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- ::text casts keep the policies valid whether user_id is UUID or TEXT.
DROP POLICY IF EXISTS "Users can view own activities" ON activities;
CREATE POLICY "Users can view own activities"
  ON activities FOR SELECT USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can insert own activities" ON activities;
CREATE POLICY "Users can insert own activities"
  ON activities FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can update own activities" ON activities;
CREATE POLICY "Users can update own activities"
  ON activities FOR UPDATE USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Users can delete own activities" ON activities;
CREATE POLICY "Users can delete own activities"
  ON activities FOR DELETE USING (auth.uid()::text = user_id::text);

ALTER TABLE line_inbox ENABLE ROW LEVEL SECURITY;
-- Accessed only via the server (service role); no user-facing policies needed.
