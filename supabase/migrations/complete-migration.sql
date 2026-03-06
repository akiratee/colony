-- Colony Complete Migration
-- Run this entire script in your Supabase SQL Editor to set up the database

-- ============================================
-- PART 1: Enable UUID extension
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PART 2: Users table for authentication
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================
-- PART 3: Enable RLS on users table
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policies for users table
DROP POLICY IF EXISTS "Public read users" ON users;
CREATE POLICY "Public read users" ON users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert" ON users;
CREATE POLICY "Users can insert" ON users FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update" ON users;
CREATE POLICY "Users can update" ON users FOR UPDATE USING (true);

-- ============================================
-- PART 4: Channel members (for private channels)
-- ============================================
CREATE TABLE IF NOT EXISTS channel_members (
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_members_user_id ON channel_members(user_id);

ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PART 5: Helper functions
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at on users
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- VERIFICATION
-- ============================================
SELECT 'Users table created successfully!' as status;
SELECT COUNT(*) as users_count FROM users;
