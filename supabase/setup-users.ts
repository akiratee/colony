/**
 * Colony Users Table Setup Script
 * 
 * Run this script to create the users table in Supabase:
 *   npx tsx supabase/setup-users.ts
 * 
 * Or paste the SQL below directly into Supabase SQL Editor:
 * https://supabase.com/dashboard/project/eqkvvvhqvexgdooskizc/sql
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://eqkvvvhqvexgdooskizc.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseServiceKey) {
  console.error('Error: SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY not set');
  console.log('\nYou can get the service key from:');
  console.log('Supabase Dashboard → Settings → API → service_role secret');
  console.log('\nOr run with:');
  console.log('SUPABASE_SERVICE_KEY=your_key npx tsx supabase/setup-users.ts');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createUsersTable() {
  console.log('Creating users table...');
  
  // First, ensure uuid-ossp extension is available
  let extError = null;
  try {
    await supabase.rpc('create_extension', { ext_name: 'uuid-ossp' });
  } catch (e) {
    extError = e;
  }
  
  // Create users table
  let createError = null;
  try {
    const result = await supabase.rpc('create_users_table', {
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          email TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          avatar TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        
        ALTER TABLE users ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Users read own profile" ON users FOR SELECT USING (auth.uid() = id);
        CREATE POLICY "Public read users" ON users FOR SELECT USING (true);
        
        CREATE OR REPLACE VIEW public_users AS
        SELECT id, email, name, avatar, created_at, updated_at FROM users;
        
        CREATE OR REPLACE FUNCTION update_users_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        
        CREATE TRIGGER update_users_updated_at
          BEFORE UPDATE ON users
          FOR EACH ROW EXECUTE FUNCTION update_users_updated_at();
          
        DROP POLICY IF EXISTS "Public read public_users" ON public_users;
        CREATE POLICY "Public read public_users" ON public_users FOR SELECT USING (true);
      `
    });
    if (result.error) createError = result.error;
  } catch (e: any) {
    createError = e.message || 'RPC not available, using direct table creation';
  }
  
  // Fallback: Try using schema SQL directly via POST
  if (createError || true) {
    console.log('Using direct SQL approach...');
    
    // Try to create extension
    try {
      await supabase.from('users').select('id').limit(1);
      console.log('Users table already exists!');
      return;
    } catch (e: any) {
      if (e.message?.includes('relation') || e.message?.includes('table')) {
        console.log('Users table does not exist, need to create it via SQL Editor');
        console.log('\nPlease run this SQL in Supabase SQL Editor:');
        console.log('============================================\n');
        console.log(SQL_MIGRATION);
        console.log('\n============================================');
        return;
      }
      console.log('Error:', e.message);
    }
  }
  
  console.log('Done!');
}

const SQL_MIGRATION = `-- Users table migration for Colony
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/eqkvvvhqvexgdooskizc/sql

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users read own profile" ON users;
CREATE POLICY "Users read own profile" ON users FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Public read users" ON users;
CREATE POLICY "Public read users" ON users FOR SELECT USING (true);

-- Create view for public user info (excludes password_hash)
CREATE OR REPLACE VIEW public_users AS
SELECT id, email, name, avatar, created_at, updated_at
FROM users;

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_users_updated_at();

-- RLS for the view
DROP POLICY IF EXISTS "Public read public_users" ON public_users;
CREATE POLICY "Public read public_users" ON public_users FOR SELECT USING (true);`;

createUsersTable();
