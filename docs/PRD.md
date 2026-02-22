# Colony - Product Requirements Document

## Overview

**Project Name:** Colony  
**Type:** Real-time messaging web application (PWA)  
**Tagline:** Bot-first team messaging where AI agents and humans collaborate  
**Target Users:** Small to medium teams who want integrated AI agents in their daily workflow  
**Launch Goal:** MVP within 2-3 weeks

---

## Problem Statement

1. **Slack/Teams bot setup is painful** — Requires complex OAuth flows, custom code, and DevOps knowledge
2. **AI agents are siloed** — Separate tools for ChatGPT, Claude, CodeAssist, etc.
3. **No unified collaboration** — Humans and AI agents work in separate worlds

---

## Solution

Colony is a Slack alternative where:
- **Bots are first-class citizens** — Built-in bot framework, no complex setup
- **Multiple agents in one chat** — Humans + multiple AI agents working together
- **Simple bot creation** — Point a bot at an API, give it instructions, it's live
- **Mobile-first PWA** — Works on phone like native app

---

## Core Features

### Phase 1 (MVP)

| Feature | Description | Priority |
|---------|-------------|----------|
| Real-time messaging | Socket.io powered instant messages | P0 |
| Channels | Public channels for team communication | P0 |
| Bot presence | Show bots in sidebar with online status | P0 |
| Bot messages | Bots can send messages to channels | P0 |
| Human + bot chat | Both can interact in same channel | P0 |
| Mobile responsive | Works on phone browser | P1 |

### Phase 2

| Feature | Description | Priority |
|---------|-------------|----------|
| Direct messages | 1:1 messages between users | P2 |
| Bot API config | UI to configure bot behavior | P2 |
| Message reactions | Emoji reactions on messages | P2 |
| Thread replies | Thread conversations | P2 |

### Phase 3+

- Voice/video integration
- Bot-to-bot communication
- Custom bot prompts via UI
- File sharing

---

## User Stories

### As a user, I can:
1. Join a channel and see all messages in real-time
2. Send messages that appear instantly for everyone in the channel
3. See which bots are online and what they can do
4. Add a bot to a channel and have it respond to queries
5. Use the app on my phone with a native-like experience

### As a bot developer, I can:
1. Create a bot with a name, description, and avatar
2. Define what API/capabilities the bot has
3. Add the bot to a channel and it starts responding
4. Update bot behavior without redeploying code

---

## Success Metrics

- [ ] < 100ms message delivery latency
- [ ] 3+ bots can run simultaneously in a channel
- [ ] Mobile Lighthouse score > 90
- [ ] Core flow testable in < 5 minutes

---

## Competitive Landscape

| Competitor | Bot Experience | Setup Time | Our Edge |
|------------|---------------|------------|----------|
| Slack | Complex OAuth + code | Hours-days | No-code bot config |
| Discord | Developer-focused | Hours | Simpler, AI-first |
| Teams | Enterprise OAuth | Days | Faster, mobile-first |

---

## Open Questions

1. How do bots authenticate? (API keys, OAuth, etc.)
2. What LLM provider to use for chat bots?
3. Self-host or SaaS?
4. Should bots be user-controlled or admin-controlled?

---

**Document Status:** Draft  
**Last Updated:** 2026-02-20  
**Owner:** Vincent (Product Owner), Rei (PM)
