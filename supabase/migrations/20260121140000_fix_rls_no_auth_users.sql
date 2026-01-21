-- ============================================
-- FIX RLS POLICIES - Remove auth.users subqueries
-- The auth.users table is not accessible to regular users
-- Use auth.jwt() instead to get user info
-- ============================================

-- ===========================================
-- 1. CREATE HELPER FUNCTION FOR ADMIN CHECK
-- ===========================================

-- Drop existing function with CASCADE to remove dependent policies
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin(uuid) CASCADE;

-- Create admin check function using JWT (doesn't require auth.users access)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Get email from JWT token claims
  RETURN COALESCE(
    (auth.jwt() ->> 'email') = 'admin@blowmeai.com',
    false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute to all
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;

-- ===========================================
-- 2. FIX PROFILES TABLE RLS
-- ===========================================

-- Drop all existing policies
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update all profiles" ON public.profiles;

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "profiles_select_own" 
  ON public.profiles 
  FOR SELECT 
  USING (auth.uid() = id);

-- Admin can view all profiles (using function instead of subquery)
CREATE POLICY "profiles_select_admin" 
  ON public.profiles 
  FOR SELECT 
  USING (public.is_admin());

-- Admin can update all profiles
CREATE POLICY "profiles_update_admin" 
  ON public.profiles 
  FOR UPDATE 
  USING (public.is_admin());

-- Allow insert for new users (handled by trigger on auth.users)
CREATE POLICY "profiles_insert" 
  ON public.profiles 
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- ===========================================
-- 3. FIX USER_VIDEOS TABLE RLS
-- ===========================================

-- Drop all existing policies
DROP POLICY IF EXISTS "user_videos_select" ON public.user_videos;
DROP POLICY IF EXISTS "user_videos_insert" ON public.user_videos;
DROP POLICY IF EXISTS "user_videos_update" ON public.user_videos;
DROP POLICY IF EXISTS "user_videos_delete" ON public.user_videos;
DROP POLICY IF EXISTS "user_videos_select_policy" ON public.user_videos;
DROP POLICY IF EXISTS "user_videos_insert_policy" ON public.user_videos;
DROP POLICY IF EXISTS "user_videos_update_policy" ON public.user_videos;
DROP POLICY IF EXISTS "user_videos_delete_policy" ON public.user_videos;
DROP POLICY IF EXISTS "user_videos_service_role" ON public.user_videos;
DROP POLICY IF EXISTS "Users can view their own videos" ON public.user_videos;
DROP POLICY IF EXISTS "Users can view own videos or admin can view all" ON public.user_videos;
DROP POLICY IF EXISTS "Users can insert their own videos" ON public.user_videos;
DROP POLICY IF EXISTS "Users can update their own videos" ON public.user_videos;
DROP POLICY IF EXISTS "Users can delete their own videos" ON public.user_videos;

-- Enable RLS
ALTER TABLE public.user_videos ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view their own videos, Admin can view ALL videos
CREATE POLICY "user_videos_select" 
  ON public.user_videos 
  FOR SELECT 
  USING (auth.uid() = user_id OR public.is_admin());

-- INSERT: Users can insert their own videos
CREATE POLICY "user_videos_insert" 
  ON public.user_videos 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- UPDATE: Users can update their own videos
CREATE POLICY "user_videos_update" 
  ON public.user_videos 
  FOR UPDATE 
  USING (auth.uid() = user_id OR public.is_admin());

-- DELETE: Users can delete their own videos
CREATE POLICY "user_videos_delete" 
  ON public.user_videos 
  FOR DELETE 
  USING (auth.uid() = user_id OR public.is_admin());

-- ===========================================
-- 4. FIX USER_NICHES TABLE RLS
-- ===========================================

DROP POLICY IF EXISTS "user_niches_select" ON public.user_niches;
DROP POLICY IF EXISTS "user_niches_insert" ON public.user_niches;
DROP POLICY IF EXISTS "user_niches_update" ON public.user_niches;
DROP POLICY IF EXISTS "user_niches_delete" ON public.user_niches;
DROP POLICY IF EXISTS "Users can view their own niches" ON public.user_niches;
DROP POLICY IF EXISTS "Users can insert their own niches" ON public.user_niches;
DROP POLICY IF EXISTS "Users can update their own niches" ON public.user_niches;
DROP POLICY IF EXISTS "Users can delete their own niches" ON public.user_niches;

ALTER TABLE public.user_niches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_niches_select" 
  ON public.user_niches 
  FOR SELECT 
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "user_niches_insert" 
  ON public.user_niches 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_niches_update" 
  ON public.user_niches 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "user_niches_delete" 
  ON public.user_niches 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- ===========================================
-- 5. FIX TRACKED_CHANNELS TABLE RLS
-- ===========================================

DROP POLICY IF EXISTS "tracked_channels_select" ON public.tracked_channels;
DROP POLICY IF EXISTS "tracked_channels_insert" ON public.tracked_channels;
DROP POLICY IF EXISTS "tracked_channels_update" ON public.tracked_channels;
DROP POLICY IF EXISTS "tracked_channels_delete" ON public.tracked_channels;
DROP POLICY IF EXISTS "Users can view their tracked channels" ON public.tracked_channels;
DROP POLICY IF EXISTS "Users can insert their tracked channels" ON public.tracked_channels;
DROP POLICY IF EXISTS "Users can update their tracked channels" ON public.tracked_channels;
DROP POLICY IF EXISTS "Users can delete their tracked channels" ON public.tracked_channels;

ALTER TABLE public.tracked_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tracked_channels_select" 
  ON public.tracked_channels 
  FOR SELECT 
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "tracked_channels_insert" 
  ON public.tracked_channels 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tracked_channels_update" 
  ON public.tracked_channels 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "tracked_channels_delete" 
  ON public.tracked_channels 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- ===========================================
-- 6. FIX OTHER TABLES
-- ===========================================

-- tracked_videos - if exists
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tracked_videos') THEN
    DROP POLICY IF EXISTS "tracked_videos_select" ON public.tracked_videos;
    DROP POLICY IF EXISTS "tracked_videos_insert" ON public.tracked_videos;
    DROP POLICY IF EXISTS "tracked_videos_update" ON public.tracked_videos;
    DROP POLICY IF EXISTS "tracked_videos_delete" ON public.tracked_videos;
    
    ALTER TABLE public.tracked_videos ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "tracked_videos_select" ON public.tracked_videos FOR SELECT USING (true);
    CREATE POLICY "tracked_videos_insert" ON public.tracked_videos FOR INSERT WITH CHECK (true);
    CREATE POLICY "tracked_videos_update" ON public.tracked_videos FOR UPDATE USING (true);
    CREATE POLICY "tracked_videos_delete" ON public.tracked_videos FOR DELETE USING (public.is_admin());
  END IF;
END $$;

-- user_activity - if exists
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_activity') THEN
    DROP POLICY IF EXISTS "user_activity_select" ON public.user_activity;
    DROP POLICY IF EXISTS "user_activity_upsert" ON public.user_activity;
    DROP POLICY IF EXISTS "user_activity_all" ON public.user_activity;
    
    ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "user_activity_all" ON public.user_activity FOR ALL 
      USING (auth.uid() = user_id OR public.is_admin())
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- competitor_analyses - if exists  
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'competitor_analyses') THEN
    DROP POLICY IF EXISTS "competitor_analyses_select" ON public.competitor_analyses;
    DROP POLICY IF EXISTS "competitor_analyses_insert" ON public.competitor_analyses;
    DROP POLICY IF EXISTS "competitor_analyses_delete" ON public.competitor_analyses;
    DROP POLICY IF EXISTS "competitor_analyses_all" ON public.competitor_analyses;
    
    ALTER TABLE public.competitor_analyses ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "competitor_analyses_all" ON public.competitor_analyses FOR ALL
      USING (auth.uid() = user_id OR public.is_admin())
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ===========================================
-- 7. UPDATE GET_USER_STATUS FUNCTION
-- ===========================================

DROP FUNCTION IF EXISTS public.get_user_status(uuid);

CREATE OR REPLACE FUNCTION public.get_user_status(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT user_status INTO v_status
  FROM public.profiles
  WHERE id = p_user_id;
  
  -- Default to approved if no profile or null status
  RETURN COALESCE(v_status, 'approved');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_user_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_status(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_status(uuid) TO service_role;

-- ===========================================
-- 8. GRANT TABLE PERMISSIONS
-- ===========================================

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_videos TO authenticated;
GRANT ALL ON public.user_videos TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_niches TO authenticated;
GRANT ALL ON public.user_niches TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracked_channels TO authenticated;
GRANT ALL ON public.tracked_channels TO service_role;

-- ===========================================
-- 9. FIX ADDITIONAL TABLES THAT LOST POLICIES
-- (from CASCADE drop of is_admin function)
-- ===========================================

-- ai_usage_logs
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_usage_logs') THEN
    ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "ai_usage_logs_select" ON public.ai_usage_logs;
    DROP POLICY IF EXISTS "ai_usage_logs_insert" ON public.ai_usage_logs;
    
    CREATE POLICY "ai_usage_logs_select" ON public.ai_usage_logs FOR SELECT 
      USING (auth.uid() = user_id OR public.is_admin());
    CREATE POLICY "ai_usage_logs_insert" ON public.ai_usage_logs FOR INSERT 
      WITH CHECK (auth.uid() = user_id);
    
    GRANT SELECT, INSERT ON public.ai_usage_logs TO authenticated;
    GRANT ALL ON public.ai_usage_logs TO service_role;
  END IF;
END $$;

-- user_activity_logs
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_activity_logs') THEN
    ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "user_activity_logs_select" ON public.user_activity_logs;
    DROP POLICY IF EXISTS "user_activity_logs_insert" ON public.user_activity_logs;
    
    CREATE POLICY "user_activity_logs_select" ON public.user_activity_logs FOR SELECT 
      USING (auth.uid() = user_id OR public.is_admin());
    CREATE POLICY "user_activity_logs_insert" ON public.user_activity_logs FOR INSERT 
      WITH CHECK (auth.uid() = user_id);
    
    GRANT SELECT, INSERT ON public.user_activity_logs TO authenticated;
    GRANT ALL ON public.user_activity_logs TO service_role;
  END IF;
END $$;

-- user_competitor_channels
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_competitor_channels') THEN
    ALTER TABLE public.user_competitor_channels ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "user_competitor_channels_all" ON public.user_competitor_channels;
    
    CREATE POLICY "user_competitor_channels_all" ON public.user_competitor_channels FOR ALL 
      USING (auth.uid() = user_id OR public.is_admin())
      WITH CHECK (auth.uid() = user_id);
    
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_competitor_channels TO authenticated;
    GRANT ALL ON public.user_competitor_channels TO service_role;
  END IF;
END $$;

-- ===========================================
-- DONE
-- ===========================================
