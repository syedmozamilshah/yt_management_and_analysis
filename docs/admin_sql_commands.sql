-- ============================================
-- SQL Commands for Supabase SQL Editor
-- Make all users except admin pending
-- ============================================

-- 1. Make ALL users except admin pending
UPDATE public.profiles
SET status = 'pending'
WHERE id NOT IN (
  SELECT id FROM auth.users WHERE email = 'admin@blowmeai.com'
);

-- 2. Verify the changes
SELECT 
  p.id,
  u.email,
  p.status,
  p.created_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
ORDER BY p.created_at DESC;

-- ============================================
-- Other useful admin commands
-- ============================================

-- 3. Make a specific user approved by email
-- UPDATE public.profiles
-- SET status = 'approved'
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'user@example.com');

-- 4. Block a specific user by email
-- UPDATE public.profiles
-- SET status = 'blocked'
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'user@example.com');

-- 5. Get all pending users
SELECT 
  p.id,
  u.email,
  p.status,
  p.created_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.status = 'pending'
ORDER BY p.created_at DESC;

-- 6. Get all approved users
SELECT 
  p.id,
  u.email,
  p.status,
  p.created_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.status = 'approved'
ORDER BY p.created_at DESC;

-- 7. Get all blocked users
SELECT 
  p.id,
  u.email,
  p.status,
  p.created_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.status = 'blocked'
ORDER BY p.created_at DESC;

-- 8. Count users by status
SELECT 
  status,
  COUNT(*) as count
FROM public.profiles
GROUP BY status;

-- 9. Get admin user info
SELECT 
  p.id,
  u.email,
  p.status,
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
