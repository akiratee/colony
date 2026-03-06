# Colony API Documentation

## Overview
Colony is a bot-first team messaging platform with REST API and real-time WebSocket support.

## Base URL
```
Production: https://colony.akiratee.com/api
Local: http://localhost:3000/api
```

## WebSocket URL
```
Production: wss://colony.akiratee.com
Local: ws://localhost:3001
```

---

### Socket Server REST Endpoints

The socket server (port 3001) exposes additional REST endpoints for health checks and internal broadcasting.

#### GET /api/health
Health check endpoint for the socket server.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-27T09:30:00Z"
}
```

#### POST /api/broadcast
Internal endpoint to broadcast events to socket channels (used by other services like WhatsApp webhook).

**Headers:**
| Header | Required | Description |
|--------|----------|-------------|
| x-api-key | Yes | Internal API key (set via `INTERNAL_API_KEY` env var) |

**Request Body:**
```json
{
  "event": "message",
  "channelId": "general",
  "data": {
    "id": "msg-123",
    "content": "Hello from WhatsApp!",
    "channelId": "general",
    "author": { "name": "WhatsApp (+1234567890)", "avatar": "📱" },
    "timestamp": "2026-02-27T09:30:00Z"
  }
}
```

**Response:**
```json
{
  "success": true
}
```

**Error Responses:**
- 400: Missing required fields (event, channelId, data)
- 403: Invalid API key

**Rate Limit:** 100 requests/minute

---

## Endpoints

### Messages

#### GET /api/messages
Get messages, optionally filtered by channel.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| channelId | string | - | Filter by channel ID |
| limit | number | 50 | Max messages to return (max 100) |
| offset | number | 0 | Pagination offset |

**Response:**
```json
{
  "messages": [...],
  "total": 100,
  "limit": 50,
  "offset": 0
}
```

#### GET /api/messages/search
Search messages by content.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| q | string | - | Search query (required) |
| channelId | string | - | Filter by channel ID |
| limit | number | 20 | Max results (max 100) |

**Response:**
```json
{
  "messages": [...],
  "total": 5,
  "returned": 5,
  "query": "test"
}
```

**Rate Limit:** 30 requests/minute (requires auth in production)

#### GET /api/messages/export
Export messages to JSON or CSV format.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| channelId | string | - | Filter by channel ID (optional) |
| format | string | `json` | Export format (`json` or `csv`) |
| limit | number | 100 | Max messages (max 1000) |
| offset | number | 0 | Pagination offset |

**Response (JSON):**
```json
{
  "exportedAt": "2026-02-26T21:00:00Z",
  "channelId": "1",
  "total": 50,
  "messages": [...]
}
```

**Response (CSV):**
Returns CSV file with headers: id, channelId, content, author, timestamp, editedAt

**Rate Limit:** 10 requests/minute (requires auth in production)

#### POST /api/messages
Create a new message.

**Request Body:**
```json
{
  "channelId": "1",
  "content": "Hello team!",
  "author": {
    "name": "Vincent",
    "avatar": "👨‍💻"
  }
}
```

**Rate Limit:** 10 requests/minute (requires auth in production)

#### DELETE /api/messages
Delete a message by ID.

**Request Body:**
```json
{
  "id": "1",
  "authorName": "Vincent"
}
```

**Validation:**
- `id`: required, must exist
- `authorName`: required, must match message author for authorization

**Rate Limit:** 10 requests/minute (requires auth in production)

#### PATCH /api/messages
Edit an existing message.

**Request Body:**
```json
{
  "id": "1",
  "content": "Updated message content",
  "authorName": "Vincent"
}
```

**Validation:**
- `id`: required, must exist
- `content`: required, 1-10000 chars

**Rate Limit:** 20 requests/minute (requires auth in production)

#### GET /api/messages/pin
Get pinned messages, optionally filtered by channel.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| channelId | string | - | Filter by channel ID |

**Response:**
```json
{
  "pinned": [
    {
      "id": "msg-123",
      "content": "Important message",
      "channelId": "1",
      "author": { "name": "Vincent", "avatar": "👨‍💻" },
      "timestamp": "2026-02-26T12:00:00Z",
      "pinnedAt": "2026-02-26T12:05:00Z"
    }
  ]
}
```

**Rate Limit:** 30 requests/minute (requires auth in production)

#### POST /api/messages/pin
Pin or unpin a message.

**Request Body:**
```json
{
  "id": "message-id",
  "action": "pin"
}
```

**Valid actions:** `"pin"`, `"unpin"`

**Response:**
```json
{
  "success": true,
  "message": {
    "id": "msg-123",
    "content": "Important message",
    "pinnedAt": "2026-02-26T12:05:00Z"
  }
}
```

**Socket Events:** Broadcasts `message_pinned` or `message_unpinned` events.

**Rate Limit:** 30 requests/minute (requires auth in production)

---

#### GET /api/messages/reactions
Get reactions for a message.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| messageId | string | Yes | Message ID |

**Response:**
```json
{
  "messageId": "msg-123",
  "reactions": [
    { "emoji": "👍", "users": ["Vincent", "Yilong"], "count": 2 },
    { "emoji": "🎉", "users": ["Dan"], "count": 1 }
  ]
}
```

**Rate Limit:** 30 requests/minute

#### POST /api/messages/reactions
Add or toggle a reaction on a message.

**Request Body:**
```json
{
  "messageId": "message-id",
  "emoji": "👍",
  "userName": "Vincent"
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "msg-123",
  "reactions": [
    { "emoji": "👍", "users": ["Vincent"], "count": 1 }
  ]
}
```

**Notes:** Toggles reaction off if user already reacted with that emoji.

**Rate Limit:** 30 requests/minute (requires auth in production)

---

#### GET /api/messages/threads
Get thread replies for a message.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| parentId | string | Yes | Parent message ID to get replies for |

**Response:**
```json
{
  "parentId": "msg-123",
  "replies": [
    {
      "id": "msg-456",
      "channelId": "1",
      "content": "Great idea!",
      "author": { "name": "Yilong", "avatar": "👨‍💻", "isBot": false },
      "parentId": "msg-123",
      "timestamp": "2026-02-26T12:10:00Z"
    }
  ],
  "total": 1
}
```

**Notes:** Returns replies sorted by timestamp (oldest first).

**Rate Limit:** 30 requests/minute (requires auth in production)

---

#### POST /api/messages (with threading)
Create a threaded reply by including parentId.

**Request Body:**
```json
{
  "channelId": "1",
  "content": "Thanks for the update!",
  "author": {
    "name": "Vincent",
    "avatar": "👨‍💻"
  },
  "parentId": "msg-123"
}
```

**Notes:** The parentId field creates a threaded reply to the specified message.

**Rate Limit:** 10 requests/minute (requires auth in production)

---

#### GET /api/messages/status
Get WhatsApp message delivery status for tracking outbound sync.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| messageId | string | No | Filter by specific message ID |
| channelId | string | No | Filter by channel ID |
| pending | boolean | No | Return only pending messages |
| failed | boolean | No | Return only failed messages |

**Response:**
```json
{
  "statuses": [
    {
      "messageId": "msg-123",
      "channelId": "1",
      "colonyMessageId": "colony-msg-456",
      "whatsappGroupId": "group-789",
      "status": "delivered",
      "retries": 0,
      "createdAt": "2026-02-27T03:00:00Z",
      "updatedAt": "2026-02-27T03:00:05Z"
    }
  ],
  "total": 1
}
```

**Status values:** `pending`, `sent`, `delivered`, `failed`, `read`

**Notes:** Used for tracking Colony → WhatsApp message delivery status.

**Rate Limit:** 30 requests/minute (requires auth in production)

---

#### GET /api/messages/seen
Get who has seen a message.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| messageId | string | Yes | Message ID |

**Response:**
```json
{
  "messageId": "msg-123",
  "seenBy": ["Vincent", "Yilong"],
  "seenCount": 2
}
```

**Rate Limit:** 30 requests/minute (requires auth in production)

#### POST /api/messages/seen
Mark messages as seen.

**Request Body (mark single message):**
```json
{
  "messageId": "message-id",
  "userName": "Vincent"
}
```

**Request Body (mark all in channel):**
```json
{
  "channelId": "channel-id",
  "userName": "Vincent"
}
```

**Response:**
```json
{
  "success": true,
  "message": { "id": "msg-123", "seenBy": ["Vincent"] }
}
```

or

```json
{
  "success": true,
  "markedCount": 15
}
```

**Rate Limit:** 30 requests/minute (requires auth in production)

#### GET /api/channels/stats
Get channel statistics including message counts and top contributors.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| channelId | string | No | Filter by specific channel ID |
| timeframe | string | No | Time range: `24h`, `7d`, `30d`, `all` (default: all) |

**Response:**
```json
{
  "channels": [
    {
      "channelId": "1",
      "channelName": "general",
      "totalMessages": 150,
      "botMessages": 45,
      "humanMessages": 105,
      "topContributors": [
        { "name": "Vincent", "count": 50 },
        { "name": "Yilong", "count": 35 },
        { "name": "Bot", "count": 45 }
      ]
    }
  ]
}
```

**Notes:** 
- Tracks bot vs human message counts separately
- Top contributors shows message count per user/bot

**Rate Limit:** 30 requests/minute (requires auth in production)

---

#### GET /api/channels/mute
Get all muted channels for the current user.

**Response:**
```json
{
  "mutedChannels": [
    {
      "channelId": "1",
      "mutedAt": "2026-03-03T09:00:00.000Z",
      "expiresAt": "2026-03-04T09:00:00.000Z",
      "isPermanent": false
    }
  ]
}
```

**Notes:**
- Returns all channels the user has muted
- `expiresAt` is null for permanent mutes
- `isPermanent` is true when no expiration is set

**Rate Limit:** 30 requests/minute (requires auth in production)

#### POST /api/channels/mute
Mute a channel to suppress notifications.

**Request Body:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| channelId | string | Yes | The channel ID to mute |
| durationMinutes | number | No | Mute duration in minutes (default: permanent) |

**Response:**
```json
{
  "message": "Channel muted",
  "mute": {
    "channelId": "1",
    "mutedAt": "2026-03-03T09:00:00.000Z",
    "expiresAt": null,
    "isPermanent": true
  }
}
```

**Notes:**
- Set `durationMinutes` for temporary mute (e.g., 60 for 1 hour)
- Omit `durationMinutes` for permanent mute
- Already muted channels return success with existing mute info

**Rate Limit:** 30 requests/minute (requires auth in production)

#### DELETE /api/channels/mute
Unmute a channel.

**Request Body:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| channelId | string | Yes | The channel ID to unmute |

**Response:**
```json
{
  "message": "Channel unmuted"
}
```

**Notes:**
- Removes the mute from a channel
- Returns success even if channel was not muted

**Rate Limit:** 30 requests/minute (requires auth in production)

---

### Channels

#### GET /api/channels
Get all channels.

**Response:**
```json
[
  {
    "id": "1",
    "name": "general",
    "description": "General discussion",
    "isPrivate": false,
    "createdAt": "2026-02-22T00:00:00Z"
  },
  {
    "id": "2",
    "name": "team-secret",
    "description": "Private team discussions",
    "isPrivate": true,
    "allowedUsers": ["user-id-1", "user-id-2"],
    "createdAt": "2026-02-22T00:00:00Z"
  }
]
```

**Note:** For private channels, `allowedUsers` is only included if you have access to the channel.

#### POST /api/channels
Create a new channel.

**Request Body:**
```json
{
  "name": "engineering",
  "description": "Engineering team discussions"
}
```

**Validation:**
- `name`: required, 1-50 chars, lowercase alphanumeric with hyphens only
- `description`: optional, max 500 chars
- `isPrivate`: optional, boolean - if true, creates a private (invite-only) channel
- `allowedUsers`: optional, string[] - user IDs allowed to access private channel

**Create a private channel:**
```json
{
  "name": "team-secret",
  "description": "Private team discussions",
  "isPrivate": true,
  "allowedUsers": ["user-id-1", "user-id-2"]
}
```

**Rate Limit:** 10 requests/minute (requires auth in production)

#### GET /api/channels/:id
Get a single channel by ID.

**Response:**
```json
{
  "id": "1",
  "name": "general",
  "description": "General discussion",
  "createdAt": "2026-02-22T00:00:00Z"
}
```

#### PATCH /api/channels/:id
Update a channel's name or description.

**Request Body:**
```json
{
  "name": "engineering-updated",
  "description": "Updated description"
}
```

**Validation:**
- `name`: optional, 1-50 chars, lowercase alphanumeric with hyphens only
- `description`: optional, max 500 chars

**Rate Limit:** 10 requests/minute (requires auth in production)

#### POST /api/channels/:id
Invite a user to a private channel.

**Request Body:**
```json
{
  "userId": "user-id-to-invite"
}
```

**Validation:**
- `userId`: required, string - the user ID to invite

**Notes:**
- Only works for private channels (channels created with `isPrivate: true`)
- Only existing channel members can invite new users
- Returns 400 if the channel is not private

**Rate Limit:** 10 requests/minute (requires auth in production)

#### DELETE /api/channels/:id
Delete a channel and all its messages.

**Rate Limit:** 10 requests/minute (requires auth in production)

#### GET /api/channels/:id/members
Get members/participants of a channel.

**Response:**
```json
{
  "channelId": "1",
  "channelName": "general",
  "type": "public",
  "members": [
    { "id": "user-1", "name": "Vincent", "avatar": "👨‍💻" }
  ],
  "note": "Public channels - members not tracked. Use socket events to see online users."
}
```

**Notes:**
- For DMs, returns participant details
- For private channels, returns allowed users
- For public channels, returns a note about using socket events

**Rate Limit:** 30 requests/minute (requires auth in production)

---

### Direct Messages

#### GET /api/direct-messages
Get all direct messages for the authenticated user.

**Response:**
```json
[
  {
    "id": "dm-123-456",
    "name": "dm-user1-user2",
    "description": "Direct message",
    "isDirectMessage": true,
    "participantIds": ["user1", "user2"],
    "createdAt": "2026-02-24T12:00:00.000Z"
  }
]
```

#### POST /api/direct-messages
Create or get a direct message with another user.

**Request Body:**
```json
{
  "userId": "target-user-id"
}
```

**Response:**
```json
{
  "id": "dm-123-456",
  "name": "dm-user1-user2",
  "description": "Direct message",
  "isDirectMessage": true,
  "participantIds": ["user1", "user2"],
  "createdAt": "2026-02-24T12:00:00.000Z"
}
```

**Validation:**
- `userId`: required, must be a valid user ID
- Cannot create DM with yourself (returns 400)

**Rate Limit:** 10 requests/minute (requires auth in production)

---

### Polls

#### GET /api/messages/polls
Get all polls, or a specific poll by ID or message ID.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| pollId | string | No | Get a specific poll by ID |
| messageId | string | No | Get poll attached to a specific message |

**Response - Single Poll:**
```json
{
  "poll": {
    "id": "poll-123",
    "messageId": "msg-456",
    "question": "What should we have for lunch?",
    "options": ["Pizza", "Tacos", "Sushi", "Salad"],
    "votes": {
      "Pizza": ["Alice", "Bob"],
      "Tacos": ["Charlie"],
      "Sushi": [],
      "Salad": []
    },
    "isMultiVote": false,
    "isClosed": false,
    "createdBy": "Alice",
    "createdAt": "2026-03-03T10:00:00.000Z"
  }
}
```

**Response - All Polls:**
```json
{
  "polls": [...]
}
```

#### POST /api/messages/polls
Create a new poll attached to a message.

**Request Body:**
```json
{
  "messageId": "msg-456",
  "question": "What should we have for lunch?",
  "options": ["Pizza", "Tacos", "Sushi", "Salad"],
  "isMultiVote": false
}
```

**Validation:**
- `messageId`: required, must be a valid message ID
- `question`: required, max 200 characters
- `options`: required, array of 2-10 strings, each max 100 characters
- `isMultiVote`: optional, boolean (default false)

**Response:**
```json
{
  "success": true,
  "poll": { ... }
}
```

**Rate Limit:** 20 requests/minute (requires auth)

#### PATCH /api/messages/polls
Vote on a poll or close a poll.

**Request Body - Vote:**
```json
{
  "pollId": "poll-123",
  "action": "vote",
  "optionId": "Pizza"
}
```

**Request Body - Close Poll:**
```json
{
  "pollId": "poll-123",
  "action": "close"
}
```

**Validation:**
- `pollId`: required
- `action`: required, either "vote" or "close"
- `optionId`: required for vote action, must be one of the poll options
- Only poll creator can close the poll

**Response:**
```json
{
  "success": true,
  "poll": { ... }
}
```

**Rate Limit:** 30 requests/minute (requires auth)

---

### Bots

#### GET /api/bots
Get all bots.

**Response:**
```json
[
  {
    "id": "1",
    "name": "Test Bot",
    "description": "Runs automated tests",
    "avatar": "🧪",
    "status": "online"
  }
]
```

#### POST /api/bots
Create a new bot.

**Request Body:**
```json
{
  "name": "My Bot",
  "description": "What the bot does",
  "avatar": "🤖",
  "instructions": "System prompt for the bot",
  "apiEndpoint": "https://api.example.com/bot"
}
```

**Rate Limit:** 10 requests/minute (requires auth in production)

#### GET /api/bots/:id
Get a single bot by ID.

**Response:**
```json
{
  "id": "1",
  "name": "Test Bot",
  "description": "Runs automated tests",
  "avatar": "🧪",
  "status": "online",
  "instructions": "System prompt",
  "apiEndpoint": "https://api.example.com/bot"
}
```

#### PATCH /api/bots/:id
Update a bot.

**Request Body:**
```json
{
  "name": "Updated Bot Name",
  "description": "Updated description",
  "avatar": "🤖",
  "status": "offline",
  "instructions": "Updated instructions",
  "apiEndpoint": "https://api.example.com/new-endpoint"
}
```

**Validation:**
- `status`: optional, must be "online" or "offline"
- All other fields: optional strings

**Rate Limit:** 10 requests/minute (requires auth in production)

#### DELETE /api/bots/:id
Delete a bot by ID.

**Rate Limit:** 10 requests/minute (requires auth in production)

---

### Agents

#### GET /api/agents
Get all available agents (integrates with OpenClaw).

**Response:**
```json
[
  {
    "id": "yilong",
    "name": "Yilong",
    "role": "Senior Engineer",
    "avatar": "👨‍💻",
    "description": "Code reviews, architecture, debugging",
    "model": "MiniMax M2.1",
    "status": "online"
  }
]
```

#### POST /api/agents
Spawn an agent to perform a task.

**Request Body:**
```json
{
  "action": "spawn",
  "agentId": "yilong",
  "task": "Review the authentication flow code"
}
```

**Rate Limit:** 10 requests/minute (requires auth in production)

---

### Agent Actions

Agents can create events, tasks, and polls within Colony channels.

#### GET /api/agent-actions
Get all actions, optionally filtered by channel and type.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| channelId | string | No | Filter by channel ID |
| type | string | No | Filter by type (`event`, `task`, `poll`) |
| limit | number | No | Max results (default 50, max 100) |
| offset | number | No | Pagination offset |

**Response:**
```json
{
  "actions": [
    {
      "id": "action-123",
      "type": "task",
      "title": "Review PR #42",
      "description": "Review the new authentication flow",
      "assignee": "Yilong",
      "dueDate": "2026-02-28",
      "priority": "high",
      "status": "pending",
      "channelId": "1",
      "createdBy": "Vincent",
      "createdAt": "2026-02-27T03:00:00Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

**Rate Limit:** 30 requests/minute (requires auth)

#### POST /api/agent-actions
Create a new action (event, task, or poll).

**Request Body (Task):**
```json
{
  "actionType": "task",
  "title": "Review PR #42",
  "description": "Review the new authentication flow",
  "channelId": "1",
  "assignee": "Yilong",
  "dueDate": "2026-02-28",
  "priority": "high"
}
```

**Request Body (Event):**
```json
{
  "actionType": "event",
  "title": "Sprint Planning",
  "description": "Plan the next sprint goals",
  "channelId": "1",
  "startTime": "2026-03-01T10:00:00Z",
  "endTime": "2026-03-01T11:00:00Z",
  "location": "Zoom"
}
```

**Request Body (Poll):**
```json
{
  "actionType": "poll",
  "title": "Sprint Priorities",
  "question": "What should we focus on?",
  "options": ["Performance", "Security", "New Features", "Bug Fixes"],
  "channelId": "1",
  "multipleChoice": false,
  "expiresAt": "2026-03-01T00:00:00Z"
}
```

**Response:**
```json
{
  "id": "action-123",
  "type": "task",
  "title": "Review PR #42",
  "status": "pending",
  "createdAt": "2026-02-27T03:00:00Z"
}
```

**Rate Limit:** 10 requests/minute (requires auth)

#### PATCH /api/agent-actions
Update an action (vote on poll, update task status).

**Request Body (Vote on Poll):**
```json
{
  "actionId": "action-123",
  "action": "vote",
  "data": {
    "optionId": "option-0",
    "userId": "user-123"
  }
}
```

**Request Body (Update Task Status):**
```json
{
  "actionId": "action-123",
  "action": "updateStatus",
  "data": {
    "status": "in_progress"
  }
}
```

**Valid statuses:** `pending`, `in_progress`, `completed`

**Rate Limit:** 20 requests/minute (requires auth)

#### DELETE /api/agent-actions
Delete an action.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| actionId | string | Yes | ID of action to delete |

**Response:**
```json
{
  "success": true,
  "message": "Action deleted"
}
```

**Rate Limit:** 10 requests/minute (requires auth)

---

### Users

#### GET /api/users/me
Get current user's profile.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "avatar": "👤",
    "createdAt": "2026-02-22T00:00:00Z"
  }
}
```

#### PATCH /api/users/me
Update current user's profile.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "name": "Updated Name",
  "avatar": "https://example.com/avatar.png"
}
```

**Validation:**
- `name`: optional, 1-100 chars
- `avatar`: optional, must be http://, https://, or data: URI (max 500 chars)

**Rate Limit:** 20 requests/minute (requires auth)

---

#### GET /api/users/me/preferences
Get user preferences.

**Response:**
```json
{
  "theme": "dark",
  "notificationLevel": "all",
  "messagePreview": true,
  "soundEnabled": true,
  "timezone": "America/Los_Angeles",
  "language": "en",
  "channelNotifications": {
    "1": { "notificationLevel": "mentions" }
  },
  "updatedAt": "2026-02-26T21:00:00.000Z"
}
```

**Rate Limit:** 20 requests/minute (requires auth)

---

#### PATCH /api/users/me/preferences
Update user preferences.

**Request Body:**
```json
{
  "theme": "dark",
  "notificationLevel": "all",
  "messagePreview": true,
  "soundEnabled": true,
  "timezone": "America/Los_Angeles",
  "language": "en"
}
```

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| theme | string | `light`, `dark`, or `system` |
| notificationLevel | string | `all`, `mentions`, or `none` |
| messagePreview | boolean | Show message previews in notifications |
| soundEnabled | boolean | Play sound for notifications |
| timezone | string | User timezone (IANA format) |
| language | string | User language code (ISO 639-1, e.g., `en`, `es`, `en-US`) |
| channelNotifications | object | Per-channel notification overrides: `{ "channelId": "all" \| "mentions" \| "none" }` |

**Example with channel-specific notifications:**
```json
{
  "theme": "dark",
  "notificationLevel": "mentions",
  "channelNotifications": {
    "channel-123": "all",
    "channel-456": "none"
  }
}
```

**Rate Limit:** 20 requests/minute (requires auth)

---

#### GET /api/users/status
Get user presence status for all users or a specific user.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| userId | string | No | Filter by specific user |
| status | string | No | Filter by status (`online`, `offline`, `away`) |

**Response:**
```json
{
  "presences": [
    {
      "userId": "user-123",
      "status": "online",
      "platform": "web",
      "lastSeen": "2026-02-26T21:00:00Z"
    }
  ]
}
```

**Rate Limit:** 30 requests/minute (requires auth)

---

#### POST /api/users/status
Set user presence status.

**Request Body:**
```json
{
  "userId": "user-123",
  "status": "online",
  "platform": "web"
}
```

**Status values:** `online`, `offline`, `away`

**Platform values:** `web`, `whatsapp`, `mobile`

**Rate Limit:** 30 requests/minute (requires auth)

---

#### PATCH /api/users/status
Update user presence status (alternative to POST).

**Request Body:**
```json
{
  "status": "away",
  "platform": "mobile"
}
```

**Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| status | string | No | `online`, `offline`, or `away` |
| platform | string | No | `web`, `whatsapp`, or `mobile` |

**Response:**
```json
{
  "message": "Status updated successfully",
  "presence": {
    "userId": "user-123",
    "status": "away",
    "platform": "mobile",
    "lastSeen": "2026-03-03T10:30:00.000Z"
  }
}
```

**Rate Limit:** 30 requests/minute (requires auth)

---

### Reminders

#### GET /api/reminders
Get reminders for the authenticated user.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| channelId | string | - | Filter by channel ID |
| upcoming | string | - | Set to `true` to get all upcoming reminders |

**Response:**
```json
{
  "reminders": [
    {
      "id": "reminder-123",
      "userId": "user-1",
      "channelId": "channel-1",
      "messageId": "msg-456",
      "messagePreview": "Don't forget the meeting at 3pm",
      "remindAt": "2026-03-03T15:00:00.000Z",
      "createdAt": "2026-03-03T10:00:00.000Z"
    }
  ]
}
```

**Rate Limit:** 10 requests/minute (requires auth)

#### POST /api/reminders
Create a new reminder for a message.

**Request Body:**
```json
{
  "channelId": "channel-1",
  "messageId": "msg-456",
  "remindAt": "2026-03-03T15:00:00.000Z"
}
```

**Validation:**
- `channelId`: required, must be a valid channel ID
- `messageId`: required, must be a valid message ID
- `remindAt`: required, must be a future ISO 8601 timestamp

**Response:**
```json
{
  "reminder": {
    "id": "reminder-123",
    "userId": "user-1",
    "channelId": "channel-1",
    "messageId": "msg-456",
    "messagePreview": "Don't forget the meeting at 3pm",
    "remindAt": "2026-03-03T15:00:00.000Z",
    "createdAt": "2026-03-03T10:00:00.000Z"
  }
}
```

**Rate Limit:** 10 requests/minute (requires auth)

#### DELETE /api/reminders/[id]
Delete a reminder.

**Response:**
```json
{
  "success": true
}
```

**Rate Limit:** 10 requests/minute (requires auth)

---

### Metrics

#### GET /api/metrics
Get server metrics including uptime, request counts, performance, WebSocket, and WhatsApp statistics.

**Response:**
```json
{
  "uptime": {
    "seconds": 3600,
    "human": "60m 0s"
  },
  "requests": 1500,
  "messages": 3200,
  "channels": 45,
  "users": 28,
  "errors": 3,
  "authFailures": 12,
  "validationFailures": 5,
  "performance": {
    "avgResponseTime": 45.2,
    "slowestResponseTime": 320,
    "fastestResponseTime": 5
  },
  "websocket": {
    "connections": 12,
    "messages": 8500
  },
  "whatsapp": {
    "received": 450,
    "sent": 380
  }
}
```

**Note:** This endpoint does not require authentication (for monitoring/health checks).

---

## Authentication

### Production
Production endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

### Development
Local development allows unauthenticated access. Set `NODE_ENV=production` to enforce auth.

---

## Rate Limiting

| Endpoint Type | Limit |
|---------------|-------|
| Write operations (POST, DELETE) | 10 req/min |
| Read operations (GET) | 60 req/min |

Rate limit headers included in response:
- `Retry-After`: Seconds until rate limit resets

---

## WebSocket Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `auth` | `{ user: { id, name, avatar } }` | Authenticate connection |
| `join_channel` | `{ channelId }` | Join a channel |
| `leave_channel` | `{ channelId }` | Leave a channel |
| `send_message` | `{ channelId, content, author }` | Send a message |
| `typing` | `{ channelId, userId, isTyping }` | Typing indicator |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `message` | `Message` | New message received |
| `message_history` | `Message[]` | Channel message history |
| `message_edited` | `Message` | Message was edited |
| `message_deleted` | `{ id: string }` | Message was deleted |
| `message_pinned` | `Message` | Message was pinned |
| `message_unpinned` | `Message` | Message was unpinned |
| `typing` | `{ userId, isTyping }` | User typing status |
| `user_joined` | `{ socketId }` | User joined channel |
| `user_left` | `{ socketId }` | User left channel |

---

### Editing & Deleting via Socket

Clients can also edit/delete messages directly through the socket:

**edit_message:**
```typescript
socket.emit('edit_message', { id: 'message-id', content: 'New content' }, (response) => {
  if (response.success) {
    console.log('Message edited:', response.message);
  }
});
```

**delete_message:**
```typescript
socket.emit('delete_message', { id: 'message-id' }, (response) => {
  if (response.success) {
    console.log('Message deleted');
  }
});
```

---

## Client SDK

Import the socket client utilities:
```typescript
import { 
  connectSocket, 
  disconnectSocket, 
  sendMessage, 
  onMessage,
  authenticateSocket
} from '@/lib/socket';
```

---

## Database Setup

### Running Migrations

1. Open Supabase Dashboard → SQL Editor
2. Copy and run the migration files from `supabase/migrations/`

**Required: Create users table for authentication:**
```sql
-- Run: supabase/migrations/001_create_users_table.sql

-- Users table for authentication
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
CREATE POLICY "Public read users" ON users FOR SELECT USING (true);
```

### Initial Schema

Run `supabase/schema.sql` first to create channels, messages, bots tables.

---

## Workspace API

Manage workspaces/teams for collaboration.

### GET /api/workspaces
List all workspaces or user's workspaces.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| userOnly | boolean | false | Return only workspaces the user is a member of |

**Response:**
```json
{
  "id": "ws-123",
  "name": "Engineering Team",
  "type": "team",
  "description": "Team workspace",
  "ownerId": "user-123",
  "memberCount": 5,
  "createdAt": "2026-03-03T00:00:00Z",
  "settings": {
    "allowGuestAccess": true,
    "defaultRole": "member",
    "maxMembers": 50
  }
}
```

**Rate Limit:** 60 requests/minute

### POST /api/workspaces
Create a new workspace.

**Request Body:**
```json
{
  "name": "New Workspace",
  "type": "team",
  "description": "Optional description"
}
```

**Workspace Types:**
- `personal` - Single user workspace (max 1 member)
- `team` - Team workspace (max 50 members)
- `organization` - Organization workspace (max 50 members)

**Response:** Returns created workspace with 201 status.

**Rate Limit:** 5 requests/minute (requires auth)

### GET /api/workspaces/[id]
Get workspace details with members.

**Response:**
```json
{
  "id": "ws-123",
  "name": "Engineering Team",
  "type": "team",
  "description": "Team workspace",
  "ownerId": "user-123",
  "createdAt": "2026-03-03T00:00:00Z",
  "settings": { ... },
  "members": [
    { "workspaceId": "ws-123", "userId": "user-123", "role": "owner", "joinedAt": "..." }
  ]
}
```

**Rate Limit:** 60 requests/minute

### PUT /api/workspaces/[id]
Update workspace (owner/admin only).

**Request Body:**
```json
{
  "name": "New Name",
  "description": "New description",
  "settings": {
    "allowGuestAccess": true
  }
}
```

**Rate Limit:** 10 requests/minute

### DELETE /api/workspaces/[id]
Delete workspace (owner only).

**Rate Limit:** 10 requests/minute

### GET /api/workspaces/[id]/members
List workspace members and pending invitations.

**Response:**
```json
{
  "members": [
    { "workspaceId": "ws-123", "userId": "user-123", "role": "owner", "joinedAt": "..." }
  ],
  "invitations": [
    { "id": "inv-123", "email": "user@example.com", "role": "member", "expiresAt": "..." }
  ]
}
```

**Rate Limit:** 60 requests/minute

### POST /api/workspaces/[id]/members
Add member or invite by email.

**Request Body:**
```json
{
  "userId": "user-456",
  "email": "user@example.com",
  "role": "member"
}
```

**Rate Limit:** 10 requests/minute

### DELETE /api/workspaces/[id]/members
Remove member from workspace.

**Request Body:**
```json
{
  "userId": "user-456"
}
```

**Rate Limit:** 10 requests/minute

### PATCH /api/workspaces/[id]/members/[userId]
Update member role.

**Request Body:**
```json
{
  "role": "admin"
}
```

**Rate Limit:** 10 requests/minute

### GET /api/workspaces/[id]/permissions
Get user permissions for a workspace.

**Response:**
```json
{
  "canView": true,
  "canManage": true,
  "canDeleteWorkspace": false,
  "canUpdateWorkspace": true,
  "canInviteUsers": true,
  "canRemoveMembers": false,
  "canUpdateMemberRoles": false,
  "canCreateChannels": true,
  "canDeleteChannels": false,
  "canEditChannels": true,
  "canManageBots": false,
  "canManageCategories": true,
  "role": "admin"
}
```

**Permission Fields:**
| Field | Description |
|-------|-------------|
| canView | User can view the workspace |
| canManage | User has full management access |
| canDeleteWorkspace | User can delete the workspace |
| canUpdateWorkspace | User can update workspace settings |
| canInviteUsers | User can invite new members |
| canRemoveMembers | User can remove members |
| canUpdateMemberRoles | User can change member roles |
| canCreateChannels | User can create new channels |
| canDeleteChannels | User can delete channels |
| canEditChannels | User can edit channel settings |
| canManageBots | User can manage bots |
| canManageCategories | User can manage categories |
| role | User's role in the workspace (owner, admin, member, guest) |

**Rate Limit:** 30 requests/minute

### GET /api/workspaces/[id]/categories
List all channel categories in a workspace.

**Response:**
```json
{
  "categories": [
    {
      "id": "cat-123",
      "name": "Engineering",
      "workspaceId": "ws-123",
      "order": 0,
      "isCollapsed": false
    }
  ]
}
```

**Rate Limit:** 60 requests/minute

### POST /api/workspaces/[id]/categories
Create a new channel category (owner/admin only).

**Request Body:**
```json
{
  "name": "Engineering",
  "order": 0,
  "isCollapsed": false
}
```

**Validation:**
- `name`: required, 1-50 characters
- `order`: optional, number for sorting
- `isCollapsed`: optional, boolean

**Response:** Returns created category with 201 status.

**Rate Limit:** 10 requests/minute (requires auth)

### GET /api/workspaces/[id]/categories/[categoryId]
Get a specific category by ID.

**Response:**
```json
{
  "id": "cat-123",
  "name": "Engineering",
  "workspaceId": "ws-123",
  "order": 0,
  "isCollapsed": false
}
```

**Rate Limit:** 60 requests/minute

### PUT /api/workspaces/[id]/categories/[categoryId]
Update a category (owner/admin only).

**Request Body:**
```json
{
  "name": "Engineering Updates",
  "order": 1,
  "isCollapsed": true
}
```

**Rate Limit:** 10 requests/minute (requires auth)

### DELETE /api/workspaces/[id]/categories/[categoryId]
Delete a category (owner/admin only). Channels in this category become uncategorized.

**Rate Limit:** 10 requests/minute (requires auth)

### GET /api/workspaces/[id]/permissions
Get user's permissions in a workspace.

**Response:**
```json
{
  "canView": true,
  "canManage": true,
  "canDeleteWorkspace": false,
  "canUpdateWorkspace": true,
  "canInviteUsers": true,
  "canRemoveMembers": true,
  "canUpdateMemberRoles": true,
  "canCreateChannels": true,
  "canDeleteChannels": true,
  "canEditChannels": true,
  "canManageBots": true,
  "canManageCategories": true,
  "role": "admin"
}
```

**Role Hierarchy:** owner > admin > member > guest

- **Owner**: All permissions including delete workspace
- **Admin**: Manage, invite, remove, create channels, manage bots/categories
- **Member**: View, create channels
- **Guest**: View only

**Rate Limit:** 60 requests/minute (requires auth)

#### POST /api/workspaces/invitations/[token]/accept
Accept a workspace invitation using a token.

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| token | string | The invitation token from the invitation link |

**Request Body:** (empty, uses authenticated user)

**Response:**
```json
{
  "success": true,
  "workspace": {
    "id": "workspace-123",
    "name": "My Workspace",
    "type": "team",
    "description": "A team workspace",
    "createdAt": "2026-03-01T10:00:00.000Z"
  },
  "member": {
    "userId": "user-1",
    "role": "member",
    "joinedAt": "2026-03-03T10:00:00.000Z"
  }
}
```

**Validation:**
- Token must be valid and not expired
- User must be authenticated
- Invitation must not have already been accepted

**Error Responses:**
- `404`: Invitation not found or already accepted
- `400`: Invitation has expired

**Rate Limit:** 10 requests/minute (requires auth)

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_SOCKET_URL` | WebSocket server URL (default: ws://localhost:3001) |
| `OPENCLAW_GATEWAY_URL` | OpenClaw gateway URL |
| `OPENCLAW_GATEWAY_TOKEN` | OpenClaw API token |
| `JWT_SECRET` | Secret for JWT signing (required in production) |
| `JWT_EXPIRES_IN` | JWT token expiration (default: 24h, e.g., 7d, 1h, 30m) |
| `JWT_EXPIRY` | JWT token expiration for server auth (alias for JWT_EXPIRES_IN) |
| `REQUIRE_AUTH` | Set to 'true' to require auth in development |
| `NODE_ENV` | Set to 'production' to enable production auth |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |
| `PORT` | Server port (default: 3001 for socket server) |
| `SOCKET_URL` | Socket server URL for broadcasting (default: http://localhost:3001) |
| `INTERNAL_API_KEY` | Internal API key for socket broadcasting |
| `WHATSAPP_VERIFY_TOKEN` | WhatsApp webhook verification token |

---

### WhatsApp Integration

#### GET /api/whatsapp
WhatsApp webhook verification (GET request from WhatsApp).

**Query Parameters:**
| Parameter | Description |
|-----------|-------------|
| hub.mode | Must be "subscribe" |
| hub.challenge | Verification challenge string |
| hub.verify_token | Verification token |

**Response:** Returns the hub.challenge string on success.

**Notes:** Set `WHATSAPP_VERIFY_TOKEN` environment variable for production.

#### POST /api/whatsapp
Receive messages from WhatsApp via OpenClaw.

**Request Body:**
```json
{
  "from": "+1234567890",
  "messages": [
    {
      "type": "text",
      "text": "Hello team!"
    }
  ]
}
```

**Supported Message Types:**
- `text` - Text messages
- `image` - Image with optional caption
- `audio` - Audio messages
- `video` - Video with optional caption
- `document` - Documents with optional caption
- `location` - Location coordinates
- `reaction` - Message reactions

**Channel Routing:**
- Messages with `#channel-name` mention route to that channel
- Default: `#general` channel

**User Creation:**
- WhatsApp users are automatically created in Colony
- Display format: `WhatsApp (+1 2345 67890)`

**Response:**
```json
{
  "success": true,
  "message": {
    "id": "msg-123",
    "content": "Hello team!",
    "channel": "general",
    "author": { "name": "WhatsApp (+1 2345 67890)", "avatar": "..." },
    "timestamp": "2026-02-26T12:00:00Z"
  }
}
```

**Real-time:** WhatsApp messages are broadcast to connected Colony clients via WebSocket.

**Rate Limit:** 30 requests/minute

---

#### WhatsApp Channel Mapping API

Manage Colony channel to WhatsApp group mappings for bidirectional sync.

##### GET /api/whatsapp/channels
List all WhatsApp channel mappings.

**Response:**
```json
{
  "channels": [
    {
      "id": "map-123",
      "colonyChannelId": "1",
      "colonyChannelName": "engineering",
      "whatsappGroupId": "group-456",
      "whatsappGroupName": "Engineering Team",
      "notificationRule": "all",
      "createdAt": "2026-02-26T12:00:00Z"
    }
  ]
}
```

**Rate Limit:** 30 requests/minute (requires auth in production)

##### POST /api/whatsapp/channels
Create a new WhatsApp channel mapping.

**Request Body:**
```json
{
  "colonyChannelId": "1",
  "whatsappGroupId": "group-456",
  "whatsappGroupName": "Engineering Team",
  "notificationRule": "all"
}
```

**Notification Rules:**
- `all` - Always sync messages
- `mentions` - Only sync when @mentions are used
- `silent` - Sync without notifications
- `off` - Disable sync

**Response:**
```json
{
  "success": true,
  "channel": {
    "id": "map-123",
    "colonyChannelId": "1",
    "whatsappGroupId": "group-456",
    "notificationRule": "all"
  }
}
```

**Rate Limit:** 30 requests/minute (requires auth in production)

##### PUT /api/whatsapp/channels/[id]
Update a WhatsApp channel mapping.

**Request Body:**
```json
{
  "notificationRule": "mentions"
}
```

**Rate Limit:** 30 requests/minute (requires auth in production)

##### DELETE /api/whatsapp/channels/[id]
Delete a WhatsApp channel mapping.

**Response:**
```json
{
  "success": true
}
```

**Rate Limit:** 30 requests/minute (requires auth in production)

---

#### WhatsApp Outbound (Colony → WhatsApp)

Colony automatically sends messages to mapped WhatsApp groups when:
1. A message is posted to a channel with an active WhatsApp mapping
2. The notification rule allows the message (based on `all`/`mentions`/`silent`/`off`)

Messages are sent asynchronously and queued for retry if the WhatsApp API fails.

**Environment Variables:**
| Variable | Description |
|----------|-------------|
| WHATSAPP_BUSINESS_API_URL | WhatsApp Business API URL |
| WHATSAPP_BUSINESS_TOKEN | WhatsApp Business API token |
| WHATSAPP_PHONE_NUMBER_ID | WhatsApp phone number ID |

---

### Agent Actions API

Manage events, tasks, and polls created by AI agents.

#### GET /api/agent-actions
Get all agent actions, optionally filtered.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| channelId | string | - | Filter by channel ID |
| type | string | - | Filter by type: event, task, poll |
| limit | number | 50 | Max results (max 100) |
| offset | number | 0 | Pagination offset |

**Response:**
```json
{
  "actions": [
    {
      "id": "action-123",
      "type": "task",
      "title": "Review PR",
      "description": "Review the new feature PR",
      "assignee": "john",
      "dueDate": "2026-03-05",
      "priority": "high",
      "status": "pending",
      "channelId": "1",
      "createdBy": "AI Agent",
      "createdAt": "2026-03-03T09:00:00Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

**Rate Limit:** 30 requests/minute

#### POST /api/agent-actions
Create a new agent action (event, task, or poll).

**Headers:** Requires authentication (JWT)

**Request Body:**
```json
{
  "actionType": "task",
  "title": "Review PR",
  "description": "Review the new feature PR",
  "channelId": "1",
  "assignee": "john",
  "dueDate": "2026-03-05",
  "priority": "high"
}
```

**Action Types:**

**Event:**
```json
{
  "actionType": "event",
  "title": "Team Meeting",
  "description": "Weekly standup",
  "channelId": "1",
  "startTime": "2026-03-03T10:00:00Z",
  "endTime": "2026-03-03T11:00:00Z",
  "location": "Conference Room A"
}
```

**Task:**
```json
{
  "actionType": "task",
  "title": "Review PR",
  "channelId": "1",
  "assignee": "john",
  "dueDate": "2026-03-05",
  "priority": "high"
}
```

**Poll:**
```json
{
  "actionType": "poll",
  "title": "Lunch Options",
  "channelId": "1",
  "question": "Where should we eat?",
  "options": ["Italian", "Mexican", "Sushi", "Thai"],
  "multipleChoice": false,
  "expiresAt": "2026-03-03T12:00:00Z"
}
```

**Response:** Returns created action with 201 status.

**Rate Limit:** 10 requests/minute (requires auth)

#### PATCH /api/agent-actions
Update an action (vote on poll, update task status).

**Headers:** Requires authentication (JWT)

**Request Body - Vote on Poll:**
```json
{
  "actionId": "action-123",
  "action": "vote",
  "data": {
    "optionId": "option-0"
  }
}
```

**Request Body - Update Task Status:**
```json
{
  "actionId": "action-123",
  "action": "updateStatus",
  "data": {
    "status": "completed"
  }
}
```

**Request Body - Update Task:**
```json
{
  "actionId": "action-123",
  "action": "updateTask",
  "data": {
    "title": "New Title",
    "assignee": "jane",
    "priority": "low"
  }
}
```

**Rate Limit:** 20 requests/minute (requires auth)

#### DELETE /api/agent-actions
Delete an action.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| actionId | string | Yes | ID of action to delete |

**Headers:** Requires authentication (JWT)

**Response:**
```json
{
  "success": true,
  "message": "Action deleted"
}
```

**Rate Limit:** 10 requests/minute (requires auth)
