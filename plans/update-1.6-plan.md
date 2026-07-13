# Plan: Update 1.6 — Publishing, Stats, Pinch-Zoom, Mentions & Rename User

> Source PRD: [`plans/update-1.6.md`](./update-1.6.md) · GitHub issue [#89](https://github.com/CrystalGamesStudio/wspolniak/issues/89)

## Architectural decisions

Durable decisions that apply across all phases:

- **Architecture style**: unchanged — TanStack Start (SSR + Router + Query) frontend, Hono API on Cloudflare Workers, Neon Postgres + Drizzle ORM.
- **Data model**: no new tables, **no migrations**. Reuses `posts`, `comments`, `postImages`, `postReactions`, `mentions`, `users`.
- **Key entities**: `User` (id, name, role — name joined live), `Mention` (userId = recipient only; author derived via parent post/comment), `Post`/`Comment` (authorId).
- **Auth**: public stats via `appEndpoint` (logged-in, any role); admin sections/endpoints via `adminEndpoint` (`role === "admin"`).
- **Integrations**: client-side image compression via a browser Web Worker + OffscreenCanvas (not the CF edge runtime — edge has no Canvas). Cloudflare Images direct upload URLs, now requested in batch.
- **Mention highlighting**: pure client-side regex; multi-word names handled by a **hyphen convention** (e.g. `Jan-Kowalski`), not a backend mention list in the feed.
- **Name propagation**: `author.name` is joined live from `users` on every read, so a rename is visible everywhere after cache invalidation. Mention text inside post bodies is a literal snapshot and is not rewritten.
- **Workflow**: single GitHub issue (#89); commits direct to `main`, no PR. Quality gates before done: `pnpm types && pnpm test && pnpm lint`. Max 500 lines/file. Deep modules; tests beside source.

---

## Phase 1: Mentions polish (area D)

**User stories**: 22, 23, 24

### What to build

Make `@mentions` render and behave correctly everywhere, end-to-end, on the client. Three coupled fixes ship together because they share the mention rendering module: (a) the dropdown keeps the keyboard-selected option scrolled into view; (b) the feed renders mention text through the shared highlighter (green), matching comments and post detail; (c) the parser accepts hyphens so a hyphenated multi-word name highlights whole.

### Files

- `src/components/app/mentions-text.ts` — extend `highlightMentions` regex to include `-` (FE, pure module)
- `src/components/app/mentions-text.test.ts` — add/adjust cases (FE, test)
- `src/components/app/mention-input.tsx` — `scrollIntoView({ block: "nearest" })` on the active `<li>` via ref in `navigateDropdown` (FE)
- `src/components/app/feed.tsx` — replace plain `<p>{description}</p>` with `<MentionText …/>` (FE)

### Tests

- `highlightMentions`: `@Jan-Kowalski` highlights whole; text after a mention is not colored; Polish chars match; punctuation boundaries; `email@example` is not a mention.

### Dependencies

- None.

### Acceptance criteria

- [ ] Arrow-keying through a long member dropdown keeps the highlighted row visible.
- [ ] A posted `@mention` renders green in the feed.
- [ ] A hyphenated name (e.g. `@Jan-Kowalski`) is fully green; plain trailing text is not.
- [ ] `pnpm types && pnpm test && pnpm lint` green.

---

## Phase 2: Pinch-zoom in lightbox (area C)

**User stories**: 17, 18, 19, 20, 21

### What to build

Add two-finger pinch-to-zoom to the existing lightbox as a purely additive gesture. A `usePinchZoom` hook (deep module) owns the geometry: on `touchstart` with two touches it records the initial finger distance; on `touchmove` it scales zoom by the distance delta, clamped to the existing 1–4× range, and resets the pan offset when returning to 1×. It composes with the existing single-finger swipe (1×) and pan (>1×), mouse-wheel, and zoom buttons — none of those change.

### Files

- `src/components/app/image-lightbox.tsx` — add `usePinchZoom`, branch touch handlers on `touches.length === 2` before the existing one-finger logic (FE)

### Tests

- Manual/behavioral (touch device). Hook logic (delta → zoom, clamp 1–4×, offset reset at 1×) optionally unit-tested if extracted purely.

### Dependencies

- None (independent track).

### Acceptance criteria

- [ ] Spread two fingers → zoom in; pinch together → zoom out, smoothly, clamped 1–4×.
- [ ] Single-finger swipe still changes photos at 1×.
- [ ] Single-finger pan still works when zoomed.
- [ ] Zoom buttons and mouse behavior unchanged.

---

## Phase 3: Publishing flow & optimistic cleanup (area A2)

**User stories**: 1, 2, 4, 5, 6

### What to build

Rebuild the publish UX as a calm, blocking flow (correctness first; speed comes in Phase 4). After tapping Publish the user **stays on the form**, the whole Publish button fills with an indeterminate progress animation, the post is created, and only on success does the app navigate to the feed showing the **real** post. All optimistic-UI machinery is removed entirely — no placeholder post, no "Publishing…" badge. A `usePublishPost` hook (deep module) owns: call create, `navigate("/app")` + invalidate feed on success, surface errors via the existing Alert.

### Files

- `src/routes/app/new.tsx` — drop immediate `navigate`, switch to `mutateAsync` + post-success navigate; wire `usePublishPost` (FE)
- `src/components/app/new-post-form.tsx` — indeterminate progress bar filling the whole submit button (replaces `LoaderIcon`) (FE)
- `src/components/app/feed-query.ts` — delete `createPostMutationOptions`, `prependOptimisticPost`, `buildOptimisticPost`, `OptimisticPostInput`, `PostMutationContext`; keep `feedQueryKey` and `FeedPost`/`FeedPage` types (FE)
- `src/components/app/feed-query.test.ts` — delete optimistic-flow tests (FE, test)
- `src/components/app/feed.tsx` — remove the "Publikowanie…" badge, `post.pending` usage, and `aria-busy` (FE)

### Tests

- Update feed-query tests to reflect removed optimistic code; ensure no leftover references.

### Dependencies

- None (Phase 4 builds on the `usePublishPost` hook introduced here).

### Acceptance criteria

- [ ] Tapping Publish keeps the user on the form with the button's progress animation running.
- [ ] On success, lands on the feed with the real post at the top (no placeholder, no badge).
- [ ] On failure, error shows on the form; text/photos preserved.
- [ ] No optimistic symbols remain (`grep` clean).
- [ ] `pnpm types && pnpm test && pnpm lint` green.

---

## Phase 4: Publishing speed (area A1)

**User stories**: 3 (reinforces 1, 2)

### What to build

Make publishing of multi-photo HEIC batches noticeably faster, layered onto the Phase 3 flow. Compression moves off the main thread into a new `imageCompressionWorker` (deep module: `compress(file, options) → Promise<File>`, hiding OffscreenCanvas + canvas→webp + worker plumbing). Upload URLs are fetched in **one batch** request returning N `{cfImageId, uploadURL}` pairs instead of N sequential round-trips; all compress+upload pairs run in parallel. `usePublishPost` is updated to fan out through the worker.

### Files

- `src/images/compress.worker.ts` — new Web Worker (OffscreenCanvas, webp) (FE)
- `src/images/compress.ts` — refactor `compressImage` to post to the worker (keep interface) (FE)
- `src/hono/api/images.ts` — add batch upload-URL endpoint (BE)
- `src/routes/app/new.tsx` / `usePublishPost` — batch URL fetch + parallel compress+upload via worker (FE)

### Tests

- Optional: worker `compress` boundary test (File in → smaller webp File out, dimensions ≤ max). Endpoint test for batch response shape.

### Dependencies

- **Hard**: after Phase 3 (integrates into `usePublishPost`).

### Acceptance criteria

- [ ] UI does not freeze while compressing ~8 HEIC photos.
- [ ] Only one upload-URL request is issued per publish (batch).
- [ ] Published post still lands correctly (Phase 3 flow intact).
- [ ] `pnpm types && pnpm test && pnpm lint` green.

---

## Phase 5: Rename user (area E)

**User stories**: 25, 26, 27, 28

### What to build

Give the admin a way to rename any member, end-to-end. New `PATCH /api/admin/members/:id` endpoint with `{ name }` validation (non-empty, max length) calls a new `updateMemberName(userId, name)` query. The admin member list gains an inline edit control next to regenerate/delete. Because `author.name` is joined live, the new name appears in feed/post-detail/mentions after feed cache invalidation. (Note: literal mention text inside old post bodies is a snapshot and is not rewritten — that's expected and acceptable.)

### Files

- `src/db/identity/queries.ts` (or members domain) — `updateMemberName(userId, name)` (BE, DB)
- `src/hono/api/admin.ts` — `PATCH /members/:id` (BE)
- `src/routes/app/admin.tsx` + admin member component — inline rename UI (FE)
- rename call site — invalidate feed cache on success (FE)

### Tests

- `updateMemberName`: updates row, returns updated name. Endpoint: validation (empty/oversized → 400), auth (non-admin → 403).

### Dependencies

- **Soft**: after Phase 1 (the hyphen convention is what makes a renamed two-word name highlight whole — E is what lets an admin apply that fix).

### Acceptance criteria

- [ ] Admin can rename a member from the admin panel.
- [ ] New name shows in feed/post detail within one cache refresh.
- [ ] Empty/oversized names rejected; non-admins get 403.
- [ ] `pnpm types && pnpm test && pnpm lint` green.

---

## Phase 6: Stats /info → /stats (area B)

**User stories**: 7, 8, 9, 10, 11, 12, 13, 14, 15, 16

### What to build

The biggest slice: rename `/app/info` to `/app/stats`, open it to all users, and add a public leaderboard section above the existing admin section. A new `getLeaderboard(category, limit)` query module (deep module) returns top-N `[{name, count}]` per category (posts, comments, photos, reactions, mentions-received) plus the **mentions-made** ranking resolved via a single UNION of `mentions→posts.authorId` and `mentions→comments.authorId`. A new public `GET /api/app/stats/leaderboard` endpoint (under `appEndpoint`) serves it. The nav entry uses a `BarChart3` icon, label "Statystyki", and is reachable by everyone; admins additionally see the existing DAU/WAU/photos/push/totals section.

### Files

- `src/db/stats/queries.ts` — `getLeaderboard(category, limit)` incl. mentions-made UNION (BE, DB)
- `src/db/stats/queries.test.ts` — leaderboard tests (BE, test)
- `src/hono/api/app.ts` (or new stats route file) — `GET /stats/leaderboard` (public, logged-in) (BE)
- `src/routes/app/info.tsx` → rename to `src/routes/app/stats.tsx` (`createFileRoute("/app/stats")`), relax `beforeLoad`, add public leaderboard section (FE)
- `src/components/app/mobile-sidebar.tsx` + `src/components/app/desktop-sidebar.tsx` — `NAV_ITEMS`: `to "/app/stats"`, icon `BarChart3`, label "Statystyki", `adminOnly: false` (FE)

### Tests

- `getLeaderboard`: per-category sort DESC + LIMIT N + name; mentions-made aggregates across posts AND comments (UNION); mentions-received groups by recipient.

### Dependencies

- None (independent track; placed last because it's the heaviest).

### Acceptance criteria

- [ ] Non-admin opens `/stats` and sees public leaderboards; admin sees both public and admin sections.
- [ ] Each leaderboard shows the correct top-3 users with names.
- [ ] mentions-made counts span posts + comments; mentions-received counts recipients.
- [ ] Nav uses a chart icon and is visible to everyone.
- [ ] `pnpm types && pnpm test && pnpm lint` green.

---

## Recommended execution order

1 → 2 → 3 → 4 → 5 → 6

Phases 1, 2, and 6 are fully independent and can be parallelized if desired. Phase 4 is blocked by Phase 3. Phase 5 is soft-blocked by Phase 1.
