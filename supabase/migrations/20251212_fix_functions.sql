-- Run this in Supabase SQL Editor to fix the missing functions

-- Drop and recreate functions to ensure they exist
DROP FUNCTION IF EXISTS get_or_create_monthly_usage(UUID);
DROP FUNCTION IF EXISTS add_word_usage(UUID, INTEGER);
DROP FUNCTION IF EXISTS subtract_word_usage(UUID, INTEGER);

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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_or_create_monthly_usage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_monthly_usage(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION add_word_usage(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION add_word_usage(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION subtract_word_usage(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION subtract_word_usage(UUID, INTEGER) TO service_role;
