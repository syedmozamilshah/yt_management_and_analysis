-- REPAIR: Complete the partially applied migration 20260121140000
-- This fixes policies that failed during initial migration run

-- 1. Fix tracked_videos policies
DROP POLICY IF EXISTS "tracked_videos_select" ON public.tracked_videos;
DROP POLICY IF EXISTS "tracked_videos_insert" ON public.tracked_videos;
DROP POLICY IF EXISTS "tracked_videos_update" ON public.tracked_videos;
DROP POLICY IF EXISTS "tracked_videos_delete" ON public.tracked_videos;

ALTER TABLE public.tracked_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tracked_videos_select" ON public.tracked_videos FOR SELECT USING (true);
CREATE POLICY "tracked_videos_insert" ON public.tracked_videos FOR INSERT WITH CHECK (true);
CREATE POLICY "tracked_videos_update" ON public.tracked_videos FOR UPDATE USING (true);
CREATE POLICY "tracked_videos_delete" ON public.tracked_videos FOR DELETE USING (public.is_admin());

-- 2. Fix user_activity policies
DROP POLICY IF EXISTS "user_activity_select" ON public.user_activity;
DROP POLICY IF EXISTS "user_activity_upsert" ON public.user_activity;
DROP POLICY IF EXISTS "user_activity_all" ON public.user_activity;
DROP POLICY IF EXISTS "Users can view their own activity" ON public.user_activity;
DROP POLICY IF EXISTS "Users can upsert their own activity" ON public.user_activity;

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_activity') THEN
    ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "user_activity_all" ON public.user_activity FOR ALL 
      USING (auth.uid() = user_id OR public.is_admin())
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 3. Fix competitor_analyses policies
DROP POLICY IF EXISTS "competitor_analyses_select" ON public.competitor_analyses;
DROP POLICY IF EXISTS "competitor_analyses_insert" ON public.competitor_analyses;
DROP POLICY IF EXISTS "competitor_analyses_update" ON public.competitor_analyses;
DROP POLICY IF EXISTS "competitor_analyses_delete" ON public.competitor_analyses;
DROP POLICY IF EXISTS "Users can view their own competitor analyses" ON public.competitor_analyses;
DROP POLICY IF EXISTS "Users can insert their own competitor analyses" ON public.competitor_analyses;
DROP POLICY IF EXISTS "Users can update their own competitor analyses" ON public.competitor_analyses;
DROP POLICY IF EXISTS "Users can delete their own competitor analyses" ON public.competitor_analyses;

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'competitor_analyses') THEN
    ALTER TABLE public.competitor_analyses ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "competitor_analyses_select" ON public.competitor_analyses FOR SELECT 
      USING (auth.uid() = user_id OR public.is_admin());
    CREATE POLICY "competitor_analyses_insert" ON public.competitor_analyses FOR INSERT 
      WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "competitor_analyses_update" ON public.competitor_analyses FOR UPDATE 
      USING (auth.uid() = user_id);
    CREATE POLICY "competitor_analyses_delete" ON public.competitor_analyses FOR DELETE 
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 4. Fix ai_usage_logs policies
DROP POLICY IF EXISTS "ai_usage_logs_select" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "ai_usage_logs_insert" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "ai_usage_logs_all" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "Users can view their own AI usage" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "Users can insert their own AI usage" ON public.ai_usage_logs;

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_usage_logs') THEN
    ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "ai_usage_logs_select" ON public.ai_usage_logs FOR SELECT 
      USING (auth.uid() = user_id OR public.is_admin());
    CREATE POLICY "ai_usage_logs_insert" ON public.ai_usage_logs FOR INSERT 
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 5. Fix user_activity_logs policies
DROP POLICY IF EXISTS "user_activity_logs_select" ON public.user_activity_logs;
DROP POLICY IF EXISTS "user_activity_logs_insert" ON public.user_activity_logs;
DROP POLICY IF EXISTS "user_activity_logs_all" ON public.user_activity_logs;
DROP POLICY IF EXISTS "Users can view their own activity logs" ON public.user_activity_logs;
DROP POLICY IF EXISTS "Users can insert their own activity logs" ON public.user_activity_logs;

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_activity_logs') THEN
    ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "user_activity_logs_select" ON public.user_activity_logs FOR SELECT 
      USING (auth.uid() = user_id OR public.is_admin());
    CREATE POLICY "user_activity_logs_insert" ON public.user_activity_logs FOR INSERT 
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 6. Fix user_competitor_channels policies
DROP POLICY IF EXISTS "user_competitor_channels_select" ON public.user_competitor_channels;
DROP POLICY IF EXISTS "user_competitor_channels_insert" ON public.user_competitor_channels;
DROP POLICY IF EXISTS "user_competitor_channels_update" ON public.user_competitor_channels;
DROP POLICY IF EXISTS "user_competitor_channels_delete" ON public.user_competitor_channels;
DROP POLICY IF EXISTS "Users can view their competitor channels" ON public.user_competitor_channels;
DROP POLICY IF EXISTS "Users can insert their competitor channels" ON public.user_competitor_channels;
DROP POLICY IF EXISTS "Users can update their competitor channels" ON public.user_competitor_channels;
DROP POLICY IF EXISTS "Users can delete their competitor channels" ON public.user_competitor_channels;

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_competitor_channels') THEN
    ALTER TABLE public.user_competitor_channels ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "user_competitor_channels_select" ON public.user_competitor_channels FOR SELECT 
      USING (auth.uid() = user_id OR public.is_admin());
    CREATE POLICY "user_competitor_channels_insert" ON public.user_competitor_channels FOR INSERT 
      WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "user_competitor_channels_update" ON public.user_competitor_channels FOR UPDATE 
      USING (auth.uid() = user_id);
    CREATE POLICY "user_competitor_channels_delete" ON public.user_competitor_channels FOR DELETE 
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 7. Mark migration 20260121140000 as complete 
INSERT INTO supabase_migrations.schema_migrations(version) VALUES('20260121140000') ON CONFLICT DO NOTHING;
