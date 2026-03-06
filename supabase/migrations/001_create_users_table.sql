-- Users table migration for Colony authentication
-- Run this in your Supabase SQL Editor

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX idx_users_email ON users(email);

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policies for users table
-- Users can read their own profile
CREATE POLICY "Users read own profile" ON users FOR SELECT USING (auth.uid() = id);
-- Anyone can read user data (for displaying names/avatars) - but not password_hash
-- We'll create a view for public user info
CREATE POLICY "Public read users" ON users FOR SELECT USING (true);

-- Create a view for public user information (excludes password_hash)
CREATE OR REPLACE VIEW public_users AS
SELECT id, email, name, avatar, created_at, updated_at
FROM users;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_users_updated_at();

-- Add RLS policies for the view (allow public read)
DROP POLICY IF EXISTS "Public read public_users" ON public_users;
CREATE POLICY "Public read public_users" ON public_users FOR SELECT USING (true);
