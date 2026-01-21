-- ============================================
-- SQL Commands for Supabase SQL Editor
-- Make all users except admin pending
-- NOTE: The column is "user_status" not "status"
-- ============================================

-- 1. Make ALL users except admin pending
UPDATE public.profiles
SET user_status = 'pending'
WHERE id NOT IN (
  SELECT id FROM auth.users WHERE email = 'admin@blowmeai.com'
);

-- 2. Verify the changes
SELECT 
  p.id,
  u.email,
  p.user_status,
  p.created_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
ORDER BY p.created_at DESC;

-- ============================================
-- Other useful admin commands
-- ============================================

-- 3. Make a specific user approved by email
-- UPDATE public.profiles
-- SET user_status = 'approved'
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'user@example.com');

-- 4. Block a specific user by email
-- UPDATE public.profiles
-- SET user_status = 'blocked'
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'user@example.com');

-- 5. Get all pending users
SELECT 
  p.id,
  u.email,
  p.user_status,
  p.created_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.user_status = 'pending'
ORDER BY p.created_at DESC;

-- 6. Get all approved users
SELECT 
  p.id,
  u.email,
  p.user_status,
  p.created_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.user_status = 'approved'
ORDER BY p.created_at DESC;

-- 7. Get all blocked users
SELECT 
  p.id,
  u.email,
  p.user_status,
  p.created_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.user_status = 'blocked'
ORDER BY p.created_at DESC;

-- 8. Count users by status
SELECT 
  user_status,
  COUNT(*) as count
FROM public.profiles
GROUP BY user_status;

-- 9. Get admin user info
SELECT 
  p.id,
  u.email,
  p.user_status,
  p.created_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'admin@blowmeai.com';

-- 10. Check cron jobs status
SELECT * FROM cron.job;


-- 11. Check recent cron job runs
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;

-- 12. Get video counts per user
SELECT 
  u.email,
  COUNT(uv.id) as video_count
FROM auth.users u
LEFT JOIN public.user_videos uv ON uv.user_id = u.id
GROUP BY u.email
ORDER BY video_count DESC;

-- 13. Get tracked channels count
SELECT COUNT(*) as total_tracked_channels FROM public.tracked_channels;

-- 14. Get tracked videos count (global)
SELECT COUNT(*) as total_tracked_videos FROM public.tracked_videos;

-- 15. Get recent videos from tracked_videos
SELECT 
  video_id,
  title,
  channel_name,
  published_at,
  created_at,
  view_count
FROM public.tracked_videos
ORDER BY created_at DESC
LIMIT 20;

-- ============================================
-- FIX "Unknown Channel" Issue - Run these commands
-- ============================================

-- 16. Find videos with "Unknown Channel"
SELECT COUNT(*) as unknown_channel_count 
FROM public.user_videos 
WHERE channel_name = 'Unknown Channel' OR channel_name IS NULL OR channel_name = '';

-- 17. Fix user_videos - get channel name from tracked_videos
UPDATE public.user_videos uv
SET channel_name = tv.channel_name
FROM public.tracked_videos tv
WHERE uv.video_id = tv.video_id
  AND tv.channel_name IS NOT NULL
  AND tv.channel_name != ''
  AND tv.channel_name != 'Unknown Channel'
  AND (uv.channel_name IS NULL OR uv.channel_name = 'Unknown Channel' OR uv.channel_name = '');

-- 18. Fix user_videos - get channel name from tracked_channels using channel_id
UPDATE public.user_videos uv
SET channel_name = tc.channel_name
FROM public.tracked_channels tc
WHERE uv.channel_id = tc.channel_id
  AND tc.channel_name IS NOT NULL
  AND tc.channel_name != ''
  AND (uv.channel_name IS NULL OR uv.channel_name = 'Unknown Channel' OR uv.channel_name = '');

-- 19. Fix user_videos - get channel name from admin_global_channels
UPDATE public.user_videos uv
SET channel_name = agc.channel_name
FROM public.admin_global_channels agc
WHERE uv.channel_id = agc.channel_id
  AND agc.channel_name IS NOT NULL
  AND agc.channel_name != ''
  AND (uv.channel_name IS NULL OR uv.channel_name = 'Unknown Channel' OR uv.channel_name = '');

-- 20. Fix tracked_videos - get channel name from tracked_channels
UPDATE public.tracked_videos tv
SET channel_name = tc.channel_name
FROM public.tracked_channels tc
WHERE tv.channel_id = tc.channel_id
  AND tc.channel_name IS NOT NULL
  AND tc.channel_name != ''
  AND (tv.channel_name IS NULL OR tv.channel_name = 'Unknown Channel' OR tv.channel_name = '');

-- 21. Verify fix - check remaining unknown channels
SELECT COUNT(*) as remaining_unknown 
FROM public.user_videos 
WHERE channel_name = 'Unknown Channel' OR channel_name IS NULL OR channel_name = '';

-- 22. List videos still with unknown channel (to debug)
SELECT uv.id, uv.video_id, uv.channel_id, uv.channel_name, uv.title
FROM public.user_videos uv
WHERE uv.channel_name = 'Unknown Channel' OR uv.channel_name IS NULL OR uv.channel_name = ''
LIMIT 20;
