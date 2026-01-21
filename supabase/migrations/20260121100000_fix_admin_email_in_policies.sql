-- ============================================
-- Fix admin email in is_admin() function
-- Update to use admin@blowmeai.com
-- Also approve existing users who were set to pending
-- ============================================

-- Update the is_admin function to use the correct admin email
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT email = 'admin@blowmeai.com' 
    FROM auth.users 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also update any existing profiles with the old admin email
UPDATE public.profiles 
SET user_status = 'approved', is_admin = true 
WHERE email = 'admin@blowmeai.com';

-- Approve all existing users who were incorrectly set to pending
-- Users who had videos before should be approved
UPDATE public.profiles p
SET user_status = 'approved'
WHERE user_status = 'pending' 
  AND email != 'admin@blowmeai.com'
  AND EXISTS (
    SELECT 1 FROM public.user_videos uv WHERE uv.user_id = p.id
  );

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin TO anon;
