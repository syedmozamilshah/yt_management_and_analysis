-- ============================================
-- User Access Control Migration
-- Admin approval system for user signups
-- ============================================

-- Add user_status column to profiles table
-- Status values: 'pending', 'approved', 'blocked'
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS user_status TEXT NOT NULL DEFAULT 'pending';

-- Add email column to profiles for easier querying
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Create index for faster status queries
CREATE INDEX IF NOT EXISTS idx_profiles_user_status ON public.profiles(user_status);

-- Function to set new users as pending by default
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  admin_email TEXT := 'admin@videostash.com';
BEGIN
  INSERT INTO public.profiles (id, email, is_admin, user_status)
  VALUES (
    NEW.id, 
    NEW.email,
    NEW.email = admin_email, 
    CASE WHEN NEW.email = admin_email THEN 'approved' ELSE 'pending' END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup (if not exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to check user status
CREATE OR REPLACE FUNCTION public.get_user_status(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT user_status INTO v_status
  FROM public.profiles
  WHERE id = p_user_id;
  
  RETURN COALESCE(v_status, 'pending');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user status (admin only)
CREATE OR REPLACE FUNCTION public.update_user_status(p_user_id UUID, p_status TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.profiles
  SET user_status = p_status, updated_at = now()
  WHERE id = p_user_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_user_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_status TO service_role;
GRANT EXECUTE ON FUNCTION public.update_user_status TO service_role;

-- Set existing users to pending status (admin will need to approve them)
UPDATE public.profiles 
SET user_status = 'pending' 
WHERE user_status IS NULL AND email != 'admin@videostash.com';

-- Make sure admin is always approved
UPDATE public.profiles 
SET user_status = 'approved', is_admin = true 
WHERE email = 'admin@videostash.com';

-- RLS policy for profiles - allow users to read their own status
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Admin can view all profiles
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
CREATE POLICY "Admin can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Admin can update all profiles
DROP POLICY IF EXISTS "Admin can update all profiles" ON public.profiles;
CREATE POLICY "Admin can update all profiles"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );
