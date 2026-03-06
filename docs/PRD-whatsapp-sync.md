# Colony WhatsApp Bidirectional Sync PRD

**Version:** 1.0  
**Created:** Feb 26, 2026  
**Status:** Draft  
**Owner:** Vincent  

---

## Vision

Colony becomes the primary team hub with WhatsApp as a mirrored interface. Team members can interact via either Colony web UI or WhatsApp groups, with full bidirectional sync of messages, identity, rich media, and presence.

## Core Concept

- **Colony** = Primary interface (web app)
- **WhatsApp** = Mirror/backup interface (groups)
- **Sync** = Bidirectional, real-time, identity-preserving

---

## Features

### 1. Agents as Channel Members
- Agents can be added to any Colony channel
- @mention agents naturally (e.g., "@yilong review this")
- Agents respond in context within the channel
- Agent responses also sync to mapped WhatsApp group

### 2. UI-Driven Agent Config
- No more config files for agent personality/tools
- Configure via Colony UI: settings panel per agent
- Controls: name, avatar, personality traits, enabled tools, response style
- Changes take effect immediately without redeploy

### 3. Bidirectional Sync
- Messages sent in Colony → appear in mapped WhatsApp group
- Messages sent in WhatsApp group → appear in Colony channel
- Identity preserved: "Vincent via WhatsApp" shows as Vincent
- Thread context maintained on both sides

### 4. Rich Media Support
- **Voice**: WhatsApp voice messages → Colony audio player; Colony can send audio too
- **Images**: Full resolution, thumbnails in message preview
- **Locations**: Map preview in Colony, location picker from WhatsApp
- **Emoji/Reactions**: Sync as reactions in Colony
- **Documents**: File attachments with preview

### 5. Channel↔Group Mapping
- Explicit configuration: `#engineering` ↔ "Engineering Team" WhatsApp group
- One Colony channel → one or multiple WhatsApp groups (optional)
- One WhatsApp group → one Colony channel (required for sync)
- UI for managing mappings: select channel, enter WhatsApp group ID/link

### 6. Per-Channel Notification Rules
- **All**: Every message syncs to WhatsApp
- **@mentions only**: Only messages with @ mentions go to WhatsApp
- **Silent**: WhatsApp members can read but no notifications
- **Off**: No sync to WhatsApp (Colony-only)
- Configurable per channel in Colony settings

### 7. Agent Actions
- Agents can create events → notify channel + mapped WhatsApp group
- Agents can create tasks → post to channel with /task notation
- Agents can create polls → interactive poll in Colony + WhatsApp
- Notifications include action buttons for WhatsApp (e.g., "Accept" / "Decline")

### 8. Message Threading
- WhatsApp reply chains → maintained as thread in Colony
- Colony thread replies → show as reply in WhatsApp
- Parent message reference maintained across platforms

### 9. Presence Sync
- Colony: online/away/offline status
- WhatsApp: last seen / online indicator
- Status shown in Colony for WhatsApp users
- "Using Colony" or "Using WhatsApp" indicator

### 10. Offline Queuing
- If Colony is down: queue WhatsApp messages locally
- When Colony returns: replay queued messages in order
- If WhatsApp webhook fails: queue on Colony side, retry
- Visual indicator in UI: "3 messages pending sync"

---

## Technical Architecture

### Components

1. **WhatsApp Webhook Handler**
   - Receives incoming messages from WhatsApp
   - Validates webhook signature
   - Parses message types (text, image, voice, etc.)
   - Routes to appropriate channel based on group mapping

2. **Sync Engine**
   - Maintains message state: Colony ID ↔ WhatsApp Message ID
   - Handles conflict resolution (edit/delete on both sides)
   - Queues failed syncs for retry
   - Deduplicates incoming messages

3. **Identity Mapper**
   - Maps WhatsApp phone number → Colony user
   - Requires user linking (WhatsApp number → Colony account)
   - Fallback: create "unlinked" user for unknown numbers

4. **Media Handler**
   - Downloads WhatsApp media (voice, images, docs)
   - Uploads to Colony storage (Supabase Storage)
   - Generates thumbnails for images
   - Converts audio for web playback

5. **Presence Service**
   - WebSocket connection to WhatsApp (if available via API)
   - Poll last-seen status periodically
   - Broadcast presence changes to Colony clients

### Data Model

```
Table: whatsapp_channels
- id: uuid
- colony_channel_id: uuid
- whatsapp_group_id: string
- notification_rule: enum (all, mentions, silent, off)
- created_at: timestamp
- updated_at: timestamp

Table: whatsapp_users
- id: uuid
- colony_user_id: uuid
- whatsapp_phone: string
- linked_at: timestamp

Table: message_sync_map
- id: uuid
- colony_message_id: uuid
- whatsapp_message_id: string
- sync_direction: enum (colony_to_whatsapp, whatsapp_to_colony)
- synced_at: timestamp

Table: sync_queue
- id: uuid
- payload: jsonb
- retry_count: integer
- next_retry_at: timestamp
- status: enum (pending, processing, failed, completed)
```

---

## User Flows

### Linking WhatsApp to Colony
1. User opens Colony → Settings → WhatsApp
2. Clicks "Link WhatsApp"
3. Shows QR code with unique token
4. User scans with WhatsApp → sends token to Colony bot
5. System links phone number to Colony user
6. Sync begins

### Sending from Colony to WhatsApp
1. User types message in #engineering channel
2. Sync engine checks channel mapping
3. If notification_rule allows: POST to WhatsApp Business API
4. WhatsApp sends to group
5. Sync map stores Colony ID ↔ WhatsApp ID

### Sending from WhatsApp to Colony
1. User sends message in mapped WhatsApp group
2. WhatsApp webhook receives payload
3. Sync engine validates, parses media
4. Creates message in Colony channel
5. Displays as "Vincent (WhatsApp)" with WhatsApp icon

---

## API Endpoints

### WhatsApp Webhook
- `POST /api/whatsapp/webhook` - Receive messages
- `GET /api/whatsapp/webhook` - Verify webhook (WhatsApp verification)

### Admin Endpoints
- `POST /api/whatsapp/channels` - Create channel mapping
- `GET /api/whatsapp/channels` - List mappings
- `PUT /api/whatsapp/channels/:id` - Update mapping
- `DELETE /api/whatsapp/channels/:id` - Delete mapping

### User Endpoints
- `POST /api/whatsapp/link` - Link WhatsApp number
- `GET /api/whatsapp/status` - Get sync status

---

## Open Questions

1. **WhatsApp Business API cost**: Need to verify pricing for group messaging
2. **Media storage limits**: Supabase Storage quotas
3. **Message deletion**: How to handle delete on one platform
4. **Rate limiting**: WhatsApp API rate limits for group messages
5. **Agent responses via WhatsApp**: Should agents reply in WhatsApp too?

---

## Success Metrics

- [ ] Messages sync within 5 seconds
- [ ] Rich media loads correctly on both platforms
- [ ] User identity preserved in 95%+ of messages
- [ ] Offline queue recovers gracefully
- [ ] Presence updates within 30 seconds

---

## Priority

**Phase 1 (MVP):**
- Basic bidirectional text sync
- Channel↔group mapping
- Identity mapping

**Phase 2:**
- Rich media (images, voice)
- Message threading
- Agent mentions

**Phase 3:**
- Presence sync
- Offline queuing
- Agent actions
- Per-channel notification rules
