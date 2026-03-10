# Testing & Debugging Guide - Ideation Video Sync

## Quick Status Check

Run these queries in your Supabase SQL editor to verify the sync is working:

### 1. Check Total Videos in System
```sql
-- Videos in tracked_videos (master list)
SELECT 
  'tracked_videos' as source,
  COUNT(*) as total_count
FROM public.tracked_videos
UNION ALL
-- Videos in user_videos (synced)
SELECT 
  'user_videos' as source,
  COUNT(*) as total_count
FROM public.user_videos
UNION ALL
-- Videos in ideation specifically
SELECT 
  'user_videos (ideation only)' as source,
  COUNT(*) as total_count
FROM public.user_videos
WHERE tab_type = 'ideation';
```

### 2. Find Missing Videos (Should Return 0)
```sql
-- Count videos in tracked_videos that are NOT in user_videos
SELECT 
  COUNT(*) as missing_videos_count,
  COUNT(DISTINCT tv.channel_id) as affected_channels
FROM public.tracked_videos tv
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_videos uv 
  WHERE uv.video_id = tv.video_id
);
```

### 3. Verify Ideation Tab Type Distribution
```sql
SELECT 
  CASE 
    WHEN tab_type = 'ideation' THEN 'Ideation (Personal)'
    WHEN tab_type = 'usa' THEN 'USA (Global)'
    WHEN tab_type = 'spanish' THEN 'Spanish (Global)'
    ELSE 'Unknown'
  END as tab_type,
  COUNT(*) as video_count
FROM public.user_videos
GROUP BY tab_type
ORDER BY video_count DESC;
```

### 4. Check Recent Additions to Ideation
```sql
-- Most recent 50 videos added to ideation
SELECT 
  video_id,
  title,
  channel_name,
  created_at,
  view_count,
  tab_type
FROM public.user_videos
WHERE tab_type = 'ideation'
ORDER BY created_at DESC
LIMIT 50;
```

## Manual Sync Testing

### Force Sync All Videos Now
```sql
-- This runs the comprehensive sync function
SELECT * FROM public.sync_all_tracked_videos_to_users();

-- Example output:
-- total_tracked_videos | total_users_affected | videos_synced | duration_seconds
-- 12345                | 25                   | 1250          | 2.5
```

### Check if Triggers are Firing
```sql
-- Look for recent log entries from trigger execution
-- (Note: These will appear in Supabase logs if logging is enabled)
-- Check poll-rss-feeds logs for "Phase 5" messages
```

## Monitoring Sync Health

### 1. Track Cron Job Execution
```sql
-- View cron job status (in Supabase Dashboard)
-- Go to: Database > Cron > Active Jobs
-- Look for: 'sync-missed-videos-safety-net' (should run every 10 min)
```

### 2. Check Trigger Errors
```sql
-- Enable query logging in Supabase to see trigger errors
-- Go to: Database > Query Performance > Recent Slow Queries
```

### 3. Monitor Poll-RSS-Feeds Execution
```sql
-- Check execution logs in Supabase Dashboard
-- Go to: Functions > poll-rss-feeds > Invocations
-- Look for Phase 5 output showing videos synced
```

## If Videos Are Still Not Appearing

### Step 1: Verify Channel Tracking
```sql
-- Check if user has channels tracked
SELECT 
  id,
  user_id,
  channel_id,
  channel_name,
  is_active,
  tab_type
FROM public.tracked_channels
WHERE user_id = 'YOUR_USER_ID'  -- Replace with actual user ID
AND is_active = true;
```

### Step 2: Verify Tracked Videos Exist
```sql
-- Check if there are ANY videos for your tracked channels
SELECT 
  COUNT(*) as total_videos,
  COUNT(DISTINCT channel_id) as channels_with_videos
FROM public.tracked_videos
WHERE channel_id IN (
  SELECT channel_id 
  FROM public.tracked_channels 
  WHERE user_id = 'YOUR_USER_ID'
  AND is_active = true
);
```

### Step 3: Check User Videos
```sql
-- Check if videos exist for this user
SELECT 
  COUNT(*) as total_user_videos,
  COUNT(CASE WHEN tab_type = 'ideation' THEN 1 END) as ideation_videos
FROM public.user_videos
WHERE user_id = 'YOUR_USER_ID';
```

### Step 4: Manual Sync for Specific User
```sql
-- Insert missing videos for a specific user
INSERT INTO public.user_videos (
  user_id, title, youtube_url, video_id, thumbnail_url, 
  channel_name, upload_date, view_count, niche, channel_id, 
  created_at, tab_type, is_global
)
SELECT
  'YOUR_USER_ID',
  tv.title,
  COALESCE(tv.youtube_url, 'https://www.youtube.com/watch?v=' || tv.video_id),
  tv.video_id,
  COALESCE(tv.thumbnail_url, 'https://i.ytimg.com/vi/' || tv.video_id || '/hqdefault.jpg'),
  COALESCE(tv.channel_name, tc.channel_name, 'Unknown Channel'),
  COALESCE(tv.published_at::date, CURRENT_DATE),
  COALESCE(tv.view_count, 0),
  COALESCE(tc.niche, 'Uncategorized'),
  tv.channel_id,
  now(),
  'ideation',
  false
FROM public.tracked_videos tv
INNER JOIN public.tracked_channels tc
  ON tc.channel_id = tv.channel_id
  AND tc.user_id = 'YOUR_USER_ID'
WHERE tc.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.user_videos uv
    WHERE uv.user_id = 'YOUR_USER_ID' AND uv.video_id = tv.video_id
  );
```

## Common Issues & Solutions

### Issue: Cron Job Not Running
**Solution**: 
- Check that pg_cron extension is enabled
- Verify database credentials haven't changed
- Restart the cron job: Drop and recreate it via SQL

### Issue: Trigger Not Firing
**Solution**:
- Check trigger is enabled: `SELECT * FROM information_schema.triggers WHERE trigger_name = 'trigger_auto_sync_video';`
- Verify trigger function is working: Look at logs
- Try manually inserting a test video to tracked_videos

### Issue: Videos With Wrong Tab Type
**Solution**:
```sql
-- Fix videos with wrong tab_type
UPDATE public.user_videos
SET tab_type = 'ideation'
WHERE tab_type IS NULL 
  OR tab_type = ''
  OR (is_global = false AND tab_type != 'ideation');
```

### Issue: Duplicate Videos
**Solution**:
```sql
-- Find duplicates
SELECT video_id, user_id, COUNT(*) as count
FROM public.user_videos
GROUP BY video_id, user_id
HAVING COUNT(*) > 1
LIMIT 10;

-- Remove duplicates (keep oldest, delete newer)
DELETE FROM public.user_videos
WHERE (user_id, video_id, id) IN (
  SELECT user_id, video_id, id
  FROM public.user_videos
  WHERE (video_id, user_id) IN (
    SELECT video_id, user_id
    FROM public.user_videos
    GROUP BY video_id, user_id
    HAVING COUNT(*) > 1
  )
  ORDER BY user_id, video_id, created_at DESC
  OFFSET 1
);
```

## Performance Tuning

### Check Index Usage
```sql
-- Verify key indexes exist
SELECT indexname 
FROM pg_indexes 
WHERE tablename IN ('user_videos', 'tracked_videos', 'tracked_channels')
ORDER BY tablename, indexname;

-- Should include:
-- idx_user_videos_tab_ideation
-- idx_tracked_channels_tab_ideation
-- idx_user_videos_user_id
-- idx_tracked_videos_channel_id
```

### Monitor Large Syncs
```sql
-- If syncing large numbers of videos, monitor query performance
-- Run in a new transaction to see how long it takes
BEGIN;
  SELECT public.sync_all_tracked_videos_to_users();
ROLLBACK; -- Or COMMIT if successful
```

## Logging & Debugging

### Enable Detailed Logging
```sql
-- The migration uses RAISE NOTICE for logging
-- Check logs in Supabase Dashboard → Database → Logs
-- Filter by "Ideation" or "sync" keywords
```

### Enable Debug Mode in poll-rss-feeds
```sql
-- The function uses console.log()
-- Check logs in Supabase Dashboard → Functions → Invocations
-- Look for Phase 5 output
```

## Recovery Procedures

### Complete Fresh Sync (Nuclear Option)
```sql
-- THIS DELETES ALL user_videos AND RESSYNCS
-- Only use if other methods fail!

BEGIN;
  -- Delete all user_videos (BACKUP FIRST!)
  DELETE FROM public.user_videos;
  
  -- Resync everything
  SELECT public.sync_all_tracked_videos_to_users();
COMMIT;
```

### Verify No Orphaned Records
```sql
-- Find user_videos with channels that no longer exist
SELECT uv.video_id, uv.user_id, uv.channel_id
FROM public.user_videos uv
LEFT JOIN public.tracked_channels tc ON tc.channel_id = uv.channel_id
WHERE tc.id IS NULL
LIMIT 10;

-- Clean them up if needed
DELETE FROM public.user_videos
WHERE channel_id NOT IN (SELECT channel_id FROM public.tracked_channels);
```

---

## Contact Support

If issues persist:
1. Run the status check queries above
2. Collect logs from Supabase Dashboard
3. Document: 
   - Number of tracked channels
   - Number of users affected
   - Time period of missing videos
4. Submit findings to development team
