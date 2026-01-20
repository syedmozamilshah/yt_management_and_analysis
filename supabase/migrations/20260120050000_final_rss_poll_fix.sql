-- ============================================
-- Final Fix for RSS Poll - Include ALL Channels
-- ============================================

-- Drop old function and recreate with simpler logic
DROP FUNCTION IF EXISTS get_channels_for_rss_poll();

CREATE OR REPLACE FUNCTION get_channels_for_rss_poll()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  channel_id TEXT,
  channel_name TEXT,
  rss_feed_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  -- Get ALL active tracked channels that have an RSS feed URL
  SELECT DISTINCT ON (tc.channel_id)
    tc.id,
    tc.user_id,
    tc.channel_id,
    tc.channel_name,
    tc.rss_feed_url
  FROM public.tracked_channels tc
  WHERE tc.is_active = true
    AND tc.rss_feed_url IS NOT NULL
    AND tc.rss_feed_url != ''
  ORDER BY tc.channel_id, tc.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_channels_for_rss_poll TO service_role;

-- Log how many channels are now available
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM get_channels_for_rss_poll();
  RAISE NOTICE 'Channels available for RSS polling: %', v_count;
END $$;
