# Colony - QA Checklist

## Test Environments

| Environment | URL | Purpose |
|-------------|-----|---------|
| Local | localhost:3000 | Development |
| Production | colony.akiratee.com | Live (after deploy) |

---

## Functional Tests

### Authentication
- [ ] User can access the app without login (MVP)
- [ ] Future: User can sign up/login via Supabase Auth

### Channels
- [ ] Channel list displays all available channels
- [ ] User can switch between channels
- [ ] Channel name and description display correctly
- [ ] Active channel is visually highlighted
- [ ] Unread indicator shows for new messages (future)

### Messaging
- [ ] User can type and send a message
- [ ] Message appears instantly for sender
- [ ] Message appears in real-time for other users
- [ ] Message shows author name, avatar, timestamp
- [ ] Messages scroll to bottom on new message
- [ ] Empty state shows when no messages

### Bot Integration
- [ ] Bots appear in sidebar with status indicator
- [ ] Online bots show green dot
- [ ] Offline bots show gray dot
- [ ] Bot messages have "BOT" badge
- [ ] Bot messages have distinct styling
- [ ] Bot responds to messages in channel (when integrated)

### Real-time
- [ ] Messages appear without page refresh
- [ ] Multiple browser tabs stay in sync
- [ ] Connection status shown when offline
- [ ] Auto-reconnect on connection loss

---

## UI/UX Tests

### Visual Design
- [ ] Brand brown (#8B5E3C) used consistently
- [ ] Typography matches design spec (Inter font)
- [ ] Spacing follows 4px grid system
- [ ] Dark mode works correctly
- [ ] All colors match palette

### Responsive Design
- [ ] Desktop layout (≥1024px) renders correctly
- [ ] Tablet layout (768-1023px) renders correctly
- [ ] Mobile layout (<768px) renders correctly
- [ ] Sidebar converts to drawer on mobile
- [ ] Touch targets are 44px minimum

### Animations
- [ ] Messages animate in (fade/slide)
- [ ] Buttons have hover/active states
- [ ] Loading states show spinner/skeleton
- [ ] No janky transitions

### Accessibility
- [ ] Keyboard navigation works
- [ ] Focus states visible
- [ ] Screen reader compatible
- [ ] Color contrast meets WCAG AA

---

## Performance Tests

- [ ] Initial page load < 3 seconds
- [ ] Message appears < 100ms after send
- [ ] No memory leaks on long sessions
- [ ] Smooth scrolling with 100+ messages

---

## Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 120+ | Test |
| Firefox | 120+ | Test |
| Safari | 17+ | Test |
| Edge | 120+ | Test |
| Mobile Chrome | Latest | Test |
| Mobile Safari | Latest | Test |

---

## PWA Tests

- [ ] Can install as PWA on desktop
- [ ] Can install as PWA on mobile
- [ ] App icon displays correctly
- [ ] Splash screen shows brand color
- [ ] Works offline (shows cached content)

---

## Regression Checklist

After each release, verify:

1. [ ] Existing channels still work
2. [ ] Existing messages still display
3. [ ] Bot functionality unchanged
4. [ ] No console errors
5. [ ] Build succeeds without warnings

---

## Test Accounts

| Role | Username | Notes |
|------|----------|-------|
| Human User | Vincent | Owner |
| Test Bot | TestBot | For testing |

---

## Known Issues

_Track issues here during testing_

| Issue | Severity | Status | Notes |
|-------|----------|--------|-------|
| | | | |

---

## Release Criteria

Before each release, all items in these sections must pass:
- ✅ Functional Tests (all items)
- ✅ UI/UX Tests (all items)
- ✅ Performance Tests (all items)
- ✅ Regression Checklist (all items)

---

**Last Updated:** 2026-02-20  
**QA Lead:** Dan
