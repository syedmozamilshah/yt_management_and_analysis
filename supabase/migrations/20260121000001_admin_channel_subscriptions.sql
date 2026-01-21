-- ============================================
-- Admin Channel Subscriptions Migration
-- For global channel tracking visible to all users
-- ============================================

-- Create admin_channel_subscriptions table for tracking channels globally
CREATE TABLE IF NOT EXISTS admin_channel_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL UNIQUE,
  channel_name TEXT NOT NULL,
  niche TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_channel_subs_channel ON admin_channel_subscriptions(channel_id);
CREATE INDEX IF NOT EXISTS idx_admin_channel_subs_niche ON admin_channel_subscriptions(niche);
CREATE INDEX IF NOT EXISTS idx_admin_channel_subs_active ON admin_channel_subscriptions(is_active);

-- Enable RLS
ALTER TABLE admin_channel_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read (they need to see the niches)
DROP POLICY IF EXISTS "Anyone can read admin channel subscriptions" ON admin_channel_subscriptions;
CREATE POLICY "Anyone can read admin channel subscriptions"
  ON admin_channel_subscriptions FOR SELECT
  TO authenticated
  USING (true);

-- Only admin can insert/update/delete
DROP POLICY IF EXISTS "Admin can manage admin channel subscriptions" ON admin_channel_subscriptions;
CREATE POLICY "Admin can manage admin channel subscriptions"
  ON admin_channel_subscriptions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Grant permissions
GRANT SELECT ON admin_channel_subscriptions TO authenticated;
GRANT ALL ON admin_channel_subscriptions TO service_role;
