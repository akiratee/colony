-- Colony Authentication Schema
-- Run this in your Supabase SQL Editor

-- Users table for authentication
CREATE TABLE IF NOT EXISTS auth_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX idx_auth_users_email ON auth_users(email);

-- Channel members for private channels
CREATE TABLE IF NOT EXISTS channel_members (
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (channel_id, user_id)
);

-- Indexes
CREATE INDEX idx_channel_members_user_id ON channel_members(user_id);

-- Enable RLS
ALTER TABLE auth_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;

-- Auth users policies
CREATE POLICY "Users can read all users" ON auth_users FOR SELECT USING (true);
CREATE POLICY "Users can create account" ON auth_users FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own profile" ON auth_users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can read own profile" ON auth_users FOR SELECT USING (auth.uid() = id);

-- Channel members policies
CREATE POLICY "Public read channel_members" ON channel_members FOR SELECT USING (true);
CREATE POLICY "Authenticated manage channel_members" ON channel_members FOR ALL USING (auth.role() = 'authenticated');

-- Function to get user by email (for login)
CREATE OR REPLACE FUNCTION get_user_by_email(user_email TEXT)
RETURNS TABLE(id UUID, email TEXT, name TEXT, password_hash TEXT, avatar TEXT) AS $$
BEGIN
  RETURN QUERY SELECT au.id, au.email, au.name, au.password_hash, au.avatar
  FROM auth_users au WHERE au.email = user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user by ID
CREATE OR REPLACE FUNCTION get_user_by_id(user_id UUID)
RETURNS TABLE(id UUID, email TEXT, name TEXT, avatar TEXT, created_at TIMESTAMPTZ) AS $$
BEGIN
  RETURN QUERY SELECT au.id, au.email, au.name, au.avatar, au.created_at
  FROM auth_users au WHERE au.id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for updated_at on auth_users
CREATE TRIGGER update_auth_users_updated_at
  BEFORE UPDATE ON auth_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
