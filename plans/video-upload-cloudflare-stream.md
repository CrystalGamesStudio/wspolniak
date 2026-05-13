# Plan: Video Upload & Playback with Cloudflare Stream

> Source PRD: [GitHub Issue #56](https://github.com/CrystalGamesStudio/wspolniak/issues/56)

## Architectural decisions

- **Architecture style**: Existing TanStack Start + Hono on Cloudflare Workers. No new infrastructure — CF Stream fits naturally alongside existing CF Images.
- **Data model**: New `post_videos` table mirroring `post_images` structure. Shared `displayOrder` across images and videos for unified ordering.
- **Key entities**: `post_videos(id, postId, cfStreamUid, displayOrder, processingStatus, createdAt)`
- **Integrations**: Cloudflare Stream API for upload, transcoding, thumbnail generation, and playback. Same signed-URL direct-upload pattern as CF Images.
- **Auth/ownership**: Existing auth middleware. Delete restricted to post author or admin.
- **Limits**: 100 MB per video, max 3 videos per post, max 5 video uploads per user per day, all CF Stream supported formats.

---

## Phase 1: Single Video Upload to Feed

**User stories**: 1, 5, 7, 8, 13, 14

### What to build

Tracer bullet — the thinnest end-to-end path: a user uploads one video file, it gets stored in CF Stream, the video record is saved to the database, and the video appears in the feed with an auto-generated thumbnail from CF Stream. Post can be created with only a video (no text, no images). File validation rejects files over 100 MB and unsupported formats. This phase establishes the DB schema, API endpoint, upload flow, and feed rendering — everything else builds on top.

### Acceptance criteria

- [ ] `post_videos` table created and migrated
- [ ] `POST /api/app/videos/upload-url` returns a valid CF Stream signed upload URL
- [ ] Client can upload a video file to CF Stream and receive a UID
- [ ] Post creation accepts a single `cfStreamUid` and creates a `post_videos` record
- [ ] Feed displays the video with a CF Stream auto-generated thumbnail
- [ ] Uploading a file >100 MB shows a clear error
- [ ] Uploading an unsupported format shows a clear error
- [ ] Post with only a video (no text) can be created and displayed

---

## Phase 2: Upload Progress & Processing Status

**User stories**: 3, 4, 9

### What to build

Add visibility into the upload and processing pipeline. During file upload to CF Stream, show a progress bar tracking bytes transferred. After upload, poll CF Stream's status endpoint to track transcoding progress — show a processing indicator in the compose UI. Once CF Stream reports "ready", show the auto-generated thumbnail as a preview. Post submission is blocked until all attached videos reach "ready" status. If processing fails, show an error and allow removal.

### Acceptance criteria

- [ ] Upload progress bar tracks real-time bytes transferred to CF Stream
- [ ] Processing indicator (spinner/bar) shows while CF Stream is transcoding
- [ ] Thumbnail preview appears once video reaches "ready" status
- [ ] Post submit button is disabled while any video is still "processing"
- [ ] Failed processing shows an error state with option to remove the video
- [ ] Status polling stops once video reaches a terminal state ("ready" or "error")

---

## Phase 3: Multiple Videos + Mixed Media

**User stories**: 2, 6

### What to build

Extend the single-video flow to support up to 3 videos per post, mixed with photos in the same post. Videos and images share a unified `displayOrder` for consistent ordering in the feed and post detail. The create/edit post UI gains a tab or toggle to switch between adding photos and videos, with separate counters for each (max 10 images + max 3 videos).

### Acceptance criteria

- [ ] Post creation accepts up to 3 video UIDs
- [ ] Videos and images coexist in the same post with shared ordering
- [ ] Feed renders the mixed media carousel/grid correctly
- [ ] Attempting to add a 4th video shows a limit error
- [ ] Image limit (10) and video limit (3) are enforced independently
- [ ] Existing image drag-and-drop reordering works alongside videos

---

## Phase 4: Adaptive Autoplay & Playback

**User stories**: 10, 11, 12

### What to build

Replace the static thumbnail in the feed with a full video player experience. On fast connections (4g detected via Network Information API), videos autoplay muted inline in the feed. On slow connections or when the API is unavailable (e.g., iOS Safari), show only the thumbnail — click to play. Clicking any video opens fullscreen playback with sound via CF Stream's player. Smooth transitions between autoplay and paused states.

### Acceptance criteria

- [ ] Videos autoplay muted in feed on 4g connections
- [ ] Videos show only thumbnail on slow connections (3g/2g/slow-2g)
- [ ] Clicking a video opens fullscreen playback with sound
- [ ] Graceful fallback when Network Information API is unavailable (no autoplay)
- [ ] Autoplay does not trigger on iOS Safari (no Network Info API support)
- [ ] Multiple visible videos don't all autoplay simultaneously (consider viewport/intersection)

---

## Phase 5: Management, Limits & Full Integration

**User stories**: 15, 16, 17, 18, 19

### What to build

Complete the feature with deletion, rate limiting, and integration into all views. Post authors and admins can delete videos from posts (calling CF Stream API to remove the source file). Daily upload limit of 5 videos per user is enforced at the API level. Videos render in the post detail view (alongside comments) and in the shared post view for external viewers.

### Acceptance criteria

- [ ] Author can delete their own video from a post
- [ ] Admin can delete any user's video from a post
- [ ] Non-author, non-admin cannot delete videos (403)
- [ ] Deleting a video also removes it from CF Stream
- [ ] Daily limit of 5 video uploads enforced; 6th returns 429 with clear message
- [ ] Videos display correctly in post detail view with comments
- [ ] Videos display correctly in shared post view for unauthenticated users
- [ ] All video-related DB records cleaned up on post soft-delete
