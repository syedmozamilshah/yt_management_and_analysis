-- ============================================
-- Create sync_missed_videos_for_all_users() RPC
-- ============================================
-- Purpose: Ensure ALL users who have tracked channels get any missing videos
-- synced to their user_videos table (ideation + country tabs).
-- This is called by the admin polling loop and poll-rss-feeds edge function
-- to guarantee no user misses a video due to trigger timing or activity checks.

CREATE OR REPLACE FUNCTION public.sync_missed_videos_for_all_users()
RETURNS INTEGER AS $$
DECLARE
  v_user RECORD;
  v_user_synced INTEGER;
  v_total_synced INTEGER := 0;
BEGIN
  -- Loop through all users who have at least one active tracked channel
  FOR v_user IN
    SELECT DISTINCT tc.user_id
    FROM public.tracked_channels tc
    WHERE tc.is_active = true
  LOOP
    -- Insert missing videos from tracked_videos into user_videos for this user
    INSERT INTO public.user_videos (
      user_id, title, youtube_url, video_id, thumbnail_url, channel_name,
      upload_date, view_count, niche, channel_id, created_at, tab_type, is_global
    )
    SELECT
      v_user.user_id,
      tv.title,
      COALESCE(tv.youtube_url, 'https://www.youtube.com/watch?v=' || tv.video_id),
      tv.video_id,
      COALESCE(tv.thumbnail_url, 'https://i.ytimg.com/vi/' || tv.video_id || '/hqdefault.jpg'),
      COALESCE(
        NULLIF(tv.channel_name, ''),
        (SELECT tc2.channel_name FROM public.tracked_channels tc2
         WHERE tc2.channel_id = tv.channel_id AND tc2.channel_name IS NOT NULL AND tc2.channel_name != '' LIMIT 1),
        (SELECT agc.channel_name FROM public.admin_global_channels agc
         WHERE agc.channel_id = tv.channel_id AND agc.channel_name IS NOT NULL AND agc.channel_name != '' LIMIT 1),
        'Unknown Channel'
      ),
      COALESCE(tv.published_at::date, CURRENT_DATE),
      COALESCE(tv.view_count, 0),
      COALESCE(
        (SELECT ucs.niche FROM public.user_channel_subscriptions ucs
         WHERE ucs.user_id = v_user.user_id AND ucs.channel_id = tv.channel_id LIMIT 1),
        (SELECT agc.niche FROM public.admin_global_channels agc
         WHERE agc.channel_id = tv.channel_id LIMIT 1),
        'Uncategorized'
      ),
      tv.channel_id,
      now(),
      COALESCE(tc.tab_type, 'ideation'),
      COALESCE(tc.is_global, false)
    FROM public.tracked_videos tv
    INNER JOIN public.tracked_channels tc
      ON tc.channel_id = tv.channel_id
      AND tc.user_id = v_user.user_id
    WHERE tc.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM public.user_videos uv
        WHERE uv.user_id = v_user.user_id AND uv.video_id = tv.video_id
      )
    ON CONFLICT (user_id, video_id) DO UPDATE SET
      view_count = EXCLUDED.view_count,
      tab_type = EXCLUDED.tab_type,
      is_global = EXCLUDED.is_global,
      channel_name = CASE
        WHEN EXCLUDED.channel_name IS NOT NULL
             AND EXCLUDED.channel_name != ''
             AND EXCLUDED.channel_name != 'Unknown Channel'
        THEN EXCLUDED.channel_name
        ELSE COALESCE(public.user_videos.channel_name, EXCLUDED.channel_name)
      END;

    GET DIAGNOSTICS v_user_synced = ROW_COUNT;
    v_total_synced := v_total_synced + v_user_synced;
  END LOOP;

  -- Also propagate updated view counts from tracked_videos to user_videos
  -- This ensures all users see the latest view counts
  UPDATE public.user_videos uv
  SET view_count = tv.view_count
  FROM public.tracked_videos tv
  WHERE uv.video_id = tv.video_id
    AND tv.view_count IS NOT NULL
    AND tv.view_count > 0
    AND (uv.view_count IS NULL OR uv.view_count = 0 OR tv.view_count > uv.view_count);

  RETURN v_total_synced;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.sync_missed_videos_for_all_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_missed_videos_for_all_users() TO service_role;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration complete: sync_missed_videos_for_all_users() created';
END $$;
