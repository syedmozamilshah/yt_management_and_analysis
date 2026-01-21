-- Enable Realtime for user_videos table
-- This allows users to receive real-time updates when admin adds videos for all users

-- Enable realtime for user_videos
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_videos;
