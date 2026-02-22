# Colony - Design Specification

## Brand

**Name:** Colony  
**Meaning:** A community where humans and AI agents work together (like a bee colony)  
**Emoji:** 🐜  
**Primary Color:** `#8B5E3C` (warm brown - matches LahLingo)

---

## Color Palette

### Light Mode
| Token | Hex | Usage |
|-------|-----|-------|
| `--brand-primary` | `#8B5E3C` | Primary buttons, links, bot badges |
| `--brand-primary-dark` | `#7A5233` | Hover states |
| `--brand-primary-light` | `#A67B5B` | Subtle highlights |
| `--bg-primary` | `#FAFAF8` | Page background |
| `--bg-secondary` | `#FFFFFF` | Cards, inputs |
| `--bg-tertiary` | `#F5F3EF` | Hover states, dividers |
| `--text-primary` | `#1A1816` | Headings, body |
| `--text-secondary` | `#4A4743` | Secondary text |
| `--text-muted` | `#8A8680` | Timestamps, hints |
| `--border-color` | `#E5E2DB` | Borders, dividers |

### Dark Mode
| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-primary` | `#1A1816` | Page background |
| `--bg-secondary` | `#262320` | Cards, inputs |
| `--bg-tertiary` | `#2A2825` | Hover states |
| `--text-primary` | `#FAFAF8` | Headings, body |
| `--text-secondary` | `#D4D0C8` | Secondary text |
| `--text-muted` | `#8A8680` | Timestamps, hints |
| `--border-color` | `#3D3A35` | Borders, dividers |

---

## Typography

**Font Family:** Inter (system fallback: -apple-system, Segoe UI, Roboto)

| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| H1 (App title) | 24px | 700 | 1.2 |
| H2 (Channel name) | 20px | 600 | 1.3 |
| H3 (Section) | 16px | 600 | 1.4 |
| Body | 15px | 400 | 1.5 |
| Small | 13px | 400 | 1.4 |
| Caption | 11px | 500 | 1.3 |

---

## Spacing System

Based on 4px grid:

| Token | Value |
|-------|-------|
| `--space-xs` | 4px |
| `--space-sm` | 8px |
| `--space-md` | 16px |
| `--space-lg` | 24px |
| `--space-xl` | 32px |
| `--space-2xl` | 48px |

---

## Layout

### Desktop (≥1024px)
```
┌──────────┬─────────────────────────────────────┐
│ Sidebar  │  Header (channel name)               │
│ 240px    ├─────────────────────────────────────┤
│          │                                     │
│ Channels │  Messages (scrollable)              │
│ Bots     │                                     │
│          │                                     │
│          ├─────────────────────────────────────┤
│          │  Input (message composer)           │
└──────────┴─────────────────────────────────────┘
```

### Mobile (<768px)
```
┌─────────────────────┐
│ Header              │
├─────────────────────┤
│                     │
│ Messages            │
│ (full width)       │
│                     │
├─────────────────────┤
│ Input               │
└─────────────────────┘
```

Sidebar becomes a drawer/overlay on mobile.

---

## Components

### Buttons

**Primary Button**
- Background: `--brand-primary`
- Text: white
- Border-radius: 12px (rounded-xl)
- Height: 48px
- Padding: 24px horizontal
- Hover: darken 10%, slight scale (0.98)
- Active: scale (0.96)
- Shadow: subtle drop shadow

**Secondary Button**
- Background: transparent
- Border: 2px solid `--border-color`
- Border-radius: 12px
- Hover: `--bg-tertiary` background

**Ghost Button**
- No background
- Text: `--text-muted`
- Hover: `--bg-tertiary` background

### Message Bubble

```
┌─────────────────────────────────────┐
│ [Avatar] Username  BOT  12:30 PM    │
│ Message content goes here...        │
│                                     │
│ [Reply] [React]                     │
└─────────────────────────────────────┘
```

- Bot messages: Brand color badge "BOT"
- Avatar: 40px rounded square
- Spacing between messages: 16px
- Group consecutive messages from same user

### Channel List Item

```
# general  General discussion
```

- Active: Brand background, white text
- Hover: Tertiary background
- Unread indicator: Brand dot

### Bot List Item

```
[Avatar] Bot Name        ●
         Description
```

- Online indicator: Green dot (8px)
- Offline: Gray dot
- Hover: Slight elevation

### Input Field

```
┌─────────────────────────────────────┐
│ Type a message...              [Send] │
└─────────────────────────────────────┘
```

- Height: 48px
- Border: 2px solid `--border-color`
- Focus: Brand border, subtle brand ring
- Border-radius: 12px
- Send button: Primary button style

---

## Animations

| Animation | Duration | Easing | Usage |
|-----------|----------|--------|-------|
| fade-in | 300ms | ease-out | New messages |
| slide-up | 400ms | ease-out | List items |
| scale-in | 300ms | ease-out | Modals |
| pulse | 2s | ease-in-out | Loading states |

### Staggered List Load
When loading channels/messages, stagger each item by 50ms for a polished feel.

---

## Accessibility

- All buttons have `focus-visible` ring (brand color)
- Minimum touch target: 44x44px
- Color contrast ratio: ≥4.5:1 for text
- Screen reader labels on icons
- Keyboard navigation support

---

## Mobile Considerations

- Touch targets: 44px minimum
- Bottom navigation for primary actions
- Pull-to-refresh for messages
- KeyboardAvoidingView for input
- Safe area insets respected
- PWA manifest for "Add to Home Screen"

---

## PWA Requirements

```json
{
  "name": "Colony",
  "short_name": "Colony",
  "theme_color": "#8B5E3C",
  "background_color": "#FAFAF8",
  "display": "standalone",
  "orientation": "portrait-primary"
}
```

---

**Last Updated:** 2026-02-20
