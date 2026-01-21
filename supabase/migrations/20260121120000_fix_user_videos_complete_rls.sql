-- ============================================
-- Complete Fix for user_videos and profiles RLS Policies
-- Ensures approved users can access their videos
-- ============================================

-- ===========================================
-- FIX PROFILES TABLE RLS POLICIES FIRST
-- ===========================================

-- Drop existing policies on profiles to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update all profiles" ON public.profiles;

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Simple policy: Users can ALWAYS view their own profile (no subquery)
CREATE POLICY "profiles_select_own" 
  ON public.profiles 
  FOR SELECT 
  USING (auth.uid() = id);

-- Admin select policy using email check (avoids circular reference)
CREATE POLICY "profiles_select_admin" 
  ON public.profiles 
  FOR SELECT 
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@blowmeai.com'
  );

-- Admin update policy using email check
CREATE POLICY "profiles_update_admin" 
  ON public.profiles 
  FOR UPDATE 
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@blowmeai.com'
  );

-- Grant permissions on profiles
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO authenticated;

-- ===========================================
-- FIX USER_VIDEOS TABLE RLS POLICIES
-- ===========================================

-- Drop all existing policies on user_videos to start fresh
DROP POLICY IF EXISTS "Users can view their own videos" ON public.user_videos;
DROP POLICY IF EXISTS "Users can view own videos or admin can view all" ON public.user_videos;
DROP POLICY IF EXISTS "Users can insert their own videos" ON public.user_videos;
DROP POLICY IF EXISTS "Users can insert own videos" ON public.user_videos;
DROP POLICY IF EXISTS "Users can update their own videos" ON public.user_videos;
DROP POLICY IF EXISTS "Users can update own videos or admin can update all" ON public.user_videos;
DROP POLICY IF EXISTS "Users can delete their own videos" ON public.user_videos;
DROP POLICY IF EXISTS "Users can delete own videos or admin can delete all" ON public.user_videos;
DROP POLICY IF EXISTS "Service role can insert videos" ON public.user_videos;
DROP POLICY IF EXISTS "user_videos_select_policy" ON public.user_videos;
DROP POLICY IF EXISTS "user_videos_insert_policy" ON public.user_videos;
DROP POLICY IF EXISTS "user_videos_update_policy" ON public.user_videos;
DROP POLICY IF EXISTS "user_videos_delete_policy" ON public.user_videos;
DROP POLICY IF EXISTS "service_role_all_access" ON public.user_videos;

-- Ensure RLS is enabled
ALTER TABLE public.user_videos ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view their own videos, Admin can view ALL videos
CREATE POLICY "user_videos_select_policy" 
  ON public.user_videos 
  FOR SELECT 
  USING (
    auth.uid() = user_id 
    OR (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@blowmeai.com'
  );

-- INSERT: Users can insert their own videos (check user_id matches auth.uid)
CREATE POLICY "user_videos_insert_policy" 
  ON public.user_videos 
  FOR INSERT 
  WITH CHECK (
    auth.uid() = user_id
    OR (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@blowmeai.com'
  );

-- UPDATE: Users can update their own videos, Admin can update any
CREATE POLICY "user_videos_update_policy" 
  ON public.user_videos 
  FOR UPDATE 
  USING (
    auth.uid() = user_id 
    OR (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@blowmeai.com'
  );

-- DELETE: Users can delete their own videos, Admin can delete any
CREATE POLICY "user_videos_delete_policy" 
  ON public.user_videos 
  FOR DELETE 
  USING (
    auth.uid() = user_id 
    OR (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@blowmeai.com'
  );

-- Service role policy for background jobs (RSS sync, etc.)
CREATE POLICY "user_videos_service_role" 
  ON public.user_videos 
  FOR ALL 
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_videos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_videos TO service_role;
