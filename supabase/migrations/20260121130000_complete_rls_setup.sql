-- ============================================
-- COMPLETE RLS SETUP FOR VIDEO STASH APP
-- Run this in Supabase SQL Editor
-- ============================================

-- ===========================================
-- 1. PROFILES TABLE
-- ===========================================

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;

-- Users can view their own profile
CREATE POLICY "profiles_select_own" 
  ON public.profiles 
  FOR SELECT 
  USING (auth.uid() = id);

-- Admin can view all profiles (using email check to avoid circular reference)
CREATE POLICY "profiles_select_admin" 
  ON public.profiles 
  FOR SELECT 
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@blowmeai.com'
  );

-- Admin can update all profiles
CREATE POLICY "profiles_update_admin" 
  ON public.profiles 
  FOR UPDATE 
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@blowmeai.com'
  );

-- Allow insert for new users (triggered by auth)
CREATE POLICY "profiles_insert" 
  ON public.profiles 
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- ===========================================
-- 2. USER_VIDEOS TABLE
-- ===========================================

-- Enable RLS
ALTER TABLE public.user_videos ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
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
DROP POLICY IF EXISTS "user_videos_service_role" ON public.user_videos;

-- SELECT: Users can view their own videos, Admin can view ALL videos
CREATE POLICY "user_videos_select" 
  ON public.user_videos 
  FOR SELECT 
  USING (
    auth.uid() = user_id 
    OR (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@blowmeai.com'
  );

-- INSERT: Users can insert their own videos
CREATE POLICY "user_videos_insert" 
  ON public.user_videos 
  FOR INSERT 
  WITH CHECK (
    auth.uid() = user_id
    OR (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@blowmeai.com'
  );

-- UPDATE: Users can update their own videos, Admin can update any
CREATE POLICY "user_videos_update" 
  ON public.user_videos 
  FOR UPDATE 
  USING (
    auth.uid() = user_id 
    OR (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@blowmeai.com'
  );

-- DELETE: Users can delete their own videos, Admin can delete any
CREATE POLICY "user_videos_delete" 
  ON public.user_videos 
  FOR DELETE 
  USING (
    auth.uid() = user_id 
    OR (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@blowmeai.com'
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_videos TO authenticated;
GRANT ALL ON public.user_videos TO service_role;

-- ===========================================
-- 3. USER_NICHES TABLE
-- ===========================================

-- Enable RLS
ALTER TABLE public.user_niches ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own niches" ON public.user_niches;
DROP POLICY IF EXISTS "Users can insert their own niches" ON public.user_niches;
DROP POLICY IF EXISTS "Users can update their own niches" ON public.user_niches;
DROP POLICY IF EXISTS "Users can delete their own niches" ON public.user_niches;

-- Users can view their own niches
CREATE POLICY "user_niches_select" 
  ON public.user_niches 
  FOR SELECT 
  USING (
    auth.uid() = user_id 
    OR (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@blowmeai.com'
  );

-- Users can insert their own niches
CREATE POLICY "user_niches_insert" 
  ON public.user_niches 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own niches
CREATE POLICY "user_niches_update" 
  ON public.user_niches 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Users can delete their own niches
CREATE POLICY "user_niches_delete" 
  ON public.user_niches 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_niches TO authenticated;
GRANT ALL ON public.user_niches TO service_role;

-- ===========================================
-- 4. TRACKED_CHANNELS TABLE
-- ===========================================

-- Enable RLS
ALTER TABLE public.tracked_channels ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "tracked_channels_select" ON public.tracked_channels;
DROP POLICY IF EXISTS "tracked_channels_insert" ON public.tracked_channels;
DROP POLICY IF EXISTS "tracked_channels_update" ON public.tracked_channels;
DROP POLICY IF EXISTS "tracked_channels_delete" ON public.tracked_channels;
DROP POLICY IF EXISTS "Users can view their tracked channels" ON public.tracked_channels;
DROP POLICY IF EXISTS "Users can insert their tracked channels" ON public.tracked_channels;
DROP POLICY IF EXISTS "Users can update their tracked channels" ON public.tracked_channels;
DROP POLICY IF EXISTS "Users can delete their tracked channels" ON public.tracked_channels;

-- Users can view their own tracked channels, admin can view all
CREATE POLICY "tracked_channels_select" 
  ON public.tracked_channels 
  FOR SELECT 
  USING (
    auth.uid() = user_id 
    OR (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@blowmeai.com'
  );

-- Users can insert their own tracked channels
CREATE POLICY "tracked_channels_insert" 
  ON public.tracked_channels 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own tracked channels
CREATE POLICY "tracked_channels_update" 
  ON public.tracked_channels 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Users can delete their own tracked channels
CREATE POLICY "tracked_channels_delete" 
  ON public.tracked_channels 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracked_channels TO authenticated;
GRANT ALL ON public.tracked_channels TO service_role;

-- ===========================================
-- 5. TRACKED_VIDEOS TABLE
-- ===========================================

-- Enable RLS if table exists
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tracked_videos') THEN
    ALTER TABLE public.tracked_videos ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies
    DROP POLICY IF EXISTS "tracked_videos_select" ON public.tracked_videos;
    DROP POLICY IF EXISTS "tracked_videos_insert" ON public.tracked_videos;
    
    -- Anyone can view tracked videos (public data)
    CREATE POLICY "tracked_videos_select" 
      ON public.tracked_videos 
      FOR SELECT 
      USING (true);
    
    -- Service role can insert
    CREATE POLICY "tracked_videos_insert" 
      ON public.tracked_videos 
      FOR INSERT 
      WITH CHECK (true);
    
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracked_videos TO authenticated;
    GRANT ALL ON public.tracked_videos TO service_role;
  END IF;
END $$;

-- ===========================================
-- 6. USER_ACTIVITY TABLE
-- ===========================================

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_activity') THEN
    ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "user_activity_select" ON public.user_activity;
    DROP POLICY IF EXISTS "user_activity_upsert" ON public.user_activity;
    
    -- Users can view their own activity
    CREATE POLICY "user_activity_select" 
      ON public.user_activity 
      FOR SELECT 
      USING (
        auth.uid() = user_id 
        OR (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@blowmeai.com'
      );
    
    -- Users can upsert their own activity
    CREATE POLICY "user_activity_upsert" 
      ON public.user_activity 
      FOR ALL 
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    
    GRANT SELECT, INSERT, UPDATE ON public.user_activity TO authenticated;
    GRANT ALL ON public.user_activity TO service_role;
  END IF;
END $$;

-- ===========================================
-- 7. COMPETITOR_ANALYSES TABLE
-- ===========================================

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'competitor_analyses') THEN
    ALTER TABLE public.competitor_analyses ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "competitor_analyses_select" ON public.competitor_analyses;
    DROP POLICY IF EXISTS "competitor_analyses_insert" ON public.competitor_analyses;
    DROP POLICY IF EXISTS "competitor_analyses_delete" ON public.competitor_analyses;
    
    -- Users can view their own analyses
    CREATE POLICY "competitor_analyses_select" 
      ON public.competitor_analyses 
      FOR SELECT 
      USING (
        auth.uid() = user_id 
        OR (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@blowmeai.com'
      );
    
    -- Users can insert their own analyses
    CREATE POLICY "competitor_analyses_insert" 
      ON public.competitor_analyses 
      FOR INSERT 
      WITH CHECK (auth.uid() = user_id);
    
    -- Users can delete their own analyses
    CREATE POLICY "competitor_analyses_delete" 
      ON public.competitor_analyses 
      FOR DELETE 
      USING (auth.uid() = user_id);
    
    GRANT SELECT, INSERT, DELETE ON public.competitor_analyses TO authenticated;
    GRANT ALL ON public.competitor_analyses TO service_role;
  END IF;
END $$;

-- ===========================================
-- 8. ENSURE ADMIN USER EXISTS AND IS APPROVED
-- ===========================================

-- Update admin profile to be approved
UPDATE public.profiles 
SET user_status = 'approved', is_admin = true 
WHERE email = 'admin@blowmeai.com';

-- ===========================================
-- 9. CREATE HELPER FUNCTION FOR STATUS CHECK
-- ===========================================

-- Drop existing function
DROP FUNCTION IF EXISTS public.get_user_status(uuid);

-- Create function with SECURITY DEFINER (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_status(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT user_status INTO v_status
  FROM public.profiles
  WHERE id = p_user_id;
  
  RETURN COALESCE(v_status, 'approved');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute
GRANT EXECUTE ON FUNCTION public.get_user_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_status(uuid) TO anon;

-- ===========================================
-- DONE! All RLS policies are now configured.
-- ===========================================
