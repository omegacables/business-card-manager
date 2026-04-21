-- Security hardening migration (2026-04-21)
-- Addresses:
--   1. Storage bucket privacy (card-images was publicly readable)
--   2. Atomic monthly usage increment (race condition fix)

-- ==========================================================
-- 1. Storage bucket: make private + tighten policies
-- ==========================================================

UPDATE storage.buckets
SET public = false
WHERE id = 'card-images';

-- Drop old public-read policy
DROP POLICY IF EXISTS "Users can view card images" ON storage.objects;

-- New policy: only owner can view (folder name must match user id)
-- Note: Because app uses service_role client, RLS is primarily defense-in-depth.
CREATE POLICY "Users can view own card images"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'card-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ==========================================================
-- 2. Atomic monthly_usage increment
-- ==========================================================

-- Replace read-modify-write pattern with atomic RPC.
-- Respects p_max_count; NULL means unlimited (pro plan).
CREATE OR REPLACE FUNCTION increment_card_usage(
  p_user_id UUID,
  p_year_month TEXT,
  p_max_count INTEGER DEFAULT NULL
) RETURNS TABLE(success BOOLEAN, current_count INTEGER, error_message TEXT) AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  -- First attempt: insert or increment atomically.
  INSERT INTO monthly_usage (user_id, year_month, cards_registered)
  VALUES (p_user_id, p_year_month, 1)
  ON CONFLICT (user_id, year_month)
  DO UPDATE SET
    cards_registered = monthly_usage.cards_registered + 1,
    updated_at = NOW()
  WHERE
    p_max_count IS NULL OR monthly_usage.cards_registered < p_max_count
  RETURNING cards_registered INTO v_new_count;

  IF v_new_count IS NULL THEN
    -- Update predicate rejected the row = limit reached.
    -- Fetch the current count for a meaningful error message.
    SELECT cards_registered INTO v_new_count
      FROM monthly_usage
      WHERE user_id = p_user_id AND year_month = p_year_month;

    RETURN QUERY SELECT false, v_new_count, '今月の登録上限に達しました'::TEXT;
  ELSE
    RETURN QUERY SELECT true, v_new_count, NULL::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant execute to anon & authenticated (admin client uses service_role, but this enables
-- future direct client usage too).
GRANT EXECUTE ON FUNCTION increment_card_usage(UUID, TEXT, INTEGER) TO authenticated, anon, service_role;
