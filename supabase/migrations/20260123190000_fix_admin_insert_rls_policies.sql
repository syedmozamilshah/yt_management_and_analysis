-- Migration: Fix RLS policies for admin to insert records for all users
-- This allows admin to add channels/videos/subscriptions for all users when doing global adds

-- ===========================================
-- 1. FIX TRACKED_CHANNELS INSERT POLICY
-- ===========================================
DROP POLICY IF EXISTS "tracked_channels_insert" ON public.tracked_channels;

CREATE POLICY "tracked_channels_insert" 
  ON public.tracked_channels 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Also fix update and delete to allow admin
DROP POLICY IF EXISTS "tracked_channels_update" ON public.tracked_channels;
DROP POLICY IF EXISTS "tracked_channels_delete" ON public.tracked_channels;

CREATE POLICY "tracked_channels_update" 
  ON public.tracked_channels 
  FOR UPDATE 
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "tracked_channels_delete" 
  ON public.tracked_channels 
  FOR DELETE 
  USING (auth.uid() = user_id OR public.is_admin());

-- ===========================================
-- 2. FIX USER_CHANNEL_SUBSCRIPTIONS POLICIES
-- ===========================================
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.user_channel_subscriptions;
DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON public.user_channel_subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscriptions" ON public.user_channel_subscriptions;
DROP POLICY IF EXISTS "Users can delete their own subscriptions" ON public.user_channel_subscriptions;
DROP POLICY IF EXISTS "user_channel_subscriptions_select" ON public.user_channel_subscriptions;
DROP POLICY IF EXISTS "user_channel_subscriptions_insert" ON public.user_channel_subscriptions;
DROP POLICY IF EXISTS "user_channel_subscriptions_update" ON public.user_channel_subscriptions;
DROP POLICY IF EXISTS "user_channel_subscriptions_delete" ON public.user_channel_subscriptions;

CREATE POLICY "user_channel_subscriptions_select" 
  ON public.user_channel_subscriptions 
  FOR SELECT 
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "user_channel_subscriptions_insert" 
  ON public.user_channel_subscriptions 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "user_channel_subscriptions_update" 
  ON public.user_channel_subscriptions 
  FOR UPDATE 
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "user_channel_subscriptions_delete" 
  ON public.user_channel_subscriptions 
  FOR DELETE 
  USING (auth.uid() = user_id OR public.is_admin());

-- ===========================================
-- 3. FIX USER_NICHES POLICIES (ensure admin can insert)
-- ===========================================
DROP POLICY IF EXISTS "user_niches_insert" ON public.user_niches;

CREATE POLICY "user_niches_insert" 
  ON public.user_niches 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'RLS policies updated to allow admin to insert for all users';
END $$;
