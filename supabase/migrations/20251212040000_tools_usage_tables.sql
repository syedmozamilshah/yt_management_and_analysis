-- Migration: Create tables for tools usage tracking
-- This tracks monthly usage limits per user for the script generator and SEO tools

-- Table to store monthly usage for each user
CREATE TABLE IF NOT EXISTS user_tool_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL, -- Format: YYYY-MM (e.g., "2025-12")
  word_usage INTEGER DEFAULT 0,
  max_words INTEGER DEFAULT 40000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, month)
);

-- Table to store script generation history
CREATE TABLE IF NOT EXISTS user_scripts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_article TEXT,
  outline TEXT,
  result TEXT NOT NULL,
  word_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table to store SEO generation history
CREATE TABLE IF NOT EXISTS user_seo_descriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  script TEXT NOT NULL,
  titles JSONB NOT NULL DEFAULT '[]'::jsonb,
  description TEXT NOT NULL,
  tags TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE user_tool_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_seo_descriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_tool_usage
CREATE POLICY "Users can view their own usage" 
  ON user_tool_usage FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own usage" 
  ON user_tool_usage FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own usage" 
  ON user_tool_usage FOR UPDATE 
  USING (auth.uid() = user_id);

-- Admin policies for user_tool_usage
CREATE POLICY "Admins can view all usage" 
  ON user_tool_usage FOR SELECT 
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- RLS Policies for user_scripts
CREATE POLICY "Users can view their own scripts" 
  ON user_scripts FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scripts" 
  ON user_scripts FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scripts" 
  ON user_scripts FOR DELETE 
  USING (auth.uid() = user_id);

-- Admin policies for user_scripts
CREATE POLICY "Admins can view all scripts" 
  ON user_scripts FOR SELECT 
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- RLS Policies for user_seo_descriptions
CREATE POLICY "Users can view their own SEO descriptions" 
  ON user_seo_descriptions FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own SEO descriptions" 
  ON user_seo_descriptions FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own SEO descriptions" 
  ON user_seo_descriptions FOR DELETE 
  USING (auth.uid() = user_id);

-- Admin policies for user_seo_descriptions
CREATE POLICY "Admins can view all SEO descriptions" 
  ON user_seo_descriptions FOR SELECT 
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_tool_usage_user_month ON user_tool_usage(user_id, month);
CREATE INDEX IF NOT EXISTS idx_user_scripts_user_id ON user_scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_seo_descriptions_user_id ON user_seo_descriptions(user_id);

-- Function to get or create usage for current month
CREATE OR REPLACE FUNCTION get_or_create_monthly_usage(p_user_id UUID)
RETURNS TABLE(word_usage INTEGER, max_words INTEGER, month VARCHAR) AS $$
DECLARE
  current_month VARCHAR(7);
BEGIN
  current_month := TO_CHAR(NOW(), 'YYYY-MM');
  
  -- Try to insert, if exists do nothing
  INSERT INTO user_tool_usage (user_id, month, word_usage, max_words)
  VALUES (p_user_id, current_month, 0, 40000)
  ON CONFLICT (user_id, month) DO NOTHING;
  
  -- Return the current usage
  RETURN QUERY
  SELECT u.word_usage, u.max_words, u.month
  FROM user_tool_usage u
  WHERE u.user_id = p_user_id AND u.month = current_month;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add word usage
CREATE OR REPLACE FUNCTION add_word_usage(p_user_id UUID, p_word_count INTEGER)
RETURNS TABLE(word_usage INTEGER, max_words INTEGER, month VARCHAR) AS $$
DECLARE
  current_month VARCHAR(7);
BEGIN
  current_month := TO_CHAR(NOW(), 'YYYY-MM');
  
  -- Ensure the row exists first
  INSERT INTO user_tool_usage (user_id, month, word_usage, max_words)
  VALUES (p_user_id, current_month, 0, 40000)
  ON CONFLICT (user_id, month) DO NOTHING;
  
  -- Update the usage
  UPDATE user_tool_usage u
  SET word_usage = u.word_usage + p_word_count, updated_at = NOW()
  WHERE u.user_id = p_user_id AND u.month = current_month;
  
  -- Return the updated usage
  RETURN QUERY
  SELECT u.word_usage, u.max_words, u.month
  FROM user_tool_usage u
  WHERE u.user_id = p_user_id AND u.month = current_month;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to subtract word usage
CREATE OR REPLACE FUNCTION subtract_word_usage(p_user_id UUID, p_word_count INTEGER)
RETURNS TABLE(word_usage INTEGER, max_words INTEGER, month VARCHAR) AS $$
DECLARE
  current_month VARCHAR(7);
BEGIN
  current_month := TO_CHAR(NOW(), 'YYYY-MM');
  
  -- Update the usage, ensuring it doesn't go below 0
  UPDATE user_tool_usage u
  SET word_usage = GREATEST(0, u.word_usage - p_word_count), updated_at = NOW()
  WHERE u.user_id = p_user_id AND u.month = current_month;
  
  -- Return the updated usage
  RETURN QUERY
  SELECT u.word_usage, u.max_words, u.month
  FROM user_tool_usage u
  WHERE u.user_id = p_user_id AND u.month = current_month;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
