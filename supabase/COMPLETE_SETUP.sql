-- ============================================================================
-- COLONY COMPLETE DATABASE SCHEMA
-- Run this entire script in Supabase SQL Editor to set up everything
-- ============================================================================

-- ============================================
-- PART 1: Enable UUID extension
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PART 2: Channels table
-- ============================================
CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_project BOOLEAN DEFAULT false,
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PART 3: Messages table
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_avatar TEXT,
  author_is_bot BOOLEAN DEFAULT false,
  parent_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  edited_at TIMESTAMPTZ,
  pinned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PART 4: Bots table
-- ============================================
CREATE TABLE IF NOT EXISTS bots (
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

-- ============================================
-- PART 5: Bot-Channel junction table
-- ============================================
CREATE TABLE IF NOT EXISTS bot_channels (
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (bot_id, channel_id)
);

-- ============================================
-- PART 6: Users table (for auth)
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

-- ============================================
-- PART 7: Channel members (for private channels)
-- ============================================
CREATE TABLE IF NOT EXISTS channel_members (
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (channel_id, user_id)
);

-- ============================================
-- PART 8: Message reactions
-- ============================================
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, emoji, user_id)
);

-- ============================================
-- PART 9: Message seen tracking
-- ============================================
CREATE TABLE IF NOT EXISTS message_seen (
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  seen_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);

-- ============================================
-- PART 10: User preferences
-- ============================================
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'dark',
  notifications_enabled BOOLEAN DEFAULT true,
  notification_sound BOOLEAN DEFAULT true,
  message_preview BOOLEAN DEFAULT true,
  compact_mode BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PART 11: User presence
-- ============================================
CREATE TABLE IF NOT EXISTS user_presence (
  user_id TEXT PRIMARY KEY,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'away', 'busy', 'offline')),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  custom_status TEXT
);

-- ============================================
-- PART 12: Reminders
-- ============================================
CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  remind_at TIMESTAMPTZ NOT NULL,
  note TEXT,
  triggered BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_parent_id ON messages(parent_id);
CREATE INDEX IF NOT EXISTS idx_bot_channels_channel_id ON bot_channels(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_user_id ON channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders(remind_at);
CREATE INDEX IF NOT EXISTS idx_reminders_triggered ON reminders(triggered) WHERE triggered = false;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_seen ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- Channels policies
DROP POLICY IF EXISTS "Public read channels" ON channels;
CREATE POLICY "Public read channels" ON channels FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated create channels" ON channels;
CREATE POLICY "Authenticated create channels" ON channels FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authenticated update channels" ON channels;
CREATE POLICY "Authenticated update channels" ON channels FOR UPDATE USING (auth.role() = 'authenticated');

-- Messages policies
DROP POLICY IF EXISTS "Public read messages" ON messages;
CREATE POLICY "Public read messages" ON messages FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public insert messages" ON messages;
CREATE POLICY "Public insert messages" ON messages FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public delete own messages" ON messages;
CREATE POLICY "Public delete own messages" ON messages FOR DELETE USING (author_id::text = auth.uid()::text);

-- Bots policies
DROP POLICY IF EXISTS "Public read bots" ON bots;
CREATE POLICY "Public read bots" ON bots FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated create bots" ON bots;
CREATE POLICY "Authenticated create bots" ON bots FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authenticated update bots" ON bots;
CREATE POLICY "Authenticated update bots" ON bots FOR UPDATE USING (auth.role() = 'authenticated');

-- Bot-Channel policies
DROP POLICY IF EXISTS "Public read bot_channels" ON bot_channels;
CREATE POLICY "Public read bot_channels" ON bot_channels FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated manage bot_channels" ON bot_channels;
CREATE POLICY "Authenticated manage bot_channels" ON bot_channels FOR ALL USING (auth.role() = 'authenticated');

-- Users policies
DROP POLICY IF EXISTS "Public read users" ON users;
CREATE POLICY "Public read users" ON users FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert" ON users;
CREATE POLICY "Users can insert" ON users FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users can update own" ON users;
CREATE POLICY "Users can update own" ON users FOR UPDATE USING (auth.uid() = id);

-- Channel members policies
DROP POLICY IF EXISTS "Public read channel_members" ON channel_members;
CREATE POLICY "Public read channel_members" ON channel_members FOR SELECT USING (true);

-- Message reactions policies
DROP POLICY IF EXISTS "Public read reactions" ON message_reactions;
CREATE POLICY "Public read reactions" ON message_reactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public insert reactions" ON message_reactions;
CREATE POLICY "Public insert reactions" ON message_reactions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public delete reactions" ON message_reactions;
CREATE POLICY "Public delete reactions" ON message_reactions FOR DELETE USING (true);

-- Message seen policies
DROP POLICY IF EXISTS "Public read message_seen" ON message_seen;
CREATE POLICY "Public read message_seen" ON message_seen FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public insert message_seen" ON message_seen;
CREATE POLICY "Public insert message_seen" ON message_seen FOR INSERT WITH CHECK (true);

-- User preferences policies
DROP POLICY IF EXISTS "Public read user_preferences" ON user_preferences;
CREATE POLICY "Public read user_preferences" ON user_preferences FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users manage own preferences" ON user_preferences;
CREATE POLICY "Users manage own preferences" ON user_preferences FOR ALL USING (auth.uid() = user_id);

-- User presence policies
DROP POLICY IF EXISTS "Public read presence" ON user_presence;
CREATE POLICY "Public read presence" ON user_presence FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users update own presence" ON user_presence;
CREATE POLICY "Users update own presence" ON user_presence FOR ALL USING (true);

-- Reminders policies
DROP POLICY IF EXISTS "Public read reminders" ON reminders;
CREATE POLICY "Public read reminders" ON reminders FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users create reminders" ON reminders;
CREATE POLICY "Users create reminders" ON reminders FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users delete own reminders" ON reminders;
CREATE POLICY "Users delete own reminders" ON reminders FOR DELETE USING (user_id::text = auth.uid()::text);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_channels_updated_at ON channels;
CREATE TRIGGER update_channels_updated_at
  BEFORE UPDATE ON channels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_bots_updated_at ON bots;
CREATE TRIGGER update_bots_updated_at
  BEFORE UPDATE ON bots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- SEED DATA
-- ============================================
INSERT INTO channels (name, description, is_project) VALUES 
  ('general', 'General discussion', false),
  ('engineering', 'Engineering team chat', false),
  ('design', 'Design discussions', false),
  ('bots', 'AI agent playground', false)
ON CONFLICT (name) DO NOTHING;

INSERT INTO bots (name, description, avatar, status) VALUES 
  ('CodeReview Bot', 'Reviews pull requests', '🤖', 'offline'),
  ('Test Bot', 'Runs automated tests', '🧪', 'offline'),
  ('Docs Bot', 'Answers questions about docs', '📚', 'offline')
ON CONFLICT DO NOTHING;

-- ============================================
-- VERIFICATION
-- ============================================
SELECT 'Database setup complete!' as status;
SELECT COUNT(*) as channels_count FROM channels;
SELECT COUNT(*) as messages_count FROM messages;
SELECT COUNT(*) as bots_count FROM bots;
SELECT COUNT(*) as users_count FROM users;
