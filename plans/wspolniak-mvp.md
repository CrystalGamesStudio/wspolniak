# Plan: Wspólniak MVP

> Source PRD: [`docs/002-prd.md`](../docs/002-prd.md) (discovery: [`docs/001-discovery.md`](../docs/001-discovery.md))

## Architectural decisions

Durable decisions that apply across all phases:

- **Architecture style**: Single Cloudflare Worker serving TanStack Start SSR + Hono API under one domain. One Worker = one family instance. No multi-tenancy.
- **Frontend**: TanStack Start (SSR + Router + Query), Tailwind v4, Shadcn. Polish-only UI, no i18n infrastructure.
- **Backend**: Hono routes mounted under `/api/*`, TanStack server functions for SSR-tied flows.
- **Database**: Neon PostgreSQL (serverless). Per-environment configs (dev/production). Soft deletes via nullable `deleted_at` on all user-generated content.
- **Image storage**: Cloudflare Images (paid ~$5/mo). Direct upload from client (bypasses Worker CPU). Automatic HEIC→JPEG conversion and variant generation.
- **Key entities**: `users` (admin + members), `posts`, `post_images`, `comments`, `push_subscriptions`, `instance_config`.
- **Auth model**: Passwordless magic links. Token hash in DB, long-lived signed cookie for session. No passwords, no registration, no email/SMS. Link = identity.
- **Authorization**: Two roles (`admin`, `member`). Pure-function rule engine. Admin override on all edit/delete operations.
- **Deployment model**: Self-hostable via "Deploy to Cloudflare" button. Per-instance Neon DB + CF Images binding. Zero shared infrastructure.
- **PWA**: `vite-plugin-pwa` with Workbox. Service Worker, manifest, Web Push (VAPID). iOS 16.4+ requires "Add to Home Screen" before push permission.
- **License**: AGPL-3.0-or-later. SPDX headers in all source files.
- **Quality gates per phase**: `pnpm types`, `pnpm lint`, `pnpm test` must pass. Max 500 lines per source file. Tests at module boundaries, not internals.

---

## Phase 1: Bootstrap + Magic Link Login

**User stories**: 1, 2, 3, 10, 11, 39, 40, 41, 42, 43, 44

### What to build

First tracer bullet cutting through the entire stack: public landing page, claim-instance flow, magic link authentication, and placeholder authenticated area. After this phase, a brand-new self-hoster can deploy the app, claim their instance as admin, receive a magic link, click it, and land in an authenticated (but mostly empty) app area.

The public landing renders at the root domain and describes the project with a link to the GitHub repository and a "Deploy to Cloudflare" call-to-action. The claim flow is gated by an empty-database check — once an admin exists, the setup endpoint returns 404. The claim form collects family name and admin name, creates the admin user, and displays a copyable magic link. Clicking a magic link verifies the token, sets a long-lived signed session cookie, and redirects to the authenticated area. The authenticated area at this stage is a simple "Witaj {name}" placeholder confirming the session works across SSR reloads. Invalid or revoked tokens show a clear error page telling the user to request a new link from the admin.

### Acceptance criteria

- [ ] Fresh deploy of the Worker with empty DB serves a public landing page at `/` with project description and GitHub link
- [ ] Visiting `/setup` on an empty instance shows a form; submitting it creates an admin user and displays a magic link for copying
- [ ] Visiting `/setup` after setup is complete returns 404
- [ ] Clicking a magic link sets a session cookie and redirects to the authenticated area showing the user's name
- [ ] Session persists across page refreshes (SSR reads cookie)
- [ ] Session survives for at least 30 days
- [ ] Clicking a magic link with an invalid or unknown token shows a friendly error page in Polish
- [ ] Authenticated users visiting `/` are redirected to the authenticated area, not the landing page
- [ ] Tokens are stored as hashes in DB, never plaintext
- [ ] DB schema migration for `users` and `instance_config` is versioned and reproducible
- [ ] `pnpm types && pnpm lint && pnpm test` pass

---

## Phase 2: Member Management

**User stories**: 4, 5, 6, 7, 9

### What to build

Admin UI for managing family members. Admin can create new members (name only), see a list of all members with their status, copy a member's magic link to distribute via external channels, regenerate a member's link (revoke), and soft-delete members. Non-admin members visiting admin-only routes get a 403.

New members added by the admin receive a token and appear in the member list immediately. The admin copies the magic link and sends it out of band. When the member clicks, they go through the same login flow built in Phase 1 and land in the authenticated area with their own name. Regenerating a link rotates the token hash in the database; the old link stops working on next use (existing cookie sessions continue until expiry — documented trade-off). Soft-deleting a member prevents their token from authenticating but preserves any content they created (displayed as "usunięty użytkownik" in later phases).

### Acceptance criteria

- [ ] Admin can access an admin panel route; non-admin members get 403
- [ ] Admin can create a new member by entering a name; the system generates a token and shows a copyable magic link
- [ ] Admin sees a list of all active members with their names and a button to copy each link
- [ ] Admin can regenerate a member's magic link; the old link is invalidated on next click attempt
- [ ] Admin can soft-delete a member; their token stops authenticating immediately
- [ ] A member with a new valid link successfully logs in and sees their own name
- [ ] A member with a revoked token sees the "link nieaktywny" error from Phase 1
- [ ] Member cannot self-delete or self-revoke (admin-only operation)
- [ ] DB schema supports soft delete via nullable timestamp
- [ ] `pnpm types && pnpm lint && pnpm test` pass

---

## Phase 3: Posts with Image Upload

**User stories**: 15, 16, 17, 18, 19, 20, 23, 25, 26, 27

### What to build

Core content flow. Authenticated members can create posts with an optional text description and 1-10 images. The client uploads images directly to Cloudflare Images using pre-signed upload URLs obtained from the backend, then submits the post with the resulting image IDs and description. Supported upload formats include JPEG, PNG, WebP, HEIC, and HEIF — HEIC is automatically converted by Cloudflare Images, so family members on iPhones can upload without any client-side conversion.

Before uploading, the client validates file count (≤10), file size (≤15 MB each), and the server enforces the daily post limit (50/day/user). The new-post form shows image previews before publishing and displays upload progress for each file. Validation errors (too many files, oversized, daily limit hit) are shown with clear Polish messages.

The feed at `/app` shows all posts chronologically (newest first), with author name, creation time, description, and image thumbnails. Clicking a thumbnail opens the full-resolution image. A single post view route shows the post details (without comments yet — those come in Phase 6). No pagination yet — this phase loads up to N recent posts (chosen to fit a typical family's first week of use); infinite scroll comes in Phase 4.

### Acceptance criteria

- [ ] Authenticated member can access a "new post" form with description input and file picker
- [ ] File picker accepts JPEG, PNG, WebP, HEIC, HEIF
- [ ] Client-side validation blocks selecting >10 files or any file >15 MB with clear error
- [ ] Selected images show previews before publishing
- [ ] Upload progress is visible per file during upload
- [ ] Uploads go directly to Cloudflare Images via pre-signed URLs (not through the Worker)
- [ ] HEIC files uploaded from an iPhone are viewable as JPEG/WebP by all family members
- [ ] Submitting the post creates the post and its image associations atomically in DB
- [ ] Server enforces the 50-posts-per-day-per-user limit and returns a clear error if exceeded
- [ ] Feed at `/app` shows posts in reverse chronological order with author, timestamp, description, and image thumbnails
- [ ] Clicking a thumbnail opens the full-resolution image
- [ ] Single post view route renders a single post by ID
- [ ] Thumbnails load quickly using the CF Images small variant
- [ ] DB schema for `posts` and `post_images` is migrated and versioned
- [ ] `pnpm types && pnpm lint && pnpm test` pass

---

## Phase 4: Feed Pagination (Infinite Scroll)

**User stories**: 24

### What to build

Replace the basic feed from Phase 3 with cursor-based infinite scroll delivering 20 posts per page. Cursor is stable (based on created_at + id) so new posts arriving during scroll don't cause duplicates or skips. The UI shows a loading indicator at the bottom of the feed and auto-loads the next page when the user approaches it.

This is a focused phase because cursor pagination shapes the Posts module's public API — doing it separately keeps the change scoped and testable.

### Acceptance criteria

- [ ] Feed loads initial 20 posts on page render
- [ ] Scrolling near the bottom auto-loads the next 20
- [ ] Reaching the end of the feed shows a "koniec" message
- [ ] New posts created by another user during active scrolling do not cause duplicate or missing entries on subsequent pages
- [ ] Cursor is stable across requests (created_at desc, id desc tiebreaker)
- [ ] Test suite includes cases for empty feed, single page, exact-boundary page, and multi-page scrolling
- [ ] `pnpm types && pnpm lint && pnpm test` pass

---

## Phase 5: Edit & Delete Posts + Authorization

**User stories**: 8 (post-level), 21, 22

### What to build

Formalize the authorization module as pure functions and apply it to post editing and deletion. Post authors can edit their own post descriptions and delete their own posts. Admins can edit and delete any post (admin override). Members attempting to edit or delete posts they don't own receive a 403.

Edits update the description only — images and author cannot be changed. Deletes are soft (set `deleted_at`), so deleted posts disappear from the feed but remain in the database for potential undelete (post-MVP). The feed and single post view filter out soft-deleted posts.

The authorization module exports narrow predicate functions (`canEditPost`, `canDeletePost`) that receive the actor and the target entity. These are unit-tested with 100% branch coverage. All mutation endpoints call these predicates before proceeding.

### Acceptance criteria

- [ ] Post author can edit their own post description through a UI control
- [ ] Post author can delete their own post through a UI control with confirmation
- [ ] Admin can edit any post's description
- [ ] Admin can delete any post
- [ ] Non-author non-admin member attempting edit or delete gets a 403 and UI shows an error
- [ ] Soft-deleted posts disappear from the feed and single-post view
- [ ] Database row remains with `deleted_at` populated
- [ ] Authorization predicates are pure functions with 100% branch coverage in unit tests
- [ ] `pnpm types && pnpm lint && pnpm test` pass

---

## Phase 6: Comments

**User stories**: 8 (comment-level), 29, 30, 31, 32

### What to build

Comments under posts. Flat chronological list (oldest first) below each post. Any authenticated member can add a comment to any post. Comment authors can edit and delete their own comments. Admin override applies (can delete anyone's comment). Soft delete; deleted comments are hidden from the list.

Comments are rendered inline in the single post view. The feed shows a comment count per post (badge) but not the comments themselves — clicking the post opens the full view with comments. Comment input is a simple textarea with 1000-character limit. Optimistic UI on submit is nice-to-have but not required.

### Acceptance criteria

- [ ] Single post view shows all non-deleted comments chronologically (oldest first)
- [ ] Authenticated member can add a comment via a form on the single post view
- [ ] Feed shows a comment count per post
- [ ] Comment author can edit their own comment's body
- [ ] Comment author can delete their own comment
- [ ] Admin can edit or delete any comment
- [ ] Non-author non-admin member attempting edit or delete gets 403
- [ ] Comments are limited to 1000 characters server-side with clear validation error
- [ ] Soft-deleted comments disappear from the UI but remain in the DB
- [ ] DB schema for `comments` is migrated and versioned
- [ ] Authorization uses the same module from Phase 5
- [ ] `pnpm types && pnpm lint && pnpm test` pass

---

## Phase 7: PWA Shell + Offline

**User stories**: 12, 13, 14, 28, 45

### What to build

Transform the web app into an installable PWA. Configure `vite-plugin-pwa` with Workbox to generate a Service Worker, web app manifest with Polish name "Wspólniak", icons, and theme color. Implement caching strategies:

- Application shell (HTML, JS, CSS): CacheFirst with revalidation on new deployment
- Cloudflare Images URLs: CacheFirst (content-addressed, immutable)
- API feed GET requests: NetworkFirst with cache fallback for offline reading
- API mutations: online-only, surface "Brak połączenia" toast if offline

On Android, show a native install prompt when the browser offers one. On iOS 16.4+, detect Safari and display a one-time onboarding banner explaining "Dodaj do ekranu głównego" with visual instructions — this is required before iOS will allow push permission in Phase 8. After PWA install, the onboarding banner disappears.

### Acceptance criteria

- [ ] Lighthouse PWA installability score is 100
- [ ] App installs on Android Chrome via install prompt
- [ ] App installs on iPhone Safari via "Dodaj do ekranu głównego" after seeing an onboarding banner
- [ ] Manifest shows name "Wspólniak" and family-friendly icons
- [ ] Offline visit to the app shell renders the last-cached feed
- [ ] Offline mutation attempts show "Brak połączenia" error without data loss
- [ ] First visit after a new deploy refreshes the shell (revalidation works)
- [ ] Service Worker cleans up old caches on activation
- [ ] Manual test on a real iPhone 16.4+ and a real Android device passes
- [ ] `pnpm types && pnpm lint && pnpm test` pass

---

## Phase 8: Push Notifications

**User stories**: 33, 34, 35, 36, 37, 38

### What to build

Web Push notifications via VAPID protocol. Generate VAPID key pair; store private key as Worker secret, embed public key in the client. On first visit post-install, the app requests notification permission (on iOS only after "Add to Home Screen" is confirmed). Granted permission triggers subscription to the browser's push service, and the subscription is saved server-side associated with the user.

Triggers:
- New post created → fan-out push to all members except the author
- New comment created → push only to the post's author (not if the comment author is the same person)

Push payload includes title ("{author} dodał zdjęcie" or "{author} skomentował Twoje zdjęcie"), body (short snippet), icon, and click URL pointing to the relevant post. Clicking a notification opens (or focuses) the PWA on the post.

Fan-out happens synchronously after the write transaction commits, using `waitUntil` so the response returns fast. Each push request is signed with VAPID JWT. If a push endpoint returns 410 Gone, the subscription is deleted from DB. Failed sends (non-410) are logged but don't retry in MVP.

### Acceptance criteria

- [ ] VAPID key pair generated; public key in client, private key in Worker secret
- [ ] After PWA install, app requests notification permission appropriately (Android immediately, iOS only after home-screen confirmation)
- [ ] Granted permission stores a push subscription in DB linked to the user
- [ ] Creating a new post triggers a push to every other member with an active subscription
- [ ] Creating a comment triggers a push to the post's author (only if commenter is not the author)
- [ ] Notifications include title, body, icon, and open the correct post when clicked
- [ ] Subscriptions returning 410 Gone are automatically removed from DB
- [ ] Authors do not receive notifications for their own actions
- [ ] Manual test on real iPhone 16.4+ PWA and real Android PWA passes
- [ ] Fan-out does not delay the API response (verified via timing)
- [ ] DB schema for `push_subscriptions` is migrated and versioned
- [ ] `pnpm types && pnpm lint && pnpm test` pass

---

## Phase 9: Release Polish

**User stories**: All MVP release criteria from the PRD

### What to build

Ready the project for public release and real-world use by the author's family and beta testers. This phase bundles non-code deliverables alongside final polish.

Add the `LICENSE` file with AGPL-3.0-or-later full text. Add SPDX identifier comments to all source files. Write the final landing page copy describing the project, showing screenshots (taken from phases 3-6), linking the GitHub repository, and providing a working "Deploy to Cloudflare" button. Produce PWA icons in the required sizes (192, 512, maskable, apple-touch) and wire them into the manifest. Write the `README.md` with sections for "About", "Self-host setup", "Stack", and "Contributing".

Recruit one external beta tester to self-host a fresh instance from the "Deploy to Cloudflare" button and report friction. Onboard at least 3 real family members (different device types: iPhone, Android, desktop) and run the app for at least one week. Collect critical bugs and fix them before declaring MVP done.

### Acceptance criteria

- [ ] `LICENSE` file contains AGPL-3.0-or-later full text at repo root
- [ ] Every source file under `src/` contains an SPDX identifier comment
- [ ] Landing page has final copy in Polish, screenshots, GitHub link, and working "Deploy to Cloudflare" button
- [ ] PWA icons are present in all required sizes and referenced in the manifest
- [ ] `README.md` is complete with About / Self-host / Stack / Contributing sections
- [ ] At least one external beta tester successfully self-hosts a fresh instance
- [ ] At least 3 family members on different device types (iPhone, Android, desktop) use the app for ≥1 week without critical bugs
- [ ] Push notifications verified working on all 3 device types over the beta period
- [ ] All bugs discovered during beta are either fixed or explicitly deferred to post-MVP with an issue
- [ ] `wspolniak.com` is deployed to production and accessible publicly
- [ ] `pnpm types && pnpm lint && pnpm test` pass
