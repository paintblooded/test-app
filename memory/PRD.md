# SONARA — Product Requirements Document

## Vision
SONARA is a music collaboration & opportunity discovery mobile app. It's activity-first, collaboration-first, and event-driven — built specifically for musicians (NOT a dating app, NOT generic social).

The app helps musicians discover and act on opportunities: jam sessions, gigs, band members, producers, projects, auditions, and local music communities.

Aesthetic: Spotify × Discord × Airbnb — dark mode, neon accents (purple/green/blue), glassmorphism, mobile-first.

## Stack
- **Frontend:** Expo SDK 54 + React Native + TypeScript + expo-router (file-based)
- **Backend:** FastAPI (Python) + MongoDB (motor) + WebSockets
- **Auth:** Emergent-managed Google OAuth + Bearer session tokens (7-day TTL)
- **Realtime:** Native WebSocket at `/api/ws?token=...` (typing, message broadcast, read receipts)
- **Storage:** Base64 for media (audio/image) in MongoDB

## Implemented Features (MVP+)

### Auth & Onboarding
- Emergent Google OAuth (mobile + web flows per playbook)
- Cold-start deep link handling, secure-store token persistence
- 5-step onboarding: role → skill → genres → portfolio links + city + bio → goals
- Dev test-login bypass (`/api/dev/test-login`) for automation

### Home Feed
- Featured event hero, Nearby Events carousel, Trending Musicians, Open Projects, Online Collaborations
- Personalized scoring by city + shared genres
- Live unread notifications badge

### Discover
- Tabs: Musicians, Bands, Projects, Events
- Search (debounced), genre filter chips, compatibility % calculation
- Direct entry to Swipe Match from Discover & Home

### Swipe Match
- Vampr-style swipe deck (likes/passes persisted)
- Mutual like → instant match + chat creation + push-style notification

### Events
- Create (Jam Session / Open Audition / Producer Meetup / Open Mic / Online Collab)
- Cover image, genres, needed roles, date/time, participant limit, online toggle
- Join/leave, approval queue, waitlist, host approve flow
- Message host CTA, participant grid

### Projects (Workspace)
- Cover, genres, needed roles, members
- Tabs: Overview / Tasks / Files
- Task board (todo/done toggle), notes, member management

### Chat
- Realtime WebSocket-backed thread
- Typing indicator, read receipts
- Text, audio (base64), event/project invite payloads (extensible)

### Profile
- Banner + avatar, role/skill/genres/goals, bio, portfolio links
- Reliability score, events joined/hosted, average rating
- Verified badge, get-verified flow

### Verification & Reputation
- Submit Spotify/SoundCloud/YouTube/performance video for admin approval
- Ratings (1–5) → reliability score recompute
- Trusted badge upon admin approval

### Admin Console
- Analytics (users/events/projects/matches/messages/genre popularity/top cities)
- User moderation (ban/unban)
- Reports queue + resolve
- Verifications queue + approve/reject
- Visible only to `is_admin: true` users

### Notifications
- Real-time push via WebSocket
- Deep links to chat/event/project from each notification
- Mark all read

### Moderation
- Report user/event/message endpoint
- Admin resolve workflow
- Ban flag enforced at session lookup

## Data Model (MongoDB Collections)
- `users` (user_id PK, email unique, profile, reliability_score, is_admin, banned)
- `user_sessions` (session_token PK, user_id, expires_at — TTL indexed)
- `events` (event_id PK, host_id, participants, waitlist, pending, status)
- `projects` (project_id PK, owner_id, members, tasks[], files[])
- `swipes` (compound unique on user_id+target_id)
- `matches` (user_ids[], chat_id)
- `chats` (chat_id, participant_ids, last_message)
- `messages` (chat_id, sender_id, type, content, read_by[])
- `notifications` (user_id, type, read, data)
- `ratings`, `reports`, `verifications`

## Test Coverage
- 39/39 backend pytest cases passing (see `/app/test_reports/pytest/pytest_results.xml`)
- Frontend smoke pass via Playwright (splash, onboarding, tabs, profile)

## Smart Business Enhancement
**Reliability-based discovery boost**: Musicians with reliability ≥ 90 are
ranked higher in feed and swipe deck — turning attendance into a growth
loop and giving Pro users a tangible reason to maintain their score
(future monetization hook for boosted visibility / event tickets).

## Out of Scope (Per PRD)
- Livestreaming, real-time DAW collaboration, AI music generation, NFT/blockchain, advanced audio editing.
