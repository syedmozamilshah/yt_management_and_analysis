-- ============================================
-- Fix RLS Policy for user_videos
-- The is_admin() function was causing issues
-- Use direct email check instead
-- ============================================

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view own videos or admin can view all" ON public.user_videos;
DROP POLICY IF EXISTS "Users can update own videos or admin can update all" ON public.user_videos;
DROP POLICY IF EXISTS "Users can delete own videos or admin can delete all" ON public.user_videos;

-- Recreate with simpler, working policies
-- SELECT: Users can view their own videos, Admin can view ALL videos
CREATE POLICY "Users can view own videos or admin can view all" 
  ON public.user_videos 
  FOR SELECT 
  USING (
    auth.uid() = user_id 
    OR (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@blowmeai.com'
  );

-- UPDATE: Users can update their own videos, Admin can update any
CREATE POLICY "Users can update own videos or admin can update all" 
  ON public.user_videos 
  FOR UPDATE 
  USING (
    auth.uid() = user_id 
    OR (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@blowmeai.com'
  );

-- DELETE: Users can delete their own videos, Admin can delete any
CREATE POLICY "Users can delete own videos or admin can delete all" 
  ON public.user_videos 
  FOR DELETE 
  USING (
    auth.uid() = user_id 
    OR (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@blowmeai.com'
  );

-- Ensure RLS is enabled
ALTER TABLE public.user_videos ENABLE ROW LEVEL SECURITY;
