-- Migration to allow admin to view all user data
-- Admin email: admin@videostash.com

-- First, let's create a function to check if the current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT email = 'admin@videostash.com' 
    FROM auth.users 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop ALL existing policies on user_videos (both old and new names)
DROP POLICY IF EXISTS "Users can view own videos" ON public.user_videos;
DROP POLICY IF EXISTS "Users can insert own videos" ON public.user_videos;
DROP POLICY IF EXISTS "Users can update own videos" ON public.user_videos;
DROP POLICY IF EXISTS "Users can delete own videos" ON public.user_videos;
DROP POLICY IF EXISTS "Users can view own videos or admin can view all" ON public.user_videos;
DROP POLICY IF EXISTS "Users can update own videos or admin can update all" ON public.user_videos;
DROP POLICY IF EXISTS "Users can delete own videos or admin can delete all" ON public.user_videos;

-- Create new policies that allow admin to see all data

-- SELECT: Users can view their own videos, Admin can view ALL videos
CREATE POLICY "Users can view own videos or admin can view all" 
  ON public.user_videos 
  FOR SELECT 
  USING (
    auth.uid() = user_id 
    OR public.is_admin() = true
  );

-- INSERT: Users can only insert their own videos
CREATE POLICY "Users can insert own videos" 
  ON public.user_videos 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can update their own videos, Admin can update any
CREATE POLICY "Users can update own videos or admin can update all" 
  ON public.user_videos 
  FOR UPDATE 
  USING (
    auth.uid() = user_id 
    OR public.is_admin() = true
  );

-- DELETE: Users can delete their own videos, Admin can delete any
CREATE POLICY "Users can delete own videos or admin can delete all" 
  ON public.user_videos 
  FOR DELETE 
  USING (
    auth.uid() = user_id 
    OR public.is_admin() = true
  );

-- Drop ALL existing policies on user_niches
DROP POLICY IF EXISTS "Users can view own niches" ON public.user_niches;
DROP POLICY IF EXISTS "Users can insert own niches" ON public.user_niches;
DROP POLICY IF EXISTS "Users can update own niches" ON public.user_niches;
DROP POLICY IF EXISTS "Users can delete own niches" ON public.user_niches;
DROP POLICY IF EXISTS "Users can view own niches or admin can view all" ON public.user_niches;
DROP POLICY IF EXISTS "Users can update own niches or admin can update all" ON public.user_niches;
DROP POLICY IF EXISTS "Users can delete own niches or admin can delete all" ON public.user_niches;

CREATE POLICY "Users can view own niches or admin can view all" 
  ON public.user_niches 
  FOR SELECT 
  USING (
    auth.uid() = user_id 
    OR public.is_admin() = true
  );

CREATE POLICY "Users can insert own niches" 
  ON public.user_niches 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own niches or admin can update all" 
  ON public.user_niches 
  FOR UPDATE 
  USING (
    auth.uid() = user_id 
    OR public.is_admin() = true
  );

CREATE POLICY "Users can delete own niches or admin can delete all" 
  ON public.user_niches 
  FOR DELETE 
  USING (
    auth.uid() = user_id 
    OR public.is_admin() = true
  );

-- Drop ALL existing policies on user_competitor_channels
DROP POLICY IF EXISTS "Users can view own competitor channels" ON public.user_competitor_channels;
DROP POLICY IF EXISTS "Users can insert own competitor channels" ON public.user_competitor_channels;
DROP POLICY IF EXISTS "Users can update own competitor channels" ON public.user_competitor_channels;
DROP POLICY IF EXISTS "Users can delete own competitor channels" ON public.user_competitor_channels;
DROP POLICY IF EXISTS "Users can view own competitor channels or admin can view all" ON public.user_competitor_channels;
DROP POLICY IF EXISTS "Users can update own competitor channels or admin can update all" ON public.user_competitor_channels;
DROP POLICY IF EXISTS "Users can delete own competitor channels or admin can delete all" ON public.user_competitor_channels;

CREATE POLICY "Users can view own competitor channels or admin can view all" 
  ON public.user_competitor_channels 
  FOR SELECT 
  USING (
    auth.uid() = user_id 
    OR public.is_admin() = true
  );

CREATE POLICY "Users can insert own competitor channels" 
  ON public.user_competitor_channels 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own competitor channels or admin can update all" 
  ON public.user_competitor_channels 
  FOR UPDATE 
  USING (
    auth.uid() = user_id 
    OR public.is_admin() = true
  );

CREATE POLICY "Users can delete own competitor channels or admin can delete all" 
  ON public.user_competitor_channels 
  FOR DELETE 
  USING (
    auth.uid() = user_id 
    OR public.is_admin() = true
  );
