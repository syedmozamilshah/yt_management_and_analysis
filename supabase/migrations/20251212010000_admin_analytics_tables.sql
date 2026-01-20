-- Migration for Admin Analytics & Usage Tracking
-- Created: December 12, 2025

-- Create table to track AI tool usage (title generation, etc.)
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_type TEXT NOT NULL, -- 'title_generation', 'script_analysis', 'channel_analysis'
  request_data JSONB, -- Optional: store request parameters
  response_data JSONB, -- Optional: store response summary
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id ON public.ai_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_tool_type ON public.ai_usage_logs(tool_type);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON public.ai_usage_logs(created_at);

-- Enable RLS on ai_usage_logs
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can insert their own usage logs
CREATE POLICY "Users can insert own usage logs" 
  ON public.ai_usage_logs 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own usage logs
CREATE POLICY "Users can view own usage logs" 
  ON public.ai_usage_logs 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Admin can view all usage logs
CREATE POLICY "Admin can view all usage logs" 
  ON public.ai_usage_logs 
  FOR SELECT 
  USING (public.is_admin() = true);

-- Create table to track user sessions/activity
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- 'login', 'page_view', 'video_added', 'video_favorited'
  activity_data JSONB, -- Optional: additional activity details
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for user activity
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON public.user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_activity_type ON public.user_activity_logs(activity_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created_at ON public.user_activity_logs(created_at);

-- Enable RLS on user_activity_logs
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

-- Users can insert their own activity logs
CREATE POLICY "Users can insert own activity logs" 
  ON public.user_activity_logs 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own activity logs
CREATE POLICY "Users can view own activity logs" 
  ON public.user_activity_logs 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Admin can view all activity logs
CREATE POLICY "Admin can view all activity logs" 
  ON public.user_activity_logs 
  FOR SELECT 
  USING (public.is_admin() = true);

-- Create a view for admin to get user statistics
CREATE OR REPLACE VIEW public.admin_user_stats AS
SELECT 
  COUNT(DISTINCT id) as total_users,
  COUNT(DISTINCT CASE WHEN last_sign_in_at > NOW() - INTERVAL '7 days' THEN id END) as active_users_7d,
  COUNT(DISTINCT CASE WHEN last_sign_in_at > NOW() - INTERVAL '30 days' THEN id END) as active_users_30d,
  COUNT(DISTINCT CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN id END) as new_users_7d,
  COUNT(DISTINCT CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN id END) as new_users_30d
FROM auth.users;

-- Grant select on the view to authenticated users (RLS will handle access)
GRANT SELECT ON public.admin_user_stats TO authenticated;

-- Create function to get AI usage statistics (for admin)
CREATE OR REPLACE FUNCTION public.get_ai_usage_stats()
RETURNS TABLE (
  tool_type TEXT,
  total_uses BIGINT,
  uses_today BIGINT,
  uses_this_week BIGINT,
  uses_this_month BIGINT,
  unique_users BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    aul.tool_type,
    COUNT(*) as total_uses,
    COUNT(*) FILTER (WHERE aul.created_at > NOW() - INTERVAL '1 day') as uses_today,
    COUNT(*) FILTER (WHERE aul.created_at > NOW() - INTERVAL '7 days') as uses_this_week,
    COUNT(*) FILTER (WHERE aul.created_at > NOW() - INTERVAL '30 days') as uses_this_month,
    COUNT(DISTINCT aul.user_id) as unique_users
  FROM public.ai_usage_logs aul
  GROUP BY aul.tool_type
  ORDER BY total_uses DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user count
CREATE OR REPLACE FUNCTION public.get_user_count()
RETURNS TABLE (
  total_users BIGINT,
  active_users_7d BIGINT,
  active_users_30d BIGINT,
  new_users_7d BIGINT,
  new_users_30d BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_users,
    COUNT(*) FILTER (WHERE last_sign_in_at > NOW() - INTERVAL '7 days')::BIGINT as active_users_7d,
    COUNT(*) FILTER (WHERE last_sign_in_at > NOW() - INTERVAL '30 days')::BIGINT as active_users_30d,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::BIGINT as new_users_7d,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::BIGINT as new_users_30d
  FROM auth.users
  WHERE email != 'admin@videostash.com'; -- Exclude admin from counts
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
