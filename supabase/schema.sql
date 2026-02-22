-- Colony Database Schema for Supabase
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Channels table
CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_avatar TEXT,
  author_is_bot BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bots table
CREATE TABLE bots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  avatar TEXT DEFAULT '🤖',
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline')),
  instructions TEXT,
  api_endpoint TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bot-Channel junction table (which bots are in which channels)
CREATE TABLE bot_channels (
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (bot_id, channel_id)
);

-- Indexes for performance
CREATE INDEX idx_messages_channel_id ON messages(channel_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_bot_channels_channel_id ON bot_channels(channel_id);

-- Row Level Security (RLS)
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_channels ENABLE ROW LEVEL SECURITY;

-- Channels policies
CREATE POLICY "Public read channels" ON channels FOR SELECT USING (true);
CREATE POLICY "Authenticated create channels" ON channels FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated update channels" ON channels FOR UPDATE USING (auth.role() = 'authenticated');

-- Messages policies
CREATE POLICY "Public read messages" ON messages FOR SELECT USING (true);
CREATE POLICY "Public insert messages" ON messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete own messages" ON messages FOR DELETE USING (author_id = auth.uid());

-- Bots policies
CREATE POLICY "Public read bots" ON bots FOR SELECT USING (true);
CREATE POLICY "Authenticated create bots" ON bots FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated update bots" ON bots FOR UPDATE USING (auth.role() = 'authenticated');

-- Bot-Channel policies
CREATE POLICY "Public read bot_channels" ON bot_channels FOR SELECT USING (true);
CREATE POLICY "Authenticated manage bot_channels" ON bot_channels FOR ALL USING (auth.role() = 'authenticated');

-- Seed data
INSERT INTO channels (name, description) VALUES 
  ('general', 'General discussion'),
  ('engineering', 'Engineering team chat'),
  ('design', 'Design discussions'),
  ('bots', 'AI agent playground');

INSERT INTO bots (name, description, avatar, status) VALUES 
  ('CodeReview Bot', 'Reviews pull requests', '🤖', 'offline'),
  ('Test Bot', 'Runs automated tests', '🧪', 'offline'),
  ('Docs Bot', 'Answers questions about docs', '📚', 'offline');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_channels_updated_at
  BEFORE UPDATE ON channels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_bots_updated_at
  BEFORE UPDATE ON bots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
