-- ============================================
-- Fix sync_missed_videos_for_user SQL Bug
-- ============================================
-- The UPDATE statement was doing LEFT JOIN ... ON tv.video_id = uv.video_id
-- which is invalid in PostgreSQL (can't reference UPDATE target in FROM clause's JOIN ON)
-- Error: "invalid reference to FROM-clause entry for table "uv""

CREATE OR REPLACE FUNCTION public.sync_missed_videos_for_user(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_synced_count INTEGER := 0;
  v_new_count INTEGER := 0;
  v_updated_count INTEGER := 0;
BEGIN
  -- Update user activity first
  INSERT INTO public.user_activity (user_id, last_ideation_opened_at)
  VALUES (p_user_id, now())
  ON CONFLICT (user_id) DO UPDATE SET last_ideation_opened_at = now();

  -- Insert NEW videos that don't exist yet
  INSERT INTO public.user_videos (
    user_id, title, youtube_url, video_id, thumbnail_url, channel_name,
    upload_date, view_count, niche, channel_id, created_at, tab_type, is_global
  )
  SELECT 
    p_user_id,
    tv.title,
    COALESCE(tv.youtube_url, 'https://www.youtube.com/watch?v=' || tv.video_id),
    tv.video_id,
    COALESCE(tv.thumbnail_url, 'https://i.ytimg.com/vi/' || tv.video_id || '/hqdefault.jpg'),
    COALESCE(
      NULLIF(tv.channel_name, ''),
      (SELECT tc2.channel_name FROM public.tracked_channels tc2 
       WHERE tc2.channel_id = tv.channel_id AND tc2.channel_name IS NOT NULL LIMIT 1),
      (SELECT agc.channel_name FROM public.admin_global_channels agc 
       WHERE agc.channel_id = tv.channel_id AND agc.channel_name IS NOT NULL LIMIT 1),
      'Unknown Channel'
    ),
    COALESCE(tv.published_at::date, CURRENT_DATE),
    COALESCE(tv.view_count, 0),
    COALESCE(
      (SELECT ucs.niche FROM public.user_channel_subscriptions ucs 
       WHERE ucs.user_id = p_user_id AND ucs.channel_id = tv.channel_id LIMIT 1),
      (SELECT agc.niche FROM public.admin_global_channels agc 
       WHERE agc.channel_id = tv.channel_id LIMIT 1),
      'Uncategorized'
    ),
    tv.channel_id,
    now(),
    COALESCE(
      (SELECT tc3.tab_type FROM public.tracked_channels tc3 
       WHERE tc3.user_id = p_user_id AND tc3.channel_id = tv.channel_id LIMIT 1),
      'ideation'
    ),
    COALESCE(
      (SELECT tc4.is_global FROM public.tracked_channels tc4 
       WHERE tc4.user_id = p_user_id AND tc4.channel_id = tv.channel_id LIMIT 1),
      false
    )
  FROM public.tracked_videos tv
  INNER JOIN public.tracked_channels tc ON tc.channel_id = tv.channel_id AND tc.user_id = p_user_id
  WHERE tc.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.user_videos uv 
      WHERE uv.user_id = p_user_id AND uv.video_id = tv.video_id
    );

  GET DIAGNOSTICS v_new_count = ROW_COUNT;
  
  -- Fix existing videos that have wrong tab_type
  -- Cannot reference UPDATE target alias in FROM clause JOIN ON in PostgreSQL
  -- So we only join tracked_channels and move conditions to WHERE
  UPDATE public.user_videos uv
  SET 
    tab_type = tc.tab_type,
    is_global = tc.is_global
  FROM public.tracked_channels tc
  WHERE uv.user_id = p_user_id
    AND tc.user_id = p_user_id
    AND tc.channel_id = uv.channel_id
    AND tc.is_active = true
    AND (
      uv.tab_type IS NULL 
      OR uv.tab_type = '' 
      OR uv.tab_type != tc.tab_type
    );
    
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  v_synced_count := v_new_count + v_updated_count;
  
  RETURN v_synced_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.sync_missed_videos_for_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_missed_videos_for_user(UUID) TO service_role;
