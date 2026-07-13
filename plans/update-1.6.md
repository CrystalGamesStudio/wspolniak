# Update 1.6 — Publishing, Stats, Pinch-Zoom, Mentions & Rename User

## Problem Statement

Wspólniak's publishing flow and a handful of related surfaces have accumulated friction and bugs that the admin hits every day:

- **Publishing is slow and disorienting.** Compressing HEIC photos blocks the main thread, each photo costs a separate upload-URL round-trip, and the moment the user taps Publish the app yanks them back to the feed where a fake "Publishing…" placeholder post sits until the real one arrives. There is no progress affordance on the button itself.
- **Stats are admin-only and shallow.** The `/info` page is locked to admins and shows only global totals. Members have no visibility into who is most active, and even the admin can't see a per-person leaderboard.
- **Photo zoom doesn't work with fingers.** The lightbox supports zoom buttons and mouse-wheel, but a two-finger pinch — the gesture every phone user reaches for — does nothing.
- **Mentions are broken in three ways.** The `@mentions` dropdown doesn't follow the keyboard selection when it scrolls off-screen, mentions never render green in the feed (only in comments and post detail), and two-word names like "Jan Kowalski" only highlight the first word because the parser stops at the space.
- **Names can't be corrected.** There is no way for an admin to rename a member, so a two-word name that breaks mention highlighting can't even be worked around.

## Solution

A single coordinated update (1.6) that fixes all five areas, with no database migrations:

1. **Publishing** moves to a calm, blocking flow: stay on the form with an indeterminate progress bar filling the whole Publish button, do the heavy work off the main thread and in batch, then return to the feed showing the real published post — no placeholder, no optimistic UI.
2. **Stats** becomes `/stats`, split into a public top section (per-person leaderboards everyone can see) and the existing admin-only section below. A new public endpoint serves the leaderboards.
3. **Pinch-zoom** is added to the lightbox alongside the existing gestures, without breaking single-finger swipe/pan or the buttons.
4. **Mentions** get three targeted fixes plus a name-with-hyphen convention: keyboard selection auto-scrolls into view, the feed renders mentions through the shared highlighter, and the parser accepts hyphens so names like "Jan-Kowalski" highlight whole.
5. **Rename user** gives the admin a way to fix any member's name; because author names are joined live, the change is visible everywhere immediately.

## User Stories

### Publishing

1. As a poster, I want to stay on the New Post screen after tapping Publish, so that I can see the progress and trust something is happening.
2. As a poster, I want a progress bar that fills the whole Publish button while uploading, so that the button clearly signals work in progress.
3. As a poster, I want publishing to be noticeably faster for a batch of HEIC photos, so that I'm not stuck waiting.
4. As a poster, I want the app to take me to the feed only after the post is truly published, so that I see the real post and not a "Publishing…" stub.
5. As a poster, I want a failed publish to show an error on the form and leave my text/photos intact, so that I can retry without retyping.
6. As a maintainer, I want the optimistic-UI machinery removed entirely, so that there is no dead code or confusing placeholder posts.

### Stats

7. As a member, I want to open the stats page, so that I can see who is most active in the family.
8. As a member, I want to see a leaderboard of who posted the most, so that I can celebrate the most active posters.
9. As a member, I want a leaderboard for most comments, so that conversation leaders are visible.
10. As a member, I want a leaderboard for most photos uploaded, so that the family photographers get recognition.
11. As a member, I want a leaderboard for most reactions given, so that engaged members are highlighted.
12. As a member, I want to see who was mentioned the most by others, so that the most-connected people are visible.
13. As a member, I want to see who mentions others the most, so that social activity is recognizable.
14. As an admin, I want to keep seeing all the current admin stats (DAU/WAU/photos/push/totals), so that I don't lose operational visibility.
15. As an admin, I want the stats link visible only to me to stay admin-gated where appropriate, so that admin tools remain private.
16. As any user, I want the stats entry point in the navigation to use a chart icon and be reachable by everyone, so that it's discoverable.

### Pinch-Zoom

17. As a mobile user, I want to zoom into a photo by spreading two fingers, so that I can read detail like the natural phone gallery.
18. As a mobile user, I want to zoom out by pinching two fingers together, so that I can return to the full photo.
19. As a mobile user, I want single-finger swipe between photos to still work, so that pinch doesn't break navigation.
20. As a mobile user, I want to still pan a zoomed photo with one finger, so that pinch doesn't break panning.
21. As any user, I want the zoom buttons and mouse behavior unchanged, so that the new gesture is purely additive.

### Mentions

22. As a typist, I want the @mentions dropdown to keep the highlighted option in view as I arrow through it, so that I can see what's selected.
23. As a reader, I want @mentions to appear green in the feed just like in comments, so that mentions are consistent everywhere.
24. As a reader, I want a hyphenated multi-word name (e.g. "Jan-Kowalski") to highlight fully, so that the whole mention is green.
25. As an admin, I want to rename a member so that their name uses a hyphen and highlights correctly across the app.

### Rename user

26. As an admin, I want to edit any member's display name, so that I can fix typos or adjust formatting.
27. As an admin, I want the rename to take effect everywhere immediately, so that I don't have to chase stale copies.
28. As an admin, I want the rename control next to the existing member actions, so that member management stays in one place.

## Implementation Decisions

### Architecture & boundaries

- **`imageCompressionWorker`** — a new Web Worker (deep module) exposing a single `compress(file, options) → Promise<File>` interface. It hides OffscreenCanvas, the canvas→webp conversion, and all worker message plumbing. Compression runs off the main thread so the UI never freezes on HEIC. (This is a browser-side Worker, not a Cloudflare Worker — the Cloudflare edge runtime has no Canvas/OffscreenCanvas, but client compression already runs in the browser today and browsers fully support OffscreenCanvas in workers.)
- **Batched upload URLs** — replace N sequential `POST /upload-url` calls with one request that returns N `{cfImageId, uploadURL}` pairs, then upload all files in parallel.
- **`usePublishPost`** — a hook (deep module) that owns the whole publish lifecycle: request batch URLs, fan out parallel compression+upload through the worker, create the post, then navigate to the feed and invalidate the feed query on success. The route component shrinks to wiring.
- **Removed optimistic UI** — the placeholder-post machinery (mutation options, prepend helper, builder, the `pending` badge, and its tests) is deleted entirely; publish is now a straightforward blocking mutation with `mutateAsync` and a post-success navigate.
- **`getLeaderboard(category, limit)`** — a new query module (deep module) returning `[{name, count}]`. It hides the per-category GROUP BY logic, the author-name join, and the UNION needed for "who mentioned others the most" (mentions have no author column, so the author is resolved through the parent post or comment). Categories: posts, comments, photos, reactions, mentions-made, mentions-received.
- **Public stats endpoint** — a new `GET` route under the authenticated (non-admin) app endpoint serving the leaderboard; the existing admin `/stats` endpoint and its section stay admin-only.
- **`usePinchZoom`** — a hook (deep module) that manages two-finger geometry: initial finger distance, per-move delta, zoom scaling, clamping to the existing 1–4× range, and offset reset when returning to 1×. It composes with the existing single-finger swipe/pan and button handlers rather than replacing them.
- **`highlightMentions`** — the existing pure text module gains hyphen support so `@Jan-Kowalski` matches whole. Multi-word names are handled by convention (hyphen) rather than fragile space-aware regex.
- **`MentionText`** — the feed switches to the shared highlighter component already used by comments and post detail, instead of a plain paragraph.
- **Keyboard-follow scroll** — the mentions dropdown gets the standard "keep active `<li>` in view" behavior via `scrollIntoView({ block: 'nearest' })`.
- **Rename user** — a new `PATCH` admin member endpoint plus an `updateMemberName` query; the admin member UI gains an inline edit control alongside regenerate/delete. No snapshot fix-up is needed because `author.name` is already joined live from the users table on every post/comment read.

### Key data facts driving decisions

- The `mentions` table stores only the mentioned user (recipient), not the author; "mentions-made" must therefore derive the author from the parent post or comment via a UNION of two joins.
- Feed/post responses join `author.name` live from `users`, so a rename is visible everywhere after cache invalidation — no denormalized name columns to repair.
- Stats are computed on the fly (no stats table), so leaderboards are fresh queries, never stale aggregates.
- No new tables and no migrations are required for this entire update.

### Technology-specific constraints (stakeholder-confirmed)

- Quality gates before done: `pnpm types && pnpm test && pnpm lint`.
- Max 500 lines per source file; split when exceeding.
- Deep-module discipline: narrow interfaces, test at boundaries.
- No toast/notification library; the published post itself is the success signal.

## Validation Strategy

### Automated tests (validation criteria chosen by stakeholder)

- **`getLeaderboard` (DB queries)** — for each category, given a mocked DB with known per-user counts, the query returns users sorted by count descending, limited to N, each with the correct display name; the mentions-made category correctly aggregates across both posts and comments (UNION); the mentions-received category groups by the mentioned user.
- **`highlightMentions` (parsing)** — `@Jan-Kowalski` highlights whole; plain text after a mention is not colored; Polish characters match; a hyphenated name surrounded by punctuation still highlights; `email@example` is not treated as a mention.

### Manual / behavioral verification

- **Publishing**: tap Publish with ~8 HEIC photos → stay on form, button fills with the progress animation, no UI freeze; on completion land on the feed with the real post at the top; killing the network mid-publish shows the error alert and preserves form contents.
- **Optimistic removal**: confirm no "Publishing…" badge ever appears and that grep finds no leftover optimistic symbols.
- **Stats**: as a non-admin, open `/stats` and see only the public leaderboards; as admin, see both public and admin sections; each leaderboard shows correct top users; the nav link uses a chart icon and is reachable by everyone.
- **Pinch-zoom**: on a touch device, spread to zoom in, pinch to zoom out; one-finger swipe still changes photos at 1×; one-finger pan still works when zoomed; buttons and mouse behave unchanged.
- **Mentions**: type `@`, arrow through a long member list and confirm the highlight stays visible; post a mention and confirm it renders green in the feed; rename a two-word member to a hyphenated name and confirm the whole mention is green.
- **Rename**: rename a member and confirm the new name appears in the feed, post detail, and mentions within one cache refresh.

### Done criteria per component

- All chosen automated tests pass; `pnpm types && pnpm test && pnpm lint` is green; no file exceeds 500 lines; every user story above is demonstrable.

## Out of Scope

- Determinate (percentage) upload progress on the Publish button — indeterminate only.
- Real upload-speed telemetry or A/B comparison dashboards.
- Restructuring the duplicated sidebar nav into a single shared module (both copies updated in place).
- Changing mouse-wheel behavior in the lightbox (wheel still swipes between photos, as today).
- Space-aware multi-word mention highlighting — handled by the hyphen-name convention instead.
- Any database migration or new table.
- Backend rename of the route path only (`/info` → `/stats`); old bookmarks are not redirected.
- Public stats beyond leaderboards (no member-level detail drill-down, no time-series).

## Further Notes

- **Open decision (deferred to `/carve`):** exact top-N value for leaderboards (default proposal: top 3) and the precise chart icon (proposal: `BarChart3` from lucide).
- **Open decision (deferred to `/carve`):** whether the mentions-made leaderboard uses a single combined UNION query or two queries merged in code — recommended single UNION for one round-trip.
- **Dependency ordering:** D3 (hyphen parser) and E (rename) are coupled — rename is what lets an admin convert a broken two-word name into a hyphenated one, so they ship together. A1 (worker) and A2 (flow) are coupled within publishing. B (stats) and C (pinch) are independent and can land in any order.
- **Git workflow:** direct to `main`, no PR; a single GitHub issue tracks the whole bundle.
- This is release **1.6**.
