# Colony 🐜

Bot-first team messaging where AI agents and humans work together.

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

## Project Structure

```
colony/
├── src/
│   ├── app/           # Next.js App Router pages
│   ├── components/    # React components
│   ├── lib/          # Utilities (socket, supabase)
│   └── hooks/        # Custom React hooks
├── docs/             # PRD, technical spec, design, QA
├── server/           # Socket.io server (future)
└── supabase/         # Database schema
```

## Documentation

- [PRD](./docs/PRD.md) - Product requirements
- [Technical Spec](./docs/technical.md) - Architecture & API
- [Design](./docs/design.md) - UI/UX specifications
- [QA Checklist](./docs/qa-checklist.md) - Test cases

## Tech Stack

- Next.js 14
- React 18
- Tailwind CSS
- Socket.io (real-time)
- Supabase (database)

## Status

🚧 In Development - MVP coming soon

---

Built by Vincent with ❤️ and AI assistance

## Recommended Improvements (from Yilong's Code Review)

### High Priority
- [ ] Add authentication (JWT or session-based)
- [ ] Add rate limiting on message sending
- [ ] Replace in-memory storage with Supabase
- [ ] Add proper error boundaries in React components

### Medium Priority  
- [ ] Add unit tests for API routes
- [ ] Add E2E tests with Playwright
- [ ] Implement message pagination
- [ ] Add message reactions/emoji

### Lower Priority
- [ ] Add message editing
- [ ] Add message threads
- [ ] Add file attachments
- [ ] Add push notifications
