# Colony - Technical Specification

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Next.js Frontend                      │
│  (React 18, Tailwind, Socket.io Client)                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Socket.io Server                          │
│  (Real-time message relay, rooms, presence)               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Supabase Backend                       │
│  - PostgreSQL database                                     │
│  - Auth (future)                                           │
│  - Real-time subscriptions                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | Next.js | 14.x |
| UI | React | 18.x |
| Styling | Tailwind CSS | 3.x |
| Real-time | Socket.io | 4.x |
| Database | Supabase | - |
| Language | TypeScript | 5.x |
| Testing | Vitest | 1.x |

---

## Database Schema (Supabase)

### channels
```sql
CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### messages
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_id TEXT NOT NULL, -- user ID or bot ID
  author_name TEXT NOT NULL,
  author_is_bot BOOLEAN DEFAULT false,
  author_avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### bots
```sql
CREATE TABLE bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  avatar TEXT,
  status TEXT DEFAULT 'offline', -- 'online' | 'offline'
  instructions TEXT, -- system prompt
  api_endpoint TEXT, -- external API to call
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### bot_channels (many-to-many)
```sql
CREATE TABLE bot_channels (
  bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  PRIMARY KEY (bot_id, channel_id)
);
```

---

## API Endpoints

### REST (Next.js API Routes)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/channels | List all channels |
| POST | /api/channels | Create channel |
| GET | /api/messages?channel_id=X | Get messages for channel |
| GET | /api/bots | List all bots |
| POST | /api/bots | Create bot |
| POST | /api/bots/:id/chat | Send message to bot |

### Socket.io Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `join_channel` | Client → Server | `{ channelId: string }` |
| `leave_channel` | Client → Server | `{ channelId: string }` |
| `send_message` | Client → Server | `{ channelId, content }` |
| `message` | Server → Clients | `{ message: Message }` |
| `typing` | Client ↔ Server | `{ channelId, userId }` |
| `presence` | Server → Clients | `{ online: string[] }` |

---

## Bot Integration Flow

```
User sends message
       │
       ▼
Socket broadcasts to channel
       │
       ▼
Check if any bots in channel
       │
       ▼
For each bot:
  1. Load bot config from DB
  2. Call bot's API endpoint with message
  3. Receive response
  4. Post response as bot message
```

### Bot API Contract

**Request:**
```json
{
  "message": "Hey, can you review my code?",
  "author": "Vincent",
  "context": {
    "channel": "engineering",
    "recent_messages": [...]
  }
}
```

**Response:**
```json
{
  "response": "Sure! I'll take a look...",
  "actions": []
}
```

---

## UI Components

### Pages
- `/` — Channel list + chat view (main)
- `/bots` — Bot management
- `/settings` — User preferences

### Key Components
- `ChannelSidebar` — Left sidebar with channels/bots
- `ChatArea` — Message list + input
- `MessageBubble` — Individual message
- `BotCard` — Bot configuration card
- `BotMessage` — Special styling for bot messages

---

## File Structure

```
colony/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx         # Main chat
│   │   ├── globals.css
│   │   ├── bots/
│   │   │   └── page.tsx     # Bot management
│   │   └── api/
│   │       ├── channels/
│   │       ├── messages/
│   │       └── bots/
│   ├── components/
│   │   ├── ChannelSidebar.tsx
│   │   ├── ChatArea.tsx
│   │   ├── MessageBubble.tsx
│   │   └── ...
│   ├── lib/
│   │   ├── socket.ts        # Socket.io client
│   │   ├── supabase.ts      # Supabase client
│   │   └── bots.ts          # Bot utilities
│   └── hooks/
│       ├── useSocket.ts
│       └── useMessages.ts
├── server/
│   └── index.ts             # Socket.io server
├── docs/
│   ├── PRD.md
│   ├── technical.md         # This file
│   ├── design.md
│   └── qa-checklist.md
├── supabase/
│   └── schema.sql
├── package.json
└── ...
```

---

## Security Considerations

1. **Message sanitization** — Strip HTML/scripts from messages
2. **Rate limiting** — Max 10 messages/second per user
3. **Bot API validation** — Sanitize inputs to bot endpoints
4. **Future: Auth** — Supabase Auth for user management

---

## Development Phases

### Week 1: Foundation
- [ ] Set up Next.js + Tailwind
- [ ] Configure Socket.io server
- [ ] Create database schema
- [ ] Build channel list UI
- [ ] Basic message sending

### Week 2: Real-time + Bots
- [ ] Socket.io message sync
- [ ] Bot CRUD UI
- [ ] Bot → channel integration
- [ ] Basic mobile responsive

### Week 3: Polish
- [ ] Message reactions
- [ ] Typing indicators
- [ ] PWA setup
- [ ] Performance optimization

---

**Last Updated:** 2026-02-20
