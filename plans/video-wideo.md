# Plan: Wspólniak Wideo — family video tab

> Source PRD: GitHub issue [#102](https://github.com/CrystalGamesStudio/wspolniak/issues/102). Full PRD: `plans/video-prd.md`.

## Architectural decisions

Durable decisions that apply across all phases:

- **Architecture style**: Cloudflare Workers — single Worker, existing `fetch` handler (`/api/*` → Hono, rest → TanStack Start SSR). Hono API for video endpoints + OAuth callback; TanStack Start for the `/video` tab and the admin connection screen. The Worker **proxies chunked uploads** to YouTube — the browser cannot upload directly to YouTube (no CORS on the upload endpoint), and the Worker's 100 MB request limit is respected by chunking.
- **Repo schema convention**: `text` primary keys (`crypto.randomUUID()` at insert), `timestamp` columns (not `uuid`/`timestamptz`), `snake_case` column names. This supersedes the illustrative schema shown in the PRD.
- **Data model**:
  - `videos` — `(id text PK, youtube_video_id text unique, title text, description text?, author_id text FK, thumbnail_url text, created_at timestamp)`.
  - `post_videos` — `(post_id text FK, video_id text FK, position int)` with a composite key `(post_id, video_id)`; `position` = order of addition to the post.
  - Instance settings (existing `instance` domain) — new columns: `youtube_channel_id text?`, `youtube_refresh_token text?` (encrypted), `youtube_connected_at timestamp?`, `youtube_connected_by text?`.
- **Key entities**: `videos`, `post_videos`; reused `posts` (via `post_videos`), `instance` (YouTube connection), `identity` (author/admin).
- **Deep modules**: `youtube` (integration — OAuth token exchange + refresh + at-rest encryption, resumable session initiation, chunk forwarding, video get/delete, channel discovery); `videos` (DB domain — CRUD + `countTodayUTC` limit + post attachment); API endpoints as thin wrappers; `useVideoUpload` (client chunked-upload hook).
- **Authz**: existing `authMiddleware`. Admin-only: OAuth connect/disconnect + delete-any. Author-or-admin: delete. Authenticated session: upload, feed, confirm. The OAuth callback resolves the single active admin.
- **OAuth**: Google OAuth2 with the app in **Production status** (unverified) → long-lived refresh token (no 7-day expiry). Admin clicks through the "unverified app" warning once; family members never see Google. Client id/secret are Worker env secrets; redirect URI = `${APP_URL}/api/video/oauth/callback` (must be registered in the Google Cloud Console).
- **Token storage**: refresh token **encrypted at rest** in instance settings (Web Crypto + an env key). Access token minted on demand from the refresh token (never stored).
- **Upload path**: browser splits the file into ≤ ~90 MB chunks → `POST /api/video/upload-session` (Worker checks the daily limit, mints an access token, starts the YouTube resumable session server-side) → `PUT /api/video/upload-chunk` per chunk (Worker forwards to the session URL, server-to-server, no CORS) → the final chunk returns `youtube_video_id` → `POST /api/video/confirm` (writes the Neon record + fetches the thumbnail). Per-chunk progress bar; supports 2 GB; zero cost (Workers bandwidth is free).
- **Daily limit**: 3 videos/day per instance, reset at **midnight UTC**. Enforced in `upload-session` (reject before any YouTube call) + a UI message.
- **Playback**: YouTube iframe embed (unlisted videos), responsive, mobile-first.
- **Two environments**: dev (`.dev.vars`) + production (`.production.vars`). Per-env Drizzle migrations (`src/db/migrations/dev`, `.../production`). The developer (syn) has no production secrets → production migration + deploy + real-YouTube verification is a manual HITL step for the admin (tata). Dev uses the developer's own Google project + a test channel.
- **Out of scope** (per PRD): comments, reactions, push on upload, in-app editing/trimming, multiple YouTube accounts, auto-expiry, downloading.

---

## Phase 1: YouTube connection (foundation)

**User stories**: 3, 12 (privacy setup).

### What to build

The foundation slice — nothing uploads without it. An admin opens a "YouTube" section in the admin panel, clicks "Connect YouTube", is redirected to Google OAuth (Production-status app), consents (clicking through the unverified-app warning), and the callback stores an encrypted refresh token + the discovered channel id in instance settings. The screen shows connection status (channel name) and a "Disconnect" action. The `youtube` module exposes `connectWithCode`, `refreshAccessToken`, and `getOwnChannel`; the instance migration adds the four YouTube columns. API: `GET /api/video/oauth/start`, `GET /api/video/oauth/callback`, connection status + disconnect (admin-only).

### Acceptance criteria

- [ ] Dev migration adds `youtube_channel_id`, `youtube_refresh_token` (encrypted), `youtube_connected_at`, `youtube_connected_by` to the instance settings.
- [ ] Admin can connect; after the OAuth round-trip the panel shows "Connected to <channel name>".
- [ ] The stored refresh token is encrypted at rest (not plaintext in the DB).
- [ ] `refreshAccessToken` returns a fresh access token from the stored refresh token (module test).
- [ ] Connect / status / disconnect endpoints are admin-only (403 for non-admin).
- [ ] Disconnect clears the connection fields.

---

## Phase 2: Upload a video end-to-end + daily limit

**User stories**: 1, 4, 5, 11 (and unlisted privacy 12).

### What to build

The core tracer bullet — a complete upload path through every layer. A family member picks a file + title (+ optional description); `useVideoUpload` splits it into ≤ ~90 MB chunks; the Worker checks the daily limit, mints an access token, and starts a YouTube resumable session; each chunk is forwarded server-to-server; the final chunk returns the `youtube_video_id`; `confirm` writes the `videos` record (unlisted) and fetches the thumbnail. After upload, the success view plays the video inline (iframe) — proving the upload→YouTube→playable pipeline. A visible per-chunk progress bar runs throughout. The daily limit of 3/day (UTC reset) is enforced in `upload-session` (before any YouTube call) and surfaced in the UI on the 4th attempt.

### Acceptance criteria

- [ ] Dev migration creates the `videos` table.
- [ ] A full file uploaded via chunked requests produces one playable **unlisted** video on YouTube.
- [ ] Progress bar advances per chunk; a 2 GB file completes (resumable).
- [ ] `POST /upload-session` rejects when the daily limit (3/day, UTC) is reached, before any YouTube call.
- [ ] `POST /confirm` writes the Neon record and returns the video with a thumbnail.
- [ ] `countTodayUTC()` returns the correct count for the limit window (domain test).
- [ ] API errors from YouTube (401/403/quota) map to typed errors, never leaked raw.
- [ ] Upload/confirm require an authenticated session.

---

## Phase 3: The `/video` feed (browse + play)

**User stories**: 2, 6.

### What to build

The browsable feed of all family videos, newest first: thumbnail + title + author + date, with pagination/infinite scroll. Clicking a video plays it inline via the YouTube iframe embed (the player component is reused from Phase 2). A server function/API lists videos with pagination; the route SSR-loads the first page.

### Acceptance criteria

- [ ] `/video` lists videos newest-first with thumbnail, title, author, date.
- [ ] Infinite scroll / pagination loads further pages.
- [ ] Clicking a video plays it inline (iframe), mobile-first responsive.
- [ ] An empty state is shown when there are no videos.

---

## Phase 4: Deletion (author + admin)

**User stories**: 9, 10.

### What to build

Author or admin can delete a video: the Neon record is removed AND the video is deleted from YouTube via the `youtube` module. `DELETE /api/video/:id` with authz (author or admin); UI delete button (own videos for members, any video for admin) with a confirmation dialog. The behavior when the YouTube delete fails is defined and surfaced in dispatch (e.g. record removed with a logged warning, or the operation fails atomically).

### Acceptance criteria

- [ ] Author can delete their own video; admin can delete any video.
- [ ] Deletion removes the Neon record and the YouTube video (confirmed not-found on YouTube).
- [ ] Non-author non-admin gets 403.
- [ ] A delete confirmation dialog prevents accidental removal.

---

## Phase 5: Post integration (attach + order)

**User stories**: 7, 8.

### What to build

Videos can be attached to posts in the main feed. A video picker in the post composer lets the author choose one or more existing videos from `/video`; they render in the post in the **order of addition** (`position`). A dev migration creates `post_videos` with `position`. The `videos` domain exposes attach + list-for-post; the SSR feed loader (from the perf work) loads videos for the posts being rendered. Post detail and feed cards render the attached players in position order.

### Acceptance criteria

- [ ] Dev migration creates `post_videos` with `position` and a composite key.
- [ ] Author can attach one or more videos to a post; they render in order of addition.
- [ ] The feed SSR loader loads attached videos for posts (no waterfall).
- [ ] Reordering / re-adding updates `position` consistently.

---

## Phase 6: Production deploy + prod migration (HITL)

**User stories**: all (production verification).

### What to build

Bring Wspólniak Wideo to production. Generate and apply the production DB migration (instance columns + `videos` + `post_videos`) via the production Drizzle config; configure production Worker env secrets (OAuth client id/secret, token encryption key, `APP_URL`/redirect URI registered in the Google Cloud Console). Deploy; verify end-to-end on production: admin connects the real family YouTube channel, uploads from a phone (iOS + Android), browses the feed, watches inline, deletes, and attaches to a post. This is a manual HITL step — the developer (syn) has no production secrets, so the admin (tata) drives migration + deploy + verification.

### Acceptance criteria

- [ ] Production migration applied; `videos`, `post_videos`, and the instance columns exist on production.
- [ ] Production Worker env has OAuth secrets + encryption key + the correct redirect URI.
- [ ] Admin connects the real YouTube channel; uploads succeed from iOS + Android.
- [ ] Videos are unlisted on production YouTube (not in search).
- [ ] Delete removes from both Neon and YouTube on production.
- [ ] Attached videos render in posts on the production feed.
- [ ] Quality gate: `pnpm types && pnpm test && pnpm lint` pass before ship.

---

## Sequence and dependencies

Recommended order is sequential and cumulative: 1 (connection) → 2 (upload + limit) → 3 (feed) → 4 (delete) → 5 (posts) → 6 (prod). Each phase is independently demoable. Phase 1 is a hard prerequisite for all upload/playback; Phase 4 only strictly needs Phase 2 (can run in parallel with Phase 3). Phase 6 returns to issue #102 (closed after production ship + user testing).

## Tasks (GitHub issues)

| Phase | Sub-issue | Type | Blocked by |
|------|-----------|------|------------|
| F1 — YouTube connection (foundation) | [#103](https://github.com/CrystalGamesStudio/wspolniak/issues/103) | AFK | — |
| F2 — upload + daily limit | [#104](https://github.com/CrystalGamesStudio/wspolniak/issues/104) | AFK | #103 |
| F3 — `/video` feed | [#105](https://github.com/CrystalGamesStudio/wspolniak/issues/105) | AFK | #104 |
| F4 — deletion | [#106](https://github.com/CrystalGamesStudio/wspolniak/issues/106) | AFK | #104 |
| F5 — post integration | [#107](https://github.com/CrystalGamesStudio/wspolniak/issues/107) | AFK | #105 |
| F6 — production deploy + prod migration | [#108](https://github.com/CrystalGamesStudio/wspolniak/issues/108) | **HITL** | #107 |

Parent PRD: [#102](https://github.com/CrystalGamesStudio/wspolniak/issues/102) (stays open). Sub-issues created in `/dispatch`: **#103–#108**.
