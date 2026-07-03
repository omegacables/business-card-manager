-- 004: Activity log (アポ・商談・会話履歴) + LINE forwarding inbox
-- Apply via Supabase Dashboard SQL Editor or `supabase db push`.

-- 1. Activities: one row per interaction with a contact
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES business_cards(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'note'
    CHECK (type IN ('meeting', 'call', 'email', 'line', 'note', 'task')),
  title TEXT,
  content TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'line', 'calendar', 'ai')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_card
  ON activities (card_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_user
  ON activities (user_id, occurred_at DESC);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own activities" ON activities;
CREATE POLICY "Users can view own activities"
  ON activities FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own activities" ON activities;
CREATE POLICY "Users can insert own activities"
  ON activities FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own activities" ON activities;
CREATE POLICY "Users can update own activities"
  ON activities FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own activities" ON activities;
CREATE POLICY "Users can delete own activities"
  ON activities FOR DELETE USING (auth.uid() = user_id);

-- 2. LINE inbox: temporary buffer for forwarded messages,
--    flushed into one activity when the user sends 「記録 <名前>」
CREATE TABLE IF NOT EXISTS line_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_line_inbox_user
  ON line_inbox (user_id, created_at DESC);

ALTER TABLE line_inbox ENABLE ROW LEVEL SECURITY;
-- Accessed only via the server (service role); no user-facing policies needed.
